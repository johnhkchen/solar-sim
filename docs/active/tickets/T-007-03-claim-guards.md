---
id: T-007-03
title: Add claim guards and read-only prompt
story: S-007
status: pending
priority: 0
complexity: L
depends_on:
  - T-007-02
output: tools/prompt.ts
---

# T-007-03: Add Claim Guards and Read-Only Prompt

## Objective

Separate task discovery from task claiming to prevent phantom claiming. Make `just prompt` read-only and require explicit `--accept` flag to claim a task.

## Current Problem

Every `just prompt` invocation claims the next ready task by editing task-graph.yaml. If something triggers prompt automatically (editor hooks, file watchers, etc.), tasks get claimed without any agent working on them.

## New Command Behavior

### `just prompt` (read-only)

Shows the next available task without claiming it:

```
Next available task:
  ID: T-007-01
  Title: Diagnose phantom task claiming
  Story: S-007
  Priority: 0
  Output: docs/knowledge/research/phantom-claiming.md

Run `just prompt --accept` to claim this task.
```

This is safe to run repeatedly - no state changes occur.

### `just prompt --accept`

Explicitly claims the task and outputs the full prompt:

1. Check guards (see below)
2. Update ticket frontmatter: `status: in-progress`, `claimed_at: <timestamp>`
3. Run `just dag-refresh` to sync task-graph.yaml
4. Write current task to `.ralph/current-task`
5. Output the full prompt for execution

### `just prompt --current`

Show the currently claimed task (if any) without claiming a new one. Useful for resuming interrupted work.

## Guards to Implement

### Single Task Guard

Check `.ralph/current-task` before accepting a new task:
- If file exists and contains a valid in-progress task, refuse to claim another
- Print message: "Already working on T-XXX-NN. Complete it or run `just task-reset T-XXX-NN` first."

### Story Filter Guard

If `WORKTREE_STORY` is set:
- Only consider tasks belonging to that story
- If no tasks available for that story, print helpful message

### Main Repo Guard

Detect if running from the main repo:
- Check if `.git` is a directory (main) vs file (worktree)
- Refuse to claim from main repo
- Print: "Cannot claim tasks from main repo. Use a worktree: `just worktree-new <name>`"

## Ticket Frontmatter Updates

When claiming, update the ticket file's frontmatter:

```yaml
---
id: T-007-01
title: Diagnose phantom task claiming
story: S-007
status: in-progress          # Changed from 'ready'
claimed_at: 2026-01-28T12:34:56Z  # Added
claimed_by: solar-sim-solar  # Added (worktree name)
priority: 0
complexity: M
depends_on: []
output: docs/knowledge/research/phantom-claiming.md
---
```

## `.ralph/current-task` Format

```json
{
  "task_id": "T-007-01",
  "claimed_at": "2026-01-28T12:34:56Z",
  "worktree": "solar-sim-solar",
  "ticket_path": "docs/active/tickets/T-007-01-diagnose-phantom-claiming.md"
}
```

Clear this file when:
- `just task-complete` succeeds
- `just task-reset` is called for this task

## Deliverable

Updated `tools/prompt.ts` with:
- Read-only default behavior
- `--accept` flag for explicit claiming
- `--current` flag for showing current task
- All three guards implemented
- Ticket frontmatter update logic

## Acceptance Criteria

- `just prompt` shows available work without changing any files
- `just prompt --accept` claims by updating ticket frontmatter
- Running `just prompt --accept` twice returns error (already have a task)
- Running from main repo produces an error
- WORKTREE_STORY filter is enforced
- `.ralph/current-task` tracks the active claim
