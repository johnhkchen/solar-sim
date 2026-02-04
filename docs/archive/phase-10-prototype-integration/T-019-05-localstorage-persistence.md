---
id: T-019-05
title: Add localStorage persistence for plot data
story: S-019
status: pending
priority: 1
complexity: S
depends_on:
  - T-019-02
output: src/routes/results/+page.svelte
---

# T-019-05: Add LocalStorage Persistence for Plot Data

Save obstacle and slope data to localStorage so users see their previous garden layout when returning to the same location.

## Context

Research at `docs/knowledge/research/app-integration.md` section R4 documents the persistence strategy with key format and Svelte 5 patterns.

## Task

Implement load/save lifecycle for plot data keyed by rounded coordinates.

## Implementation Steps

1. Define storage types:
```typescript
interface PlotStorageData {
  obstacles: PlotObstacle[];
  slope: PlotSlope;
  savedAt: string;
}
```

2. Create storage key from coordinates (2 decimal places ≈ 1km precision):
```typescript
const storageKey = $derived(
  `solar-sim:plot:${latitude.toFixed(2)}:${longitude.toFixed(2)}`
);
```

3. Load on mount:
```typescript
let isLoaded = $state(false);

$effect(() => {
  if (typeof window === 'undefined') return;
  const stored = localStorage.getItem(storageKey);
  if (stored) {
    try {
      const data = JSON.parse(stored) as PlotStorageData;
      obstacles = data.obstacles;
      slope = data.slope;
    } catch (e) {
      console.warn('Failed to parse stored plot data:', e);
    }
  }
  isLoaded = true;
});
```

4. Save on changes (debounced 500ms):
```typescript
let saveTimeout: ReturnType<typeof setTimeout> | null = null;

$effect(() => {
  if (!isLoaded) return;  // Prevent overwriting during load
  const toSave: PlotStorageData = {
    obstacles,
    slope,
    savedAt: new Date().toISOString()
  };

  if (saveTimeout) clearTimeout(saveTimeout);
  saveTimeout = setTimeout(() => {
    localStorage.setItem(storageKey, JSON.stringify(toSave));
  }, 500);
});
```

## Greppable References

- `localStorage` - Browser storage API
- `PlotObstacle` - Type at `src/lib/components/PlotEditor.svelte:12`
- `PlotSlope` - Type at `src/lib/solar/slope.ts:21`

## Acceptance Criteria

Obstacle and slope data persists across page refreshes. Different locations have separate stored data. Invalid stored data doesn't crash the page. Save is debounced during rapid changes.
