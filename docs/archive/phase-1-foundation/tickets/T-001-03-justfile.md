---
id: T-001-03
title: Add just ralph command and documentation
story: S-001
milestone: M6
status: complete
priority: 1
complexity: S
depends_on:
  - T-001-02
assignee: null
created: 2026-01-27
completed: 2026-01-28
---

# T-001-03: Add just ralph Command and Documentation

## Overview

Wire up the Ralph loop script to the justfile and add documentation explaining how to use and monitor the autonomous loop.

## Implementation Details

Add a `ralph` recipe to the justfile that invokes `tools/ralph.sh`. The recipe should be simple since all logic lives in the script itself. Include a brief comment in the justfile explaining what the command does.

Add a `ralph-status` recipe that shows monitoring information: the contents of the heartbeat file if it exists, the last few entries from the JSON log, and a reminder to run `just dag-status` for task state. This gives developers a quick way to check on a running loop without parsing files manually.

Update CLAUDE.md to document the new commands in the Workflow Commands section. Explain that `just ralph` starts an autonomous loop that processes tasks until completion, and that developers should monitor progress with `just dag-status` and `just ralph-status`.

Add a section to the S-001 story or create a new document at `docs/knowledge/guides/ralph-usage.md` explaining how to run and monitor Ralph loops. Cover starting the loop, monitoring progress, handling failures, and recovering from stuck tasks. The guide should be written in flowing prose following the writing style requirements.

## Acceptance Criteria

Running `just ralph` must start the autonomous loop. Running `just ralph-status` must show heartbeat and recent log entries. CLAUDE.md must document both commands. A usage guide must explain the complete workflow for running and monitoring Ralph.

## Technical Notes

The justfile recipe should use `@` prefix to suppress echoing the command itself since the script produces its own output. Consider adding a `ralph-logs` recipe that tails the JSON log with jq formatting for real-time monitoring.

## Dependencies

This ticket depends on T-001-02 since it documents functionality implemented there.

## Output

The deliverables are updates to the justfile, CLAUDE.md, and a new usage guide document.
