# Solar-Sim Roadmap

> **Last Updated**: 2026-01-28

A human-readable dashboard of project status and planned work.

---

## Current Phase: Application Features

The foundation and tooling phase is complete. We're now building the core application features using concurrent ralph loops in separate worktrees.

### Active Worktrees

| Worktree | Branch | Story | Focus |
|----------|--------|-------|-------|
| `solar-sim-solar` | `feature/solar` | S-005 | Solar calculation engine |
| `solar-sim-location` | `feature/location` | S-006 | Location input system |

To run concurrent loops, open two terminals:
```bash
# Terminal 1
cd ../solar-sim-solar && just ralph

# Terminal 2
cd ../solar-sim-location && just ralph
```

---

## Milestones

### Phase 1: Foundation (Complete)

| Milestone | Description | Status |
|-----------|-------------|--------|
| **M1** | DAG Introspection | Complete |
| **M2** | Frontmatter Scanning | Complete |
| **M3** | Basic Prompt | Complete |
| **M4** | Task Lifecycle | Complete |
| **M5** | Worktree Commands | Complete |
| **M6** | Ralph Loop | Complete |

### Phase 2: Application Features (In Progress)

| Milestone | Description | Status | Worktree |
|-----------|-------------|--------|----------|
| **M7** | Solar Engine | Pending | `solar-sim-solar` |
| **M8** | Location System | Pending | `solar-sim-location` |

---

## Active Stories

### S-005: Solar Calculation Engine (M7)
**Goal**: Accurate sun position and sun hours calculations

| Task | Description | Status |
|------|-------------|--------|
| **S-005-R** | Research solar algorithms | READY |
| S-005-P | Plan implementation | Pending |
| S-005-I | Implement engine | Pending |

### S-006: Location Input System (M8)
**Goal**: Geocoding, coordinates, and location UI

| Task | Description | Status |
|------|-------------|--------|
| **S-006-R** | Research geocoding options | READY |
| S-006-P | Plan implementation | Pending |
| S-006-I | Implement system | Pending |

---

## Task Graph Summary

```
READY NOW (parallel in separate worktrees):
├── S-005-R  Research solar algorithms    [P1] → M7 (solar-sim-solar)
└── S-006-R  Research geocoding options   [P1] → M8 (solar-sim-location)

PENDING:
├── S-005-P  Plan solar engine (needs S-005-R)
├── S-005-I  Implement solar engine (needs S-005-P)
├── S-006-P  Plan location system (needs S-006-R)
└── S-006-I  Implement location system (needs S-006-P)
```

---

## Completed Work

### Phase 1 Stories (Archived)

All phase 1 stories have been moved to `docs/archive/phase-1-foundation/`:

| ID | Title | Milestone |
|----|-------|-----------|
| S-001 | Ralph Loop Integration | M6 |
| S-002 | DAG Parsing & Prompts | M1-M4 |
| S-003 | Git Worktree Workflow | M5 |
| S-004 | SvelteKit Scaffolding | — |

---

## Upcoming Work

### Phase 3: Integration
After M7 and M8 complete:
- Connect solar engine to location input
- Build results display component
- Create sun path visualization
- Implement seasonal overview

### Phase 4: Polish & Launch
- Recommendations engine
- Shareable URLs
- Mobile optimization
- Documentation and landing page

---

## Quick Reference

**Check status**:
```bash
just dag-status
```

**Run concurrent loops**:
```bash
# From main worktree, create worktrees if needed:
just worktree-new solar
just worktree-new location

# Then run loops in separate terminals
cd ../solar-sim-solar && just ralph
cd ../solar-sim-location && just ralph
```

**Monitor loops**:
```bash
# From each worktree
just ralph-status
just ralph-logs
```

**Merge completed work**:
```bash
# From worktree, after task complete:
git push -u origin feature/<name>
gh pr create

# From main, after PR merged:
just worktree-remove <name>
```

See `docs/knowledge/playbook/concurrent-ralph.md` for detailed orchestration guide.
