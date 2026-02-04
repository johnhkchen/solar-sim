<script lang="ts">
	/**
	 * FilterChips - Toggleable filter buttons for plant selection.
	 * Each chip represents an attribute filter (edible, low water, etc.).
	 * Active filters combine with AND logic.
	 */

	import type { PlantFilters } from '$lib/plants/query';
	import { FILTER_OPTIONS } from '$lib/plants/query';

	interface Props {
		/** Current active filters */
		filters: PlantFilters;
		/** Callback when filters change */
		onchange: (filters: PlantFilters) => void;
	}

	let { filters, onchange }: Props = $props();

	function toggleFilter(key: keyof PlantFilters): void {
		const newFilters = { ...filters };
		if (newFilters[key]) {
			delete newFilters[key];
		} else {
			(newFilters as Record<string, boolean>)[key] = true;
		}
		onchange(newFilters);
	}

	function clearAll(): void {
		onchange({});
	}

	const activeCount = $derived(Object.values(filters).filter(Boolean).length);
</script>

<div class="filter-chips">
	<div class="chips-container">
		{#each FILTER_OPTIONS as option (option.key)}
			{@const isActive = filters[option.key] === true}
			<button
				type="button"
				class="chip"
				class:active={isActive}
				onclick={() => toggleFilter(option.key)}
				title={option.description}
				aria-pressed={isActive}
			>
				{#if isActive}
					<svg
						xmlns="http://www.w3.org/2000/svg"
						width="14"
						height="14"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						stroke-width="2.5"
						aria-hidden="true"
					>
						<polyline points="20 6 9 17 4 12"></polyline>
					</svg>
				{/if}
				{option.label}
			</button>
		{/each}
	</div>

	{#if activeCount > 0}
		<button type="button" class="clear-btn" onclick={clearAll}>
			Clear ({activeCount})
		</button>
	{/if}
</div>

<style>
	.filter-chips {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		flex-wrap: wrap;
	}

	.chips-container {
		display: flex;
		flex-wrap: wrap;
		gap: 0.375rem;
	}

	.chip {
		display: inline-flex;
		align-items: center;
		gap: 0.25rem;
		padding: 0.375rem 0.625rem;
		background: #f3f4f6;
		border: 1px solid #e5e7eb;
		border-radius: 9999px;
		font-size: 0.8125rem;
		color: #4b5563;
		cursor: pointer;
		transition: all 0.15s;
	}

	.chip:hover {
		background: #e5e7eb;
		border-color: #d1d5db;
	}

	.chip.active {
		background: #dcfce7;
		border-color: #22c55e;
		color: #166534;
	}

	.chip.active:hover {
		background: #bbf7d0;
	}

	.clear-btn {
		padding: 0.25rem 0.5rem;
		background: none;
		border: none;
		font-size: 0.75rem;
		color: #6b7280;
		cursor: pointer;
		text-decoration: underline;
	}

	.clear-btn:hover {
		color: #374151;
	}

	/* Mobile adjustments - ensure 44pt touch targets */
	@media (max-width: 640px) {
		.chip {
			/* Minimum 44px height for touch targets */
			min-height: 44px;
			padding: 0.625rem 0.875rem;
			font-size: 0.9375rem;
		}

		.chips-container {
			gap: 0.5rem;
		}

		.clear-btn {
			min-height: 44px;
			padding: 0.5rem 0.75rem;
			font-size: 0.8125rem;
		}
	}

	/* Tablet (iPad) optimizations */
	@media (min-width: 641px) and (max-width: 1024px) and (hover: none) {
		.chip {
			min-height: 48px;
			padding: 0.75rem 1rem;
			font-size: 0.9375rem;
		}

		.chips-container {
			gap: 0.625rem;
		}

		.clear-btn {
			min-height: 48px;
			padding: 0.625rem 1rem;
			font-size: 0.875rem;
		}
	}

	/* High contrast for outdoor visibility */
	@media (prefers-contrast: more) {
		.chip {
			border-width: 2px;
			border-color: #6b7280;
			color: #1f2937;
			font-weight: 600;
		}

		.chip.active {
			border-color: #166534;
			background: #bbf7d0;
			color: #052e16;
			font-weight: 700;
		}

		.clear-btn {
			color: #1f2937;
			font-weight: 600;
		}
	}
</style>
