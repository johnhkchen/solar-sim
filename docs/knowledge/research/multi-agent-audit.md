# Multi-Agent Worktree Audit

This document catalogs the findings from T-008-01's audit of the current multi-agent worktree system. It identifies what's broken, categorizes issues by severity, and recommends fixes for each.

## Executive Summary

The multi-agent concurrent execution model has several critical gaps that prevent confident parallel execution across worktrees. While S-007 added guards against phantom claiming and implemented completion verification, the fundamental synchronization problem remains unsolved: worktrees operate on divergent state with no mechanism to stay current.

The core finding is that worktrees contain stale code and stale data. Existing worktrees have outdated versions of the tooling (ralph.sh lacks the story filter requirement) and outdated task-graph.yaml (missing S-007 and S-008 tasks entirely). Agents in these worktrees would operate with different rules and different task availability than intended.

## DAG Structure Audit

### Orphan Nodes Analysis

The task-graph.yaml contains 29 task nodes. Of these, 17 have the `S-NNN-X` pattern (story-level tasks like S-001-R, S-005-P) and 12 have the `T-NNN-NN` pattern (tickets). The ticket files in `docs/active/tickets/` number 13, including T-005-01 through T-005-04, T-007-01 through T-007-05, and T-008-01 through T-008-04.

The orphan nodes (those without ticket files) are all story-level tasks following the Research-Plan-Implement pattern. This is by design since the dag.ts refresh command explicitly preserves nodes with `S-` prefixes because they follow a predictable pattern from stories rather than requiring individual ticket files. The `cmdRefresh` function at dag.ts:599 implements this preservation logic.

One discrepancy exists: the task-graph.yaml meta section references milestone tasks that don't exist in the nodes section. The `by_milestone` mapping includes T-001-01 through T-001-03, T-003-01 through T-003-03, and T-006-01 through T-006-04. These appear to be artifact references from earlier iterations that were never cleaned up. They don't affect DAG operation since they're only in the meta summary, but they create confusion about what tasks actually exist.

The edges section correctly represents dependencies. Edges between story-level tasks follow the R→P→I chain (like S-005-R→S-005-P→S-005-I). Edges between tickets come from their frontmatter `depends_on` fields. The separation of edge sources works correctly, with story-level edges preserved during refresh and ticket edges regenerated from frontmatter.

**Severity: Low.** The orphan story-level nodes are intentional. The stale meta references are cosmetic.

**Recommendation:** Clean up the `by_milestone` meta section to remove references to non-existent tasks. Consider adding validation in dag-refresh to detect and warn about these orphan references.

## Worktree Command Audit

### worktree-new Command

The `just worktree-new <name>` command creates a new worktree at `../solar-sim-<name>` on a `feature/<name>` branch. Testing confirmed it correctly validates the name format, checks for existing worktrees, creates the branch and worktree, and installs npm dependencies for both the project and tools directories.

The command creates the worktree from the current HEAD of whichever branch is checked out in the main repo. This means if main has been updated since the current checkout, the new worktree starts with stale code. The command does not fetch from origin before creating the worktree.

**Issue Found:** No story assignment occurs at worktree creation time. The command provides generic instructions ("cd to the worktree and run just prompt") without any context about which story the worktree should work on. An agent could create a worktree named "solar" but then claim tasks from S-008 instead of S-005.

**Severity: Medium.** Story assignment is documented as a manual process requiring WORKTREE_STORY, but nothing enforces the alignment between worktree name and story filter.

**Recommendation:** Add an optional story parameter to worktree-new that writes a `.ralph/story` file to the worktree. The prompt and ralph commands could then read this file as the default WORKTREE_STORY.

### worktree-list Command

The `just worktree-list` command correctly displays all worktrees with their paths and branches. Testing showed it identifies the main worktree and lists two existing linked worktrees (solar-sim-location on feature/location, solar-sim-solar on feature/solar).

**Issue Found:** The listing shows branch names but not HEAD commit hashes or divergence from main. An operator cannot easily tell which worktrees are stale.

**Severity: Low.** This is informational improvement, not a functional gap.

**Recommendation:** Add divergence information like `git rev-list --count main..feature/name` to show how many commits ahead/behind each worktree is.

### worktree-remove Command

The `just worktree-remove <name>` command correctly checks for uncommitted changes before removing, removes the worktree, and deletes the branch if it was merged to main. The force variant bypasses the uncommitted changes check.

**Issue Found:** The command does not check whether the worktree has tasks in-progress. An operator could remove a worktree mid-task, leaving the task claimed but orphaned.

**Severity: Medium.** Tasks could be left in limbo without their assigned agent.

**Recommendation:** Check the worktree's `.ralph/current-task` file before removal. Warn if a task is in-progress and require `--force` to proceed.

## Prompt and Claim Flow Audit

### Read-Only Preview Mode

The `just prompt` command (without flags) correctly operates in read-only mode. Testing from the main repo confirmed it shows the next available task preview without modifying task-graph.yaml. The preview includes task ID, title, story, priority, status, output, and description.

The stale worktree warning appears when running from a linked worktree, correctly advising to check task availability on main via `git show main:task-graph.yaml`.

### Claim Mode with --accept

The `just prompt --accept` command correctly runs claim guards. Testing from the main repo confirmed the "Cannot claim tasks from main repo" error with exit code 2. The guard implementation at prompt.ts:223 checks `isMainWorktree()` and blocks claims from the main repo.

### Story Filter Behavior

The WORKTREE_STORY filter correctly limits task selection to the specified story. Testing with `WORKTREE_STORY=S-006` in a worktree correctly filtered to S-006 tasks. Testing with a non-existent story (S-999) correctly reported no tasks available.

**Issue Found:** The story filter applies to task selection but not to task claiming. An agent with WORKTREE_STORY=S-005 could manually run `just prompt T-008-01` to claim a task from a different story. The specific task ID path bypasses the story filter.

**Severity: Medium.** Manual override is intentional for flexibility, but it weakens the isolation guarantee.

**Recommendation:** Add a warning when claiming a task outside the WORKTREE_STORY filter. Consider requiring `--force` to claim cross-story tasks.

### Single Task Guard

The current task tracking via `.ralph/current-task` correctly prevents double-claiming. The guard at prompt.ts:233 checks for an existing current task and blocks new claims.

**Issue Found:** The current task file is per-worktree, but task-graph.yaml status is global. If worktree A claims a task, worktree B's current-task file is empty, but B would still be blocked from claiming the same task because it's in-progress in the YAML. However, if the worktrees have divergent YAMLs (which they do), B might not see the claim.

**Severity: High.** This is the core state synchronization problem. Worktrees can claim the same task if they have stale YAMLs.

## Ralph Loop Audit

### Story Filter Requirement

The ralph.sh script correctly requires WORKTREE_STORY. Running without it from any location produces the "WORKTREE_STORY environment variable is required" error. The check at ralph.sh:76 validates this before entering the main loop.

### Main Repo Block

The script correctly blocks running from the main repo. Testing confirmed the detailed error message explaining why worktrees are required and how to create one. The check at ralph.sh:45 detects the main repo by checking if `.git` is a directory (vs a file in linked worktrees).

**Critical Issue Found:** Existing worktrees have an outdated version of ralph.sh that lacks both the story filter requirement and the main repo block. The solar-sim-location worktree's ralph.sh dates from before S-007 implementation. Agents running in these worktrees operate under different rules than intended.

**Severity: Critical.** The S-007 guards exist but are not deployed to existing worktrees.

**Recommendation:** Worktrees must rebase onto main to pick up tooling updates. Consider adding a version check in the tools that warns when running from stale code.

### Race Condition on Claiming

The ralph.sh script uses `just prompt --accept` which acquires a file lock via `proper-lockfile` before modifying task-graph.yaml. This prevents race conditions when multiple ralph loops run against the same file system.

**Issue Found:** The lock is local to the file system. If two worktrees on the same machine try to claim, the lock works. If worktrees are on different machines or file systems, they have no mutual exclusion.

**Severity: Medium for single-machine usage, High for distributed usage.** The current architecture assumes single-machine operation.

**Recommendation:** Document the single-machine limitation. For distributed operation, task-graph.yaml would need to be stored in a shared location or synchronized via git.

## State Synchronization Audit

### Current Workflow

The documented workflow in CLAUDE.md states that agents should fetch main and check `git show main:task-graph.yaml` before claiming tasks. This ensures they see the authoritative task state rather than their potentially stale local copy.

**Issue Found:** Nothing enforces this check. The tooling does not verify that the worktree's task-graph.yaml matches main before allowing claims. The warning printed by prompt.ts at line 67 is informational only.

Testing revealed the severity of this gap. The solar-sim-location worktree's task-graph.yaml shows T-005-02 as in-progress and doesn't include any S-007 or S-008 tasks. Meanwhile, main shows T-005-02 as complete and includes the full S-007/S-008 task set. An agent in this worktree could claim tasks that have already been completed on main, or could be unaware of new higher-priority work.

**Severity: Critical.** State divergence makes concurrent operation unreliable.

### Merge Conflict as Serialization Point

The documented workflow relies on merge conflicts to detect duplicate task claims. If two agents claim the same task, the second agent's PR will conflict on task-graph.yaml, making the duplication visible.

**Issue Found:** This works only for agents using the PR workflow. Agents working in the main worktree (which the new guards block) or agents who commit directly to main bypass this mechanism. More importantly, the conflict detection happens at PR time, not at claim time. An agent could work for hours on a task before discovering it was already claimed.

**Severity: Medium.** The PR workflow provides eventual consistency but not immediate feedback.

**Recommendation:** Add a pre-claim check that fetches main and verifies the task is still available. This could be automatic (fetch on every claim) or advisory (print warning if local differs from remote).

### Task Completion Propagation

When an agent completes a task in their worktree, that completion exists only in their local task-graph.yaml until they push and merge. Other agents don't see it.

The existing completion guards at dag.ts:490 verify that output files exist before marking complete. This works within a single worktree but doesn't help with cross-worktree visibility.

**Issue Found:** The completion guards check the local file system, so they pass even if the output files haven't been committed. An agent could "complete" a task, have the guards pass, but then lose the work if the worktree is removed before committing.

**Severity: Medium.** The uncommitted changes warning exists at dag.ts:522 but is advisory only.

**Recommendation:** Make the uncommitted changes check blocking by default, or at least more prominent in the output.

## Issue Summary by Severity

### Critical (Blocks Reliable Operation)

1. **Stale Tooling in Worktrees.** Existing worktrees have outdated ralph.sh without story filter or main repo guards. Agents in these worktrees operate under different rules.

2. **State Divergence Without Detection.** Worktrees have different task-graph.yaml contents with no mechanism to detect or resolve divergence before claiming.

### High (Significant Risk)

3. **Double-Claim Possible Across Worktrees.** The file lock only works within a single file system. Divergent YAMLs allow the same task to appear available in multiple worktrees.

4. **No Automatic State Refresh.** Agents must manually fetch and check main before claiming, but nothing enforces or verifies this.

### Medium (Operational Friction)

5. **No Story Assignment at Worktree Creation.** Worktree names don't bind to stories, allowing accidental cross-story claiming.

6. **Cross-Story Claiming via Explicit Task ID.** The story filter can be bypassed by specifying a task ID directly.

7. **Worktree Removal Without Task Check.** Can remove a worktree with an in-progress task, orphaning the claim.

8. **Late Duplicate Detection.** Merge conflicts reveal duplicate claims only at PR time, not claim time.

9. **Advisory Uncommitted Check.** Output can be marked complete even if not committed.

### Low (Quality Improvements)

10. **Stale Meta References.** The by_milestone section references non-existent tasks.

11. **Limited Worktree Status.** The list command doesn't show divergence from main.

## Recommendations

### Immediate Fixes (Required Before Concurrent Execution)

The most critical issue is that existing worktrees have stale tooling. Before running any concurrent loops, operators must ensure all worktrees have current code. This can be done by rebasing onto main in each worktree (`cd worktree && git fetch origin main && git rebase origin/main`) or by removing and recreating worktrees.

To prevent this from recurring, add a version check in prompt.ts and ralph.sh that compares the local tools against main. The check could use a version constant in types.ts that increments with significant changes, or compare git hashes of the tools directory.

### State Synchronization Approach

The fundamental tension is between local operation (fast, offline-capable) and consistency (accurate state). Two approaches are viable.

The first approach is automatic fetch. Before every claim operation, run `git fetch origin main` and compare the local task-graph.yaml against `origin/main:task-graph.yaml`. If they differ, print a detailed warning showing what's different. Optionally block the claim if critical discrepancies exist (like claiming a task that's already complete on main).

The second approach is shared state. Move task-graph.yaml to a shared location that all worktrees read. This could be the main repo's copy (accessed via `git show main:task-graph.yaml`) or an external store. Claims would modify the shared copy atomically. This requires more architectural change but provides stronger guarantees.

The recommended path is implementing the automatic fetch approach first because it works within the existing architecture. The prompt.ts claim flow would add a fetch step, compare states, and warn or block as appropriate.

### Story Binding for Worktrees

Add an optional story parameter to `just worktree-new`: `just worktree-new solar S-005`. This would write the story ID to `.ralph/story` in the new worktree. The prompt and ralph commands would read this file as the default WORKTREE_STORY, eliminating the need to specify it on every command.

For existing worktrees, operators could manually create the `.ralph/story` file.

### Cross-Story Guard Strengthening

When claiming a task via explicit ID (like `just prompt T-008-01`), check if WORKTREE_STORY is set and the task belongs to a different story. Print a warning and require `--force` to proceed. This maintains flexibility while adding a speed bump against accidental cross-story claims.

### Concurrent Execution Test Procedure

Once the above fixes are implemented, the concurrent execution test should verify the following scenario:

1. Create two worktrees bound to different stories (S-005 and S-006).
2. Start ralph loops in both worktrees simultaneously.
3. Verify each loop only claims tasks from its assigned story.
4. Complete a task in one worktree and verify the other worktree sees the completion after fetch.
5. Attempt to have both loops claim the same task (by temporarily unbinding stories) and verify one is blocked.
6. Remove one worktree mid-task and verify appropriate warnings.

This procedure should be scripted for repeatability and run before declaring concurrent operation stable.

## Conclusion

The multi-agent worktree system has a solid foundation from S-007's claim and completion guards, but the state synchronization gap makes concurrent operation risky. The immediate blocker is stale tooling in existing worktrees, which can be fixed by rebasing. The longer-term fix requires adding automatic state refresh before claims to detect divergence.

The recommended implementation path is T-008-02 to migrate story-level tasks if needed, T-008-03 to add worktree validation including the state refresh, and T-008-04 to create the concurrent execution test. These build on S-007's work to close the remaining gaps in the multi-agent model.

---

## S-007 Implementation Status (Reference)

This section documents what S-007 implemented as context for the S-008 work above.

### Ticket-First DAG Generation (T-007-02) ✓

The `just dag-refresh` command now regenerates nodes from ticket frontmatter. Key implementation details in dag.ts:

- `scanTickets()` parses all `.md` files in `docs/active/tickets/`, extracting frontmatter and description
- `validateTicketFrontmatter()` enforces required fields (id, title, story, status, priority, complexity)
- `generateNodesFromTickets()` creates Task nodes from ticket data
- `generateEdgesFromTickets()` creates edges from `depends_on` arrays
- Story-level nodes (S-* prefix) are preserved since they don't have ticket files
- T-* nodes are only generated from tickets, so deleted ticket files are automatically removed

### Claim Guards (T-007-03) ✓

The prompt.ts implements multiple guards:

- `isMainWorktree()` at line 50: Detects main repo by checking if .git is a directory
- `checkMainRepoGuard()` at line 223: Blocks claims from main repo with exit code 2
- `checkSingleTaskGuard()` at line 233: Prevents claiming while `.ralph/current-task` exists
- `checkStoryFilterGuard()` at line 244: Validates WORKTREE_STORY matches available tasks

### Completion Guards (T-007-04) ✓

The dag.ts implements completion verification:

- `checkOutputExists()` at line 226: Verifies output file/directory exists
- `runCompletionGuards()` at line 255: Runs all guards and collects errors/warnings
- Placeholder detection via minimum file size thresholds
- Uncommitted changes warning via `git status --porcelain`
- `--force` flag at line 463: Overrides all guards

### Audit Logging (T-007-05) ✓

The tools/audit.ts module provides logging:

- `logAuditEvent()`: Core function writing to `logs/task-audit.jsonl`
- `logClaimed()`, `logCompleted()`, `logReset()`: State transition events
- `logClaimBlocked()`, `logCompleteBlocked()`: Guard rejection events
- `logPreview()`: Read-only prompt invocations

Integration points are in prompt.ts (claims, previews) and dag.ts (completions, resets).
