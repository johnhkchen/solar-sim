---
id: T-018-01
title: Research enhanced climate data and map picker
story: S-018
status: complete
priority: 1
complexity: M
depends_on: []
output: docs/knowledge/research/enhanced-climate.md
---

# T-018-01: Research Enhanced Climate Data and Map Picker

Research the APIs, algorithms, and UX patterns for improved climate data and map-based location picking.

## Research Questions

### R1: Open-Meteo Historical Weather API

The Open-Meteo API provides free historical weather data. Research questions:

- What's the exact endpoint and request format for historical daily data?
- How far back does data go for various regions?
- What's the response structure for daily min/max temperatures?
- How do we calculate frost dates from 30 years of daily min temps?
- What's the request latency and should we cache results?
- Are there rate limits or fair use policies?

Test with San Francisco, Seattle, and Los Angeles to verify data quality.

### R2: Köppen Climate Classification

Köppen classification uses temperature and precipitation thresholds. Research questions:

- What are the exact thresholds for each major climate type (A, B, C, D, E)?
- What monthly data do we need (temp averages, precipitation)?
- Can we compute this from Open-Meteo data alone, or do we need precipitation from another source?
- What's the plain-English description for each climate type relevant to gardening?

Create a mapping table from Köppen codes to gardening-relevant descriptions.

### R3: Leaflet Map Picker Integration

Leaflet with OpenStreetMap for the map interface. Research questions:

- What's the bundle size impact of adding Leaflet to a SvelteKit app?
- How do we handle SSR (Leaflet requires window/document)?
- What's the best approach for the search autocomplete (leaflet-geosearch, Nominatim direct, or other)?
- How do we style the map to match our app's aesthetic?
- What about mobile touch interactions and responsive design?

Prototype a minimal Leaflet + Svelte component to verify integration approach.

### R4: NOAA Climate Prediction Center Outlook APIs

For showing current weather patterns and near-term forecasts. The CPC provides GeoJSON MapServer APIs:

- **Seasonal Temperature Outlook**: `https://mapservices.weather.noaa.gov/vector/rest/services/outlooks/cpc_sea_temp_outlk/MapServer`
- **Monthly Temperature Outlook**: `https://mapservices.weather.noaa.gov/vector/rest/services/outlooks/cpc_mthly_temp_outlk/MapServer`
- **Drought Outlook**: `https://mapservices.weather.noaa.gov/vector/rest/services/outlooks/cpc_drought_outlk/MapServer`

Research questions:

- How do we query these MapServer endpoints by coordinates (point-in-polygon)?
- What's the response structure for outlook probability polygons?
- How do we interpret the probability categories (above/below/near normal)?
- What's the update frequency and how should we cache?
- How do we generate gardening-relevant guidance from outlook data?

The goal is actionable intel like "This winter has been 10°F above normal; the 3-month outlook shows continued above-normal temps through spring" rather than long-term climate messaging.

### R5: Data Model and Caching Strategy

The expanded climate data needs careful modeling. Research questions:

- How should we structure the enhanced ClimateData type?
- What's the caching strategy for historical data that rarely changes?
- Should climate calculation happen client-side or server-side?
- How do we handle API failures gracefully (fall back to embedded tables)?

## Deliverables

A research document at docs/knowledge/research/enhanced-climate.md containing:

- Open-Meteo API usage guide with example requests/responses
- Köppen classification algorithm with threshold tables
- Leaflet integration approach for SvelteKit
- NOAA CPC outlook API query examples and interpretation guide
- Expanded TypeScript interfaces for climate data
- Implementation sequence recommendation

## Acceptance Criteria

Research provides working code examples for Open-Meteo queries. Köppen algorithm is fully specified with all thresholds. Leaflet SSR approach is validated. NOAA CPC API query approach is documented with example responses. Data model supports all planned features.
