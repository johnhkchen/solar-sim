---
id: S-009
title: Concurrent Agent Safety
status: pending
priority: 0
milestone: null
---

# S-009: Concurrent Agent Safety

This story fixes the critical bug that prevents safe concurrent execution of multiple ralph loops. It has priority 0 because nothing else can proceed reliably until this is fixed.

## Problem Statement

The concurrent execution test (archived as T-008-04) revealed that double-claim prevention fails. When two agents run in separate worktrees, each has an independent copy of task-graph.yaml. If both check for available tasks at the same time, both see the same task as available, and both can claim it. The file lock only prevents concurrent writes to the same file — it doesn't help when the files are in different directories.

The documented workaround is manual: agents should run `git fetch origin main` and check `git show origin/main:task-graph.yaml` before claiming. But nothing enforces this, and agents don't do it automatically.

## Solution

Implement pre-claim state verification in the prompt.ts claim flow. Before allowing `--accept` to claim a task, the tooling will fetch origin/main and compare the task's status. If the task is already in-progress or complete on main, the claim is blocked with a clear error message.

This doesn't guarantee perfect consistency (there's still a race window between fetch and claim), but it catches the common case where one agent has already claimed and pushed while another is about to claim the same task.

## Acceptance Criteria

Two ralph loops can run simultaneously in separate worktrees on the same machine, working on different stories, without claiming the same task. When one agent claims a task and pushes to origin, the other agent's subsequent claim attempt for that task fails with a clear "already claimed on main" message.

## Tickets

T-009-01 covers the pre-claim verification implementation.
