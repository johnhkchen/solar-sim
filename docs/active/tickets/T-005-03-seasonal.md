---
id: T-005-03
title: Implement seasonal aggregator
story: S-005
milestone: M7
status: pending
priority: 1
complexity: M
depends_on:
  - T-005-02
assignee: null
created: 2026-01-28
---

# T-005-03: Implement Seasonal Aggregator

## Overview

Create the aggregation module that computes sun hours across date ranges and produces averages and patterns for seasonal analysis.

## Implementation Details

Create `src/lib/solar/seasonal.ts` that imports getDailySunHours from the sun-hours module and exports functions for date range calculations.

The primary function is `getSeasonalSummary` which takes latitude, longitude, start date, and end date. It iterates through each day in the range, calls getDailySunHours for each, collects the results, and computes statistics. The returned SeasonalSummary object includes the date range, average sun hours, minimum and maximum sun hours, counts of days experiencing midnight sun and polar night, and the complete array of daily data for detailed analysis.

A convenience function `getMonthlySummary` takes latitude, longitude, year, and month (1-12), determines the first and last days of that month, and calls getSeasonalSummary internally. This simplifies common use cases like showing how a location's sun exposure varies by month.

Another convenience function `getYearlySummary` takes latitude, longitude, and year, then computes summaries for each of the 12 months and returns them as an array. This enables generating annual sun hour charts and identifying the best and worst months for sun exposure.

For performance, the seasonal aggregator should be able to compute a full year of daily data (365 iterations) within the 100ms target. Each iteration calls getDailySunHours which performs 288 position calculations, so the total is roughly 105,000 calculations per year. SunCalc benchmarks at approximately 50,000 calculations per second, so this should complete in under 3 milliseconds with margin to spare.

Statistics calculation happens after collecting all daily data. Average sun hours is the mean of the sunHours values. Minimum and maximum are straightforward. The polar condition counts iterate through dailyData and count entries where polarCondition equals 'midnight-sun' or 'polar-night'.

## Acceptance Criteria

The getSeasonalSummary function must correctly compute statistics across date ranges. The monthly and yearly convenience functions must return accurate data matching expected values for reference locations. Performance must stay under 100ms for a full year calculation as verified by the benchmark tests added in T-005-04.

## Technical Notes

Date iteration should increment by adding one day using setDate(getDate() + 1) rather than adding milliseconds, to avoid issues around daylight saving time transitions. Create a new Date object for each iteration to avoid mutating the loop variable.

## Output

The deliverable is `src/lib/solar/seasonal.ts` with getSeasonalSummary, getMonthlySummary, and getYearlySummary functions.
