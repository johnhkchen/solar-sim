---
id: T-011-01
title: Verify coordinate parsing module
story: S-011
status: complete
priority: 1
complexity: M
depends_on:
  - T-009-01
output: src/lib/geo/coordinates.ts
---

# T-011-01: Verify Coordinate Parsing Module

Verify that `src/lib/geo/coordinates.ts` correctly implements coordinate parsing and validation as specified in the archived S-006 story.

## Research

Verification completed 2026-01-28. All files examined against S-006 specification.

### Format Support

The implementation correctly handles all specified coordinate formats. Decimal degrees parsing works via a custom regex pattern that handles comma-separated and space-separated formats like "45.5231, -122.6765" as well as hemisphere letters like "45.5231N 122.6765W". The DMS format uses the geo-coordinates-parser library for complex formats like "45° 31' 23\" N, 122° 40' 35\" W" with proper symbol detection. DDM format is also supported via the same library with format detection distinguishing it from DMS.

### Boundary Handling

All boundary conditions are tested and working correctly. The poles (90, 0) and (-90, 0) parse and validate. The date line handles both 180 and -180 longitude. The origin (0, 0) works as expected. Out-of-range values like latitude 95 or longitude 185 return structured errors with specific field identification.

### Error Types

The ParseError union type correctly distinguishes between invalid-format errors (which include the original input string) and out-of-range errors (which identify the specific field and value). The getParseErrorMessage function produces user-friendly messages for both cases.

### Validation Functions

Both validateCoordinates (simple boolean return) and validateCoordinatesWithError (structured result return) are complete and tested. They use the LATITUDE_MIN/MAX and LONGITUDE_MIN/MAX constants from types.ts for consistent range checking.

### Test Coverage

The test suite contains 38 tests covering all acceptance criteria: decimal formats with various separators, DMS with symbols and space-separated numbers, DDM format, boundary values at poles and date line, error cases for empty input and out-of-range values, real-world city coordinates, and formatting functions.

## Plan

No changes required. The implementation matches the S-006 specification completely.

## Implementation

Verification confirms the existing implementation is complete. All 38 tests pass.

## Acceptance Criteria

- Decimal degrees: "45.5, -122.7" parses correctly
- DMS: "45° 30' 0\" N, 122° 42' 0\" W" parses correctly
- Boundary: (90, 180), (-90, -180), (0, 0) all valid
- Out of range: latitude > 90 returns structured error
- Error messages are user-friendly
- formatCoordinates and formatCoordinatesDMS work correctly
