<script lang="ts" module>
	/**
	 * Reactive Heatmap Component
	 *
	 * Wraps ExposureHeatmap with automatic recalculation when trees or period change.
	 * Uses debouncing to prevent excessive recalculations and a web worker to avoid
	 * blocking the UI during calculation.
	 */

	export interface ReactiveHeatmapState {
		isCalculating: boolean;
		progress: number;
		error: string | null;
		lastCalculatedAt: Date | null;
		computeTimeMs: number | null;
	}
</script>

<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { browser } from '$app/environment';
	import ExposureHeatmap, { type HeatmapClickEvent } from './ExposureHeatmap.svelte';
	import type { ExposureGrid, LatLngBounds, GridConfig, ShadeMapQueryInterface } from '$lib/solar/exposure-grid.js';
	import { calculateCombinedExposureGrid } from '$lib/solar/exposure-grid.js';
	import type { MapTreeConfig } from '$lib/solar/shadow-projection.js';
	import type { AnalysisPeriod } from './PeriodSelector.svelte';
	import { dayOfYearToDate } from '$lib/climate';

	interface ReactiveHeatmapProps {
		/** Geographic bounds of the area to analyze */
		bounds: LatLngBounds | null;
		/** Trees that cast shadows */
		trees: MapTreeConfig[];
		/** Analysis period (date range) */
		period: AnalysisPeriod | null;
		/** Leaflet map instance */
		map: L.Map | null;
		/** ShadeMap interface for terrain/building shadows (optional) */
		shadeMap?: ShadeMapQueryInterface | null;
		/** Debounce delay in milliseconds (default: 500) */
		debounceMs?: number;
		/** Grid resolution in meters (default: 2) */
		resolution?: number;
		/** Number of sample days for calculation (default: 12) */
		sampleDays?: number;
		/** Whether the heatmap is visible */
		visible?: boolean;
		/** Opacity of the heatmap overlay */
		opacity?: number;
		/** Callback when heatmap is clicked */
		onclick?: (event: HeatmapClickEvent) => void;
		/** Whether clicking is enabled */
		clickable?: boolean;
		/** Whether to show the legend */
		showLegend?: boolean;
		/** Callback when calculation state changes */
		onstatechange?: (state: ReactiveHeatmapState) => void;
	}

	let {
		bounds,
		trees,
		period,
		map,
		shadeMap = null,
		debounceMs = 500,
		resolution = 2,
		sampleDays = 12,
		visible = $bindable(true),
		opacity = 0.6,
		onclick,
		clickable = true,
		showLegend = true,
		onstatechange
	}: ReactiveHeatmapProps = $props();

	// Internal state
	let grid = $state<ExposureGrid | null>(null);
	let isCalculating = $state(false);
	let progress = $state(0);
	let error = $state<string | null>(null);
	let lastCalculatedAt = $state<Date | null>(null);
	let computeTimeMs = $state<number | null>(null);

	// Worker instance
	let worker: Worker | null = null;
	let pendingRequestId: string | null = null;

	// Debounce timer
	let debounceTimer: ReturnType<typeof setTimeout> | null = null;

	// Track inputs for change detection
	let lastInputHash = '';

	/**
	 * Creates a hash of the current inputs to detect changes.
	 */
	function getInputHash(): string {
		if (!bounds || !period) return '';

		const treesHash = trees
			.map((t) => `${t.id}:${t.lat.toFixed(6)}:${t.lng.toFixed(6)}:${t.height}:${t.canopyWidth}:${t.type}`)
			.join('|');

		return `${bounds.south}:${bounds.north}:${bounds.west}:${bounds.east}:${period.startDoy}:${period.endDoy}:${treesHash}`;
	}

	/**
	 * Converts an AnalysisPeriod to a DateRange with Date objects.
	 */
	function periodToDateRange(p: AnalysisPeriod): { start: string; end: string } {
		const start = dayOfYearToDate(p.startDoy);
		const end = dayOfYearToDate(p.endDoy);
		return {
			start: start.toISOString(),
			end: end.toISOString()
		};
	}

	/**
	 * Starts the grid calculation.
	 * Uses ShadeMap for terrain/building shadows when available,
	 * otherwise falls back to tree-only worker calculation.
	 */
	async function startCalculation(): Promise<void> {
		if (!bounds || !period) return;

		// Generate a unique request ID
		const requestId = crypto.randomUUID();
		pendingRequestId = requestId;

		isCalculating = true;
		progress = 0;
		error = null;

		emitStateChange();

		const config: GridConfig = {
			resolution,
			sampleDays,
			timeIntervalMinutes: 15
		};

		// If ShadeMap is available, use main-thread calculation with terrain/building shadows
		// ShadeMap requires DOM context so it can't run in a worker
		if (shadeMap?.isAvailable()) {
			try {
				const dateRange = {
					start: dayOfYearToDate(period.startDoy),
					end: dayOfYearToDate(period.endDoy)
				};

				const resultGrid = await calculateCombinedExposureGrid(
					bounds,
					trees,
					dateRange,
					config,
					shadeMap,
					(p) => {
						if (pendingRequestId === requestId) {
							progress = p;
							emitStateChange();
						}
					}
				);

				// Check if this request is still relevant
				if (pendingRequestId !== requestId) return;

				grid = resultGrid;
				isCalculating = false;
				progress = 1;
				lastCalculatedAt = new Date();
				computeTimeMs = resultGrid.computeTimeMs;
				pendingRequestId = null;
				emitStateChange();
			} catch (err) {
				if (pendingRequestId !== requestId) return;
				error = err instanceof Error ? err.message : 'Unknown error';
				isCalculating = false;
				progress = 0;
				pendingRequestId = null;
				emitStateChange();
			}
		} else if (worker) {
			// Fall back to worker calculation (tree shadows only)
			worker.postMessage({
				type: 'calculate',
				id: requestId,
				bounds,
				trees,
				dateRange: periodToDateRange(period),
				config
			});
		}
	}

	/**
	 * Handles messages from the web worker.
	 */
	function handleWorkerMessage(event: MessageEvent): void {
		const { type, id, grid: resultGrid, progress: workerProgress, error: workerError } = event.data;

		// Ignore responses for stale requests
		if (id !== pendingRequestId) return;

		if (type === 'progress') {
			progress = workerProgress ?? 0;
			emitStateChange();
		} else if (type === 'result') {
			grid = resultGrid;
			isCalculating = false;
			progress = 1;
			lastCalculatedAt = new Date();
			computeTimeMs = resultGrid?.computeTimeMs ?? null;
			pendingRequestId = null;
			emitStateChange();
		} else if (type === 'error') {
			error = workerError ?? 'Unknown error';
			isCalculating = false;
			progress = 0;
			pendingRequestId = null;
			emitStateChange();
		}
	}

	/**
	 * Emits the current state to the parent component.
	 */
	function emitStateChange(): void {
		onstatechange?.({
			isCalculating,
			progress,
			error,
			lastCalculatedAt,
			computeTimeMs
		});
	}

	/**
	 * Schedules a debounced recalculation.
	 */
	function scheduleRecalculation(): void {
		if (debounceTimer) {
			clearTimeout(debounceTimer);
		}

		debounceTimer = setTimeout(() => {
			startCalculation();
		}, debounceMs);
	}

	// Initialize worker on mount
	onMount(() => {
		if (!browser) return;

		// Create worker using Vite's worker import pattern
		worker = new Worker(new URL('../workers/exposure-worker.ts', import.meta.url), {
			type: 'module'
		});

		worker.onmessage = handleWorkerMessage;
		worker.onerror = (err) => {
			console.error('Exposure worker error:', err);
			error = 'Worker error: ' + err.message;
			isCalculating = false;
			emitStateChange();
		};
	});

	// Cleanup on destroy
	onDestroy(() => {
		if (debounceTimer) {
			clearTimeout(debounceTimer);
		}
		if (worker) {
			worker.terminate();
			worker = null;
		}
	});

	// Watch for input changes and trigger recalculation
	$effect(() => {
		if (!browser || !worker || !bounds || !period) return;

		const currentHash = getInputHash();
		if (currentHash !== lastInputHash && currentHash !== '') {
			lastInputHash = currentHash;
			scheduleRecalculation();
		}
	});
</script>

<div class="reactive-heatmap">
	{#if isCalculating}
		<div class="calculation-indicator" role="status" aria-live="polite">
			<div class="indicator-content">
				<span class="spinner" aria-hidden="true"></span>
				<span class="indicator-text">
					Calculating sun exposure...
					{#if progress > 0 && progress < 1}
						<span class="progress-text">{Math.round(progress * 100)}%</span>
					{/if}
				</span>
			</div>
			{#if progress > 0}
				<div class="progress-bar-container">
					<div class="progress-bar" style="width: {progress * 100}%"></div>
				</div>
			{/if}
		</div>
	{/if}

	{#if error}
		<div class="error-indicator" role="alert">
			<span class="error-icon" aria-hidden="true">!</span>
			<span class="error-text">{error}</span>
		</div>
	{/if}

	<ExposureHeatmap {grid} {map} bind:visible {opacity} {onclick} {clickable} {showLegend} />
</div>

<style>
	.reactive-heatmap {
		position: relative;
	}

	.calculation-indicator {
		position: absolute;
		top: 0.5rem;
		left: 50%;
		transform: translateX(-50%);
		z-index: 1001;
		background: rgba(255, 255, 255, 0.95);
		border: 1px solid #d6d3d1;
		border-radius: 8px;
		padding: 0.5rem 0.75rem;
		box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
		min-width: 180px;
	}

	.indicator-content {
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}

	.spinner {
		width: 1rem;
		height: 1rem;
		border: 2px solid #e7e5e4;
		border-top-color: #22c55e;
		border-radius: 50%;
		animation: spin 0.8s linear infinite;
	}

	@keyframes spin {
		to {
			transform: rotate(360deg);
		}
	}

	.indicator-text {
		font-size: 0.8125rem;
		color: #44403c;
		font-weight: 500;
	}

	.progress-text {
		margin-left: 0.25rem;
		font-family: ui-monospace, monospace;
		font-size: 0.75rem;
		color: #78716c;
	}

	.progress-bar-container {
		margin-top: 0.375rem;
		height: 4px;
		background: #e7e5e4;
		border-radius: 2px;
		overflow: hidden;
	}

	.progress-bar {
		height: 100%;
		background: linear-gradient(90deg, #22c55e, #16a34a);
		border-radius: 2px;
		transition: width 0.2s ease-out;
	}

	.error-indicator {
		position: absolute;
		top: 0.5rem;
		left: 50%;
		transform: translateX(-50%);
		z-index: 1001;
		display: flex;
		align-items: center;
		gap: 0.5rem;
		background: #fef2f2;
		border: 1px solid #fecaca;
		border-radius: 8px;
		padding: 0.5rem 0.75rem;
		box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
	}

	.error-icon {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 1.25rem;
		height: 1.25rem;
		background: #dc2626;
		color: white;
		border-radius: 50%;
		font-size: 0.75rem;
		font-weight: 700;
	}

	.error-text {
		font-size: 0.8125rem;
		color: #991b1b;
	}

	/* Mobile adjustments */
	@media (max-width: 640px) {
		.calculation-indicator,
		.error-indicator {
			left: 0.5rem;
			right: 0.5rem;
			transform: none;
			max-width: none;
		}

		.indicator-text {
			font-size: 0.75rem;
		}
	}
</style>
