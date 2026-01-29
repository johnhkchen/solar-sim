---
id: S-019
title: Full App Integration
status: draft
priority: 1
depends_on:
  - S-018
---

# S-019: Full App Integration

This story wires together all the components built in previous phases into a cohesive end-to-end user experience, connecting location selection through obstacle/slope input to shade-adjusted recommendations.

## Context

Multiple powerful features have been built but exist in isolation:

- **PlotEditor** (`src/lib/components/PlotEditor.svelte`) - Obstacle placement with drag/drop
- **IsometricView** (`src/lib/components/IsometricView.svelte`) - 3D visualization with shadow zones
- **PlotViewer** (`src/lib/components/PlotViewer.svelte`) - Wrapper with view toggle and time scrubber
- **Shade calculations** (`src/lib/solar/shade.ts`, `shadow-projection.ts`) - Effective sun hours accounting for obstacles
- **Slope modeling** (`src/lib/solar/slope.ts`) - Terrain angle affecting sun exposure
- **Climate data** - Frost dates, hardiness zones, seasonal outlook
- **Recommendations** (`src/lib/plants/`) - Plant suggestions based on sun hours and climate

The results page currently shows theoretical sun data and recommendations but doesn't incorporate obstacles or slope. Users can't actually use the shade modeling features they would see in PlotViewer.

## Goals

**End-to-end flow**: User enters location → optionally adds obstacles and slope → sees shade-adjusted sun hours → gets recommendations based on effective (not theoretical) light.

**Unified results page**: Integrate PlotViewer into the results flow so users can model their garden layout and immediately see how it affects their recommendations.

**State persistence**: Save obstacle and slope data so users returning to the same location see their previous garden layout.

**Responsive design**: The integrated experience works well on mobile where screen space is limited.

## User Flow

1. User selects location (map picker from S-018)
2. Results page loads with basic sun data
3. User sees "Model Your Garden" section with PlotViewer
4. User adds obstacles (trees, buildings) and sets slope if applicable
5. Results dynamically update to show effective sun hours
6. Recommendations adjust based on shade-adjusted light conditions
7. User can toggle isometric view to visualize shadow patterns

## Acceptance Criteria

PlotViewer appears on the results page in a logical position in the information hierarchy.

Adding obstacles updates the displayed sun hours from theoretical to effective values.

Plant recommendations use effective sun hours, not theoretical.

Obstacle and slope data persists in localStorage keyed by location.

The page remains usable on mobile viewports with appropriate layout adjustments.

Performance remains acceptable (no perceptible lag when adding/moving obstacles).

## Technical Notes

The results page currently imports from `$lib/solar` and `$lib/climate`. It will need to also import PlotViewer and the shade calculation functions.

State flow: `obstacles` and `slope` state lives in the results page, passed to PlotViewer, and changes trigger recalculation of effective sun hours which feed into recommendations.

LocalStorage key could be based on rounded coordinates (e.g., `solar-sim:plot:37.8:-122.4`).

## Related Files

- `src/routes/results/+page.svelte` - Main integration target
- `src/lib/components/PlotViewer.svelte` - Component to integrate
- `src/lib/solar/sun-hours-shade.ts` - Shade-adjusted calculation
- `src/lib/plants/recommendations.ts` - Needs effective hours input
