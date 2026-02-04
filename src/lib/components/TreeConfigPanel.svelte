<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import type { MapTree } from './MapPicker.svelte';
	import { TREE_PRESETS, type TreePreset } from './MapPicker.svelte';

	interface TreeConfigPanelProps {
		tree: MapTree;
		onupdate: (tree: MapTree) => void;
		ondelete: (id: string) => void;
		onclose: () => void;
		/** Original tree data for auto-detected trees, used for reset functionality */
		originalTree?: MapTree;
		/** Callback when user resets an auto-detected tree to its original state */
		onreset?: (id: string) => void;
	}

	let { tree, onupdate, ondelete, onclose, originalTree, onreset }: TreeConfigPanelProps = $props();

	// Determine if this is an auto-detected tree
	const isAutoDetected = $derived(tree.source === 'auto');
	const isModified = $derived(tree.modified === true);

	// Track if we're on mobile for bottom sheet behavior
	let isMobile = $state(false);
	let panelElement: HTMLDivElement;

	function checkMobile(): void {
		isMobile = window.innerWidth <= 640;
	}

	onMount(() => {
		checkMobile();
		window.addEventListener('resize', checkMobile);
	});

	onDestroy(() => {
		if (typeof window !== 'undefined') {
			window.removeEventListener('resize', checkMobile);
		}
	});

	// Local state for editing
	let editHeight = $state(tree.height);
	let editWidth = $state(tree.canopyWidth);
	let editType = $state(tree.type);
	let editLabel = $state(tree.label);

	// Sync when tree prop changes
	$effect(() => {
		editHeight = tree.height;
		editWidth = tree.canopyWidth;
		editType = tree.type;
		editLabel = tree.label;
	});

	function handleUpdate(): void {
		onupdate({
			...tree,
			height: editHeight,
			canopyWidth: editWidth,
			type: editType,
			label: editLabel
		});
	}

	function applyPreset(preset: TreePreset): void {
		editHeight = preset.height;
		editWidth = preset.canopyWidth;
		editType = preset.type;
		editLabel = preset.label;
		handleUpdate();
	}
</script>

<div class="tree-config-panel" class:mobile={isMobile} bind:this={panelElement}>
	{#if isMobile}
		<div class="drag-handle" aria-hidden="true"></div>
	{/if}
	<div class="panel-header">
		<div class="panel-title-row">
			<span class="panel-title">Configure Tree</span>
			{#if isAutoDetected}
				<span class="source-badge auto" title="Detected from satellite imagery">
					{#if isModified}
						<span class="modified-indicator"></span>
					{/if}
					Auto
				</span>
			{:else}
				<span class="source-badge manual" title="Manually placed">Manual</span>
			{/if}
		</div>
		<button type="button" class="close-btn" onclick={onclose} aria-label="Close panel">×</button>
	</div>

	<div class="panel-body">
		{#if isAutoDetected && isModified && onreset}
			<div class="modified-notice">
				<span class="notice-text">Tree has been edited</span>
				<button
					type="button"
					class="reset-btn"
					onclick={() => onreset?.(tree.id)}
					title="Restore original satellite-detected values"
				>
					Reset to original
				</button>
			</div>
		{/if}

		<div class="preset-section">
			<span class="section-label">Quick presets:</span>
			<div class="preset-buttons">
				{#each TREE_PRESETS as preset}
					<button
						type="button"
						class="preset-btn"
						class:active={editLabel === preset.label}
						onclick={() => applyPreset(preset)}
					>
						{preset.label}
					</button>
				{/each}
			</div>
		</div>

		<div class="form-section">
			<div class="form-row">
				<label for="tree-label">Label:</label>
				<input
					id="tree-label"
					type="text"
					bind:value={editLabel}
					onchange={handleUpdate}
				/>
			</div>

			<div class="form-row">
				<label for="tree-type">Type:</label>
				<select id="tree-type" bind:value={editType} onchange={handleUpdate}>
					<option value="deciduous-tree">Deciduous (loses leaves)</option>
					<option value="evergreen-tree">Evergreen (keeps leaves)</option>
				</select>
			</div>

			<div class="form-row">
				<label for="tree-height">Height:</label>
				<div class="input-with-unit">
					<input
						id="tree-height"
						type="number"
						min="1"
						max="50"
						step="0.5"
						bind:value={editHeight}
						onchange={handleUpdate}
					/>
					<span class="unit">m</span>
				</div>
				<span class="hint">{(editHeight * 3.28).toFixed(0)} ft</span>
			</div>

			<div class="form-row">
				<label for="tree-width">Canopy width:</label>
				<div class="input-with-unit">
					<input
						id="tree-width"
						type="number"
						min="1"
						max="30"
						step="0.5"
						bind:value={editWidth}
						onchange={handleUpdate}
					/>
					<span class="unit">m</span>
				</div>
				<span class="hint">{(editWidth * 3.28).toFixed(0)} ft</span>
			</div>
		</div>

		<div class="info-section">
			<span class="info-label">Position:</span>
			<span class="info-value">
				{tree.lat.toFixed(5)}°, {tree.lng.toFixed(5)}°
			</span>
		</div>

		<button type="button" class="delete-btn" onclick={() => ondelete(tree.id)}>
			Delete tree
		</button>
	</div>
</div>

<style>
	.tree-config-panel {
		position: absolute;
		top: 0.5rem;
		right: 0.5rem;
		width: 260px;
		background: white;
		border: 1px solid #d6d3d1;
		border-radius: 8px;
		box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
		z-index: 1000;
		font-family: system-ui, -apple-system, sans-serif;
	}

	.panel-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 0.625rem 0.75rem;
		border-bottom: 1px solid #e7e5e4;
		background: #f5f5f4;
		border-radius: 8px 8px 0 0;
	}

	.panel-title-row {
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}

	.panel-title {
		font-weight: 600;
		font-size: 0.9375rem;
		color: #1c1917;
	}

	.source-badge {
		display: inline-flex;
		align-items: center;
		gap: 0.25rem;
		padding: 0.125rem 0.375rem;
		border-radius: 4px;
		font-size: 0.6875rem;
		font-weight: 500;
		text-transform: uppercase;
		letter-spacing: 0.025em;
	}

	.source-badge.auto {
		background: #dbeafe;
		color: #1d4ed8;
		border: 1px solid #93c5fd;
	}

	.source-badge.manual {
		background: #dcfce7;
		color: #166534;
		border: 1px solid #86efac;
	}

	.modified-indicator {
		width: 6px;
		height: 6px;
		background: #f59e0b;
		border-radius: 50%;
	}

	.modified-notice {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.5rem;
		padding: 0.5rem;
		background: #fef3c7;
		border: 1px solid #fcd34d;
		border-radius: 4px;
		margin-bottom: 0.5rem;
	}

	.notice-text {
		font-size: 0.75rem;
		color: #92400e;
	}

	.reset-btn {
		padding: 0.25rem 0.5rem;
		background: white;
		border: 1px solid #fcd34d;
		border-radius: 4px;
		color: #92400e;
		font-size: 0.6875rem;
		cursor: pointer;
		font-weight: 500;
		transition: all 0.15s;
		white-space: nowrap;
	}

	.reset-btn:hover {
		background: #fef3c7;
		border-color: #f59e0b;
	}

	.close-btn {
		background: none;
		border: none;
		font-size: 1.375rem;
		color: #78716c;
		cursor: pointer;
		padding: 0;
		line-height: 1;
		width: 1.5rem;
		height: 1.5rem;
		display: flex;
		align-items: center;
		justify-content: center;
		border-radius: 4px;
	}

	.close-btn:hover {
		background: #e7e5e4;
		color: #1c1917;
	}

	.panel-body {
		padding: 0.75rem;
		display: flex;
		flex-direction: column;
		gap: 0.875rem;
	}

	.preset-section {
		display: flex;
		flex-direction: column;
		gap: 0.375rem;
	}

	.section-label {
		font-size: 0.8125rem;
		color: #57534e;
		font-weight: 500;
	}

	.preset-buttons {
		display: flex;
		flex-wrap: wrap;
		gap: 0.25rem;
	}

	.preset-btn {
		padding: 0.25rem 0.5rem;
		background: #fafaf9;
		border: 1px solid #d6d3d1;
		border-radius: 4px;
		font-size: 0.75rem;
		cursor: pointer;
		transition: all 0.15s;
	}

	.preset-btn:hover {
		background: #f5f5f4;
		border-color: #a8a29e;
	}

	.preset-btn.active {
		background: #22c55e;
		border-color: #16a34a;
		color: white;
	}

	.form-section {
		display: flex;
		flex-direction: column;
		gap: 0.625rem;
	}

	.form-row {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
	}

	.form-row label {
		font-size: 0.8125rem;
		color: #57534e;
		font-weight: 500;
	}

	.form-row input,
	.form-row select {
		padding: 0.375rem 0.5rem;
		border: 1px solid #d6d3d1;
		border-radius: 4px;
		font-size: 0.875rem;
		background: white;
	}

	.form-row input:focus,
	.form-row select:focus {
		outline: none;
		border-color: #22c55e;
		box-shadow: 0 0 0 2px rgba(34, 197, 94, 0.15);
	}

	.input-with-unit {
		display: flex;
		align-items: center;
	}

	.input-with-unit input {
		flex: 1;
		border-radius: 4px 0 0 4px;
		border-right: none;
	}

	.unit {
		padding: 0.375rem 0.5rem;
		background: #f5f5f4;
		border: 1px solid #d6d3d1;
		border-radius: 0 4px 4px 0;
		font-size: 0.8125rem;
		color: #57534e;
	}

	.hint {
		font-size: 0.75rem;
		color: #78716c;
		margin-top: 0.125rem;
	}

	.info-section {
		display: flex;
		gap: 0.5rem;
		padding: 0.5rem;
		background: #f5f5f4;
		border-radius: 4px;
		font-size: 0.8125rem;
	}

	.info-label {
		color: #57534e;
		font-weight: 500;
	}

	.info-value {
		color: #1c1917;
		font-family: ui-monospace, monospace;
	}

	.delete-btn {
		padding: 0.5rem;
		background: #fef2f2;
		border: 1px solid #fecaca;
		border-radius: 4px;
		color: #dc2626;
		font-size: 0.875rem;
		cursor: pointer;
		font-weight: 500;
		transition: all 0.15s;
	}

	.delete-btn:hover {
		background: #fee2e2;
		border-color: #f87171;
	}

	/* Drag handle for mobile bottom sheet */
	.drag-handle {
		width: 36px;
		height: 4px;
		background: #d6d3d1;
		border-radius: 2px;
		margin: 0.5rem auto 0;
	}

	/* Mobile bottom sheet layout */
	.tree-config-panel.mobile {
		position: fixed;
		top: auto;
		right: 0;
		bottom: 0;
		left: 0;
		width: 100%;
		max-width: 100%;
		border-radius: 16px 16px 0 0;
		box-shadow: 0 -4px 20px rgba(0, 0, 0, 0.15);
		z-index: 1001;
		max-height: 70vh;
		overflow-y: auto;
		-webkit-overflow-scrolling: touch;
	}

	.tree-config-panel.mobile .panel-header {
		position: sticky;
		top: 0;
		background: #f5f5f4;
		border-radius: 0;
		padding: 0.75rem 1rem;
	}

	.tree-config-panel.mobile .close-btn {
		width: 2.5rem;
		height: 2.5rem;
		min-width: 44px;
		min-height: 44px;
		font-size: 1.5rem;
	}

	.tree-config-panel.mobile .panel-body {
		padding: 1rem;
		padding-bottom: calc(1rem + env(safe-area-inset-bottom, 0));
	}

	.tree-config-panel.mobile .preset-buttons {
		display: grid;
		grid-template-columns: repeat(2, 1fr);
		gap: 0.5rem;
	}

	.tree-config-panel.mobile .preset-btn {
		padding: 0.75rem;
		font-size: 0.875rem;
		min-height: 44px;
	}

	.tree-config-panel.mobile .form-row input,
	.tree-config-panel.mobile .form-row select {
		padding: 0.625rem 0.75rem;
		font-size: 16px; /* Prevents iOS zoom on focus */
		min-height: 44px;
	}

	.tree-config-panel.mobile .input-with-unit input {
		min-height: 44px;
	}

	.tree-config-panel.mobile .unit {
		padding: 0.625rem 0.75rem;
		font-size: 0.875rem;
		min-height: 44px;
		display: flex;
		align-items: center;
	}

	.tree-config-panel.mobile .delete-btn {
		padding: 0.875rem;
		font-size: 1rem;
		min-height: 48px;
	}

	.tree-config-panel.mobile .info-section {
		padding: 0.75rem;
	}
</style>
