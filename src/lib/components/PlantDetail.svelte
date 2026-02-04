<script lang="ts">
	/**
	 * PlantDetail - Modal/expanded view showing full plant information.
	 * Displays description, requirements, timing, and add-to-zone controls.
	 */

	import type { PlantWithAttributes } from '$lib/plants/query';

	interface Props {
		/** Plant data to display */
		plant: PlantWithAttributes;
		/** Zone name for context */
		zoneName: string;
		/** Current quantity in the zone */
		quantity: number;
		/** Callback when quantity changes */
		onquantitychange: (quantity: number) => void;
		/** Callback to close the detail view */
		onclose: () => void;
	}

	let {
		plant,
		zoneName,
		quantity,
		onquantitychange,
		onclose
	}: Props = $props();

	let localQuantity = $state(quantity);

	function handleSave(): void {
		onquantitychange(localQuantity);
		onclose();
	}

	function handleBackdropClick(e: MouseEvent): void {
		if (e.target === e.currentTarget) {
			onclose();
		}
	}

	function handleKeydown(e: KeyboardEvent): void {
		if (e.key === 'Escape') {
			onclose();
		}
	}

	/** Get category icon/emoji */
	function getCategoryIcon(category: string): string {
		switch (category) {
			case 'vegetable': return '🥬';
			case 'herb': return '🌿';
			case 'flower': return '🌸';
			default: return '🌱';
		}
	}

	/** Format frost tolerance for display */
	function formatFrostTolerance(tolerance: string): string {
		switch (tolerance) {
			case 'tender': return 'Frost tender (plant after last frost)';
			case 'semi-hardy': return 'Semi-hardy (tolerates light frost)';
			case 'hardy': return 'Hardy (tolerates hard frost)';
			default: return tolerance;
		}
	}

	/** Get sun hours description */
	function getSunDescription(): string {
		const min = plant.light.minSunHours;
		const max = plant.light.maxSunHours;
		const idealMin = plant.light.idealMinHours ?? min;
		const idealMax = plant.light.idealMaxHours;

		if (max !== undefined) {
			return `${min}-${max} hours (ideal: ${idealMin}-${idealMax ?? max})`;
		}
		if (idealMax !== undefined) {
			return `${min}+ hours (ideal: ${idealMin}-${idealMax})`;
		}
		return `${min}+ hours`;
	}

	/** Format days to maturity */
	function getMaturityRange(): string {
		const { daysToMaturityMin, daysToMaturityMax } = plant.timing;
		if (daysToMaturityMin === daysToMaturityMax) {
			return `${daysToMaturityMin} days`;
		}
		return `${daysToMaturityMin}-${daysToMaturityMax} days`;
	}
</script>

<svelte:window on:keydown={handleKeydown} />

<div class="detail-backdrop" onclick={handleBackdropClick} role="dialog" aria-modal="true" aria-labelledby="plant-detail-title">
	<div class="detail-modal">
		<button type="button" class="close-btn" onclick={onclose} aria-label="Close">
			<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
				<line x1="18" y1="6" x2="6" y2="18"></line>
				<line x1="6" y1="6" x2="18" y2="18"></line>
			</svg>
		</button>

		<header class="detail-header">
			<div class="plant-image-large">
				<span class="plant-icon-large">{getCategoryIcon(plant.category)}</span>
			</div>
			<div class="header-info">
				<h2 id="plant-detail-title" class="plant-name">{plant.name}</h2>
				<p class="plant-category">{plant.category}</p>

				<div class="plant-tags">
					{#if plant.isEdible}
						<span class="tag edible">Edible</span>
					{/if}
					{#if plant.isLowWater}
						<span class="tag low-water">Low Water</span>
					{/if}
					{#if plant.isDeerResistant}
						<span class="tag deer-resistant">Deer Resistant</span>
					{/if}
					{#if plant.isNative}
						<span class="tag native">Native</span>
					{/if}
					{#if plant.isEvergreen}
						<span class="tag evergreen">Evergreen</span>
					{/if}
				</div>
			</div>
		</header>

		<div class="detail-content">
			<section class="description-section">
				<p class="description">{plant.description}</p>
			</section>

			<section class="requirements-section">
				<h3>Growing Requirements</h3>

				<div class="requirement-grid">
					<div class="requirement">
						<div class="req-icon sun-icon">
							<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
								<circle cx="12" cy="12" r="5"></circle>
								<line x1="12" y1="1" x2="12" y2="3"></line>
								<line x1="12" y1="21" x2="12" y2="23"></line>
								<line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line>
								<line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line>
								<line x1="1" y1="12" x2="3" y2="12"></line>
								<line x1="21" y1="12" x2="23" y2="12"></line>
								<line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line>
								<line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line>
							</svg>
						</div>
						<div class="req-details">
							<span class="req-label">Sun</span>
							<span class="req-value">{getSunDescription()}</span>
						</div>
					</div>

					<div class="requirement">
						<div class="req-icon temp-icon">
							<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
								<path d="M14 14.76V3.5a2.5 2.5 0 0 0-5 0v11.26a4.5 4.5 0 1 0 5 0z"></path>
							</svg>
						</div>
						<div class="req-details">
							<span class="req-label">Temperature</span>
							<span class="req-value">{plant.temperature.optimalMinTempF}-{plant.temperature.optimalMaxTempF}°F optimal</span>
						</div>
					</div>

					<div class="requirement">
						<div class="req-icon frost-icon">
							<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
								<line x1="2" y1="12" x2="22" y2="12"></line>
								<line x1="12" y1="2" x2="12" y2="22"></line>
								<line x1="20" y1="16" x2="4" y2="8"></line>
								<line x1="20" y1="8" x2="4" y2="16"></line>
							</svg>
						</div>
						<div class="req-details">
							<span class="req-label">Frost Tolerance</span>
							<span class="req-value">{formatFrostTolerance(plant.temperature.frostTolerance)}</span>
						</div>
					</div>

					<div class="requirement">
						<div class="req-icon time-icon">
							<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
								<circle cx="12" cy="12" r="10"></circle>
								<polyline points="12 6 12 12 16 14"></polyline>
							</svg>
						</div>
						<div class="req-details">
							<span class="req-label">Days to Maturity</span>
							<span class="req-value">{getMaturityRange()}</span>
						</div>
					</div>
				</div>
			</section>

			{#if plant.timing.canStartIndoors || plant.timing.successionPlantingWeeks}
				<section class="tips-section">
					<h3>Growing Tips</h3>
					<ul class="tips-list">
						{#if plant.timing.canStartIndoors && plant.timing.weeksToStartIndoors}
							<li>Start seeds indoors {plant.timing.weeksToStartIndoors} weeks before transplanting</li>
						{/if}
						{#if plant.timing.successionPlantingWeeks}
							<li>For continuous harvest, plant every {plant.timing.successionPlantingWeeks} weeks</li>
						{/if}
						{#if plant.light.benefitsFromAfternoonShade}
							<li>Benefits from afternoon shade in hot climates</li>
						{/if}
						{#if plant.light.toleratesAfternoonShade}
							<li>Tolerates afternoon shade without reduced yield</li>
						{/if}
					</ul>
				</section>
			{/if}
		</div>

		<footer class="detail-footer">
			<div class="quantity-input">
				<label for="quantity-input">Add to {zoneName}:</label>
				<div class="quantity-controls">
					<button
						type="button"
						class="qty-btn"
						onclick={() => (localQuantity = Math.max(0, localQuantity - 1))}
						disabled={localQuantity <= 0}
						aria-label="Decrease quantity"
					>
						−
					</button>
					<input
						type="number"
						id="quantity-input"
						bind:value={localQuantity}
						min="0"
						max="999"
					/>
					<button
						type="button"
						class="qty-btn"
						onclick={() => localQuantity++}
						aria-label="Increase quantity"
					>
						+
					</button>
				</div>
			</div>

			<div class="footer-actions">
				<button type="button" class="cancel-btn" onclick={onclose}>Cancel</button>
				<button type="button" class="save-btn" onclick={handleSave}>
					{quantity === 0 && localQuantity > 0 ? 'Add to Zone' : localQuantity === 0 ? 'Remove' : 'Update'}
				</button>
			</div>
		</footer>
	</div>
</div>

<style>
	.detail-backdrop {
		position: fixed;
		inset: 0;
		background: rgba(0, 0, 0, 0.5);
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 1rem;
		z-index: 1000;
	}

	.detail-modal {
		position: relative;
		width: 100%;
		max-width: 500px;
		max-height: 90vh;
		background: white;
		border-radius: 12px;
		overflow: hidden;
		display: flex;
		flex-direction: column;
	}

	.close-btn {
		position: absolute;
		top: 0.75rem;
		right: 0.75rem;
		width: 32px;
		height: 32px;
		display: flex;
		align-items: center;
		justify-content: center;
		background: rgba(255, 255, 255, 0.9);
		border: none;
		border-radius: 50%;
		cursor: pointer;
		color: #6b7280;
		z-index: 1;
		transition: background-color 0.15s, color 0.15s;
	}

	.close-btn:hover {
		background: #f3f4f6;
		color: #1f2937;
	}

	.detail-header {
		display: flex;
		gap: 1rem;
		padding: 1.25rem;
		background: linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%);
	}

	.plant-image-large {
		width: 80px;
		height: 80px;
		background: white;
		border-radius: 12px;
		display: flex;
		align-items: center;
		justify-content: center;
		box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
	}

	.plant-icon-large {
		font-size: 3rem;
	}

	.header-info {
		flex: 1;
		min-width: 0;
	}

	.plant-name {
		margin: 0;
		font-size: 1.5rem;
		font-weight: 700;
		color: #166534;
	}

	.plant-category {
		margin: 0.25rem 0 0.5rem;
		font-size: 0.875rem;
		color: #15803d;
		text-transform: capitalize;
	}

	.plant-tags {
		display: flex;
		flex-wrap: wrap;
		gap: 0.375rem;
	}

	.tag {
		padding: 0.125rem 0.5rem;
		font-size: 0.6875rem;
		font-weight: 500;
		border-radius: 4px;
		text-transform: uppercase;
		letter-spacing: 0.025em;
	}

	.tag.edible {
		background: #dcfce7;
		color: #166534;
	}

	.tag.low-water {
		background: #dbeafe;
		color: #1e40af;
	}

	.tag.deer-resistant {
		background: #fef3c7;
		color: #92400e;
	}

	.tag.native {
		background: #e0e7ff;
		color: #3730a3;
	}

	.tag.evergreen {
		background: #d1fae5;
		color: #065f46;
	}

	.detail-content {
		flex: 1;
		overflow-y: auto;
		padding: 1.25rem;
	}

	.description-section {
		margin-bottom: 1.25rem;
	}

	.description {
		margin: 0;
		font-size: 0.9375rem;
		line-height: 1.6;
		color: #374151;
	}

	.requirements-section h3,
	.tips-section h3 {
		margin: 0 0 0.75rem;
		font-size: 0.8125rem;
		font-weight: 600;
		color: #374151;
		text-transform: uppercase;
		letter-spacing: 0.025em;
	}

	.requirement-grid {
		display: grid;
		gap: 0.75rem;
	}

	.requirement {
		display: flex;
		gap: 0.75rem;
		align-items: flex-start;
	}

	.req-icon {
		width: 32px;
		height: 32px;
		display: flex;
		align-items: center;
		justify-content: center;
		background: #f3f4f6;
		border-radius: 6px;
		flex-shrink: 0;
	}

	.req-icon.sun-icon {
		background: #fef3c7;
		color: #d97706;
	}

	.req-icon.temp-icon {
		background: #fee2e2;
		color: #dc2626;
	}

	.req-icon.frost-icon {
		background: #dbeafe;
		color: #2563eb;
	}

	.req-icon.time-icon {
		background: #e0e7ff;
		color: #4f46e5;
	}

	.req-details {
		display: flex;
		flex-direction: column;
		gap: 0.125rem;
	}

	.req-label {
		font-size: 0.75rem;
		color: #6b7280;
		text-transform: uppercase;
		letter-spacing: 0.025em;
	}

	.req-value {
		font-size: 0.875rem;
		color: #1f2937;
	}

	.tips-section {
		margin-top: 1.25rem;
	}

	.tips-list {
		margin: 0;
		padding-left: 1.25rem;
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.tips-list li {
		font-size: 0.875rem;
		color: #374151;
	}

	.detail-footer {
		padding: 1rem 1.25rem;
		border-top: 1px solid #e5e7eb;
		background: #f9fafb;
	}

	.quantity-input {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 1rem;
		margin-bottom: 1rem;
	}

	.quantity-input label {
		font-size: 0.875rem;
		font-weight: 500;
		color: #374151;
	}

	.quantity-controls {
		display: flex;
		align-items: center;
		border: 1px solid #d1d5db;
		border-radius: 6px;
		overflow: hidden;
	}

	.qty-btn {
		width: 36px;
		height: 36px;
		display: flex;
		align-items: center;
		justify-content: center;
		background: #f9fafb;
		border: none;
		font-size: 1.25rem;
		color: #374151;
		cursor: pointer;
		transition: background-color 0.15s;
	}

	.qty-btn:hover:not(:disabled) {
		background: #e5e7eb;
	}

	.qty-btn:disabled {
		color: #d1d5db;
		cursor: not-allowed;
	}

	.quantity-controls input {
		width: 48px;
		height: 36px;
		border: none;
		border-left: 1px solid #e5e7eb;
		border-right: 1px solid #e5e7eb;
		text-align: center;
		font-size: 1rem;
		font-weight: 500;
		color: #1f2937;
	}

	.quantity-controls input::-webkit-outer-spin-button,
	.quantity-controls input::-webkit-inner-spin-button {
		-webkit-appearance: none;
		margin: 0;
	}

	.quantity-controls input[type='number'] {
		-moz-appearance: textfield;
	}

	.footer-actions {
		display: flex;
		gap: 0.75rem;
	}

	.cancel-btn,
	.save-btn {
		flex: 1;
		padding: 0.75rem 1rem;
		border-radius: 6px;
		font-size: 0.9375rem;
		font-weight: 500;
		cursor: pointer;
		transition: background-color 0.15s;
	}

	.cancel-btn {
		background: white;
		border: 1px solid #d1d5db;
		color: #374151;
	}

	.cancel-btn:hover {
		background: #f3f4f6;
	}

	.save-btn {
		background: #22c55e;
		border: none;
		color: white;
	}

	.save-btn:hover {
		background: #16a34a;
	}

	/* Mobile adjustments */
	@media (max-width: 640px) {
		.detail-backdrop {
			padding: 0;
			align-items: flex-end;
		}

		.detail-modal {
			max-width: 100%;
			max-height: 90vh;
			border-radius: 12px 12px 0 0;
		}

		.plant-name {
			font-size: 1.25rem;
		}

		.qty-btn {
			width: 44px;
			height: 44px;
		}

		.quantity-controls input {
			width: 56px;
			height: 44px;
		}
	}
</style>
