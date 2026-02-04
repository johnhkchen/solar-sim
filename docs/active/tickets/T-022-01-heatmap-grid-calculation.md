---
id: T-022-01
title: Grid-based sun exposure calculation
status: pending
priority: 1
complexity: L
depends_on: [T-022-00]
story: S-022
---

# T-022-01: Grid-Based Sun Exposure Calculation

## Objective

Extend the point-based sun-hours calculation to compute exposure across a grid of points, producing data suitable for heatmap rendering.

## Acceptance Criteria

1. Function accepts bounds (lat/lng box) and resolution (meters)
2. Returns grid of sun-hours values for each cell
3. Incorporates ShadeMap terrain/building data
4. Incorporates user-placed tree shadows
5. Supports configurable date range (start, end, sample interval)
6. Performance: <5s for typical residential lot at 2m resolution

## Technical Approach

```typescript
interface ExposureGrid {
  bounds: LatLngBounds;
  resolution: number; // meters per cell
  width: number;      // cells
  height: number;     // cells
  values: Float32Array; // sun-hours per cell, row-major
  dateRange: { start: Date; end: Date };
}

async function calculateExposureGrid(
  bounds: LatLngBounds,
  resolution: number,
  trees: TreeMarker[],
  dateRange: { start: Date; end: Date },
  sampleDays: number = 12  // e.g., 1st of each month in range
): Promise<ExposureGrid>
```

### Sampling Strategy

Rather than calculate every day, sample representative days:
- For growing season (6 months): sample 12-18 days
- Weight by day length (summer days count more)
- For each sample day, integrate sun position across daylight hours

### Parallelization

Consider using Web Workers for grid calculation to avoid blocking UI.

## Files to Create/Modify

- `src/lib/solar/exposure-grid.ts` - new module
- `src/lib/solar/combined-sun-hours.ts` - refactor for reuse
