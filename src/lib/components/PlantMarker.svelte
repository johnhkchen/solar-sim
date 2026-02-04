<script lang="ts" module>
	/**
	 * Plant marker colors by category.
	 */
	export const PLANT_COLORS: Record<string, string> = {
		vegetable: '#22c55e', // green
		herb: '#8b5cf6', // purple
		flower: '#f472b6' // pink
	};

	/**
	 * Generates a plant code from the plant name (first 2-3 letters).
	 */
	export function generatePlantCode(name: string): string {
		const words = name.split(/\s+/);
		if (words.length === 1) {
			return name.slice(0, 2).toUpperCase();
		}
		// For multi-word names, take first letter of each word
		return words
			.map((w) => w[0])
			.join('')
			.slice(0, 3)
			.toUpperCase();
	}

	/**
	 * Spacing validation status.
	 */
	export type SpacingStatus = 'valid' | 'warning' | 'error';

	/**
	 * Calculates spacing status based on overlap percentage.
	 */
	export function getSpacingStatus(overlapPercent: number): SpacingStatus {
		if (overlapPercent <= 20) return 'valid';
		if (overlapPercent <= 50) return 'warning';
		return 'error';
	}
</script>

<script lang="ts">
	import type { Plant } from '$lib/plants';

	interface Props {
		/** The plant being rendered */
		plant: Plant;
		/** X position in pixels */
		x: number;
		/** Y position in pixels */
		y: number;
		/** Diameter in pixels (based on mature spread at scale) */
		diameter: number;
		/** Quantity if multiple at same position */
		quantity?: number;
		/** Spacing validation status */
		spacingStatus?: SpacingStatus;
		/** Whether the plant is selected */
		selected?: boolean;
		/** Whether the plant is being dragged */
		dragging?: boolean;
		/** Callback when plant is clicked */
		onclick?: (e: MouseEvent) => void;
		/** Callback when drag starts */
		ondragstart?: (e: MouseEvent) => void;
	}

	let {
		plant,
		x,
		y,
		diameter,
		quantity = 1,
		spacingStatus = 'valid',
		selected = false,
		dragging = false,
		onclick,
		ondragstart
	}: Props = $props();

	const code = $derived(generatePlantCode(plant.name));
	const color = $derived(PLANT_COLORS[plant.category] ?? '#6b7280');
	const radius = $derived(diameter / 2);

	// Status ring colors
	const statusColors = {
		valid: 'transparent',
		warning: '#facc15', // yellow
		error: '#ef4444' // red
	};

	const statusRingColor = $derived(statusColors[spacingStatus]);
	const showStatusRing = $derived(spacingStatus !== 'valid');

	function handleMouseDown(e: MouseEvent) {
		e.preventDefault();
		e.stopPropagation();
		ondragstart?.(e);
	}

	function handleClick(e: MouseEvent) {
		e.stopPropagation();
		onclick?.(e);
	}
</script>

<g
	class="plant-marker"
	class:selected
	class:dragging
	transform="translate({x}, {y})"
	role="button"
	tabindex="0"
	aria-label="{plant.name} ({quantity})"
	onclick={handleClick}
	onmousedown={handleMouseDown}
	onkeydown={(e) => e.key === 'Enter' && onclick?.(new MouseEvent('click'))}
>
	<!-- Status ring for spacing warnings -->
	{#if showStatusRing}
		<circle
			r={radius + 4}
			fill="none"
			stroke={statusRingColor}
			stroke-width="3"
			stroke-dasharray={spacingStatus === 'warning' ? '4,4' : undefined}
			class="status-ring"
		/>
	{/if}

	<!-- Selection ring -->
	{#if selected}
		<circle r={radius + 2} fill="none" stroke="#0066cc" stroke-width="2" class="selection-ring" />
	{/if}

	<!-- Main plant circle -->
	<circle r={radius} fill={color} fill-opacity="0.7" stroke={color} stroke-width="1.5" />

	<!-- Plant code label -->
	<text
		x="0"
		y="0"
		text-anchor="middle"
		dominant-baseline="central"
		fill="white"
		font-size={Math.max(10, Math.min(14, diameter * 0.4))}
		font-weight="600"
		class="plant-code"
	>
		{code}
	</text>

	<!-- Quantity badge -->
	{#if quantity > 1}
		<g transform="translate({radius * 0.7}, {-radius * 0.7})">
			<circle r="10" fill="white" stroke={color} stroke-width="1.5" />
			<text
				x="0"
				y="0"
				text-anchor="middle"
				dominant-baseline="central"
				fill={color}
				font-size="10"
				font-weight="700"
			>
				{quantity}
			</text>
		</g>
	{/if}
</g>

<style>
	.plant-marker {
		cursor: move;
		outline: none;
	}

	.plant-marker:hover circle:not(.status-ring):not(.selection-ring) {
		fill-opacity: 0.85;
	}

	.plant-marker.selected {
		cursor: grab;
	}

	.plant-marker.dragging {
		cursor: grabbing;
		opacity: 0.8;
	}

	.plant-code {
		pointer-events: none;
		user-select: none;
	}

	.status-ring {
		animation: pulse 1.5s ease-in-out infinite;
	}

	@keyframes pulse {
		0%,
		100% {
			opacity: 1;
		}
		50% {
			opacity: 0.5;
		}
	}
</style>
