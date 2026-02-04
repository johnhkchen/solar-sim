/**
 * Canopy height processing module.
 *
 * This module provides tools for working with canopy height data from the
 * Meta/WRI Global Forests dataset. It includes a tile fetching service that
 * retrieves height rasters from AWS S3 and algorithms for extracting discrete
 * tree positions from continuous height measurements.
 *
 * The typical workflow is: fetch height data for a location using fetchCanopyData,
 * then pass the result to extractTrees to get individual tree positions that can
 * be converted to MapTree format for display on the map.
 *
 * For optimal performance, use extractTreesAsync which offloads extraction to a
 * web worker, and apply tree clustering for dense forest areas.
 */

export {
	extractTrees,
	extractTreesWithRasterRadius,
	estimateCanopyRadiusFromRaster,
	toMapTree,
	toMapTrees,
	type LatLngBounds,
	type DetectedTree,
	type TreeExtractionOptions
} from './tree-extraction.js';

export {
	fetchCanopyData,
	fetchTile,
	latLngToQuadKey,
	quadKeyToTileCoords,
	quadKeyBounds,
	tileBounds,
	buildTileUrl,
	getRequiredQuadKeys,
	extractSubregion,
	clearCache,
	getCacheStats,
	type CanopyTile,
	type TileFetchOptions
} from './tile-service.js';

// Performance-optimized extraction using web workers
export {
	extractTreesAsync,
	terminateWorker,
	getPendingRequestCount,
	isWorkerActive
} from './worker-manager.js';

// IndexedDB caching for persistent tile storage
export {
	getCachedTile,
	setCachedTile,
	deleteCachedTile,
	clearTileCache,
	getTileCacheStats
} from './tile-cache-idb.js';

// Tree clustering for dense areas
export {
	clusterTrees,
	getClusteringOptionsForZoom,
	estimateTreeMemory,
	wouldExceedMemoryGuidelines,
	MEMORY_WARNING_THRESHOLD,
	type ClusteringOptions,
	type TreeCluster,
	type ClusteringResult
} from './tree-clustering.js';

// Performance metrics tracking
export {
	startDetectionMetrics,
	recordTileFetch,
	recordExtraction,
	recordRender,
	completeDetectionMetrics,
	cancelDetectionMetrics,
	getAggregatedMetrics,
	getLatestMetrics,
	clearMetrics,
	checkThresholds,
	formatMetrics,
	PERFORMANCE_THRESHOLDS,
	type DetectionMetrics,
	type AggregatedMetrics
} from './performance-metrics.js';
