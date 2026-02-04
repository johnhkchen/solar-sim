<script lang="ts">
	import {
		type StoredPlanState,
		isPlanRecent,
		getPlanAgeDays,
		formatLastModified,
		getPlanStats
	} from '$lib/storage/plan-storage';

	interface Props {
		planState: StoredPlanState;
		oncontinue: () => void;
		onstartfresh: () => void;
	}

	const { planState, oncontinue, onstartfresh }: Props = $props();

	const isRecent = $derived(isPlanRecent(planState));
	const ageDays = $derived(getPlanAgeDays(planState));
	const lastModified = $derived(formatLastModified(planState));
	const stats = $derived(getPlanStats(planState));

	function handleKeydown(event: KeyboardEvent) {
		if (event.key === 'Escape') {
			onstartfresh();
		} else if (event.key === 'Enter') {
			oncontinue();
		}
	}
</script>

<svelte:window onkeydown={handleKeydown} />

<div class="dialog-overlay" role="presentation">
	<div class="dialog" role="dialog" aria-modal="true" aria-labelledby="dialog-title">
		<div class="dialog-icon">
			<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
				<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
				<polyline points="14 2 14 8 20 8" />
				<line x1="16" y1="13" x2="8" y2="13" />
				<line x1="16" y1="17" x2="8" y2="17" />
				<polyline points="10 9 9 9 8 9" />
			</svg>
		</div>

		<h2 id="dialog-title">Continue previous plan?</h2>

		{#if !isRecent}
			<p class="age-warning">
				This plan was last modified {ageDays} days ago ({lastModified}).
			</p>
		{:else}
			<p class="last-modified">
				Last modified {lastModified}
			</p>
		{/if}

		{#if stats.zoneCount > 0 || stats.plantCount > 0}
			<div class="plan-summary">
				{#if stats.zoneCount > 0}
					<span class="stat">{stats.zoneCount} zone{stats.zoneCount > 1 ? 's' : ''}</span>
				{/if}
				{#if stats.plantCount > 0}
					<span class="stat">{stats.plantCount} plant{stats.plantCount > 1 ? 's' : ''}</span>
				{/if}
			</div>
		{/if}

		<div class="dialog-actions">
			<button
				type="button"
				class="btn btn-primary"
				onclick={oncontinue}
			>
				Continue
			</button>
			<button
				type="button"
				class="btn btn-secondary"
				onclick={onstartfresh}
			>
				Start fresh
			</button>
		</div>
	</div>
</div>

<style>
	.dialog-overlay {
		position: fixed;
		inset: 0;
		background: rgba(0, 0, 0, 0.5);
		display: flex;
		align-items: center;
		justify-content: center;
		z-index: 9999;
		padding: 1rem;
	}

	.dialog {
		background: white;
		border-radius: 12px;
		padding: 1.5rem;
		max-width: 360px;
		width: 100%;
		text-align: center;
		box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1),
			0 10px 10px -5px rgba(0, 0, 0, 0.04);
	}

	.dialog-icon {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 56px;
		height: 56px;
		background: #eff6ff;
		border-radius: 50%;
		color: #3b82f6;
		margin-bottom: 1rem;
	}

	h2 {
		margin: 0 0 0.5rem;
		font-size: 1.25rem;
		font-weight: 600;
		color: #1f2937;
	}

	.last-modified {
		margin: 0 0 1rem;
		font-size: 0.875rem;
		color: #6b7280;
	}

	.age-warning {
		margin: 0 0 1rem;
		padding: 0.5rem 0.75rem;
		background: #fef3c7;
		border: 1px solid #fcd34d;
		border-radius: 6px;
		font-size: 0.875rem;
		color: #92400e;
	}

	.plan-summary {
		display: flex;
		justify-content: center;
		gap: 1rem;
		margin-bottom: 1.25rem;
	}

	.stat {
		display: inline-flex;
		align-items: center;
		padding: 0.375rem 0.75rem;
		background: #f3f4f6;
		border-radius: 9999px;
		font-size: 0.8125rem;
		color: #4b5563;
	}

	.dialog-actions {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.btn {
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 0.75rem 1rem;
		border-radius: 8px;
		font-size: 1rem;
		font-weight: 500;
		cursor: pointer;
		transition: background-color 0.15s, transform 0.1s;
		border: none;
		min-height: 48px;
	}

	.btn:active {
		transform: scale(0.98);
	}

	.btn-primary {
		background: #22c55e;
		color: white;
	}

	.btn-primary:hover {
		background: #16a34a;
	}

	.btn-secondary {
		background: #f3f4f6;
		color: #374151;
	}

	.btn-secondary:hover {
		background: #e5e7eb;
	}

	/* Mobile optimizations */
	@media (max-width: 768px) {
		.dialog {
			padding: 1.25rem;
		}

		h2 {
			font-size: 1.125rem;
		}
	}

	/* iPad/tablet touch optimizations */
	@media (min-width: 768px) and (max-width: 1024px) and (hover: none) {
		.btn {
			min-height: 52px;
			font-size: 1.0625rem;
		}
	}
</style>
