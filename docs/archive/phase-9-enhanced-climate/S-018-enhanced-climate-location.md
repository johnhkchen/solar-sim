---
id: S-018
title: Enhanced Climate and Location
status: draft
priority: 1
depends_on:
  - S-017
---

# S-018: Enhanced Climate and Location

This story improves climate data accuracy and adds a visual map picker, addressing feedback that the current system produces incorrect climate data for cities like San Francisco, Seattle, and Los Angeles.

## Context

The current climate system uses embedded lookup tables that interpolate frost dates and hardiness zones from latitude bands. This approach fails to capture microclimates, coastal effects, and regional variations that matter enormously to gardeners. A horticulturalist testing the app found that San Francisco, Seattle, and Los Angeles all returned inaccurate climate expectations.

Additionally, the location input requires users to either search by text or enter coordinates manually. A visual map picker is the standard UX that users expect for location-based applications.

## Problems Being Solved

**Inaccurate climate data** stems from using latitude as the primary lookup key. San Francisco at 37.8°N has a vastly different climate than Kansas City at the same latitude. The app needs real historical weather data, not geographic approximations.

**Missing climate classification** means horticulturalists can't quickly identify their climate type. Köppen climate zones (like Csb for Mediterranean or Cfb for marine west coast) are a standard reference that should be included.

**No temperature context** beyond frost dates leaves users without important planning information like average monthly temperatures, heat waves, and the actual temperature ranges they'll experience.

**No weather pattern intelligence** ignores current conditions that matter for garden planning. A gardener in the Interior West this winter needs to know it's been 10°F above normal and what the next 3 months look like, not just long-term zone shift statistics.

**Clunky location selection** forces users through a text search when they often just want to click their location on a map.

## Goals

**Map picker interface** using Leaflet with OpenStreetMap tiles lets users click to select their location, search with autocomplete, or use GPS. This becomes the primary location input method.

**Real climate data** from the Open-Meteo Historical Weather API replaces the embedded lookup tables. We fetch 30 years of actual temperature data to calculate frost dates, growing degree days, and temperature patterns for any location worldwide.

**Köppen climate classification** displays alongside other climate data, with both the code (e.g., "Csb") and plain-English description (e.g., "Mediterranean - warm summer, dry"). This gives horticulturalists a standard reference point.

**Historical temperature display** shows monthly average highs and lows, giving users context for what temperatures their plants will experience throughout the year.

**Seasonal weather outlook** from NOAA Climate Prediction Center shows current anomalies (e.g., "exceptionally warm winter") and 3-month forecasts with gardening-relevant guidance like "earlier planting may be possible, but reduced chill hours may affect fruit trees."

## Implementation Approach

Start with research to evaluate the Open-Meteo API capabilities, understand Köppen classification algorithms, and design the climate data model expansion.

The map picker can be developed independently from the climate data improvements. Leaflet with OpenStreetMap provides a zero-cost, no-API-key solution that works well for our needs.

Climate data fetching should be cached aggressively since historical normals change slowly. The 30-year calculation can happen server-side or client-side depending on performance testing.

## Acceptance Criteria

Users can select their location by clicking on an interactive map, searching with autocomplete, using GPS, or entering coordinates manually.

Climate data for San Francisco, Seattle, and Los Angeles matches what a horticulturalist would expect, including correct frost dates, hardiness zones, and climate classification.

The results page shows Köppen climate classification with a human-readable description.

Monthly temperature averages appear in a chart or table showing what temperatures to expect throughout the year.

A seasonal outlook section shows current weather patterns and 3-month forecasts from NOAA CPC, with practical guidance like "Above-normal temperatures expected through spring - consider earlier planting dates but watch for late frost risk."

## Technical Notes

Leaflet is MIT-licensed and works well with SvelteKit. The leaflet package plus leaflet-geosearch for autocomplete provides the full map picker experience.

Open-Meteo's Historical Weather API offers free access for non-commercial use with no API key required. The /v1/archive endpoint accepts coordinates and date ranges, returning daily temperature data going back decades.

Köppen classification can be computed from monthly temperature and precipitation data. The algorithm is well-documented and involves threshold checks on temperature ranges and precipitation patterns.

## Related Documents

The climate research at docs/knowledge/research/climate-data.md covers the original climate data source evaluation, including the Open-Meteo API option that was deferred for MVP.
