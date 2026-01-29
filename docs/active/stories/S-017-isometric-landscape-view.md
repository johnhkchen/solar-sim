---
id: S-017
title: Isometric Landscape View with Slope
status: draft
priority: 1
depends_on:
  - S-016
---

# S-017: Isometric Landscape View with Slope

This story adds terrain slope modeling and an isometric visualization mode that shows the garden with shade zones, enabling users to understand how hills and obstacles interact to create light and shadow patterns.

## Context

The current PlotEditor works on a flat plane, which doesn't capture real-world scenarios like a south-facing hillside garden. A south-facing slope in a place like San Francisco receives more direct winter sun than flat ground because the terrain tilts toward the sun. Conversely, a north-facing slope gets less. Users with sloped properties need this factor in their sun calculations.

Beyond slope, users benefit from seeing their garden in a pseudo-3D isometric view that shows obstacle heights and shadow zones. The plan view is good for editing positions, but an isometric view helps users understand the spatial relationships and see where shadows actually fall.

## Target Scenario

A gardener in San Francisco has a south-facing hillside plot with a large oak tree on the west side. They want to understand how the slope affects their growing conditions and see where the tree's shadow falls throughout the day. The app should let them define the slope, place the tree, and visualize shade zones in both plan and isometric views.

## Goals

**Slope modeling** lets users define their plot's incline with a simple angle and direction input. A 15-degree slope facing south means the ground tilts 15 degrees toward due south. The shade calculations adjust for this tilt so sun hours reflect the actual angle of incidence.

**Isometric view mode** provides a read-only visualization showing the plot from an elevated angle. Obstacles appear with their true heights visible. The ground plane shows the slope as a tilted surface. This view is for understanding, not editing - users switch back to plan view to modify obstacles.

**Shadow zone visualization** projects shadows onto the terrain based on sun position. A time scrubber lets users drag through the day to see shadows animate across the plot. Shadow zones use semi-transparent overlays to show where and when shade occurs.

## Implementation Approach

Start with research to determine the math for slope-adjusted sun angles and shadow projection onto inclined surfaces. The existing shade calculation treats the ground as horizontal, so we need to modify either the sun altitude calculation or the shadow projection to account for slope.

For isometric rendering, use SVG transforms rather than CSS 3D to maintain consistency with the existing SVG-based PlotEditor. The isometric projection is a 2D skew that simulates 3D without actual depth calculations.

The shadow visualization calculates shadow polygons for each obstacle at a given time, then renders them as semi-transparent shapes on the ground layer. Animating requires recalculating shadows as the time scrubber moves, which should be performant for a reasonable number of obstacles.

## Acceptance Criteria

Users can set a slope angle (0-30 degrees) and direction (compass bearing) for their plot. The slope appears visually in the plan view as a subtle gradient or contour indicator.

Users can toggle to an isometric view that shows the same plot from an elevated angle with obstacle heights visible and ground slope apparent.

Shadow zones appear as semi-transparent overlays showing where each obstacle casts shade at the current time. Dragging the time scrubber animates the shadows through the day.

The sun hours calculation accounts for slope, so a south-facing slope shows higher effective sun hours than flat ground at the same latitude.

## Technical Notes

The slope adjustment to sun altitude follows from the angle between the sun vector and the surface normal. For a surface tilted at angle θ toward bearing β, the effective sun altitude increases when the sun is in the direction of the tilt.

Shadow polygon calculation extends the existing ray-obstacle intersection math. Instead of just checking if the sun is blocked, we project the obstacle's silhouette onto the ground plane along the sun direction vector.

Performance target: shadow animation should maintain 30fps while scrubbing time with up to 10 obstacles.

## Related Documents

The blueprint UI research at docs/knowledge/research/blueprint-ui.md covers the existing PlotEditor architecture and discusses isometric view considerations.

The shade calculation implementation at src/lib/solar/shade.ts contains the obstacle intersection math that shadow projection will extend.
