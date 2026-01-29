---
id: T-018-03
title: Implement Open-Meteo historical weather client
story: S-018
status: pending
priority: 1
complexity: M
depends_on:
  - T-018-01
output: src/lib/climate/openmeteo.ts
---

# T-018-03: Implement Open-Meteo Historical Weather Client

Create a client for fetching historical weather data from the Open-Meteo API.

## Task

Create `src/lib/climate/openmeteo.ts` with functions to fetch historical daily temperature data and compute climate metrics from it.

## Functions

- `fetchHistoricalTemperatures(coords: Coordinates, years: number): Promise<DailyTemperatureData[]>` - Fetch N years of daily min/max temps
- `calculateFrostDatesFromHistory(data: DailyTemperatureData[]): FrostDates` - Compute median frost dates from historical data
- `calculateMonthlyAverages(data: DailyTemperatureData[]): MonthlyAverages` - Compute monthly avg high/low temps

## API Details

Open-Meteo Historical endpoint: `https://archive-api.open-meteo.com/v1/archive`

Parameters:
- latitude, longitude
- start_date, end_date (YYYY-MM-DD)
- daily=temperature_2m_max,temperature_2m_min

## Caching

Historical data changes slowly, so cache responses aggressively. Use localStorage keyed by location (rounded to 0.1°) with 30-day TTL.

## Error Handling

- Network failures: Return cached data if available, else throw
- Rate limits: Implement exponential backoff
- Invalid responses: Validate response structure before parsing

## Acceptance Criteria

Successfully fetches 30 years of daily temperatures for test locations. Frost dates calculated from real data match expected values for SF, Seattle, LA. Monthly averages compute correctly. Caching prevents redundant API calls. Graceful degradation on network failure.
