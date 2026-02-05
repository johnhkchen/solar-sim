---
id: T-024-02
title: Create SvelteKit API client module
story: S-024
status: pending
priority: 1
complexity: S
depends_on: [T-024-01]
---

# T-024-02: Create SvelteKit API Client Module

## Task

Create a centralized API client module that abstracts communication with the Django backend. This provides a single place to configure the API URL, handle errors, and add features like retry logic later.

## Implementation

Create `src/lib/api/client.ts`:

```typescript
/**
 * API client for Django backend.
 *
 * All external data fetches (climate, OSM, canopy) should go through
 * this client to benefit from Valkey caching on the backend.
 */

const API_BASE = import.meta.env.PUBLIC_API_URL ?? 'http://localhost:8000/api/v1';

export class ApiError extends Error {
  constructor(
    public status: number,
    public endpoint: string,
    message: string
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const url = `${API_BASE}${path}`;
  const res = await fetch(url, options);

  if (!res.ok) {
    throw new ApiError(res.status, path, `API error: ${res.status} ${res.statusText}`);
  }

  return res.json();
}

/**
 * Fetch historical climate data for a location.
 * Returns 30 years of daily min/max temperatures.
 */
export async function fetchClimate(lat: number, lng: number): Promise<ClimateResponse> {
  return request(`/climate/?lat=${lat}&lng=${lng}`);
}

/**
 * Query OpenStreetMap data via Overpass API.
 * Used for building footprints for shadow casting.
 */
export async function fetchOverpass(query: string): Promise<OverpassResponse> {
  return request('/overpass/', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query }),
  });
}

/**
 * Fetch a canopy height GeoTIFF tile.
 * Returns raw bytes for client-side processing.
 */
export async function fetchCanopyTile(quadkey: string): Promise<ArrayBuffer> {
  const url = `${API_BASE}/canopy/${quadkey}/`;
  const res = await fetch(url);

  if (!res.ok) {
    throw new ApiError(res.status, `/canopy/${quadkey}/`, `Tile fetch error: ${res.status}`);
  }

  return res.arrayBuffer();
}

// Type definitions
export interface ClimateResponse {
  latitude: number;
  longitude: number;
  timezone: string;
  daily: {
    time: string[];
    temperature_2m_max: number[];
    temperature_2m_min: number[];
  };
}

export interface OverpassResponse {
  version: number;
  elements: OverpassElement[];
}

export interface OverpassElement {
  type: 'node' | 'way' | 'relation';
  id: number;
  lat?: number;
  lon?: number;
  nodes?: number[];
  tags?: Record<string, string>;
}
```

Also create `src/lib/api/index.ts`:

```typescript
export * from './client';
```

## Environment Variable

Ensure `PUBLIC_API_URL` is documented. Add to `.env.example` if it doesn't exist:

```bash
# Django API URL (for SvelteKit to proxy through)
PUBLIC_API_URL=http://localhost:8000/api/v1
```

## Acceptance Criteria

- [ ] `src/lib/api/client.ts` exists with all three fetch functions
- [ ] TypeScript types for responses are defined
- [ ] `ApiError` class provides useful error context
- [ ] Module exports cleanly from `src/lib/api/index.ts`
- [ ] `PUBLIC_API_URL` env var is documented
