# Workflow Failure Mode Analysis

This document analyzes the task management failures that occurred during S-005 and S-006 execution. It traces root causes in the tooling, answers the research questions from S-007, and evaluates the proposed fixes for feasibility.

## Observed Failure Modes

During execution of S-005 (Solar Engine) and S-006 (Location Input), the multi-agent task management system failed in several interconnected ways. Each failure mode compounded the others, creating a cascade of state corruption that ultimately required manual intervention to resolve.

### Failure Mode 1: State Desync Between DAG and Ticket Files

The task-graph.yaml and ticket markdown files disagree about task status. For example, examining T-005-01-sun-position.md reveals the ticket frontmatter shows `status: pending`, but task-graph.yaml shows T-005-01 as `complete` with a `completed_at` timestamp. This happened because agents updated task-graph.yaml directly without touching the ticket files.

The root cause is architectural. The current design treats task-graph.yaml as the source of truth, with ticket files serving as optional documentation. When agents complete work, they edit the YAML directly using `just task-complete` or manual edits. The ticket frontmatter was never updated because nothing in the workflow requires it.

The impact is that running `just dag-refresh` produces warnings about mismatches, and humans cannot trust ticket files to reflect actual state. The entire point of having tickets as structured documents is lost when their metadata is stale.

### Failure Mode 2: Uncommitted Work in Main Worktree

The git status shows multiple untracked files and uncommitted changes in the main worktree, including the actual implementation files for S-006 tasks. The files `src/lib/geo/timezone.ts`, `src/lib/geo/geocoding.ts`, and `src/lib/components/LocationInput.svelte` exist in the working directory but were never committed. The task-graph.yaml also shows uncommitted modifications.

The root cause is that agents ran in the main worktree instead of linked worktrees. The Ralph loop and manual agent sessions both operated on main, accumulating changes without creating branches or commits. The workflow documentation in CLAUDE.md explains the worktree-based PR flow, but nothing enforces it.

The impact is severe. Work can be lost if the directory is cleaned. Multiple agents cannot work concurrently because they would conflict on the same files. The commit history becomes meaningless when major features appear in single monolithic commits long after the work was done.

### Failure Mode 3: Phantom Task Claiming

Tasks were marked in-progress without corresponding agent execution. The git history shows T-006-02 had a `claimed_at` timestamp but no work was done before it was manually reset. The S-007 story hypothesizes this occurs when `just prompt` is invoked automatically by editor integrations or file watchers, claiming tasks without executing them.

The root cause in the code is that `just prompt` (via prompt.ts) combines task discovery and task claiming in a single operation. Every invocation modifies the YAML to mark a task in-progress, even if the caller just wanted to preview what's available.

The impact is that ready tasks get burned through the queue faster than agents can work them. An agent requesting work might find nothing available because a previous automatic invocation already claimed everything. The `claimed_at` timestamps accumulate without corresponding work.

### Failure Mode 4: Missing Ticket Files for YAML Tasks

The task-graph.yaml contains nodes for T-006-01 through T-006-04, but no corresponding ticket markdown files exist in `docs/active/tickets/`. The only S-006 tickets are research artifacts. The T-005 tickets exist because they were created during planning, but T-006 apparently skipped the planning phase and went straight to implementation.

The root cause is that the R-P-I (Research-Plan-Implement) pattern wasn't enforced. An agent could add task nodes directly to the YAML without creating ticket files. The `dag-refresh` command reports these as warnings but doesn't block execution.

The impact is loss of traceability and context. Tickets provide implementation details, acceptance criteria, and technical notes that the YAML entries lack. Without tickets, agents must infer requirements from the story alone, increasing the chance of misimplementation.

### Failure Mode 5: Premature Completion Without Verification

Tasks were marked complete despite missing or incomplete deliverables. The task-graph.yaml shows T-006-02, T-006-03, and T-006-04 as complete with timestamps, yet at the time this was analyzed the output files existed but had never been committed. The `just task-complete` command trusts the caller completely and performs no verification.

The root cause is the absence of completion guards. The `cmdTaskComplete` function in dag.ts simply changes status and adds a timestamp. It doesn't check whether the specified output path exists, whether the content is non-trivial, or whether the work was committed.

The impact is false confidence in progress. The DAG status shows work as done when it's actually incomplete or at risk of loss. Other tasks depending on the "completed" work may fail unexpectedly.

## Root Cause Tracing in Tooling

The five failure modes share three common architectural defects in the current tooling.

### Defect 1: Wrong Source of Truth

The design placed task-graph.yaml as the authoritative record, treating ticket files as supplementary. This is backwards. Human-readable documents with rich context should be authoritative, and machine-readable aggregates should be derived. When agents can bypass tickets and edit the YAML directly, the tickets become stale documentation rather than living specifications.

The `just dag-refresh` command was designed as a validation tool rather than a generation tool. It reports mismatches but doesn't fix them. A correct design would have `dag-refresh` regenerate the nodes section entirely from ticket frontmatter, treating manual YAML edits as temporary overrides that get wiped on refresh.

### Defect 2: Destructive Prompt Generation

The `just prompt` command combines two operations that should be separate: querying for available work and claiming work. Every invocation writes to task-graph.yaml, even when the caller might just want to see what's ready. This makes the command unsafe for preview operations, automation triggers, or repeated manual invocations.

The fix requires splitting read and write operations. A read-only `just prompt` should show the next task without claiming it. An explicit `just prompt --accept` or `just task-claim` should perform the state transition.

### Defect 3: Missing Environment Validation

Nothing prevents agents from running in inappropriate contexts. An agent can run `just ralph` from the main worktree, claiming tasks and writing files that should go to a feature branch. An agent can claim tasks from any story regardless of its assigned worktree. An agent can mark tasks complete regardless of whether output exists.

The fix requires validation at every state transition. Before claiming, verify the execution context (worktree vs main, story assignment). Before completing, verify deliverables exist and are committed.

## Research Question Answers

### R1: What Triggers Automatic Prompt Invocation?

Investigation found no explicit automated triggers in this repository. There are no active git hooks (only sample templates in `.git/hooks/`), no Claude Code hook configuration (`.claude/` directory doesn't exist), and no file watcher configurations. However, the phantom claiming still occurred.

The most likely explanation is manual error during interactive development. When an agent or human runs `just prompt` to preview available work, that invocation claims the task. If they then abandon the session or switch context, the task remains claimed without work. This isn't truly "automatic" invocation, but the effect is identical because the command lacks a preview mode.

Another possibility is shell history replay or editor command integration where the user triggers `just prompt` without realizing it claims. The fix of making `just prompt` read-only addresses all these scenarios.

### R2: How Should Ticket Frontmatter Schema Look?

The existing tickets use a reasonable schema that should be standardized. Based on T-005-01-sun-position.md, the required fields should be id (unique identifier like T-005-01), title (human-readable name), story (parent story reference like S-005), status (one of pending, ready, in-progress, complete), priority (integer, lower is higher priority), and complexity (S, M, L, XL).

Optional fields should include milestone (for milestone-tagged work), depends_on (array of task IDs this depends on), assignee (worktree name when claimed), claimed_at (ISO timestamp), completed_at (ISO timestamp), output (file path or directory for deliverables), and created (date the ticket was created).

The `just dag-refresh` command should read these fields from all tickets and regenerate the nodes section of task-graph.yaml. Fields not present in frontmatter should use sensible defaults (empty depends_on, null milestone, etc.).

### R3: Should Edges Be Explicit or Inferred?

Edges should be explicit in ticket frontmatter using the `depends_on` field. Inference from story structure is too coarse because not all tasks within a story depend on each other, and some tasks may have cross-story dependencies.

The current YAML edges section works well for expressing the dependency graph, but it should be derived from ticket frontmatter rather than maintained manually. The `dag-refresh` command should read each ticket's `depends_on` array and generate corresponding edges.

For the common R-P-I pattern within a story, a convention could auto-generate edges (R depends on nothing, P depends on R, I depends on P), but explicit `depends_on` provides flexibility for more complex patterns.

### R4: How to Detect Placeholder Content?

Detecting placeholder content requires multiple heuristics because no single check is reliable across all file types.

For code files, check that the file contains at least one export statement, one function or class definition, or one statement beyond imports. Files with only imports and no implementation are likely placeholders.

For markdown files, check that the file has content beyond the frontmatter. A document with only YAML frontmatter and no prose is incomplete.

For all files, check minimum size thresholds. A TypeScript module under 100 bytes is suspicious. A markdown document under 50 bytes after frontmatter is suspicious.

The implementation could use a simple heuristic: if the output path is a single file, verify it exists and has more than a trivial size threshold. If the output path is a directory, verify it contains at least one non-empty file. This catches the most common failures without requiring language-specific parsing.

## Evaluation of Proposed Fixes

The S-007 story proposes five implementation tickets. Each is evaluated for feasibility and impact.

### T-007-01: Diagnose Phantom Claiming (Feasibility: Complete via this research)

This ticket asked for research into what triggers automatic `just prompt` calls. The research found no automated triggers but identified that the real problem is the command's side effect, not its invocation source. The fix is making `just prompt` read-only, which is addressed in T-007-03.

This ticket can be marked complete because its research output is this document.

### T-007-02: Implement Ticket-First DAG Generation (Feasibility: Medium, High Impact)

Refactoring `just dag-refresh` to generate nodes from ticket frontmatter is straightforward. The existing `scanDocuments` function already parses frontmatter from markdown files. The change is to use that data to overwrite the nodes section rather than just validate it.

The complexity comes from handling task entries that don't have ticket files (like the R-P-I phase tasks that are generated from story structure). One approach is to require ticket files for all tasks, deprecating inline nodes. Another is to merge ticket-derived nodes with YAML-defined nodes, with tickets taking precedence.

The recommended approach is to keep story-level tasks (S-005-R, S-005-P, S-005-I) in the YAML since they follow a predictable pattern from stories, while requiring ticket files for granular implementation tasks (T-005-01, T-005-02, etc.). The edges section can remain manually maintained for now, with a future enhancement to derive edges from ticket `depends_on` fields.

Implementation estimate: The core change is about 50 lines of code in dag.ts to make node generation authoritative from tickets.

### T-007-03: Add Claim Guards (Feasibility: Medium, High Impact)

Making `just prompt` read-only requires splitting the current `claimAndGeneratePrompt` function into two operations. The read path generates the prompt without writing YAML. The write path (invoked by `--accept` flag or separate command) performs the claim.

The claim guards require environment detection. Checking whether we're in a linked worktree is already implemented (the `isLinkedWorktree` function exists). Checking the current worktree name against WORKTREE_STORY requires reading the WORKTREE environment variable. Refusing to claim from main requires detecting the main worktree, which is the one where `.git` is a directory rather than a file.

The `.ralph/current-task` tracking file adds state management complexity. The file must be created on claim, checked on subsequent claims (to prevent double-claiming), and removed on completion. Edge cases include crash recovery (stale current-task file) and manual resets.

Implementation estimate: About 100 lines of new code across prompt.ts and dag.ts, plus tests.

### T-007-04: Add Completion Guards (Feasibility: Easy, High Impact)

The completion guards are straightforward to implement. Before marking complete, check that the task's output path exists. For file paths, use `existsSync`. For directory paths, verify the directory exists and contains at least one file.

The placeholder detection can use the file size heuristic described above. The uncommitted changes warning can use `git status --porcelain` filtered to the output path.

The main design decision is whether guards should be warnings or blockers. A warning prints a message but allows completion. A blocker refuses to complete and exits with an error. The recommendation is to start with warnings and add a `--strict` flag for blockers, allowing flexibility during the transition.

Implementation estimate: About 40 lines of new code in dag.ts.

### T-007-05: Add Audit Logging (Feasibility: Easy, Medium Impact)

The Ralph loop already writes logs to `logs/ralph.jsonl`. Adding task state transition logging requires writing similar entries from prompt.ts and dag.ts whenever status changes.

The log format should include timestamp, task ID, old status, new status, triggering command (prompt, task-complete, task-reset), and worktree identity. Using JSON lines format matches the existing Ralph logs.

Implementation estimate: About 30 lines of logging code spread across the relevant functions.

## Recommended Implementation Order

Based on impact and dependencies, the recommended implementation order is T-007-03 first because the read-only prompt fix prevents new phantom claiming immediately and has the highest urgency. Then T-007-04 because completion guards prevent premature completion and are easy to implement. Then T-007-02 because ticket-first generation fixes the source-of-truth problem but requires more careful design. Finally T-007-05 because audit logging is helpful for debugging but doesn't fix active failure modes.

T-007-01 is complete via this research document and requires no implementation.

## Conclusion

The workflow failures during S-005 and S-006 stem from three architectural defects: wrong source of truth (YAML instead of tickets), destructive prompt generation (claiming on read), and missing environment validation (no guards on claims or completions). The proposed fixes in S-007 address all three defects through ticket-first DAG generation, read-only prompt with explicit accept, claim guards enforcing worktree boundaries, and completion guards verifying deliverables.

The fixes are feasible within the current codebase structure. The total implementation estimate is approximately 220 lines of new code across prompt.ts and dag.ts, plus corresponding tests. The most urgent fix is making `just prompt` read-only since that prevents new phantom claiming immediately.

---

## Implementation Status (Updated 2026-01-28)

All S-007 tickets have been implemented. Here is the current state:

### T-007-01: Diagnose Phantom Claiming ✓

Completed via this research document and the companion `phantom-claiming.md`. The root cause was identified as the destructive `just prompt` design, not external triggers.

### T-007-02: Ticket-First DAG Generation ✓

The `just dag-refresh` command now regenerates nodes from ticket frontmatter in `docs/active/tickets/`. Key behaviors:

- Tickets are scanned and validated for required fields (id, title, story, status, priority, complexity)
- Nodes are generated from ticket frontmatter with descriptions extracted from markdown body
- Edges are generated from ticket `depends_on` arrays
- Story-level tasks (S-XXX-R/P/I pattern) are preserved from the existing YAML since they don't have ticket files yet
- Deleted ticket files are automatically removed from the graph (T-* nodes without ticket files are dropped)
- Status is computed based on dependency completion (pending → ready when deps are met)

The implementation ensures tickets are the source of truth for granular tasks, while story-level tasks remain in YAML until migrated (tracked in S-008).

### T-007-03: Add Claim Guards ✓

The `just prompt` command is now read-only by default:

- `just prompt` shows a preview without claiming
- `just prompt --accept` claims the next available task
- `just prompt <task-id>` claims a specific task by ID
- `just prompt --current` shows the currently claimed task

Guards implemented:
- **Main repo guard**: Cannot claim from main worktree (must use `just worktree-new`)
- **Single task guard**: Cannot claim while already working on a task (`.ralph/current-task` tracking)
- **Story filter guard**: WORKTREE_STORY must match available tasks
- **Double-claim prevention**: Exit code 2 if task is already claimed

### T-007-04: Add Completion Guards ✓

The `just task-complete` command now validates deliverables:

- Checks that output files/directories exist
- Warns if files appear incomplete (under size thresholds)
- Warns if output has uncommitted changes
- `--force` flag overrides all guards
- Clears `.ralph/current-task` on completion

### T-007-05: Add Audit Logging ✓

All task state transitions are logged to `logs/task-audit.jsonl`:

- `claimed`: Task claimed by an agent
- `completed`: Task marked complete
- `force-completed`: Task completed with --force flag
- `reset`: Task reset to ready
- `claim-blocked`: Claim attempt rejected by guards
- `complete-blocked`: Completion attempt rejected by guards
- `preview`: Read-only prompt invocation

Each entry includes timestamp, task_id, old_status, new_status, worktree, trigger command, and optional notes.

## Remaining Work (S-008)

While S-007 fixed the immediate issues, S-008 addresses remaining gaps:

1. **Story-level task migration**: S-XXX-R/P/I nodes still exist in YAML without ticket files. These should be migrated to tickets for full ticket-first operation.

2. **Worktree alignment validation**: The guards check for main repo but don't validate that worktree name, branch name, and story filter are consistent.

3. **Concurrent execution testing**: The multi-agent system has never been tested with two ralph loops running simultaneously on different worktrees.

4. **State synchronization**: When one agent completes work in their worktree, other agents don't see it until the branch is merged. This workflow needs documentation or tooling support.
