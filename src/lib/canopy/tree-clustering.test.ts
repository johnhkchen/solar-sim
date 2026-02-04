/**
 * Tests for tree clustering.
 */

import { describe, it, expect } from 'vitest';
import {
	clusterTrees,
	getClusteringOptionsForZoom,
	estimateTreeMemory,
	wouldExceedMemoryGuidelines,
	MEMORY_WARNING_THRESHOLD
} from './tree-clustering.js';
import type { DetectedTree } from './tree-extraction.js';

/**
 * Creates a detected tree at the given coordinates.
 */
function createTree(lat: number, lng: number, height = 10): DetectedTree {
	return {
		lat,
		lng,
		height,
		canopyRadius: height * 0.25,
		autoDetected: true
	};
}

/**
 * Creates a grid of trees for testing.
 */
function createTreeGrid(
	startLat: number,
	startLng: number,
	rows: number,
	cols: number,
	spacing: number = 0.00005
): DetectedTree[] {
	const trees: DetectedTree[] = [];
	for (let row = 0; row < rows; row++) {
		for (let col = 0; col < cols; col++) {
			trees.push(
				createTree(
					startLat + row * spacing,
					startLng + col * spacing,
					5 + Math.random() * 20
				)
			);
		}
	}
	return trees;
}

describe('clusterTrees', () => {
	it('returns original trees when below threshold', () => {
		const trees = [
			createTree(37.5, -122.5),
			createTree(37.501, -122.501),
			createTree(37.502, -122.502)
		];

		const result = clusterTrees(trees, { clusterThreshold: 100 });

		expect(result.wasClustered).toBe(false);
		expect(result.trees).toHaveLength(3);
		expect(result.originalCount).toBe(3);
	});

	it('clusters trees when above threshold', () => {
		// Create 200 trees in a small area
		const trees = createTreeGrid(37.5, -122.5, 20, 10);

		const result = clusterTrees(trees, {
			clusterThreshold: 50,
			maxOutput: 20,
			cellSizeDegrees: 0.0002
		});

		expect(result.wasClustered).toBe(true);
		expect(result.originalCount).toBe(200);
		expect(result.trees.length).toBeLessThanOrEqual(20);
		expect(result.clusters).toBeDefined();
	});

	it('preserves maximum height in clusters', () => {
		// Create trees with known heights that will cluster together
		const trees = [
			createTree(37.5, -122.5, 5),
			createTree(37.50001, -122.50001, 15),
			createTree(37.50002, -122.50002, 10)
		];

		const result = clusterTrees(trees, {
			clusterThreshold: 1,
			maxOutput: 1,
			cellSizeDegrees: 0.001
		});

		expect(result.wasClustered).toBe(true);
		expect(result.trees).toHaveLength(1);
		expect(result.trees[0].height).toBe(15); // Maximum height
	});

	it('produces centroid coordinates for clusters', () => {
		// Create trees at known positions
		const trees = [
			createTree(37.5, -122.5),
			createTree(37.502, -122.502)
		];

		const result = clusterTrees(trees, {
			clusterThreshold: 1,
			maxOutput: 1,
			cellSizeDegrees: 0.01 // Large cell to force clustering
		});

		expect(result.wasClustered).toBe(true);
		expect(result.trees).toHaveLength(1);
		// Centroid should be between the two trees
		expect(result.trees[0].lat).toBeCloseTo(37.501, 3);
		expect(result.trees[0].lng).toBeCloseTo(-122.501, 3);
	});

	it('coarsens grid when initial clustering exceeds maxOutput', () => {
		// Create many widely-spaced trees
		const trees = createTreeGrid(37.5, -122.5, 15, 15, 0.0005);

		const result = clusterTrees(trees, {
			clusterThreshold: 50,
			maxOutput: 30,
			cellSizeDegrees: 0.0001
		});

		expect(result.wasClustered).toBe(true);
		// The algorithm coarsens the grid but may not hit exact limit
		expect(result.trees.length).toBeLessThan(trees.length);
		expect(result.cellSize).toBeGreaterThan(0.0001);
	});

	it('sorts clusters by height descending', () => {
		const trees = [
			createTree(37.5, -122.5, 5),
			createTree(37.6, -122.6, 20),
			createTree(37.7, -122.7, 10)
		];

		const result = clusterTrees(trees, {
			clusterThreshold: 1,
			maxOutput: 10,
			cellSizeDegrees: 0.01
		});

		expect(result.wasClustered).toBe(true);
		// Check heights are sorted descending
		for (let i = 1; i < result.trees.length; i++) {
			expect(result.trees[i].height).toBeLessThanOrEqual(result.trees[i - 1].height);
		}
	});

	it('handles empty tree array', () => {
		const result = clusterTrees([]);

		expect(result.wasClustered).toBe(false);
		expect(result.trees).toHaveLength(0);
		expect(result.originalCount).toBe(0);
	});

	it('handles single tree', () => {
		const trees = [createTree(37.5, -122.5)];

		const result = clusterTrees(trees);

		expect(result.wasClustered).toBe(false);
		expect(result.trees).toHaveLength(1);
	});
});

describe('getClusteringOptionsForZoom', () => {
	it('returns no clustering for small tree counts', () => {
		const options = getClusteringOptionsForZoom(30, 15);
		expect(options.clusterThreshold).toBe(Infinity);
	});

	it('returns minimal clustering for high zoom', () => {
		const options = getClusteringOptionsForZoom(500, 18);
		expect(options.cellSizeDegrees).toBeLessThan(0.0001);
		expect(options.maxOutput).toBeGreaterThan(100);
	});

	it('returns moderate clustering for medium zoom', () => {
		const options = getClusteringOptionsForZoom(500, 14);
		expect(options.cellSizeDegrees).toBeGreaterThan(0.0001);
		expect(options.maxOutput).toBeLessThanOrEqual(100);
	});

	it('returns aggressive clustering for low zoom', () => {
		const options = getClusteringOptionsForZoom(500, 10);
		expect(options.cellSizeDegrees).toBeGreaterThan(0.0005);
		expect(options.maxOutput).toBeLessThan(100);
	});
});

describe('memory estimation', () => {
	it('estimates memory for tree count', () => {
		const smallMemory = estimateTreeMemory(10);
		const largeMemory = estimateTreeMemory(1000);

		expect(smallMemory).toBeLessThan(largeMemory);
		expect(largeMemory).toBeGreaterThan(1000000); // >1MB for 1000 trees
	});

	it('warns when memory would be exceeded', () => {
		// 100MB threshold / ~2.2KB per tree = ~45000 trees
		expect(wouldExceedMemoryGuidelines(100)).toBe(false);
		expect(wouldExceedMemoryGuidelines(50000)).toBe(true);
	});

	it('exports memory threshold constant', () => {
		expect(MEMORY_WARNING_THRESHOLD).toBe(100 * 1024 * 1024);
	});
});
