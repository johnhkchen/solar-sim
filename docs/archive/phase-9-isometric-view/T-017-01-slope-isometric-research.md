---
id: T-017-01
title: Research slope modeling and isometric rendering
story: S-017
status: pending
priority: 1
complexity: M
depends_on: []
output: docs/knowledge/research/slope-isometric.md
---

# T-017-01: Research Slope Modeling and Isometric Rendering

Research the math and implementation approach for terrain slope, shadow projection, and isometric visualization.

## Research Questions

### R1: Slope-Adjusted Sun Calculations

How does terrain slope affect effective sun exposure? A south-facing slope receives more direct sunlight in winter because the surface tilts toward the low sun. The math involves calculating the angle between the sun vector and the surface normal.

Questions to answer:
- What's the formula for effective sun altitude on a sloped surface?
- Does slope affect shadow length calculations?
- Should we adjust sun hours integration or just the final sun angle?

Consider the San Francisco hill case: a 15° south-facing slope at latitude 37.7°N. How much does this improve winter sun exposure compared to flat ground?

### R2: Shadow Projection onto Sloped Terrain

The current shade calculation checks if an obstacle blocks the sun. For shadow visualization, we need to project the obstacle's silhouette onto the ground plane. On flat ground this is straightforward ray projection. On a slope, the shadow shape distorts based on the surface angle.

Questions to answer:
- How do we calculate a shadow polygon for rectangular vs circular obstacles?
- How does slope affect shadow shape and length?
- Can we approximate with flat-ground shadows for MVP, or is slope correction essential?

### R3: Isometric Projection with SVG

The existing PlotEditor uses SVG with coordinate transforms. Isometric projection can be achieved by skewing the coordinate system. Two approaches exist: CSS 3D transforms on an HTML container, or manual SVG coordinate transformation.

Questions to answer:
- Which approach integrates better with existing SVG PlotEditor?
- How do we render a sloped ground plane in isometric view?
- How should obstacle heights render (extruded shapes vs simple offset)?
- What about text labels in isometric view - do they need counter-rotation?

### R4: Performance for Shadow Animation

Shadow animation requires recalculating shadow polygons as time changes. With 10 obstacles and smooth animation (30fps), we're computing shadows 300 times per second during scrubbing.

Questions to answer:
- What's the computational cost of shadow polygon calculation?
- Should we pre-compute shadow keyframes and interpolate?
- How do we handle the time scrubber UX (continuous vs stepped)?

### R5: Slope Input UX

Users need to specify slope angle and direction. Options include numeric inputs, a visual slope indicator, or interactive dragging.

Questions to answer:
- What's the simplest input that communicates slope clearly?
- Should we show slope in the plan view, and if so how?
- What's a reasonable range for slope angle (0-30°? 0-45°?)?

## Deliverables

A research document at docs/knowledge/research/slope-isometric.md containing:
- Formulas for slope-adjusted sun calculations with worked examples
- Shadow polygon calculation approach with code sketches
- Recommended isometric rendering technique
- Performance analysis and optimization strategies
- UX recommendation for slope input

## Acceptance Criteria

The research provides clear, implementable answers to all five question areas. Math formulas include concrete examples (e.g., the San Francisco south-facing hill case). Code sketches are TypeScript and integrate with existing types.
