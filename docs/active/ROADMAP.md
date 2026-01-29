# Solar-Sim Roadmap

> **Last Updated**: 2026-01-29

This document tracks project status and planned work.

---

## Current Phase: Combined Recommendations

Climate integration is complete. Users can see frost dates, hardiness zones, and a growing season timeline. Now we're adding the recommendation engine that combines shade and climate data into plant suggestions.

### Completed Phases

**Phase 1: Foundation** built workflow tooling (DAG parsing, prompt generation, worktree commands). Archived in `docs/archive/phase-1-foundation/`.

**Phase 2: First Implementation** created initial solar and location code, revealed workflow bugs. Archived in `docs/archive/phase-2-false-start/`.

**Phase 3: Verification** confirmed solar engine (127 tests) and location system (79 tests) work correctly. Archived in `docs/archive/phase-3-verification/`.

**Phase 4-QA: Ralph Loop** tested single-agent execution end-to-end, fixed current-task clearing bug. Archived in `docs/archive/phase-4-qa/`.

**Phase 5: Application Integration** connected solar engine and location system to produce core user experience. Archived in `docs/archive/phase-5-integration/`.

**Phase 6: Shade Modeling** added obstacle input via blueprint/plan view, shadow intersection math, and effective sun hours calculation. Archived in `docs/archive/phase-6-shade/`.

**Phase 7: Climate Integration** added frost date lookup, hardiness zone calculation, and growing season timeline component. Archived in `docs/archive/phase-7-climate/`.

---

## Active Story: S-016 Combined Recommendations

Merging shade and climate data into unified plant recommendations with planting calendar and seasonal views.

### Ticket Status

| Ticket | Title | Status | Depends On |
|--------|-------|--------|------------|
| T-016-01 | Research plant recommendations | Ready | — |
| T-016-02 | Add plant types | Pending | T-016-01 |
| T-016-03 | Create plant database | Pending | T-016-02 |
| T-016-04 | Implement recommendation engine | Pending | T-016-02 |
| T-016-05 | Create recommendations component | Pending | T-016-04 |
| T-016-06 | Create planting calendar | Pending | T-016-04 |
| T-016-07 | Create seasonal light chart | Pending | T-016-04 |
| T-016-08 | Results page integration | Pending | T-016-05, T-016-06, T-016-07 |

### Running the Sprint

```bash
RALPH_ALLOW_MAIN=1 WORKTREE_STORY=S-016 just ralph
```

---

## Upcoming Phases

### Phase 8: Polish & Launch

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
