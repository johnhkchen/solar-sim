# Concurrent Ralph Orchestration

This document explores how to run multiple `just ralph` loops simultaneously using git worktrees, enabling parallel autonomous development.

## The Concurrency Model

Each worktree has its own working directory but shares git history with the main repo. Two agents can work simultaneously on different branches without stepping on each other's files, but they need coordination around shared state like task-graph.yaml.

The main worktree owns the authoritative task-graph.yaml. Linked worktrees read from their local copy, which stays in sync when they rebase onto main. Task claiming happens locally during `just prompt`, and the status update commits with the implementation work. When the PR merges, that merge serializes the claim.

## Worktree Setup Procedure

Setting up worktrees for concurrent loops requires several steps to ensure both worktrees have the full project state and dependencies.

First, ensure main has all current work committed. Any uncommitted changes in main won't appear in the worktrees. Run `git status` to verify a clean working tree before creating worktrees.

Second, create the worktrees using `just worktree-new <name>`. This command creates the worktree directory, creates a feature branch, and installs both project and tools dependencies. The worktrees appear at `../solar-sim-<name>`.

Third, verify each worktree can run the tooling. Change into each worktree directory and run `just dag-status` to confirm the DAG is readable and dependencies are installed. If the command fails with a module not found error, run `npm install` in the worktree root and `npm install` in the `tools/` subdirectory.

Fourth, if the worktrees were created before the latest commits on main, sync them by running `git rebase main` from within each worktree. This brings in any commits that happened after worktree creation.

## Race Condition Handling

Two agents might try to claim the same task. This resolves naturally through git's merge conflict detection. When the second agent's PR tries to merge, it will conflict on task-graph.yaml because the first agent already changed that task's status. The second agent sees the conflict, picks a different task, and continues.

To minimize wasted work from races, agents should partition work by story. Each worktree handles one story's R-P-I chain exclusively. Since the stories touch different files, the agents never compete for the same tasks or modify the same code.

## Task Assignment Strategy

The recommended approach assigns one story per worktree. When planning a new phase, create stories that represent independent work streams with non-overlapping file ownership.

For Solar-Sim phase 2, the partitioning is:
- `solar-sim-solar` handles S-005 (solar engine) which touches `src/lib/solar/` and `docs/knowledge/research/solar-algorithms.md`
- `solar-sim-location` handles S-006 (location system) which touches `src/lib/geo/`, `src/lib/components/`, and `docs/knowledge/research/location-geocoding.md`

The stories share no files, so both loops can run their full R-P-I chains without coordination beyond the final PR merge.

## Running Concurrent Loops

Once worktrees are set up and synced, run each loop in a separate terminal with its story filter. The `WORKTREE_STORY` environment variable tells the prompt tool to only consider tasks belonging to a specific story. This prevents the race condition where both loops claim the same highest-priority task.

```bash
# Terminal 1
cd ../solar-sim-solar
just ralph-story S-005

# Terminal 2
cd ../solar-sim-location
just ralph-story S-006
```

The `ralph-story` command wraps `just ralph` with the appropriate `WORKTREE_STORY` environment variable. Without this filter, both loops would see all ready tasks and race to claim the same one, causing duplicate work.

The loops operate asynchronously. One might complete its research quickly while the other takes longer. Each loop works through its own dependency chain independently.

## Monitoring and Recovery

Each loop writes to its own `.ralph/` directory within its worktree. Run `just ralph-logs` to tail the logs, or `just ralph-status` to check the heartbeat.

If a loop crashes or hangs, the claimed task remains in-progress in that worktree's task-graph.yaml. To recover, either run `just task-reset <task-id>` from that worktree, or manually edit task-graph.yaml to set the status back to ready.

## PR and Merge Workflow

When a loop completes its story's implementation task, push the branch and create a PR. The PR includes all commits from the R-P-I chain plus the task status updates.

After PR review and merge, the main branch has both the new code and the updated task-graph.yaml showing those tasks as complete. Remove the worktree with `just worktree-remove <name>` from the main repo.

## Practical Limits

Two concurrent loops works well for projects with two independent work streams. Beyond three or four loops, coordination overhead increases. The key constraint is having enough independent stories with non-overlapping file ownership.

## Summary

Concurrent ralph loops work by isolating each loop in its own worktree with its own story assignment. Setup requires creating worktrees, syncing to main, and verifying dependencies. The story-based partitioning prevents conflicts since each loop touches different files. PRs merge the completed work back to main where task-graph.yaml serves as the single source of truth.

---

## Updates from S-007 (2026-01-28)

Several aspects of this document have been updated or superseded by S-007 workflow improvements:

### Story Filter is Now Required

The ralph.sh script now **requires** the WORKTREE_STORY environment variable. Running `just ralph` without a story filter produces an error:

```
Error: WORKTREE_STORY environment variable is required.
```

This mandatory filter prevents the race condition scenario where loops claim tasks from any story.

### Main Repo Execution Blocked

Running `just ralph` from the main worktree now fails with:

```
Error: Cannot run ralph loop from main repo.
Use a worktree: `just worktree-new <name>`
```

This ensures loops always run in isolated environments.

### Read-Only Task Preview

The `just prompt` command is now read-only by default. It shows available tasks without claiming them. To claim a task, use:

```bash
just prompt --accept        # Claim next available task
just prompt <task-id>       # Claim specific task
```

The ralph.sh script has been updated to use `just prompt --accept`.

### Known Issues (from S-008 Audit)

The concurrent model still has gaps being addressed in S-008:

1. **Stale Tooling**: Existing worktrees may have outdated ralph.sh without the story filter requirement. Rebase onto main before running loops.

2. **State Divergence**: Worktrees don't automatically sync task-graph.yaml from main. Agents should fetch and check main before claiming tasks.

3. **Cross-Story Claiming**: The story filter applies to auto-selection but can be bypassed by specifying a task ID directly.

4. **No Concurrent Test**: The multi-agent system has not been tested with simultaneous loops. S-008-04 will create a test procedure.

See `docs/knowledge/research/multi-agent-audit.md` for the full audit findings.
