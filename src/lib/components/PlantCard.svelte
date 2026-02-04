<script lang="ts">
	/**
	 * PlantCard - Individual plant display card for the selection grid.
	 * Shows plant photo, names, size, and add button with quantity controls.
	 */

	import type { PlantWithAttributes } from '$lib/plants/query';

	interface Props {
		/** Plant data to display */
		plant: PlantWithAttributes;
		/** Current quantity in the zone (0 if not added) */
		quantity: number;
		/** Whether this plant is grayed out (not recommended for zone) */
		notRecommended?: boolean;
		/** Callback when quantity changes */
		onquantitychange: (quantity: number) => void;
		/** Callback when card is clicked for details */
		onclick: () => void;
	}

	let {
		plant,
		quantity,
		notRecommended = false,
		onquantitychange,
		onclick
	}: Props = $props();

	function handleAdd(e: Event): void {
		e.stopPropagation();
		onquantitychange(quantity + 1);
	}

	function handleIncrement(e: Event): void {
		e.stopPropagation();
		onquantitychange(quantity + 1);
	}

	function handleDecrement(e: Event): void {
		e.stopPropagation();
		onquantitychange(Math.max(0, quantity - 1));
	}

	/** Get category icon/emoji for placeholder */
	function getCategoryIcon(category: string): string {
		switch (category) {
			case 'vegetable': return '🥬';
			case 'herb': return '🌿';
			case 'flower': return '🌸';
			default: return '🌱';
		}
	}

	/** Get water needs indicator */
	function getWaterLevel(): 'low' | 'medium' | 'high' {
		if (plant.isLowWater) return 'low';
		// Could add more logic based on plant data
		return 'medium';
	}

	const waterLevel = $derived(getWaterLevel());
</script>

<article
	class="plant-card"
	class:not-recommended={notRecommended}
	class:has-quantity={quantity > 0}
	role="button"
	tabindex="0"
	onclick={onclick}
	onkeydown={(e) => e.key === 'Enter' && onclick()}
>
	<div class="plant-image">
		<span class="plant-icon">{getCategoryIcon(plant.category)}</span>
	</div>

	<div class="plant-info">
		<h4 class="plant-name">{plant.name}</h4>
		<p class="plant-category">{plant.category}</p>

		<div class="plant-badges">
			{#if plant.isLowWater}
				<span class="badge water-badge" title="Low water needs">
					<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
						<path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z"></path>
					</svg>
				</span>
			{/if}
			{#if plant.isDeerResistant}
				<span class="badge deer-badge" title="Deer resistant">DR</span>
			{/if}
			{#if plant.isNative}
				<span class="badge native-badge" title="Native">N</span>
			{/if}
		</div>
	</div>

	{#if notRecommended}
		<div class="not-recommended-note">
			Not ideal for this zone
		</div>
	{:else if quantity > 0}
		<div class="quantity-controls" onclick={(e) => e.stopPropagation()}>
			<button type="button" class="qty-btn minus" onclick={handleDecrement} aria-label="Remove one">
				<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
					<line x1="5" y1="12" x2="19" y2="12"></line>
				</svg>
			</button>
			<span class="qty-value">{quantity}</span>
			<button type="button" class="qty-btn plus" onclick={handleIncrement} aria-label="Add one more">
				<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
					<line x1="12" y1="5" x2="12" y2="19"></line>
					<line x1="5" y1="12" x2="19" y2="12"></line>
				</svg>
			</button>
		</div>
	{:else}
		<button type="button" class="add-btn" onclick={handleAdd}>
			<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
				<line x1="12" y1="5" x2="12" y2="19"></line>
				<line x1="5" y1="12" x2="19" y2="12"></line>
			</svg>
			Add
		</button>
	{/if}
</article>

<style>
	.plant-card {
		display: flex;
		flex-direction: column;
		background: white;
		border: 1px solid #e5e7eb;
		border-radius: 8px;
		overflow: hidden;
		cursor: pointer;
		transition: border-color 0.15s, box-shadow 0.15s;
	}

	.plant-card:hover {
		border-color: #22c55e;
	}

	.plant-card:focus {
		outline: none;
		border-color: #22c55e;
		box-shadow: 0 0 0 3px rgba(34, 197, 94, 0.15);
	}

	.plant-card.has-quantity {
		border-color: #22c55e;
		background: #f0fdf4;
	}

	.plant-card.not-recommended {
		opacity: 0.6;
	}

	.plant-card.not-recommended:hover {
		border-color: #d1d5db;
	}

	.plant-image {
		height: 80px;
		background: linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%);
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.plant-icon {
		font-size: 2.5rem;
	}

	.plant-info {
		flex: 1;
		padding: 0.75rem;
		display: flex;
		flex-direction: column;
		gap: 0.125rem;
	}

	.plant-name {
		margin: 0;
		font-size: 0.9375rem;
		font-weight: 600;
		color: #1f2937;
		line-height: 1.2;
	}

	.plant-category {
		margin: 0;
		font-size: 0.75rem;
		color: #6b7280;
		text-transform: capitalize;
	}

	.plant-badges {
		display: flex;
		gap: 0.25rem;
		margin-top: 0.375rem;
	}

	.badge {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		min-width: 1.25rem;
		height: 1.25rem;
		padding: 0 0.25rem;
		font-size: 0.625rem;
		font-weight: 600;
		border-radius: 4px;
	}

	.water-badge {
		background: #dbeafe;
		color: #2563eb;
	}

	.deer-badge {
		background: #fef3c7;
		color: #d97706;
	}

	.native-badge {
		background: #dcfce7;
		color: #16a34a;
	}

	.not-recommended-note {
		padding: 0.5rem 0.75rem;
		background: #f9fafb;
		border-top: 1px solid #e5e7eb;
		font-size: 0.75rem;
		color: #9ca3af;
		text-align: center;
	}

	.add-btn {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 0.375rem;
		padding: 0.625rem;
		background: #22c55e;
		color: white;
		border: none;
		border-radius: 0 0 7px 7px;
		font-size: 0.875rem;
		font-weight: 500;
		cursor: pointer;
		transition: background-color 0.15s;
	}

	.add-btn:hover {
		background: #16a34a;
	}

	.quantity-controls {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 0;
		border-top: 1px solid #22c55e;
		background: #f0fdf4;
	}

	.qty-btn {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 36px;
		height: 36px;
		background: none;
		border: none;
		color: #16a34a;
		cursor: pointer;
		transition: background-color 0.15s;
	}

	.qty-btn:hover {
		background: #dcfce7;
	}

	.qty-btn.minus:hover {
		color: #dc2626;
	}

	.qty-value {
		min-width: 2rem;
		text-align: center;
		font-size: 1rem;
		font-weight: 600;
		color: #166534;
	}

	/* Mobile adjustments - ensure 44pt touch targets */
	@media (max-width: 640px) {
		.plant-image {
			height: 70px;
		}

		.plant-icon {
			font-size: 2rem;
		}

		.plant-name {
			font-size: 0.9375rem;
		}

		.plant-info {
			padding: 0.625rem;
		}

		/* 44px minimum for touch targets */
		.qty-btn {
			width: 48px;
			height: 48px;
		}

		.qty-btn svg {
			width: 18px;
			height: 18px;
		}

		.qty-value {
			font-size: 1.125rem;
			min-width: 2.5rem;
		}

		.add-btn {
			min-height: 44px;
			padding: 0.75rem;
			font-size: 0.9375rem;
		}

		.add-btn svg {
			width: 16px;
			height: 16px;
		}
	}

	/* Tablet (iPad) optimizations */
	@media (min-width: 641px) and (max-width: 1024px) and (hover: none) {
		.plant-image {
			height: 90px;
		}

		.plant-icon {
			font-size: 2.75rem;
		}

		.plant-name {
			font-size: 1rem;
		}

		.plant-category {
			font-size: 0.8125rem;
		}

		.plant-info {
			padding: 0.875rem;
		}

		.qty-btn {
			width: 52px;
			height: 52px;
		}

		.qty-btn svg {
			width: 20px;
			height: 20px;
		}

		.qty-value {
			font-size: 1.25rem;
			min-width: 3rem;
		}

		.add-btn {
			min-height: 48px;
			padding: 0.875rem;
			font-size: 1rem;
		}
	}

	/* High contrast for outdoor visibility */
	@media (prefers-contrast: more) {
		.plant-card {
			border-width: 2px;
			border-color: #6b7280;
		}

		.plant-card:hover,
		.plant-card:focus {
			border-color: #166534;
		}

		.plant-card.has-quantity {
			border-color: #166534;
			border-width: 3px;
		}

		.plant-name {
			color: #000;
			font-weight: 700;
		}

		.plant-category {
			color: #374151;
			font-weight: 600;
		}

		.badge {
			font-weight: 700;
		}

		.water-badge {
			background: #bfdbfe;
			color: #1d4ed8;
		}

		.deer-badge {
			background: #fde68a;
			color: #92400e;
		}

		.native-badge {
			background: #bbf7d0;
			color: #166534;
		}

		.add-btn {
			background: #166534;
			font-weight: 700;
		}

		.add-btn:hover {
			background: #15803d;
		}

		.quantity-controls {
			border-top-width: 2px;
		}

		.qty-value {
			color: #052e16;
			font-weight: 800;
		}

		.qty-btn {
			color: #166534;
		}

		.qty-btn:hover {
			background: #bbf7d0;
		}

		.qty-btn.minus:hover {
			color: #b91c1c;
			background: #fecaca;
		}
	}
</style>
