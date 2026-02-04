<script lang="ts" module>
	/**
	 * Data structure for a clicked spot on the heatmap.
	 */
	export interface InspectedSpot {
		lat: number;
		lng: number;
		sunHours: number;
	}
</script>

<script lang="ts">
	import { classifySunHours, getCategoryInfo, type CategoryInfo } from '$lib/solar/categories.js';
	import { getPlantsForSunHours, type Plant } from '$lib/plants/database.js';

	/**
	 * Props for the SpotInspector component.
	 */
	interface SpotInspectorProps {
		/** The inspected spot data including lat/lng and sun hours */
		spot: InspectedSpot;
		/** Callback when the user clicks "Set as observation point" */
		onsetobservation?: (lat: number, lng: number) => void;
		/** Callback when the user closes the inspector */
		onclose?: () => void;
		/** Whether to show the "Set as observation point" button */
		showSetObservation?: boolean;
	}

	let {
		spot,
		onsetobservation,
		onclose,
		showSetObservation = true
	}: SpotInspectorProps = $props();

	// Get category info for the sun hours value
	const categoryInfo: CategoryInfo = $derived(getCategoryInfo(spot.sunHours));

	// Get suitable plants for this light level, limited to top 3
	const suggestedPlants: Plant[] = $derived.by(() => {
		const allSuitable = getPlantsForSunHours(spot.sunHours);

		// Sort by how well they match the light level (prefer plants whose ideal range includes this value)
		const scored = allSuitable.map(plant => {
			const idealMin = plant.light.idealMinHours ?? plant.light.minSunHours;
			const idealMax = plant.light.idealMaxHours ?? 12;
			const maxHours = plant.light.maxSunHours ?? 12;

			let score = 0;

			// Perfect match if within ideal range
			if (spot.sunHours >= idealMin && spot.sunHours <= idealMax) {
				score = 100;
			}
			// Good match if within acceptable range
			else if (spot.sunHours >= plant.light.minSunHours && spot.sunHours <= maxHours) {
				score = 70;
			}
			// Lower score if too much sun for the plant
			else if (spot.sunHours > maxHours) {
				score = 30;
			}
			// Some score if plant can tolerate this but prefers more
			else {
				score = 50;
			}

			return { plant, score };
		});

		// Sort by score descending, then take top 3
		scored.sort((a, b) => b.score - a.score);
		return scored.slice(0, 3).map(s => s.plant);
	});

	// Get the CSS class for the category
	function getCategoryClass(category: string): string {
		return `category-${category}`;
	}

	// Format coordinates for display
	function formatCoord(value: number, isLat: boolean): string {
		const direction = isLat ? (value >= 0 ? 'N' : 'S') : (value >= 0 ? 'E' : 'W');
		return `${Math.abs(value).toFixed(5)}° ${direction}`;
	}

	// Handle set observation point
	function handleSetObservation(): void {
		onsetobservation?.(spot.lat, spot.lng);
	}

	// Handle close
	function handleClose(): void {
		onclose?.();
	}
</script>

<div class="spot-inspector" role="dialog" aria-label="Spot inspection details">
	<div class="inspector-header">
		<h3>This Spot</h3>
		{#if onclose}
			<button
				type="button"
				class="close-button"
				onclick={handleClose}
				aria-label="Close inspector"
			>
				<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
					<line x1="18" y1="6" x2="6" y2="18"></line>
					<line x1="6" y1="6" x2="18" y2="18"></line>
				</svg>
			</button>
		{/if}
	</div>

	<div class="sun-hours-value">
		<span class="hours-number">{spot.sunHours.toFixed(1)}</span>
		<span class="hours-unit">hours average</span>
	</div>

	<div class="category-badge {getCategoryClass(categoryInfo.category)}">
		<span class="category-label">{categoryInfo.label}</span>
		<span class="category-range">{categoryInfo.sunHoursRange}</span>
	</div>

	<p class="category-description">{categoryInfo.description}</p>

	{#if suggestedPlants.length > 0}
		<div class="plant-suggestions">
			<h4>Good for:</h4>
			<ul class="plant-list">
				{#each suggestedPlants as plant}
					<li class="plant-item">
						<span class="plant-name">{plant.name}</span>
						<span class="plant-category">{plant.category}</span>
					</li>
				{/each}
			</ul>
		</div>
	{/if}

	<div class="inspector-coords">
		{formatCoord(spot.lat, true)}, {formatCoord(spot.lng, false)}
	</div>

	<div class="inspector-actions">
		{#if showSetObservation && onsetobservation}
			<button
				type="button"
				class="set-observation-button"
				onclick={handleSetObservation}
			>
				<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
					<circle cx="12" cy="12" r="3"/>
					<line x1="12" y1="2" x2="12" y2="6"/>
					<line x1="12" y1="18" x2="12" y2="22"/>
					<line x1="2" y1="12" x2="6" y2="12"/>
					<line x1="18" y1="12" x2="22" y2="12"/>
				</svg>
				Set as Main Point
			</button>
		{/if}
		{#if onclose}
			<button
				type="button"
				class="close-action-button"
				onclick={handleClose}
			>
				Close
			</button>
		{/if}
	</div>
</div>

<style>
	.spot-inspector {
		background: white;
		border-radius: 8px;
		box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
		padding: 1rem;
		min-width: 240px;
		max-width: 300px;
		font-family: system-ui, -apple-system, sans-serif;
	}

	.inspector-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 0.75rem;
		padding-bottom: 0.5rem;
		border-bottom: 1px solid #e5e7eb;
	}

	.inspector-header h3 {
		margin: 0;
		font-size: 1rem;
		font-weight: 600;
		color: #1f2937;
	}

	.close-button {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 24px;
		height: 24px;
		padding: 0;
		background: transparent;
		border: none;
		border-radius: 4px;
		color: #6b7280;
		cursor: pointer;
		transition: all 0.15s;
	}

	.close-button:hover {
		background: #f3f4f6;
		color: #374151;
	}

	.sun-hours-value {
		display: flex;
		align-items: baseline;
		gap: 0.375rem;
		margin-bottom: 0.75rem;
	}

	.hours-number {
		font-size: 2rem;
		font-weight: 700;
		color: #111827;
		line-height: 1;
	}

	.hours-unit {
		font-size: 0.875rem;
		color: #6b7280;
	}

	.category-badge {
		display: inline-flex;
		flex-direction: column;
		padding: 0.5rem 0.75rem;
		border-radius: 6px;
		margin-bottom: 0.75rem;
	}

	.category-label {
		font-weight: 600;
		font-size: 0.9375rem;
	}

	.category-range {
		font-size: 0.75rem;
		opacity: 0.8;
	}

	/* Category-specific colors */
	.category-full-sun {
		background: #fef3c7;
		border: 1px solid #fcd34d;
	}
	.category-full-sun .category-label {
		color: #b45309;
	}
	.category-full-sun .category-range {
		color: #92400e;
	}

	.category-part-sun {
		background: #fef9c3;
		border: 1px solid #fde047;
	}
	.category-part-sun .category-label {
		color: #a16207;
	}
	.category-part-sun .category-range {
		color: #854d0e;
	}

	.category-part-shade {
		background: #dcfce7;
		border: 1px solid #86efac;
	}
	.category-part-shade .category-label {
		color: #15803d;
	}
	.category-part-shade .category-range {
		color: #166534;
	}

	.category-full-shade {
		background: #dbeafe;
		border: 1px solid #93c5fd;
	}
	.category-full-shade .category-label {
		color: #1d4ed8;
	}
	.category-full-shade .category-range {
		color: #1e40af;
	}

	.category-description {
		margin: 0 0 0.75rem;
		font-size: 0.8125rem;
		color: #4b5563;
		line-height: 1.4;
	}

	.plant-suggestions {
		margin-bottom: 0.75rem;
		padding: 0.625rem;
		background: #f9fafb;
		border-radius: 6px;
	}

	.plant-suggestions h4 {
		margin: 0 0 0.375rem;
		font-size: 0.8125rem;
		font-weight: 600;
		color: #374151;
	}

	.plant-list {
		list-style: none;
		margin: 0;
		padding: 0;
	}

	.plant-item {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 0.25rem 0;
		font-size: 0.8125rem;
	}

	.plant-item:not(:last-child) {
		border-bottom: 1px solid #e5e7eb;
	}

	.plant-name {
		color: #1f2937;
		font-weight: 500;
	}

	.plant-category {
		font-size: 0.6875rem;
		text-transform: uppercase;
		letter-spacing: 0.025em;
		color: #9ca3af;
	}

	.inspector-coords {
		font-size: 0.6875rem;
		font-family: ui-monospace, monospace;
		color: #9ca3af;
		margin-bottom: 0.75rem;
	}

	.inspector-actions {
		display: flex;
		gap: 0.5rem;
		flex-wrap: wrap;
	}

	.set-observation-button {
		display: flex;
		align-items: center;
		gap: 0.375rem;
		padding: 0.5rem 0.75rem;
		background: #dc2626;
		color: white;
		border: none;
		border-radius: 4px;
		font-size: 0.8125rem;
		font-weight: 500;
		cursor: pointer;
		transition: background-color 0.15s;
	}

	.set-observation-button:hover {
		background: #b91c1c;
	}

	.close-action-button {
		padding: 0.5rem 0.75rem;
		background: transparent;
		color: #6b7280;
		border: 1px solid #d1d5db;
		border-radius: 4px;
		font-size: 0.8125rem;
		font-weight: 500;
		cursor: pointer;
		transition: all 0.15s;
	}

	.close-action-button:hover {
		background: #f3f4f6;
		color: #374151;
	}

	/* Mobile adjustments */
	@media (max-width: 640px) {
		.spot-inspector {
			min-width: 200px;
			padding: 0.875rem;
		}

		.hours-number {
			font-size: 1.75rem;
		}

		.inspector-actions {
			flex-direction: column;
		}

		.set-observation-button,
		.close-action-button {
			width: 100%;
			justify-content: center;
		}
	}
</style>
