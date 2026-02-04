/**
 * Tree clustering for dense areas.
 *
 * When tree detection finds more trees than the UI can reasonably display (typically
 * in forested areas), this module clusters nearby trees into representative groups.
 * This improves rendering performance and reduces visual clutter while preserving
 * the overall spatial distribution of trees.
 *
 * The clustering algorithm uses a simple grid-based approach that's fast and produces
 * predictable results. Trees are assigned to grid cells, and each non-empty cell
 * produces a single representative tree at the centroid of its members.
 */

import type { DetectedTree } from './tree-extraction.js';

/**
 * Configuration for tree clustering.
 */
export interface ClusteringOptions {
	/**
	 * Grid cell size in degrees.
	 * Smaller values produce more clusters (finer detail), larger values produce fewer.
	 * Default: 0.0001 (~11 meters at mid-latitudes)
	 */
	cellSizeDegrees?: number;

	/**
	 * Minimum number of trees to trigger clustering.
	 * Below this threshold, trees are returned as-is.
	 * Default: 100
	 */
	clusterThreshold?: number;

	/**
	 * Maximum number of output clusters/trees.
	 * If clustering still produces more than this, the grid is coarsened.
	 * Default: 100
	 */
	maxOutput?: number;
}

const DEFAULT_OPTIONS: Required<ClusteringOptions> = {
	cellSizeDegrees: 0.0001,
	clusterThreshold: 100,
	maxOutput: 100
};

/**
 * A cluster of nearby trees represented as a single point.
 */
export interface TreeCluster {
	/** Representative tree (centroid of cluster) */
	representative: DetectedTree;
	/** Number of trees in this cluster */
	memberCount: number;
	/** IDs of original trees in this cluster (for tracking) */
	memberIds?: string[];
}

/**
 * Result of clustering operation.
 */
export interface ClusteringResult {
	/** Clustered trees (or original trees if below threshold) */
	trees: DetectedTree[];
	/** True if clustering was applied */
	wasClustered: boolean;
	/** Number of original trees before clustering */
	originalCount: number;
	/** Cluster details (only if wasClustered is true) */
	clusters?: TreeCluster[];
	/** Grid cell size used (degrees) */
	cellSize: number;
}

/**
 * Creates a grid key from coordinates.
 */
function gridKey(lat: number, lng: number, cellSize: number): string {
	const gridLat = Math.floor(lat / cellSize);
	const gridLng = Math.floor(lng / cellSize);
	return `${gridLat},${gridLng}`;
}

/**
 * Clusters trees using a grid-based algorithm.
 *
 * Trees are assigned to grid cells, and each cell produces a single representative
 * tree at the centroid of its members. The representative's height and canopy radius
 * are the maximum values from the cluster members (representing the dominant tree).
 *
 * @param trees - Input trees to cluster
 * @param options - Clustering configuration
 * @returns Clustering result with representative trees
 *
 * @example
 * ```typescript
 * const result = clusterTrees(detectedTrees, { maxOutput: 50 });
 * if (result.wasClustered) {
 *   console.log(`Reduced ${result.originalCount} trees to ${result.trees.length}`);
 * }
 * ```
 */
export function clusterTrees(
	trees: DetectedTree[],
	options: ClusteringOptions = {}
): ClusteringResult {
	const opts = { ...DEFAULT_OPTIONS, ...options };

	// Return early if below threshold
	if (trees.length <= opts.clusterThreshold) {
		return {
			trees,
			wasClustered: false,
			originalCount: trees.length,
			cellSize: opts.cellSizeDegrees
		};
	}

	// Start with the configured cell size
	let cellSize = opts.cellSizeDegrees;
	let clusters: Map<string, DetectedTree[]>;
	let attempts = 0;
	const maxAttempts = 5;

	// Iteratively coarsen the grid if we still have too many clusters
	do {
		clusters = new Map();

		for (const tree of trees) {
			const key = gridKey(tree.lat, tree.lng, cellSize);
			const existing = clusters.get(key);
			if (existing) {
				existing.push(tree);
			} else {
				clusters.set(key, [tree]);
			}
		}

		// If under the limit, we're done
		if (clusters.size <= opts.maxOutput) {
			break;
		}

		// Double the cell size to create coarser clusters
		cellSize *= 2;
		attempts++;
	} while (attempts < maxAttempts);

	// Create representative trees from clusters
	const clusterDetails: TreeCluster[] = [];
	const representativeTrees: DetectedTree[] = [];

	for (const members of clusters.values()) {
		// Calculate centroid
		const centroidLat = members.reduce((sum, t) => sum + t.lat, 0) / members.length;
		const centroidLng = members.reduce((sum, t) => sum + t.lng, 0) / members.length;

		// Use maximum height and canopy from the cluster (dominant tree)
		const maxHeight = Math.max(...members.map((t) => t.height));
		const maxCanopy = Math.max(...members.map((t) => t.canopyRadius));

		const representative: DetectedTree = {
			lat: centroidLat,
			lng: centroidLng,
			height: maxHeight,
			canopyRadius: maxCanopy,
			autoDetected: true
		};

		representativeTrees.push(representative);

		if (members.length > 1) {
			clusterDetails.push({
				representative,
				memberCount: members.length
			});
		} else {
			// Single tree, not really a cluster
			clusterDetails.push({
				representative: members[0],
				memberCount: 1
			});
		}
	}

	// Sort by height (tallest first) to maintain consistent ordering
	representativeTrees.sort((a, b) => b.height - a.height);

	return {
		trees: representativeTrees,
		wasClustered: true,
		originalCount: trees.length,
		clusters: clusterDetails,
		cellSize
	};
}

/**
 * Determines the appropriate clustering level based on zoom and tree count.
 *
 * At low zoom levels (zoomed out), more aggressive clustering is applied.
 * At high zoom levels (zoomed in), less clustering or none is applied.
 *
 * @param treeCount - Number of trees detected
 * @param zoomLevel - Current map zoom level (Leaflet zoom)
 * @returns Recommended clustering options for this view
 */
export function getClusteringOptionsForZoom(
	treeCount: number,
	zoomLevel: number
): ClusteringOptions {
	// No clustering needed for small counts
	if (treeCount < 50) {
		return { clusterThreshold: Infinity };
	}

	// Zoom levels: 15+ = street level, 13-14 = neighborhood, <13 = city/region
	if (zoomLevel >= 17) {
		// Very zoomed in: minimal clustering
		return {
			cellSizeDegrees: 0.00005, // ~5m
			clusterThreshold: 200,
			maxOutput: 300
		};
	} else if (zoomLevel >= 15) {
		// Street level: light clustering
		return {
			cellSizeDegrees: 0.0001, // ~11m
			clusterThreshold: 100,
			maxOutput: 150
		};
	} else if (zoomLevel >= 13) {
		// Neighborhood: moderate clustering
		return {
			cellSizeDegrees: 0.0003, // ~33m
			clusterThreshold: 50,
			maxOutput: 100
		};
	} else {
		// City/region: aggressive clustering
		return {
			cellSizeDegrees: 0.001, // ~110m
			clusterThreshold: 30,
			maxOutput: 50
		};
	}
}

/**
 * Estimates memory usage for a tree count.
 * Used to decide whether to apply aggressive clustering.
 *
 * @param treeCount - Number of trees
 * @returns Estimated memory in bytes
 */
export function estimateTreeMemory(treeCount: number): number {
	// Rough estimate: each tree object ~ 200 bytes in memory
	// Each map marker ~ 2KB including DOM elements
	const objectMemory = treeCount * 200;
	const markerMemory = treeCount * 2000;
	return objectMemory + markerMemory;
}

/**
 * Memory threshold for warning (100MB).
 */
export const MEMORY_WARNING_THRESHOLD = 100 * 1024 * 1024;

/**
 * Checks if tree count would exceed memory guidelines.
 *
 * @param treeCount - Number of trees
 * @returns True if memory usage would be concerning
 */
export function wouldExceedMemoryGuidelines(treeCount: number): boolean {
	return estimateTreeMemory(treeCount) > MEMORY_WARNING_THRESHOLD;
}
