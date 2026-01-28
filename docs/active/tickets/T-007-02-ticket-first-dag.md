---
id: T-007-02
title: Implement ticket-first DAG generation
story: S-007
status: pending
priority: 0
complexity: L
depends_on:
  - T-007-01
output: tools/dag.ts
---

# T-007-02: Implement Ticket-First DAG Generation

## Objective

Make ticket markdown files the source of truth. Refactor `just dag-refresh` to generate the nodes section of task-graph.yaml from ticket frontmatter.

## Core Principle

**Tickets are authoritative. YAML is derived.**

Before: Agents edit task-graph.yaml directly → errors, desync, phantom claims
After: Agents edit ticket frontmatter → dag-refresh regenerates YAML → consistent state

## Ticket Frontmatter Schema

Each ticket in `docs/active/tickets/*.md` must have this frontmatter:

```yaml
---
id: T-XXX-NN              # Required. Format: T-{story}-{sequence}
title: Short description   # Required. Under 80 chars
story: S-XXX               # Required. Parent story ID
status: ready              # Required. One of: ready, pending, in-progress, complete
priority: 0                # Required. 0 = highest, 5 = lowest
complexity: M              # Required. S, M, L, or XL
depends_on:                # Optional. List of task IDs this depends on
  - T-XXX-NN
output: path/to/file       # Optional. Expected deliverable path
claimed_at: 2026-01-28...  # Optional. Set by prompt --accept
claimed_by: worktree-name  # Optional. Set by prompt --accept
completed_at: 2026-01-28...# Optional. Set by task-complete
---
```

## DAG Refresh Behavior

The `just dag-refresh` command will:

1. **Scan tickets**: Find all `docs/active/tickets/*.md` files
2. **Extract frontmatter**: Parse YAML between `---` delimiters
3. **Validate schema**: Check required fields, report errors
4. **Compute readiness**: Task is ready if status=ready/pending AND all depends_on are complete
5. **Generate nodes**: Create nodes section from ticket data
6. **Generate edges**: Create edges section from depends_on fields
7. **Preserve stories**: Keep the stories section unchanged (still manually maintained)
8. **Preserve milestones**: Keep the milestones section unchanged
9. **Update meta**: Recalculate counts
10. **Write YAML**: Overwrite task-graph.yaml

## Node Generation

For each ticket, generate a node:

```yaml
- id: T-007-01
  title: Diagnose phantom task claiming
  story: S-007
  priority: 0
  complexity: M
  status: ready
  output: docs/knowledge/research/phantom-claiming.md
  path: docs/active/tickets/T-007-01-diagnose-phantom-claiming.md
```

Note: `description` field comes from the ticket body (first ## section after frontmatter), not frontmatter.

## Edge Generation

For each ticket with `depends_on`, generate edges:

```yaml
# If T-007-02 depends_on: [T-007-01]
- from: T-007-01
  to: T-007-02
```

## Readiness Computation

A task's effective status is computed, not just copied from frontmatter:
- If frontmatter says `complete` → status is `complete`
- If frontmatter says `in-progress` → status is `in-progress`
- If frontmatter says `ready` or `pending`:
  - If all depends_on tasks are complete → status is `ready`
  - Otherwise → status is `pending`

This means agents can set `status: ready` in frontmatter, and the actual readiness depends on dependency completion.

## Error Handling

Report errors for:
- Missing required fields
- Invalid status values
- Invalid priority values (not 0-5)
- Invalid complexity values (not S/M/L/XL)
- References to non-existent dependencies
- Duplicate task IDs

Print all errors at once, don't fail on first error.

## Deliverable

Updated `tools/dag.ts` with refactored `refresh` command that:
- Scans ticket files
- Parses frontmatter
- Validates schema
- Generates nodes and edges
- Preserves stories/milestones
- Updates meta counts

## Acceptance Criteria

- Running `just dag-refresh` regenerates nodes from ticket files
- Adding a new ticket file and running refresh adds it to the DAG
- Changing ticket frontmatter and running refresh updates the DAG
- Manual edits to nodes section are overwritten on refresh
- Stories and milestones sections are preserved
- Meta counts are accurate after refresh
- Invalid tickets produce clear error messages
