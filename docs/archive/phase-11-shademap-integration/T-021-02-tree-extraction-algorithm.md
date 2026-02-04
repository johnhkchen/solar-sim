---
id: T-021-02
title: Tree extraction algorithm from height raster
status: complete
priority: 2
complexity: L
depends_on: [T-021-01]
story: S-021
completed_at: 2026-02-01
---

# T-021-02: Tree Extraction Algorithm from Height Raster

## Objective

Develop an algorithm to convert canopy height raster data into discrete tree positions with estimated heights and canopy radii.

## Completion Summary

Implementation complete in `src/lib/canopy/tree-extraction.ts` with 29 passing tests. All acceptance criteria met:

1. **Local maximum detection** finds tree crowns by identifying pixels higher than all neighbors within a configurable search radius (default 3m), using circular neighbor checking and deterministic tie-breaking for reproducible results.

2. **Two canopy radius estimation methods** are available: a simple height-based heuristic (canopyRadius = height × 0.25 by default), and a more accurate raster-based method that analyzes height falloff in 8 cardinal directions to find the actual canopy edge.

3. **Noise filtering** excludes pixels below a configurable minimum height threshold (default 3m) and handles NaN/Infinity values gracefully.

4. **Output format** produces `DetectedTree` objects with lat, lng, height, canopyRadius, and an `autoDetected` flag to distinguish satellite-derived trees from user-placed ones.

5. **Performance** is acceptable for residential-scale areas: a 100×100 pixel raster (1 hectare at 1m resolution) completes in under 10ms with uniform data and under 100ms even on slow machines with complex canopy patterns.

6. **Comprehensive test suite** includes 29 tests covering basic extraction, boundary cases, coordinate conversion, tie-breaking, and edge cases like single-pixel rasters and uniform height plateaus.

The module also provides `toMapTree()` and `toMapTrees()` utilities to convert detected trees directly to the MapTree format used by MapPicker, including automatic tree type classification based on height and canopy ratio heuristics.

## Files Created

- `src/lib/canopy/tree-extraction.ts` - Core algorithm implementation
- `src/lib/canopy/tree-extraction.test.ts` - Test suite (29 tests)
- `src/lib/canopy/index.ts` - Module exports

## Technical Approach Used

Implemented Option A (Local Maximum Detection) as planned, with enhancements for configurable search radius and optional raster-based canopy radius estimation.

## API Reference

```typescript
// Primary extraction function with height-based radius
extractTrees(heightRaster, width, height, bounds, options?) → DetectedTree[]

// Alternative with raster-derived canopy radius
extractTreesWithRasterRadius(heightRaster, width, height, bounds, pixelResolution?, options?)

// Convert to MapPicker format
toMapTree(tree, idPrefix?, index?) → MapTree
toMapTrees(trees, idPrefix?) → MapTree[]
```

## Notes

The canopy radius estimation heuristic uses 0.25 as the default ratio since species information isn't available from the satellite data. The raster-based method provides better accuracy when the height data has clear canopy falloff patterns.
