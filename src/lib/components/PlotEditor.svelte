<script lang="ts">
	import type { Obstacle, ObstacleType, ObstaclePreset } from '$lib/solar/shade-types';
	import { OBSTACLE_PRESETS } from '$lib/solar/shade-types';
	import type { PlotSlope } from '$lib/solar/slope';
	import { SLOPE_PRESETS, describeSlopeDirection } from '$lib/solar/slope';

	/**
	 * Extended obstacle type with x,y coordinates for the plot editor.
	 * The x,y values are the source of truth; direction and distance derive from them.
	 * X is meters east of observation point, Y is meters north.
	 */
	export interface PlotObstacle extends Obstacle {
		x: number;
		y: number;
	}

	interface PlotEditorProps {
		obstacles?: PlotObstacle[];
		onchange?: (obstacles: PlotObstacle[]) => void;
		slope?: PlotSlope;
		onSlopeChange?: (slope: PlotSlope) => void;
	}

	let { obstacles = $bindable([]), onchange, slope = $bindable({ angle: 0, aspect: 180 }), onSlopeChange }: PlotEditorProps = $props();

	// View state for pan and zoom
	let scale = $state(10); // pixels per meter
	let panX = $state(0);
	let panY = $state(0);

	// Canvas dimensions (updated on resize)
	let width = $state(600);
	let height = $state(400);
	let svgElement: SVGSVGElement | undefined = $state();

	// Computed center of the canvas
	const centerX = $derived(width / 2);
	const centerY = $derived(height / 2);

	// Interaction state
	let placementMode: ObstacleType | null = $state(null);
	let selectedId: string | null = $state(null);
	let dragging: { id: string; offsetX: number; offsetY: number } | null = $state(null);
	let panning = $state(false);
	let panStart = $state({ x: 0, y: 0, panX: 0, panY: 0 });

	// Currently selected obstacle for editing
	const selectedObstacle = $derived(obstacles.find((o) => o.id === selectedId) ?? null);

	// Grid and transform calculations
	const worldTransform = $derived(
		`translate(${centerX + panX}, ${centerY + panY}) scale(${scale}, ${-scale})`
	);

	// Grid spacing adjusts based on zoom level for readability
	const gridSpacing = $derived(scale >= 20 ? 1 : scale >= 5 ? 5 : 10);

	// Visible world bounds for grid rendering
	const visibleBounds = $derived({
		minX: Math.floor((-centerX - panX) / scale / gridSpacing) * gridSpacing - gridSpacing,
		maxX: Math.ceil((width - centerX - panX) / scale / gridSpacing) * gridSpacing + gridSpacing,
		minY: Math.floor((-centerY + panY) / scale / gridSpacing) * gridSpacing - gridSpacing,
		maxY: Math.ceil((height - centerY + panY) / scale / gridSpacing) * gridSpacing + gridSpacing
	});

	// Generate grid lines
	const gridLinesX = $derived(() => {
		const lines: number[] = [];
		for (let x = visibleBounds.minX; x <= visibleBounds.maxX; x += gridSpacing) {
			lines.push(x);
		}
		return lines;
	});

	const gridLinesY = $derived(() => {
		const lines: number[] = [];
		for (let y = visibleBounds.minY; y <= visibleBounds.maxY; y += gridSpacing) {
			lines.push(y);
		}
		return lines;
	});

	/**
	 * Converts screen coordinates to world coordinates (meters from observation point).
	 */
	function screenToWorld(screenX: number, screenY: number): { x: number; y: number } {
		const worldX = (screenX - centerX - panX) / scale;
		const worldY = -(screenY - centerY - panY) / scale;
		return { x: worldX, y: worldY };
	}

	/**
	 * Converts world position to direction and distance for shade calculations.
	 */
	function positionToShade(x: number, y: number): { direction: number; distance: number } {
		const distance = Math.sqrt(x * x + y * y);
		// atan2 gives angle from positive X axis, but we want angle from positive Y (north)
		let direction = 90 - (Math.atan2(y, x) * 180) / Math.PI;
		if (direction < 0) direction += 360;
		if (direction >= 360) direction -= 360;
		return { direction, distance };
	}

	/**
	 * Creates a new obstacle from a preset at the given world position.
	 */
	function createObstacleFromPreset(
		preset: ObstaclePreset,
		x: number,
		y: number
	): PlotObstacle {
		const { direction, distance } = positionToShade(x, y);
		return {
			id: crypto.randomUUID(),
			type: preset.type,
			label: preset.label,
			x,
			y,
			direction,
			distance,
			height: preset.height,
			width: preset.width
		};
	}

	/**
	 * Gets the default preset for an obstacle type.
	 */
	function getDefaultPreset(type: ObstacleType): ObstaclePreset {
		const preset = OBSTACLE_PRESETS.find((p) => p.type === type);
		if (preset) return preset;
		// Fallback defaults
		return { label: type, type, height: 3, width: 3 };
	}

	/**
	 * Updates an obstacle's position and recalculates direction/distance.
	 */
	function updateObstaclePosition(id: string, x: number, y: number): void {
		const { direction, distance } = positionToShade(x, y);
		obstacles = obstacles.map((o) =>
			o.id === id ? { ...o, x, y, direction, distance } : o
		);
		onchange?.(obstacles);
	}

	/**
	 * Updates an obstacle's dimensions.
	 */
	function updateObstacleDimensions(
		id: string,
		updates: { height?: number; width?: number; label?: string }
	): void {
		obstacles = obstacles.map((o) => (o.id === id ? { ...o, ...updates } : o));
		onchange?.(obstacles);
	}

	/**
	 * Deletes an obstacle by ID.
	 */
	function deleteObstacle(id: string): void {
		obstacles = obstacles.filter((o) => o.id !== id);
		if (selectedId === id) selectedId = null;
		onchange?.(obstacles);
	}

	/**
	 * Handles canvas click for placement or selection.
	 */
	function handleCanvasClick(event: MouseEvent): void {
		if (dragging || panning) return;

		const rect = svgElement?.getBoundingClientRect();
		if (!rect) return;

		const screenX = event.clientX - rect.left;
		const screenY = event.clientY - rect.top;
		const worldPos = screenToWorld(screenX, screenY);

		// Check if clicking on an obstacle (using hit detection)
		const hitThreshold = 3 / scale; // 3 meters in world units
		const hitObstacle = obstacles.find((o) => {
			const dx = o.x - worldPos.x;
			const dy = o.y - worldPos.y;
			const dist = Math.sqrt(dx * dx + dy * dy);
			return dist < Math.max(o.width / 2, hitThreshold);
		});

		if (hitObstacle) {
			selectedId = hitObstacle.id;
			placementMode = null;
		} else if (placementMode) {
			const preset = getDefaultPreset(placementMode);
			const newObstacle = createObstacleFromPreset(preset, worldPos.x, worldPos.y);
			obstacles = [...obstacles, newObstacle];
			selectedId = newObstacle.id;
			onchange?.(obstacles);
		} else {
			selectedId = null;
		}
	}

	/**
	 * Starts dragging an obstacle.
	 */
	function startObstacleDrag(event: PointerEvent, obstacle: PlotObstacle): void {
		event.stopPropagation();
		(event.target as Element).setPointerCapture(event.pointerId);

		const rect = svgElement?.getBoundingClientRect();
		if (!rect) return;

		const screenX = event.clientX - rect.left;
		const screenY = event.clientY - rect.top;
		const worldPos = screenToWorld(screenX, screenY);

		dragging = {
			id: obstacle.id,
			offsetX: worldPos.x - obstacle.x,
			offsetY: worldPos.y - obstacle.y
		};
		selectedId = obstacle.id;
	}

	/**
	 * Handles pointer move for dragging obstacles or panning.
	 */
	function handlePointerMove(event: PointerEvent): void {
		const rect = svgElement?.getBoundingClientRect();
		if (!rect) return;

		const screenX = event.clientX - rect.left;
		const screenY = event.clientY - rect.top;

		if (dragging) {
			const worldPos = screenToWorld(screenX, screenY);
			const newX = worldPos.x - dragging.offsetX;
			const newY = worldPos.y - dragging.offsetY;
			updateObstaclePosition(dragging.id, newX, newY);
		} else if (panning) {
			const dx = event.clientX - panStart.x;
			const dy = event.clientY - panStart.y;
			panX = panStart.panX + dx;
			panY = panStart.panY + dy;
		}
	}

	/**
	 * Ends dragging or panning.
	 */
	function handlePointerUp(event: PointerEvent): void {
		if (dragging) {
			(event.target as Element).releasePointerCapture(event.pointerId);
			dragging = null;
		}
		panning = false;
	}

	/**
	 * Starts panning the view.
	 */
	function startPan(event: PointerEvent): void {
		if (event.target !== svgElement && !(event.target as Element).classList.contains('grid-bg')) {
			return;
		}
		panning = true;
		panStart = { x: event.clientX, y: event.clientY, panX, panY };
	}

	/**
	 * Handles mouse wheel for zooming.
	 */
	function handleWheel(event: WheelEvent): void {
		event.preventDefault();

		const zoomFactor = event.deltaY > 0 ? 0.9 : 1.1;
		const newScale = Math.max(2, Math.min(100, scale * zoomFactor));

		// Zoom toward pointer position
		const rect = svgElement?.getBoundingClientRect();
		if (!rect) return;

		const pointerX = event.clientX - rect.left;
		const pointerY = event.clientY - rect.top;

		// Get world position under pointer before zoom
		const worldBefore = screenToWorld(pointerX, pointerY);

		// Apply new scale
		scale = newScale;

		// Get screen position of that world point after zoom
		const screenAfterX = centerX + worldBefore.x * newScale + panX;
		const screenAfterY = centerY - worldBefore.y * newScale + panY;

		// Adjust pan to keep world point under pointer
		panX += pointerX - screenAfterX;
		panY += pointerY - screenAfterY;
	}

	/**
	 * Resets the view to default position and zoom.
	 */
	function resetView(): void {
		scale = 10;
		panX = 0;
		panY = 0;
	}

	/**
	 * Updates the slope angle and notifies parent.
	 */
	function updateSlopeAngle(angle: number): void {
		const newSlope = { ...slope, angle: Math.max(0, Math.min(30, angle)) };
		slope = newSlope;
		onSlopeChange?.(newSlope);
	}

	/**
	 * Updates the slope aspect/direction and notifies parent.
	 */
	function updateSlopeAspect(aspect: number): void {
		let normalizedAspect = aspect % 360;
		if (normalizedAspect < 0) normalizedAspect += 360;
		const newSlope = { ...slope, aspect: normalizedAspect };
		slope = newSlope;
		onSlopeChange?.(newSlope);
	}

	/**
	 * Gets the CSS gradient for slope visualization based on slope direction.
	 * The gradient is lighter on the uphill side and slightly darker downhill.
	 */
	const slopeGradientAngle = $derived(slope.aspect);
	const slopeGradientIntensity = $derived(Math.min(0.15, slope.angle / 30 * 0.15));

	/**
	 * Calculates the arrow endpoint for slope direction indicator.
	 * Arrow points downhill (in the direction of the aspect).
	 */
	const slopeArrow = $derived(() => {
		// Convert aspect (compass bearing) to math angle for SVG
		// Compass: 0=N, 90=E, 180=S, 270=W
		// Math/SVG Y-flipped: 0=E, 90=N, 180=W, 270=S
		const mathAngle = (90 - slope.aspect) * Math.PI / 180;
		const arrowLength = 8; // meters in world coordinates
		return {
			x: Math.cos(mathAngle) * arrowLength,
			y: Math.sin(mathAngle) * arrowLength
		};
	});

	// Compass direction labels for the direction picker
	const compassDirections = [
		{ label: 'N', value: 0 },
		{ label: 'NE', value: 45 },
		{ label: 'E', value: 90 },
		{ label: 'SE', value: 135 },
		{ label: 'S', value: 180 },
		{ label: 'SW', value: 225 },
		{ label: 'W', value: 270 },
		{ label: 'NW', value: 315 }
	];

	/**
	 * Selects a placement mode from the palette.
	 */
	function selectPlacementMode(type: ObstacleType | null): void {
		placementMode = placementMode === type ? null : type;
		if (placementMode) selectedId = null;
	}

	/**
	 * Gets visual properties for rendering an obstacle based on its type.
	 */
	function getObstacleVisual(
		obstacle: PlotObstacle
	): { fill: string; stroke: string; shape: 'circle' | 'rect' | 'line' } {
		switch (obstacle.type) {
			case 'deciduous-tree':
				return { fill: '#22c55e', stroke: '#15803d', shape: 'circle' };
			case 'evergreen-tree':
				return { fill: '#166534', stroke: '#14532d', shape: 'circle' };
			case 'building':
				return { fill: '#94a3b8', stroke: '#475569', shape: 'rect' };
			case 'fence':
				return { fill: '#a16207', stroke: '#854d0e', shape: 'line' };
			case 'hedge':
				return { fill: '#4ade80', stroke: '#22c55e', shape: 'rect' };
			default:
				return { fill: '#9ca3af', stroke: '#6b7280', shape: 'circle' };
		}
	}

	// Unique obstacle types available for placement
	const obstacleTypes: { type: ObstacleType; label: string }[] = [
		{ type: 'deciduous-tree', label: 'Tree' },
		{ type: 'evergreen-tree', label: 'Evergreen' },
		{ type: 'building', label: 'Building' },
		{ type: 'fence', label: 'Fence' },
		{ type: 'hedge', label: 'Hedge' }
	];

	// Track container size
	let containerElement: HTMLDivElement | undefined = $state();

	$effect(() => {
		if (!containerElement) return;

		const observer = new ResizeObserver((entries) => {
			for (const entry of entries) {
				width = entry.contentRect.width;
				height = entry.contentRect.height;
			}
		});

		observer.observe(containerElement);

		return () => observer.disconnect();
	});
</script>

<div class="plot-editor">
	<div class="toolbar">
		<div class="palette">
			<span class="palette-label">Add:</span>
			{#each obstacleTypes as { type, label }}
				<button
					type="button"
					class="palette-btn"
					class:active={placementMode === type}
					onclick={() => selectPlacementMode(type)}
					title={`Click to place ${label.toLowerCase()}`}
				>
					{label}
				</button>
			{/each}
		</div>
		<div class="view-controls">
			<button type="button" class="view-btn" onclick={() => (scale = Math.min(100, scale * 1.25))}>
				+
			</button>
			<button type="button" class="view-btn" onclick={() => (scale = Math.max(2, scale * 0.8))}>
				-
			</button>
			<button type="button" class="view-btn" onclick={resetView}>Reset</button>
		</div>
	</div>

	<div class="slope-controls">
		<div class="slope-header">
			<span class="slope-label">Terrain Slope</span>
			<span class="slope-desc">{describeSlopeDirection(slope)}</span>
		</div>
		<div class="slope-inputs">
			<div class="slope-input-group">
				<label for="slope-angle">Angle:</label>
				<input
					id="slope-angle"
					type="range"
					min="0"
					max="30"
					step="1"
					value={slope.angle}
					oninput={(e) => updateSlopeAngle(parseInt((e.target as HTMLInputElement).value))}
				/>
				<span class="slope-value">{slope.angle}°</span>
			</div>
			<div class="slope-input-group">
				<label for="slope-aspect">Faces:</label>
				<div class="compass-picker">
					{#each compassDirections as { label, value }}
						<button
							type="button"
							class="compass-btn"
							class:active={Math.abs(slope.aspect - value) < 22.5 || Math.abs(slope.aspect - value) > 337.5}
							onclick={() => updateSlopeAspect(value)}
							title={`Slope faces ${label}`}
						>
							{label}
						</button>
					{/each}
				</div>
			</div>
		</div>
	</div>

	<div class="canvas-container" bind:this={containerElement}>
		<!-- svelte-ignore a11y_no_noninteractive_tabindex a11y_no_noninteractive_element_interactions -->
		<svg
			bind:this={svgElement}
			viewBox="0 0 {width} {height}"
			onwheel={handleWheel}
			onpointerdown={startPan}
			onpointermove={handlePointerMove}
			onpointerup={handlePointerUp}
			onpointerleave={handlePointerUp}
			onclick={handleCanvasClick}
			onkeydown={(e) => {
				if (selectedId && (e.key === 'Delete' || e.key === 'Backspace')) {
					deleteObstacle(selectedId);
				} else if (e.key === 'Escape') {
					placementMode = null;
					selectedId = null;
				}
			}}
			tabindex="0"
			role="application"
			aria-label="Plot editor canvas for placing obstacles"
			class:placing={placementMode !== null}
		>
			<!-- Background -->
			<rect x="0" y="0" {width} {height} fill="#fafaf9" class="grid-bg" />

			<!-- Slope gradient overlay -->
			{#if slope.angle >= 0.5}
				<defs>
					<linearGradient
						id="slope-gradient"
						gradientTransform="rotate({slopeGradientAngle + 180}, 0.5, 0.5)"
					>
						<stop offset="0%" stop-color="rgba(139, 69, 19, {slopeGradientIntensity})" />
						<stop offset="50%" stop-color="rgba(139, 69, 19, 0)" />
						<stop offset="100%" stop-color="rgba(255, 255, 200, {slopeGradientIntensity})" />
					</linearGradient>
				</defs>
				<rect x="0" y="0" {width} {height} fill="url(#slope-gradient)" class="slope-overlay" />
			{/if}

			<!-- Grid in world coordinates -->
			<g transform={worldTransform}>
				<!-- Grid lines -->
				{#each gridLinesX() as x}
					<line
						x1={x}
						y1={visibleBounds.minY}
						x2={x}
						y2={visibleBounds.maxY}
						stroke={x === 0 ? '#94a3b8' : '#e5e7eb'}
						stroke-width={x === 0 ? 2 / scale : 1 / scale}
					/>
				{/each}
				{#each gridLinesY() as y}
					<line
						x1={visibleBounds.minX}
						y1={y}
						x2={visibleBounds.maxX}
						y2={y}
						stroke={y === 0 ? '#94a3b8' : '#e5e7eb'}
						stroke-width={y === 0 ? 2 / scale : 1 / scale}
					/>
				{/each}

				<!-- Obstacles -->
				{#each obstacles as obstacle (obstacle.id)}
					{@const visual = getObstacleVisual(obstacle)}
					{@const isSelected = selectedId === obstacle.id}
					<!-- svelte-ignore a11y_no_static_element_interactions a11y_interactive_supports_focus -->
					<g
						class="obstacle"
						class:selected={isSelected}
						role="button"
						aria-label="{obstacle.label} at {obstacle.distance.toFixed(1)}m"
						onpointerdown={(e) => startObstacleDrag(e, obstacle)}
					>
						{#if visual.shape === 'circle'}
							<!-- Tree-like obstacle -->
							<circle
								cx={obstacle.x}
								cy={obstacle.y}
								r={obstacle.width / 2}
								fill={visual.fill}
								fill-opacity="0.6"
								stroke={isSelected ? '#0066cc' : visual.stroke}
								stroke-width={(isSelected ? 3 : 1.5) / scale}
							/>
							<!-- Trunk dot -->
							<circle
								cx={obstacle.x}
								cy={obstacle.y}
								r={0.3}
								fill={visual.stroke}
							/>
						{:else if visual.shape === 'rect'}
							<!-- Building/hedge -->
							<rect
								x={obstacle.x - obstacle.width / 2}
								y={obstacle.y - 2}
								width={obstacle.width}
								height={4}
								fill={visual.fill}
								fill-opacity="0.7"
								stroke={isSelected ? '#0066cc' : visual.stroke}
								stroke-width={(isSelected ? 3 : 1.5) / scale}
							/>
						{:else}
							<!-- Fence line -->
							<line
								x1={obstacle.x - obstacle.width / 2}
								y1={obstacle.y}
								x2={obstacle.x + obstacle.width / 2}
								y2={obstacle.y}
								stroke={isSelected ? '#0066cc' : visual.fill}
								stroke-width={0.5}
								stroke-linecap="round"
							/>
						{/if}

						<!-- Label -->
						<text
							x={obstacle.x}
							y={obstacle.y - obstacle.width / 2 - 1}
							text-anchor="middle"
							font-size={1}
							fill="#374151"
							transform="scale(1, -1)"
							transform-origin="{obstacle.x} {obstacle.y - obstacle.width / 2 - 1}"
						>
							{obstacle.label}
						</text>
					</g>
				{/each}

				<!-- Observation point (center) -->
				<circle cx="0" cy="0" r={0.8} fill="#dc2626" stroke="#b91c1c" stroke-width={0.2} />
				<text
					x="0"
					y="-2"
					text-anchor="middle"
					font-size={1.2}
					fill="#dc2626"
					transform="scale(1, -1)"
					transform-origin="0 -2"
				>
					You
				</text>

				<!-- Slope direction arrow (points downhill) -->
				{#if slope.angle >= 0.5}
					{@const arrow = slopeArrow()}
					{@const headLen = 1.5}
					{@const headAngle = Math.atan2(arrow.y, arrow.x)}
					<g class="slope-arrow">
						<line
							x1="0"
							y1="0"
							x2={arrow.x}
							y2={arrow.y}
							stroke="#8b4513"
							stroke-width={0.4}
							stroke-dasharray="1 0.5"
							stroke-opacity="0.6"
						/>
						<!-- Arrowhead -->
						<polygon
							points="{arrow.x},{arrow.y}
								{arrow.x - headLen * Math.cos(headAngle - 0.4)},{arrow.y - headLen * Math.sin(headAngle - 0.4)}
								{arrow.x - headLen * Math.cos(headAngle + 0.4)},{arrow.y - headLen * Math.sin(headAngle + 0.4)}"
							fill="#8b4513"
							fill-opacity="0.6"
						/>
						<!-- Label at arrow tip -->
						<text
							x={arrow.x * 1.15}
							y={arrow.y * 1.15}
							text-anchor="middle"
							font-size={1}
							fill="#8b4513"
							transform="scale(1, -1)"
							transform-origin="{arrow.x * 1.15} {arrow.y * 1.15}"
						>
							{slope.angle}° downhill
						</text>
					</g>
				{/if}
			</g>

			<!-- Compass rose (fixed to screen coordinates) -->
			<g class="compass" transform="translate({width - 50}, 50)">
				<circle cx="0" cy="0" r="20" fill="white" fill-opacity="0.9" stroke="#d1d5db" />
				<polygon points="0,-16 -4,-4 0,-8 4,-4" fill="#dc2626" />
				<polygon points="0,16 -4,4 0,8 4,4" fill="#374151" />
				<text x="0" y="-22" text-anchor="middle" font-size="10" fill="#374151" font-weight="bold">
					N
				</text>
			</g>

			<!-- Scale bar (fixed to screen coordinates) -->
			<g class="scale-bar" transform="translate(20, {height - 20})">
				<line x1="0" y1="0" x2={scale * 5} y2="0" stroke="#374151" stroke-width="2" />
				<line x1="0" y1="-5" x2="0" y2="5" stroke="#374151" stroke-width="2" />
				<line x1={scale * 5} y1="-5" x2={scale * 5} y2="5" stroke="#374151" stroke-width="2" />
				<text x={scale * 2.5} y="-8" text-anchor="middle" font-size="12" fill="#374151">5m</text>
			</g>
		</svg>
	</div>

	<!-- Selection panel -->
	{#if selectedObstacle}
		<div class="selection-panel">
			<div class="panel-header">
				<span class="panel-title">{selectedObstacle.label}</span>
				<button type="button" class="close-btn" onclick={() => (selectedId = null)}>×</button>
			</div>
			<div class="panel-body">
				<div class="property-row">
					<label for="obstacle-label">Label:</label>
					<input
						id="obstacle-label"
						type="text"
						value={selectedObstacle.label}
						onchange={(e) =>
							updateObstacleDimensions(selectedObstacle.id, {
								label: (e.target as HTMLInputElement).value
							})}
					/>
				</div>
				<div class="property-row">
					<label for="obstacle-height">Height (m):</label>
					<input
						id="obstacle-height"
						type="number"
						min="0.5"
						max="50"
						step="0.5"
						value={selectedObstacle.height}
						onchange={(e) =>
							updateObstacleDimensions(selectedObstacle.id, {
								height: parseFloat((e.target as HTMLInputElement).value)
							})}
					/>
				</div>
				<div class="property-row">
					<label for="obstacle-width">Width (m):</label>
					<input
						id="obstacle-width"
						type="number"
						min="0.5"
						max="50"
						step="0.5"
						value={selectedObstacle.width}
						onchange={(e) =>
							updateObstacleDimensions(selectedObstacle.id, {
								width: parseFloat((e.target as HTMLInputElement).value)
							})}
					/>
				</div>
				<div class="property-info">
					<span>Direction: {selectedObstacle.direction.toFixed(0)}°</span>
					<span>Distance: {selectedObstacle.distance.toFixed(1)}m</span>
				</div>
				<button
					type="button"
					class="delete-btn"
					onclick={() => deleteObstacle(selectedObstacle.id)}
				>
					Delete obstacle
				</button>
			</div>
		</div>
	{/if}

	{#if placementMode}
		<div class="placement-hint">Click on the canvas to place a {placementMode.replace('-', ' ')}</div>
	{/if}
</div>

<style>
	.plot-editor {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		font-family: system-ui, -apple-system, sans-serif;
		position: relative;
	}

	.toolbar {
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: 1rem;
		padding: 0.5rem;
		background: #f5f5f4;
		border-radius: 6px;
	}

	.palette {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		flex-wrap: wrap;
	}

	.palette-label {
		font-size: 0.875rem;
		color: #57534e;
		font-weight: 500;
	}

	.palette-btn {
		padding: 0.375rem 0.75rem;
		background: white;
		border: 1px solid #d6d3d1;
		border-radius: 4px;
		font-size: 0.875rem;
		cursor: pointer;
		transition: all 0.15s;
	}

	.palette-btn:hover {
		background: #fafaf9;
		border-color: #a8a29e;
	}

	.palette-btn.active {
		background: #0066cc;
		border-color: #0066cc;
		color: white;
	}

	.view-controls {
		display: flex;
		gap: 0.25rem;
	}

	.view-btn {
		padding: 0.375rem 0.625rem;
		background: white;
		border: 1px solid #d6d3d1;
		border-radius: 4px;
		font-size: 0.875rem;
		cursor: pointer;
		min-width: 2rem;
	}

	.view-btn:hover {
		background: #fafaf9;
	}

	.slope-controls {
		display: flex;
		flex-direction: column;
		gap: 0.375rem;
		padding: 0.5rem;
		background: #fefce8;
		border: 1px solid #fde047;
		border-radius: 6px;
	}

	.slope-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: 0.5rem;
	}

	.slope-label {
		font-size: 0.875rem;
		font-weight: 500;
		color: #854d0e;
	}

	.slope-desc {
		font-size: 0.8125rem;
		color: #a16207;
	}

	.slope-inputs {
		display: flex;
		gap: 1rem;
		align-items: center;
		flex-wrap: wrap;
	}

	.slope-input-group {
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}

	.slope-input-group label {
		font-size: 0.8125rem;
		color: #78716c;
		white-space: nowrap;
	}

	.slope-input-group input[type='range'] {
		width: 80px;
		accent-color: #a16207;
	}

	.slope-value {
		font-size: 0.8125rem;
		color: #854d0e;
		min-width: 2rem;
	}

	.compass-picker {
		display: flex;
		gap: 0.125rem;
	}

	.compass-btn {
		padding: 0.25rem 0.375rem;
		background: white;
		border: 1px solid #e5e7eb;
		border-radius: 3px;
		font-size: 0.75rem;
		cursor: pointer;
		transition: all 0.15s;
		min-width: 1.75rem;
	}

	.compass-btn:hover {
		background: #fef9c3;
		border-color: #fde047;
	}

	.compass-btn.active {
		background: #fde047;
		border-color: #eab308;
		color: #854d0e;
		font-weight: 500;
	}

	.slope-overlay {
		pointer-events: none;
	}

	.slope-arrow {
		pointer-events: none;
	}

	.canvas-container {
		position: relative;
		border: 1px solid #d6d3d1;
		border-radius: 6px;
		overflow: hidden;
		min-height: 400px;
		flex: 1;
	}

	svg {
		display: block;
		width: 100%;
		height: 100%;
		min-height: 400px;
		cursor: grab;
		user-select: none;
	}

	svg:active {
		cursor: grabbing;
	}

	svg.placing {
		cursor: crosshair;
	}

	.obstacle {
		cursor: move;
	}

	.obstacle.selected {
		filter: drop-shadow(0 0 4px rgba(0, 102, 204, 0.5));
	}

	.selection-panel {
		position: absolute;
		top: 3.5rem;
		right: 0.5rem;
		width: 220px;
		background: white;
		border: 1px solid #d6d3d1;
		border-radius: 6px;
		box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
		z-index: 10;
	}

	.panel-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 0.5rem 0.75rem;
		border-bottom: 1px solid #e7e5e4;
		background: #fafaf9;
		border-radius: 6px 6px 0 0;
	}

	.panel-title {
		font-weight: 500;
		font-size: 0.9375rem;
		color: #1c1917;
	}

	.close-btn {
		background: none;
		border: none;
		font-size: 1.25rem;
		color: #78716c;
		cursor: pointer;
		padding: 0;
		line-height: 1;
	}

	.close-btn:hover {
		color: #1c1917;
	}

	.panel-body {
		padding: 0.75rem;
		display: flex;
		flex-direction: column;
		gap: 0.625rem;
	}

	.property-row {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
	}

	.property-row label {
		font-size: 0.8125rem;
		color: #57534e;
	}

	.property-row input {
		padding: 0.375rem 0.5rem;
		border: 1px solid #d6d3d1;
		border-radius: 4px;
		font-size: 0.875rem;
	}

	.property-row input:focus {
		outline: none;
		border-color: #0066cc;
		box-shadow: 0 0 0 2px rgba(0, 102, 204, 0.15);
	}

	.property-info {
		display: flex;
		gap: 1rem;
		font-size: 0.8125rem;
		color: #78716c;
		padding-top: 0.25rem;
	}

	.delete-btn {
		margin-top: 0.5rem;
		padding: 0.5rem;
		background: #fef2f2;
		border: 1px solid #fecaca;
		border-radius: 4px;
		color: #dc2626;
		font-size: 0.875rem;
		cursor: pointer;
	}

	.delete-btn:hover {
		background: #fee2e2;
	}

	.placement-hint {
		position: absolute;
		bottom: 1rem;
		left: 50%;
		transform: translateX(-50%);
		padding: 0.5rem 1rem;
		background: rgba(0, 102, 204, 0.9);
		color: white;
		border-radius: 4px;
		font-size: 0.875rem;
		pointer-events: none;
	}
</style>
