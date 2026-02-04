---
id: T-021-03
title: Canopy tile fetching service
status: pending
priority: 2
complexity: M
depends_on: [T-021-01]
story: S-021
---

# T-021-03: Canopy Tile Fetching Service

## Objective

Create a service module that fetches the appropriate canopy height tile(s) for a given location from AWS S3.

## Acceptance Criteria

1. Given a lat/lng, determine which tile(s) to fetch
2. Fetch tile from S3 (no auth required)
3. Parse GeoTIFF and extract height array
4. Handle tile boundaries (user location near edge)
5. Cache fetched tiles to avoid redundant requests
6. Graceful handling of missing data / no coverage areas

## Technical Approach

```typescript
interface CanopyTile {
  bounds: LatLngBounds;
  width: number;
  height: number;
  heights: Float32Array;
  resolution: number; // meters per pixel
}

async function fetchCanopyTile(lat: number, lng: number): Promise<CanopyTile | null> {
  // Determine tile URL from coordinates
  // Fetch from S3
  // Parse with GeoTIFF.js
  // Return structured data
}
```

## Dependencies

- `geotiff` package for parsing
- Understanding of tile naming scheme (from T-021-01)

## Notes

Consider whether to do this client-side or add a lightweight backend. Client-side is simpler but tiles may be large. Start client-side and optimize if needed.
