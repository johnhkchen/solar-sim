---
id: T-014-01
title: Deep research on shade modeling
story: S-014
status: complete
priority: 1
complexity: L
depends_on: []
output: docs/knowledge/research/phase-6-shade-climate.md
---

# T-014-01: Deep Research on Shade Modeling

Conduct detailed research on shade modeling to inform implementation tickets.

## Task

Update `docs/knowledge/research/phase-6-shade-climate.md` with a new "## Deep Dive: Shade Modeling" section containing concrete technical findings.

## Research Questions

**R1: Shadow Geometry Math**
- Given sun altitude and azimuth, how do we calculate shadow length and direction?
- What's the intersection test for "does obstacle X block the sun from point P at time T"?
- Write pseudocode or actual TypeScript for the core shadow calculation.

**R2: Obstacle Data Model**
- What's the minimum data needed to represent useful obstacles?
- How do we handle different obstacle types (solid building vs semi-transparent tree canopy)?
- Should we model obstacles as points, lines, or polygons?
- Propose TypeScript interfaces for `Obstacle` and `ShadeAnalysis`.

**R3: Performance Constraints**
- How many sun position samples per day are needed for accurate shade calculation?
- If we check 100 obstacles × 365 days × N samples/day, what's the compute cost?
- What caching or optimization strategies make this feasible in-browser?

**R4: User Input UX**
- How do users describe "there's a big tree to the southwest"?
- What presets would cover 80% of common obstacles?
- Sketch a minimal UI flow for adding one obstacle.

**R5: Output Visualization**
- How do we show "you lose 3 hours of afternoon sun due to the oak tree"?
- Should we show a shade map, a timeline, or both?
- What's the single most useful number or visual to display?

## Deliverable

Add a "## Deep Dive: Shade Modeling" section to the research document with:

1. Shadow geometry math with TypeScript code snippets
2. Proposed `Obstacle` and `ShadeAnalysis` interfaces
3. Performance analysis with recommended sample rate
4. UX recommendation for obstacle input
5. Visualization recommendation

## Context Files

Read these before starting:
- `CLAUDE.md` (project conventions, especially writing style)
- `docs/knowledge/research/phase-6-shade-climate.md` (initial research to expand)
- `docs/happy_path.md` (target user experience)
- `src/lib/solar/position.ts` (existing sun position calculations)

## Notes

This is research only. Do NOT create implementation tickets. Findings will inform a follow-up planning session.
