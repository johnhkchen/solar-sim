---
id: T-013-04
title: Integrate solar engine with results page
story: S-013
status: pending
priority: 1
complexity: M
depends_on:
  - T-013-01
  - T-013-03
output: src/routes/results/+page.svelte
---

# T-013-04: Integrate Solar Engine with Results Page

Connect the solar calculation engine to the results page to display actual sun data.

## Task

Update the results page to calculate and display sun hours for the location passed via URL parameters.

## Research

The solar engine is in src/lib/solar/. Key functions are `calculateDailySunHours(location, date)` which returns DailySunData, and `classifySunlight(hours)` which returns a LightCategory. The Location type requires latitude, longitude, and timezone.

## Plan

Import solar functions, reconstruct Location from URL params, calculate today's sun data, and pass it to SunDataCard.

## Implementation

The results page should:
1. Parse lat, lon, tz, name from URL query params
2. Construct a Location object
3. Call calculateDailySunHours for today's date
4. Pass the result to SunDataCard for display
5. Handle edge cases (invalid params, calculation errors)
