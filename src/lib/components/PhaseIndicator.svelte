<script lang="ts">
	/**
	 * PhaseIndicator - Horizontal stepper showing the four plan generation phases.
	 * Displays current progress and allows clicking to navigate between phases.
	 */

	export type Phase = 'site' | 'analysis' | 'plants' | 'plan';

	interface PhaseConfig {
		id: Phase;
		label: string;
		shortLabel: string;
	}

	const PHASES: PhaseConfig[] = [
		{ id: 'site', label: 'Site Setup', shortLabel: 'Site' },
		{ id: 'analysis', label: 'Sun Analysis', shortLabel: 'Analysis' },
		{ id: 'plants', label: 'Plant Selection', shortLabel: 'Plants' },
		{ id: 'plan', label: 'Your Plan', shortLabel: 'Plan' }
	];

	interface Props {
		currentPhase: Phase;
		completedPhases?: Phase[];
		onPhaseClick?: (phase: Phase) => void;
		/** Map of phase ID to whether it can be navigated to. Prefer this over canNavigate function for reactivity. */
		navigablePhases?: Record<Phase, boolean>;
		/** @deprecated Use navigablePhases instead for proper reactivity */
		canNavigate?: (phase: Phase) => boolean;
	}

	let { currentPhase, completedPhases = [], onPhaseClick, navigablePhases, canNavigate }: Props = $props();

	const currentIndex = $derived(PHASES.findIndex((p) => p.id === currentPhase));

	// Derive clickability for each phase to ensure reactivity
	const phaseStates = $derived(
		PHASES.map((phase) => {
			const phaseIndex = PHASES.findIndex((p) => p.id === phase.id);
			const completed = completedPhases.includes(phase.id) || phaseIndex < currentIndex;
			const current = phase.id === currentPhase;
			const past = phaseIndex < currentIndex;

			let clickable = false;
			if (onPhaseClick) {
				if (navigablePhases) {
					clickable = navigablePhases[phase.id] ?? false;
				} else if (canNavigate) {
					clickable = canNavigate(phase.id);
				} else {
					clickable = completed || past || current;
				}
			}

			return { ...phase, completed, current, past, clickable };
		})
	);

	function handleClick(phase: Phase) {
		const state = phaseStates.find((p) => p.id === phase);
		if (state?.clickable && onPhaseClick) {
			onPhaseClick(phase);
		}
	}

	function handleKeydown(event: KeyboardEvent, phase: Phase) {
		const state = phaseStates.find((p) => p.id === phase);
		if ((event.key === 'Enter' || event.key === ' ') && state?.clickable) {
			event.preventDefault();
			handleClick(phase);
		}
	}
</script>

<nav class="phase-indicator" aria-label="Plan creation progress">
	<ol class="phase-list">
		{#each phaseStates as phase, index (phase.id)}
			<li
				class="phase-item"
				class:completed={phase.completed}
				class:current={phase.current}
				class:clickable={phase.clickable}
				aria-current={phase.current ? 'step' : undefined}
			>
				{#if index > 0}
					<div class="connector" class:completed={phase.past}></div>
				{/if}
				<button
					type="button"
					class="phase-button"
					onclick={() => handleClick(phase.id)}
					onkeydown={(e) => handleKeydown(e, phase.id)}
					disabled={!phase.clickable}
					aria-label="{phase.label}{phase.completed ? ' (completed)' : ''}{phase.current ? ' (current)' : ''}"
				>
					<span class="phase-circle">
						{#if phase.completed && !phase.current}
							<svg
								xmlns="http://www.w3.org/2000/svg"
								width="14"
								height="14"
								viewBox="0 0 24 24"
								fill="none"
								stroke="currentColor"
								stroke-width="3"
								aria-hidden="true"
							>
								<polyline points="20 6 9 17 4 12"></polyline>
							</svg>
						{:else}
							<span class="phase-number">{index + 1}</span>
						{/if}
					</span>
					<span class="phase-label">
						<span class="label-full">{phase.label}</span>
						<span class="label-short">{phase.shortLabel}</span>
					</span>
				</button>
			</li>
		{/each}
	</ol>
</nav>

<style>
	.phase-indicator {
		width: 100%;
		padding: 0.75rem 1rem;
		background: white;
		border-bottom: 1px solid #e5e7eb;
	}

	.phase-list {
		display: flex;
		list-style: none;
		margin: 0;
		padding: 0;
		justify-content: space-between;
		align-items: center;
		max-width: 600px;
		margin: 0 auto;
	}

	.phase-item {
		display: flex;
		align-items: center;
		flex: 1;
		position: relative;
	}

	.phase-item:first-child {
		flex: 0;
	}

	.connector {
		flex: 1;
		height: 2px;
		background: #d1d5db;
		margin: 0 0.5rem;
		transition: background-color 0.2s;
	}

	.connector.completed {
		background: #22c55e;
	}

	.phase-button {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.375rem;
		background: none;
		border: none;
		padding: 0.25rem;
		cursor: default;
		font: inherit;
		color: inherit;
	}

	.clickable .phase-button {
		cursor: pointer;
	}

	.clickable .phase-button:hover .phase-circle {
		transform: scale(1.1);
	}

	.clickable .phase-button:focus-visible {
		outline: 2px solid #3b82f6;
		outline-offset: 2px;
		border-radius: 4px;
	}

	.phase-circle {
		width: 28px;
		height: 28px;
		border-radius: 50%;
		display: flex;
		align-items: center;
		justify-content: center;
		font-size: 0.75rem;
		font-weight: 600;
		transition:
			background-color 0.2s,
			border-color 0.2s,
			transform 0.15s;
		background: #f3f4f6;
		border: 2px solid #d1d5db;
		color: #6b7280;
	}

	.completed .phase-circle {
		background: #22c55e;
		border-color: #22c55e;
		color: white;
	}

	.current .phase-circle {
		background: #3b82f6;
		border-color: #3b82f6;
		color: white;
	}

	.phase-number {
		line-height: 1;
	}

	.phase-label {
		font-size: 0.6875rem;
		font-weight: 500;
		text-align: center;
		color: #6b7280;
		transition: color 0.2s;
		white-space: nowrap;
	}

	.current .phase-label {
		color: #3b82f6;
		font-weight: 600;
	}

	.completed .phase-label {
		color: #22c55e;
	}

	.label-short {
		display: none;
	}

	/* Mobile: show short labels with larger touch targets */
	@media (max-width: 480px) {
		.phase-indicator {
			padding: 0.5rem 0.75rem;
		}

		.phase-button {
			/* Ensure 44pt minimum touch target */
			min-width: 44px;
			min-height: 44px;
			padding: 4px;
		}

		.phase-circle {
			width: 32px;
			height: 32px;
			font-size: 0.8125rem;
		}

		.label-full {
			display: none;
		}

		.label-short {
			display: block;
		}

		.connector {
			margin: 0 0.25rem;
		}
	}

	/* Tablet (iPad) optimizations */
	@media (min-width: 481px) and (max-width: 1024px) and (hover: none) {
		.phase-indicator {
			padding: 0.875rem 1rem;
		}

		.phase-button {
			min-width: 48px;
			min-height: 48px;
			padding: 6px;
		}

		.phase-circle {
			width: 36px;
			height: 36px;
			font-size: 0.9375rem;
		}

		.phase-circle svg {
			width: 18px;
			height: 18px;
		}

		.phase-label {
			font-size: 0.75rem;
		}
	}

	/* High contrast for outdoor visibility */
	@media (prefers-contrast: more) {
		.phase-indicator {
			border-bottom: 2px solid #000;
		}

		.phase-circle {
			border-width: 3px;
		}

		.completed .phase-circle {
			background: #166534;
			border-color: #166534;
		}

		.current .phase-circle {
			background: #1d4ed8;
			border-color: #1d4ed8;
		}

		.phase-label {
			color: #000;
			font-weight: 600;
		}

		.current .phase-label {
			color: #1d4ed8;
			font-weight: 700;
		}

		.completed .phase-label {
			color: #166534;
		}

		.connector {
			height: 3px;
		}
	}
</style>
