---
id: T-014-05
title: Research blueprint UI implementation
story: S-014
status: ready
priority: 1
complexity: M
depends_on: []
output: docs/knowledge/research/blueprint-ui.md
---

# T-014-05: Research Blueprint UI Implementation

Investigate how to build an interactive blueprint/plan view for obstacle placement.

## Research

The compass rose approach from initial research is simple but abstract. A blueprint/plan view provides better spatial understanding, especially for landscapers doing professional sun analysis. Users see their plot as a landscape plan and place obstacles as visual elements.

Key questions to answer: How do we represent a yard as a scalable SVG canvas? How do obstacles render at different zoom levels? What interaction patterns work for adding, moving, and resizing obstacles? Can we offer an isometric (3D-like) view alongside the plan view?

## Plan

Create `docs/knowledge/research/blueprint-ui.md` investigating:

**Coordinate System**: The plot needs a coordinate system where the observation point (where user wants to measure sun) is at center. Obstacles have x,y position (meters from center) plus direction derived from position. Consider how this maps to the direction/distance model in shade types.

**SVG Canvas Architecture**: How to build a pannable, zoomable SVG container in Svelte. Research existing patterns like svg-pan-zoom libraries vs custom implementation. The canvas should handle touch gestures for mobile.

**Obstacle Rendering**: Each obstacle type needs a visual representation. Trees could be circular with canopy radius. Buildings are rectangles. Fences are lines with width. Consider using SVG symbols that scale appropriately.

**Interaction Patterns**: Click-to-add workflow (click canvas location, select obstacle type from palette). Drag-to-move for repositioning. Resize handles for adjusting dimensions. Delete button or gesture.

**Isometric View Option**: Can we render the same obstacle data in a pseudo-3D isometric projection? This helps users visualize heights. Research CSS transforms or SVG techniques for isometric rendering.

**North Orientation**: The plot should show north direction. Users may want to rotate the view to match their mental model of their yard.

**Mobile Considerations**: Touch targets, pinch-to-zoom, avoiding accidental obstacle placement.

## Deliverable

Write `docs/knowledge/research/blueprint-ui.md` with concrete recommendations for each area above, including code sketches for the SVG architecture and interaction handlers.

## Context Files

- `docs/knowledge/research/phase-6-shade-climate.md` (obstacle data model)
- `src/lib/components/` (existing component patterns)
- Consider looking at landscape design software UX for inspiration
