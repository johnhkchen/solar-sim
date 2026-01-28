---
id: T-003-02
title: Implement worktree-list and worktree-remove commands
story: S-003
milestone: M5
status: pending
priority: 2
complexity: M
depends_on:
  - T-003-01
assignee: null
created: 2026-01-27
---

# T-003-02: Implement worktree-list and worktree-remove Commands

## Overview

Create the `just worktree-list` and `just worktree-remove <name>` commands that provide visibility into active worktrees and safe cleanup when work is complete.

## Implementation Details for worktree-list

The list command wraps `git worktree list` and formats the output to clearly show which worktree is the main one. Parse the default git output which shows path, commit hash, and branch in brackets. Identify the main worktree by checking whether the path ends with the base repository name without a suffix, and print a marker like `[main worktree]` after it.

After listing worktrees, run `git worktree list --porcelain` and check for any entries with `prunable` in the output. If found, print a warning suggesting the user run `git worktree prune` to clean up stale entries.

## Implementation Details for worktree-remove

The remove command takes a name argument and removes the worktree at `../solar-sim-<name>`. It also accepts an optional `--force` flag to skip safety checks.

Before removal, check whether the worktree has uncommitted changes by running `git -C ../solar-sim-{{name}} status --porcelain` and checking if the output is non-empty. If there are uncommitted changes and `--force` was not specified, print a warning listing the changed files and exit with code 1. The error message should tell the user to either commit the changes, discard them with `git -C ../solar-sim-{{name}} checkout .`, or re-run with `--force`.

When proceeding with removal, run `git worktree remove ../solar-sim-{{name}}` to delete the directory and clean up git metadata. Then check whether the branch `feature/{{name}}` has been merged to main by running `git branch --merged main | grep -q "feature/{{name}}"`. If merged, delete the branch with `git branch -d feature/{{name}}` and print a message confirming the branch was deleted. If not merged, print a message explaining the branch was preserved because it contains unmerged commits.

When `--force` is specified, skip the uncommitted changes check and use `git worktree remove --force` which handles the directory deletion even with modified files. Also delete the branch unconditionally with `git branch -D feature/{{name}}`.

## Acceptance Criteria

The list command must show all worktrees with their branches. It must clearly indicate which is the main worktree. It must warn about prunable worktrees if any exist.

The remove command must refuse to delete worktrees with uncommitted changes unless forced. It must delete branches that have been merged to main. It must preserve branches with unmerged commits. It must provide clear feedback about what was done.

## Technical Notes

Justfile doesn't support optional arguments easily, so implement force as a separate recipe like `worktree-remove-force` that calls the main logic with the force flag set. Alternatively, check for `force` as a second positional argument in the recipe.

Use `git branch --merged main` rather than `git branch -d` to check merge status first, since `-d` will fail on unmerged branches and the error message is less clear than a custom one.

## Dependencies

This ticket depends on T-003-01 since the remove command should follow the same naming conventions established by worktree-new.

## Output

The deliverables are the `worktree-list` and `worktree-remove` recipes in the justfile.
