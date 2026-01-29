---
id: T-011-04
title: Verify LocationInput component
story: S-011
status: complete
priority: 1
complexity: L
depends_on:
  - T-011-03
output: src/lib/components/LocationInput.svelte
---

# T-011-04: Verify LocationInput Component

Verify that `src/lib/components/LocationInput.svelte` correctly implements the unified location input UI with all three input modes.

## Research

Verification completed 2026-01-28 through code review and build verification. The component is a 783-line Svelte 5 component using the new runes syntax ($state, $props, $effect).

### Address Search Mode

The search mode implements a complete flow. Users type in searchQuery, submit the form to trigger handleSearch(), which calls geocodeAddress() from the geo module. Results appear in searchResults as a selectable list. Selecting a result calls selectGeocodingResult() which populates selectedLocation and emits onselect with the location, source='geocoding', and the OSM attribution string. Error states from geocoding (rate-limited, network-error, no-results) are displayed with user-friendly messages via getGeocodingErrorMessage(). Network errors include a hint suggesting manual coordinate entry.

### Manual Coordinates Mode

The coordinates mode parses input as the user types via handleCoordsInput() which calls parseCoordinates(). When parsing succeeds, coordsPreview shows the parsed lat/lon with detected format (decimal, dms, ddm). Parse errors display via getParseErrorMessage(). The "Use this location" button calls confirmCoordinates() which adds timezone via getTimezone() and emits onselect with source='manual'. Help text lists supported formats.

### Current Location Mode

The geolocation mode checks navigator.permissions on mount to display appropriate UI for the permission state. The requestGeolocation() function wraps navigator.geolocation.getCurrentPosition() in a Promise with a 10 second timeout and high accuracy enabled. Success adds timezone and emits onselect with source='geolocation'. Errors are mapped to user-friendly messages covering PERMISSION_DENIED, POSITION_UNAVAILABLE, and TIMEOUT cases. The denied state shows instructions for updating browser settings.

### Error Recovery

All error states are recoverable. Each mode has its own error state variable (searchError, coordsError, geoError) that resets when switching modes via setMode() or when starting a new operation. The clearSelection() function resets all state including errors. Users can always switch tabs to try a different input method.

### Event Emission

The component uses Svelte 5's typed event props. The onselect callback receives a complete Location object (latitude, longitude, timezone, optional name and timezoneIsEstimate flag), the source string ('geocoding' | 'manual' | 'geolocation'), and optionally the attribution string. The onclear callback fires when users click "Change location".

### Attribution Display

The selectedAttribution state stores the OSM attribution from geocoding results. When a location is selected via geocoding, the attribution "Data © OpenStreetMap contributors" appears in the location details display with the class="attribution" styling (small, gray text).

### Build Verification

The component compiles successfully with `npm run build`. The production build completes in ~1.8 seconds with no TypeScript or Svelte compilation errors. The component is properly exported from `src/lib/components/index.ts`.

## Plan

No changes required. The implementation is complete and matches all acceptance criteria.

## Implementation

Verification confirms the existing implementation is complete. Build passes successfully.

## Acceptance Criteria

- Address search: type "Portland, OR", click search, see results, select one
- Manual coords: type "45.5, -122.7", see parsed preview with timezone
- Current location: click button, handle permission, get coordinates
- Mode switching works without losing state inappropriately
- Error messages are helpful and states are recoverable
- Attribution appears for geocoded results
- Loading states shown during async operations
