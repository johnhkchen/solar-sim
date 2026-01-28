---
id: T-001-01
title: Implement core Ralph loop script
story: S-001
milestone: M6
status: pending
priority: 1
complexity: M
depends_on: []
assignee: null
created: 2026-01-27
---

# T-001-01: Implement Core Ralph Loop Script

## Overview

Create the main loop script at `tools/ralph.sh` that implements the autonomous execution loop for processing tasks from the DAG.

## Implementation Details

The script should implement a while loop that continues until `just prompt` indicates no work is available. Each iteration follows this sequence: call `just prompt` and capture its stdout, stderr, and exit code. When the exit code is 0, pipe the prompt content to `claude --dangerously-skip-permissions` and capture Claude's exit code. When the exit code is 1, parse stderr to determine whether all tasks are complete or all are blocked, then exit appropriately.

The loop needs signal handling for SIGINT and SIGTERM so that developers can cleanly interrupt with Ctrl-C. The handler should print a message indicating interruption and exit with code 130 for SIGINT or 143 for SIGTERM following Unix conventions.

Include a two-second sleep between iterations to allow filesystem operations to settle and provide natural API throttling. This delay should come after processing a task, not before, so the first iteration starts immediately.

Console output should show the current iteration number, the task ID being processed, and a success or failure indicator when each task completes. Print a summary on exit showing total iterations, tasks completed, tasks failed, and total runtime.

## Acceptance Criteria

The script must successfully loop through available tasks by calling `just prompt` and piping to Claude. It must exit cleanly with code 0 when all tasks are complete and exit cleanly with code 0 plus an advisory message when tasks are blocked. It must continue looping when Claude fails on a task rather than crashing. It must handle SIGINT and SIGTERM gracefully. It must print useful console output showing progress.

## Technical Notes

The script should use `#!/usr/bin/env bash` and `set -euo pipefail` for safety, but wrap the Claude invocation in `|| true` to prevent failures from exiting the script. Use a temp file for the prompt content rather than process substitution to ensure the prompt is fully written before Claude reads it.

## Dependencies

This ticket has no dependencies since `just prompt` and `just task-complete` are already implemented.

## Output

The deliverable is `tools/ralph.sh` containing the core loop implementation.
