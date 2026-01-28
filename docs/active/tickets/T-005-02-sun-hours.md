---
id: T-005-02
title: Implement sun hours integrator
story: S-005
milestone: M7
status: pending
priority: 1
complexity: M
depends_on:
  - T-005-01
assignee: null
created: 2026-01-28
---

# T-005-02: Implement Sun Hours Integrator

## Overview

Create the integration module that computes total sun hours for a day by sampling solar altitude at regular intervals.

## Implementation Details

Create `src/lib/solar/sun-hours.ts` that imports the position functions from T-005-01 and exports a `getDailySunHours` function. This function takes latitude, longitude, and a date, then returns a complete DailySunData object containing the date, sun hours, sun times, and polar condition.

The integration algorithm starts at midnight local time and samples altitude every 5 minutes (the SAMPLING_INTERVAL_MINUTES constant from types.ts) through the entire 24-hour period. For each sample where altitude exceeds zero, add the interval duration to a running total. At the end, convert the total to hours by dividing the count of positive samples by the samples per hour (60 / 5 = 12).

To determine the date's local midnight, create a new Date object from the input date set to 00:00:00.000. Then iterate through 288 samples (24 hours times 12 samples per hour), adding 5 minutes to the timestamp for each iteration and calling getSunPosition to check the altitude.

The function should also call getSunTimes to get the sunrise, sunset, and solar noon for the day. If getSunTimes indicates a polar condition (midnight sun or polar night), set the polarCondition field accordingly. For midnight sun, return 24 hours; for polar night, return 0 hours. This provides a fast path that avoids unnecessary position calculations when the polar condition is already known.

Edge case handling requires attention around midnight and at the boundaries of polar conditions. The sampling approach naturally handles the transition from day to night because it counts intervals rather than trying to compute exact sunrise and sunset moments.

## Acceptance Criteria

The function must return accurate sun hours matching published values to within 10 minutes for standard locations like Portland. It must correctly return 24 hours for midnight sun locations and 0 hours for polar night locations. The polar condition field must accurately reflect the location's status on the given date.

## Technical Notes

Working with dates requires care around timezones. The input date is assumed to be in UTC, and all calculations should use UTC methods to avoid daylight saving time complications. The sun hours returned represent the actual exposure at the location regardless of what timezone the user observes.

## Output

The deliverable is `src/lib/solar/sun-hours.ts` with the getDailySunHours function.
