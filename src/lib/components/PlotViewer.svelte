<script lang="ts">
	/**
	 * PlotViewer component that wraps PlotEditor and IsometricView.
	 *
	 * This component provides a toggle between the plan-view editor for placing
	 * obstacles and the isometric 3D view for visualizing shadows. The time
	 * scrubber controls shadow visualization in both views, allowing users to
	 * see how shadows move throughout the day.
	 *
	 * The component manages shared state for obstacles, slope, and the current
	 * time being visualized, passing this data to whichever view is active.
	 */

	import PlotEditor, { type PlotObstacle } from './PlotEditor.svelte';
	import IsometricView from './IsometricView.svelte';
	import TimeScrubber from './TimeScrubber.svelte';
	import type { PlotSlope } from '$lib/solar/slope';
	import type { SolarPosition } from '$lib/solar/types';
	import type { ShadowPolygon } from '$lib/solar/shadow-projection';
	import { calculateAllShadows } from '$lib/solar/shadow-projection';

	type ViewMode = 'plan' | 'isometric';

	interface PlotViewerProps {
		latitude: number;
		longitude: number;
		date?: Date;
		obstacles?: PlotObstacle[];
		onObstaclesChange?: (obstacles: PlotObstacle[]) => void;
		slope?: PlotSlope;
		onSlopeChange?: (slope: PlotSlope) => void;
	}

	let {
		latitude,
		longitude,
		date = new Date(),
		obstacles = $bindable([]),
		onObstaclesChange,
		slope = $bindable({ angle: 0, aspect: 180 }),
		onSlopeChange
	}: PlotViewerProps = $props();

	// Current view mode
	let viewMode = $state<ViewMode>('plan');

	// Current time and sun position from the time scrubber
	let currentTime = $state<Date>(new Date());
	let sunPosition = $state<SolarPosition | null>(null);

	// Shadows computed from obstacles and sun position
	const shadows = $derived.by<ShadowPolygon[]>(() => {
		if (!sunPosition || sunPosition.altitude <= 0) return [];
		return calculateAllShadows(obstacles, sunPosition, slope);
	});

	/**
	 * Handles time changes from the scrubber.
	 */
	function handleTimeChange(time: Date, position: SolarPosition): void {
		currentTime = time;
		sunPosition = position;
	}

	/**
	 * Handles obstacle changes from the editor.
	 */
	function handleObstaclesChange(newObstacles: PlotObstacle[]): void {
		obstacles = newObstacles;
		onObstaclesChange?.(newObstacles);
	}

	/**
	 * Handles slope changes from the editor.
	 */
	function handleSlopeChange(newSlope: PlotSlope): void {
		slope = newSlope;
		onSlopeChange?.(newSlope);
	}

	/**
	 * Toggle between plan and isometric views.
	 */
	function setViewMode(mode: ViewMode): void {
		viewMode = mode;
	}
</script>

<div class="plot-viewer">
	<div class="header">
		<div class="view-toggle" role="tablist">
			<button
				type="button"
				role="tab"
				class="toggle-btn"
				class:active={viewMode === 'plan'}
				aria-selected={viewMode === 'plan'}
				onclick={() => setViewMode('plan')}
			>
				<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
					<rect x="3" y="3" width="18" height="18" rx="2" />
					<line x1="3" y1="12" x2="21" y2="12" />
					<line x1="12" y1="3" x2="12" y2="21" />
				</svg>
				Plan View
			</button>
			<button
				type="button"
				role="tab"
				class="toggle-btn"
				class:active={viewMode === 'isometric'}
				aria-selected={viewMode === 'isometric'}
				onclick={() => setViewMode('isometric')}
			>
				<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
					<path d="M12 2L2 7l10 5 10-5-10-5z" />
					<path d="M2 17l10 5 10-5" />
					<path d="M2 12l10 5 10-5" />
				</svg>
				3D View
			</button>
		</div>

		<div class="view-hint">
			{#if viewMode === 'plan'}
				<span>Click to place obstacles, drag to move them</span>
			{:else}
				<span>Drag to rotate view, scroll to zoom</span>
			{/if}
		</div>
	</div>

	<div class="main-content">
		<div class="view-container">
			{#if viewMode === 'plan'}
				<PlotEditor
					bind:obstacles
					onchange={handleObstaclesChange}
					bind:slope
					onSlopeChange={handleSlopeChange}
				/>
			{:else}
				<IsometricView
					{obstacles}
					{slope}
					{shadows}
					{sunPosition}
				/>
			{/if}
		</div>
	</div>

	<div class="time-controls">
		<TimeScrubber
			{date}
			{latitude}
			{longitude}
			onTimeChange={handleTimeChange}
		/>
	</div>
</div>

<style>
	.plot-viewer {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
		font-family: system-ui, -apple-system, sans-serif;
		height: 100%;
		min-height: 600px;
	}

	.header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: 1rem;
		flex-wrap: wrap;
	}

	.view-toggle {
		display: flex;
		gap: 0;
		background: #e7e5e4;
		border-radius: 8px;
		padding: 3px;
	}

	.toggle-btn {
		display: flex;
		align-items: center;
		gap: 0.375rem;
		padding: 0.5rem 0.875rem;
		background: transparent;
		border: none;
		border-radius: 6px;
		font-size: 0.875rem;
		font-weight: 500;
		color: #57534e;
		cursor: pointer;
		transition: all 0.15s ease;
	}

	.toggle-btn:hover {
		color: #1c1917;
	}

	.toggle-btn.active {
		background: white;
		color: #1c1917;
		box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
	}

	.toggle-btn svg {
		flex-shrink: 0;
	}

	.view-hint {
		font-size: 0.8125rem;
		color: #78716c;
	}

	.main-content {
		flex: 1;
		display: flex;
		flex-direction: column;
		min-height: 0;
	}

	.view-container {
		flex: 1;
		display: flex;
		flex-direction: column;
		min-height: 400px;
	}

	.time-controls {
		flex-shrink: 0;
	}

	/* Ensure child components fill the container */
	.view-container :global(.plot-editor),
	.view-container :global(.isometric-view) {
		flex: 1;
		height: 100%;
	}
</style>
