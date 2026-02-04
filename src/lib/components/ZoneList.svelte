<script lang="ts">
	/**
	 * ZoneList - Panel component showing all planting zones.
	 * Displays zone properties and allows selection, renaming, and deletion.
	 */

	import {
		type Zone,
		LIGHT_COLORS,
		calculateZoneArea,
		formatArea
	} from './ZoneEditor.svelte';

	interface Props {
		zones: Zone[];
		selectedZoneId: string | null;
		onselect: (zoneId: string | null) => void;
		ondelete: (zoneId: string) => void;
		onrename: (zoneId: string, newName: string) => void;
		onaddzone: () => void;
		drawingMode: boolean;
	}

	let {
		zones,
		selectedZoneId,
		onselect,
		ondelete,
		onrename,
		onaddzone,
		drawingMode
	}: Props = $props();

	let editingZoneId = $state<string | null>(null);
	let editingName = $state('');

	function startEditing(zone: Zone): void {
		editingZoneId = zone.id;
		editingName = zone.name;
	}

	function cancelEditing(): void {
		editingZoneId = null;
		editingName = '';
	}

	function saveEditing(): void {
		if (editingZoneId && editingName.trim()) {
			onrename(editingZoneId, editingName.trim());
		}
		cancelEditing();
	}

	function handleKeydown(e: KeyboardEvent): void {
		if (e.key === 'Enter') {
			saveEditing();
		} else if (e.key === 'Escape') {
			cancelEditing();
		}
	}

	function formatLightCategory(category: Zone['lightCategory']): string {
		switch (category) {
			case 'full-sun':
				return 'Full Sun';
			case 'part-sun':
				return 'Part Sun';
			case 'part-shade':
				return 'Part Shade';
			case 'full-shade':
				return 'Full Shade';
		}
	}
</script>

<div class="zone-list">
	<div class="zone-header">
		<h3>Planting Zones</h3>
		<button
			type="button"
			class="add-zone-btn"
			class:active={drawingMode}
			onclick={onaddzone}
			title={drawingMode ? 'Cancel zone drawing' : 'Draw a new zone'}
		>
			{#if drawingMode}
				<svg
					xmlns="http://www.w3.org/2000/svg"
					width="16"
					height="16"
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					stroke-width="2"
					aria-hidden="true"
				>
					<line x1="18" y1="6" x2="6" y2="18"></line>
					<line x1="6" y1="6" x2="18" y2="18"></line>
				</svg>
				Cancel
			{:else}
				<svg
					xmlns="http://www.w3.org/2000/svg"
					width="16"
					height="16"
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					stroke-width="2"
					aria-hidden="true"
				>
					<line x1="12" y1="5" x2="12" y2="19"></line>
					<line x1="5" y1="12" x2="19" y2="12"></line>
				</svg>
				Add Zone
			{/if}
		</button>
	</div>

	{#if drawingMode}
		<div class="drawing-hint">
			<svg
				xmlns="http://www.w3.org/2000/svg"
				width="16"
				height="16"
				viewBox="0 0 24 24"
				fill="none"
				stroke="currentColor"
				stroke-width="2"
				aria-hidden="true"
			>
				<rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
			</svg>
			<span>Click and drag on the map to draw a rectangular zone</span>
		</div>
	{/if}

	{#if zones.length === 0}
		<div class="empty-state">
			{#if drawingMode}
				<p>Draw your first zone on the map</p>
			{:else}
				<p>No zones defined yet. Click "Add Zone" to draw planting areas on the map.</p>
			{/if}
		</div>
	{:else}
		<ul class="zones">
			{#each zones as zone (zone.id)}
				{@const isSelected = zone.id === selectedZoneId}
				{@const isEditing = zone.id === editingZoneId}
				{@const area = calculateZoneArea(zone.bounds)}
				<li
					class="zone-item"
					class:selected={isSelected}
					style="--zone-color: {LIGHT_COLORS[zone.lightCategory]}"
				>
					<button
						type="button"
						class="zone-content"
						onclick={() => onselect(isSelected ? null : zone.id)}
						aria-selected={isSelected}
					>
						<div class="zone-color-bar" aria-hidden="true"></div>
						<div class="zone-info">
							{#if isEditing}
								<input
									type="text"
									class="zone-name-input"
									bind:value={editingName}
									onkeydown={handleKeydown}
									onblur={saveEditing}
									autofocus
									onclick={(e) => e.stopPropagation()}
								/>
							{:else}
								<span class="zone-name">{zone.name}</span>
							{/if}
							<span class="zone-light">
								{formatLightCategory(zone.lightCategory)} · {zone.avgSunHours.toFixed(1)} hrs
							</span>
							<span class="zone-area">{formatArea(area)}</span>
						</div>
					</button>
					<div class="zone-actions">
						{#if !isEditing}
							<button
								type="button"
								class="action-btn edit-btn"
								onclick={(e) => {
									e.stopPropagation();
									startEditing(zone);
								}}
								title="Rename zone"
							>
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
									<path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
									<path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
								</svg>
							</button>
						{/if}
						<button
							type="button"
							class="action-btn delete-btn"
							onclick={(e) => {
								e.stopPropagation();
								ondelete(zone.id);
							}}
							title="Delete zone"
						>
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
								<polyline points="3 6 5 6 21 6"></polyline>
								<path
									d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"
								></path>
							</svg>
						</button>
					</div>
				</li>
			{/each}
		</ul>
	{/if}
</div>

<style>
	.zone-list {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}

	.zone-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.5rem;
	}

	.zone-header h3 {
		margin: 0;
		font-size: 0.875rem;
		font-weight: 600;
		color: #374151;
		text-transform: uppercase;
		letter-spacing: 0.025em;
	}

	.add-zone-btn {
		display: flex;
		align-items: center;
		gap: 0.375rem;
		padding: 0.375rem 0.625rem;
		background: #22c55e;
		color: white;
		border: none;
		border-radius: 4px;
		font-size: 0.8125rem;
		font-weight: 500;
		cursor: pointer;
		transition: background-color 0.15s;
	}

	.add-zone-btn:hover {
		background: #16a34a;
	}

	.add-zone-btn.active {
		background: #6b7280;
	}

	.add-zone-btn.active:hover {
		background: #4b5563;
	}

	.drawing-hint {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.625rem 0.75rem;
		background: #fef3c7;
		border: 1px solid #fde047;
		border-radius: 6px;
		font-size: 0.8125rem;
		color: #92400e;
	}

	.empty-state {
		padding: 1rem;
		background: #f9fafb;
		border: 1px dashed #d1d5db;
		border-radius: 6px;
		text-align: center;
	}

	.empty-state p {
		margin: 0;
		font-size: 0.875rem;
		color: #6b7280;
	}

	.zones {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.zone-item {
		display: flex;
		align-items: stretch;
		background: white;
		border: 1px solid #e5e7eb;
		border-radius: 6px;
		overflow: hidden;
		transition: border-color 0.15s, box-shadow 0.15s;
	}

	.zone-item:hover {
		border-color: var(--zone-color);
	}

	.zone-item.selected {
		border-color: var(--zone-color);
		box-shadow: 0 0 0 2px color-mix(in srgb, var(--zone-color) 25%, transparent);
	}

	.zone-content {
		flex: 1;
		display: flex;
		align-items: stretch;
		background: none;
		border: none;
		padding: 0;
		text-align: left;
		cursor: pointer;
		font: inherit;
	}

	.zone-color-bar {
		width: 4px;
		background: var(--zone-color);
	}

	.zone-info {
		flex: 1;
		display: flex;
		flex-direction: column;
		gap: 0.125rem;
		padding: 0.5rem 0.75rem;
	}

	.zone-name {
		font-weight: 600;
		font-size: 0.9375rem;
		color: #1f2937;
	}

	.zone-name-input {
		font: inherit;
		font-weight: 600;
		font-size: 0.9375rem;
		color: #1f2937;
		border: 1px solid var(--zone-color);
		border-radius: 3px;
		padding: 0.125rem 0.25rem;
		margin: -0.125rem -0.25rem;
		outline: none;
	}

	.zone-light {
		font-size: 0.8125rem;
		color: var(--zone-color);
		font-weight: 500;
	}

	.zone-area {
		font-size: 0.75rem;
		color: #6b7280;
	}

	.zone-actions {
		display: flex;
		flex-direction: column;
		border-left: 1px solid #e5e7eb;
	}

	.action-btn {
		flex: 1;
		display: flex;
		align-items: center;
		justify-content: center;
		width: 36px;
		background: none;
		border: none;
		cursor: pointer;
		color: #6b7280;
		transition: background-color 0.15s, color 0.15s;
	}

	.action-btn:hover {
		background: #f3f4f6;
	}

	.edit-btn:hover {
		color: #3b82f6;
	}

	.delete-btn {
		border-top: 1px solid #e5e7eb;
	}

	.delete-btn:hover {
		color: #dc2626;
		background: #fef2f2;
	}

	/* Mobile adjustments - ensure 44pt touch targets */
	@media (max-width: 640px) {
		.zone-header h3 {
			font-size: 0.8125rem;
		}

		.add-zone-btn {
			/* Minimum 44px height for touch targets */
			min-height: 44px;
			padding: 0.625rem 0.875rem;
			font-size: 0.9375rem;
		}

		.zone-content {
			/* Minimum 44px height for touch targets */
			min-height: 44px;
		}

		.zone-info {
			padding: 0.75rem 0.875rem;
		}

		.zone-name {
			font-size: 1rem;
		}

		.zone-light {
			font-size: 0.875rem;
		}

		.zone-area {
			font-size: 0.8125rem;
		}

		.action-btn {
			/* 44px minimum touch target */
			width: 48px;
			min-height: 44px;
		}

		.action-btn svg {
			width: 18px;
			height: 18px;
		}

		.drawing-hint {
			padding: 0.75rem 1rem;
			font-size: 0.875rem;
		}
	}

	/* Tablet (iPad) optimizations */
	@media (min-width: 641px) and (max-width: 1024px) and (hover: none) {
		.add-zone-btn {
			min-height: 48px;
			padding: 0.75rem 1rem;
			font-size: 1rem;
		}

		.zone-content {
			min-height: 52px;
		}

		.zone-info {
			padding: 0.875rem 1rem;
		}

		.zone-name {
			font-size: 1.0625rem;
		}

		.zone-light {
			font-size: 0.9375rem;
		}

		.action-btn {
			width: 52px;
			min-height: 48px;
		}

		.action-btn svg {
			width: 20px;
			height: 20px;
		}
	}

	/* High contrast for outdoor visibility */
	@media (prefers-contrast: more) {
		.zone-header h3 {
			color: #000;
			font-weight: 700;
		}

		.add-zone-btn {
			background: #166534;
			font-weight: 700;
		}

		.add-zone-btn:hover {
			background: #15803d;
		}

		.add-zone-btn.active {
			background: #374151;
		}

		.zone-item {
			border-width: 2px;
		}

		.zone-item.selected {
			box-shadow: 0 0 0 3px color-mix(in srgb, var(--zone-color) 35%, transparent);
		}

		.zone-name {
			color: #000;
			font-weight: 700;
		}

		.zone-light {
			font-weight: 700;
		}

		.zone-area {
			color: #374151;
			font-weight: 600;
		}

		.zone-color-bar {
			width: 6px;
		}

		.drawing-hint {
			border-width: 2px;
			color: #78350f;
			font-weight: 600;
		}

		.empty-state {
			border-width: 2px;
		}

		.empty-state p {
			color: #374151;
			font-weight: 500;
		}
	}
</style>
