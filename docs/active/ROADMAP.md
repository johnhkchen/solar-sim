# Solar-Sim Roadmap

> **Last Updated**: 2026-01-29

This document tracks project status and planned work.

---

## Current Phase: Full App Integration

S-018 (Enhanced Climate and Location) is complete. Now wiring together all components into a cohesive end-to-end user experience with PlotViewer integration, shade-adjusted recommendations, and mobile optimization.

### Completed Phases

**Phase 1: Foundation** built workflow tooling (DAG parsing, prompt generation, worktree commands). Archived in `docs/archive/phase-1-foundation/`.

**Phase 2: First Implementation** created initial solar and location code, revealed workflow bugs. Archived in `docs/archive/phase-2-false-start/`.

**Phase 3: Verification** confirmed solar engine (127 tests) and location system (79 tests) work correctly. Archived in `docs/archive/phase-3-verification/`.

**Phase 4-QA: Ralph Loop** tested single-agent execution end-to-end, fixed current-task clearing bug. Archived in `docs/archive/phase-4-qa/`.

**Phase 5: Application Integration** connected solar engine and location system to produce core user experience. Archived in `docs/archive/phase-5-integration/`.

**Phase 6: Shade Modeling** added obstacle input via blueprint/plan view, shadow intersection math, and effective sun hours calculation. Archived in `docs/archive/phase-6-shade/`.

**Phase 7: Climate Integration** added frost date lookup, hardiness zone calculation, and growing season timeline component. Archived in `docs/archive/phase-7-climate/`.

**Phase 8: Combined Recommendations** merged shade and climate into plant suggestions with planting calendar and seasonal light charts. Archived in `docs/archive/phase-8-recommendations/`.

**Phase 9: Isometric Landscape View** added terrain slope modeling, shadow polygon projection, isometric view component, and time scrubber for shadow animation. Archived in `docs/archive/phase-9-isometric-view/`.

**Phase 10: Enhanced Climate and Location** added Leaflet map picker, Open-Meteo historical weather API integration, Köppen climate classification with gardening notes, monthly temperature chart, and NOAA CPC seasonal outlooks. Archived in `docs/archive/phase-9-enhanced-climate/`.

---

## Active Story: S-019 Full App Integration

Wiring together all components into a cohesive end-to-end user experience. The PlotViewer (isometric view, shadow animation) and shade calculations exist but aren't connected to the results page.

### Key Goals

- Integrate PlotViewer into results page for obstacle/slope input
- Connect shade calculations to recommendations display
- End-to-end flow from location → obstacles → shade-adjusted results
- LocalStorage persistence for plot data
- Mobile-friendly layout

### Ticket Status

| Ticket | Title | Status | Depends On |
|--------|-------|--------|------------|
| T-019-01 | Research full app integration approach | Complete | — |
| T-019-02 | Integrate PlotViewer into results page | Ready | T-019-01 |
| T-019-03 | Connect shade calculations to recommendations | Pending | T-019-02 |
| T-019-04 | Calculate monthly shade data for seasonal chart | Pending | T-019-03 |
| T-019-05 | Add localStorage persistence for plot data | Pending | T-019-02 |
| T-019-06 | Optimize PlotViewer for mobile layout | Pending | T-019-02 |
| T-019-07 | Add integration tests for full flow | Pending | T-019-03, T-019-04, T-019-05 |

### Running the Sprint

```bash
RALPH_ALLOW_MAIN=1 WORKTREE_STORY=S-019 just ralph
```

---

## Upcoming Phase

### Phase 11: Polish & Launch

- Mobile optimization
- Shareable URLs with preview metadata
- Documentation and help content

---

## Overseer Handoff

For new overseer agents continuing this project, see `docs/knowledge/playbook/overseer-handoff.md` for comprehensive onboarding.

---

## Quick Reference

**Check status**:
```bash
just dag-status
```

**Run sprint**:
```bash
RALPH_ALLOW_MAIN=1 WORKTREE_STORY=S-XXX just ralph
```

**Preview next task**:
```bash
just prompt
```

**Refresh DAG from tickets**:
```bash
just dag-refresh
```

See `docs/knowledge/playbook/ralph-loop.md` for detailed ralph loop instructions.
