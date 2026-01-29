<script lang="ts">
	/**
	 * Isometric view component for visualizing plot obstacles and shadows in 3D.
	 *
	 * This component renders the same plot data as PlotEditor but uses an isometric
	 * projection to show a pseudo-3D scene. Obstacles display their actual heights,
	 * terrain slope appears as a tilted ground plane, and shadows project onto
	 * the ground as semi-transparent polygons.
	 *
	 * The view is read-only - for editing obstacles, use PlotEditor instead.
	 */

	import type { PlotObstacle } from '$lib/components/PlotEditor.svelte';
	import type { PlotSlope } from '$lib/solar/slope';
	import type { SolarPosition } from '$lib/solar/types';
	import type { ShadowPolygon, Point } from '$lib/solar/shadow-projection';

	interface IsometricViewProps {
		obstacles?: PlotObstacle[];
		slope?: PlotSlope;
		shadows?: ShadowPolygon[];
		sunPosition?: SolarPosition | null;
	}

	let {
		obstacles = [],
		slope = { angle: 0, aspect: 180 },
		shadows = [],
		sunPosition = null
	}: IsometricViewProps = $props();

	// View state for pan and zoom
	let scale = $state(8); // pixels per meter
	let panX = $state(0);
	let panY = $state(0);

	// Canvas dimensions
	let width = $state(600);
	let height = $state(400);
	let svgElement: SVGSVGElement | undefined = $state();

	// Computed center offset to keep view centered
	const centerX = $derived(width / 2);
	const centerY = $derived(height / 2 + 50); // Offset down to show ground better

	// Panning state
	let panning = $state(false);
	let panStart = $state({ x: 0, y: 0, panX: 0, panY: 0 });

	// Isometric projection constants
	// Standard isometric uses 30 degree angle from horizontal
	const COS30 = Math.cos(Math.PI / 6); // ~0.866
	const SIN30 = 0.5;

	/**
	 * Converts world coordinates (x, y, z) to isometric screen coordinates.
	 * X is east in world space, Y is north, Z is up.
	 * The projection creates the classic "3/4 view" appearance.
	 */
	function toIso(x: number, y: number, z: number = 0): { x: number; y: number } {
		// Standard isometric: rotate 45 deg around Z, then tilt down 35.264 deg
		// Simplified to: screenX = cos(30) * (x - y), screenY = sin(30) * (x + y) - z
		return {
			x: COS30 * (x - y) * scale + centerX + panX,
			y: SIN30 * (x + y) * scale - z * scale + centerY + panY
		};
	}

	/**
	 * Converts a Point (x, y) with optional z to isometric coordinates.
	 */
	function pointToIso(p: Point, z: number = 0): { x: number; y: number } {
		return toIso(p.x, p.y, z);
	}

	/**
	 * Converts screen coordinates back to world coordinates on the ground plane (z=0).
	 */
	function screenToWorld(screenX: number, screenY: number): { x: number; y: number } {
		const adjX = (screenX - centerX - panX) / scale;
		const adjY = (screenY - centerY - panY) / scale;

		// Inverse isometric transform
		const worldX = (adjY / SIN30 + adjX / COS30) / 2;
		const worldY = (adjY / SIN30 - adjX / COS30) / 2;
		return { x: worldX, y: worldY };
	}

	/**
	 * Sorts obstacles for correct back-to-front rendering.
	 * In isometric projection, objects with higher (x + y) are closer to camera.
	 */
	const sortedObstacles = $derived(
		[...obstacles].sort((a, b) => (a.x + a.y) - (b.x + b.y))
	);

	/**
	 * Ground plane vertices defining the visible plot area.
	 * The ground tilts based on slope angle and aspect.
	 */
	const groundPlaneSize = 40; // meters in each direction from center

	const groundVertices = $derived(() => {
		const half = groundPlaneSize / 2;
		// Corners in world space: NW, NE, SE, SW (going clockwise from top-left in plan view)
		const corners: Array<{ x: number; y: number; z: number }> = [
			{ x: -half, y: half, z: 0 },  // NW
			{ x: half, y: half, z: 0 },   // NE
			{ x: half, y: -half, z: 0 },  // SE
			{ x: -half, y: -half, z: 0 }  // SW
		];

		// Apply slope: z = -sin(slope) * (x*sin(aspect) + y*cos(aspect))
		// Slope aspect is the downhill direction, so the terrain drops in that direction
		if (slope.angle >= 0.5) {
			const slopeRad = slope.angle * (Math.PI / 180);
			const aspectRad = slope.aspect * (Math.PI / 180);
			const dropPerMeter = Math.sin(slopeRad);

			for (const c of corners) {
				// Distance in the aspect direction determines z drop
				const aspectDist = c.x * Math.sin(aspectRad) + c.y * Math.cos(aspectRad);
				c.z = -dropPerMeter * aspectDist;
			}
		}

		// Convert to screen coordinates
		return corners.map(c => toIso(c.x, c.y, c.z));
	});

	/**
	 * Generates the SVG points string for a polygon from screen coordinates.
	 */
	function pointsString(pts: Array<{ x: number; y: number }>): string {
		return pts.map(p => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
	}

	/**
	 * Returns visual properties for rendering an obstacle based on its type.
	 */
	function getObstacleColors(type: string): { fill: string; stroke: string; trunk: string } {
		switch (type) {
			case 'deciduous-tree':
				return { fill: '#22c55e', stroke: '#15803d', trunk: '#8b4513' };
			case 'evergreen-tree':
				return { fill: '#166534', stroke: '#14532d', trunk: '#5d4037' };
			case 'building':
				return { fill: '#94a3b8', stroke: '#475569', trunk: '#475569' };
			case 'fence':
				return { fill: '#a16207', stroke: '#854d0e', trunk: '#854d0e' };
			case 'hedge':
				return { fill: '#4ade80', stroke: '#22c55e', trunk: '#22c55e' };
			default:
				return { fill: '#9ca3af', stroke: '#6b7280', trunk: '#6b7280' };
		}
	}

	/**
	 * Renders a tree obstacle as a trunk with a spherical canopy.
	 * The trunk is a vertical line, and the canopy is an ellipse.
	 */
	function renderTree(obstacle: PlotObstacle): {
		trunk: { base: { x: number; y: number }; top: { x: number; y: number } };
		canopy: { center: { x: number; y: number }; rx: number; ry: number };
	} {
		const canopyRadius = obstacle.width / 2;
		const trunkHeight = Math.max(0, obstacle.height - canopyRadius);
		const canopyCenter = obstacle.height - canopyRadius;

		const base = toIso(obstacle.x, obstacle.y, 0);
		const trunkTop = toIso(obstacle.x, obstacle.y, trunkHeight);
		const canopyCenterIso = toIso(obstacle.x, obstacle.y, canopyCenter);

		// Canopy ellipse: circular in world space becomes ellipse in isometric
		// Width is along the (1, -1) diagonal, height is along (1, 1) diagonal
		return {
			trunk: { base, top: trunkTop },
			canopy: {
				center: canopyCenterIso,
				rx: canopyRadius * scale * COS30,
				ry: canopyRadius * scale * SIN30
			}
		};
	}

	/**
	 * Renders a building obstacle as an extruded box.
	 * Returns the visible faces (top, left side, right side) as polygons.
	 */
	function renderBuilding(obstacle: PlotObstacle): {
		top: Array<{ x: number; y: number }>;
		leftFace: Array<{ x: number; y: number }>;
		rightFace: Array<{ x: number; y: number }>;
	} {
		const halfWidth = obstacle.width / 2;
		const depth = 3; // Buildings have some depth for visual appearance
		const h = obstacle.height;

		// Building footprint corners
		const corners = {
			frontLeft: { x: obstacle.x - halfWidth, y: obstacle.y - depth / 2 },
			frontRight: { x: obstacle.x + halfWidth, y: obstacle.y - depth / 2 },
			backLeft: { x: obstacle.x - halfWidth, y: obstacle.y + depth / 2 },
			backRight: { x: obstacle.x + halfWidth, y: obstacle.y + depth / 2 }
		};

		// Top face (parallelogram at height h)
		const top = [
			toIso(corners.backLeft.x, corners.backLeft.y, h),
			toIso(corners.backRight.x, corners.backRight.y, h),
			toIso(corners.frontRight.x, corners.frontRight.y, h),
			toIso(corners.frontLeft.x, corners.frontLeft.y, h)
		];

		// Left face (visible from camera)
		const leftFace = [
			toIso(corners.frontLeft.x, corners.frontLeft.y, 0),
			toIso(corners.frontLeft.x, corners.frontLeft.y, h),
			toIso(corners.backLeft.x, corners.backLeft.y, h),
			toIso(corners.backLeft.x, corners.backLeft.y, 0)
		];

		// Right face (front face from camera's perspective)
		const rightFace = [
			toIso(corners.frontLeft.x, corners.frontLeft.y, 0),
			toIso(corners.frontLeft.x, corners.frontLeft.y, h),
			toIso(corners.frontRight.x, corners.frontRight.y, h),
			toIso(corners.frontRight.x, corners.frontRight.y, 0)
		];

		return { top, leftFace, rightFace };
	}

	/**
	 * Renders a fence as a thin extruded wall.
	 */
	function renderFence(obstacle: PlotObstacle): {
		face: Array<{ x: number; y: number }>;
		top: Array<{ x: number; y: number }>;
	} {
		const halfWidth = obstacle.width / 2;
		const h = obstacle.height;

		// Fence runs perpendicular to the direction from origin
		const perpAngle = (obstacle.direction + 90) * (Math.PI / 180);
		const dx = halfWidth * Math.sin(perpAngle);
		const dy = halfWidth * Math.cos(perpAngle);

		const start = { x: obstacle.x - dx, y: obstacle.y - dy };
		const end = { x: obstacle.x + dx, y: obstacle.y + dy };

		// Face (vertical wall)
		const face = [
			toIso(start.x, start.y, 0),
			toIso(start.x, start.y, h),
			toIso(end.x, end.y, h),
			toIso(end.x, end.y, 0)
		];

		// Top edge
		const top = [
			toIso(start.x, start.y, h),
			toIso(end.x, end.y, h)
		];

		return { face, top };
	}

	/**
	 * Converts a shadow polygon from world coordinates to screen coordinates.
	 */
	function shadowToScreen(shadow: ShadowPolygon): Array<{ x: number; y: number }> {
		return shadow.vertices.map(v => pointToIso(v, 0));
	}

	/**
	 * Handles mouse wheel for zooming.
	 */
	function handleWheel(event: WheelEvent): void {
		event.preventDefault();
		const zoomFactor = event.deltaY > 0 ? 0.9 : 1.1;
		const newScale = Math.max(2, Math.min(30, scale * zoomFactor));

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
		const screenAfter = toIso(worldBefore.x, worldBefore.y, 0);

		// Adjust pan to keep world point under pointer
		panX += pointerX - screenAfter.x;
		panY += pointerY - screenAfter.y;
	}

	/**
	 * Starts panning the view.
	 */
	function startPan(event: PointerEvent): void {
		panning = true;
		panStart = { x: event.clientX, y: event.clientY, panX, panY };
	}

	/**
	 * Handles pointer move for panning.
	 */
	function handlePointerMove(event: PointerEvent): void {
		if (panning) {
			const dx = event.clientX - panStart.x;
			const dy = event.clientY - panStart.y;
			panX = panStart.panX + dx;
			panY = panStart.panY + dy;
		}
	}

	/**
	 * Ends panning.
	 */
	function handlePointerUp(): void {
		panning = false;
	}

	/**
	 * Resets the view to default position and zoom.
	 */
	function resetView(): void {
		scale = 8;
		panX = 0;
		panY = 0;
	}

	// Calculate sun direction indicator position
	const sunIndicator = $derived(() => {
		if (!sunPosition || sunPosition.altitude <= 0) return null;

		// Sun direction arrow showing where light comes from
		const azRad = sunPosition.azimuth * (Math.PI / 180);
		const distance = 25; // meters from center
		const sunX = distance * Math.sin(azRad);
		const sunY = distance * Math.cos(azRad);

		// Place sun indicator at edge of visible area, elevated
		const altitude = sunPosition.altitude;
		const sunZ = distance * Math.tan(altitude * (Math.PI / 180));

		return {
			position: toIso(sunX, sunY, Math.min(sunZ, 30)),
			altitude: Math.round(sunPosition.altitude),
			azimuth: Math.round(sunPosition.azimuth)
		};
	});

	// Observation point positions (computed for use in template)
	const obsPoint = $derived(toIso(0, 0, 0));
	const obsTop = $derived(toIso(0, 0, 2));

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

<div class="isometric-view">
	<div class="toolbar">
		<div class="view-info">
			<span class="view-label">Isometric View</span>
			{#if sunPosition && sunPosition.altitude > 0}
				<span class="sun-info">
					Sun: {Math.round(sunPosition.altitude)}° alt, {Math.round(sunPosition.azimuth)}° az
				</span>
			{:else}
				<span class="sun-info no-sun">Sun below horizon</span>
			{/if}
		</div>
		<div class="view-controls">
			<button type="button" class="view-btn" onclick={() => (scale = Math.min(30, scale * 1.25))}>
				+
			</button>
			<button type="button" class="view-btn" onclick={() => (scale = Math.max(2, scale * 0.8))}>
				-
			</button>
			<button type="button" class="view-btn" onclick={resetView}>Reset</button>
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
			tabindex="0"
			role="img"
			aria-label="Isometric view of plot with obstacles and shadows"
		>
			<!-- Sky gradient background -->
			<defs>
				<linearGradient id="sky-gradient" x1="0%" y1="0%" x2="0%" y2="100%">
					<stop offset="0%" stop-color="#87ceeb" />
					<stop offset="100%" stop-color="#e0f4ff" />
				</linearGradient>
				<linearGradient id="ground-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
					<stop offset="0%" stop-color="#c7d2c7" />
					<stop offset="100%" stop-color="#a8b5a8" />
				</linearGradient>
			</defs>

			<rect x="0" y="0" {width} {height} fill="url(#sky-gradient)" />

			<!-- Ground plane -->
			<polygon
				points={pointsString(groundVertices())}
				fill="url(#ground-gradient)"
				stroke="#94a3a0"
				stroke-width="1"
			/>

			<!-- Grid lines on ground plane (in world coordinates, projected) -->
			<g class="grid-lines" opacity="0.3">
				{#each Array.from({ length: 9 }, (_, i) => (i - 4) * 10) as offset}
					<!-- Lines parallel to Y axis (N-S) -->
					{@const start = toIso(offset, -groundPlaneSize / 2, 0)}
					{@const end = toIso(offset, groundPlaneSize / 2, 0)}
					<line
						x1={start.x}
						y1={start.y}
						x2={end.x}
						y2={end.y}
						stroke="#6b7280"
						stroke-width={offset === 0 ? 1.5 : 0.5}
					/>

					<!-- Lines parallel to X axis (E-W) -->
					{@const start2 = toIso(-groundPlaneSize / 2, offset, 0)}
					{@const end2 = toIso(groundPlaneSize / 2, offset, 0)}
					<line
						x1={start2.x}
						y1={start2.y}
						x2={end2.x}
						y2={end2.y}
						stroke="#6b7280"
						stroke-width={offset === 0 ? 1.5 : 0.5}
					/>
				{/each}
			</g>

			<!-- Shadow polygons (render before obstacles for correct layering) -->
			{#each shadows as shadow (shadow.obstacleId)}
				{@const screenVertices = shadowToScreen(shadow)}
				<polygon
					points={pointsString(screenVertices)}
					fill="rgba(0, 0, 0, {shadow.shadeIntensity * 0.4})"
					stroke="none"
				/>
			{/each}

			<!-- Obstacles (sorted back-to-front) -->
			{#each sortedObstacles as obstacle (obstacle.id)}
				{@const colors = getObstacleColors(obstacle.type)}
				<g class="obstacle" aria-label="{obstacle.label}">
					{#if obstacle.type === 'deciduous-tree' || obstacle.type === 'evergreen-tree'}
						{@const tree = renderTree(obstacle)}
						<!-- Trunk -->
						<line
							x1={tree.trunk.base.x}
							y1={tree.trunk.base.y}
							x2={tree.trunk.top.x}
							y2={tree.trunk.top.y}
							stroke={colors.trunk}
							stroke-width={Math.max(2, 0.3 * scale)}
							stroke-linecap="round"
						/>
						<!-- Canopy (ellipse for sphere in isometric) -->
						<ellipse
							cx={tree.canopy.center.x}
							cy={tree.canopy.center.y}
							rx={tree.canopy.rx}
							ry={tree.canopy.ry}
							fill={colors.fill}
							fill-opacity="0.85"
							stroke={colors.stroke}
							stroke-width="1.5"
						/>
						<!-- Canopy highlight for 3D effect -->
						<ellipse
							cx={tree.canopy.center.x - tree.canopy.rx * 0.2}
							cy={tree.canopy.center.y - tree.canopy.ry * 0.3}
							rx={tree.canopy.rx * 0.3}
							ry={tree.canopy.ry * 0.3}
							fill="rgba(255,255,255,0.2)"
						/>
					{:else if obstacle.type === 'building'}
						{@const building = renderBuilding(obstacle)}
						<!-- Left face (darker) -->
						<polygon
							points={pointsString(building.leftFace)}
							fill={colors.fill}
							fill-opacity="0.7"
							stroke={colors.stroke}
							stroke-width="1"
						/>
						<!-- Right/front face (lighter) -->
						<polygon
							points={pointsString(building.rightFace)}
							fill={colors.fill}
							fill-opacity="0.9"
							stroke={colors.stroke}
							stroke-width="1"
						/>
						<!-- Top face (lightest) -->
						<polygon
							points={pointsString(building.top)}
							fill={colors.fill}
							stroke={colors.stroke}
							stroke-width="1"
						/>
					{:else if obstacle.type === 'fence' || obstacle.type === 'hedge'}
						{@const fence = renderFence(obstacle)}
						<!-- Face -->
						<polygon
							points={pointsString(fence.face)}
							fill={colors.fill}
							fill-opacity={obstacle.type === 'hedge' ? 0.7 : 0.9}
							stroke={colors.stroke}
							stroke-width="1"
						/>
						<!-- Top edge highlight -->
						<line
							x1={fence.top[0].x}
							y1={fence.top[0].y}
							x2={fence.top[1].x}
							y2={fence.top[1].y}
							stroke={colors.stroke}
							stroke-width="2"
							stroke-linecap="round"
						/>
					{/if}
				</g>
			{/each}

			<!-- Observation point marker -->
			<g class="observation-point">
				<circle
					cx={obsPoint.x}
					cy={obsPoint.y}
					r={6}
					fill="#dc2626"
					stroke="#b91c1c"
					stroke-width="2"
				/>
				<!-- Vertical pole for visibility -->
				<line
					x1={obsPoint.x}
					y1={obsPoint.y}
					x2={obsTop.x}
					y2={obsTop.y}
					stroke="#dc2626"
					stroke-width="2"
				/>
				<circle
					cx={obsTop.x}
					cy={obsTop.y}
					r={4}
					fill="#dc2626"
					stroke="#fca5a5"
					stroke-width="1"
				/>
			</g>

			<!-- Sun indicator (when sun is up) -->
			{#if sunIndicator()}
				{@const sun = sunIndicator()}
				{#if sun}
					<g class="sun-indicator">
						<circle
							cx={sun.position.x}
							cy={sun.position.y}
							r={12}
							fill="#fbbf24"
							stroke="#f59e0b"
							stroke-width="2"
						/>
						<!-- Sun rays -->
						{#each Array.from({ length: 8 }, (_, i) => i * 45) as angle}
							{@const rad = angle * (Math.PI / 180)}
							<line
								x1={sun.position.x + 14 * Math.cos(rad)}
								y1={sun.position.y + 14 * Math.sin(rad)}
								x2={sun.position.x + 20 * Math.cos(rad)}
								y2={sun.position.y + 20 * Math.sin(rad)}
								stroke="#f59e0b"
								stroke-width="2"
								stroke-linecap="round"
							/>
						{/each}
					</g>
				{/if}
			{/if}

			<!-- Compass rose (fixed to screen) -->
			<g class="compass" transform="translate({width - 50}, 50)">
				<circle cx="0" cy="0" r="22" fill="rgba(255,255,255,0.9)" stroke="#d1d5db" stroke-width="1" />
				<!-- North arrow (standard orientation for compass) -->
				<polygon
					points="0,-16 -4,-4 0,-8 4,-4"
					fill="#dc2626"
				/>
				<polygon
					points="0,16 -4,4 0,8 4,4"
					fill="#374151"
				/>
				<text x="0" y="-26" text-anchor="middle" font-size="11" fill="#374151" font-weight="bold">
					N
				</text>
			</g>

			<!-- Scale indicator -->
			<g class="scale-bar" transform="translate(20, {height - 25})">
				<line x1="0" y1="0" x2={scale * 5} y2="0" stroke="#374151" stroke-width="2" />
				<line x1="0" y1="-4" x2="0" y2="4" stroke="#374151" stroke-width="2" />
				<line x1={scale * 5} y1="-4" x2={scale * 5} y2="4" stroke="#374151" stroke-width="2" />
				<text x={scale * 2.5} y="-8" text-anchor="middle" font-size="11" fill="#374151">5m</text>
			</g>

			<!-- Slope indicator -->
			{#if slope.angle >= 0.5}
				<g class="slope-info" transform="translate(20, 30)">
					<rect x="-5" y="-15" width="120" height="22" fill="rgba(255,255,255,0.85)" rx="4" />
					<text x="0" y="0" font-size="11" fill="#854d0e">
						Slope: {slope.angle}° {getCompassDirection(slope.aspect)}
					</text>
				</g>
			{/if}
		</svg>
	</div>
</div>

<script lang="ts" module>
	/**
	 * Converts a compass bearing to a direction label.
	 */
	function getCompassDirection(bearing: number): string {
		const directions = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
		const index = Math.round(bearing / 45) % 8;
		return directions[index];
	}
</script>

<style>
	.isometric-view {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		font-family: system-ui, -apple-system, sans-serif;
		height: 100%;
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

	.view-info {
		display: flex;
		align-items: center;
		gap: 1rem;
	}

	.view-label {
		font-weight: 500;
		font-size: 0.9375rem;
		color: #1c1917;
	}

	.sun-info {
		font-size: 0.8125rem;
		color: #57534e;
	}

	.sun-info.no-sun {
		color: #9ca3af;
		font-style: italic;
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

	.canvas-container {
		position: relative;
		border: 1px solid #d6d3d1;
		border-radius: 6px;
		overflow: hidden;
		flex: 1;
		min-height: 400px;
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

	.obstacle {
		pointer-events: none;
	}

	.compass {
		pointer-events: none;
	}

	.scale-bar {
		pointer-events: none;
	}

	.slope-info {
		pointer-events: none;
	}

	.sun-indicator {
		pointer-events: none;
	}

	.observation-point {
		pointer-events: none;
	}

	.grid-lines {
		pointer-events: none;
	}
</style>
