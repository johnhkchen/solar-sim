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
	 *
	 * On mobile screens (under 600px), the component shows a collapsed summary
	 * by default to avoid consuming the entire viewport. Tapping the summary
	 * expands to a fullscreen overlay for editing.
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

	// Mobile state management: tracks whether the mobile overlay is expanded
	let isMobileExpanded = $state(false);
	let isMobile = $state(false);

	// Detect mobile viewport on mount and resize
	$effect(() => {
		if (typeof window === 'undefined') return;

		function checkMobile(): void {
			isMobile = window.innerWidth < 600;
			// Auto-collapse when switching to mobile, auto-expand when switching to desktop
			if (!isMobile) {
				isMobileExpanded = false;
			}
		}

		checkMobile();
		window.addEventListener('resize', checkMobile);

		return () => {
			window.removeEventListener('resize', checkMobile);
		};
	});

	// Lock body scroll when mobile overlay is open
	$effect(() => {
		if (typeof document === 'undefined') return;

		if (isMobileExpanded) {
			document.body.style.overflow = 'hidden';
		} else {
			document.body.style.overflow = '';
		}

		return () => {
			document.body.style.overflow = '';
		};
	});

	// Shadows computed from obstacles and sun position
	const shadows = $derived.by<ShadowPolygon[]>(() => {
		if (!sunPosition || sunPosition.altitude <= 0) return [];
		return calculateAllShadows(obstacles, sunPosition, slope);
	});

	/**
	 * Generates a human-readable summary of the current plot configuration.
	 */
	const plotSummary = $derived.by(() => {
		const parts: string[] = [];

		// Obstacle summary
		if (obstacles.length === 0) {
			parts.push('No obstacles');
		} else if (obstacles.length === 1) {
			parts.push('1 obstacle');
		} else {
			parts.push(`${obstacles.length} obstacles`);
		}

		// Slope summary (only if slope is configured)
		if (slope.angle > 0) {
			const directions = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
			const index = Math.round(slope.aspect / 45) % 8;
			parts.push(`${slope.angle}° ${directions[index]}-facing slope`);
		}

		return parts.join(', ');
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

	/**
	 * Opens the mobile overlay for editing.
	 */
	function openMobileOverlay(): void {
		isMobileExpanded = true;
	}

	/**
	 * Closes the mobile overlay and returns to collapsed summary.
	 */
	function closeMobileOverlay(): void {
		isMobileExpanded = false;
	}
</script>

<!-- Mobile collapsed view: shows summary and tap-to-expand prompt -->
{#if isMobile && !isMobileExpanded}
	<button
		type="button"
		class="mobile-collapsed"
		onclick={openMobileOverlay}
		aria-label="Tap to edit garden layout"
	>
		<div class="collapsed-icon">
			<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
				<rect x="3" y="3" width="18" height="18" rx="2" />
				<line x1="3" y1="12" x2="21" y2="12" />
				<line x1="12" y1="3" x2="12" y2="21" />
			</svg>
		</div>
		<div class="collapsed-content">
			<span class="collapsed-summary">{plotSummary}</span>
			<span class="collapsed-action">Tap to edit garden layout</span>
		</div>
		<div class="collapsed-chevron">
			<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
				<polyline points="9 18 15 12 9 6" />
			</svg>
		</div>
	</button>
{/if}

<!-- Mobile fullscreen overlay -->
{#if isMobile && isMobileExpanded}
	<div class="mobile-overlay" role="dialog" aria-modal="true" aria-label="Garden layout editor">
		<div class="mobile-overlay-header">
			<h3>Edit Garden Layout</h3>
			<button
				type="button"
				class="mobile-close-btn"
				onclick={closeMobileOverlay}
				aria-label="Close editor"
			>
				<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
					<line x1="18" y1="6" x2="6" y2="18" />
					<line x1="6" y1="6" x2="18" y2="18" />
				</svg>
			</button>
		</div>

		<div class="mobile-overlay-content">
			<div class="mobile-view-toggle" role="tablist">
				<button
					type="button"
					role="tab"
					class="toggle-btn"
					class:active={viewMode === 'plan'}
					aria-selected={viewMode === 'plan'}
					onclick={() => setViewMode('plan')}
				>
					Plan
				</button>
				<button
					type="button"
					role="tab"
					class="toggle-btn"
					class:active={viewMode === 'isometric'}
					aria-selected={viewMode === 'isometric'}
					onclick={() => setViewMode('isometric')}
				>
					3D
				</button>
			</div>

			<div class="mobile-view-container">
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

			<div class="mobile-time-controls">
				<TimeScrubber
					{date}
					{latitude}
					{longitude}
					onTimeChange={handleTimeChange}
				/>
			</div>
		</div>

		<button
			type="button"
			class="mobile-done-btn"
			onclick={closeMobileOverlay}
		>
			Done
		</button>
	</div>
{/if}

<!-- Desktop view: always visible, full-size component -->
<div class="plot-viewer" class:desktop-only={isMobile}>
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
	/* Mobile collapsed view */
	.mobile-collapsed {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		width: 100%;
		padding: 1rem;
		background: #fafaf9;
		border: 1px solid #e7e5e4;
		border-radius: 8px;
		cursor: pointer;
		transition: all 0.15s ease;
		text-align: left;
	}

	.mobile-collapsed:hover {
		background: #f5f5f4;
		border-color: #d6d3d1;
	}

	.mobile-collapsed:active {
		background: #e7e5e4;
	}

	.collapsed-icon {
		flex-shrink: 0;
		display: flex;
		align-items: center;
		justify-content: center;
		width: 40px;
		height: 40px;
		background: #e7e5e4;
		border-radius: 8px;
		color: #57534e;
	}

	.collapsed-content {
		flex: 1;
		display: flex;
		flex-direction: column;
		gap: 0.125rem;
	}

	.collapsed-summary {
		font-size: 0.9375rem;
		font-weight: 500;
		color: #1c1917;
	}

	.collapsed-action {
		font-size: 0.8125rem;
		color: #78716c;
	}

	.collapsed-chevron {
		flex-shrink: 0;
		color: #a8a29e;
	}

	/* Mobile fullscreen overlay */
	.mobile-overlay {
		position: fixed;
		inset: 0;
		z-index: 1000;
		display: flex;
		flex-direction: column;
		background: white;
	}

	.mobile-overlay-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 0.75rem 1rem;
		border-bottom: 1px solid #e7e5e4;
		background: #fafaf9;
	}

	.mobile-overlay-header h3 {
		margin: 0;
		font-size: 1rem;
		font-weight: 600;
		color: #1c1917;
	}

	.mobile-close-btn {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 36px;
		height: 36px;
		padding: 0;
		background: transparent;
		border: none;
		border-radius: 8px;
		color: #57534e;
		cursor: pointer;
		transition: all 0.15s ease;
	}

	.mobile-close-btn:hover {
		background: #e7e5e4;
		color: #1c1917;
	}

	.mobile-overlay-content {
		flex: 1;
		display: flex;
		flex-direction: column;
		overflow: hidden;
		padding: 0.75rem;
		gap: 0.75rem;
	}

	.mobile-view-toggle {
		display: flex;
		gap: 0;
		background: #e7e5e4;
		border-radius: 8px;
		padding: 3px;
		flex-shrink: 0;
	}

	.mobile-view-toggle .toggle-btn {
		flex: 1;
		justify-content: center;
	}

	.mobile-view-container {
		flex: 1;
		display: flex;
		flex-direction: column;
		min-height: 0;
		overflow: hidden;
	}

	.mobile-view-container :global(.plot-editor),
	.mobile-view-container :global(.isometric-view) {
		flex: 1;
		height: 100%;
	}

	.mobile-time-controls {
		flex-shrink: 0;
	}

	.mobile-done-btn {
		margin: 0.75rem;
		padding: 0.875rem 1.5rem;
		background: #166534;
		color: white;
		border: none;
		border-radius: 8px;
		font-size: 1rem;
		font-weight: 600;
		cursor: pointer;
		transition: background-color 0.15s ease;
	}

	.mobile-done-btn:hover {
		background: #15803d;
	}

	.mobile-done-btn:active {
		background: #14532d;
	}

	/* Desktop-only visibility */
	.desktop-only {
		display: none;
	}

	/* Desktop view */
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
