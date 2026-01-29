---
id: T-016-08
title: Integrate recommendations into results page
story: S-016
status: pending
priority: 1
complexity: M
depends_on:
  - T-016-05
  - T-016-06
  - T-016-07
output: src/routes/results/+page.svelte
---

# T-016-08: Integrate Recommendations into Results Page

Wire all recommendation components into the results page for the complete user experience.

## Task

Update `src/routes/results/+page.svelte` to include the PlantRecommendations, PlantingCalendar, and SeasonalLightChart components.

## Integration Points

The page should fetch or compute shade analysis (if obstacles exist), fetch climate data using the climate module from S-015, pass combined data to the recommendation engine, and render all three new components below the existing sun data.

The page flow should be: location info → sun data card → growing season timeline (S-015) → plant recommendations → planting calendar → seasonal light chart.

## Acceptance Criteria

All three components appear on the results page. Components receive correct data from shade and climate modules. Page loads without errors when shade or climate data is unavailable. Layout works on mobile and desktop. Performance remains acceptable (no visible lag).
