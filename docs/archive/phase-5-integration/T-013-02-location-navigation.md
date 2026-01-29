---
id: T-013-02
title: Wire LocationInput to results navigation
story: S-013
status: pending
priority: 1
complexity: S
depends_on:
  - T-013-01
output: src/routes/+page.svelte
---

# T-013-02: Wire LocationInput to Results Navigation

Connect the home page LocationInput component to navigate to the results page when a location is selected.

## Task

Update the home page to use LocationInput and navigate to /results with the selected location encoded in query parameters.

## Research

The LocationInput component emits an `onselect` event with a Location object containing latitude, longitude, timezone, and optional name. SvelteKit's `goto` function handles client-side navigation.

## Plan

Import LocationInput on the home page, handle the onselect event, and use goto to navigate to /results with query params.

## Implementation

The home page should:
1. Import and render LocationInput
2. Handle onselect to capture the Location
3. Navigate to /results?lat=X&lon=Y&tz=Z&name=N
4. URL-encode the parameters properly
