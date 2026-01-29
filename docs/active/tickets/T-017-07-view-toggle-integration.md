---
id: T-017-07
title: Add view toggle and integrate components
story: S-017
status: pending
priority: 1
complexity: M
depends_on:
  - T-017-05
  - T-017-06
output: src/lib/components/PlotViewer.svelte
---

# T-017-07: Add View Toggle and Integrate Components

Create a container component that combines plan view editing with isometric visualization and time controls.

## Task

Create `src/lib/components/PlotViewer.svelte` that wraps PlotEditor and IsometricView with a toggle between them, plus shared time controls for shadow visualization.

## Component Structure

```
PlotViewer
├── View Toggle (Plan / Isometric)
├── Time Scrubber (shared)
├── PlotEditor (shown in Plan mode)
└── IsometricView (shown in Isometric mode)
```

## Behavior

- Toggle switches between plan (editable) and isometric (view-only) modes
- Time scrubber affects shadow display in both views
- Obstacle and slope data is shared between views
- Changes in plan view immediately reflect in isometric view

## Props

- `obstacles: PlotObstacle[]` - Bindable array of obstacles
- `slope: PlotSlope` - Terrain slope
- `location: Coordinates` - For sun calculations
- `onchange?: (data: PlotData) => void` - Callback when plot data changes

## Acceptance Criteria

Users can toggle between plan and isometric views. Time scrubber works in both views. Editing in plan view updates isometric view. Component provides unified interface for plot visualization. Mobile-friendly toggle UI.
