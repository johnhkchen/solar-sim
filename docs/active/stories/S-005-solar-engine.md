---
id: S-005
title: Solar Calculation Engine
status: in-progress
priority: 1
milestone: M7
---

# S-005: Solar Calculation Engine

This story covers the core astronomical calculations that power Solar-Sim. The engine computes sun position, sun hours, and light categories for any location and date.

## Context

The happy path shows users receiving accurate sun data within seconds of entering a location. Behind the scenes, this requires computing solar altitude and azimuth throughout the day, integrating over daylight hours to get total sun exposure, and classifying results into horticultural categories.

Research in S-005-R evaluated algorithm options and determined that SunCalc provides the best accuracy-to-complexity ratio for our use case. The library delivers accuracy of approximately 0.01 degrees for solar position, which translates to timing accuracy of roughly one minute for sunrise and sunset. This exceeds our requirements while maintaining a tiny bundle size suitable for Cloudflare Workers deployment.

## Module Architecture

The solar engine lives in `src/lib/solar/` and consists of four modules that handle distinct responsibilities.

### Position Module (position.ts)

The position module wraps SunCalc to provide type-safe interfaces for computing sun position at any moment. It takes latitude, longitude, and a Date object as inputs and returns altitude in degrees above the horizon and azimuth as a compass bearing. The module converts SunCalc's radian outputs to degrees for readability and handles the polar-region edge cases by checking for NaN values in sunrise and sunset times.

### Integration Module (sun-hours.ts)

The integration module computes total sun hours for a day by sampling solar altitude at 5-minute intervals. Research determined that this interval provides accuracy within the bounds of the underlying algorithms while keeping computation under 100ms for a full year of calculations. The module counts intervals where altitude exceeds zero and converts the count to hours. For polar regions where the sun never sets or never rises, the module returns 24 hours or 0 hours respectively along with a flag indicating the polar condition.

### Aggregation Module (seasonal.ts)

The aggregation module computes sun hours across date ranges and produces averages and patterns. It can calculate daily sun hours for a single date, monthly averages for planning, or seasonal summaries showing how sun exposure varies throughout the year. The module handles polar conditions by tracking how many days experience midnight sun or polar night and including this information in the results.

### Types and Constants (types.ts)

All TypeScript interfaces live in a dedicated types file for easy importing. The file also exports the sampling interval constant so tests can verify the expected resolution.

## TypeScript Interfaces

The engine exposes the following interfaces for inputs and outputs.

### Core Types

```typescript
interface Coordinates {
  latitude: number;  // -90 to 90, positive is north
  longitude: number; // -180 to 180, positive is east
}

interface SolarPosition {
  altitude: number;  // degrees above horizon, negative when below
  azimuth: number;   // compass bearing 0-360, 0 is north
  timestamp: Date;   // when this position was calculated
}

interface SunTimes {
  sunrise: Date | null;    // null during polar night
  sunset: Date | null;     // null during midnight sun
  solarNoon: Date;
  dayLength: number;       // hours, 0 for polar night, 24 for midnight sun
}
```

### Sun Hours Types

```typescript
type PolarCondition = 'normal' | 'midnight-sun' | 'polar-night';

interface DailySunData {
  date: Date;
  sunHours: number;
  sunTimes: SunTimes;
  polarCondition: PolarCondition;
}

interface SeasonalSummary {
  startDate: Date;
  endDate: Date;
  averageSunHours: number;
  minSunHours: number;
  maxSunHours: number;
  daysOfMidnightSun: number;
  daysOfPolarNight: number;
  dailyData: DailySunData[];
}
```

### Integration with Existing Code

The existing `src/lib/categories/index.ts` module already defines `LightCategory` and the `classifySunHours` function. The solar engine will produce `DailySunData` objects that can be passed directly to the category classifier. The main entry point in `src/lib/solar/index.ts` will re-export all public interfaces and functions so consumers can import everything from a single location.

## Test Strategy

Testing follows three categories covering standard cases, edge cases, and performance benchmarks.

### Standard Cases

The standard test suite uses well-known reference locations where expected values can be verified against external sources like timeanddate.com.

Portland, Oregon at 45.5°N serves as the mid-latitude reference. The tests verify summer solstice sun hours near 15.5 hours, winter solstice near 8.5 hours, and equinox near 12 hours. Sunrise and sunset times should match published values to within 2 minutes.

Singapore at 1.3°N tests equatorial behavior where day length varies minimally throughout the year. Tests verify consistent sun hours near 12 hours regardless of season, demonstrating the engine handles low latitudes correctly.

### Edge Cases

Tromsø, Norway at 69.6°N tests polar behavior. During summer solstice, the sun should not set at all and the engine should return midnight sun indication with 24 sun hours. During winter solstice, the sun should not rise and the engine should return polar night indication with 0 sun hours.

The Arctic Circle boundary at exactly 66.5°N tests the transition zone where midnight sun begins. Near summer solstice, the sun should barely set, and small variations in refraction could affect whether sunrise and sunset technically occur.

Extreme dates test the edges of SunCalc's reliable range. Tests should verify reasonable behavior for dates in 1900 and 2099, and should gracefully handle or warn about dates outside the valid range.

### Performance Benchmarks

The performance test computes a full year of daily sun hours for Portland and verifies execution completes in under 100ms. This ensures the engine remains responsive when users request annual summaries.

A secondary benchmark tests computing 10 years of monthly averages to verify batch operations stay performant. This simulates the load for generating historical patterns.

## Implementation Tickets

The implementation work divides into four tickets that can be completed sequentially.

### T-005-01: Sun Position Calculator

This ticket implements the position module that wraps SunCalc. The deliverable is `src/lib/solar/position.ts` exporting a `getSunPosition` function and `getSunTimes` function with full type safety. The implementation installs SunCalc as a dependency, handles radian-to-degree conversion, and implements polar condition detection.

### T-005-02: Sun Hours Integrator

This ticket implements the integration module that computes daily sun hours. The deliverable is `src/lib/solar/sun-hours.ts` exporting a `getDailySunHours` function that samples at 5-minute intervals. The implementation uses the position module from T-005-01 and returns complete `DailySunData` objects.

### T-005-03: Seasonal Aggregator

This ticket implements the aggregation module for date range calculations. The deliverable is `src/lib/solar/seasonal.ts` exporting functions for monthly and seasonal summaries. The implementation iterates over dates, calls the sun hours integrator, and computes statistics.

### T-005-04: Integration and Testing

This ticket wires everything together and adds the test suite. The deliverable is updated `src/lib/solar/index.ts` that re-exports all public APIs, plus test files covering standard cases, edge cases, and performance benchmarks. This ticket also updates the existing placeholder implementations to use the new modules.

## Acceptance Criteria

The engine is complete when it passes unit tests covering Portland in summer and winter, Tromsø during solstices, and Singapore year-round. The performance benchmark must show sub-100ms calculation for a full year of daily sun hours. The polar condition handling must correctly identify midnight sun and polar night situations. All public functions must have explicit TypeScript return types and comprehensive JSDoc comments.

## Dependencies

This story depends on S-004 which scaffolded the SvelteKit project. The scaffolding created placeholder files in `src/lib/solar/` that this story will implement. The categories module already exists with the light classification logic, so the solar engine only needs to produce sun hour values that can be passed to it.

## Research References

The research document at `docs/knowledge/research/solar-algorithms.md` contains the full analysis that informed these decisions. Key findings include the SunCalc recommendation, 5-minute sampling interval, and polar region handling approach.
