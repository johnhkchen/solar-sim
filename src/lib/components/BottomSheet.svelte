<script lang="ts">
	/**
	 * BottomSheet - Mobile panel that slides up from the bottom of the screen.
	 * Supports drag-to-expand/collapse, three height states, and swipe gestures
	 * for phase navigation. Optimized for iPad usage in on-site consultations
	 * with large touch targets and high-contrast support.
	 */
	import type { Snippet } from 'svelte';

	type SheetState = 'collapsed' | 'default' | 'expanded';

	interface Props {
		/** Minimum height when fully collapsed (header only visible) */
		collapsedHeight?: string;
		/** Default height when in normal state */
		minHeight?: string;
		/** Maximum height when fully expanded */
		maxHeight?: string;
		/** Current expansion state */
		expanded?: boolean;
		/** Title shown in the collapsed header */
		title?: string;
		/** Quick stat shown in collapsed header (e.g., "3 zones") */
		quickStat?: string;
		onExpand?: () => void;
		onCollapse?: () => void;
		onSwipeLeft?: () => void;
		onSwipeRight?: () => void;
		children: Snippet;
	}

	let {
		collapsedHeight = '60px',
		minHeight = '40%',
		maxHeight = '75%',
		expanded = false,
		title = '',
		quickStat = '',
		onExpand,
		onCollapse,
		onSwipeLeft,
		onSwipeRight,
		children
	}: Props = $props();

	let sheetElement: HTMLDivElement | null = $state(null);
	let contentElement: HTMLDivElement | null = $state(null);
	let isDragging = $state(false);
	let startY = $state(0);
	let startX = $state(0);
	let currentY = $state(0);
	let dragDirection: 'vertical' | 'horizontal' | null = $state(null);
	let isCollapsed = $state(false);

	// Computed sheet state
	const sheetState = $derived<SheetState>(
		isCollapsed ? 'collapsed' : expanded ? 'expanded' : 'default'
	);

	// Thresholds
	const SWIPE_THRESHOLD = 50;
	const DRAG_THRESHOLD = 10;
	const VELOCITY_THRESHOLD = 0.5; // px/ms

	let touchStartTime = 0;

	function handleTouchStart(event: TouchEvent) {
		if (event.touches.length !== 1) return;

		const touch = event.touches[0];
		startY = touch.clientY;
		startX = touch.clientX;
		currentY = touch.clientY;
		isDragging = true;
		dragDirection = null;
		touchStartTime = Date.now();
	}

	function handleTouchMove(event: TouchEvent) {
		if (!isDragging || event.touches.length !== 1) return;

		const touch = event.touches[0];
		const deltaY = touch.clientY - startY;
		const deltaX = touch.clientX - startX;

		// Determine drag direction once we've moved past threshold
		if (!dragDirection && (Math.abs(deltaY) > DRAG_THRESHOLD || Math.abs(deltaX) > DRAG_THRESHOLD)) {
			dragDirection = Math.abs(deltaX) > Math.abs(deltaY) ? 'horizontal' : 'vertical';
		}

		// For horizontal swipes, prevent default to avoid scroll interference
		if (dragDirection === 'horizontal') {
			event.preventDefault();
		}

		currentY = touch.clientY;
	}

	function handleTouchEnd(event: TouchEvent) {
		if (!isDragging) return;

		const deltaY = currentY - startY;
		const deltaX =
			event.changedTouches.length > 0 ? event.changedTouches[0].clientX - startX : 0;
		const duration = Date.now() - touchStartTime;
		const velocityY = Math.abs(deltaY) / duration;

		if (dragDirection === 'horizontal') {
			// Horizontal swipe for phase navigation
			if (deltaX > SWIPE_THRESHOLD && onSwipeRight) {
				onSwipeRight();
			} else if (deltaX < -SWIPE_THRESHOLD && onSwipeLeft) {
				onSwipeLeft();
			}
		} else if (dragDirection === 'vertical') {
			// Use velocity for quick flicks
			const isQuickFlick = velocityY > VELOCITY_THRESHOLD;
			const threshold = isQuickFlick ? 20 : SWIPE_THRESHOLD;

			if (deltaY < -threshold) {
				// Swiped up - expand
				if (isCollapsed) {
					isCollapsed = false;
				} else if (!expanded && onExpand) {
					onExpand();
				}
			} else if (deltaY > threshold) {
				// Swiped down - collapse
				if (expanded && onCollapse) {
					onCollapse();
				} else if (!isCollapsed) {
					isCollapsed = true;
				}
			}
		}

		isDragging = false;
		dragDirection = null;
	}

	function handleHeaderTap() {
		if (isCollapsed) {
			isCollapsed = false;
		} else if (!expanded && onExpand) {
			onExpand();
		} else if (expanded && onCollapse) {
			onCollapse();
		}
	}

	// Handle content scroll to prevent conflicts
	function handleContentTouchStart(event: TouchEvent) {
		if (!contentElement) return;

		const scrollTop = contentElement.scrollTop;
		const scrollHeight = contentElement.scrollHeight;
		const clientHeight = contentElement.clientHeight;

		// If we're at the top or bottom of scroll, allow sheet gestures
		if (scrollTop <= 0 || scrollTop + clientHeight >= scrollHeight) {
			// Let the event bubble to the sheet handler
		} else {
			// Stop propagation so scrolling works normally
			event.stopPropagation();
		}
	}
</script>

<div
	class="bottom-sheet"
	class:expanded
	class:collapsed={isCollapsed}
	style="--collapsed-height: {collapsedHeight}; --min-height: {minHeight}; --max-height: {maxHeight}"
	bind:this={sheetElement}
	data-state={sheetState}
>
	<div
		class="sheet-handle"
		ontouchstart={handleTouchStart}
		ontouchmove={handleTouchMove}
		ontouchend={handleTouchEnd}
		role="button"
		tabindex="0"
		aria-label={isCollapsed ? 'Expand panel' : expanded ? 'Collapse panel' : 'Expand panel'}
		onclick={handleHeaderTap}
		onkeydown={(e) => {
			if (e.key === 'Enter' || e.key === ' ') {
				e.preventDefault();
				handleHeaderTap();
			}
		}}
	>
		<div class="handle-bar"></div>
		{#if title || quickStat}
			<div class="collapsed-header">
				{#if title}
					<span class="collapsed-title">{title}</span>
				{/if}
				{#if quickStat}
					<span class="collapsed-stat">{quickStat}</span>
				{/if}
			</div>
		{/if}
	</div>

	<div
		class="sheet-content"
		bind:this={contentElement}
		ontouchstart={handleContentTouchStart}
	>
		{@render children()}
	</div>

	<!-- Swipe hint indicators -->
	<div class="swipe-hints" aria-hidden="true">
		{#if onSwipeRight}
			<span class="swipe-hint left">
				<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
					<polyline points="15 18 9 12 15 6"></polyline>
				</svg>
			</span>
		{/if}
		{#if onSwipeLeft}
			<span class="swipe-hint right">
				<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
					<polyline points="9 18 15 12 9 6"></polyline>
				</svg>
			</span>
		{/if}
	</div>
</div>

<style>
	.bottom-sheet {
		position: fixed;
		bottom: 0;
		left: 0;
		right: 0;
		background: white;
		border-top-left-radius: 16px;
		border-top-right-radius: 16px;
		box-shadow: 0 -4px 20px rgba(0, 0, 0, 0.15);
		display: flex;
		flex-direction: column;
		height: var(--min-height);
		transition: height 0.3s cubic-bezier(0.32, 0.72, 0, 1);
		z-index: 100;
		max-height: calc(100vh - 60px);
		will-change: height;
	}

	.bottom-sheet.expanded {
		height: var(--max-height);
	}

	.bottom-sheet.collapsed {
		height: var(--collapsed-height);
	}

	.sheet-handle {
		flex-shrink: 0;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: flex-start;
		/* Minimum 44px touch target */
		min-height: 44px;
		padding: 12px 16px 8px;
		cursor: grab;
		touch-action: none;
		gap: 6px;
	}

	.sheet-handle:active {
		cursor: grabbing;
	}

	.handle-bar {
		width: 40px;
		height: 5px;
		background: #9ca3af;
		border-radius: 3px;
		transition: background-color 0.15s, transform 0.15s;
	}

	.sheet-handle:hover .handle-bar,
	.sheet-handle:focus-visible .handle-bar {
		background: #6b7280;
		transform: scaleX(1.1);
	}

	.sheet-handle:focus-visible {
		outline: 2px solid #3b82f6;
		outline-offset: -2px;
		border-radius: 8px;
	}

	/* Collapsed header info */
	.collapsed-header {
		display: flex;
		align-items: center;
		gap: 8px;
		opacity: 0;
		transition: opacity 0.2s;
		pointer-events: none;
	}

	.collapsed .collapsed-header {
		opacity: 1;
	}

	.collapsed-title {
		font-size: 0.9375rem;
		font-weight: 600;
		color: #1f2937;
	}

	.collapsed-stat {
		font-size: 0.8125rem;
		color: #6b7280;
		background: #f3f4f6;
		padding: 2px 8px;
		border-radius: 4px;
	}

	.sheet-content {
		flex: 1;
		overflow-y: auto;
		overflow-x: hidden;
		display: flex;
		flex-direction: column;
		overscroll-behavior: contain;
		-webkit-overflow-scrolling: touch;
	}

	.collapsed .sheet-content {
		display: none;
	}

	/* Swipe hints for navigation */
	.swipe-hints {
		position: absolute;
		top: 50%;
		left: 0;
		right: 0;
		transform: translateY(-50%);
		display: flex;
		justify-content: space-between;
		pointer-events: none;
		padding: 0 8px;
	}

	.swipe-hint {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 24px;
		height: 24px;
		color: #d1d5db;
		opacity: 0;
		transition: opacity 0.2s;
	}

	.bottom-sheet:not(.collapsed) .swipe-hint {
		opacity: 0.5;
	}

	/* High contrast mode for outdoor visibility */
	.high-contrast .bottom-sheet {
		border: 3px solid #000;
		box-shadow: 0 -6px 24px rgba(0, 0, 0, 0.3);
	}

	.high-contrast .handle-bar {
		background: #000;
		height: 6px;
	}

	.high-contrast .collapsed-title {
		color: #000;
		font-weight: 700;
	}

	.high-contrast .collapsed-stat {
		background: #e5e7eb;
		color: #000;
		font-weight: 600;
	}

	@media (prefers-contrast: more) {
		.bottom-sheet {
			border: 3px solid #000;
			box-shadow: 0 -6px 24px rgba(0, 0, 0, 0.3);
		}

		.handle-bar {
			background: #000;
			height: 6px;
		}

		.collapsed-title {
			color: #000;
			font-weight: 700;
		}

		.collapsed-stat {
			background: #e5e7eb;
			color: #000;
			font-weight: 600;
		}
	}

	/* Safe area padding for devices with home indicators */
	@supports (padding-bottom: env(safe-area-inset-bottom)) {
		.bottom-sheet {
			padding-bottom: env(safe-area-inset-bottom);
		}
	}

	/* iPad-specific optimizations */
	@media (min-width: 768px) and (max-width: 1024px) and (hover: none) {
		.sheet-handle {
			min-height: 52px;
			padding: 14px 20px 10px;
		}

		.handle-bar {
			width: 48px;
			height: 6px;
		}

		.collapsed-title {
			font-size: 1rem;
		}

		.collapsed-stat {
			font-size: 0.875rem;
			padding: 3px 10px;
		}
	}
</style>
