---
id: S-007
title: Task Management Workflow Audit
status: in-progress
priority: 0
milestone: null
---

# S-007: Task Management Workflow Audit

This story addresses critical reliability issues in the multi-agent task management system. It has priority 0 (highest) because these bugs block all future concurrent development.

## Problem Statement

During S-005 and S-006 execution, the task management system repeatedly failed in ways that corrupted workflow state and wasted effort. The research phase (S-007-R) investigated these failures and documented findings in `docs/knowledge/research/workflow-failures.md`. This section summarizes the key problems.

### Critical Bug: Phantom Task Claiming

Tasks were claimed without any agent actually working on them because every `just prompt` invocation writes to task-graph.yaml. The research found no automated triggers (no active git hooks, no Claude Code hooks, no file watchers), but the real problem is the command's destructive side effect, not its invocation source. When agents or humans preview available work with `just prompt`, that invocation claims the task. If they then switch context or abandon the session, the task remains claimed without work.

### Critical Bug: Manual YAML as Source of Truth

The task-graph.yaml was being hand-edited directly, inverting the correct relationship between tickets (human-readable specifications) and the DAG (machine-readable aggregate). This caused desync between ticket frontmatter and YAML entries, with neither being reliably accurate.

### Secondary Issues

The research identified three additional failure modes. First, S-006 tasks were added to the YAML without corresponding ticket files, losing traceability and context. Second, tasks were marked complete without verifying that output files existed or contained meaningful content. Third, work accumulated in main's working directory instead of worktree branches because nothing enforced the worktree-based PR flow.

## Implementation Plan

The research phase answered all four research questions and evaluated the proposed fixes. This plan implements those fixes in priority order based on impact and dependencies.

### Implementation Order

The implementation follows the dependency chain established in the ticket files. T-007-01 (phantom claiming diagnosis) is already complete via the research document. T-007-02 (ticket-first DAG) must come next because the other fixes depend on the ticket-first architecture. Then T-007-03 (claim guards) and T-007-04 (completion guards) can proceed in parallel since both depend only on T-007-02. Finally T-007-05 (audit logging) integrates with the guarded commands.

### T-007-01: Diagnose Phantom Claiming (COMPLETE)

The research phase answered this question fully. No automated triggers exist in this repository, but the problem is the command's destructive nature. The fix is making `just prompt` read-only, which is addressed in T-007-03.

**Status**: Complete via `docs/knowledge/research/workflow-failures.md`

### T-007-02: Implement Ticket-First DAG Generation

This ticket establishes tickets as the source of truth by refactoring `just dag-refresh` to generate nodes from ticket frontmatter. The ticket file at `docs/active/tickets/T-007-02-ticket-first-dag.md` contains the full specification including the frontmatter schema, generation algorithm, and error handling.

**Test Cases for T-007-02:**

Test case 2.1 verifies basic node generation. Create a new ticket file with valid frontmatter, run `just dag-refresh`, and confirm the ticket appears in task-graph.yaml with all fields correctly populated.

Test case 2.2 verifies edge generation. Create two tickets where one has `depends_on` referencing the other, run refresh, and confirm the edges section contains the dependency.

Test case 2.3 verifies readiness computation. Create a ticket with `status: ready` that depends on an incomplete task, run refresh, and confirm the generated node shows `status: pending` because dependencies aren't met.

Test case 2.4 verifies manual edits are overwritten. Manually edit a node in task-graph.yaml, run refresh, and confirm the edit is reverted to match the ticket frontmatter.

Test case 2.5 verifies error reporting. Create a ticket with missing required fields, run refresh, and confirm the command reports clear error messages listing all problems.

Test case 2.6 verifies story preservation. The stories section should remain unchanged after refresh since stories are still manually maintained.

### T-007-03: Add Claim Guards and Read-Only Prompt

This ticket makes `just prompt` read-only by default and requires explicit `--accept` to claim. The ticket file at `docs/active/tickets/T-007-03-claim-guards.md` contains the full specification including command behavior, guards, and frontmatter updates.

**Test Cases for T-007-03:**

Test case 3.1 verifies read-only prompt. Run `just prompt` twice in a row, confirm both show the same task, confirm no files changed (check `git status`).

Test case 3.2 verifies explicit accept. Run `just prompt --accept`, confirm the ticket frontmatter shows `status: in-progress` with `claimed_at` and `claimed_by` fields, confirm `.ralph/current-task` exists with correct content.

Test case 3.3 verifies single task guard. With a task already claimed (`.ralph/current-task` exists), run `just prompt --accept` again, confirm it refuses with "Already working on T-XXX-NN" message.

Test case 3.4 verifies main repo guard. From the main repo (where `.git` is a directory), run `just prompt --accept`, confirm it refuses with "Cannot claim tasks from main repo" message.

Test case 3.5 verifies story filter. Set `WORKTREE_STORY=S-999` (nonexistent story), run `just prompt`, confirm it reports no tasks available for that story.

Test case 3.6 verifies current flag. After claiming a task, run `just prompt --current`, confirm it shows the claimed task details without claiming another.

### T-007-04: Add Completion Guards

This ticket prevents premature completion by verifying deliverables before marking tasks complete. The ticket file at `docs/active/tickets/T-007-04-completion-guards.md` contains the full specification including guards and warning behavior.

**Test Cases for T-007-04:**

Test case 4.1 verifies output file guard. Create a ticket specifying `output: nonexistent.ts`, run `just task-complete T-XXX-NN`, confirm it refuses with "Output file missing" error.

Test case 4.2 verifies force override. Same setup as 4.1, run `just task-complete T-XXX-NN --force`, confirm it completes and logs the force override.

Test case 4.3 verifies placeholder warning. Create a ticket pointing to a file with only 100 bytes, run complete, confirm it prints a warning about possibly incomplete content but still completes.

Test case 4.4 verifies uncommitted warning. Create a ticket pointing to a file with uncommitted changes, run complete, confirm it warns about uncommitted changes.

Test case 4.5 verifies ticket update. After completion, confirm the ticket frontmatter shows `status: complete` with `completed_at` timestamp.

Test case 4.6 verifies dag-refresh integration. After completion, confirm task-graph.yaml was updated via automatic dag-refresh.

### T-007-05: Add Audit Logging

This ticket creates a forensic record of all task state transitions. The ticket file at `docs/active/tickets/T-007-05-audit-logging.md` contains the full specification including log format and events.

**Test Cases for T-007-05:**

Test case 5.1 verifies claim logging. Run `just prompt --accept`, confirm `logs/task-audit.jsonl` contains an entry with event type "claimed".

Test case 5.2 verifies completion logging. Run `just task-complete`, confirm the audit log contains an entry with event type "completed".

Test case 5.3 verifies force logging. Run `just task-complete --force`, confirm the audit log shows "force-completed" event.

Test case 5.4 verifies reset logging. Run `just task-reset T-XXX-NN`, confirm the audit log contains a "reset" entry.

Test case 5.5 verifies log format. Parse the audit log with a JSON parser, confirm all entries are valid JSON with required fields (timestamp, event, task_id, old_status, new_status, worktree).

## Ticket Frontmatter Schema

The research phase determined the standard schema. Required fields are id (format T-{story}-{sequence}), title (under 80 chars), story (parent story ID), status (ready, pending, in-progress, or complete), priority (0-5, lower is higher), and complexity (S, M, L, or XL).

Optional fields include milestone (for milestone-tagged work), depends_on (array of task IDs), output (expected deliverable path), claimed_at (ISO timestamp set by accept), claimed_by (worktree name), and completed_at (ISO timestamp set by complete).

Dependencies are explicit via the `depends_on` field in ticket frontmatter. The research confirmed that inference from story structure is too coarse for complex patterns. The dag-refresh command reads each ticket's depends_on array and generates corresponding edges.

## Architecture Summary

The core architectural change is inverting the source of truth. Before this story, agents edited task-graph.yaml directly, with tickets as optional documentation. After this story, agents edit ticket frontmatter via the guarded commands, and task-graph.yaml is regenerated from tickets.

The command structure becomes `just prompt` for read-only task preview, `just prompt --accept` for explicit claiming with guards, `just task-complete` for guarded completion, and `just dag-refresh` for regenerating the YAML from tickets.

## Acceptance Criteria

The workflow is fixed when all test cases pass and the following high-level criteria are met. Running `just prompt` twice does not claim two different tasks. Tickets are the source of truth and `just dag-refresh` regenerates nodes from them. The `just task-complete` command refuses to complete tasks with missing output files unless forced. Running `just prompt --accept` from main repo produces an error. The audit log shows a clear history of all task state changes.

## Dependencies

This story has no dependencies and blocks all other concurrent development work. The S-006 implementation tasks remain in their current state until S-007 completes.
