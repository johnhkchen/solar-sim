---
id: T-013-06
title: End-to-end integration test
story: S-013
status: pending
priority: 1
complexity: M
depends_on:
  - T-013-05
output: src/lib/integration/happy-path.test.ts
---

# T-013-06: End-to-End Integration Test

Create an integration test that verifies the complete flow from location input to sun data display.

## Task

Write a test that simulates the happy path: entering a location and verifying the correct sun data appears.

## Research

Vitest can run integration tests. The test should verify that given known coordinates (e.g., Portland OR), the solar engine returns expected values. This tests the integration between geo and solar modules.

## Plan

Create an integration test file that exercises the full calculation pipeline with known inputs and expected outputs.

## Implementation

The test should:
1. Create a Location object for Portland, OR
2. Call calculateDailySunHours for a known date (e.g., summer solstice)
3. Verify sun hours are in expected range (14-16 hours for summer)
4. Verify category is "full-sun"
5. Verify sunrise/sunset are reasonable times
6. Test winter solstice as well for contrast
