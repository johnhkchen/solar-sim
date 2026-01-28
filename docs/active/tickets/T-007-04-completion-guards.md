---
id: T-007-04
title: Add completion guards
story: S-007
status: pending
priority: 0
complexity: M
depends_on:
  - T-007-02
output: tools/dag.ts
---

# T-007-04: Add Completion Guards

## Objective

Prevent `just task-complete` from marking tasks complete when deliverables are missing. Update ticket frontmatter instead of task-graph.yaml directly.

## New Command Behavior

### `just task-complete <id>`

1. Find the ticket file for this task
2. Run completion guards (see below)
3. Update ticket frontmatter: `status: complete`, `completed_at: <timestamp>`
4. Run `just dag-refresh` to sync task-graph.yaml
5. Clear `.ralph/current-task` if it matches this task
6. Print confirmation with next available task

### `just task-complete <id> --force`

Skip guards and force completion. Still updates ticket frontmatter. Always logs the force override in audit trail.

## Guards to Implement

### 1. Output File Guard

If the task specifies an `output` path in frontmatter:
- Check that the file or directory exists
- If it's a file, check it's not empty (>100 bytes as heuristic)
- If it's a directory, check it contains at least one non-hidden file

Failure behavior:
```
Error: Output file missing: docs/knowledge/research/phantom-claiming.md
The task specifies this file should be created, but it doesn't exist.
Run with --force to complete anyway.
```

### 2. Placeholder Detection

For markdown files, check for placeholder patterns:
- Files under 500 bytes
- Files containing only frontmatter
- Files with "TODO" or "TBD" as the only content

Warning behavior (doesn't block, just warns):
```
Warning: Output file appears incomplete (only 234 bytes).
Completing anyway. Consider reviewing: docs/knowledge/research/phantom-claiming.md
```

### 3. Uncommitted Changes Warning

Check git status for the output path:
```bash
git status --porcelain <output_path>
```

If changes are uncommitted, warn:
```
Warning: Output file has uncommitted changes.
Consider committing your work before marking complete.
```

This is a warning only, doesn't block completion.

## Ticket Frontmatter Updates

When completing, update the ticket file:

```yaml
---
id: T-007-01
title: Diagnose phantom task claiming
story: S-007
status: complete            # Changed from 'in-progress'
claimed_at: 2026-01-28T12:34:56Z
claimed_by: solar-sim-solar
completed_at: 2026-01-28T14:56:78Z  # Added
priority: 0
complexity: M
depends_on: []
output: docs/knowledge/research/phantom-claiming.md
---
```

## Deliverable

Updated `tools/dag.ts` with:
- Completion guards in task-complete command
- Ticket frontmatter update logic
- `--force` flag support
- Integration with dag-refresh

## Acceptance Criteria

- `just task-complete` fails for tasks with missing output files
- `just task-complete --force` overrides the check
- Placeholder files trigger warnings
- Uncommitted changes trigger warnings
- Ticket frontmatter is updated (not task-graph.yaml directly)
- `just dag-refresh` runs automatically after completion
