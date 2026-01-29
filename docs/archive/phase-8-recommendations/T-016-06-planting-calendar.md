---
id: T-016-06
title: Create planting calendar component
story: S-016
status: pending
priority: 1
complexity: M
depends_on:
  - T-016-04
output: src/lib/components/PlantingCalendar.svelte
---

# T-016-06: Create Planting Calendar Component

Build a visual calendar showing planting windows based on frost dates.

## Task

Create `src/lib/components/PlantingCalendar.svelte` that displays key gardening dates in a timeline format.

## Design

The calendar should show last frost date (from climate data), seed starting window (6-8 weeks before last frost), main planting season, and first frost date.

Use color coding to distinguish different periods. The timeline should span January through December with the growing season highlighted.

This component should complement the GrowingSeasonTimeline from S-015, possibly sharing styling patterns.

## Acceptance Criteria

Calendar shows all key dates from climate data. Timeline is visually clear and readable. Dates are labeled appropriately. Component works on mobile viewports. Design is consistent with GrowingSeasonTimeline.
