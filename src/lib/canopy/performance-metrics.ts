/**
 * Performance metrics tracking for tree detection.
 *
 * This module collects timing data for the tree detection pipeline, allowing
 * performance analysis and monitoring against target thresholds. Metrics are
 * aggregated over a sliding window to provide meaningful averages.
 *
 * The primary performance target is completing tree detection in under 3 seconds
 * for a typical residential lot, with graceful degradation for larger areas.
 */

/**
 * Performance thresholds for tree detection operations.
 * Values are in milliseconds.
 */
export const PERFORMANCE_THRESHOLDS = {
	/** Maximum acceptable time from map settle to trees rendered (ms) */
	TOTAL_DETECTION_MS: 3000,
	/** Maximum acceptable tile fetch latency (ms) */
	TILE_FETCH_MS: 2000,
	/** Maximum acceptable tree extraction time (ms) */
	EXTRACTION_MS: 500,
	/** Maximum acceptable marker rendering time (ms) */
	RENDER_MS: 200
} as const;

/**
 * Metrics for a single tree detection operation.
 */
export interface DetectionMetrics {
	/** Total time from start to trees rendered (ms) */
	totalMs: number;
	/** Time spent fetching tile(s) from network/cache (ms) */
	tileFetchMs: number;
	/** Time spent extracting trees from raster (ms) */
	extractionMs: number;
	/** Time spent rendering markers on map (ms) */
	renderMs: number;
	/** Number of trees detected */
	treeCount: number;
	/** Raster dimensions processed */
	rasterPixels: number;
	/** Whether tile was served from cache */
	cacheHit: boolean;
	/** Whether extraction used web worker */
	usedWorker: boolean;
	/** Timestamp of this measurement */
	timestamp: number;
}

/**
 * Aggregated statistics over multiple detection operations.
 */
export interface AggregatedMetrics {
	/** Number of samples in this aggregate */
	sampleCount: number;
	/** Average total detection time (ms) */
	avgTotalMs: number;
	/** Average tile fetch time (ms) */
	avgTileFetchMs: number;
	/** Average extraction time (ms) */
	avgExtractionMs: number;
	/** Average render time (ms) */
	avgRenderMs: number;
	/** Average tree count per detection */
	avgTreeCount: number;
	/** Cache hit rate (0-1) */
	cacheHitRate: number;
	/** P95 total detection time (ms) */
	p95TotalMs: number;
	/** P95 tile fetch time (ms) */
	p95TileFetchMs: number;
	/** Percentage meeting the 3s target */
	targetMeetRate: number;
}

// Circular buffer for metrics storage
const BUFFER_SIZE = 50;
const metricsBuffer: DetectionMetrics[] = [];
let bufferIndex = 0;

// Track current detection in progress
let currentDetection: Partial<DetectionMetrics> | null = null;
let detectionStartTime: number | null = null;

/**
 * Starts tracking a new tree detection operation.
 * Call this when the detection process begins (e.g., on map moveend).
 */
export function startDetectionMetrics(): void {
	detectionStartTime = performance.now();
	currentDetection = {
		treeCount: 0,
		rasterPixels: 0,
		cacheHit: false,
		usedWorker: false,
		tileFetchMs: 0,
		extractionMs: 0,
		renderMs: 0
	};
}

/**
 * Records tile fetch completion.
 * @param elapsedMs - Time spent fetching (from start of fetch to data available)
 * @param cacheHit - Whether the tile was served from cache
 */
export function recordTileFetch(elapsedMs: number, cacheHit: boolean): void {
	if (currentDetection) {
		currentDetection.tileFetchMs = elapsedMs;
		currentDetection.cacheHit = cacheHit;
	}
}

/**
 * Records tree extraction completion.
 * @param elapsedMs - Time spent extracting trees
 * @param treeCount - Number of trees extracted
 * @param rasterPixels - Total pixels in the raster
 * @param usedWorker - Whether extraction used a web worker
 */
export function recordExtraction(
	elapsedMs: number,
	treeCount: number,
	rasterPixels: number,
	usedWorker: boolean
): void {
	if (currentDetection) {
		currentDetection.extractionMs = elapsedMs;
		currentDetection.treeCount = treeCount;
		currentDetection.rasterPixels = rasterPixels;
		currentDetection.usedWorker = usedWorker;
	}
}

/**
 * Records marker rendering completion.
 * @param elapsedMs - Time spent rendering markers on the map
 */
export function recordRender(elapsedMs: number): void {
	if (currentDetection) {
		currentDetection.renderMs = elapsedMs;
	}
}

/**
 * Completes the current detection and stores the metrics.
 * Call this when trees are fully rendered on the map.
 */
export function completeDetectionMetrics(): DetectionMetrics | null {
	if (!currentDetection || detectionStartTime === null) {
		return null;
	}

	const totalMs = performance.now() - detectionStartTime;

	const metrics: DetectionMetrics = {
		totalMs,
		tileFetchMs: currentDetection.tileFetchMs ?? 0,
		extractionMs: currentDetection.extractionMs ?? 0,
		renderMs: currentDetection.renderMs ?? 0,
		treeCount: currentDetection.treeCount ?? 0,
		rasterPixels: currentDetection.rasterPixels ?? 0,
		cacheHit: currentDetection.cacheHit ?? false,
		usedWorker: currentDetection.usedWorker ?? false,
		timestamp: Date.now()
	};

	// Store in circular buffer
	metricsBuffer[bufferIndex] = metrics;
	bufferIndex = (bufferIndex + 1) % BUFFER_SIZE;

	// Reset tracking state
	currentDetection = null;
	detectionStartTime = null;

	return metrics;
}

/**
 * Cancels the current detection tracking without storing metrics.
 * Call this if detection is aborted (e.g., user navigated away).
 */
export function cancelDetectionMetrics(): void {
	currentDetection = null;
	detectionStartTime = null;
}

/**
 * Calculates the Nth percentile from a sorted array of numbers.
 */
function percentile(sorted: number[], p: number): number {
	if (sorted.length === 0) return 0;
	const index = Math.ceil((p / 100) * sorted.length) - 1;
	return sorted[Math.max(0, Math.min(index, sorted.length - 1))];
}

/**
 * Returns aggregated metrics over recent detection operations.
 */
export function getAggregatedMetrics(): AggregatedMetrics {
	const samples = metricsBuffer.filter((m) => m !== undefined);

	if (samples.length === 0) {
		return {
			sampleCount: 0,
			avgTotalMs: 0,
			avgTileFetchMs: 0,
			avgExtractionMs: 0,
			avgRenderMs: 0,
			avgTreeCount: 0,
			cacheHitRate: 0,
			p95TotalMs: 0,
			p95TileFetchMs: 0,
			targetMeetRate: 0
		};
	}

	const sum = (arr: number[]) => arr.reduce((a, b) => a + b, 0);
	const avg = (arr: number[]) => sum(arr) / arr.length;

	const totalTimes = samples.map((s) => s.totalMs);
	const tileFetchTimes = samples.map((s) => s.tileFetchMs);
	const extractionTimes = samples.map((s) => s.extractionMs);
	const renderTimes = samples.map((s) => s.renderMs);
	const treeCounts = samples.map((s) => s.treeCount);
	const cacheHits = samples.filter((s) => s.cacheHit).length;
	const meetTarget = samples.filter((s) => s.totalMs <= PERFORMANCE_THRESHOLDS.TOTAL_DETECTION_MS).length;

	const sortedTotalTimes = [...totalTimes].sort((a, b) => a - b);
	const sortedTileFetchTimes = [...tileFetchTimes].sort((a, b) => a - b);

	return {
		sampleCount: samples.length,
		avgTotalMs: avg(totalTimes),
		avgTileFetchMs: avg(tileFetchTimes),
		avgExtractionMs: avg(extractionTimes),
		avgRenderMs: avg(renderTimes),
		avgTreeCount: avg(treeCounts),
		cacheHitRate: cacheHits / samples.length,
		p95TotalMs: percentile(sortedTotalTimes, 95),
		p95TileFetchMs: percentile(sortedTileFetchTimes, 95),
		targetMeetRate: meetTarget / samples.length
	};
}

/**
 * Returns the most recent detection metrics.
 */
export function getLatestMetrics(): DetectionMetrics | null {
	const samples = metricsBuffer.filter((m) => m !== undefined);
	if (samples.length === 0) return null;

	// Find most recent by timestamp
	return samples.reduce((latest, current) =>
		current.timestamp > latest.timestamp ? current : latest
	);
}

/**
 * Clears all stored metrics.
 */
export function clearMetrics(): void {
	metricsBuffer.length = 0;
	bufferIndex = 0;
	currentDetection = null;
	detectionStartTime = null;
}

/**
 * Logs a performance warning if thresholds are exceeded.
 * @param metrics - The metrics to check
 */
export function checkThresholds(metrics: DetectionMetrics): string[] {
	const warnings: string[] = [];

	if (metrics.totalMs > PERFORMANCE_THRESHOLDS.TOTAL_DETECTION_MS) {
		warnings.push(
			`Total detection time (${Math.round(metrics.totalMs)}ms) exceeded target (${PERFORMANCE_THRESHOLDS.TOTAL_DETECTION_MS}ms)`
		);
	}

	if (metrics.tileFetchMs > PERFORMANCE_THRESHOLDS.TILE_FETCH_MS) {
		warnings.push(
			`Tile fetch time (${Math.round(metrics.tileFetchMs)}ms) exceeded target (${PERFORMANCE_THRESHOLDS.TILE_FETCH_MS}ms)`
		);
	}

	if (metrics.extractionMs > PERFORMANCE_THRESHOLDS.EXTRACTION_MS) {
		warnings.push(
			`Extraction time (${Math.round(metrics.extractionMs)}ms) exceeded target (${PERFORMANCE_THRESHOLDS.EXTRACTION_MS}ms)`
		);
	}

	return warnings;
}

/**
 * Formats metrics as a human-readable string for debugging.
 */
export function formatMetrics(metrics: DetectionMetrics): string {
	return [
		`Total: ${Math.round(metrics.totalMs)}ms`,
		`Fetch: ${Math.round(metrics.tileFetchMs)}ms (${metrics.cacheHit ? 'cache' : 'network'})`,
		`Extract: ${Math.round(metrics.extractionMs)}ms (${metrics.usedWorker ? 'worker' : 'main'})`,
		`Render: ${Math.round(metrics.renderMs)}ms`,
		`Trees: ${metrics.treeCount} from ${metrics.rasterPixels.toLocaleString()}px`
	].join(' | ');
}
