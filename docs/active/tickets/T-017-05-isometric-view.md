---
id: T-017-05
title: Build isometric view component
story: S-017
status: pending
priority: 1
complexity: L
depends_on:
  - T-017-03
  - T-017-04
output: src/lib/components/IsometricView.svelte
---

# T-017-05: Build Isometric View Component

Create a read-only isometric visualization of the plot showing obstacles with heights and shadow zones.

## Task

Create `src/lib/components/IsometricView.svelte` that renders the same plot data as PlotEditor but in an isometric projection showing the pseudo-3D scene.

## Visual Elements

- **Ground plane**: Tilted rectangle showing the plot area, with slope visible as surface angle
- **Obstacles**: Rendered with height - trees as cones/spheres on trunks, buildings as extruded rectangles
- **Shadows**: Semi-transparent polygons on ground plane showing shade zones
- **Observation point**: Marker showing the user's viewpoint
- **Compass**: North indicator adjusted for isometric angle

## Props

- `obstacles: PlotObstacle[]` - Same data as PlotEditor
- `slope: PlotSlope` - Terrain slope
- `shadows: ShadowPolygon[]` - Pre-calculated shadow shapes
- `sunPosition: SunPosition` - Current sun position for lighting hints

## Rendering Approach

Use SVG with manual isometric coordinate transformation. The transform converts (x, y, z) world coordinates to (screenX, screenY) using standard isometric projection formulas. Obstacles render back-to-front for correct overlap.

## Acceptance Criteria

Isometric view shows the plot from an elevated angle. Obstacle heights are visually apparent. Sloped terrain appears as a tilted ground plane. Shadows appear as semi-transparent zones on the ground. View is read-only (no editing interactions).
