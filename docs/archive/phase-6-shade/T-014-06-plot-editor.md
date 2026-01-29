---
id: T-014-06
title: Build blueprint/plan view component
story: S-014
status: pending
priority: 1
complexity: L
depends_on: [T-014-02, T-014-05]
output: src/lib/components/PlotEditor.svelte
---

# T-014-06: Build Blueprint/Plan View Component

Create the interactive plot editor where users place obstacles on a visual representation of their yard.

## Research

T-014-05 produces detailed research on blueprint UI implementation. This ticket implements those recommendations. The component must handle coordinate systems, SVG rendering, and touch/mouse interactions.

## Plan

Create `src/lib/components/PlotEditor.svelte` with:

**Core Canvas**: SVG element with pannable, zoomable viewport. The observation point (sun measurement location) is at center. Grid lines show scale in meters. North indicator shows orientation.

**Obstacle Palette**: Sidebar or bottom sheet with obstacle presets from `OBSTACLE_PRESETS`. Users tap a preset to select it, then tap the canvas to place. Visual feedback shows the selected obstacle type.

**Obstacle Rendering**: Each placed obstacle renders as an SVG element appropriate to its type. Trees are circles with size based on canopy width. Buildings are rectangles. Fences are thick lines. Obstacles should have labels showing their name/type.

**Interaction Handlers**:
- Click/tap canvas: place selected obstacle at that location
- Click/tap existing obstacle: select it for editing
- Drag obstacle: reposition it
- Drag handles: resize obstacle
- Delete button: remove selected obstacle

**Data Binding**: Component exposes `obstacles: Obstacle[]` as a bindable prop. Parent components can read the obstacle list for shade calculations.

**Derived Values**: When user places an obstacle at (x, y) coordinates, calculate direction (degrees from north) and distance (meters from center) for the Obstacle data structure.

Create supporting components as needed: `ObstaclePalette.svelte`, `ObstacleShape.svelte`, `PlotGrid.svelte`.

## Implementation

Start with the simplest possible version: static SVG with clickable placement. Add pan/zoom and drag interactions incrementally. Use Svelte stores or context for shared state between sub-components.

Test the component manually by adding obstacles and verifying the output obstacle array has correct direction/distance values.

## Context Files

- `docs/knowledge/research/blueprint-ui.md` (implementation research from T-014-05)
- `src/lib/solar/shade-types.ts` (Obstacle interface, OBSTACLE_PRESETS)
- `src/lib/components/` (existing component patterns)
