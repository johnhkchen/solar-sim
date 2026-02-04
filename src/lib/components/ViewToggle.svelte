<script lang="ts">
	import type { ViewMode } from './PlanCanvas.svelte';

	interface Props {
		/** Current view mode */
		mode: ViewMode;
		/** Callback when mode changes */
		onchange?: (mode: ViewMode) => void;
	}

	let { mode = $bindable('map'), onchange }: Props = $props();

	function setMode(newMode: ViewMode) {
		if (newMode !== mode) {
			mode = newMode;
			onchange?.(newMode);
		}
	}
</script>

<div class="view-toggle" role="tablist" aria-label="View mode">
	<button
		type="button"
		role="tab"
		class="toggle-button"
		class:active={mode === 'map'}
		aria-selected={mode === 'map'}
		onclick={() => setMode('map')}
	>
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
			<polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6" />
			<line x1="8" y1="2" x2="8" y2="18" />
			<line x1="16" y1="6" x2="16" y2="22" />
		</svg>
		<span>Map</span>
	</button>
	<button
		type="button"
		role="tab"
		class="toggle-button"
		class:active={mode === 'plan'}
		aria-selected={mode === 'plan'}
		onclick={() => setMode('plan')}
	>
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
			<rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
			<line x1="3" y1="9" x2="21" y2="9" />
			<line x1="9" y1="21" x2="9" y2="9" />
		</svg>
		<span>Plan</span>
	</button>
</div>

<style>
	.view-toggle {
		display: inline-flex;
		background: #f1f5f9;
		border-radius: 8px;
		padding: 4px;
		gap: 4px;
	}

	.toggle-button {
		display: flex;
		align-items: center;
		gap: 6px;
		padding: 8px 12px;
		background: transparent;
		border: none;
		border-radius: 6px;
		font-size: 0.875rem;
		font-weight: 500;
		color: #64748b;
		cursor: pointer;
		transition: all 0.15s;
	}

	.toggle-button:hover:not(.active) {
		color: #334155;
		background: #e2e8f0;
	}

	.toggle-button.active {
		background: white;
		color: #0f172a;
		box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
	}

	.toggle-button svg {
		flex-shrink: 0;
	}

	/* Mobile: icons only with 44pt touch targets */
	@media (max-width: 480px) {
		.toggle-button span {
			display: none;
		}

		.toggle-button {
			/* 44px minimum touch target */
			min-width: 44px;
			min-height: 44px;
			padding: 12px;
		}

		.toggle-button svg {
			width: 20px;
			height: 20px;
		}

		.view-toggle {
			padding: 6px;
			gap: 6px;
		}
	}

	/* Tablet (iPad) optimizations */
	@media (min-width: 481px) and (max-width: 1024px) and (hover: none) {
		.toggle-button {
			min-height: 48px;
			padding: 12px 16px;
			font-size: 0.9375rem;
			gap: 8px;
		}

		.toggle-button svg {
			width: 18px;
			height: 18px;
		}

		.view-toggle {
			padding: 5px;
			gap: 5px;
			border-radius: 10px;
		}
	}

	/* High contrast for outdoor visibility */
	@media (prefers-contrast: more) {
		.view-toggle {
			background: #cbd5e1;
			border: 2px solid #64748b;
		}

		.toggle-button {
			color: #1e293b;
			font-weight: 600;
		}

		.toggle-button:hover:not(.active) {
			background: #94a3b8;
			color: #0f172a;
		}

		.toggle-button.active {
			background: white;
			color: #0f172a;
			font-weight: 700;
			box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
		}
	}
</style>
