---
id: S-008
title: Multi-Agent Worktree Audit
status: pending
priority: 0
milestone: null
---

# S-008: Multi-Agent Worktree Audit

## Context

The S-007 workflow audit fixed phantom task claiming and added guards, but the multi-agent concurrent execution model remains untested and unreliable. The current system has several gaps that prevent confident parallel execution across worktrees.

The DAG still mixes story-level tasks (like S-005-R, S-005-P) with ticket-generated nodes, which creates confusion about what's authoritative. The worktree commands work but lack validation that the agent is actually scoped correctly. And we have no end-to-end verification that two agents can work on different stories simultaneously without stepping on each other.

## Problems to Solve

The first problem is that the DAG isn't fully ticket-driven. Story-level tasks like S-005-R and S-005-P exist in task-graph.yaml but have no corresponding ticket files. The dag-refresh command preserves these "orphan" nodes, but that means the YAML isn't actually derived from tickets alone. We need to either create tickets for these tasks or migrate them to a different structure.

The second problem is worktree isolation validation. When an agent starts work, there's no verification that the worktree, the story filter, and the branch are all aligned. An agent could be in worktree "solar-sim-alpha" on branch "feature/alpha" but accidentally claim tasks from S-006 instead of S-005. The guards in prompt.ts check for main repo but don't validate story/worktree alignment.

The third problem is that we have no integration test for concurrent execution. We've never actually run two ralph loops simultaneously on different worktrees and verified they don't interfere. This needs a manual or scripted test procedure.

The fourth problem is state synchronization. When one agent completes a task in their worktree, that completion only exists in their local task-graph.yaml until they push and merge. Other agents won't see it. The CLAUDE.md describes checking main before claiming, but the tooling doesn't enforce this.

## Acceptance Criteria

The story is complete when the task graph is fully derived from ticket frontmatter with no orphan nodes preserved, when worktree commands validate story/branch alignment before allowing claims, when there's a documented test procedure for concurrent execution that has been run successfully, and when the state synchronization workflow is either enforced by tooling or clearly documented as a manual process.

## Research Questions

Before implementing fixes, we need to understand what story-level tasks exist and whether they should become tickets or be removed. We need to understand the actual workflow for two agents working concurrently, including what git operations happen and when. And we need to decide whether state sync should be automatic (fetch before claim) or manual (documented process).

## Implementation Approach

Start with T-008-01 to audit the current state and document exactly what's broken. Then T-008-02 to decide on the story-task migration strategy. Then T-008-03 to implement worktree validation. Finally T-008-04 to create and run the concurrent execution test.
