---
id: T-014-08
title: Update recommendations to use effective hours
story: S-014
status: pending
priority: 1
complexity: S
depends_on: [T-014-04, T-014-07]
output: src/lib/solar/categories.ts
---

# T-014-08: Update Recommendations to Use Effective Hours

Modify the light category and plant recommendation logic to use shade-adjusted sun hours instead of theoretical maximum.

## Research

The app currently classifies locations by theoretical sun hours: full sun (6+ hours), part sun (4-6 hours), part shade (2-4 hours), and full shade (<2 hours). A location that theoretically gets 8 hours but loses 3 to shade should be classified as part sun (5 hours effective), not full sun.

This affects plant recommendations. A spot showing "full sun" that actually gets part sun would lead users to plant sun-loving crops that underperform.

## Plan

Modify the categorization logic (likely in `src/lib/solar/categories.ts` or wherever light categories are computed) to:

1. Accept an optional `effectiveHours` parameter alongside or instead of raw sun hours
2. Use effective hours for category determination when available
3. Keep theoretical hours available for comparison display

Update any plant recommendation logic to use effective hours. If recommendations are generated based on light category, no additional changes needed since the category will be accurate.

Update the results page to pass effective hours (when obstacles exist) to the categorization function.

## Implementation

This should be a small change to existing functions. The key is ensuring that everywhere we display or use the light category, we're using the shade-adjusted value when obstacles have been defined.

Add tests verifying that: a location with high theoretical hours but significant shade gets a lower category, and a location with no obstacles gets the same category as before.

## Context Files

- `src/lib/solar/` (find where categories are computed)
- `src/routes/results/` (results page that displays categories)
- `src/lib/components/SunDataCard.svelte` (may display category)
