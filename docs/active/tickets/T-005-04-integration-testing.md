---
id: T-005-04
title: Wire up integration and add tests
story: S-005
milestone: M7
status: pending
priority: 1
complexity: M
depends_on:
  - T-005-03
assignee: null
created: 2026-01-28
---

# T-005-04: Wire Up Integration and Add Tests

## Overview

Complete the solar engine by updating the main entry point to re-export all public APIs and adding comprehensive tests for standard cases, edge cases, and performance benchmarks.

## Implementation Details

Update `src/lib/solar/index.ts` to import and re-export all public types and functions from the other modules. The existing placeholder functions should be removed and replaced with the real implementations. Consumers should be able to import everything they need from `$lib/solar` without knowing about the internal module structure.

Create `src/lib/solar/position.test.ts` with tests for the position calculator. Tests should verify that getSunPosition returns correct altitude and azimuth for Portland on the summer solstice at solar noon, where altitude should be approximately 68.5 degrees and azimuth should be approximately 180 degrees (due south). Also test that getSunTimes returns correct sunrise and sunset times matching published values to within 2 minutes.

Create `src/lib/solar/sun-hours.test.ts` with tests for the integration module. Tests should verify Portland's sun hours on summer solstice near 15.5 hours, winter solstice near 8.5 hours, and equinox near 12 hours. All values should match to within 15 minutes of published reference data.

Create `src/lib/solar/seasonal.test.ts` with tests for the aggregation module. Tests should verify that getYearlySummary returns 12 months of data, that averages are computed correctly, and that polar condition counts match expected values for locations that experience midnight sun and polar night.

Create `src/lib/solar/edge-cases.test.ts` with tests for unusual situations. Tromsø tests verify midnight sun detection on summer solstice and polar night detection on winter solstice. Arctic Circle boundary tests verify correct behavior at exactly 66.5°N around the solstice. Singapore tests verify consistent 12-hour days year-round at the equator.

Create `src/lib/solar/performance.test.ts` with benchmark tests. The primary test computes a full year of daily sun hours for Portland and asserts completion in under 100ms. A secondary test computes 10 years of monthly summaries and verifies it stays under 500ms. These tests use performance.now() for timing and should be marked with a "benchmark" tag so they can be run separately from the main test suite.

Update the test configuration to recognize the benchmark tag if needed. The main test runner should include all tests by default, but developers should be able to run just the benchmarks with a dedicated command.

## Acceptance Criteria

All tests must pass. The index.ts file must export all public types and functions from a single import path. The existing placeholder implementations must be replaced with the real code. The benchmark tests must demonstrate sub-100ms performance for annual calculations.

## Technical Notes

Test files should use Vitest which was set up as part of the SvelteKit scaffold. Import test utilities with `import { describe, it, expect } from 'vitest'`. For performance tests, use `bench` from Vitest's benchmark API if available, or fall back to manual timing with performance.now().

Reference values for testing can be obtained from timeanddate.com by searching for the specific location and date. Document the source of expected values in comments for future verification.

## Output

The deliverables are updated `src/lib/solar/index.ts`, test files for position, sun-hours, seasonal, edge-cases, and performance, and any necessary test configuration updates.
