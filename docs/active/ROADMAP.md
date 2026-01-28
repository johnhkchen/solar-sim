# Solar-Sim Roadmap

> **Last Updated**: 2026-01-28

This document tracks project status and planned work. For milestone details, see `docs/active/MILESTONES.md`.

---

## Current Phase: Application Features

Phase 1 (Foundation & Tooling) is complete. We're now building the core application features using two concurrent ralph loops in separate worktrees.

### Active Worktrees

Two worktrees are set up for parallel development. Each worktree handles one story independently, and work merges back to main via pull request.

| Worktree | Branch | Story | Focus |
|----------|--------|-------|-------|
| `solar-sim-solar` | `feature/solar` | S-005 | Solar calculation engine |
| `solar-sim-location` | `feature/location` | S-006 | Location input system |

### Running Concurrent Loops

Open two terminal windows and run each loop independently. They will process their respective R-P-I chains without conflicting since the stories touch different files.

```bash
# Terminal 1: Solar engine work
cd ../solar-sim-solar
just ralph

# Terminal 2: Location system work
cd ../solar-sim-location
just ralph
```

For detailed orchestration instructions, see `docs/knowledge/playbook/concurrent-ralph.md`.

---

## Active Stories

### S-005: Solar Calculation Engine

Implements sun position and sun hours calculations in `src/lib/solar/`.

| Task | Description | Status |
|------|-------------|--------|
| S-005-R | Research solar algorithms | Ready |
| S-005-P | Plan implementation | Pending |
| S-005-I | Implement engine | Pending |

### S-006: Location Input System

Implements geocoding, coordinates, and location UI in `src/lib/geo/` and `src/lib/components/`.

| Task | Description | Status |
|------|-------------|--------|
| S-006-R | Research geocoding options | Ready |
| S-006-P | Plan implementation | Pending |
| S-006-I | Implement system | Pending |

---

## Task Graph

```
READY NOW (parallel in separate worktrees):
├── S-005-R  Research solar algorithms      [P1] → solar-sim-solar
└── S-006-R  Research geocoding options     [P1] → solar-sim-location

PENDING (unblocks after research):
├── S-005-P  Plan solar engine
├── S-006-P  Plan location system

PENDING (unblocks after planning):
├── S-005-I  Implement solar engine
└── S-006-I  Implement location system
```

---

## Milestone Summary

### Phase 2: In Progress

| Milestone | Description | Status | Worktree |
|-----------|-------------|--------|----------|
| M7 | Solar Engine | Pending | solar-sim-solar |
| M8 | Location System | Pending | solar-sim-location |

### Phase 1: Complete

| Milestone | Description | Status |
|-----------|-------------|--------|
| M1 | DAG Introspection | Complete |
| M2 | Frontmatter Scanning | Complete |
| M3 | Basic Prompt | Complete |
| M4 | Task Lifecycle | Complete |
| M5 | Worktree Commands | Complete |
| M6 | Ralph Loop | Complete |

Phase 1 artifacts are archived in `docs/archive/phase-1-foundation/`.

---

## Upcoming Phases

### Phase 3: Integration

After M7 and M8 complete, integrate the solar engine with location input to produce the core user experience described in `docs/happy_path.md`.

### Phase 4: Visualization

Add sun path diagrams, seasonal heatmaps, and calendar views.

### Phase 5: Polish & Launch

Recommendations engine, shareable URLs, mobile optimization, and documentation.

---

## Quick Reference

**Check status**:
```bash
just dag-status
```

**Create worktrees** (if not already created):
```bash
just worktree-new solar
just worktree-new location
```

**Run loops**:
```bash
cd ../solar-sim-solar && just ralph
cd ../solar-sim-location && just ralph
```

**Monitor**:
```bash
just ralph-status   # in each worktree
just ralph-logs     # tail logs
```

**After PR merged, clean up**:
```bash
just worktree-remove solar
just worktree-remove location
```
