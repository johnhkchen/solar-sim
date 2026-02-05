---
id: S-024
title: Django Backend Integration
status: ready
priority: 1
---

# S-024: Django Backend Integration

## Context

We've introduced a Django REST backend to handle API proxying with Valkey caching, user authentication, and plan storage. The infrastructure is in place (docker-compose, Dockerfile, Django apps) but the frontend still hits external APIs directly. This story connects the SvelteKit frontend to the Django backend.

## Current State

The validation report (`docs/reports/backend-validation-2026-02-04.md`) identified blockers that have been addressed:

1. **Cache config fixed** - Removed incompatible `django-redis` dependency, now using Django's built-in `RedisCache` which works with Valkey directly.

2. **User model is correct** - No UUID field exists; the migration error was from stale database state. A clean postgres volume resolves this.

3. **Dev environment configured** - `docker-compose.dev.yml` now has explicit `DATABASE_URL`, `VALKEY_URL`, and credentials.

The stack needs a clean rebuild and validation before frontend integration begins.

## Goals

1. Verify the Django backend works end-to-end (migrations, cache, all proxy endpoints)
2. Update SvelteKit to fetch data through Django instead of hitting external APIs directly
3. Maintain the existing UX—users shouldn't notice the architectural change

## Frontend Integration Points

The SvelteKit app currently makes these external API calls that should route through Django:

| Current Call | Django Endpoint | Used By |
|--------------|-----------------|---------|
| Open-Meteo historical API | `GET /api/v1/climate/?lat=X&lng=Y` | Climate data, frost dates |
| Overpass API (OSM buildings) | `POST /api/v1/overpass/` | Building shadows |
| AWS S3 canopy tiles | `GET /api/v1/canopy/{quadkey}/` | Tree height data |

The Django proxy caches responses in Valkey with appropriate TTLs (7 days for OSM, 30 days for climate, 1 year for canopy).

## Implementation Approach

### Phase 1: Verify Backend

Before touching frontend code, confirm the backend works:

```bash
cd infrastructure/docker
docker compose -f docker-compose.yml -f docker-compose.dev.yml down -v
rm -rf ../data/postgres ../data/valkey
docker compose -f docker-compose.yml -f docker-compose.dev.yml up --build
```

Then test:
- `docker exec solar-sim-api python manage.py migrate`
- `curl http://localhost:8000/api/v1/health/`
- `curl "http://localhost:8000/api/v1/climate/?lat=37.7749&lng=-122.4194"`
- Check Valkey: `docker exec solar-sim-cache valkey-cli keys "*"`

### Phase 2: Create API Client

Add a SvelteKit module that abstracts the API calls:

```typescript
// src/lib/api/client.ts
const API_BASE = import.meta.env.PUBLIC_API_URL || 'http://localhost:8000/api/v1';

export async function fetchClimate(lat: number, lng: number) {
  const res = await fetch(`${API_BASE}/climate/?lat=${lat}&lng=${lng}`);
  if (!res.ok) throw new Error(`Climate API error: ${res.status}`);
  return res.json();
}

export async function fetchBuildings(query: string) {
  const res = await fetch(`${API_BASE}/overpass/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query }),
  });
  if (!res.ok) throw new Error(`Overpass API error: ${res.status}`);
  return res.json();
}

export async function fetchCanopyTile(quadkey: string) {
  const res = await fetch(`${API_BASE}/canopy/${quadkey}/`);
  if (!res.ok) throw new Error(`Canopy API error: ${res.status}`);
  return res.arrayBuffer();
}
```

### Phase 3: Update Existing Code

Replace direct API calls with the new client. Key files to update:

- `src/lib/climate/` - frost dates, historical temps
- `src/lib/shadow/` - building footprint queries
- `src/lib/canopy/` or tile service - tree height fetching

### Phase 4: Environment Configuration

Ensure `PUBLIC_API_URL` is set correctly:
- Local dev: `http://localhost:8000/api/v1`
- Production: `https://yourdomain.com/api/v1` (routed through Caddy)

## Acceptance Criteria

1. All proxy endpoints return valid data (climate, overpass, canopy)
2. Second request to same location is served from Valkey cache
3. Frontend loads climate data through Django (visible in network tab)
4. Frontend loads building footprints through Django
5. Frontend loads canopy tiles through Django
6. No regression in existing functionality (shadow viz, sun hours, etc.)

## Out of Scope

- User authentication (separate story)
- Plan saving/loading (separate story)
- Subscription/billing (separate story)

## Dependencies

- Docker and docker-compose working on dev machine
- Postgres 16+ (dev uses 16, prod uses 18)
- Valkey 9.0
- Python 3.14, Django 6.0

## Risks

**External API availability** - If public Overpass API is down during testing, the proxy will fail. Mitigation: Check API status before debugging app issues.

**CORS issues** - If browser blocks requests to Django. Mitigation: CORS is configured for localhost:5173 in dev settings.

**Cache key collisions** - Unlikely but possible if query hashing collides. Mitigation: Use SHA256 prefix, monitor for issues.
