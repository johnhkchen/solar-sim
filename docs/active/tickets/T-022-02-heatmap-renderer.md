---
id: T-022-02
title: Heatmap rendering layer
status: pending
priority: 2
complexity: M
depends_on: [T-022-01]
story: S-022
---

# T-022-02: Heatmap Rendering Layer

## Objective

Render the exposure grid as a color-coded heatmap overlay on the Leaflet map.

## Acceptance Criteria

1. Heatmap renders as semi-transparent overlay on map
2. Colors map to sun-hours using horticultural categories
3. Smooth gradient or cell-based rendering (evaluate both)
4. Legend shows color scale with hour values
5. Updates when grid data changes (tree moved, period changed)
6. Toggle to show/hide heatmap layer

## Color Scale

Based on horticultural light categories:
- Full sun (≥6 hrs): `#ff6b35` (orange-red)
- Part sun (4-6 hrs): `#f7c948` (yellow)
- Part shade (2-4 hrs): `#7bc47f` (light green)
- Full shade (<2 hrs): `#4a90d9` (blue)

Use continuous gradient interpolation between thresholds.

## Technical Approach

### Option A: Canvas Overlay

Render grid to canvas, position as Leaflet image overlay.
- Pros: Fast rendering, smooth gradients
- Cons: Manual coordinate transform, redraw on zoom

### Option B: Leaflet.heat Plugin

Use existing heatmap library with our data points.
- Pros: Built-in zoom handling, proven
- Cons: May not support discrete grid cells well

### Option C: SVG Grid

Render cells as SVG rectangles with fill colors.
- Pros: Clean, scalable, easy to style
- Cons: May be slow with many cells

**Recommended**: Start with Option A (canvas) for performance.

## Files to Create/Modify

- `src/lib/components/ExposureHeatmap.svelte` - new component
- CSS for legend styling
