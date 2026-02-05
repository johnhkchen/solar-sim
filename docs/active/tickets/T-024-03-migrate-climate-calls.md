---
id: T-024-03
title: Migrate climate API calls to Django backend
story: S-024
status: pending
priority: 1
complexity: M
depends_on: [T-024-02]
---

# T-024-03: Migrate Climate API Calls

## Task

Update the climate/frost date functionality to fetch data through the Django backend instead of hitting Open-Meteo directly. The backend caches responses for 30 days, reducing external API load.

## Current State

The frontend currently calls Open-Meteo directly. Find these calls by searching for:
- `open-meteo.com`
- `archive-api.open-meteo`
- Historical temperature fetching

Likely locations:
- `src/lib/climate/`
- `src/lib/services/`
- Any frost date calculation module

## Changes Required

1. **Find existing Open-Meteo calls**
   ```bash
   grep -r "open-meteo" src/
   grep -r "temperature_2m" src/
   ```

2. **Replace with API client**
   ```typescript
   // Before
   const res = await fetch(`https://archive-api.open-meteo.com/v1/archive?latitude=${lat}&...`);
   const data = await res.json();

   // After
   import { fetchClimate } from '$lib/api';
   const data = await fetchClimate(lat, lng);
   ```

3. **Update any response parsing**
   The Django proxy returns the same response structure as Open-Meteo, so parsing logic should work unchanged. Verify the `ClimateResponse` type matches.

4. **Handle errors**
   ```typescript
   import { fetchClimate, ApiError } from '$lib/api';

   try {
     const data = await fetchClimate(lat, lng);
   } catch (e) {
     if (e instanceof ApiError) {
       console.error(`Climate API failed: ${e.status} on ${e.endpoint}`);
     }
     throw e;
   }
   ```

## Testing

1. Start the full dev stack (Django + Valkey + Postgres)
2. Load a location in the app that uses climate data
3. Open browser Network tab, verify requests go to `localhost:8000/api/v1/climate/`
4. Check Django logs for the request
5. Check Valkey for cached key
6. Reload page, verify second request is served from cache (faster)

## Acceptance Criteria

- [ ] No direct calls to `open-meteo.com` remain in frontend code
- [ ] Climate data loads through Django API
- [ ] Frost date calculations still work correctly
- [ ] Error handling provides useful feedback
- [ ] Caching verified in Valkey
