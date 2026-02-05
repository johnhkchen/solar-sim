<script lang="ts">
	/**
	 * SunHoursDisplay component shows the combined sun-hours calculation
	 * with breakdown of theoretical, terrain/building, and tree shadow hours.
	 */
	import { untrack } from 'svelte';
	import {
		calculateCombinedSunHoursSync,
		calculateSeasonalCombinedSunHours,
		formatSunHoursBreakdown,
		getTreeShadePercent,
		getTotalShadePercent,
		type CombinedSunHoursResult,
		type SeasonalCombinedSunHours,
		type SunHoursBreakdown
	} from '$lib/solar';
	import type { MapTreeConfig, LatLng } from '$lib/solar';
	import type { Coordinates } from '$lib/solar';
	import { classifySunHours, CATEGORIES, type LightCategory } from '$lib/solar';
	import type { ShadeMapInterface } from './MapPicker.svelte';

	interface SunHoursDisplayProps {
		observationPoint: LatLng;
		trees: MapTreeConfig[];
		date?: Date;
		showSeasonalAverage?: boolean;
		growingSeasonStart?: Date;
		growingSeasonEnd?: Date;
		shadeMapInterface?: ShadeMapInterface | null;
		/** Current shadow view mode from MapPicker. Sun exposure only works in 'solar-hours' mode. */
		shadowViewMode?: 'shadows' | 'solar-hours';
	}

	let {
		observationPoint,
		trees = [],
		date = new Date(),
		showSeasonalAverage = false,
		growingSeasonStart,
		growingSeasonEnd,
		shadeMapInterface = null,
		shadowViewMode = 'shadows'
	}: SunHoursDisplayProps = $props();

	// Convert LatLng to Coordinates for solar calculations
	const coords = $derived<Coordinates>({
		latitude: observationPoint.lat,
		longitude: observationPoint.lng
	});

	// State for ShadeMap sun hours query
	let shadeMapSunHours = $state<number | null>(null);
	let shadeMapLoading = $state(false);

	// Query ShadeMap for terrain/building-adjusted sun hours
	// Only works in 'solar-hours' mode when sun exposure is enabled by MapPicker
	$effect(() => {
		// Track dependencies
		const sm = shadeMapInterface;
		const point = observationPoint;
		const d = date;
		const mode = shadowViewMode;

		// Only query when in solar-hours mode (MapPicker enables sun exposure)
		if (!sm || !sm.isAvailable() || mode !== 'solar-hours') {
			shadeMapSunHours = null;
			shadeMapLoading = false;
			sm?.setObservationCalculating?.(false);
			return;
		}

		// Run the async query without re-triggering when shadeMapSunHours changes
		untrack(() => {
			shadeMapLoading = true;
			sm.setObservationCalculating?.(true);
		});

		let cancelled = false;

		// Query sun exposure directly - the heatmap is already rendered
		// MapPicker is responsible for calling enableSunExposure() in solar-hours mode
		(async () => {
			try {
				// The sun exposure heatmap is already calculated and rendered on screen
				// We can read pixels immediately - gl.finish() in getHoursOfSun ensures sync
				const hours = sm.getHoursOfSun(point.lat, point.lng);

				console.log('SunHoursDisplay: Querying sun exposure', {
					lat: point.lat,
					lng: point.lng,
					hours
				});

				if (!cancelled) {
					shadeMapSunHours = hours;
					shadeMapLoading = false;
					sm.setObservationCalculating?.(false);
				}
			} catch (err) {
				console.warn('ShadeMap sun exposure query failed:', err);
				if (!cancelled) {
					shadeMapSunHours = null;
					shadeMapLoading = false;
					sm.setObservationCalculating?.(false);
				}
			}
		})();

		return () => {
			cancelled = true;
			sm?.setObservationCalculating?.(false);
		};
	});

	// Calculate daily sun hours (base calculation with tree shadows only)
	const dailyResult = $derived<CombinedSunHoursResult>(
		calculateCombinedSunHoursSync(observationPoint, trees, coords, date)
	);

	// Calculate seasonal sun hours if requested
	const seasonalResult = $derived.by<SeasonalCombinedSunHours | null>(() => {
		if (!showSeasonalAverage || !growingSeasonStart || !growingSeasonEnd) return null;
		return calculateSeasonalCombinedSunHours(
			observationPoint,
			trees,
			coords,
			growingSeasonStart,
			growingSeasonEnd
		);
	});

	// Combine ShadeMap data with tree shadow calculation for final breakdown
	const breakdown = $derived.by<SunHoursBreakdown>(() => {
		const baseBreakdown = seasonalResult?.averageBreakdown ?? dailyResult.breakdown;

		// Use ShadeMap data when available (including 0 for fully shaded areas)
		// null means ShadeMap is unavailable or not in solar-hours mode
		if (shadeMapSunHours !== null && shadeMapSunHours >= 0) {
			const theoretical = baseBreakdown.theoretical;

			// ShadeMap gives us hours of sun after terrain/building shadows
			// terrainAndBuildingShadow = theoretical - shadeMapSunHours
			const terrainAndBuildingShadow = Math.max(0, theoretical - shadeMapSunHours);

			// Tree shadow from our calculation (hours blocked by trees during daylight)
			const treeShadow = baseBreakdown.treeShadow;

			// The effective sun hours start from ShadeMap's value (already accounts for terrain)
			// Then we subtract tree shadows, but trees can only block during the sunny periods
			// So tree shadow impact is limited to shadeMapSunHours
			const treeImpact = Math.min(treeShadow, shadeMapSunHours);
			const effective = Math.max(0, shadeMapSunHours - treeImpact);

			// Overlap occurs when terrain and trees shadow the same periods
			// overlapShadow = treeShadow - treeImpact (the tree shadow that fell on already-shaded periods)
			const overlapShadow = Math.max(0, treeShadow - treeImpact);

			// Debug logging
			console.log('SunHoursDisplay breakdown:', {
				theoretical,
				shadeMapSunHours,
				terrainAndBuildingShadow,
				treeShadow,
				treeImpact,
				overlapShadow,
				effective
			});

			return {
				theoretical,
				terrainAndBuildingShadow,
				treeShadow,
				overlapShadow,
				effective
			};
		}

		// No ShadeMap data, use base breakdown
		return baseBreakdown;
	});

	// Category colors for visual display
	const CATEGORY_COLORS: Record<LightCategory, string> = {
		'full-sun': '#f59e0b',
		'part-sun': '#84cc16',
		'part-shade': '#22c55e',
		'full-shade': '#6b7280'
	};

	// Classify the effective sun hours
	const lightCategory = $derived<LightCategory>(classifySunHours(breakdown.effective));
	const categoryInfo = $derived(CATEGORIES[lightCategory]);
	const categoryColor = $derived(CATEGORY_COLORS[lightCategory]);

	// Calculate percentages for visual bar
	const treeShadePercent = $derived(getTreeShadePercent(breakdown));
	const terrainShadePercent = $derived(
		breakdown.theoretical > 0
			? (breakdown.terrainAndBuildingShadow / breakdown.theoretical) * 100
			: 0
	);

	// Format times for display
	function formatTime(date: Date | null): string {
		if (!date) return '--:--';
		return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
	}

	function formatDate(date: Date): string {
		return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
	}
</script>

<div class="sun-hours-display">
	<div class="header">
		<h3 class="title">Sun Hours</h3>
		{#if showSeasonalAverage && seasonalResult}
			<span class="date-range">
				{formatDate(seasonalResult.startDate)} - {formatDate(seasonalResult.endDate)} average
			</span>
		{:else}
			<span class="date-label">{formatDate(date)}</span>
		{/if}
	</div>

	<div class="main-display">
		<div class="effective-hours">
			<span class="hours-value">{breakdown.effective.toFixed(1)}</span>
			<span class="hours-unit">hours</span>
		</div>
		<div class="category-badge" style="background-color: {categoryColor}">
			{categoryInfo.label}
		</div>
	</div>

	<div class="breakdown-bar">
		<div class="bar-container">
			<div
				class="bar-segment sun"
				style="width: {((breakdown.effective / breakdown.theoretical) * 100).toFixed(1)}%"
				title="Effective sun: {breakdown.effective.toFixed(1)}h"
			></div>
			{#if breakdown.treeShadow > 0.1}
				<div
					class="bar-segment tree-shade"
					style="width: {treeShadePercent.toFixed(1)}%"
					title="Tree shade: {breakdown.treeShadow.toFixed(1)}h"
				></div>
			{/if}
			{#if breakdown.terrainAndBuildingShadow > 0.1}
				<div
					class="bar-segment terrain-shade"
					style="width: {terrainShadePercent.toFixed(1)}%"
					title="Terrain/building shade: {breakdown.terrainAndBuildingShadow.toFixed(1)}h"
				></div>
			{/if}
		</div>
		<div class="bar-labels">
			<span>0h</span>
			<span>{breakdown.theoretical.toFixed(0)}h max</span>
		</div>
	</div>

	<div class="breakdown-details">
		<div class="breakdown-row">
			<span class="breakdown-label">Theoretical max</span>
			<span class="breakdown-value">{breakdown.theoretical.toFixed(1)}h</span>
		</div>

		{#if breakdown.terrainAndBuildingShadow > 0.1}
			<div class="breakdown-row shade">
				<span class="breakdown-label">
					<span class="shade-indicator terrain"></span>
					Terrain/buildings
				</span>
				<span class="breakdown-value">-{breakdown.terrainAndBuildingShadow.toFixed(1)}h</span>
			</div>
		{/if}

		{#if breakdown.treeShadow > 0.1}
			<div class="breakdown-row shade">
				<span class="breakdown-label">
					<span class="shade-indicator tree"></span>
					Tree shadows
				</span>
				<span class="breakdown-value">-{breakdown.treeShadow.toFixed(1)}h</span>
			</div>
		{/if}

		{#if breakdown.overlapShadow > 0.1}
			<div class="breakdown-row overlap">
				<span class="breakdown-label">Overlap (counted once)</span>
				<span class="breakdown-value">+{breakdown.overlapShadow.toFixed(1)}h</span>
			</div>
		{/if}

		<div class="breakdown-row total">
			<span class="breakdown-label">Effective sun</span>
			<span class="breakdown-value">{breakdown.effective.toFixed(1)}h</span>
		</div>
	</div>

	{#if !showSeasonalAverage && dailyResult.sunriseTime && dailyResult.sunsetTime}
		<div class="sun-times">
			<div class="sun-time">
				<span class="sun-time-icon">🌅</span>
				<span class="sun-time-label">Sunrise</span>
				<span class="sun-time-value">{formatTime(dailyResult.sunriseTime)}</span>
			</div>
			<div class="sun-time">
				<span class="sun-time-icon">🌇</span>
				<span class="sun-time-label">Sunset</span>
				<span class="sun-time-value">{formatTime(dailyResult.sunsetTime)}</span>
			</div>
		</div>
	{/if}

	{#if trees.length > 0}
		<div class="tree-summary">
			<span class="tree-count">{trees.length} tree{trees.length === 1 ? '' : 's'} included</span>
			{#if treeShadePercent > 1}
				<span class="tree-impact">reducing sun by {treeShadePercent.toFixed(0)}%</span>
			{:else}
				<span class="tree-impact minimal">minimal shade impact</span>
			{/if}
		</div>
	{/if}

	{#if shadeMapLoading}
		<div class="shademap-note loading">
			<svg class="spinner" xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
				<path d="M21 12a9 9 0 1 1-6.219-8.56" />
			</svg>
			<span>Refining with terrain/building data...</span>
		</div>
	{:else if shadowViewMode !== 'solar-hours' && shadeMapInterface?.isAvailable()}
		<div class="shademap-note hint">
			<svg
				xmlns="http://www.w3.org/2000/svg"
				width="14"
				height="14"
				viewBox="0 0 24 24"
				fill="none"
				stroke="currentColor"
				stroke-width="2"
				aria-hidden="true"
			>
				<path d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"/>
			</svg>
			<span>Switch to Solar Hours view for terrain/building calculations</span>
		</div>
	{:else if shadeMapSunHours === null && !shadeMapInterface?.isAvailable()}
		<div class="shademap-note">
			<svg
				xmlns="http://www.w3.org/2000/svg"
				width="14"
				height="14"
				viewBox="0 0 24 24"
				fill="none"
				stroke="currentColor"
				stroke-width="2"
				aria-hidden="true"
			>
				<circle cx="12" cy="12" r="10" />
				<line x1="12" y1="8" x2="12" y2="12" />
				<line x1="12" y1="16" x2="12.01" y2="16" />
			</svg>
			<span>Terrain/building shade unavailable (shadow layer not loaded)</span>
		</div>
	{/if}
</div>

<style>
	.sun-hours-display {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
		padding: 1rem;
		background: white;
		border: 1px solid #e5e7eb;
		border-radius: 8px;
		font-family: system-ui, -apple-system, sans-serif;
	}

	.header {
		display: flex;
		justify-content: space-between;
		align-items: center;
	}

	.title {
		margin: 0;
		font-size: 1rem;
		font-weight: 600;
		color: #1f2937;
	}

	.date-label,
	.date-range {
		font-size: 0.8125rem;
		color: #6b7280;
	}

	.main-display {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 1rem;
	}

	.effective-hours {
		display: flex;
		align-items: baseline;
		gap: 0.25rem;
	}

	.hours-value {
		font-size: 2rem;
		font-weight: 700;
		color: #1f2937;
		line-height: 1;
	}

	.hours-unit {
		font-size: 0.875rem;
		color: #6b7280;
	}

	.category-badge {
		padding: 0.375rem 0.75rem;
		border-radius: 9999px;
		font-size: 0.8125rem;
		font-weight: 500;
		color: white;
	}

	.breakdown-bar {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
	}

	.bar-container {
		display: flex;
		height: 12px;
		background: #e5e7eb;
		border-radius: 6px;
		overflow: hidden;
	}

	.bar-segment {
		height: 100%;
		transition: width 0.3s ease;
	}

	.bar-segment.sun {
		background: linear-gradient(90deg, #fbbf24, #f59e0b);
	}

	.bar-segment.tree-shade {
		background: #22c55e;
	}

	.bar-segment.terrain-shade {
		background: #6b7280;
	}

	.bar-labels {
		display: flex;
		justify-content: space-between;
		font-size: 0.6875rem;
		color: #9ca3af;
	}

	.breakdown-details {
		display: flex;
		flex-direction: column;
		gap: 0.375rem;
		padding-top: 0.5rem;
		border-top: 1px solid #f3f4f6;
	}

	.breakdown-row {
		display: flex;
		justify-content: space-between;
		align-items: center;
		font-size: 0.8125rem;
	}

	.breakdown-label {
		display: flex;
		align-items: center;
		gap: 0.375rem;
		color: #4b5563;
	}

	.breakdown-value {
		font-weight: 500;
		color: #1f2937;
	}

	.breakdown-row.shade .breakdown-value {
		color: #dc2626;
	}

	.breakdown-row.overlap .breakdown-value {
		color: #6b7280;
		font-size: 0.75rem;
	}

	.breakdown-row.total {
		padding-top: 0.375rem;
		border-top: 1px dashed #e5e7eb;
		font-weight: 600;
	}

	.breakdown-row.total .breakdown-value {
		color: #f59e0b;
	}

	.shade-indicator {
		display: inline-block;
		width: 8px;
		height: 8px;
		border-radius: 2px;
	}

	.shade-indicator.tree {
		background: #22c55e;
	}

	.shade-indicator.terrain {
		background: #6b7280;
	}

	.sun-times {
		display: flex;
		justify-content: space-around;
		padding: 0.625rem 0;
		background: #fffbeb;
		border-radius: 6px;
	}

	.sun-time {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.125rem;
	}

	.sun-time-icon {
		font-size: 1.25rem;
	}

	.sun-time-label {
		font-size: 0.6875rem;
		color: #92400e;
	}

	.sun-time-value {
		font-size: 0.875rem;
		font-weight: 600;
		color: #78350f;
	}

	.tree-summary {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 0.5rem 0.75rem;
		background: #f0fdf4;
		border-radius: 6px;
	}

	.tree-count {
		font-size: 0.8125rem;
		font-weight: 500;
		color: #166534;
	}

	.tree-impact {
		font-size: 0.75rem;
		color: #dc2626;
	}

	.tree-impact.minimal {
		color: #6b7280;
	}

	.shademap-note {
		display: flex;
		align-items: flex-start;
		gap: 0.5rem;
		padding: 0.5rem 0.625rem;
		background: #fef3c7;
		border-radius: 6px;
		font-size: 0.75rem;
		color: #92400e;
	}

	.shademap-note svg {
		flex-shrink: 0;
		margin-top: 1px;
	}

	.shademap-note.loading {
		background: #e0f2fe;
		color: #0369a1;
	}

	.shademap-note.hint {
		background: #f0f9ff;
		border: 1px solid #bae6fd;
		color: #0369a1;
	}

	.shademap-note .spinner {
		animation: spin 1s linear infinite;
	}

	@keyframes spin {
		from { transform: rotate(0deg); }
		to { transform: rotate(360deg); }
	}

	/* Mobile responsive styles */
	@media (max-width: 480px) {
		.sun-hours-display {
			padding: 0.75rem;
			gap: 0.625rem;
		}

		.header {
			flex-direction: column;
			align-items: flex-start;
			gap: 0.25rem;
		}

		.title {
			font-size: 0.9375rem;
		}

		.main-display {
			gap: 0.75rem;
		}

		.hours-value {
			font-size: 1.75rem;
		}

		.category-badge {
			padding: 0.25rem 0.625rem;
			font-size: 0.75rem;
		}

		.breakdown-details {
			gap: 0.25rem;
			padding-top: 0.375rem;
		}

		.breakdown-row {
			font-size: 0.75rem;
		}

		.sun-times {
			padding: 0.5rem;
			flex-direction: row;
			justify-content: space-between;
		}

		.sun-time {
			flex-direction: row;
			align-items: center;
			gap: 0.375rem;
		}

		.sun-time-icon {
			font-size: 1rem;
		}

		.sun-time-label {
			font-size: 0.625rem;
		}

		.sun-time-value {
			font-size: 0.8125rem;
		}

		.tree-summary {
			padding: 0.375rem 0.5rem;
			flex-wrap: wrap;
			gap: 0.25rem;
		}

		.tree-count {
			font-size: 0.75rem;
		}

		.tree-impact {
			font-size: 0.6875rem;
		}

		.shademap-note {
			padding: 0.375rem 0.5rem;
			font-size: 0.6875rem;
		}
	}
</style>
