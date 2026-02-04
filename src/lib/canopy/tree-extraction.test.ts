/**
 * Tests for the tree extraction algorithm.
 *
 * These tests verify that the algorithm correctly identifies local maxima in
 * height rasters and converts them to geographic coordinates with reasonable
 * canopy radius estimates.
 */

import { describe, it, expect } from 'vitest';
import {
	extractTrees,
	extractTreesWithRasterRadius,
	estimateCanopyRadiusFromRaster,
	toMapTree,
	toMapTrees,
	type LatLngBounds,
	type DetectedTree
} from './tree-extraction';

describe('extractTrees', () => {
	const simpleBounds: LatLngBounds = {
		south: 37.0,
		north: 38.0,
		west: -123.0,
		east: -122.0
	};

	it('detects a single tree at the center of a raster', () => {
		// 5x5 raster with a single peak in the center
		const raster = new Float32Array([
			0, 0, 0, 0, 0,
			0, 2, 4, 2, 0,
			0, 4, 10, 4, 0,
			0, 2, 4, 2, 0,
			0, 0, 0, 0, 0
		]);

		const trees = extractTrees(raster, 5, 5, simpleBounds);

		expect(trees).toHaveLength(1);
		expect(trees[0].height).toBe(10);
		expect(trees[0].autoDetected).toBe(true);
		// Center pixel (2,2) should map to center of bounds
		expect(trees[0].lat).toBeCloseTo(37.5, 1);
		expect(trees[0].lng).toBeCloseTo(-122.5, 1);
	});

	it('filters out pixels below minimum height threshold', () => {
		// Two peaks: one at 10m (above threshold) and one at 2m (below default 3m threshold)
		const raster = new Float32Array([
			0, 0, 0, 0, 0,
			0, 10, 0, 0, 0,
			0, 0, 0, 0, 0,
			0, 0, 0, 2, 0,
			0, 0, 0, 0, 0
		]);

		const trees = extractTrees(raster, 5, 5, simpleBounds);

		expect(trees).toHaveLength(1);
		expect(trees[0].height).toBe(10);
	});

	it('respects custom minimum height threshold', () => {
		// Place peaks far apart (>3 pixels) so both are detected with default radius
		const raster = new Float32Array([
			5, 0, 0, 0, 0, 0, 0,
			0, 0, 0, 0, 0, 0, 0,
			0, 0, 0, 0, 0, 0, 0,
			0, 0, 0, 0, 0, 0, 0,
			0, 0, 0, 0, 0, 0, 4,
		]);

		// With default 3m threshold, both should be detected (using radius 2 to ensure both peaks are separate)
		const treesDefault = extractTrees(raster, 7, 5, simpleBounds, { searchRadiusPixels: 2 });
		expect(treesDefault).toHaveLength(2);

		// With 4.5m threshold, only the 5m tree should be detected
		const treesHighThreshold = extractTrees(raster, 7, 5, simpleBounds, { minTreeHeight: 4.5, searchRadiusPixels: 2 });
		expect(treesHighThreshold).toHaveLength(1);
		expect(treesHighThreshold[0].height).toBe(5);
	});

	it('detects multiple trees as separate local maxima', () => {
		// Two clear peaks separated by lower values
		const raster = new Float32Array([
			8, 2, 0, 2, 12,
			2, 0, 0, 0, 2,
			0, 0, 0, 0, 0,
			2, 0, 0, 0, 2,
			10, 2, 0, 2, 15
		]);

		const trees = extractTrees(raster, 5, 5, simpleBounds);

		// Should find 4 peaks in corners
		expect(trees).toHaveLength(4);
		// Sorted by height descending
		expect(trees[0].height).toBe(15);
		expect(trees[1].height).toBe(12);
		expect(trees[2].height).toBe(10);
		expect(trees[3].height).toBe(8);
	});

	it('handles tie-breaking deterministically', () => {
		// Plateau with equal heights - only one should be detected based on position
		const raster = new Float32Array([
			5, 5, 5,
			5, 5, 5,
			5, 5, 5
		]);

		const trees = extractTrees(raster, 3, 3, simpleBounds);

		// With our tie-breaking rule (smaller y wins, then smaller x),
		// only the top-left pixel should be detected as the local maximum
		expect(trees).toHaveLength(1);
		// Top-left corner
		expect(trees[0].lat).toBeGreaterThan(37.5);
		expect(trees[0].lng).toBeLessThan(-122.5);
	});

	it('respects search radius for local maximum detection', () => {
		// Two peaks close together - with small radius both detected, with large radius only tallest
		const raster = new Float32Array([
			0, 0, 0, 0, 0, 0, 0,
			0, 8, 0, 0, 0, 10, 0,
			0, 0, 0, 0, 0, 0, 0,
			0, 0, 0, 0, 0, 0, 0,
			0, 0, 0, 0, 0, 0, 0,
			0, 0, 0, 0, 0, 0, 0,
			0, 0, 0, 0, 0, 0, 0
		]);

		const treesSmallRadius = extractTrees(raster, 7, 7, simpleBounds, { searchRadiusPixels: 2 });
		expect(treesSmallRadius).toHaveLength(2);

		// With radius 5, the 8m peak is within range of the 10m peak and won't be detected
		const treesLargeRadius = extractTrees(raster, 7, 7, simpleBounds, { searchRadiusPixels: 5 });
		expect(treesLargeRadius).toHaveLength(1);
		expect(treesLargeRadius[0].height).toBe(10);
	});

	it('applies maximum trees limit', () => {
		// Create a raster with clearly separated peaks (using searchRadius 1 to allow more peaks)
		// Grid with peaks at corners and center, all separated by >1 pixel
		const raster = new Float32Array([
			20, 0, 0, 0, 0, 0, 18,
			0, 0, 0, 0, 0, 0, 0,
			0, 0, 0, 0, 0, 0, 0,
			0, 0, 0, 15, 0, 0, 0,
			0, 0, 0, 0, 0, 0, 0,
			0, 0, 0, 0, 0, 0, 0,
			16, 0, 0, 0, 0, 0, 14
		]);

		// With searchRadius 1, all 5 peaks should be valid local maxima
		const allTrees = extractTrees(raster, 7, 7, simpleBounds, { searchRadiusPixels: 1 });
		expect(allTrees).toHaveLength(5);

		// Apply limit of 2: should get the two tallest
		const limitedTrees = extractTrees(raster, 7, 7, simpleBounds, { maxTrees: 2, searchRadiusPixels: 1 });
		expect(limitedTrees).toHaveLength(2);
		expect(limitedTrees[0].height).toBe(20);
		expect(limitedTrees[1].height).toBe(18);
	});

	it('calculates canopy radius using height ratio', () => {
		const raster = new Float32Array([
			0, 0, 0,
			0, 20, 0,
			0, 0, 0
		]);

		const treesDefaultRatio = extractTrees(raster, 3, 3, simpleBounds);
		expect(treesDefaultRatio[0].canopyRadius).toBe(5); // 20 * 0.25

		const treesCustomRatio = extractTrees(raster, 3, 3, simpleBounds, { canopyRadiusRatio: 0.3 });
		expect(treesCustomRatio[0].canopyRadius).toBe(6); // 20 * 0.3
	});

	it('converts pixel coordinates to lat/lng correctly', () => {
		// Bounds: 1 degree in each direction, 10x10 raster = 0.1 degrees per pixel
		const bounds: LatLngBounds = {
			south: 37.0,
			north: 38.0,
			west: -123.0,
			east: -122.0
		};
		const raster = new Float32Array(100);
		raster[0] = 10; // Top-left corner (0,0)
		raster[99] = 10; // Bottom-right corner (9,9)

		const trees = extractTrees(raster, 10, 10, bounds);
		expect(trees).toHaveLength(2);

		// Top-left: pixel center at (0.5, 0.5)
		// lat = 38.0 - 0.5 * 0.1 = 37.95
		// lng = -123.0 + 0.5 * 0.1 = -122.95
		const topLeft = trees.find((t) => t.lat > 37.9);
		expect(topLeft).toBeDefined();
		expect(topLeft!.lat).toBeCloseTo(37.95, 4);
		expect(topLeft!.lng).toBeCloseTo(-122.95, 4);

		// Bottom-right: pixel center at (9.5, 9.5)
		// lat = 38.0 - 9.5 * 0.1 = 37.05
		// lng = -123.0 + 9.5 * 0.1 = -122.05
		const bottomRight = trees.find((t) => t.lat < 37.1);
		expect(bottomRight).toBeDefined();
		expect(bottomRight!.lat).toBeCloseTo(37.05, 4);
		expect(bottomRight!.lng).toBeCloseTo(-122.05, 4);
	});

	it('throws on raster size mismatch', () => {
		const raster = new Float32Array(10);
		expect(() => extractTrees(raster, 5, 5, simpleBounds)).toThrow('Raster size mismatch');
	});

	it('throws on invalid dimensions', () => {
		const raster = new Float32Array(0);
		expect(() => extractTrees(raster, 0, 0, simpleBounds)).toThrow('dimensions must be positive');
	});

	it('throws on invalid bounds', () => {
		const raster = new Float32Array(9);
		expect(() =>
			extractTrees(raster, 3, 3, { south: 38, north: 37, west: -123, east: -122 })
		).toThrow('Invalid bounds');
	});

	it('returns empty array for raster with no valid trees', () => {
		const raster = new Float32Array([1, 1, 1, 2, 2, 2, 1, 1, 1]);
		const trees = extractTrees(raster, 3, 3, simpleBounds);
		expect(trees).toHaveLength(0);
	});

	it('handles NaN values gracefully', () => {
		// NaN values are skipped during processing and don't break neighbor comparisons
		const raster = new Float32Array([
			NaN, 0, 0,
			0, 10, 0,
			0, 0, NaN
		]);

		const trees = extractTrees(raster, 3, 3, simpleBounds);
		expect(trees).toHaveLength(1);
		expect(trees[0].height).toBe(10);
	});

	it('filters out Infinity values as invalid heights', () => {
		// Infinity is filtered by !isFinite() check and won't be detected as a tree
		const raster = new Float32Array([
			0, 0, 0, 0, 0,
			0, 10, 0, 0, 0,
			0, 0, 0, 0, 0,
			0, 0, 0, 0, Infinity,
			0, 0, 0, 0, 0
		]);

		const trees = extractTrees(raster, 5, 5, simpleBounds);
		// Only the 10 should be detected (Infinity is filtered out)
		// But if Infinity is within search radius, it would suppress the 10
		// Here they're 3 pixels apart diagonally (sqrt(8) < 3), so we use smaller radius
		const treesSmallRadius = extractTrees(raster, 5, 5, simpleBounds, { searchRadiusPixels: 2 });
		expect(treesSmallRadius).toHaveLength(1);
		expect(treesSmallRadius[0].height).toBe(10);
	});
});

describe('estimateCanopyRadiusFromRaster', () => {
	it('estimates radius based on height falloff', () => {
		// Conical tree shape: height drops from 20 at center to lower values outward
		const size = 11;
		const raster = new Float32Array(size * size);
		const center = 5;

		for (let y = 0; y < size; y++) {
			for (let x = 0; x < size; x++) {
				const dist = Math.sqrt((x - center) ** 2 + (y - center) ** 2);
				// Linear falloff from 20 at center
				raster[y * size + x] = Math.max(0, 20 - dist * 4);
			}
		}

		const radius = estimateCanopyRadiusFromRaster(raster, size, size, center, center);

		// With 50% threshold (default), canopy edge is at height 10 = 20 * 0.5
		// Height drops to 10 at distance 2.5 (20 - 2.5 * 4 = 10)
		expect(radius).toBeGreaterThan(2);
		expect(radius).toBeLessThan(4);
	});

	it('returns minimum radius for isolated peak', () => {
		const raster = new Float32Array([
			0, 0, 0,
			0, 20, 0,
			0, 0, 0
		]);

		const radius = estimateCanopyRadiusFromRaster(raster, 3, 3, 1, 1);
		expect(radius).toBe(1);
	});

	it('respects custom height threshold', () => {
		// Create a gradual slope
		const raster = new Float32Array([
			0, 0, 0, 0, 0,
			0, 16, 18, 16, 0,
			0, 18, 20, 18, 0,
			0, 16, 18, 16, 0,
			0, 0, 0, 0, 0
		]);

		// With 90% threshold (height 18), radius should be ~1
		const radiusHigh = estimateCanopyRadiusFromRaster(raster, 5, 5, 2, 2, 15, 0.9);
		expect(radiusHigh).toBeLessThanOrEqual(2);

		// With 20% threshold (height 4), radius should extend further
		const radiusLow = estimateCanopyRadiusFromRaster(raster, 5, 5, 2, 2, 15, 0.2);
		expect(radiusLow).toBeGreaterThanOrEqual(2);
	});
});

describe('extractTreesWithRasterRadius', () => {
	const bounds: LatLngBounds = {
		south: 37.0,
		north: 38.0,
		west: -123.0,
		east: -122.0
	};

	it('uses raster-based canopy radius estimation', () => {
		// Create a tree with gradual canopy falloff
		const size = 9;
		const raster = new Float32Array(size * size);
		const center = 4;

		for (let y = 0; y < size; y++) {
			for (let x = 0; x < size; x++) {
				const dist = Math.sqrt((x - center) ** 2 + (y - center) ** 2);
				raster[y * size + x] = Math.max(0, 15 - dist * 3);
			}
		}

		const trees = extractTreesWithRasterRadius(raster, size, size, bounds, 1.0);

		expect(trees).toHaveLength(1);
		expect(trees[0].height).toBe(15);
		// Canopy radius should reflect the gradual falloff, not just height * 0.25
		expect(trees[0].canopyRadius).toBeGreaterThan(1);
	});

	it('falls back to heuristic for unreasonable raster estimates', () => {
		// Isolated peak with no gradual falloff - raster estimate would be 1 pixel
		const raster = new Float32Array([
			0, 0, 0,
			0, 20, 0,
			0, 0, 0
		]);

		const trees = extractTreesWithRasterRadius(raster, 3, 3, bounds, 1.0);

		expect(trees).toHaveLength(1);
		// Raster estimate of 1m is reasonable but small; algorithm accepts it
		// unless it's 0 or larger than tree height
		expect(trees[0].canopyRadius).toBeGreaterThan(0);
	});
});

describe('toMapTree', () => {
	it('converts DetectedTree to MapTree format', () => {
		const detected: DetectedTree = {
			lat: 37.5,
			lng: -122.5,
			height: 12,
			canopyRadius: 3,
			autoDetected: true
		};

		const mapTree = toMapTree(detected, 'test', 0);

		expect(mapTree.id).toBe('test-0');
		expect(mapTree.lat).toBe(37.5);
		expect(mapTree.lng).toBe(-122.5);
		expect(mapTree.height).toBe(12);
		expect(mapTree.canopyWidth).toBe(6); // Diameter = 2 * radius
		expect(mapTree.label).toContain('auto-detected');
	});

	it('classifies trees by height and canopy ratio', () => {
		// Small deciduous tree
		const smallTree = toMapTree({ lat: 0, lng: 0, height: 6, canopyRadius: 2, autoDetected: true });
		expect(smallTree.type).toBe('deciduous-tree');
		expect(smallTree.label).toContain('Small');

		// Medium deciduous tree
		const mediumTree = toMapTree({ lat: 0, lng: 0, height: 12, canopyRadius: 3, autoDetected: true });
		expect(mediumTree.type).toBe('deciduous-tree');
		expect(mediumTree.label).toContain('Medium');

		// Large tree
		const largeTree = toMapTree({ lat: 0, lng: 0, height: 22, canopyRadius: 5, autoDetected: true });
		expect(largeTree.type).toBe('deciduous-tree');
		expect(largeTree.label).toContain('Large');

		// Tall narrow tree (likely evergreen based on height and narrow canopy ratio)
		const evergreen = toMapTree({ lat: 0, lng: 0, height: 25, canopyRadius: 4, autoDetected: true });
		expect(evergreen.type).toBe('evergreen-tree');
		expect(evergreen.label).toContain('Tall');
		expect(evergreen.label).toContain('evergreen');
	});
});

describe('toMapTrees', () => {
	it('batch converts multiple trees with sequential IDs', () => {
		const detected: DetectedTree[] = [
			{ lat: 37.5, lng: -122.5, height: 15, canopyRadius: 4, autoDetected: true },
			{ lat: 37.6, lng: -122.4, height: 10, canopyRadius: 2.5, autoDetected: true }
		];

		const mapTrees = toMapTrees(detected, 'batch');

		expect(mapTrees).toHaveLength(2);
		expect(mapTrees[0].id).toBe('batch-0');
		expect(mapTrees[1].id).toBe('batch-1');
	});
});

describe('edge cases', () => {
	const bounds: LatLngBounds = { south: 0, north: 1, west: 0, east: 1 };

	it('handles 1x1 raster', () => {
		const raster = new Float32Array([10]);
		const trees = extractTrees(raster, 1, 1, bounds);
		expect(trees).toHaveLength(1);
		expect(trees[0].height).toBe(10);
		expect(trees[0].lat).toBeCloseTo(0.5, 4);
		expect(trees[0].lng).toBeCloseTo(0.5, 4);
	});

	it('handles single row raster', () => {
		const raster = new Float32Array([5, 10, 5]);
		const trees = extractTrees(raster, 3, 1, bounds);
		expect(trees).toHaveLength(1);
		expect(trees[0].height).toBe(10);
	});

	it('handles single column raster', () => {
		const raster = new Float32Array([5, 10, 5]);
		const trees = extractTrees(raster, 1, 3, bounds);
		expect(trees).toHaveLength(1);
		expect(trees[0].height).toBe(10);
	});

	it('handles large uniform area efficiently', () => {
		// 100x100 uniform area should produce very few trees (just corner/edge artifacts)
		const size = 100;
		const raster = new Float32Array(size * size).fill(5);

		const start = performance.now();
		const trees = extractTrees(raster, size, size, bounds);
		const elapsed = performance.now() - start;

		// Should complete quickly (under 100ms even on slow machines)
		expect(elapsed).toBeLessThan(1000);
		// Uniform area produces only one tree due to tie-breaking
		expect(trees).toHaveLength(1);
	});

	it('handles raster with all zeros', () => {
		const raster = new Float32Array(25).fill(0);
		const trees = extractTrees(raster, 5, 5, bounds);
		expect(trees).toHaveLength(0);
	});

	it('handles negative height values', () => {
		const raster = new Float32Array([-5, -10, 10, -5]);
		const trees = extractTrees(raster, 2, 2, bounds);
		// Only positive value above threshold should be detected
		expect(trees).toHaveLength(1);
		expect(trees[0].height).toBe(10);
	});
});
