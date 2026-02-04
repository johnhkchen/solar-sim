---
id: T-021-06
title: Performance optimization for tree detection
status: complete
priority: 4
complexity: M
depends_on: [T-021-04]
story: S-021
---

# T-021-06: Performance Optimization for Tree Detection

## Objective

Ensure tree detection performs acceptably for typical residential use cases, with graceful degradation for dense forest areas.

## Acceptance Criteria

1. Tree detection completes in <3s for typical residential lot
2. GeoTIFF tile fetch uses appropriate caching headers
3. Tree extraction runs in web worker (doesn't block UI)
4. Dense areas (>500 trees) use clustering or LOD
5. Memory usage stays reasonable (<100MB for typical session)

## Implementation

The performance optimization adds several layers of caching, async processing, and graceful degradation.

### Web Worker for Tree Extraction

The `tree-extraction.worker.ts` module offloads the CPU-intensive local maximum detection algorithm from the main thread. The `worker-manager.ts` provides a promise-based API that falls back to synchronous execution when web workers aren't available (like during SSR). Usage is simple: call `extractTreesAsync()` instead of `extractTrees()` to get non-blocking tree detection.

### Two-Layer Tile Caching

The tile service now uses a layered caching strategy. The in-memory LRU cache provides sub-millisecond access for recently-used tiles, limited to 20 entries to bound memory usage. IndexedDB in `tile-cache-idb.ts` persists tiles for up to 7 days, avoiding network requests when users revisit areas. The IDB cache auto-evicts when it exceeds 50 tiles, prioritizing recently-accessed data.

### Tree Clustering for Dense Areas

When detection finds more than 100 trees, the `tree-clustering.ts` module groups nearby trees into representative clusters. The algorithm uses a grid-based approach where each grid cell produces a single tree at the centroid of its members, with the maximum height and canopy from the cluster. The grid cell size adapts based on zoom level: finer at high zoom (street level), coarser when zoomed out.

### Performance Metrics

The `performance-metrics.ts` module tracks timing data for each phase of detection: tile fetch, extraction, and rendering. It calculates aggregates over a sliding window including P95 latencies and the percentage of detections meeting the 3-second target. Call `formatMetrics(getLatestMetrics())` to see a human-readable breakdown.

### Files Added

- `src/lib/canopy/tree-extraction.worker.ts` - Web worker for extraction
- `src/lib/canopy/worker-manager.ts` - Worker lifecycle and promise API
- `src/lib/canopy/tile-cache-idb.ts` - IndexedDB tile persistence
- `src/lib/canopy/tree-clustering.ts` - Grid-based tree clustering
- `src/lib/canopy/performance-metrics.ts` - Timing metrics collection
- `src/lib/canopy/tree-clustering.test.ts` - Clustering unit tests
- `src/lib/canopy/performance-metrics.test.ts` - Metrics unit tests

### Files Modified

- `src/lib/canopy/tile-service.ts` - Integrated IDB cache layer
- `src/lib/canopy/index.ts` - Exported new modules
