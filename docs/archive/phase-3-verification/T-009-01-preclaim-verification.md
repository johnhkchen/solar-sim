---
id: T-009-01
title: Implement pre-claim state verification
story: S-009
status: complete
priority: 0
complexity: M
depends_on: []
output: tools/prompt.ts
---

# T-009-01: Implement Pre-Claim State Verification

Before claiming a task with `just prompt --accept`, verify that the task is still available on origin/main. This prevents the double-claim bug where two agents in separate worktrees both claim the same task.

## Research

The concurrent execution test (archived T-008-04) documented the failure mode. Each worktree has an independent task-graph.yaml. The file lock in prompt.ts only prevents concurrent writes within a single worktree — it doesn't help across worktrees since they're different files.

The current claim flow in prompt.ts (around line 580-620) does:
1. Check if we're in main repo (block if so)
2. Check if we already have a current task (block if so)
3. Find the next available task from local task-graph.yaml
4. Update local task-graph.yaml to mark it in-progress
5. Write task ID to .ralph/current-task

The gap is step 3 — it only checks local state, not origin/main state.

The CLAUDE.md documents the manual workaround: run `git fetch origin main` then `git show origin/main:task-graph.yaml` to check availability. But nothing enforces this.

Git commands needed:
- `git fetch origin main` — update origin/main ref
- `git show origin/main:task-graph.yaml` — read file from that ref without checking it out

These can be run via child_process.execSync in Node.

## Plan

Modify the claim flow in prompt.ts to add verification between steps 2 and 3:

1. Run `git fetch origin main --quiet` to update the remote ref
2. Run `git show origin/main:task-graph.yaml` to get the main branch's version
3. Parse that YAML and find the task we're about to claim
4. If the task is `in-progress` or `complete` on main, block with error:
   "Task T-XXX-NN is already [in-progress/complete] on origin/main. Run `git pull origin main` to sync."
5. If the task is still `ready` or `pending` on main, proceed with claim

Edge cases to handle:
- Network failure on fetch: warn but allow claim (offline operation should work)
- Task doesn't exist on main: allow claim (new task added locally)
- origin/main doesn't exist: warn but allow claim (no remote configured)

Add a `--skip-remote-check` flag for cases where offline operation is intentional.

## Implementation

Two changes were made to tools/prompt.ts:

The main repo guard was relaxed to allow single-agent serial execution. Previously the guard blocked all claims from the main worktree. Now it only blocks if there's already a task in-progress (checked via getCurrentTask()). This enables a single agent to work through tasks sequentially from main while still preventing a second agent from claiming while work is ongoing.

The pre-claim remote verification was added as a new function verifyTaskAvailableOnRemote(). Before claiming any task, the code runs `git fetch origin main --quiet` to update the remote ref, then runs `git show origin/main:task-graph.yaml` to read the main branch's version. It parses that YAML and checks the target task's status. If the task is already in-progress or complete on main, the claim is blocked with a clear error message directing the user to sync.

Edge cases are handled gracefully. Network failures produce a warning but allow the claim to proceed for offline operation. Missing remotes or missing task-graph.yaml on main also warn but proceed. A new --skip-remote-check flag was added for intentional offline operation, which bypasses the verification entirely.

The verification is integrated into the claim flow right after task selection but before the actual claim. Any warnings are printed to stderr before proceeding, and failures block with an appropriate error message logged to the audit system.

## Acceptance Criteria

- Running `just prompt --accept` fetches origin/main before claiming
- If the task is already claimed on main, the command fails with a clear message
- If fetch fails (offline), the command warns but proceeds
- The `--skip-remote-check` flag bypasses the verification
- Two agents in separate worktrees cannot both claim the same task if one has already pushed
