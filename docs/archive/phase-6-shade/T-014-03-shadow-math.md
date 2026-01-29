---
id: T-014-03
title: Implement shadow intersection math
story: S-014
status: pending
priority: 1
complexity: M
depends_on: [T-014-02]
output: src/lib/solar/shade.ts
---

# T-014-03: Implement Shadow Intersection Math

Build the core shadow calculation functions that determine when obstacles block the sun.

## Research

The research document provides working TypeScript code for the intersection test. An obstacle blocks the sun when two conditions are met: the sun's altitude is below the obstacle's angular height as seen from the observation point, and the sun's azimuth falls within the obstacle's angular span.

The angular height is `atan(height / distance)` and the angular half-width is `atan((width / 2) / distance)`. The math is straightforward trigonometry with angle normalization to handle wraparound at 360 degrees.

Performance analysis shows that 1 million intersection tests complete in under 100ms on modern hardware, so no optimization is needed for MVP.

## Plan

Create `src/lib/solar/shade.ts` containing:

1. `normalizeAngle(angle: number): number` - wraps angle to 0-360 range
2. `angularDifference(a: number, b: number): number` - shortest angular distance between two bearings
3. `isBlocked(sun: SolarPosition, obstacle: Obstacle): BlockingResult` - tests if a single obstacle blocks the sun at a given position
4. `calculateEffectiveSunlight(sun: SolarPosition, obstacles: Obstacle[]): number` - returns 0-1 multiplier representing how much sunlight gets through all obstacles

The `isBlocked` function handles: sun below horizon (not blocked), sun higher than obstacle's angular height (not blocked), sun outside obstacle's azimuth span (not blocked), and sun behind obstacle (blocked with intensity based on transparency).

Export from `src/lib/solar/index.ts`.

## Implementation

Use the code from the research document as a starting point. Add comprehensive unit tests in `src/lib/solar/shade.test.ts` covering edge cases like obstacles at north (0/360 wraparound), multiple overlapping obstacles, and partial transparency.

Test cases should include: sun clearly not blocked (wrong direction), sun clearly blocked (directly behind opaque obstacle), sun at obstacle edge (boundary cases), and semi-transparent obstacles (verify intensity calculation).

## Context Files

- `docs/knowledge/research/phase-6-shade-climate.md` (code in Deep Dive section)
- `src/lib/solar/position.ts` (SolarPosition type)
- `src/lib/solar/shade-types.ts` (Obstacle, BlockingResult types from T-014-02)
