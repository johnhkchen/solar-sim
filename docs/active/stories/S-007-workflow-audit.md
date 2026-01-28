---
id: S-007
title: Task Management Workflow Audit
status: pending
priority: 1
milestone: null
---

# S-007: Task Management Workflow Audit

This story addresses reliability issues in the multi-agent task management system discovered during phase 2 development.

## Problem Statement

During S-005 and S-006 execution, several workflow failures occurred that undermined the reliability of concurrent ralph loops.

### Observed Issues

**Duplicate task claiming**: Both worktrees claimed the same task (S-005-R) despite running on different stories. The story filter was added but wasn't being used correctly.

**Premature completion marking**: Tasks were marked complete in task-graph.yaml before the actual work was done. The ralph loop or agents updated status without verifying deliverables existed.

**State desynchronization**: The task-graph.yaml in main diverged from worktree copies. Changes accumulated in main's working directory rather than in worktree branches, breaking the intended PR-based merge flow.

**Stale task accumulation**: Tasks remained in-progress for hours after agents stopped working on them. The heartbeat mechanism didn't effectively detect abandoned work.

**Uncommitted work**: Implementation files existed in main but weren't committed. The workflow assumed agents would commit, but they didn't always do so.

## Root Cause Analysis

The issues stem from several architectural gaps.

### No deliverable verification

The `just task-complete` command marks a task complete based solely on the task ID. It doesn't verify that the expected output files exist or have meaningful content. An agent can mark research complete without producing a research document.

### Story filter not enforced

The `WORKTREE_STORY` filter was added to prompt.ts but wasn't being used consistently. The `just ralph` command doesn't require or validate a story assignment, so loops can run without filtering.

### No commit enforcement

The workflow assumes agents commit their work, but nothing enforces this. Agents can modify files and mark tasks complete without creating commits. The PR-based merge flow only works if commits exist.

### Worktree state isolation failure

The worktrees were supposed to isolate work on feature branches, but changes ended up in main's working directory. This suggests the loops ran from main rather than from worktrees, or the worktrees weren't properly configured.

### Heartbeat insufficient for detection

The heartbeat file only indicates the loop is running, not that it's making progress. A stuck loop that keeps iterating but fails to complete tasks would have a fresh heartbeat.

## Proposed Fixes

### F1: Deliverable verification

Add an optional `output` field check to `just task-complete`. If the task specifies an output path, verify the file exists before marking complete. Log a warning if the file is missing or empty.

### F2: Mandatory story filter

Modify `just ralph` to require a story argument. Change from `just ralph` to `just ralph S-005`. The loop should fail to start without a valid story assignment. This prevents accidental cross-story claiming.

### F3: Commit-before-complete

Add a pre-complete check that verifies the working directory has no uncommitted changes related to the task's output files. If uncommitted changes exist, prompt the agent to commit first or refuse to mark complete.

### F4: Worktree validation

Add a check at loop start that verifies the current directory is a linked worktree (not the main repo). Refuse to run ralph from main to prevent accidental state pollution.

### F5: Progress tracking

Enhance the heartbeat to include the current task ID and a timestamp of when that task was claimed. Stale detection can then identify loops that claimed a task long ago without completing it.

### F6: Task claiming audit log

Log all task state transitions (claim, complete, reset) with timestamps and worktree identity to a separate audit file. This creates a clear record of what happened when, aiding debugging.

## Implementation Approach

The fixes should be implemented incrementally, with each one tested before moving to the next. Priority order is F2 (mandatory story filter) first since it prevents the most damaging failure mode, then F4 (worktree validation), then F1 (deliverable verification), then F3 (commit-before-complete), then F5 and F6 as observability improvements.

## Acceptance Criteria

The workflow is reliable when two concurrent ralph loops can complete their respective R-P-I chains without duplicate task claiming or premature completion. Each loop must commit its work to its feature branch. Task status in task-graph.yaml must accurately reflect actual work state. The audit log must show a clear history of task state transitions.

## Research Questions

Before implementation, verify these assumptions.

R1: Can git detect whether we're in a linked worktree vs the main repo programmatically? (Check `.git` file vs directory distinction.)

R2: What's the best way to verify a file has "meaningful content" vs being empty or placeholder? (File size threshold? Content pattern matching?)

R3: Should the story filter be inferred from the worktree name (solar-sim-solar -> S-005) or always explicit?

R4: How should the system handle the case where an agent legitimately needs to work across multiple stories?

## Dependencies

This story blocks future concurrent development. It should be completed before the next phase of parallel work begins. It does not depend on S-005 or S-006 completion.
