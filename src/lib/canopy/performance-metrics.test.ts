/**
 * Tests for performance metrics tracking.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
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
	type DetectionMetrics
} from './performance-metrics.js';

describe('performance metrics tracking', () => {
	beforeEach(() => {
		clearMetrics();
	});

	it('tracks a complete detection cycle', async () => {
		startDetectionMetrics();
		recordTileFetch(500, true);
		recordExtraction(100, 50, 40000, true);
		recordRender(50);

		// Wait a bit to simulate actual elapsed time
		await new Promise((resolve) => setTimeout(resolve, 10));

		const metrics = completeDetectionMetrics();

		expect(metrics).not.toBeNull();
		expect(metrics!.tileFetchMs).toBe(500);
		expect(metrics!.extractionMs).toBe(100);
		expect(metrics!.renderMs).toBe(50);
		expect(metrics!.treeCount).toBe(50);
		expect(metrics!.rasterPixels).toBe(40000);
		expect(metrics!.cacheHit).toBe(true);
		expect(metrics!.usedWorker).toBe(true);
		expect(metrics!.totalMs).toBeGreaterThan(0);
		expect(metrics!.timestamp).toBeGreaterThan(0);
	});

	it('returns null when completing without starting', () => {
		const metrics = completeDetectionMetrics();
		expect(metrics).toBeNull();
	});

	it('clears current tracking on cancel', () => {
		startDetectionMetrics();
		recordTileFetch(500, false);
		cancelDetectionMetrics();

		const metrics = completeDetectionMetrics();
		expect(metrics).toBeNull();
	});

	it('stores metrics in buffer for aggregation', () => {
		// Record a few detection cycles
		for (let i = 0; i < 5; i++) {
			startDetectionMetrics();
			recordTileFetch(100 * (i + 1), i % 2 === 0);
			recordExtraction(50, 10 * (i + 1), 10000, true);
			recordRender(20);
			completeDetectionMetrics();
		}

		const aggregated = getAggregatedMetrics();

		expect(aggregated.sampleCount).toBe(5);
		expect(aggregated.avgTileFetchMs).toBeGreaterThan(0);
		expect(aggregated.avgExtractionMs).toBeGreaterThan(0);
		expect(aggregated.avgTreeCount).toBe(30); // (10+20+30+40+50)/5
		expect(aggregated.cacheHitRate).toBe(0.6); // 3 out of 5
	});

	it('returns empty aggregates when no samples', () => {
		const aggregated = getAggregatedMetrics();

		expect(aggregated.sampleCount).toBe(0);
		expect(aggregated.avgTotalMs).toBe(0);
		expect(aggregated.cacheHitRate).toBe(0);
	});

	it('returns latest metrics', async () => {
		startDetectionMetrics();
		recordTileFetch(100, true);
		recordExtraction(50, 25, 5000, false);
		recordRender(10);
		completeDetectionMetrics();

		// Wait to ensure different timestamp
		await new Promise((resolve) => setTimeout(resolve, 5));

		startDetectionMetrics();
		recordTileFetch(200, false);
		recordExtraction(75, 100, 10000, true);
		recordRender(30);
		completeDetectionMetrics();

		const latest = getLatestMetrics();

		expect(latest).not.toBeNull();
		expect(latest!.tileFetchMs).toBe(200);
		expect(latest!.treeCount).toBe(100);
	});

	it('clears all metrics', () => {
		startDetectionMetrics();
		recordTileFetch(100, true);
		completeDetectionMetrics();

		clearMetrics();

		expect(getLatestMetrics()).toBeNull();
		expect(getAggregatedMetrics().sampleCount).toBe(0);
	});
});

describe('threshold checking', () => {
	it('returns no warnings for fast operations', () => {
		const metrics: DetectionMetrics = {
			totalMs: 500,
			tileFetchMs: 200,
			extractionMs: 100,
			renderMs: 50,
			treeCount: 50,
			rasterPixels: 10000,
			cacheHit: true,
			usedWorker: true,
			timestamp: Date.now()
		};

		const warnings = checkThresholds(metrics);
		expect(warnings).toHaveLength(0);
	});

	it('warns when total time exceeds threshold', () => {
		const metrics: DetectionMetrics = {
			totalMs: 5000,
			tileFetchMs: 200,
			extractionMs: 100,
			renderMs: 50,
			treeCount: 50,
			rasterPixels: 10000,
			cacheHit: true,
			usedWorker: true,
			timestamp: Date.now()
		};

		const warnings = checkThresholds(metrics);
		expect(warnings.length).toBeGreaterThan(0);
		expect(warnings.some((w) => w.includes('Total'))).toBe(true);
	});

	it('warns when tile fetch exceeds threshold', () => {
		const metrics: DetectionMetrics = {
			totalMs: 500,
			tileFetchMs: 3000,
			extractionMs: 100,
			renderMs: 50,
			treeCount: 50,
			rasterPixels: 10000,
			cacheHit: false,
			usedWorker: true,
			timestamp: Date.now()
		};

		const warnings = checkThresholds(metrics);
		expect(warnings.some((w) => w.includes('Tile fetch'))).toBe(true);
	});

	it('warns when extraction exceeds threshold', () => {
		const metrics: DetectionMetrics = {
			totalMs: 500,
			tileFetchMs: 200,
			extractionMs: 1000,
			renderMs: 50,
			treeCount: 50,
			rasterPixels: 10000,
			cacheHit: true,
			usedWorker: false,
			timestamp: Date.now()
		};

		const warnings = checkThresholds(metrics);
		expect(warnings.some((w) => w.includes('Extraction'))).toBe(true);
	});
});

describe('formatMetrics', () => {
	it('formats metrics as readable string', () => {
		const metrics: DetectionMetrics = {
			totalMs: 750,
			tileFetchMs: 400,
			extractionMs: 200,
			renderMs: 50,
			treeCount: 123,
			rasterPixels: 40000,
			cacheHit: true,
			usedWorker: true,
			timestamp: Date.now()
		};

		const formatted = formatMetrics(metrics);

		expect(formatted).toContain('Total: 750ms');
		expect(formatted).toContain('Fetch: 400ms');
		expect(formatted).toContain('cache');
		expect(formatted).toContain('Extract: 200ms');
		expect(formatted).toContain('worker');
		expect(formatted).toContain('Trees: 123');
		expect(formatted).toContain('40,000px');
	});

	it('indicates network fetch when not cache hit', () => {
		const metrics: DetectionMetrics = {
			totalMs: 1000,
			tileFetchMs: 800,
			extractionMs: 100,
			renderMs: 50,
			treeCount: 50,
			rasterPixels: 10000,
			cacheHit: false,
			usedWorker: true,
			timestamp: Date.now()
		};

		const formatted = formatMetrics(metrics);
		expect(formatted).toContain('network');
	});

	it('indicates main thread when not using worker', () => {
		const metrics: DetectionMetrics = {
			totalMs: 500,
			tileFetchMs: 200,
			extractionMs: 200,
			renderMs: 50,
			treeCount: 50,
			rasterPixels: 10000,
			cacheHit: true,
			usedWorker: false,
			timestamp: Date.now()
		};

		const formatted = formatMetrics(metrics);
		expect(formatted).toContain('main');
	});
});

describe('performance thresholds', () => {
	it('exports expected threshold values', () => {
		expect(PERFORMANCE_THRESHOLDS.TOTAL_DETECTION_MS).toBe(3000);
		expect(PERFORMANCE_THRESHOLDS.TILE_FETCH_MS).toBe(2000);
		expect(PERFORMANCE_THRESHOLDS.EXTRACTION_MS).toBe(500);
		expect(PERFORMANCE_THRESHOLDS.RENDER_MS).toBe(200);
	});
});
