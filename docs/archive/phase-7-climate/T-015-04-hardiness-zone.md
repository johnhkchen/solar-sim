---
id: T-015-04
title: Implement USDA hardiness zone lookup
story: S-015
status: pending
priority: 1
complexity: M
depends_on:
  - T-015-02
output: src/lib/climate/hardiness-zone.ts
---

# T-015-04: Implement USDA Hardiness Zone Lookup

Implement hardiness zone lookup for a given location.

## Task

Create `src/lib/climate/hardiness-zone.ts` with a function to determine the USDA hardiness zone for coordinates. The approach will be determined by T-015-01 research.

## Background

USDA hardiness zones are based on average annual minimum winter temperature. They range from 1a (coldest, -60°F) to 13b (warmest, 65°F). Gardeners use zones to determine which perennial plants will survive winter.

## Likely Approaches

1. **Latitude-based approximation** - Simple formula based on latitude
2. **GeoJSON lookup** - Query USDA zone boundaries
3. **API** - Fetch from a zone lookup service

## Expected Function Signature

```typescript
function getHardinessZone(location: Location): Promise<HardinessZone>
```

## Acceptance Criteria

- Function returns zone for any US location
- Zone includes both number and letter (e.g., "8b")
- Includes temperature range for the zone
- Includes unit tests with known city/zone pairs
