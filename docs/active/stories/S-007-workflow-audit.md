---
id: S-007
title: Task Management Workflow Audit
status: pending
priority: 0
milestone: null
---

# S-007: Task Management Workflow Audit

This story addresses critical reliability issues in the multi-agent task management system. It has priority 0 (highest) because these bugs block all future concurrent development.

## Problem Statement

During S-005 and S-006 execution, the task management system repeatedly failed in ways that corrupted workflow state and wasted effort.

### Critical Bug: Phantom Task Claiming

Tasks are being claimed (status changed to in-progress) without any agent actually working on them. This appears to happen when something triggers `just prompt` - perhaps a file watcher, linter hook, or editor integration. Each `just prompt` call claims the next ready task, so repeated invocations burn through the task queue marking everything in-progress without doing work.

Evidence: T-006-02 and T-006-03 were both marked in-progress and then "complete" within minutes, but no implementation files were created. The task-graph.yaml showed `claimed_at` timestamps but no corresponding commits or file changes.

### Critical Bug: Manual YAML as Source of Truth

The task-graph.yaml is being hand-edited to add tasks, change statuses, and update counts. This is backwards - the YAML should be derived from ticket frontmatter via `just dag-refresh`, not maintained manually. Manual edits introduce errors and make the DAG unreliable.

Evidence: Stories S-005 and S-006 had tasks added directly to the YAML without corresponding ticket files. When tickets were later created, they didn't match the YAML entries. The `meta` counts were often wrong because they were updated manually.

### Secondary Issues

**Missing tickets**: The R-P-I pattern requires tickets for implementation work, but stories jumped straight to implementation without creating tickets. S-005 and S-006 both had ad-hoc task entries added to the YAML.

**No deliverable verification**: Tasks marked complete without output files existing. The `just task-complete` command trusts the caller completely.

**State desync**: Changes accumulated in main's working directory instead of worktree branches. The intended PR flow never happened.

**Duplicate claiming**: Both worktrees claimed the same task because the story filter wasn't being used.

## Root Cause Analysis

### Prompt Auto-Invocation

Something in the development environment is calling `just prompt` automatically. Likely candidates include editor extensions that run commands on file save, terminal hooks, or Claude Code's own tooling. Each invocation claims a task, so rapid-fire invocations claim multiple tasks instantly.

The fix requires understanding what triggers these calls and either preventing them or making `just prompt` idempotent (not claiming on repeated calls for the same task).

### YAML-First Design Flaw

The original design made task-graph.yaml the source of truth and `just dag-refresh` an optional validation tool. This inverts the correct relationship. Ticket markdown files should be authoritative, and the YAML should be generated from them.

The fix requires refactoring `just dag-refresh` to generate the nodes section from ticket frontmatter, not just validate it.

### Missing Safeguards

The tooling trusts agents completely. There are no checks for:
- Whether output files exist before marking complete
- Whether we're in a worktree vs main repo
- Whether the claimed task matches the worktree's assigned story
- Whether work was actually committed

## Proposed Architecture

### Core Principle: Read-Only Prompt, Explicit Accept

The fundamental fix is separating task discovery from task claiming. The current `just prompt` both shows and claims, which causes phantom claiming when invoked accidentally.

**New command structure:**
- `just prompt` - Read-only. Shows the next available task without claiming it. Safe to run repeatedly.
- `just prompt --accept` - Explicitly claims the task. Updates ticket frontmatter. Outputs the prompt for execution.
- `just task-complete <id>` - Marks task complete by updating ticket frontmatter.
- `just dag-refresh` - Regenerates task-graph.yaml from ticket frontmatter.

### Ticket-First Workflow

Tickets become the source of truth. Each ticket file in `docs/active/tickets/` contains YAML frontmatter with id, title, story, status, priority, complexity, dependencies, and output path.

Status changes happen by editing ticket frontmatter:
- `just prompt --accept` sets `status: in-progress` and `claimed_at: <timestamp>` in the ticket file
- `just task-complete` sets `status: complete` and `completed_at: <timestamp>` in the ticket file
- `just dag-refresh` reads all tickets and regenerates task-graph.yaml

The task-graph.yaml becomes a derived artifact, not the source of truth. Manual edits to the nodes section are overwritten on refresh.

### Claim Guard

With the new architecture, claiming only happens via `just prompt --accept`. Guards include:
1. If a task is already in-progress for this worktree (check `.ralph/current-task`), refuse to claim another
2. If `WORKTREE_STORY` is set, only allow claiming tasks from that story
3. If running from main repo, refuse to claim (protect main from state pollution)

### Completion Guard

Add a completion guard to `just task-complete` that prevents completion if:
1. The task's output path is specified but the file doesn't exist
2. The output file exists but is empty or placeholder content
3. There are uncommitted changes to the output files

### Audit Trail

Log all task state transitions to `logs/task-audit.jsonl` with timestamp, task ID, old status, new status, worktree name, and trigger source. This creates a forensic record for debugging.

## Implementation Tickets

### T-007-01: Diagnose Phantom Claiming

Research what's triggering automatic `just prompt` calls. Check for editor hooks, file watchers, and shell integrations. Document the trigger mechanism. This informs whether we need additional safeguards beyond the read-only prompt fix.

### T-007-02: Implement Ticket-First DAG Generation

Refactor `just dag-refresh` to generate nodes from ticket frontmatter. The command should scan `docs/active/tickets/*.md`, extract frontmatter, and regenerate the nodes section. Stories section remains manually maintained. Edges are derived from ticket `depends_on` fields. This makes tickets the source of truth.

### T-007-03: Add Claim Guards

Implement read-only prompt and explicit accept:
- `just prompt` becomes read-only (no state changes)
- `just prompt --accept` claims by updating ticket frontmatter
- Track current task in `.ralph/current-task`
- Enforce WORKTREE_STORY matching
- Detect and refuse to claim from main repo

### T-007-04: Add Completion Guards

Implement the completion guard in `just task-complete`:
- Update ticket frontmatter (not task-graph.yaml directly)
- Verify output files exist if specified
- Check for placeholder/empty content
- Warn about uncommitted changes
- Run `dag-refresh` after updating ticket

### T-007-05: Add Audit Logging

Implement task state transition logging:
- Log claims, completions, and resets
- Include worktree identity and timestamps
- Create `logs/task-audit.jsonl`

## Acceptance Criteria

The workflow is fixed when:

1. Running `just prompt` twice in a row does not claim two different tasks
2. Tickets are the source of truth and `just dag-refresh` regenerates nodes from them
3. `just task-complete` refuses to complete tasks with missing output files
4. Running `just ralph` from main repo produces an error
5. The audit log shows a clear history of all task state changes

## Research Questions

R1: What is invoking `just prompt` automatically? Check `.claude/`, editor configs, shell hooks.

R2: How should ticket frontmatter schema look? What fields are required vs optional?

R3: Should edges be explicit in ticket frontmatter or inferred from story structure?

R4: How to detect "placeholder content" reliably? File size? Pattern matching?

## Dependencies

This story has no dependencies and blocks all other work. Complete S-007 before resuming S-006 or starting any new concurrent development.
