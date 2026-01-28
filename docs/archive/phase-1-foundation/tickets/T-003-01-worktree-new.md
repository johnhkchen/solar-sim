---
id: T-003-01
title: Implement worktree-new command
story: S-003
milestone: M5
status: pending
priority: 2
complexity: M
depends_on: []
assignee: null
created: 2026-01-27
---

# T-003-01: Implement worktree-new Command

## Overview

Create the `just worktree-new <name>` command that sets up a new worktree with proper branch naming and dependency installation so agents can start working immediately.

## Implementation Details

The command should be added to the justfile as a recipe that takes a single argument for the worktree name. The recipe validates the name first by checking that it contains only alphanumeric characters, hyphens, and underscores using a bash pattern match like `[[ "$name" =~ ^[a-zA-Z0-9_-]+$ ]]` to prevent path traversal or shell injection issues.

Before creating the worktree, the command checks whether a worktree with that name already exists by parsing `git worktree list` output and looking for the target path `../solar-sim-<name>`. If found, it prints an error message and exits with code 1.

The actual worktree creation uses `git worktree add ../solar-sim-{{name}} -b feature/{{name}}` which creates both the directory and branch in one operation. If the branch already exists because a previous worktree used it and was cleaned up after merging, the command should detect the failure and retry with `-B` to reset the branch to current HEAD. This is safe for ephemeral branches that follow the recommended workflow.

After creating the worktree, the command runs `npm install --prefix ../solar-sim-{{name}}/tools` to install the DAG tooling dependencies. This ensures that `just prompt` and related commands work in the new worktree without manual intervention.

Finally, the command prints success output showing the worktree path and branch name, followed by instructions telling the agent to cd into the new directory and run `just prompt` to get started.

## Acceptance Criteria

The command must validate the name argument and reject invalid characters with a clear error message. It must create the worktree at the correct sibling path relative to the main repository. It must create a feature branch named after the worktree. It must install npm dependencies in the tools directory. It must print clear instructions for the next steps.

## Technical Notes

Use `@` prefix on justfile recipe lines where appropriate to suppress command echo for cleaner output. The npm install step should use `--prefix` rather than cd to avoid changing the working directory. Consider using `git worktree add -b` with `|| git worktree add -B` as a fallback pattern for handling existing branches.

## Dependencies

This ticket has no dependencies since it only uses standard git commands and npm.

## Output

The deliverable is the `worktree-new` recipe in the justfile.
