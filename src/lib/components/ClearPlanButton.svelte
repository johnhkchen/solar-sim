<script lang="ts">
	interface Props {
		onclear: () => void;
		disabled?: boolean;
	}

	const { onclear, disabled = false }: Props = $props();

	let showConfirm = $state(false);

	function handleClear() {
		showConfirm = true;
	}

	function confirmClear() {
		showConfirm = false;
		onclear();
	}

	function cancelClear() {
		showConfirm = false;
	}

	function handleKeydown(event: KeyboardEvent) {
		if (!showConfirm) return;
		if (event.key === 'Escape') {
			cancelClear();
		}
	}
</script>

<svelte:window onkeydown={handleKeydown} />

<button
	type="button"
	class="clear-btn"
	onclick={handleClear}
	{disabled}
	aria-label="Clear plan and start fresh"
>
	<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
		<polyline points="3 6 5 6 21 6" />
		<path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
	</svg>
	Clear plan
</button>

{#if showConfirm}
	<div class="confirm-overlay" role="presentation" onclick={cancelClear}>
		<div class="confirm-dialog" role="alertdialog" aria-modal="true" aria-labelledby="confirm-title" onclick={(e) => e.stopPropagation()}>
			<h3 id="confirm-title">Clear plan?</h3>
			<p>This will remove all zones and plant selections. Trees and location data will be preserved.</p>
			<div class="confirm-actions">
				<button type="button" class="btn btn-danger" onclick={confirmClear}>
					Clear plan
				</button>
				<button type="button" class="btn btn-cancel" onclick={cancelClear}>
					Cancel
				</button>
			</div>
		</div>
	</div>
{/if}

<style>
	.clear-btn {
		display: inline-flex;
		align-items: center;
		gap: 0.375rem;
		padding: 0.5rem 0.75rem;
		background: transparent;
		color: #6b7280;
		border: 1px solid #d1d5db;
		border-radius: 6px;
		font-size: 0.8125rem;
		cursor: pointer;
		transition: background-color 0.15s, color 0.15s, border-color 0.15s;
	}

	.clear-btn:hover:not(:disabled) {
		background: #fef2f2;
		color: #dc2626;
		border-color: #fecaca;
	}

	.clear-btn:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.confirm-overlay {
		position: fixed;
		inset: 0;
		background: rgba(0, 0, 0, 0.5);
		display: flex;
		align-items: center;
		justify-content: center;
		z-index: 9999;
		padding: 1rem;
	}

	.confirm-dialog {
		background: white;
		border-radius: 12px;
		padding: 1.5rem;
		max-width: 320px;
		width: 100%;
		box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1),
			0 10px 10px -5px rgba(0, 0, 0, 0.04);
	}

	h3 {
		margin: 0 0 0.5rem;
		font-size: 1.125rem;
		font-weight: 600;
		color: #1f2937;
	}

	p {
		margin: 0 0 1.25rem;
		font-size: 0.875rem;
		color: #6b7280;
		line-height: 1.5;
	}

	.confirm-actions {
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
		font-size: 0.9375rem;
		font-weight: 500;
		cursor: pointer;
		transition: background-color 0.15s;
		border: none;
		min-height: 44px;
	}

	.btn-danger {
		background: #dc2626;
		color: white;
	}

	.btn-danger:hover {
		background: #b91c1c;
	}

	.btn-cancel {
		background: #f3f4f6;
		color: #374151;
	}

	.btn-cancel:hover {
		background: #e5e7eb;
	}

	/* iPad touch optimizations */
	@media (min-width: 768px) and (max-width: 1024px) and (hover: none) {
		.clear-btn {
			min-height: 44px;
			padding: 0.625rem 1rem;
			font-size: 0.875rem;
		}

		.btn {
			min-height: 48px;
			font-size: 1rem;
		}
	}
</style>
