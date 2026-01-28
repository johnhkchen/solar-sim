---
id: S-003
title: Git Worktree Workflow
status: planning
priority: 2
complexity: M
depends_on: []
blocks: []
milestone: M5
assignee: null
created: 2026-01-27
updated: 2026-01-27
---

# S-003: Git Worktree Workflow

## Overview

Establish patterns and tooling for using Git worktrees to enable parallel agent development. Multiple Ralph loops can work concurrently in isolated environments without merge conflicts.

## Background

### What are Git Worktrees?

Git worktrees allow multiple working directories to share a single Git repository:

```
.git/                          # Shared Git data
├── solar-sim/                 # Main worktree (main branch)
├── solar-sim-alpha/           # Worktree for agent alpha (feature/alpha branch)
└── solar-sim-beta/            # Worktree for agent beta (feature/beta branch)
```

Each worktree:
- Has its own working directory and index
- Must be on a different branch
- Shares commits, branches, and history with other worktrees

### Why Worktrees for Multi-Agent?

Without worktrees, parallel agents would:
- Fight over the same working directory
- Create constant merge conflicts
- Interfere with each other's uncommitted changes

With worktrees:
- Each agent has isolated workspace
- Agents work on separate branches
- Merges happen deliberately, not accidentally

## Research Questions

### R1: Worktree Lifecycle

- [ ] Best practices for creating worktrees?
- [ ] Naming conventions (../solar-sim-{name})?
- [ ] How to handle worktree cleanup?
- [ ] What happens when branches are deleted?

### R2: Branch Strategy

- [ ] One branch per agent, or one branch per story?
- [ ] How to handle long-running worktrees vs ephemeral ones?
- [ ] Rebasing strategy onto main?
- [ ] When/how to merge back to main?

### R3: Shared Resources

- [ ] How to handle `node_modules/` across worktrees?
  - Symlink? Copy? Each has its own?
- [ ] What about `.env` files?
- [ ] Build artifacts and caches?

### R4: Coordination

- [ ] How do agents know what branch to use?
- [ ] Should `task-graph.yaml` track which agent/branch owns a task?
- [ ] How to prevent two worktrees from working on the same task?

### R5: Merging

- [ ] Manual merge by humans, or automated?
- [ ] How to handle merge conflicts?
- [ ] Should there be a "merge agent" role?
- [ ] PR-based workflow vs direct merge?

### R6: File Ownership

- [ ] Can we structure the codebase so different tasks touch different files?
- [ ] How to handle shared files (like `task-graph.yaml`)?
- [ ] Locking mechanisms for contested resources?

## Acceptance Criteria

- [ ] `just worktree-new <name>` creates a properly configured worktree
- [ ] `just worktree-list` shows active worktrees with status
- [ ] `just worktree-remove <name>` cleanly removes a worktree
- [ ] Clear documentation on worktree workflow
- [ ] Strategy for handling merge conflicts documented
- [ ] Integration with task claiming (no duplicate work)

## Implementation Plan

Based on the research findings in `docs/knowledge/research/git-worktrees.md`, this section describes exactly how the worktree commands will work and how agents should coordinate when working in parallel.

### The worktree-new Command

Running `just worktree-new <name>` creates a new worktree at `../solar-sim-<name>` with a branch named `feature/<name>`. The command wraps `git worktree add` and performs setup steps automatically so agents can start working immediately.

The command first validates that the name contains only alphanumeric characters, hyphens, and underscores to prevent path traversal issues. It then checks whether a worktree with that name already exists by examining `git worktree list` output and exits with an error if so. Next it creates the worktree using `git worktree add ../solar-sim-<name> -b feature/<name>`, which creates both the directory and the branch in a single operation. If the branch already exists, the command uses `-B` instead to reset it to the current HEAD, which is safe for ephemeral branches that have been merged.

After creating the worktree, the command runs `npm install` in the new worktree's `tools/` directory to ensure the DAG tooling dependencies are available. It then prints instructions telling the agent to `cd ../solar-sim-<name>` and run `just prompt` to get started.

The branch naming convention uses `feature/<name>` where `<name>` describes the work being done. For task-based work, use the task ID like `feature/S-003-I`. For agent-based work in longer sessions, use a descriptive name like `feature/alpha` or `feature/solar-calc`. Research spikes that might not merge should use `research/<topic>` instead, though this requires manually running `git worktree add` since the helper assumes feature branches.

### The worktree-list Command

Running `just worktree-list` shows all active worktrees with their branches and current status. The command parses output from `git worktree list --porcelain` to extract the path, branch name, and HEAD commit for each worktree. It marks the main worktree distinctly so agents know which one is authoritative for task-graph.yaml.

The output format shows one worktree per line with the path, branch in parentheses, and a marker for the main worktree. For example, running `just worktree-list` might show the main worktree at `/path/to/solar-sim` on the main branch marked as the main worktree, plus any linked worktrees at `/path/to/solar-sim-alpha` on `feature/alpha`.

The command also checks for worktrees that need attention by looking for prunable entries where the directory was deleted without using `git worktree remove`. It prints a warning if any prunable worktrees exist and suggests running `git worktree prune` to clean them up.

### The worktree-remove Command

Running `just worktree-remove <name>` removes the worktree at `../solar-sim-<name>` and cleans up associated metadata. The command handles several edge cases to prevent accidental data loss.

Before removing, the command checks whether the worktree has uncommitted changes by running `git -C ../solar-sim-<name> status --porcelain`. If there are uncommitted changes, it prints a warning listing the changed files and asks for confirmation before proceeding. The justfile can't do interactive prompts easily, so when uncommitted changes exist the command exits with an error and tells the user to either commit the changes, discard them with `git checkout .`, or run the removal with a `--force` flag.

After removing the worktree directory with `git worktree remove ../solar-sim-<name>`, the command checks whether the branch has been merged to main by running `git branch --merged main`. If the branch has been merged, it offers to delete the branch since it's no longer needed. If the branch has unmerged commits, it preserves the branch and prints a message explaining that the branch was kept because it contains unmerged work.

The `--force` flag allows removal even with uncommitted changes, which is useful for discarding failed experiments. Using force also deletes the branch regardless of merge status, so it should be used carefully.

### Cross-Worktree Coordination

The main worktree owns the authoritative copy of task-graph.yaml, and agents in other worktrees should not modify their local copies. This design avoids the complexity of cross-worktree locking while ensuring task status remains consistent.

When an agent in a linked worktree wants to pick up work, they should first fetch the latest main branch by running `git fetch origin main` to ensure they're seeing current task status. Then they read task-graph.yaml from main using `git show main:task-graph.yaml` to check which tasks are available. They pick an unclaimed task with status `ready`, do the implementation work, and include the task status update in their PR.

The PR merge serves as the serialization point for task claiming. If two agents happen to pick the same task, the second agent's PR will have a merge conflict on task-graph.yaml that makes the duplication visible. This is rare in practice because agents work on different tasks, and when it does happen the conflict resolution is straightforward since one agent simply picks a different task.

The `just prompt` command in a linked worktree should warn that it's not running from the main worktree and remind the agent to check task availability on main before starting. This prevents agents from accidentally working on tasks that have already been claimed by another worktree.

### Merge Workflow

When work is complete in a linked worktree, the agent pushes their branch to the remote with `git push -u origin feature/<name>` and creates a PR with `gh pr create`. The PR title should follow the pattern "Task-ID: Brief description" like "S-003-I: Implement worktree commands" to make it clear what work the PR contains.

The PR body should include a brief summary of what changed, a test plan explaining how to verify the changes work, and the task status update that marks the task complete. Using squash merge keeps main's history clean with one commit per task or small story.

After the PR is merged, the agent should clean up by running `just worktree-remove <name>` from the main worktree. The branch will be deleted automatically since it's been merged.

### CLAUDE.md Documentation Updates

The existing worktree section in CLAUDE.md needs updates to explain the coordination workflow. Add a note that the main worktree owns task-graph.yaml and that agents in linked worktrees should check task availability by reading from main rather than their local copy. Add the workflow for creating PRs and include an example of the full cycle from worktree creation through PR merge and cleanup.

### Implementation Tickets

This plan breaks down into three tickets. T-003-01 implements the `just worktree-new` command with branch creation and setup. T-003-02 implements `just worktree-list` and `just worktree-remove` with the safety checks. T-003-03 updates CLAUDE.md with the coordination workflow and adds a warning to `just prompt` when running outside the main worktree.

## Original Expected Components

This section preserved for reference. The implementation plan above supersedes these sketches.

### 1. Worktree Commands in Justfile

```bash
# Create worktree with proper branch setup
just worktree-new alpha
# → Creates ../solar-sim-alpha
# → Creates branch feature/alpha (or uses existing)
# → Copies necessary config files

# List with status
just worktree-list
# → Shows all worktrees and their branches
# → Indicates which have uncommitted changes

# Clean removal
just worktree-remove alpha
# → Removes worktree directory
# → Optionally deletes branch
```

### 2. Branch Naming Convention

```
feature/{agent-name}     # Long-running agent branches
feature/{story-id}       # Story-specific branches
research/{topic}         # Research spikes
```

### 3. Coordination via task-graph.yaml

Add optional `branch` field to tasks:

```yaml
nodes:
  - id: T-001
    branch: feature/alpha    # This task is being worked on in this branch
    status: in-progress
```

### 4. Merge Workflow

```bash
# When work is complete in a worktree
cd ../solar-sim-alpha
git push origin feature/alpha
# Create PR or notify for review

# Merge back to main (from main worktree)
cd ../solar-sim
git merge feature/alpha
# Or via PR
```

## Potential Issues

### Issue: node_modules Bloat

Each worktree having its own `node_modules` wastes disk space.

Options:
1. Use pnpm (content-addressable storage)
2. Symlink to shared node_modules (risky)
3. Accept the duplication (simplest)

### Issue: Conflicting Updates to task-graph.yaml

Multiple agents updating the DAG simultaneously.

Options:
1. Locking mechanism (complex)
2. Agent-specific status files that get merged
3. Single "coordinator" worktree owns the DAG
4. Frequent rebases to pick up changes

### Issue: Stale Worktrees

Worktrees that drift far from main become hard to merge.

Options:
1. Frequent rebasing onto main
2. Time-limited worktree lifetime
3. Automated staleness detection

## Dependencies

- **Depends on**: Nothing (can be researched independently)
- **Blocks**: Nothing directly, but enables parallel operation

## Research Output

Findings should be documented in:
`docs/knowledge/research/git-worktrees.md`

## Milestone

This story delivers **M5: Worktree Commands**.

| Command | Purpose |
|---------|---------|
| `just worktree-new <name>` | Create isolated worktree |
| `just worktree-list` | Show active worktrees |
| `just worktree-remove <name>` | Clean up worktree |

See `docs/active/MILESTONES.md` for full details.

M5 can be worked on in parallel with M1-M4 after the research phase, as it's independent of DAG parsing.

## Related

- S-001: Ralph Loop (each loop runs in a worktree)
- S-002: DAG Parsing (needs to coordinate across worktrees)
- `docs/active/MILESTONES.md` - Milestone definitions

## Changelog

| Date | Change |
|------|--------|
| 2026-01-27 | Story created |
