---
id: T-020-02
title: Tree placement on map
status: complete
priority: 2
complexity: M
depends_on: [T-020-01]
story: S-020
---

# T-020-02: Tree Placement on Map

## Objective

Allow users to place trees directly on the Leaflet map as draggable markers, with configuration for tree type, height, and canopy width.

## Acceptance Criteria

1. User can click map to place a tree marker
2. Tree markers are draggable to reposition
3. Clicking a tree opens a config panel (type, height, width)
4. Tree types: deciduous, evergreen (reuse existing definitions)
5. Trees persist in component state (localStorage comes later)
6. Delete option for placed trees

## Technical Approach

Use Leaflet markers with custom icons for trees. On marker click, show a popup or side panel with configuration options. Store trees as an array of objects with lat/lng, type, height, width.

## Files to Create/Modify

- `src/lib/components/TreeMarker.svelte` - new component
- `src/lib/components/TreeConfigPanel.svelte` - new component
- Map component - add tree layer and placement handlers

## Notes

Coordinate system shifts from meters-from-origin (PlotEditor) to lat/lng. The shadow calculation will need to convert between these.
