---
id: T-013-05
title: Add URL state for shareable links
story: S-013
status: pending
priority: 1
complexity: S
depends_on:
  - T-013-04
output: src/routes/results/+page.ts
---

# T-013-05: Add URL State for Shareable Links

Ensure the results page URL fully encodes location state for bookmarking and sharing.

## Task

Create a +page.ts load function that validates and normalizes URL parameters, making the results page work correctly when accessed directly via URL.

## Research

SvelteKit +page.ts exports a load function that runs before rendering. It receives url.searchParams and can return data to the page. This enables server-side validation and ensures the page works when accessed directly.

## Plan

Create +page.ts with a load function that extracts and validates location params, returning them as page data.

## Implementation

The load function should:
1. Extract lat, lon, tz, name from searchParams
2. Validate lat is between -90 and 90
3. Validate lon is between -180 and 180
4. Default tz to UTC if missing
5. Return validated location data
6. Redirect to home if required params missing
