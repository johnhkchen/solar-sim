---
id: T-017-02
title: Add slope data types and calculations
story: S-017
status: pending
priority: 1
complexity: S
depends_on:
  - T-017-01
output: src/lib/solar/slope.ts
---

# T-017-02: Add Slope Data Types and Calculations

Define TypeScript interfaces for terrain slope and implement slope-adjusted sun calculations.

## Task

Create `src/lib/solar/slope.ts` with types for representing plot slope and functions for calculating effective sun angles on sloped terrain.

## Expected Types

Based on research, we likely need:

- `PlotSlope` - angle in degrees (0-30) and direction as compass bearing
- `SlopeAdjustedSunPosition` - sun position modified for slope
- Helper functions for slope math

## Expected Functions

- `adjustSunForSlope(sun: SunPosition, slope: PlotSlope): SunPosition` - Returns effective sun position accounting for slope tilt
- `calculateEffectiveSunHoursWithSlope(...)` - Integrates sun hours with slope adjustment

## Acceptance Criteria

Types compile without errors. Functions pass unit tests for known slope/sun combinations. The San Francisco south-facing hill example from research produces expected results.
