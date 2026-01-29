# Phase 4 Research Questions: Single Ralph Loop QA

This document establishes objective truths about the single-agent serial execution model before planning the next sprint. The goal is to verify that one ralph loop works correctly before attempting parallel execution.

## Context: Where We Are

### Completed Work

Phase 3 verified two core subsystems. The solar engine in `src/lib/solar/` passed 127 tests covering position calculations, sun hours integration, seasonal aggregation, and light category classification. The location system in `src/lib/geo/` passed 79 tests covering coordinate parsing, timezone detection, and geocoding with rate limiting. The LocationInput component compiles and integrates all geo modules.

### Workflow Tooling State

The prompt.ts supports claiming tasks via `just prompt --accept` from main repo when no task is in-progress. Completion is handled via `just task-complete`. The .ralph/current-task file tracks the active task. Audit logging writes state transitions to logs/task-audit.jsonl.

### Current Execution Model

We're using single-agent serial execution from main. The workflow is:

1. `just prompt` — preview next available task
2. `just prompt --accept` — claim the task, get full prompt
3. Agent executes the work
4. `just task-complete` — mark done, update DAG
5. Repeat until no tasks remain

No worktrees, no WORKTREE_STORY filter, no concurrent agents.

## Research Questions

### R1: Does the Basic Claim-Execute-Complete Cycle Work?

The fundamental loop has three steps: claim a task, do the work, mark it complete. We need to verify each step works correctly in isolation and in sequence.

Sub-questions:
- Does `just prompt` correctly show the highest-priority ready task?
- Does `just prompt --accept` correctly update task-graph.yaml to in-progress?
- Does `just prompt --accept` correctly create .ralph/current-task?
- Does `just prompt --accept` block when a task is already in-progress?
- Does `just task-complete` correctly update task-graph.yaml to complete?
- Does `just task-complete` correctly remove .ralph/current-task?
- Does the next `just prompt` show the correct next task after completion?

Evidence needed: Run through a complete cycle manually and verify each state transition.

### R2: Does `just ralph` Execute the Loop Correctly?

The ralph.sh script automates the claim-execute-complete cycle. It should claim a task, invoke Claude Code with the prompt, wait for completion, and loop until no tasks remain.

Sub-questions:
- Does the loop correctly detect when no tasks are available and exit?
- Does the loop correctly invoke Claude Code with the generated prompt?
- Does the loop handle Claude Code success (exit 0) correctly?
- Does the loop handle Claude Code failure (non-zero exit) correctly?
- Does the heartbeat file update during execution?
- Are logs written correctly during the loop?

Evidence needed: Create a test story with 2-3 simple tasks and run `just ralph` to completion.

### R3: What Is the Current DAG State?

After archiving Phase 3, the active directories are empty. We need to verify the DAG is in a clean state ready for new work.

Sub-questions:
- Does `just dag-refresh` run without errors?
- Are there orphan nodes in task-graph.yaml referencing deleted tickets?
- Does `just dag-status` accurately report the current state?
- Is .ralph/current-task cleared (no stale in-progress task)?

Evidence needed: Run DAG commands and inspect outputs.

### R4: Do Completion Guards Work?

The completion guards in dag.ts verify output exists before allowing completion. We need to confirm they catch real problems.

Sub-questions:
- Does completion fail when the ticket's `output` path doesn't exist?
- Does completion warn about uncommitted changes?
- Does `--force` correctly bypass guards?
- Are guard failures logged to the audit log?

Evidence needed: Attempt completion with missing output, observe guard behavior.

### R5: Is the Audit Log Capturing Useful Data?

The audit log should provide a clear record of what happened for debugging.

Sub-questions:
- Are claim events logged with task ID and timestamp?
- Are completion events logged?
- Are guard failures logged with reason?
- Can the log be used to reconstruct the execution history?

Evidence needed: Run some operations, examine logs/task-audit.jsonl.

## Test Plan

### Phase 4a: Manual Verification

Before running automated loops, manually verify each command:

1. Check DAG state: `just dag-status`, `just dag-refresh`
2. Check no stale task: `ls -la .ralph/`
3. Create a test story with one trivial ticket
4. Run `just prompt` — verify preview
5. Run `just prompt --accept` — verify claim
6. Check .ralph/current-task exists
7. Run `just prompt --accept` again — verify it blocks
8. Run `just task-complete` — verify completion
9. Check .ralph/current-task removed
10. Check task-graph.yaml updated

### Phase 4b: Automated Loop Test

After manual verification passes:

1. Create test story S-012 with 3 sequential tickets
2. Run `just ralph` from main
3. Observe loop execution
4. Verify all 3 tickets complete
5. Verify loop exits cleanly
6. Review audit log for complete history

### Phase 4c: Failure Mode Testing

After happy path works:

1. Test completion with missing output
2. Test completion with uncommitted changes
3. Test claiming when already in-progress
4. Test DAG with circular dependencies (should error)

## Success Criteria

Phase 4 is complete when:

1. Manual claim-execute-complete cycle works reliably
2. `just ralph` can process a batch of tickets sequentially
3. Completion guards catch missing output
4. Audit log provides clear execution history
5. All edge cases have defined, tested behavior

Only after these criteria are met should we consider multi-agent parallel execution.
