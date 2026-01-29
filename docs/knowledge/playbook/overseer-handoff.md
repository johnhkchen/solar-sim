# Overseer Agent Handoff

This document provides everything a new overseer agent needs to continue managing Solar-Sim development.

## Your Role

You are the overseer agent for Solar-Sim, a webapp that calculates sun hours for gardening. Your job is to:

1. **Plan sprints** - Create stories and tickets for new features
2. **Run the ralph loop** - Execute batches of tickets via `just ralph`
3. **Archive completed work** - Move finished stories/tickets to `docs/archive/`
4. **Maintain documentation** - Keep ROADMAP.md and research docs current
5. **Review and iterate** - After each sprint, assess results and plan the next

You do NOT implement tickets yourself. The ralph loop invokes Claude Code agents to do implementation work.

## Project State as of 2026-01-29

### What Solar-Sim Does Now

The app calculates sun exposure for any location on Earth. Users can:

1. Enter a location (address search, manual coordinates, or browser geolocation)
2. See today's sun hours and light category (full sun, part sun, etc.)
3. Add obstacles (trees, buildings, fences) via a blueprint/plan editor
4. See effective sun hours accounting for shade from obstacles
5. Share results via URL

### What's In Progress

**S-015 Climate Integration** is currently running (T-015-01 in progress). This adds:
- Frost date lookup (last spring frost, first fall frost)
- USDA hardiness zone display
- Growing season length calculation
- Timeline visualization

### What Comes Next

After S-015, the ROADMAP indicates:

**Phase 7: Combined Recommendations** - Merge shade and climate into plant advice
- Factor both shade and climate into suggestions
- Planting calendar based on frost dates
- Seasonal light condition views

**Phase 8: Polish & Launch** - Production readiness
- Mobile optimization
- Shareable URLs with preview metadata
- Documentation and help content

## Key Files to Read

Before planning work, read these files:

| File | Purpose |
|------|---------|
| `CLAUDE.md` | Project conventions, writing style, workflow commands |
| `docs/active/ROADMAP.md` | Current phase, completed phases, upcoming work |
| `docs/happy_path.md` | Target user experience (the north star) |
| `docs/knowledge/playbook/ralph-loop.md` | How to run the automated agent loop |
| `docs/knowledge/playbook/workflows.md` | Agent workflow patterns |
| `docs/knowledge/research/phase-6-shade-climate.md` | Research on shade and climate features |

## Workflow Commands

```bash
# Check current task status
just dag-status

# Preview next available task
just prompt

# Run automated sprint execution
RALPH_ALLOW_MAIN=1 WORKTREE_STORY=S-XXX just ralph

# Refresh DAG after creating/modifying tickets
just dag-refresh

# Run tests
npm test

# Run dev server
just dev
```

## Sprint Lifecycle

### 1. Planning Phase

Before creating tickets, do research:

1. **Identify the goal** - What user-facing capability are we adding?
2. **Create research ticket** - T-XXX-01 should answer technical questions
3. **Run research** - Let ralph execute the research ticket
4. **Review findings** - Read the research document output
5. **Create implementation tickets** - Based on research findings

### 2. Ticket Creation

Tickets go in `docs/active/tickets/` with this frontmatter:

```yaml
---
id: T-XXX-NN
title: Brief description
story: S-XXX
status: pending
priority: 1
complexity: S|M|L|XL
depends_on:
  - T-XXX-MM
output: path/to/expected/output
---
```

Each ticket has RPI sections:
- **Research** - Questions to answer or context to gather
- **Plan** - Approach to take
- **Implementation** - What to build

### 3. Execution Phase

Run the sprint:

```bash
RALPH_ALLOW_MAIN=1 WORKTREE_STORY=S-XXX just ralph
```

The loop will:
1. Claim the highest-priority ready ticket
2. Generate a prompt and pipe it to Claude Code
3. Wait for completion
4. Clear tracking state and continue to next ticket
5. Exit when no tickets remain

### 4. Review Phase

After sprint completes:

1. **Check outputs** - Verify expected files were created
2. **Run tests** - `npm test` to ensure nothing broke
3. **Test manually** - `just dev` and use the app
4. **Update ticket status** - Mark any incomplete tickets
5. **Archive** - Move completed story and tickets to `docs/archive/`

### 5. Archive Pattern

```bash
mkdir -p docs/archive/phase-N-name
mv docs/active/stories/S-XXX-*.md docs/archive/phase-N-name/
mv docs/active/tickets/T-XXX-*.md docs/archive/phase-N-name/
just dag-refresh
```

Then update ROADMAP.md to reflect the completed phase.

## Codebase Structure

```
src/
├── lib/
│   ├── solar/          # Sun position, sun hours, shade calculations
│   ├── geo/            # Coordinates, timezone, geocoding
│   ├── climate/        # Frost dates, hardiness zones (S-015)
│   ├── components/     # Svelte UI components
│   └── integration/    # Integration tests
├── routes/
│   ├── +page.svelte    # Home page with LocationInput
│   └── results/        # Results page with sun/shade data
tools/
├── dag.ts              # DAG parsing and refresh
├── prompt.ts           # Task claiming and prompt generation
├── ralph.sh            # Automated agent loop
└── audit.ts            # Audit logging
docs/
├── active/             # Current stories and tickets
├── archive/            # Completed work by phase
└── knowledge/          # Research, playbooks, requirements
```

## Common Patterns

### Creating a New Story

1. Create `docs/active/stories/S-XXX-name.md` with frontmatter
2. Create tickets in `docs/active/tickets/T-XXX-NN-name.md`
3. Run `just dag-refresh` to update the DAG
4. Run `just dag-status` to verify

### Research-First Approach

For non-trivial features:

1. **T-XXX-01**: Research ticket (output: research doc)
2. **T-XXX-02**: Types/interfaces (output: types.ts)
3. **T-XXX-03+**: Implementation tickets based on research

### Parallel Work Paths

When tickets have independent dependencies, they can run in parallel. The ralph loop processes one at a time, but you can structure the DAG so independent work streams don't block each other.

Example from S-014:
```
T-014-02 (types) ────→ T-014-03 (math) ────→ T-014-04 (integration)
                 ↘                      ↗
T-014-05 (research) → T-014-06 (UI) ──┘
```

### Asking User Questions

When planning requires user input, create a prompt that uses the AskUserQuestion tool:

```
Use the AskUserQuestion tool to validate:
1. Scope: Full MVP or incremental?
2. Approach: Option A vs Option B?
3. Priority: Feature X before or after Y?
```

## Milestones Tracking

The task-graph.yaml tracks milestones:

| ID | Title | Status |
|----|-------|--------|
| M1-M6 | Workflow tooling | Complete |
| M7 | Solar Engine | Complete |
| M8 | Location System | Complete |
| M9 | Application Integration | Complete |
| M10 | Shade Modeling | Complete |
| M11 | Climate Integration | In Progress |

## Troubleshooting

### Ralph loop exits immediately

Check for stale `.ralph/current-task` file:
```bash
rm -f .ralph/current-task
```

### DAG shows wrong status

Ticket frontmatter may not match task-graph.yaml. Run:
```bash
just dag-refresh
```

### Tests failing

Run `npm test` to see failures. Check if new code broke existing tests or if tests need updating for new features.

### Build errors

```bash
npm run build
```

Check for TypeScript errors or missing imports.

## Current Sprint Status

**S-015 Climate Integration** is in progress:

| Ticket | Title | Status |
|--------|-------|--------|
| T-015-01 | Research climate data sources | In Progress |
| T-015-02 | Add climate data types | Pending |
| T-015-03 | Implement frost date lookup | Pending |
| T-015-04 | Implement hardiness zone lookup | Pending |
| T-015-05 | Create growing season timeline | Pending |
| T-015-06 | Integrate into results page | Pending |

When T-015-01 completes, review `docs/knowledge/research/climate-data.md` before the remaining tickets execute.

## After S-015

1. Archive S-015 to `docs/archive/phase-7-climate/`
2. Update ROADMAP.md with Phase 7 complete
3. Plan S-016 for Combined Recommendations or Polish work
4. Consider user feedback on what's most valuable next

## Key Design Principles

1. **Research before implementation** - Answer technical questions first
2. **Small tickets** - Each ticket should be completable in one agent session
3. **Clear outputs** - Every ticket specifies an output path for verification
4. **Progressive enhancement** - Each sprint adds user-visible value
5. **Test coverage** - New features include tests

Good luck with the project!
