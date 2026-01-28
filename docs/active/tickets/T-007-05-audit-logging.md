---
id: T-007-05
title: Add audit logging
story: S-007
status: pending
priority: 0
complexity: S
depends_on:
  - T-007-03
  - T-007-04
output: tools/audit.ts
---

# T-007-05: Add Audit Logging

## Objective

Create a forensic record of all task state transitions for debugging workflow issues.

## Log Format

Create `logs/task-audit.jsonl` with entries:

```json
{
  "timestamp": "2026-01-28T12:34:56Z",
  "event": "claimed|completed|reset|force-completed",
  "task_id": "T-007-01",
  "old_status": "ready",
  "new_status": "in-progress",
  "worktree": "solar-sim-solar",
  "trigger": "just prompt|just task-complete|just task-reset",
  "notes": "optional context"
}
```

## Events to Log

### Claim Events
- When `just prompt` claims a task
- When `just prompt` returns existing claim (idempotent)
- When claim is blocked by guards

### Completion Events
- When `just task-complete` succeeds
- When completion is blocked by guards
- When `--force` overrides guards

### Reset Events
- When `just task-reset` is called
- Include reason if provided

## Implementation Notes

Create a shared `tools/audit.ts` module that exports logging functions. Import this into prompt.ts and dag.ts.

Audit log is append-only. Never truncate or rotate during a session.

## Deliverable

New `tools/audit.ts` module with logging functions, integrated into prompt.ts and dag.ts.

## Acceptance Criteria

- All task state transitions are logged
- Log entries include timestamp, event type, task ID, and worktree
- Force overrides are clearly marked in the log
- Log file is valid JSONL format
