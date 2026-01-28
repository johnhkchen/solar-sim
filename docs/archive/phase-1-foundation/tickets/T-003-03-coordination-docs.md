---
id: T-003-03
title: Add coordination docs and prompt warning
story: S-003
milestone: M5
status: pending
priority: 2
complexity: S
depends_on:
  - T-003-02
assignee: null
created: 2026-01-27
---

# T-003-03: Add Coordination Documentation and Prompt Warning

## Overview

Update CLAUDE.md with the cross-worktree coordination workflow and add a warning to `just prompt` when running from a linked worktree.

## Implementation Details for CLAUDE.md Updates

The existing Git Workflow section in CLAUDE.md mentions worktrees but doesn't explain the coordination protocol. Expand this section with the full workflow for agents working in parallel.

Explain that the main worktree owns the authoritative copy of task-graph.yaml and that agents in linked worktrees should not modify their local copies. Describe how to check task availability before starting work by running `git fetch origin main` followed by `git show main:task-graph.yaml` to read the current DAG state from main.

Document the PR-based workflow where agents push their branch to the remote, create a PR with `gh pr create`, and include the task status update as part of the PR. Explain that the merge serves as the serialization point for task claiming and that conflicts on task-graph.yaml indicate duplicate work.

Add a complete example showing the full cycle from creating a worktree through completing work and cleanup. The example should show `just worktree-new alpha`, then `cd ../solar-sim-alpha`, then checking task availability, then working on a task, then committing and pushing, then creating a PR, and finally running `just worktree-remove alpha` from the main worktree after the PR merges.

## Implementation Details for Prompt Warning

Modify the prompt generation logic in `tools/prompt.ts` to detect when it's running from a linked worktree rather than the main worktree. A worktree is linked if its `.git` is a file containing a gitdir reference rather than a directory. Check this by running `test -f .git` or by examining the contents of `.git` for the `gitdir:` prefix.

When running from a linked worktree, print a warning before the prompt output reminding the agent that task-graph.yaml in this worktree may be stale. The warning should suggest running `git show main:task-graph.yaml` to check current task availability on main. The warning should go to stderr so it doesn't pollute the prompt output that gets piped to Claude.

The warning should be non-blocking since agents may legitimately run `just prompt` in a linked worktree when resuming work on an already-claimed task. It's just a reminder to verify the task is still available before starting new work.

## Acceptance Criteria

CLAUDE.md must include clear documentation of the cross-worktree coordination protocol. It must explain how to check task availability from a linked worktree. It must show a complete example of the worktree workflow from creation through cleanup.

The prompt command must detect when running from a linked worktree. It must print a warning to stderr about potentially stale task-graph.yaml. The warning must not interfere with the prompt output on stdout.

## Technical Notes

To detect a linked worktree in bash, check whether `.git` is a file rather than a directory. In Node.js the same check works with `fs.statSync('.git').isFile()`. The contents of the `.git` file in a linked worktree look like `gitdir: /path/to/main/.git/worktrees/name` which can also be parsed to find the main worktree path if needed.

The warning message should be concise and actionable, something like "Warning: Running from linked worktree. Check task availability with: git show main:task-graph.yaml".

## Dependencies

This ticket depends on T-003-02 because the documentation should reference the implemented worktree commands.

## Output

The deliverables are updates to CLAUDE.md and `tools/prompt.ts`.
