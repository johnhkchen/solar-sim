<script lang="ts" module>
	/**
	 * Color scale for heatmap based on horticultural light categories.
	 * Full sun uses warm colors (indicating more heat/light), while
	 * shade uses cool colors (indicating less).
	 */
	export interface HeatmapColorStop {
		hours: number;
		color: string;
	}

	export const DEFAULT_COLOR_SCALE: HeatmapColorStop[] = [
		{ hours: 0, color: '#4a90d9' }, // Full shade - blue
		{ hours: 2, color: '#7bc47f' }, // Part shade boundary - light green
		{ hours: 4, color: '#f7c948' }, // Part sun boundary - yellow
		{ hours: 6, color: '#ff6b35' }, // Full sun boundary - orange-red
		{ hours: 12, color: '#ff6b35' } // Max hours - same orange-red
	];

	/**
	 * Data passed to the onclick callback when user clicks on the heatmap.
	 */
	export interface HeatmapClickEvent {
		lat: number;
		lng: number;
		sunHours: number;
	}
</script>

<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import type { ExposureGrid } from '$lib/solar/exposure-grid.js';
	import { getExposureAtLatLng } from '$lib/solar/exposure-grid.js';

	/**
	 * Props for the ExposureHeatmap component.
	 */
	interface ExposureHeatmapProps {
		/** The exposure grid data to render */
		grid: ExposureGrid | null;
		/** Leaflet map instance to attach the overlay to */
		map: L.Map | null;
		/** Whether the heatmap is visible */
		visible?: boolean;
		/** Opacity of the heatmap overlay (0-1) */
		opacity?: number;
		/** Color scale for the heatmap (defaults to horticultural categories) */
		colorScale?: HeatmapColorStop[];
		/** Callback when visibility changes */
		onvisibilitychange?: (visible: boolean) => void;
		/** Whether to show the legend */
		showLegend?: boolean;
		/** Callback when user clicks on the heatmap area. Provides lat/lng and sun-hours value. */
		onclick?: (event: HeatmapClickEvent) => void;
		/** Whether clicking on the heatmap is enabled */
		clickable?: boolean;
	}

	let {
		grid,
		map,
		visible = $bindable(true),
		opacity = 0.6,
		colorScale = DEFAULT_COLOR_SCALE,
		onvisibilitychange,
		showLegend = true,
		onclick,
		clickable = true
	}: ExposureHeatmapProps = $props();

	// Leaflet module reference
	let L: typeof import('leaflet') | null = $state(null);

	// Canvas and overlay references
	let canvas: HTMLCanvasElement | null = null;
	let imageOverlay: L.ImageOverlay | null = $state(null);

	// Track the current grid to detect changes
	let renderedGridId: string | null = null;

	// Click handler reference for cleanup
	let mapClickHandler: ((e: L.LeafletMouseEvent) => void) | null = null;

	/**
	 * Interpolates between color stops to get the color for a given sun-hours value.
	 */
	function getSunHoursColor(hours: number): string {
		const stops = colorScale;

		// Clamp to range
		if (hours <= stops[0].hours) return stops[0].color;
		if (hours >= stops[stops.length - 1].hours) return stops[stops.length - 1].color;

		// Find the two stops to interpolate between
		for (let i = 0; i < stops.length - 1; i++) {
			if (hours >= stops[i].hours && hours <= stops[i + 1].hours) {
				const t = (hours - stops[i].hours) / (stops[i + 1].hours - stops[i].hours);
				return interpolateColor(stops[i].color, stops[i + 1].color, t);
			}
		}

		return stops[stops.length - 1].color;
	}

	/**
	 * Interpolates between two hex colors.
	 */
	function interpolateColor(color1: string, color2: string, t: number): string {
		const r1 = parseInt(color1.slice(1, 3), 16);
		const g1 = parseInt(color1.slice(3, 5), 16);
		const b1 = parseInt(color1.slice(5, 7), 16);

		const r2 = parseInt(color2.slice(1, 3), 16);
		const g2 = parseInt(color2.slice(3, 5), 16);
		const b2 = parseInt(color2.slice(5, 7), 16);

		const r = Math.round(r1 + (r2 - r1) * t);
		const g = Math.round(g1 + (g2 - g1) * t);
		const b = Math.round(b1 + (b2 - b1) * t);

		return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
	}

	/**
	 * Renders the exposure grid to a canvas.
	 */
	function renderGridToCanvas(gridData: ExposureGrid): HTMLCanvasElement {
		const { width, height, values } = gridData;

		// Create canvas at grid resolution
		const cvs = document.createElement('canvas');
		cvs.width = width;
		cvs.height = height;

		const ctx = cvs.getContext('2d');
		if (!ctx) return cvs;

		// Create image data for pixel manipulation
		const imageData = ctx.createImageData(width, height);
		const data = imageData.data;

		// Fill pixels - note that canvas y=0 is top, but our grid row=0 is south (bottom)
		for (let row = 0; row < height; row++) {
			for (let col = 0; col < width; col++) {
				const gridIndex = row * width + col;
				const sunHours = values[gridIndex];

				// Get color for this sun-hours value
				const color = getSunHoursColor(sunHours);
				const r = parseInt(color.slice(1, 3), 16);
				const g = parseInt(color.slice(3, 5), 16);
				const b = parseInt(color.slice(5, 7), 16);

				// Canvas y is inverted relative to latitude (row 0 = south = bottom of canvas)
				const canvasY = height - 1 - row;
				const pixelIndex = (canvasY * width + col) * 4;

				data[pixelIndex] = r;
				data[pixelIndex + 1] = g;
				data[pixelIndex + 2] = b;
				data[pixelIndex + 3] = 255; // Full opacity in canvas; layer opacity controls visibility
			}
		}

		ctx.putImageData(imageData, 0, 0);
		return cvs;
	}

	/**
	 * Creates a unique ID for a grid to detect changes.
	 */
	function getGridId(gridData: ExposureGrid): string {
		return `${gridData.bounds.south}-${gridData.bounds.west}-${gridData.width}-${gridData.height}-${gridData.values[0]}`;
	}

	/**
	 * Updates the map overlay with the current grid.
	 */
	function updateOverlay(): void {
		if (!map || !L || !grid) {
			removeOverlay();
			return;
		}

		const newGridId = getGridId(grid);

		// Only re-render if grid has changed
		if (newGridId !== renderedGridId) {
			canvas = renderGridToCanvas(grid);
			renderedGridId = newGridId;
		}

		if (!canvas) return;

		// Remove existing overlay if present
		if (imageOverlay) {
			map.removeLayer(imageOverlay);
		}

		// Create bounds for the overlay
		const bounds = L.latLngBounds(
			[grid.bounds.south, grid.bounds.west],
			[grid.bounds.north, grid.bounds.east]
		);

		// Create image overlay from canvas
		imageOverlay = L.imageOverlay(canvas.toDataURL(), bounds, {
			opacity: visible ? opacity : 0,
			interactive: false,
			className: 'exposure-heatmap-overlay'
		}).addTo(map);
	}

	/**
	 * Removes the overlay from the map.
	 */
	function removeOverlay(): void {
		if (imageOverlay && map) {
			map.removeLayer(imageOverlay);
			imageOverlay = null;
		}
	}

	/**
	 * Toggles heatmap visibility.
	 */
	function toggleVisibility(): void {
		visible = !visible;
		onvisibilitychange?.(visible);
	}

	/**
	 * Handles map clicks and emits click events when clicking within the grid bounds.
	 */
	function handleMapClick(e: L.LeafletMouseEvent): void {
		if (!grid || !visible || !clickable || !onclick) return;

		const { lat, lng } = e.latlng;

		// Check if click is within grid bounds
		const sunHours = getExposureAtLatLng(grid, lat, lng);
		if (sunHours === undefined) return;

		// Emit the click event with lat/lng and sun hours
		onclick({ lat, lng, sunHours });
	}

	/**
	 * Sets up the click handler on the map.
	 */
	function setupClickHandler(): void {
		if (!map || !clickable || !onclick) return;

		// Remove existing handler if any
		removeClickHandler();

		// Create and attach new handler
		mapClickHandler = handleMapClick;
		map.on('click', mapClickHandler);
	}

	/**
	 * Removes the click handler from the map.
	 */
	function removeClickHandler(): void {
		if (map && mapClickHandler) {
			map.off('click', mapClickHandler);
			mapClickHandler = null;
		}
	}

	// Initialize Leaflet on mount
	onMount(async () => {
		L = await import('leaflet');
	});

	// Clean up on destroy
	onDestroy(() => {
		removeClickHandler();
		removeOverlay();
	});

	// Set up click handler when map and grid become available
	$effect(() => {
		if (map && grid && visible && clickable && onclick) {
			setupClickHandler();
		} else {
			removeClickHandler();
		}
	});

	// Update overlay when grid, map, or visibility changes
	$effect(() => {
		if (L && map && grid) {
			updateOverlay();
		} else {
			removeOverlay();
		}
	});

	// Update opacity when it changes
	$effect(() => {
		if (imageOverlay) {
			imageOverlay.setOpacity(visible ? opacity : 0);
		}
	});
</script>

{#if showLegend}
	<div class="heatmap-legend">
		<div class="legend-header">
			<label class="legend-toggle">
				<input type="checkbox" checked={visible} onchange={toggleVisibility} />
				<span>Sun exposure</span>
			</label>
		</div>

		{#if visible}
			<div class="legend-scale">
				<div class="scale-bar">
					<div
						class="scale-gradient"
						style="background: linear-gradient(to right, #4a90d9, #7bc47f, #f7c948, #ff6b35);"
					></div>
				</div>
				<div class="scale-labels">
					<span class="scale-label">0h</span>
					<span class="scale-label">2h</span>
					<span class="scale-label">4h</span>
					<span class="scale-label">6h+</span>
				</div>
				<div class="category-labels">
					<span class="category full-shade">Full shade</span>
					<span class="category part-shade">Part shade</span>
					<span class="category part-sun">Part sun</span>
					<span class="category full-sun">Full sun</span>
				</div>
			</div>
			{#if clickable && onclick}
				<div class="click-hint">Click map to inspect any spot</div>
			{/if}
		{/if}
	</div>
{/if}

<style>
	.heatmap-legend {
		padding: 0.625rem 0.75rem;
		background: rgba(255, 255, 255, 0.95);
		border: 1px solid #dee2e6;
		border-radius: 4px;
		font-size: 0.875rem;
		min-width: 200px;
	}

	.legend-header {
		margin-bottom: 0.5rem;
	}

	.legend-toggle {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		cursor: pointer;
		font-weight: 600;
		color: #333;
	}

	.legend-toggle input[type='checkbox'] {
		width: 1rem;
		height: 1rem;
		cursor: pointer;
	}

	.legend-scale {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
	}

	.scale-bar {
		height: 12px;
		border-radius: 2px;
		overflow: hidden;
		border: 1px solid #ccc;
	}

	.scale-gradient {
		width: 100%;
		height: 100%;
	}

	.scale-labels {
		display: flex;
		justify-content: space-between;
		font-size: 0.75rem;
		color: #666;
		font-family: ui-monospace, monospace;
	}

	.scale-label {
		flex: 1;
		text-align: center;
	}

	.scale-label:first-child {
		text-align: left;
	}

	.scale-label:last-child {
		text-align: right;
	}

	.category-labels {
		display: flex;
		justify-content: space-between;
		font-size: 0.6875rem;
		margin-top: 0.25rem;
	}

	.category {
		flex: 1;
		text-align: center;
		padding: 0.125rem 0.25rem;
		border-radius: 2px;
		font-weight: 500;
	}

	.category.full-shade {
		color: #2563eb;
	}

	.category.part-shade {
		color: #16a34a;
	}

	.category.part-sun {
		color: #ca8a04;
	}

	.category.full-sun {
		color: #c2410c;
	}

	.click-hint {
		margin-top: 0.5rem;
		padding-top: 0.5rem;
		border-top: 1px solid #e5e7eb;
		font-size: 0.75rem;
		color: #6b7280;
		text-align: center;
		font-style: italic;
	}

	/* Global style for the overlay */
	:global(.exposure-heatmap-overlay) {
		image-rendering: pixelated;
		image-rendering: crisp-edges;
	}

	/* Mobile adjustments */
	@media (max-width: 640px) {
		.heatmap-legend {
			padding: 0.5rem;
			min-width: 160px;
		}

		.category-labels {
			font-size: 0.625rem;
		}

		.legend-toggle {
			font-size: 0.8125rem;
		}
	}
</style>
