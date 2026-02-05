---
id: T-022-06
title: Isometric view heatmap
status: complete
priority: 4
complexity: M
depends_on: [T-022-02]
story: S-022
completed_at: 2026-02-01
---

# T-022-06: Isometric View Heatmap

## Objective

Display the sun exposure heatmap in the isometric 3D view, projected onto the ground plane.

## Acceptance Criteria

1. Heatmap visible as ground coloring in isometric view
2. Same color scale as map view
3. Trees and their shadows render on top of heatmap
4. Toggle between "shadow view" (current) and "exposure heatmap view"
5. Color intensity readable despite isometric projection

## Technical Approach

The isometric view already renders a ground plane. Instead of solid color:
1. Divide ground into grid cells matching exposure data
2. Fill each cell with color based on sun-hours value
3. Apply isometric transform to grid

### SVG Implementation

```svelte
{#each gridCells as cell}
  {@const corners = cell.corners.map(c => toIso(c.x, c.y, 0))}
  <polygon
    points={pointsString(corners)}
    fill={getExposureColor(cell.value)}
    fill-opacity="0.7"
  />
{/each}
```

### Considerations

- Grid resolution may need to be coarser for isometric (fewer cells visible)
- Consider showing heatmap only, or heatmap + current shadows as overlay
- May need separate "analysis mode" vs "time-of-day mode" toggle

## Files to Modify

- `src/lib/components/IsometricView.svelte` - add heatmap rendering
- Share exposure grid data with map view

## Implementation Summary

The IsometricView component now accepts an optional `exposureGrid` prop and a `displayMode` prop that toggles between 'shadows' (real-time shadow visualization) and 'heatmap' (aggregated sun exposure). When in heatmap mode, the component converts the exposure grid's lat/lng cells to world coordinates (meters from center), then projects them through the isometric transformation to render colored polygons on the ground plane. The same color scale from ExposureHeatmap is used for consistency. A legend overlay shows the color scale and category labels when the heatmap is visible. The toolbar includes a toggle button to switch between shadow and heatmap views when an exposure grid is provided.
