# Concurrent Ralph Orchestration

This document explores how to run multiple `just ralph` loops simultaneously using git worktrees, enabling parallel autonomous development.

## The Concurrency Model

The fundamental constraint is that each worktree has its own working directory but shares git history with the main repo. This means two agents can work simultaneously on different branches without stepping on each other's files, but they need coordination around shared state like task-graph.yaml.

The main worktree owns the authoritative task-graph.yaml. Linked worktrees should not modify their local copies directly because those changes would diverge from main. Instead, each worktree claims tasks by including the status update in the same commit as the implementation work. When the PR merges, that merge serializes the claim.

## Race Condition Handling

Two agents might try to claim the same task. This resolves naturally through git's merge conflict detection. When the second agent's PR tries to merge, it will conflict on task-graph.yaml because the first agent already changed that task's status. The second agent sees the conflict, picks a different task, and continues.

To minimize wasted work from races, agents should fetch main before claiming tasks. The `just prompt` command already warns when running from a linked worktree as a reminder to check availability.

## Worktree Setup for Concurrent Loops

Each concurrent ralph loop runs in its own worktree with a unique name. The naming convention uses descriptive identifiers like "alpha" and "beta" or feature-focused names like "solar-calc" and "location-ui". Each worktree gets its own feature branch following the pattern `feature/<worktree-name>`.

The setup sequence starts by creating the worktrees from the main repo. Run `just worktree-new alpha` followed by `just worktree-new beta` to create two parallel working directories at `../solar-sim-alpha` and `../solar-sim-beta`.

## Running Concurrent Loops

Once the worktrees exist, each loop runs independently. Open separate terminal sessions, cd into each worktree directory, and run `just ralph`. Each loop will fetch main, check task availability, claim an unclaimed task, and execute it.

The loops operate asynchronously. One might complete three tasks while the other finishes one complex task. This is fine because tasks are independent once claimed. The only synchronization point is when PRs merge.

## Task Assignment Strategy

For concurrent loops to avoid collisions, tasks should be partitioned by story or feature area. When setting up a new phase, create stories that represent independent work streams. Assign one story per worktree so the agents never compete for the same tasks.

Alternatively, use priority tiers. One loop works on priority-1 tasks while the other handles priority-2. The prompt tool already sorts by priority, so configuring the loops to filter by priority would prevent overlap.

## Monitoring and Recovery

Each loop writes to its own log directory, so `just ralph-logs` in each worktree shows that loop's activity. The heartbeat file at `.ralph/heartbeat` indicates whether the loop is still running.

If a loop crashes or hangs, the claimed task remains in-progress. Run `just task-reset <task-id>` from the main worktree to release it. Then restart the loop in its worktree.

## PR and Merge Workflow

When a loop completes a task, it should push the branch and create a PR. The PR includes both the implementation and the task status update. Reviews can happen asynchronously while the loop continues with the next task.

Merging should happen promptly to keep main's task-graph.yaml current. Stale task graphs lead to more merge conflicts and wasted work. If possible, configure auto-merge for low-risk PRs or have a human merge them in batches.

## Practical Limits

Two concurrent loops works well for this project's current size. Beyond three or four loops, coordination overhead increases and merge conflicts become more frequent. The task graph also needs enough ready tasks to keep all loops busy, otherwise loops sit idle waiting for dependencies.

For larger projects, consider sharding by subsystem where each subsystem has its own task graph. Alternatively, use a central task server that handles claiming atomically. That's beyond the scope of this project but worth noting for scale.

## Summary

Concurrent ralph loops work by isolating each loop in its own worktree, using git merge conflicts as the natural serialization mechanism for task claiming, and minimizing races through pre-flight checks on main. The approach requires no external coordination service because git itself provides the necessary atomicity.
