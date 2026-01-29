---
id: T-015-03
title: Implement frost date lookup
story: S-015
status: pending
priority: 1
complexity: M
depends_on:
  - T-015-02
output: src/lib/climate/frost-dates.ts
---

# T-015-03: Implement Frost Date Lookup

Implement the frost date lookup function based on research recommendations.

## Task

Create `src/lib/climate/frost-dates.ts` with a function to look up frost dates for a given location. The data source and approach will be determined by T-015-01 research.

## Likely Approaches

1. **Embedded lookup table** - JSON file with frost dates by latitude band or region
2. **API integration** - Fetch from NOAA or Open-Meteo
3. **Hybrid** - Embedded defaults with API refinement

## Expected Function Signature

```typescript
function getFrostDates(location: Location): Promise<FrostDates>
```

## Acceptance Criteria

- Function returns frost dates for any valid location
- Handles US locations at minimum
- Includes unit tests with known values
- Gracefully handles missing data (returns estimates or null)
