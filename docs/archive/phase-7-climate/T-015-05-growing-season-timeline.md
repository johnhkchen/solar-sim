---
id: T-015-05
title: Create growing season timeline component
story: S-015
status: pending
priority: 1
complexity: M
depends_on:
  - T-015-03
  - T-015-04
output: src/lib/components/GrowingSeasonTimeline.svelte
---

# T-015-05: Create Growing Season Timeline Component

Build a visual component showing the growing season timeline.

## Task

Create `src/lib/components/GrowingSeasonTimeline.svelte` that visualizes frost dates and growing season on a year timeline.

## Design Goals

The component should show:
- Full year as a horizontal timeline (Jan-Dec)
- Frost risk periods highlighted (winter months)
- Frost-free growing season clearly marked
- Last spring frost and first fall frost dates labeled
- Growing season length displayed

## Integration

The component receives FrostDates and GrowingSeason data as props. It should match the visual style of existing components (SunDataCard, ShadeResults).

## Acceptance Criteria

- Timeline shows full year with months labeled
- Frost-free period is visually distinct
- Frost dates are clearly marked with labels
- Growing season length (days) is displayed
- Component is responsive (works on mobile)
- Exports from src/lib/components/index.ts
