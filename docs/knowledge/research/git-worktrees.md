# Git Worktree Research

> **Task**: S-003-R - Research Git worktree workflow
> **Status**: Complete
> **Date**: 2026-01-27

This document captures findings from researching Git worktrees for parallel agent development in Solar-Sim.

---

## Executive Summary

Git worktrees provide an elegant solution for parallel agent development because they let multiple agents work in separate directories while sharing a single Git repository. Each worktree maintains its own branch, index, and working files, which means agents can commit independently without stepping on each other. The main challenge is coordinating access to shared files like task-graph.yaml, which our existing file locking solves within a single worktree but not across multiple worktrees with their own file copies.

Our recommended approach uses ephemeral worktrees where each agent creates a fresh worktree for each task or small batch of related tasks, merges to main via pull request, and then removes the worktree. This keeps branches short-lived, minimizes merge conflicts, and makes coordination simple because the main worktree owns the authoritative task-graph.yaml.

---

## Worktree Lifecycle

Creating a worktree is straightforward since Git handles all the plumbing automatically. When you run `git worktree add ../solar-sim-alpha -b feature/alpha`, Git creates a new directory at that path, sets up a `.git` file that points back to the main repository's `.git/worktrees/solar-sim-alpha` metadata, and checks out the new branch. The worktree appears as a fully functional repository with its own HEAD, index, and working tree, but it shares commits, branches, and refs with the main repository.

Removing a worktree with `git worktree remove ../solar-sim-alpha` cleans up the directory and the metadata in `.git/worktrees`, but it leaves the branch intact. This is important because the branch might have unmerged commits that you want to preserve. If you're certain you want to delete the branch too, you need to do that separately with `git branch -d feature/alpha`, or use `-D` if the branch has unmerged work.

Git enforces a constraint that no branch can be checked out in multiple worktrees simultaneously. If you try to checkout `feature/alpha` while another worktree has it checked out, Git will refuse with a clear error message. This prevents the confusing situation where two working directories would share the same branch state.

If a worktree directory gets deleted without using `git worktree remove`, the metadata in `.git/worktrees` becomes stale. Running `git worktree prune` cleans this up, or you can wait for Git's automatic garbage collection to handle it eventually. The `git worktree list` command shows all worktrees including any that are marked as prunable.

---

## Branch Strategy

The choice between persistent agent branches and ephemeral task branches affects how much coordination work you need to do and how complex your merges become.

Persistent branches like `feature/alpha` and `feature/beta` that stay around for a long time will inevitably drift from main, which means more merge conflicts when you finally bring the work back together. They also create cognitive overhead because you have to track which agent is working on what and ensure branches don't get stale.

Ephemeral branches created fresh for each task or small story keep work isolated and short-lived. An agent starts a worktree with a branch like `feature/S-003-worktrees`, completes the work, merges to main via PR, and removes the worktree. The branch can be deleted after merge since its commits now live on main. This approach mirrors how feature branches work in typical Git workflows.

Our recommendation is ephemeral branches named after the task or story being implemented. Use `feature/S-003-worktrees` for a story implementation or `feature/S-003-R-research` for a specific task. This naming convention makes it clear what work the branch contains and allows multiple agents to work in parallel on different tasks without branch conflicts.

For research spikes that might not merge, use the `research/*` prefix as documented in CLAUDE.md. These branches can be kept around longer for reference even after removing the worktree.

---

## Shared Resources

Each worktree has its own complete working directory, which means files that live in the repository get duplicated across worktrees. This is usually fine for source code since it's what you want, but it creates some challenges for dependencies and generated artifacts.

The `node_modules` directory poses the most significant concern since duplicating it across worktrees wastes disk space and requires running `npm install` in each worktree. We have three options to consider.

The simplest option is accepting the duplication and running `npm install` in each worktree. This is what we recommend initially because it keeps worktrees truly independent and avoids subtle bugs from sharing mutable state. Modern machines have plenty of disk space, and install time is usually dominated by network latency which can be mitigated by npm's cache.

Using pnpm instead of npm would give us content-addressable storage where multiple projects share the same physical package files. We have pnpm 10.12.3 available on the system. Switching to pnpm is worth considering when we initialize SvelteKit in S-004, but it's not required for the current tools directory which has minimal dependencies.

Symlinking node_modules across worktrees is tempting but risky. If one worktree updates a dependency, all worktrees see the change immediately, which could break in-progress work. We don't recommend this approach.

The `tools/` directory already has its own small `package.json` with just `js-yaml` and `proper-lockfile`. Each worktree will get its own copy of `tools/node_modules`, but since it's small this isn't a problem. Run `npm install` in the `tools/` directory of each new worktree as part of setup.

Environment files like `.env` aren't committed to Git, so each worktree needs its own copy. Document this in the worktree setup instructions and consider creating a `just worktree-new` command that copies essential config files.

Build artifacts and caches should be gitignored and regenerated in each worktree. This is the cleanest approach since it avoids any cross-contamination.

---

## Coordination Across Worktrees

The task-graph.yaml file is the critical coordination point because it tracks which tasks are available, in-progress, or complete. Multiple agents need to claim tasks without duplicating work, and they need to mark tasks complete so other agents can pick up dependent work.

Our existing file locking in `prompt.ts` uses `proper-lockfile` to acquire an exclusive lock before reading and modifying task-graph.yaml. This works within a single worktree because the lock file gets created at `task-graph.yaml.lock` in the same directory. However, when multiple worktrees exist, each has its own copy of task-graph.yaml in its own working directory, so locking one doesn't prevent another worktree from accessing its copy.

This means the file locking protects against races within a worktree but not across worktrees. We need a different strategy for cross-worktree coordination.

The simplest solution is designating the main worktree as the authoritative source for task-graph.yaml. Agents in other worktrees fetch updates from main before starting work, do their implementation, and don't modify task-graph.yaml in their worktree at all. When they finish, they create a PR to main that includes the task status update. The merge to main is the serialization point that prevents conflicts.

This approach requires a workflow change where agents don't claim tasks by writing to their local task-graph.yaml. Instead, they check the current task-graph.yaml on main (either by fetching or reading from the main worktree), pick an unclaimed ready task, do the work, and submit a PR that marks the task complete. If two agents happen to pick the same task, the second PR will have a merge conflict on task-graph.yaml that makes the duplication visible.

An alternative is implementing a more sophisticated locking mechanism that works across worktrees, such as using a lock file in the shared `.git` directory or an external coordination service. This adds complexity and we don't think it's necessary given our small scale of parallel agents.

For now, we recommend the main-worktree-as-authority approach with PR-based merging. It's simple, uses standard Git workflows, and makes conflicts visible through normal merge conflict resolution.

---

## Merging Completed Work

The merge workflow determines how work gets from agent branches back to main. We have two main options to consider.

Pull request based merging means agents push their branch to the remote and create a PR via `gh pr create`. The PR can be reviewed by a human or another agent, and merged through GitHub's interface or `gh pr merge`. This approach provides visibility into what's being merged, allows for CI checks, and creates a clear audit trail.

Direct merging means agents merge their own work to main locally and push. This is faster but provides less oversight. Since we're building autonomous agent infrastructure, some level of review is valuable even if it's automated.

Our recommendation is PR-based merging as the default workflow because it integrates with GitHub's collaboration features and makes it easy to add CI checks later. Agents should be able to create PRs using `gh pr create` and can use `gh pr merge` to merge their own work if no human review is required.

For the merge strategy itself, we recommend squash merging for most feature work since it keeps main's history clean with one commit per task. Regular merge commits are fine for larger stories that have meaningful intermediate commits worth preserving. Rebase should be avoided for merged branches to prevent rewriting shared history.

When merge conflicts occur, the agent should resolve them by rebasing onto the latest main and updating the conflicting files. For conflicts in task-graph.yaml specifically, the resolution is usually straightforward since it means combining status updates from different tasks. If the conflict indicates duplicate work on the same task, human intervention may be needed to sort out which implementation to keep.

---

## Implementation Recommendations

Based on this research, here are our recommendations for the planning and implementation phases.

For the `just worktree-new <name>` command, create a worktree at `../solar-sim-<name>` with branch `feature/<name>`. Copy any necessary config files that aren't in Git. Run `npm install` in the tools directory. Print instructions for how to use the worktree.

For the `just worktree-list` command, run `git worktree list` and parse the output to show branch names and check for any prunable or locked worktrees. This is mostly a convenience wrapper.

For the `just worktree-remove <name>` command, run `git worktree remove` and offer to delete the branch if it has been merged. Warn if there are uncommitted changes.

For cross-worktree task coordination, adopt the convention that agents read task-graph.yaml from main to check availability, but don't modify it in their worktree. The task status update happens as part of the PR merge. Consider adding a `just task-claim <id>` command that creates a marker file or updates a coordination file in the shared `.git` directory to provide a soft lock.

For the merge workflow, use PR-based merging with squash by default. Document the expected flow in CLAUDE.md and create a `just pr-create` helper if warranted.

---

## Open Questions for Planning Phase

Several questions should be addressed during the planning phase for S-003-P.

First, should we implement soft locking for task claiming? A simple approach would write a `<task-id>.claimed` file in `.git/worktrees/` or a dedicated coordination directory. This prevents duplicate work without requiring changes to task-graph.yaml.

Second, should worktree setup run `npm install` automatically or prompt the user? Automatic is convenient but adds time to worktree creation. A post-creation message telling users to run setup commands might be simpler.

Third, how should we handle the chicken-and-egg problem where tools need to work before SvelteKit is initialized? The current approach of having `tools/package.json` separate from the main project works well and should probably stay that way.

Fourth, should we add worktree metadata tracking to task-graph.yaml? Adding a `worktrees` section that lists active worktrees and their assigned tasks would provide visibility, but it also adds another file to keep in sync. The PR-based workflow makes this less necessary since the branch name in the PR provides the same information.

---

## References

The Git documentation for worktrees at `git worktree --help` was the primary source for understanding worktree behavior. Testing with actual worktree creation and removal confirmed the documented behavior around branch persistence and the `.git` file structure in linked worktrees.

The existing `tools/prompt.ts` implementation showed how `proper-lockfile` is used for task claiming, which informed the analysis of cross-worktree coordination challenges.

The writing style requirements in `docs/knowledge/requirements/writing-style.md` guided the structure of this document.
