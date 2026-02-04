<script lang="ts">
	/**
	 * PhasePanel - Container for phase-specific content with navigation controls.
	 * Renders as a sidebar on desktop and a bottom sheet on mobile.
	 */
	import type { Snippet } from 'svelte';
	import type { Phase } from './PhaseIndicator.svelte';

	interface Props {
		currentPhase: Phase;
		canGoNext?: boolean;
		canGoBack?: boolean;
		nextLabel?: string;
		onNext?: () => void;
		onBack?: () => void;
		children: Snippet;
		header?: Snippet;
	}

	let {
		currentPhase,
		canGoNext = true,
		canGoBack = true,
		nextLabel = 'Next',
		onNext,
		onBack,
		children,
		header
	}: Props = $props();

	const phaseLabels: Record<Phase, string> = {
		site: 'Site Setup',
		analysis: 'Sun Analysis',
		plants: 'Plant Selection',
		plan: 'Your Plan'
	};

	const isFirstPhase = $derived(currentPhase === 'site');
	const isLastPhase = $derived(currentPhase === 'plan');

	function handleKeydown(event: KeyboardEvent) {
		// Arrow key navigation (desktop only)
		if (event.key === 'ArrowRight' && canGoNext && onNext && !isLastPhase) {
			event.preventDefault();
			onNext();
		} else if (event.key === 'ArrowLeft' && canGoBack && onBack && !isFirstPhase) {
			event.preventDefault();
			onBack();
		}
	}
</script>

<svelte:window onkeydown={handleKeydown} />

<aside class="phase-panel" aria-label="Phase content">
	<div class="panel-header">
		{#if header}
			{@render header()}
		{:else}
			<h2 class="phase-title">{phaseLabels[currentPhase]}</h2>
		{/if}
	</div>

	<div class="panel-content">
		{@render children()}
	</div>

	<div class="panel-footer">
		<div class="nav-buttons">
			{#if !isFirstPhase && onBack}
				<button
					type="button"
					class="nav-button back-button"
					onclick={onBack}
					disabled={!canGoBack}
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
						<polyline points="15 18 9 12 15 6"></polyline>
					</svg>
					Back
				</button>
			{:else}
				<div class="nav-spacer"></div>
			{/if}

			{#if !isLastPhase && onNext}
				<button
					type="button"
					class="nav-button next-button"
					onclick={onNext}
					disabled={!canGoNext}
				>
					{nextLabel}
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
						<polyline points="9 18 15 12 9 6"></polyline>
					</svg>
				</button>
			{:else if isLastPhase}
				<div class="nav-spacer"></div>
			{/if}
		</div>
	</div>
</aside>

<style>
	.phase-panel {
		display: flex;
		flex-direction: column;
		height: 100%;
		background: white;
		overflow: hidden;
	}

	.panel-header {
		flex-shrink: 0;
		padding: 1rem 1.25rem;
		border-bottom: 1px solid #e5e7eb;
		background: #fafafa;
	}

	.phase-title {
		margin: 0;
		font-size: 1.125rem;
		font-weight: 600;
		color: #1f2937;
	}

	.panel-content {
		flex: 1;
		overflow-y: auto;
		padding: 1.25rem;
	}

	.panel-footer {
		flex-shrink: 0;
		padding: 0.75rem 1.25rem;
		border-top: 1px solid #e5e7eb;
		background: #fafafa;
	}

	.nav-buttons {
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: 1rem;
	}

	.nav-spacer {
		flex: 1;
	}

	.nav-button {
		display: inline-flex;
		align-items: center;
		gap: 0.375rem;
		padding: 0.625rem 1rem;
		font-size: 0.875rem;
		font-weight: 500;
		border-radius: 6px;
		cursor: pointer;
		transition:
			background-color 0.15s,
			border-color 0.15s,
			opacity 0.15s;
	}

	.nav-button:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.back-button {
		background: white;
		border: 1px solid #d1d5db;
		color: #374151;
	}

	.back-button:hover:not(:disabled) {
		background: #f3f4f6;
		border-color: #9ca3af;
	}

	.next-button {
		background: #3b82f6;
		border: 1px solid #3b82f6;
		color: white;
		margin-left: auto;
	}

	.next-button:hover:not(:disabled) {
		background: #2563eb;
		border-color: #2563eb;
	}

	.next-button:focus-visible,
	.back-button:focus-visible {
		outline: 2px solid #3b82f6;
		outline-offset: 2px;
	}

	/* Mobile adjustments - ensure 44pt touch targets */
	@media (max-width: 768px) {
		.panel-header {
			padding: 0.75rem 1rem;
		}

		.panel-content {
			padding: 1rem;
		}

		.panel-footer {
			padding: 0.75rem 1rem;
			/* Add safe area padding for devices with home indicators */
			padding-bottom: max(0.75rem, env(safe-area-inset-bottom, 0.75rem));
		}

		.nav-button {
			padding: 0.875rem 1.5rem;
			/* Ensure 44pt minimum touch target */
			min-height: 48px;
			font-size: 0.9375rem;
		}

		.nav-button svg {
			width: 18px;
			height: 18px;
		}
	}

	/* Tablet (iPad) optimizations */
	@media (min-width: 769px) and (max-width: 1024px) and (hover: none) {
		.panel-header {
			padding: 1rem 1.25rem;
		}

		.phase-title {
			font-size: 1.25rem;
		}

		.panel-content {
			padding: 1.5rem;
		}

		.panel-footer {
			padding: 1rem 1.25rem;
		}

		.nav-button {
			padding: 1rem 1.75rem;
			min-height: 52px;
			font-size: 1rem;
			border-radius: 8px;
		}

		.nav-button svg {
			width: 20px;
			height: 20px;
		}
	}

	/* High contrast for outdoor visibility */
	@media (prefers-contrast: more) {
		.phase-panel {
			border: 2px solid #000;
		}

		.panel-header {
			background: #e5e7eb;
			border-bottom-width: 2px;
		}

		.phase-title {
			color: #000;
			font-weight: 700;
		}

		.panel-footer {
			background: #e5e7eb;
			border-top-width: 2px;
		}

		.back-button {
			border-width: 2px;
			border-color: #4b5563;
			color: #000;
			font-weight: 600;
		}

		.back-button:hover:not(:disabled) {
			background: #d1d5db;
			border-color: #374151;
		}

		.next-button {
			background: #1d4ed8;
			border-color: #1d4ed8;
			font-weight: 700;
		}

		.next-button:hover:not(:disabled) {
			background: #1e40af;
			border-color: #1e40af;
		}

		.nav-button:disabled {
			opacity: 0.6;
		}
	}
</style>
