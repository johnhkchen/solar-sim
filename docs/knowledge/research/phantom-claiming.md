# Phantom Task Claiming: Root Cause Analysis

This document diagnoses the phantom task claiming behavior observed during S-005 and S-006 execution, where tasks were marked in-progress without any agent actually working on them.

## Executive Summary

The phantom claiming problem has a single root cause: the `just prompt` command combines task discovery with task claiming in one atomic operation. Every invocation of `just prompt` writes to task-graph.yaml, marking a task as in-progress with a `claimed_at` timestamp. There are no external automated triggers invoking this command; the problem is the command's design, not its invocation frequency.

## Investigation Results

### Checked: Git Hooks

The `.git/hooks/` directory contains only sample files (all ending in `.sample`), which Git ignores by default. No active hooks exist that could trigger `just prompt` on commit, push, or file changes. The `git config --local --list` shows no hook-related configuration.

### Checked: Claude Code Hooks

The `.claude/` directory does not exist in this repository. Claude Code's hook system (which allows running commands on file changes or tool calls) has not been configured. This rules out Claude Code as a trigger source.

### Checked: File Watchers

No file watcher configurations were found in the repository. There is no `watchman.json`, no `nodemon.json`, no `package.json` scripts with watch behavior affecting task management. The development server (`npm run dev`) only watches application source files, not the task-graph.yaml.

### Checked: Shell Integrations

No shell aliases, functions, or integrations were found that would invoke `just prompt` automatically. The justfile itself contains no recursive calls or automatic triggers.

### Checked: Ralph Loop Behavior

The ralph.sh script calls `just prompt` exactly once per iteration, and only when it intends to claim and execute a task. The loop handles errors gracefully and doesn't re-invoke on failure. There is no behavior that would cause multiple rapid claims.

## Root Cause Identified

The phantom claiming occurs because `just prompt` is **destructive by design**. Examining `tools/prompt.ts:235-275`:

```typescript
async function claimAndGeneratePrompt(): Promise<void> {
  // ... setup code ...

  const graph = loadTaskGraph();
  const task = selectNextTask(graph);

  // THIS IS THE PROBLEM:
  task.status = 'in-progress';
  task.claimed_at = new Date().toISOString();

  updateMetaCounts(graph);
  saveTaskGraph(graph);  // Writes to disk every time

  const prompt = generatePrompt(graph, task);
  console.log(prompt);
}
```

Every invocation of `just prompt` performs these actions:
1. Loads the task graph
2. Selects the next ready task
3. **Mutates the task status to in-progress**
4. **Writes the modified graph back to disk**
5. Outputs the prompt

There is no read-only mode. A user who runs `just prompt` to see what task is next has already claimed that task. If they then decide not to work on it, or if they were just previewing, the task remains claimed with no agent executing it.

## Reproduction Scenario

The phantom claiming can be reproduced trivially:

1. Ensure at least one task has `status: ready` in task-graph.yaml
2. Run `just prompt` to see the available task
3. Decide not to work on it and close the terminal
4. Check task-graph.yaml: the task is now `status: in-progress` with a `claimed_at` timestamp

This is the exact scenario that occurred during S-005/S-006 development. An agent or human ran `just prompt` multiple times (perhaps to check what was available, or after recovering from an error), and each invocation claimed a different task.

## Evidence from Git History

The commit `790dbbe` ("complete S-005 solar engine and partial S-006 location system") shows T-006-02 with:
```yaml
status: in-progress
claimed_at: "2026-01-28T01:55:22.630Z"
```

The subsequent commit `6f367f3` ("add S-007 workflow audit story") reset T-006-02 back to `status: ready`, indicating the claim was recognized as phantom (no work was done despite the claimed status).

The timestamps in the git history show multiple tasks being claimed within minutes of each other, faster than any agent could reasonably complete them. This pattern is consistent with rapid `just prompt` invocations rather than legitimate work claims.

## Prevention Strategies

### Strategy 1: Read-Only Prompt (Recommended)

Split the command into two operations:
- `just prompt` - Shows the next available task without claiming it
- `just prompt --accept` - Claims the task and outputs the execution prompt

This requires modifying prompt.ts to:
1. Add a `--accept` flag check via `process.argv`
2. Skip the status mutation when the flag is absent
3. Only write to disk when `--accept` is provided

Implementation complexity: Low (approximately 20 lines changed)

### Strategy 2: Idempotent Claiming

Make repeated claims of the same task a no-op:
- If the next ready task is already in-progress with a recent timestamp (< 1 hour), assume it's the same session and don't update the timestamp
- If the task has a different claimed_by value, treat it as unavailable

This is more complex and doesn't fully solve the problem (first claim still happens accidentally).

Implementation complexity: Medium

### Strategy 3: Explicit Claim Command

Create a separate `just task-claim <id>` command, leaving `just prompt` as purely informational. This requires callers to explicitly name the task they want to claim.

This is the safest approach but changes the workflow more significantly.

Implementation complexity: Low

## Recommended Fix

Implement Strategy 1 (read-only prompt with --accept flag) as it:
- Directly addresses the root cause
- Requires minimal code changes
- Preserves the existing workflow when `--accept` is used
- Makes the destructive operation explicit

The ralph.sh script should be updated to call `just prompt --accept` instead of `just prompt` to maintain automated behavior.

## Resilience Improvements

Beyond the primary fix, these additional guards would prevent phantom claiming from causing harm:

1. **Stale claim detection**: The existing `getStaleTasks` function in dag.ts detects tasks in-progress for over 2 hours. This could be integrated into `just prompt` to automatically reset stale claims before selecting the next task.

2. **Worktree validation**: Before claiming, verify the execution context is appropriate (not main worktree, story filter matches if set).

3. **Current task tracking**: Store the claimed task ID in `.ralph/current-task` and refuse to claim a new task until the current one is completed or explicitly abandoned.

## Conclusion

The phantom task claiming is not caused by external triggers or automation. It is caused by the fundamental design of `just prompt`, which treats every invocation as a claim request. The fix is straightforward: make `just prompt` read-only by default, requiring an explicit `--accept` flag for the destructive operation. This change prevents accidental claims while preserving the automated workflow when the flag is provided.

---

## Implementation Status (Updated 2026-01-28)

All recommended fixes have been implemented in S-007:

### Read-Only Prompt (T-007-03) ✓

The `just prompt` command is now read-only by default. It shows a preview of the next available task without claiming it:

```
┌─────────────────────────────────────────────────────────────────┐
│  NEXT AVAILABLE TASK (preview only - not claimed)              │
└─────────────────────────────────────────────────────────────────┘

  Task:     T-008-01
  Title:    Audit current multi-agent state
  ...

  To claim this task and get the full prompt:
    just prompt --accept

  Or claim a specific task by ID:
    just prompt T-008-01
```

The `--accept` flag or a specific task ID is required to actually claim a task.

### Double-Claim Prevention ✓

Attempting to claim an already-claimed task now returns exit code 2 with a clear error:

```
Error: Cannot claim task 'T-008-01'.
Reason: Task is already claimed at 2026-01-28T16:46:28.542Z
```

### Current Task Tracking ✓

The `.ralph/current-task` file tracks which task is currently claimed. The single-task guard prevents claiming a new task while one is already in progress.

### Audit Logging (T-007-05) ✓

All task state transitions are now logged to `logs/task-audit.jsonl`, including claims, completions, resets, and blocked attempts. This provides forensic visibility into phantom claiming if it ever recurs.

### Worktree Guards ✓

The prompt.ts now includes guards that prevent claiming from the main repo and validate story filter alignment.

### Ralph Loop Updated ✓

The ralph.sh script now uses `just prompt --accept` instead of `just prompt`, ensuring automated loops explicitly claim tasks.
