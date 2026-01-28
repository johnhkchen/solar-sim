# Running Concurrent Ralph Loops

This playbook explains how to set up and run multiple autonomous ralph loops in parallel using git worktrees.

## Prerequisites

Before starting concurrent loops, ensure the main repo has tasks ready for multiple workers. Each loop needs its own stream of work to avoid conflicts. Partition tasks by story or feature area so agents don't compete for the same items.

## Quick Start

From the main repo, create two worktrees by running `just worktree-new alpha` followed by `just worktree-new beta`. This creates directories at `../solar-sim-alpha` and `../solar-sim-beta`, each on their own feature branch.

Open two terminal windows or tmux panes. In the first, cd into `../solar-sim-alpha` and run `just ralph`. In the second, cd into `../solar-sim-beta` and run `just ralph`. Both loops now run independently, claiming and completing tasks from the shared DAG.

## Task Partitioning Strategies

The simplest approach assigns one story per worktree. When planning a new phase, create stories that represent independent work streams. Alpha handles S-005 while beta handles S-006. Since each story has its own tasks, the loops never collide.

An alternative uses priority tiers. Configure alpha to work on P1 tasks and beta on P2 tasks. The prompt tool sorts by priority, so you could modify it to filter by priority range per worktree. This requires a small code change but allows finer-grained control.

For very parallel phases, use a hybrid approach where stories are independent but tickets within a story can be worked in parallel by different loops. This works when tickets don't share files.

## Monitoring Both Loops

Each worktree has its own `.ralph/` directory with logs and heartbeat. To monitor both loops from the main repo, open a split terminal and tail both log directories:

```bash
tail -f ../solar-sim-alpha/.ralph/log/*.log &
tail -f ../solar-sim-beta/.ralph/log/*.log
```

The heartbeat files show when each loop last claimed a task. If a heartbeat goes stale for more than a few minutes, the loop may have crashed.

## Handling Merge Conflicts

When both loops try to update task-graph.yaml, the second PR to merge will conflict. This is expected and handled naturally. The agent that hit the conflict should run `git fetch origin main && git rebase origin/main` to get the latest graph, check that their task wasn't already claimed by the other agent, and push again.

To minimize conflicts, merge PRs promptly. Stale branches diverge further and create larger conflicts. If you're manually orchestrating, merge PRs in small batches rather than letting them queue up.

## Recovery Procedures

If a loop crashes, its claimed task remains in-progress. From the main repo, run `just task-reset <task-id>` to release it. The task returns to ready status and whichever loop picks it up next can continue the work.

To restart a crashed loop, cd into its worktree and run `just ralph` again. The loop will fetch main, check for available tasks, and resume operation.

If both loops stop responding, check for system-level issues like disk space or network problems. The logs in `.ralph/log/` often reveal what went wrong.

## Scaling Beyond Two Loops

Two concurrent loops works well for small to medium projects. Adding a third loop increases coordination overhead and merge conflict frequency. Only add more loops if you have enough independent work streams to keep them all busy.

For larger projects, consider running loops on different machines with a shared git remote. The same worktree workflow applies, just with network latency added to push/pull operations.

## Shutting Down

To gracefully stop a loop, press Ctrl+C in its terminal. The loop will finish its current task before exiting. If you need to stop immediately, Ctrl+C twice will force quit.

After stopping, run `just ralph-status` in each worktree to verify the loops have stopped. Check for any in-progress tasks with `just dag-status` from main and reset them if needed.

## Cleanup

When a phase is complete, remove the worktrees by running `just worktree-remove alpha` and `just worktree-remove beta` from the main repo. This deletes the worktree directories and cleans up the git worktree references. The feature branches remain if they have unmerged work, or get deleted if already merged.
