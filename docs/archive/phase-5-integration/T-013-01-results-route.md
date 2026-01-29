---
id: T-013-01
title: Create results page route
story: S-013
status: pending
priority: 1
complexity: S
depends_on: []
output: src/routes/results/+page.svelte
---

# T-013-01: Create Results Page Route

Create the basic route structure for the results page that will display solar calculations.

## Task

Create `src/routes/results/+page.svelte` with a placeholder layout. The page should accept location data (latitude, longitude, timezone) and display it. Actual solar calculations will be added in T-013-04.

## Research

SvelteKit routes are created by adding files to src/routes/. The +page.svelte file defines the page component. Query parameters or URL segments can pass location data.

## Plan

Create the results directory and +page.svelte with a basic structure that reads location from URL query params and displays the raw values.

## Implementation

The page should:
1. Read lat, lon, tz from URL query parameters
2. Display the location coordinates
3. Show a placeholder for sun data (to be filled in T-013-04)
4. Include a "Change location" link back to home
