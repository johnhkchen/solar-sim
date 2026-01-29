---
id: S-013
title: Application Integration
status: pending
priority: 1
---

# S-013: Application Integration

This story connects the verified solar engine and location system to produce the core user experience described in happy_path.md minutes 0-2: enter a location, see sun hours and light category.

## Context

The solar engine (127 tests) and location system (79 tests) are verified complete. The LocationInput component handles address search, manual coordinates, and browser geolocation. What's missing is the glue: a results page that takes a location and displays calculated sun data.

## Acceptance Criteria

Users can enter a location on the home page and navigate to a results page showing today's sun hours, light category, and sunrise/sunset times. The results page URL encodes the location so it can be bookmarked or shared. The flow works end-to-end without errors.

## Tickets

T-013-01 creates the results page route structure.
T-013-02 wires the home page LocationInput to navigate to results.
T-013-03 creates a SunDataCard component for displaying calculations.
T-013-04 integrates the solar engine with the results page.
T-013-05 adds URL state encoding for shareable links.
T-013-06 adds an end-to-end integration test.
