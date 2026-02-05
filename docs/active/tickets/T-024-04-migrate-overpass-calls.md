---
id: T-024-04
title: Migrate Overpass API calls to Django backend
story: S-024
status: pending
priority: 1
complexity: M
depends_on: [T-024-02]
---

# T-024-04: Migrate Overpass API Calls

## Task

Update building footprint queries to go through the Django backend instead of hitting the public Overpass API directly. The backend caches OSM responses for 7 days.

## Current State

The frontend queries Overpass for building polygons used in shadow casting. Find these calls by searching for:
- `overpass-api.de`
- `overpass`
- Building footprint queries
- OSM/OpenStreetMap references

Likely locations:
- `src/lib/shadow/`
- `src/lib/buildings/`
- Shadow casting or building fetch modules

## Changes Required

1. **Find existing Overpass calls**
   ```bash
   grep -r "overpass" src/
   grep -r "building" src/ | grep -i fetch
   ```

2. **Replace with API client**
   ```typescript
   // Before
   const query = `[out:json];way["building"](${bbox});out geom;`;
   const res = await fetch('https://overpass-api.de/api/interpreter', {
     method: 'POST',
     body: `data=${encodeURIComponent(query)}`,
   });

   // After
   import { fetchOverpass } from '$lib/api';
   const query = `[out:json];way["building"](${bbox});out geom;`;
   const data = await fetchOverpass(query);
   ```

3. **Update response handling**
   The Django proxy returns the same JSON structure. The `elements` array contains nodes, ways, and relations. Verify existing parsing works.

4. **Handle rate limiting gracefully**
   The public Overpass API has strict rate limits. Our cache helps, but first requests for a new area may be slow. Consider showing a loading state.

## Testing

1. Start the full dev stack
2. Pan the map to a new area (triggers building fetch)
3. Verify request goes to `localhost:8000/api/v1/overpass/`
4. Check Django logs for the proxied request
5. Check Valkey for cached key (hashed query)
6. Pan back to same area, verify instant response from cache

## Acceptance Criteria

- [ ] No direct calls to `overpass-api.de` remain in frontend
- [ ] Building footprints load through Django API
- [ ] Shadow casting still works correctly
- [ ] Large queries don't timeout (Django has 60s timeout configured)
- [ ] Caching verified in Valkey
