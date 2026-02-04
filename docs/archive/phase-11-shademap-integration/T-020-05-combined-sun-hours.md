---
id: T-020-05
title: Combined sun-hours calculation
status: complete
priority: 3
complexity: L
depends_on: [T-020-03, T-020-04]
story: S-020
---

# T-020-05: Combined Sun-Hours Calculation

## Objective

Calculate total effective sun hours at the observation point by combining ShadeMap's terrain/building data with our tree shadow calculations.

## Acceptance Criteria

1. Query ShadeMap API for base sun hours at observation point
2. Calculate additional shade time from user-placed trees
3. Display combined effective sun hours
4. Show breakdown: "X hours base - Y hours tree shade = Z effective"
5. Calculation works for single day and growing season average

## Technical Approach

Two approaches to evaluate:

**Option A**: Query ShadeMap for sun exposure, then subtract tree-shaded intervals using our shade-window math.

**Option B**: Sample time intervals through the day, check both ShadeMap shade status and tree shadow intersection, integrate.

Start with Option A if ShadeMap API provides sun-hours directly. Fall back to Option B if we need more control.

## Files to Modify

- `src/lib/solar/sun-hours.ts` - add combined calculation
- New ShadeMap API adapter module
- Results display component

## Open Questions

- Does ShadeMap API return sun-hours or just current shadow status?
- What's the API latency? Acceptable for interactive updates?
