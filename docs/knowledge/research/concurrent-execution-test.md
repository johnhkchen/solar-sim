# Concurrent Execution Test Report

This document records the procedure and results of the T-008-04 concurrent execution test, which validates that two ralph loops can run simultaneously on different worktrees without interfering with each other.

## Test Environment

The test was conducted on 2026-01-28 using the following setup. Two worktrees were created from the main repository at commit 9ab0c88, named solar-sim-alpha and solar-sim-beta on branches feature/alpha and feature/beta respectively. The main repo is at /Volumes/ext1/swe/repos/solar-sim with worktrees at ../solar-sim-alpha and ../solar-sim-beta.

The tooling required manual synchronization since uncommitted changes in the main repo meant worktrees started with stale versions. Files that needed copying included ralph.sh, prompt.ts, dag.ts, audit.ts, types.ts, justfile, and task-graph.yaml.

## Available Tasks at Test Time

At test start, the task graph showed two ready tasks: T-008-04 (this test, priority P0, story S-008) and T-005-01 (implement sun position calculator, priority P1, story S-005). T-008-04 was then marked in-progress since it was being executed, leaving T-005-01 as the only claimable task.

## Test Procedure and Results

### Phase 1: Guard Validation

#### Test 1.1: Main Repo Block

Running `just ralph` from the main worktree was expected to fail with the main repo guard error.

**Actual Result:** PASSED. The ralph loop correctly detected the main repo and blocked execution with exit code 1, printing the message:

```
Error: Cannot run Ralph loop from main repo.

Ralph loops must run in a linked worktree to:
- Keep work isolated on feature branches
- Prevent conflicts with other agents
- Enable clean PR workflow
```

#### Test 1.2: Story Filter Requirement

Running `just ralph` from a linked worktree without WORKTREE_STORY was expected to fail.

**Actual Result:** PASSED. The ralph loop required the story filter and printed:

```
Error: WORKTREE_STORY environment variable is required.

Ralph loops must be scoped to a single story to prevent
cross-story task pollution and ensure focused work.
```

#### Test 1.3: Non-Existent Story Handling

Running with WORKTREE_STORY=S-999 was expected to gracefully exit when no tasks are available.

**Actual Result:** PASSED. The prompt command correctly reported "No tasks available for story S-999" and exited with code 1.

#### Test 1.4: Cross-Story Claim Warning

Attempting to claim a specific task from a different story than WORKTREE_STORY was expected to warn and block.

**Actual Result:** PASSED. Running `WORKTREE_STORY=S-008 node tools/prompt.ts T-005-01` printed:

```
Cross-story claim warning:
   Task T-005-01 belongs to S-005
   but WORKTREE_STORY is set to S-008

   This may cause cross-story pollution.
   If intentional, unset WORKTREE_STORY or use --force.
```

The claim was blocked and logged in the audit log.

### Phase 2: Single Loop Execution

#### Test 2.1: Ralph Loop with No Available Tasks

Running `WORKTREE_STORY=S-008 just ralph` from alpha worktree was expected to find no tasks since T-008-04 was already in-progress.

**Actual Result:** PASSED. The loop started correctly and reported "No tasks available for story S-008" before exiting gracefully with exit code 0 and a summary showing zero completed, zero failed.

### Phase 3: Concurrent Execution (Critical Finding)

#### Test 3.1: Sequential Claims from Different Worktrees

The critical test involved having both worktrees attempt to claim the same task (T-005-01) to verify the race condition handling.

First, from solar-sim-alpha: `WORKTREE_STORY=S-005 just prompt --accept`

**Result:** The claim succeeded. T-005-01 was marked in-progress with claimed_by=alpha at 17:13:54.521Z.

Then, from solar-sim-beta: `WORKTREE_STORY=S-005 just prompt --accept`

**Result:** CRITICAL BUG - The claim also succeeded! T-005-01 was marked in-progress with claimed_by=beta at 17:13:59.307Z.

**Root Cause:** Each worktree has its own independent copy of task-graph.yaml. The file lock (proper-lockfile) only prevents concurrent writes to the same file, not writes to different files in different directories. When alpha claimed the task, it updated alpha's task-graph.yaml. Beta's task-graph.yaml still showed T-005-01 as ready, so beta also claimed it.

#### Test 3.2: Audit Log Evidence

Both worktrees correctly logged their claims to their local audit files:

Alpha's logs/task-audit.jsonl:
```json
{"timestamp":"2026-01-28T17:13:54.524Z","event":"claimed","task_id":"T-005-01","old_status":"ready","new_status":"in-progress","worktree":"S-005","trigger":"just prompt --accept"}
```

Beta's logs/task-audit.jsonl:
```json
{"timestamp":"2026-01-28T17:13:59.310Z","event":"claimed","task_id":"T-005-01","old_status":"ready","new_status":"in-progress","worktree":"S-005","trigger":"just prompt --accept"}
```

The audit logging correctly recorded both claims, providing forensic evidence of the double-claim.

### Phase 4: State Synchronization

#### Test 4.1: Stale State Warning

Running `just prompt` from a worktree was expected to warn about potentially stale state.

**Actual Result:** PASSED. The warning appeared: "Running from linked worktree. task-graph.yaml may be stale. Check task availability with: git show main:task-graph.yaml"

However, this warning is advisory only and does not block operations.

## Issues Found

### Issue 1: Double-Claiming Across Worktrees (Critical)

The test revealed a critical bug: two worktrees can claim the same task because each operates on an independent task-graph.yaml with no synchronization mechanism.

**Severity:** Critical. This defeats the purpose of task claiming and can result in duplicate work.

**Evidence:** T-005-01 was claimed by both alpha (17:13:54) and beta (17:13:59) within seconds.

**Root Cause:** The file lock protects against race conditions within a single file but cannot prevent claims across independent files. The documented workflow of "fetch main before claiming" is advisory only and not enforced.

**Impact:** In production operation, two agents could unknowingly work on the same task simultaneously, wasting resources and potentially creating conflicting implementations.

### Issue 2: Uncommitted Tooling Changes (Critical)

The main repo had uncommitted changes to tools (ralph.sh, prompt.ts, justfile) that weren't present in newly created worktrees. The worktrees were created from HEAD (commit 9ab0c88) but the working directory had newer uncommitted changes.

**Severity:** Critical. Worktrees ran with older rules lacking the story filter requirement and main repo block guards until files were manually copied.

**Evidence:** The worktree's ralph.sh showed the old header "This script continuously pulls tasks" instead of the new "This script continuously claims tasks", and lacked the WORKTREE_STORY requirement.

**Mitigation Applied:** Manually copied updated tools and justfile to worktrees.

### Issue 3: Uncommitted task-graph.yaml Changes

The task-graph.yaml in main had uncommitted changes showing different task states than what was committed.

**Severity:** High. Worktrees started with an outdated view of task availability.

**Evidence:** The worktree initially showed T-006-02 as ready (from old state) when it was already complete in the current state.

**Mitigation Applied:** Manually copied task-graph.yaml to worktrees.

## Recommendations

### Immediate (Required for Safe Concurrent Operation)

1. **Always commit tooling and state changes before creating worktrees.** The worktree-new command creates from HEAD, so any uncommitted changes will not be present.

2. **Add pre-claim state verification.** Before claiming, the prompt.ts should fetch origin/main and compare the task status. If the task is already in-progress or complete on main, block the claim with a clear error.

3. **Consider a shared state approach.** Instead of each worktree having its own task-graph.yaml, have all worktrees read from and write to a shared location. Options include using `git show main:task-graph.yaml` for reads and committing/pushing for writes, or using an external state store.

### Medium-Term (Recommended Improvements)

4. **Add tooling version check.** Include a version constant in the tools that can be compared against main. Warn or block when running with stale tooling.

5. **Make the stale state warning actionable.** Currently the warning just prints and continues. Consider requiring an explicit flag like `--i-checked-main` to acknowledge the risk when claiming from a worktree.

6. **Document the single-machine limitation.** The file lock only works when worktrees share a file system. Distributed operation (worktrees on different machines) has no mutual exclusion and will definitely double-claim.

## Test Summary

| Test | Description | Result |
|------|-------------|--------|
| 1.1 | Main repo block | PASSED |
| 1.2 | Story filter requirement | PASSED |
| 1.3 | Non-existent story | PASSED |
| 1.4 | Cross-story claim warning | PASSED |
| 2.1 | Single loop with no tasks | PASSED |
| 3.1 | Double-claim prevention | **FAILED** |
| 3.2 | Audit log recording | PASSED |
| 4.1 | Stale state warning | PASSED |

## Conclusion

The concurrent execution test revealed a critical gap in the multi-agent worktree system. While the individual guards work correctly (main repo block, story filter, cross-story warning, audit logging), the fundamental assumption that worktrees share state is incorrect. Each worktree operates on an independent task-graph.yaml with no synchronization, allowing double-claims.

The S-007 guards improved the system significantly by requiring story filters and blocking main repo execution, but they cannot prevent the state divergence problem because they operate locally within each worktree.

**Current Status:** The system is NOT safe for concurrent operation without manual coordination. Operators must manually verify task availability on main before claiming, and must trust that other agents are doing the same.

**Required Fix:** Implement pre-claim state verification that fetches and checks origin/main before allowing claims. This would catch most double-claim scenarios at claim time rather than at PR merge time.

The test achieves its purpose of proving the concurrent execution model's limitations. The issues discovered are documented for the next iteration of improvements.
