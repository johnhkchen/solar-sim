# Running Concurrent Ralph Loops

This playbook explains how to set up and run multiple autonomous ralph loops in parallel using git worktrees.

## Prerequisites

Before starting concurrent loops, the main repo must have:
1. All current work committed (clean `git status`)
2. Tasks partitioned into independent stories with non-overlapping file ownership
3. Both stories' research tasks in ready status

For Solar-Sim phase 2, stories S-005 (solar engine) and S-006 (location system) are already partitioned. S-005 touches `src/lib/solar/` while S-006 touches `src/lib/geo/` and `src/lib/components/`.

## Setup Procedure

### Step 1: Commit Everything to Main

From the main repo, ensure all changes are committed:

```bash
git status
# Should show "nothing to commit, working tree clean"
# If not, commit or stash changes before proceeding
```

### Step 2: Create Worktrees

Create one worktree per story from the main repo:

```bash
just worktree-new solar
just worktree-new location
```

This creates:
- `../solar-sim-solar` on branch `feature/solar`
- `../solar-sim-location` on branch `feature/location`

The command automatically installs project and tools dependencies.

### Step 3: Verify Worktrees

Check that each worktree can run the tooling:

```bash
cd ../solar-sim-solar
just dag-status
# Should show task graph with ready tasks

cd ../solar-sim-location
just dag-status
# Should show the same task graph
```

If `just dag-status` fails with module errors, install dependencies manually:

```bash
npm install
cd tools && npm install && cd ..
```

### Step 4: Sync Worktrees (If Needed)

If you made commits to main after creating the worktrees, sync them:

```bash
cd ../solar-sim-solar
git rebase main

cd ../solar-sim-location
git rebase main
```

### Step 5: Verify Task Availability

Both worktrees should see the same ready tasks:

```bash
cd ../solar-sim-solar && just dag-status
cd ../solar-sim-location && just dag-status
```

Both should show S-005-R and S-006-R as ready.

## Running the Loops

Open two terminal windows or tmux panes. Each loop must specify which story it handles using the `ralph-story` command. This prevents both loops from claiming the same task.

**Terminal 1 (solar engine):**
```bash
cd /path/to/solar-sim-solar
just ralph-story S-005
```

**Terminal 2 (location system):**
```bash
cd /path/to/solar-sim-location
just ralph-story S-006
```

The `ralph-story` command sets the `WORKTREE_STORY` environment variable, which filters tasks so each loop only sees tasks belonging to its assigned story. Without this filter, both loops would race to claim the same highest-priority task, causing duplicate work.

Alternatively, set the environment variable directly:
```bash
WORKTREE_STORY=S-005 just ralph
```

## Monitoring

### Check Loop Status

From each worktree:
```bash
just ralph-status
```

### Tail Logs

From each worktree:
```bash
just ralph-logs
```

### Check Task Progress

From any worktree:
```bash
just dag-status
```

Note that each worktree's task-graph.yaml may differ as tasks are claimed and completed. The authoritative state is in main after PRs merge.

## Handling Problems

### Loop Crashes

If a loop crashes, the claimed task stays in-progress. Reset it:

```bash
cd ../solar-sim-solar   # whichever worktree crashed
just task-reset S-005-R  # the stuck task
just ralph               # restart the loop
```

### Dependency Errors

If you see "Cannot find package" errors:

```bash
npm install
cd tools && npm install && cd ..
```

### Worktree Out of Sync

If a worktree diverged from main:

```bash
git fetch origin main
git rebase main
# Resolve any conflicts, then continue
```

## After Completion

When each loop finishes its story:

### Push and Create PR

From each worktree:
```bash
git push -u origin feature/solar  # or feature/location
gh pr create --title "S-005: Solar calculation engine" --body "Implements sun position and sun hours calculations."
```

### Merge PRs

After review, merge both PRs to main. The merges bring the implementation code and task status updates into main.

### Clean Up Worktrees

From the main repo:
```bash
just worktree-remove solar
just worktree-remove location
```

## Troubleshooting Checklist

If things aren't working:

1. **Is main clean?** Run `git status` in main
2. **Are dependencies installed?** Run `npm install` and `cd tools && npm install`
3. **Is the worktree synced?** Run `git rebase main` in the worktree
4. **Are tasks ready?** Run `just dag-status` to see available tasks
5. **Is another task stuck?** Run `just task-reset <task-id>` if needed

## Quick Reference

```bash
# Setup
just worktree-new solar
just worktree-new location

# Run (in separate terminals) - IMPORTANT: use ralph-story to filter by story
cd ../solar-sim-solar && just ralph-story S-005
cd ../solar-sim-location && just ralph-story S-006

# Monitor
just ralph-status
just ralph-logs
just dag-status

# After completion
git push -u origin feature/<name>
gh pr create

# Cleanup (from main)
just worktree-remove solar
just worktree-remove location
```
