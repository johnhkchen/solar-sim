---
id: T-001-02
title: Implement Ralph logging infrastructure
story: S-001
milestone: M6
status: pending
priority: 1
complexity: S
depends_on:
  - T-001-01
assignee: null
created: 2026-01-27
---

# T-001-02: Implement Ralph Logging Infrastructure

## Overview

Add structured logging and heartbeat functionality to the Ralph loop script created in T-001-01.

## Implementation Details

The logging system writes to `logs/ralph.jsonl` in newline-delimited JSON format. Each log entry should contain these fields: timestamp in ISO 8601 format, iteration as an integer, task_id as a string or null if no task was selected, action as a string like "started", "completed", "failed", or "skipped", duration_seconds as a number, exit_code as an integer or null, and outcome as a human-readable summary string.

Create a helper function in the script that takes these parameters and outputs a properly escaped JSON line. Use `jq -n` if available for JSON construction, falling back to manual string building if jq is not installed. The script should create the logs directory if it doesn't exist.

The heartbeat mechanism writes the current ISO 8601 timestamp to `logs/ralph.heartbeat` at the very start of each iteration, before calling `just prompt`. This allows external monitoring to detect stuck loops by checking whether the heartbeat file has been updated recently.

Add rate limit detection by checking Claude's stderr for patterns like "rate limit" or "too many requests" case-insensitively. When detected, log a warning entry and sleep for 60 seconds before continuing. Double the sleep duration on consecutive rate limits up to a maximum of 600 seconds, and reset to 60 seconds after a successful iteration.

## Acceptance Criteria

Each loop iteration must append a JSON entry to `logs/ralph.jsonl`. The log entries must be parseable with `jq` and contain all specified fields. The heartbeat file must be updated at the start of each iteration. Rate limit detection must trigger extended waits with exponential backoff. The logs directory must be created automatically if missing.

## Technical Notes

Use `date -u +"%Y-%m-%dT%H:%M:%SZ"` for ISO 8601 timestamps. Ensure log writes are atomic by writing to a temp file and using `mv` to prevent partial writes from corrupting the log. The heartbeat file can be written directly since it's a single timestamp.

## Dependencies

This ticket depends on T-001-01 since it modifies the script created there.

## Output

The deliverable is an updated `tools/ralph.sh` with logging and heartbeat functionality, plus the `logs/` directory structure.
