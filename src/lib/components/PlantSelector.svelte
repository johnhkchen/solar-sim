<script lang="ts" module>
	/**
	 * Types for zone-based plant selection.
	 */
	export interface ZonePlantSelection {
		zoneId: string;
		plants: Array<{
			plantId: string;
			quantity: number;
		}>;
	}
</script>

<script lang="ts">
	/**
	 * PlantSelector - Main component for the Plants phase.
	 * Provides zone selection, filtering, search, and plant cards.
	 */

	import type { Zone, PlacedPlant } from './ZoneEditor.svelte';
	import { LIGHT_COLORS } from './ZoneEditor.svelte';
	import type { PlantFilters, PlantWithAttributes } from '$lib/plants/query';
	import { queryPlants, searchPlantsForZone, formatLightCategoryLabel } from '$lib/plants/query';
	import FilterChips from './FilterChips.svelte';
	import PlantCard from './PlantCard.svelte';
	import PlantDetail from './PlantDetail.svelte';

	interface Props {
		/** All defined zones */
		zones: Zone[];
		/** Currently selected zone ID */
		selectedZoneId: string | null;
		/** Callback when zone selection changes */
		onzoneselect: (zoneId: string | null) => void;
		/** Callback when zone plants change */
		onzoneplantschange: (zoneId: string, plants: PlacedPlant[]) => void;
	}

	let {
		zones,
		selectedZoneId,
		onzoneselect,
		onzoneplantschange
	}: Props = $props();

	// Local state
	let filters = $state<PlantFilters>({});
	let searchTerm = $state('');
	let detailPlant = $state<PlantWithAttributes | null>(null);

	// Derived state
	const selectedZone = $derived(zones.find((z) => z.id === selectedZoneId) ?? null);

	const plantResults = $derived.by(() => {
		if (!selectedZone) return [];

		if (searchTerm.trim()) {
			// Search mode: show all matching plants, but indicate which are recommended
			return searchPlantsForZone(searchTerm, selectedZone.lightCategory);
		}

		// Filter mode: show only recommended plants that match filters
		return queryPlants({
			lightCategory: selectedZone.lightCategory,
			filters,
			searchTerm: undefined
		}).map((p) => ({ ...p, isRecommendedForZone: true }));
	});

	// Get quantity of a plant in the current zone
	function getPlantQuantity(plantId: string): number {
		if (!selectedZone) return 0;
		const placed = selectedZone.plants.find((p) => p.plantId === plantId);
		return placed?.quantity ?? 0;
	}

	// Update quantity for a plant in the current zone
	function setPlantQuantity(plantId: string, quantity: number): void {
		if (!selectedZone) return;

		let newPlants: PlacedPlant[];

		if (quantity <= 0) {
			// Remove the plant
			newPlants = selectedZone.plants.filter((p) => p.plantId !== plantId);
		} else {
			const existing = selectedZone.plants.find((p) => p.plantId === plantId);
			if (existing) {
				// Update quantity
				newPlants = selectedZone.plants.map((p) =>
					p.plantId === plantId ? { ...p, quantity } : p
				);
			} else {
				// Add new plant
				newPlants = [
					...selectedZone.plants,
					{ plantId, quantity, positions: [] }
				];
			}
		}

		onzoneplantschange(selectedZone.id, newPlants);
	}

	// Summary of plants in selected zone
	const zoneSummary = $derived.by(() => {
		if (!selectedZone) return null;
		const speciesCount = selectedZone.plants.length;
		const totalCount = selectedZone.plants.reduce((sum, p) => sum + p.quantity, 0);
		return { speciesCount, totalCount };
	});
</script>

<div class="plant-selector">
	<!-- Zone Selector Tabs -->
	{#if zones.length > 0}
		<div class="zone-tabs">
			{#each zones as zone (zone.id)}
				{@const isSelected = zone.id === selectedZoneId}
				<button
					type="button"
					class="zone-tab"
					class:selected={isSelected}
					style="--zone-color: {LIGHT_COLORS[zone.lightCategory]}"
					onclick={() => onzoneselect(isSelected ? null : zone.id)}
					aria-selected={isSelected}
				>
					<span class="zone-tab-name">{zone.name}</span>
					<span class="zone-tab-light">{formatLightCategoryLabel(zone.lightCategory)}</span>
				</button>
			{/each}
		</div>
	{:else}
		<div class="no-zones-message">
			<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
				<rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
				<line x1="12" y1="8" x2="12" y2="12"></line>
				<line x1="12" y1="16" x2="12.01" y2="16"></line>
			</svg>
			<p>No planting zones defined. Draw zones on the map to select plants for each area.</p>
		</div>
	{/if}

	{#if selectedZone}
		<!-- Search Bar -->
		<div class="search-bar">
			<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="search-icon" aria-hidden="true">
				<circle cx="11" cy="11" r="8"></circle>
				<line x1="21" y1="21" x2="16.65" y2="16.65"></line>
			</svg>
			<input
				type="search"
				placeholder="Search plants..."
				bind:value={searchTerm}
			/>
			{#if searchTerm}
				<button
					type="button"
					class="clear-search"
					onclick={() => (searchTerm = '')}
					aria-label="Clear search"
				>
					<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
						<line x1="18" y1="6" x2="6" y2="18"></line>
						<line x1="6" y1="6" x2="18" y2="18"></line>
					</svg>
				</button>
			{/if}
		</div>

		<!-- Filter Chips (hidden during search) -->
		{#if !searchTerm.trim()}
			<div class="filters-section">
				<FilterChips {filters} onchange={(f) => (filters = f)} />
			</div>
		{/if}

		<!-- Zone Summary -->
		{#if zoneSummary && zoneSummary.totalCount > 0}
			<div class="zone-summary">
				<span class="summary-label">Plants in {selectedZone.name}:</span>
				<span class="summary-value">
					{zoneSummary.speciesCount} species, {zoneSummary.totalCount} total
				</span>
			</div>
		{/if}

		<!-- Plant Grid -->
		<div class="plant-grid">
			{#if plantResults.length === 0}
				<div class="no-results">
					{#if searchTerm.trim()}
						<p>No plants found matching "{searchTerm}"</p>
					{:else}
						<p>No plants match the current filters for this zone</p>
					{/if}
				</div>
			{:else}
				{#each plantResults as plant (plant.id)}
					<PlantCard
						{plant}
						quantity={getPlantQuantity(plant.id)}
						notRecommended={!plant.isRecommendedForZone}
						onquantitychange={(qty) => setPlantQuantity(plant.id, qty)}
						onclick={() => (detailPlant = plant)}
					/>
				{/each}
			{/if}
		</div>
	{:else if zones.length > 0}
		<!-- No zone selected state -->
		<div class="select-zone-prompt">
			<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true">
				<path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path>
			</svg>
			<p>Select a zone above to browse and add plants</p>
		</div>
	{/if}
</div>

<!-- Plant Detail Modal -->
{#if detailPlant && selectedZone}
	<PlantDetail
		plant={detailPlant}
		zoneName={selectedZone.name}
		quantity={getPlantQuantity(detailPlant.id)}
		onquantitychange={(qty) => setPlantQuantity(detailPlant.id, qty)}
		onclose={() => (detailPlant = null)}
	/>
{/if}

<style>
	.plant-selector {
		display: flex;
		flex-direction: column;
		gap: 1rem;
	}

	/* Zone Tabs */
	.zone-tabs {
		display: flex;
		gap: 0.5rem;
		flex-wrap: wrap;
	}

	.zone-tab {
		display: flex;
		flex-direction: column;
		gap: 0.125rem;
		padding: 0.5rem 0.875rem;
		background: #f9fafb;
		border: 2px solid #e5e7eb;
		border-radius: 8px;
		cursor: pointer;
		transition: all 0.15s;
		text-align: left;
	}

	.zone-tab:hover {
		border-color: var(--zone-color);
		background: white;
	}

	.zone-tab.selected {
		border-color: var(--zone-color);
		background: white;
		box-shadow: 0 0 0 2px color-mix(in srgb, var(--zone-color) 20%, transparent);
	}

	.zone-tab-name {
		font-weight: 600;
		font-size: 0.875rem;
		color: #1f2937;
	}

	.zone-tab.selected .zone-tab-name {
		color: var(--zone-color);
	}

	.zone-tab-light {
		font-size: 0.75rem;
		color: #6b7280;
	}

	.zone-tab.selected .zone-tab-light {
		color: var(--zone-color);
	}

	/* Search Bar */
	.search-bar {
		position: relative;
		display: flex;
		align-items: center;
	}

	.search-icon {
		position: absolute;
		left: 0.75rem;
		color: #9ca3af;
		pointer-events: none;
	}

	.search-bar input {
		width: 100%;
		padding: 0.625rem 2.5rem 0.625rem 2.5rem;
		border: 1px solid #e5e7eb;
		border-radius: 8px;
		font-size: 0.9375rem;
		transition: border-color 0.15s, box-shadow 0.15s;
	}

	.search-bar input:focus {
		outline: none;
		border-color: #22c55e;
		box-shadow: 0 0 0 3px rgba(34, 197, 94, 0.15);
	}

	.clear-search {
		position: absolute;
		right: 0.5rem;
		width: 28px;
		height: 28px;
		display: flex;
		align-items: center;
		justify-content: center;
		background: none;
		border: none;
		color: #9ca3af;
		cursor: pointer;
		border-radius: 4px;
		transition: background-color 0.15s, color 0.15s;
	}

	.clear-search:hover {
		background: #f3f4f6;
		color: #374151;
	}

	/* Filters Section */
	.filters-section {
		padding-top: 0.25rem;
	}

	/* Zone Summary */
	.zone-summary {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.5rem 0.75rem;
		background: #f0fdf4;
		border: 1px solid #86efac;
		border-radius: 6px;
		font-size: 0.875rem;
	}

	.summary-label {
		color: #15803d;
	}

	.summary-value {
		font-weight: 600;
		color: #166534;
	}

	/* Plant Grid */
	.plant-grid {
		display: grid;
		grid-template-columns: repeat(2, 1fr);
		gap: 0.75rem;
	}

	@media (min-width: 640px) {
		.plant-grid {
			grid-template-columns: repeat(3, 1fr);
		}
	}

	.no-results {
		grid-column: 1 / -1;
		padding: 2rem 1rem;
		text-align: center;
	}

	.no-results p {
		margin: 0;
		font-size: 0.9375rem;
		color: #6b7280;
	}

	/* Empty/Prompt States */
	.no-zones-message,
	.select-zone-prompt {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.75rem;
		padding: 2rem 1rem;
		background: #f9fafb;
		border: 1px dashed #d1d5db;
		border-radius: 8px;
		text-align: center;
	}

	.no-zones-message svg,
	.select-zone-prompt svg {
		color: #9ca3af;
	}

	.no-zones-message p,
	.select-zone-prompt p {
		margin: 0;
		font-size: 0.875rem;
		color: #6b7280;
		max-width: 280px;
	}

	/* Mobile adjustments - ensure 44pt touch targets */
	@media (max-width: 640px) {
		.zone-tabs {
			overflow-x: auto;
			flex-wrap: nowrap;
			margin: 0 -1rem;
			padding: 0 1rem;
			scrollbar-width: none;
			gap: 0.625rem;
		}

		.zone-tabs::-webkit-scrollbar {
			display: none;
		}

		.zone-tab {
			flex-shrink: 0;
			/* Minimum 44px height for touch targets */
			min-height: 44px;
			padding: 0.625rem 1rem;
		}

		.zone-tab-name {
			font-size: 0.9375rem;
		}

		.zone-tab-light {
			font-size: 0.8125rem;
		}

		.search-bar input {
			/* Minimum 44px height */
			min-height: 44px;
			font-size: 1rem;
			padding: 0.75rem 2.75rem 0.75rem 2.75rem;
		}

		.search-icon {
			left: 0.875rem;
		}

		.clear-search {
			right: 0.625rem;
			width: 36px;
			height: 36px;
		}

		.plant-grid {
			grid-template-columns: repeat(2, 1fr);
			gap: 0.5rem;
		}
	}

	/* Tablet (iPad) optimizations */
	@media (min-width: 641px) and (max-width: 1024px) and (hover: none) {
		.zone-tabs {
			gap: 0.75rem;
		}

		.zone-tab {
			min-height: 52px;
			padding: 0.75rem 1.25rem;
		}

		.zone-tab-name {
			font-size: 1rem;
		}

		.zone-tab-light {
			font-size: 0.875rem;
		}

		.search-bar input {
			min-height: 48px;
			font-size: 1rem;
			padding: 0.875rem 3rem 0.875rem 3rem;
		}

		.search-icon {
			left: 1rem;
			width: 20px;
			height: 20px;
		}

		.clear-search {
			width: 40px;
			height: 40px;
		}

		.plant-grid {
			grid-template-columns: repeat(2, 1fr);
			gap: 0.75rem;
		}
	}

	/* High contrast for outdoor visibility */
	@media (prefers-contrast: more) {
		.zone-tab {
			border-width: 3px;
			border-color: #4b5563;
		}

		.zone-tab.selected {
			border-color: var(--zone-color);
			box-shadow: 0 0 0 3px color-mix(in srgb, var(--zone-color) 30%, transparent);
		}

		.zone-tab-name {
			color: #000;
			font-weight: 700;
		}

		.zone-tab-light {
			color: #374151;
			font-weight: 600;
		}

		.search-bar input {
			border-width: 2px;
			border-color: #4b5563;
		}

		.search-bar input:focus {
			border-color: #166534;
			box-shadow: 0 0 0 4px rgba(34, 197, 94, 0.25);
		}

		.zone-summary {
			border-width: 2px;
			font-weight: 600;
		}

		.summary-label,
		.summary-value {
			color: #052e16;
		}
	}
</style>
