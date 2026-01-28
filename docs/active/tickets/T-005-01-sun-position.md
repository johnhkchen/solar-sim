---
id: T-005-01
title: Implement sun position calculator
story: S-005
milestone: M7
status: pending
priority: 1
complexity: M
depends_on: []
assignee: null
created: 2026-01-28
---

# T-005-01: Implement Sun Position Calculator

## Overview

Create the position module that wraps SunCalc to provide type-safe interfaces for computing sun position at any moment.

## Implementation Details

The first step is installing SunCalc as a project dependency by running `npm install suncalc` and adding `@types/suncalc` for TypeScript definitions if available. If type definitions don't exist on DefinitelyTyped, create a local declaration file at `src/lib/solar/suncalc.d.ts`.

Create `src/lib/solar/types.ts` containing all the shared interfaces including Coordinates, SolarPosition, SunTimes, PolarCondition, and DailySunData. Export the SAMPLING_INTERVAL_MINUTES constant as 5.

Create `src/lib/solar/position.ts` that imports SunCalc and exports two main functions. The `getSunPosition` function takes latitude, longitude, and a Date object, calls SunCalc.getPosition internally, converts the returned radians to degrees for both altitude and azimuth, and returns a SolarPosition object with the calculation timestamp. The `getSunTimes` function takes the same inputs, calls SunCalc.getTimes, and returns a SunTimes object with sunrise, sunset, solarNoon, and dayLength properties.

SunCalc returns NaN for sunrise and sunset during polar conditions, so the implementation must check for this. When sunrise is NaN and the midday altitude is positive, the location is experiencing midnight sun. When sunset is NaN and the midday altitude is negative, the location is experiencing polar night. The SunTimes object should use null for sunrise and sunset in these cases and set dayLength to 24 or 0 respectively.

The azimuth conversion requires careful handling because SunCalc returns azimuth measured from south, increasing counterclockwise. The implementation should convert this to compass bearing measured from north, increasing clockwise, so users see familiar compass directions.

## Acceptance Criteria

The module must compile without TypeScript errors. The getSunPosition function must return altitude and azimuth in degrees rather than radians. The getSunTimes function must correctly detect polar conditions and return null for sunrise and sunset when appropriate. Unit tests must verify correct values for a known location and time against published reference data.

## Technical Notes

SunCalc.getPosition returns altitude and azimuth in radians where azimuth is measured from south. Multiply by 180/Math.PI to convert to degrees. For azimuth, add 180 to convert from south-based to north-based, then use modulo 360 to keep it in the 0-360 range.

## Output

The deliverables are `src/lib/solar/types.ts` with all shared interfaces and `src/lib/solar/position.ts` with the position calculation functions.
