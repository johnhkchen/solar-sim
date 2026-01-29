---
id: T-014-02
title: Add shade calculation type definitions
story: S-014
status: ready
priority: 1
complexity: S
depends_on: []
output: src/lib/solar/shade-types.ts
---

# T-014-02: Add Shade Calculation Type Definitions

Define TypeScript interfaces and types for the shade calculation system.

## Research

The research document in `docs/knowledge/research/phase-6-shade-climate.md` provides detailed interface definitions. The key types are Obstacle (representing a shadow-casting object), ShadeWindow (a time period when something blocks the sun), DailyShadeAnalysis (per-day results), and ShadeAnalysis (aggregated results).

Obstacle types include building, fence, evergreen-tree, deciduous-tree, and hedge. Each has different transparency values. For MVP, we use summer transparency only (no seasonal variation).

## Plan

Create `src/lib/solar/shade-types.ts` containing:

1. `ObstacleType` union type for the five obstacle categories
2. `Obstacle` interface with id, type, label, direction (degrees), distance (meters), height (meters), and width (meters)
3. `ObstaclePreset` interface and `OBSTACLE_PRESETS` constant array with common presets (6ft fence, 1/2/3-story house, small/medium/large/tall trees, hedge)
4. `getTransparency(type: ObstacleType): number` function returning summer transparency values (0 for opaque, 0.4 for trees, 0.3 for hedge)
5. `BlockingResult` interface with blocked boolean and shadeIntensity number
6. `ShadeWindow` interface for time periods when obstacles block sun
7. `DailyShadeAnalysis` interface for single-day results
8. `ShadeAnalysis` interface for aggregated results over a date range

Export all types from `src/lib/solar/index.ts`.

## Implementation

Follow the interfaces from the research document. Use JSDoc comments for all exports. Add unit tests in `src/lib/solar/shade-types.test.ts` verifying that presets have valid values and transparency function returns expected values for each type.

## Context Files

- `docs/knowledge/research/phase-6-shade-climate.md` (interface definitions in Deep Dive section)
- `src/lib/solar/types.ts` (existing type patterns to follow)
- `src/lib/solar/index.ts` (add exports here)
