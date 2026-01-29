---
id: T-015-02
title: Add climate data types and interfaces
story: S-015
status: pending
priority: 1
complexity: S
depends_on:
  - T-015-01
output: src/lib/climate/types.ts
---

# T-015-02: Add Climate Data Types and Interfaces

Define TypeScript interfaces for climate data based on research findings.

## Task

Create `src/lib/climate/types.ts` with interfaces for frost dates, hardiness zones, and growing season data. Also create `src/lib/climate/index.ts` to export the module.

## Expected Interfaces

Based on initial research, we likely need:

- `FrostDates` - last spring frost, first fall frost, confidence/range
- `HardinessZone` - zone identifier (e.g., "8b"), temperature range
- `GrowingSeason` - start date, end date, length in days
- `ClimateData` - combined climate information for a location

The exact shape will be determined by T-015-01 research.

## Acceptance Criteria

- Types compile without errors
- Types are exported from src/lib/climate/index.ts
- Types align with research recommendations
- Types include JSDoc comments explaining each field
