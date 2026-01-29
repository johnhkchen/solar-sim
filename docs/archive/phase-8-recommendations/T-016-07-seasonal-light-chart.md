---
id: T-016-07
title: Create seasonal light chart
story: S-016
status: pending
priority: 1
complexity: M
depends_on:
  - T-016-04
output: src/lib/components/SeasonalLightChart.svelte
---

# T-016-07: Create Seasonal Light Chart

Build a visualization showing monthly light conditions with shade impact.

## Task

Create `src/lib/components/SeasonalLightChart.svelte` that displays how effective sun hours vary across the year.

## Design

The chart should show 12 bars or segments for each month, display both theoretical and effective hours (if shade data exists), and highlight months where shade impact is highest.

Consider using the same horizontal timeline approach as the growing season components for visual consistency.

## Acceptance Criteria

Chart shows monthly light variation clearly. Shade impact is visible when applicable. Chart integrates visually with other timeline components. Labels are readable on mobile.
