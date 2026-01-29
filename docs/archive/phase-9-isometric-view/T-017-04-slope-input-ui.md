---
id: T-017-04
title: Add slope input to PlotEditor
story: S-017
status: pending
priority: 1
complexity: S
depends_on:
  - T-017-02
output: src/lib/components/PlotEditor.svelte
---

# T-017-04: Add Slope Input to PlotEditor

Add UI controls for setting terrain slope in the PlotEditor component.

## Task

Extend PlotEditor.svelte to include slope angle and direction inputs. Show a visual indicator of slope in the plan view.

## UI Elements

- Slope angle input (0-30° range, slider or number input)
- Slope direction input (compass picker or degree input)
- Visual indicator in plan view (subtle gradient, arrow, or contour lines)

## Props Changes

Add to PlotEditorProps:
- `slope?: PlotSlope` - Current slope value
- `onSlopeChange?: (slope: PlotSlope) => void` - Callback when slope changes

## Acceptance Criteria

Users can set slope angle from 0-30 degrees. Users can set slope direction as a compass bearing. The plan view shows a visual hint of slope direction. Slope data is passed to parent component via callback.
