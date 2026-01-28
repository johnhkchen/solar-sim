# Active Milestones

> **Last Updated**: 2026-01-28

This document tracks milestones for the current phase. Completed phase milestones are archived in `docs/archive/`.

---

## Phase 2: Application Features

Two parallel work streams building the core application functionality.

### M7: Solar Engine

**Goal**: Accurate sun position and sun hours calculations in `src/lib/solar/`.

**Status**: Pending (worktree: `solar-sim-solar`)

**Success Criteria**:
- Sun position calculator returns altitude and azimuth for any location, date, and time
- Sun hours integrator computes total daily sun exposure
- Seasonal aggregator produces averages across date ranges
- Light category classifier maps hours to full sun, part sun, part shade, and full shade
- Unit tests pass for standard locations like Portland in summer and winter
- Edge case tests pass for Arctic Circle during solstices
- Performance benchmark shows sub-100ms for calculating a full year of daily sun hours

**Tasks**:
- S-005-R: Research solar calculation algorithms
- S-005-P: Plan solar engine implementation
- S-005-I: Implement solar calculation engine

---

### M8: Location System

**Goal**: Geocoding, coordinate handling, and location input UI in `src/lib/geo/` and `src/lib/components/`.

**Status**: Pending (worktree: `solar-sim-location`)

**Success Criteria**:
- Address geocoding converts place names to coordinates
- Coordinate validation handles multiple input formats
- Timezone detection infers correct timezone from coordinates
- Location input component provides autocomplete and validation feedback
- Browser geolocation works when user grants permission
- System degrades gracefully when geocoding unavailable, allowing manual coordinate entry
- Integration tests verify the full flow from address input to validated coordinates

**Tasks**:
- S-006-R: Research location and geocoding options
- S-006-P: Plan location system implementation
- S-006-I: Implement location input system

---

## Completed Phases

### Phase 1: Foundation & Tooling (Complete)

All six milestones delivered the multi-agent workflow infrastructure. See `docs/archive/phase-1-foundation/MILESTONES.md` for detailed criteria.

| Milestone | Description | Deliverable |
|-----------|-------------|-------------|
| M1 | DAG Introspection | `just dag-status` |
| M2 | Frontmatter Scanning | `just dag-refresh` |
| M3 | Basic Prompt | `just prompt` |
| M4 | Task Lifecycle | `just task-complete`, `just task-reset` |
| M5 | Worktree Commands | `just worktree-*` |
| M6 | Ralph Loop | `just ralph` |

---

## Upcoming Milestones

These milestones will be defined after M7 and M8 complete.

### M9: Results Display (Future)

Connect solar engine to location input and display results to users.

### M10: Visualization (Future)

Sun path diagram, seasonal heatmap, and other visual representations.

### M11: Recommendations (Future)

Plant suggestions based on light category classification.
