---
id: T-014-04
title: Create shade-aware sun hours integration
story: S-014
status: pending
priority: 1
complexity: M
depends_on: [T-014-03]
output: src/lib/solar/sun-hours-shade.ts
---

# T-014-04: Create Shade-Aware Sun Hours Integration

Wrap the existing sun hours calculation to account for obstacle shading.

## Research

The existing `getDailySunHours()` function samples sun position throughout the day and integrates exposure time. The shade-aware version applies the `calculateEffectiveSunlight()` multiplier at each sample point to reduce credited sun hours when obstacles block the sun.

The research document notes that 5-minute sampling intervals (288 samples/day) provide accurate results. Since we already use this interval, no change to sample rate is needed.

## Plan

Create `src/lib/solar/sun-hours-shade.ts` containing:

1. `getDailySunHoursWithShade(coords: Coordinates, date: Date, obstacles: Obstacle[]): DailySunData & { effectiveHours: number, percentBlocked: number }` - extends existing DailySunData with shade-adjusted values

2. `calculateDailyShadeAnalysis(coords: Coordinates, date: Date, obstacles: Obstacle[]): DailyShadeAnalysis` - full analysis including shade windows (when each obstacle blocks the sun)

3. `getSeasonalSummaryWithShade(coords: Coordinates, startDate: Date, endDate: Date, obstacles: Obstacle[]): ShadeAnalysis` - aggregated analysis over a date range

The integration approach: for each time sample, get sun position, calculate effective sunlight multiplier, accumulate weighted sun hours. Track shade windows by detecting transitions from unblocked to blocked and back.

Export from `src/lib/solar/index.ts`.

## Implementation

The `getDailySunHoursWithShade` function should internally call the existing sun position sampling logic and apply shade calculations. Avoid code duplication by reusing helper functions from `sun-hours.ts`.

Add integration tests in `src/lib/solar/sun-hours-shade.test.ts` verifying: location with no obstacles returns same hours as baseline, opaque obstacle in sun's path significantly reduces hours, and obstacle in opposite direction has no effect.

For shade window detection, compare consecutive samples. When `calculateEffectiveSunlight` transitions from 1 to <1, start a window. When it returns to 1, close the window.

## Context Files

- `src/lib/solar/sun-hours.ts` (existing calculation to wrap)
- `src/lib/solar/shade.ts` (intersection functions from T-014-03)
- `docs/knowledge/research/phase-6-shade-climate.md` (DailyShadeAnalysis interface)
