---
id: T-024-05
title: Migrate canopy tile fetches to Django backend
story: S-024
status: pending
priority: 1
complexity: M
depends_on: [T-024-02]
---

# T-024-05: Migrate Canopy Tile Fetches

## Task

Update canopy height tile fetching to go through the Django backend instead of hitting AWS S3 directly. The backend caches tiles for 1 year (the data is static).

## Current State

The frontend fetches GeoTIFF tiles from the Meta/WRI canopy height dataset on S3. Find these calls by searching for:
- `dataforgood-fb-data.s3`
- `canopy`
- `chm` (canopy height model)
- QuadKey tile fetching
- GeoTIFF loading

Likely locations:
- `src/lib/canopy/`
- `src/lib/tiles/`
- Tree height or canopy service

## Changes Required

1. **Find existing S3 tile fetches**
   ```bash
   grep -r "dataforgood" src/
   grep -r "canopy" src/
   grep -r "quadkey" src/
   ```

2. **Replace with API client**
   ```typescript
   // Before
   const url = `https://dataforgood-fb-data.s3.amazonaws.com/forests/v1/alsgedi_global_v6_float/chm/${quadkey}.tif`;
   const res = await fetch(url);
   const buffer = await res.arrayBuffer();

   // After
   import { fetchCanopyTile } from '$lib/api';
   const buffer = await fetchCanopyTile(quadkey);
   ```

3. **Handle the ArrayBuffer response**
   The API client returns `ArrayBuffer` directly. The existing GeoTIFF parsing logic should work unchanged since it expects raw bytes.

4. **Handle 404s gracefully**
   Not all quadkeys have tiles (ocean, etc.). The Django backend returns 404 for missing tiles. Handle this in the UI.

## Testing

1. Start the full dev stack
2. Load a location that uses canopy data (tree height visualization)
3. Verify request goes to `localhost:8000/api/v1/canopy/{quadkey}/`
4. Check Django logs for the proxied request
5. Check Valkey for cached tile (if under 25MB)
6. Reload, verify faster response from cache

## Tile Size Consideration

Canopy tiles are ~20MB each. The Django backend only caches tiles under 25MB in Valkey to avoid memory issues. Larger tiles (rare) will be re-fetched. This is acceptable since fetches are infrequent per location.

## Acceptance Criteria

- [ ] No direct calls to S3 canopy bucket remain in frontend
- [ ] Canopy tiles load through Django API
- [ ] Tree height visualization still works correctly
- [ ] GeoTIFF parsing unchanged (receives same bytes)
- [ ] 404 handling for missing tiles
- [ ] Caching verified in Valkey for typical tiles
