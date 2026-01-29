---
id: S-011
title: Location System Verification
status: complete
priority: 1
milestone: M8
---

# S-011: Location System Verification

This story verifies and completes the location input system that was partially implemented in the previous phase. The code exists in `src/lib/geo/` and `src/lib/components/LocationInput.svelte` with passing tests, but it needs the same RPI verification as the solar engine.

## Context

A first pass at the location system exists with passing tests for coordinate parsing, timezone detection, and geocoding. The LocationInput.svelte component is 17KB, suggesting real implementation rather than scaffolding.

The verification process will confirm the implementation matches the specification in the archived S-006 story, identify any gaps in error handling or edge cases, and ensure the component works correctly in all three input modes (address search, manual coordinates, browser geolocation).

## Approach

Each ticket follows the RPI pattern internally. Given the geo module has multiple submodules (coordinates, timezone, geocoding) plus the UI component, the tickets map to these natural boundaries.

## Acceptance Criteria

Users can enter addresses and receive validated coordinates with detected timezone. Manual coordinate entry works for decimal degrees and DMS formats. Browser geolocation works when permitted. Immediate feedback appears for valid and invalid inputs. The system handles offline scenarios gracefully. OpenStreetMap attribution appears when geocoding results are displayed. All error states are recoverable.

## Tickets

T-011-01 covers coordinate parsing verification.
T-011-02 covers timezone detection verification.
T-011-03 covers geocoding integration verification.
T-011-04 covers LocationInput component verification.
