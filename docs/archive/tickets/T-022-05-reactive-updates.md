---
id: T-022-05
title: Reactive heatmap updates
status: pending
priority: 3
complexity: M
depends_on: [T-022-02]
story: S-022
---

# T-022-05: Reactive Heatmap Updates

## Objective

Heatmap updates automatically when user modifies trees, with appropriate debouncing and loading states.

## Acceptance Criteria

1. Adding/moving/deleting a tree triggers heatmap recalculation
2. Debounce rapid changes (wait 500ms after last change)
3. Show loading indicator during recalculation
4. Partial/progressive update if possible (affected area only)
5. Changing period selector also triggers update
6. No UI jank during calculation (use web worker)

## Technical Approach

### Reactivity Flow

```
Tree Change → Debounce (500ms) →
  Show "Updating..." →
    Recalculate Grid (web worker) →
      Update Heatmap Layer →
        Hide indicator
```

### Optimization: Incremental Updates

For tree moves within visible area:
- Only recalculate cells potentially affected by the tree's shadow
- Shadow max length ≈ 100m, so affected radius is tree position ± 100m
- Merge partial update into existing grid

### Web Worker

Move grid calculation to web worker to prevent UI blocking:

```typescript
// main thread
const worker = new Worker('exposure-worker.js');
worker.postMessage({ bounds, trees, dateRange });
worker.onmessage = (e) => updateHeatmap(e.data.grid);
```

## Files to Create/Modify

- `src/lib/workers/exposure-worker.ts` - new web worker
- `src/lib/components/ExposureHeatmap.svelte` - add reactivity
- Debounce utility if not already present
