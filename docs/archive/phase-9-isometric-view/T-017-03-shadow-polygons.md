---
id: T-017-03
title: Implement shadow polygon calculation
story: S-017
status: pending
priority: 1
complexity: M
depends_on:
  - T-017-02
output: src/lib/solar/shadow-projection.ts
---

# T-017-03: Implement Shadow Polygon Calculation

Calculate shadow shapes cast by obstacles onto the ground plane for visualization.

## Task

Create `src/lib/solar/shadow-projection.ts` with functions to compute shadow polygons for each obstacle type given sun position and terrain slope.

## Expected Functions

- `calculateShadowPolygon(obstacle: Obstacle, sun: SunPosition, slope?: PlotSlope): Point[]` - Returns polygon vertices for the shadow cast by an obstacle
- `calculateAllShadows(obstacles: Obstacle[], sun: SunPosition, slope?: PlotSlope): ShadowPolygon[]` - Batch calculation for all obstacles

## Shadow Shapes by Obstacle Type

- **Tree (circle)**: Elliptical shadow stretched along sun direction
- **Building (rect)**: Quadrilateral shadow, possibly with perspective distortion
- **Fence (line)**: Narrow parallelogram shadow

## Acceptance Criteria

Shadow polygons correctly represent obstacle shapes projected by sun direction. Shadows lengthen at low sun angles. Slope adjustment distorts shadows appropriately. Unit tests verify shadow dimensions for known sun positions.
