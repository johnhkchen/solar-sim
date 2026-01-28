# Foundation Phase Milestones

> **Last Updated**: 2026-01-27

Concrete checkpoints for the multi-agent workflow infrastructure. Each milestone is demonstrable and builds toward `just prompt` being functional.

---

## Overview

```
M1: DAG Introspection     ──► `just dag-status` shows real data
         │
         ▼
M2: Frontmatter Scanning  ──► `just dag-refresh` validates docs against DAG
         │
         ▼
M3: Basic Prompt          ──► `just prompt` outputs usable prompt
         │
         ▼
M4: Task Lifecycle        ──► Claiming, completion, and recovery work
         │
         ▼
M5: Worktree Commands     ──► `just worktree-*` enable parallel agents
         │
         ▼
M6: Ralph Loop            ──► `just ralph` runs autonomous loop (stretch)
```

**Critical Path**: M1 → M2 → M3 → M4 (for `just prompt` to be production-ready)

---

## M1: DAG Introspection

**Goal**: `just dag-status` parses task-graph.yaml and displays actionable status.

### Success Criteria

- [ ] Parses `task-graph.yaml` without external dependencies (or minimal ones)
- [ ] Computes which tasks are `ready` (dependencies satisfied)
- [ ] Displays summary statistics
- [ ] Lists available work with priority

### Deliverable

```bash
$ just dag-status

📊 Task Graph Status
====================
Stories: 4 total
  - research: 3
  - pending: 1

Tasks: 10 total
  - ready: 3
  - pending: 7
  - in-progress: 0
  - complete: 0

Ready for work (highest priority first):
  [P1] S-001-R  Research Ralph Loop integration
  [P1] S-002-R  Research DAG parsing approaches
  [P2] S-003-R  Research Git worktree workflow

Run `just prompt` to get the next task.
```

### Technical Approach

Options (to be decided in S-002 research):
- Shell + `yq` (simple, requires yq installation)
- Python script (portable, slightly heavier)
- Node.js script (aligns with SvelteKit stack)

### Stories Involved

- S-002: DAG Parsing and Prompt Generation

---

## M2: Frontmatter Scanning

**Goal**: `just dag-refresh` reads YAML frontmatter from story/ticket files and validates DAG integrity.

### Success Criteria

- [ ] Scans `docs/active/stories/*.md` and `docs/active/tickets/*.md`
- [ ] Extracts YAML frontmatter (between `---` delimiters)
- [ ] Reports which documents were found
- [ ] Detects orphaned tasks (in DAG but no doc) and orphaned docs (doc but not in DAG)
- [ ] Validates no cycles exist in dependency graph

### Deliverable

```bash
$ just dag-refresh

📄 Scanning documents...

Stories (docs/active/stories/):
  ✓ S-001-ralph-loop.md
  ✓ S-002-dag-parsing.md
  ✓ S-003-git-worktrees.md
  ✓ S-004-sveltekit-scaffold.md

Tickets (docs/active/tickets/):
  (none)

Summary: 4 stories, 0 tickets scanned

Validation:
  ✓ All DAG tasks have corresponding documents
  ✓ All documents have DAG entries
  ✓ No dependency cycles detected
  ✓ No orphaned references

DAG integrity: OK
```

### Error Cases

```bash
# Missing document
⚠ Warning: Task S-005-I in DAG has no corresponding document

# Orphaned document
⚠ Warning: docs/active/stories/S-006-foo.md not referenced in DAG

# Cycle detected
✗ Error: Dependency cycle detected: S-001-I → S-002-P → S-001-I
```

### Stories Involved

- S-002: DAG Parsing and Prompt Generation

---

## M3: Basic Prompt Generation

**Goal**: `just prompt` selects the next task and outputs a complete prompt for Claude.

### Success Criteria

- [ ] Selects highest-priority `ready` task
- [ ] Reads task description from DAG
- [ ] Reads related story document for context
- [ ] Outputs formatted prompt suitable for `claude` CLI
- [ ] Returns non-zero exit code if no tasks available

### Deliverable

```bash
$ just prompt

# Task: S-001-R - Research Ralph Loop integration

## Context

You are working on Solar-Sim, a webapp for calculating sun hours.
Read CLAUDE.md for project conventions.

Current phase: Foundation & Tooling
This task is part of: S-001 (Ralph Loop Integration)

## Your Assignment

Research the Ralph autonomous loop runner:
- How Ralph executes prompts
- Prompt source integration
- State management and failure handling
- Monitoring and observability

Output: docs/knowledge/research/ralph-loop.md

## Related Documents

Read these for context:
- docs/active/stories/S-001-ralph-loop.md

## Acceptance Criteria

From the story, you should answer these research questions:
- R1: How does Ralph determine when execution is complete?
- R2: How does Ralph receive prompts?
- R3: How do we prevent duplicate task pickup?
- R4: How do we handle failures?
- R5: How do we monitor progress?

## When Complete

1. Create your research document at the output path
2. Run: `just task-complete S-001-R`
3. The next task will become available

Begin.
```

### No Work Available

```bash
$ just prompt
No tasks available. All tasks are either complete, in-progress, or blocked.
$ echo $?
1
```

### Stories Involved

- S-002: DAG Parsing and Prompt Generation

---

## M4: Task Lifecycle

**Goal**: Tasks can be claimed, completed, and recovered from failures.

### Success Criteria

- [ ] `just prompt` marks selected task as `in-progress` before outputting
- [ ] `just task-complete <id>` marks task as `complete`
- [ ] `just task-reset <id>` returns task to `ready` (for recovery)
- [ ] Second `just prompt` call returns different task (or none if all claimed)
- [ ] Stale in-progress tasks can be identified and reset

### Deliverable

```bash
# First agent claims a task
$ just prompt > /tmp/task1.md
# Task S-001-R is now in-progress

# Second agent gets different task
$ just prompt > /tmp/task2.md
# Task S-002-R is now in-progress

# Check status
$ just dag-status
Tasks: 10 total
  - ready: 1
  - pending: 7
  - in-progress: 2   # S-001-R, S-002-R
  - complete: 0

# Agent completes work
$ just task-complete S-001-R
✓ S-001-R marked complete
  → S-001-P is now ready

# Recovery from failure
$ just task-reset S-002-R
✓ S-002-R reset to ready (was: in-progress)
```

### Recovery Scenarios

**Scenario: Agent crashes mid-task**
```bash
# Task was left in-progress, agent died
$ just dag-status
⚠ S-002-R has been in-progress for 2 hours (may be stale)

# Human or recovery agent resets it
$ just task-reset S-002-R
```

**Scenario: Agent produced partial output**
```bash
# Research doc exists but is incomplete
$ just task-reset S-002-R
# New agent picks up, sees partial work, continues or restarts
```

### Tracking Metadata

Tasks should track:
```yaml
- id: S-001-R
  status: in-progress
  claimed_at: 2026-01-27T10:30:00Z  # When claimed
  claimed_by: worktree-alpha        # Optional: which worktree/agent
```

### Stories Involved

- S-002: DAG Parsing and Prompt Generation
- S-003: Git Worktree Workflow (for `claimed_by` coordination)

---

## M5: Worktree Commands

**Goal**: Git worktrees enable parallel agent development without conflicts.

### Success Criteria

- [ ] `just worktree-new <name>` creates worktree at `../solar-sim-<name>`
- [ ] Creates appropriate feature branch
- [ ] `just worktree-list` shows all worktrees with branch info
- [ ] `just worktree-remove <name>` cleanly removes worktree
- [ ] Documentation explains the workflow

### Deliverable

```bash
$ just worktree-new alpha
Creating worktree: ../solar-sim-alpha
  Branch: feature/alpha
  Status: Ready

To start working:
  cd ../solar-sim-alpha
  just prompt | claude --dangerously-skip-permissions

$ just worktree-new beta
Creating worktree: ../solar-sim-beta
  Branch: feature/beta
  Status: Ready

$ just worktree-list
Worktrees:
  * /path/to/solar-sim (main) [main worktree]
    /path/to/solar-sim-alpha (feature/alpha)
    /path/to/solar-sim-beta (feature/beta)

$ just worktree-remove alpha
Removing worktree: ../solar-sim-alpha
  ✓ Worktree removed
  ✓ Branch feature/alpha preserved (has unmerged commits)
```

### Branch Strategy

- Each worktree gets `feature/<name>` branch
- Branches are preserved on removal if they have unmerged work
- Agents should commit frequently to preserve progress

### Stories Involved

- S-003: Git Worktree Workflow

---

## M6: Ralph Loop (Stretch)

**Goal**: `just ralph` runs continuous autonomous execution.

### Success Criteria

- [ ] Integrates with Ralph (or implements equivalent loop)
- [ ] Calls `just prompt` to get work
- [ ] Pipes prompt to `claude --dangerously-skip-permissions`
- [ ] Waits for completion
- [ ] Loops until no tasks remain (or stopped)
- [ ] Handles errors gracefully (doesn't crash on single task failure)

### Deliverable

```bash
$ just ralph
🔄 Starting Ralph Loop...

[1/∞] Fetching next task...
  → S-001-R: Research Ralph Loop integration
  → Executing via Claude...
  → Complete (exit 0)
  → Marked S-001-R complete

[2/∞] Fetching next task...
  → S-002-R: Research DAG parsing approaches
  → Executing via Claude...
  → Complete (exit 0)
  → Marked S-002-R complete

[3/∞] Fetching next task...
  → No tasks available (all complete or blocked)

✓ Ralph Loop finished. 2 tasks completed.
```

### Error Handling

```bash
[3/∞] Fetching next task...
  → S-003-R: Research Git worktree workflow
  → Executing via Claude...
  → Failed (exit 1)
  → Task S-003-R left in-progress for manual review
  → Continuing with next task...
```

### Stories Involved

- S-001: Ralph Loop Integration

---

## Milestone Dependencies

```
        ┌─────┐
        │ M1  │  DAG Introspection
        └──┬──┘
           │
        ┌──▼──┐
        │ M2  │  Frontmatter Scanning
        └──┬──┘
           │
        ┌──▼──┐
        │ M3  │  Basic Prompt
        └──┬──┘
           │
        ┌──▼──┐
        │ M4  │  Task Lifecycle
        └──┬──┘
           │
     ┌─────┴─────┐
     │           │
  ┌──▼──┐     ┌──▼──┐
  │ M5  │     │ M6  │  (can be parallel after M4)
  └─────┘     └─────┘
 Worktrees   Ralph Loop
```

---

## Recovery Philosophy

**Principle**: Any agent should be able to understand and fix the current state by reading the documents.

1. **Status is in task-graph.yaml**: Single source of truth for what's done/pending
2. **Work products are in docs/**: Research findings, plans, etc. are human-readable
3. **Git preserves history**: Can always see what was attempted
4. **Reset is cheap**: `just task-reset <id>` gets things back to a known state
5. **Partial work is visible**: Agents can see and build on incomplete attempts

**When things go wrong**:
```bash
# See current state
just dag-status

# Read what was attempted
cat docs/knowledge/research/ralph-loop.md  # (partial?)

# Reset and retry
just task-reset S-001-R
just prompt
```
