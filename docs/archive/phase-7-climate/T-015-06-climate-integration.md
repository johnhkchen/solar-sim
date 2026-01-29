---
id: T-015-06
title: Integrate climate data into results page
story: S-015
status: pending
priority: 1
complexity: M
depends_on:
  - T-015-05
output: src/routes/results/+page.svelte
---

# T-015-06: Integrate Climate Data into Results Page

Add climate data display to the existing results page.

## Task

Update `src/routes/results/+page.svelte` to fetch and display climate data alongside sun/shade information.

## Integration Points

The results page currently shows:
- Location information
- Sun hours (theoretical and effective)
- Shade impact from obstacles

Add:
- USDA hardiness zone
- Frost dates (last spring, first fall)
- Growing season length
- GrowingSeasonTimeline component

## Data Flow

1. Results page already has location from URL params
2. Fetch climate data using location coordinates
3. Pass climate data to GrowingSeasonTimeline component
4. Display hardiness zone and frost dates in a ClimateCard or similar

## Acceptance Criteria

- Climate data loads when results page loads
- Hardiness zone displays prominently
- Frost dates shown with growing season length
- Timeline component renders below sun data
- Loading state while climate data fetches
- Graceful handling if climate data unavailable
