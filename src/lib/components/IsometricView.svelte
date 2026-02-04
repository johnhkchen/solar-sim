<script lang="ts">
	/**
	 * Isometric view component for visualizing plot obstacles and shadows in 3D.
	 *
	 * This component renders the same plot data as PlotEditor but uses an isometric
	 * projection to show a pseudo-3D scene. Obstacles display their actual heights,
	 * terrain slope appears as a tilted ground plane, and shadows project onto
	 * the ground as semi-transparent polygons.
	 *
	 * Optionally displays a sun exposure heatmap on the ground plane, showing
	 * average sun hours across an analysis period. This helps users visualize
	 * which areas receive the most light for gardening decisions.
	 *
	 * The view is read-only - for editing obstacles, use PlotEditor instead.
	 */

	import type { PlotObstacle } from '$lib/components/PlotEditor.svelte';
	import type { PlotSlope } from '$lib/solar/slope';
	import type { SolarPosition } from '$lib/solar/types';
	import type { ShadowPolygon, Point } from '$lib/solar/shadow-projection';
	import type { ExposureGrid } from '$lib/solar/exposure-grid';
	import { DEFAULT_COLOR_SCALE, type HeatmapColorStop } from './ExposureHeatmap.svelte';

	// Local type alias matching the exported IsometricDisplayMode
	type DisplayMode = 'shadows' | 'heatmap';

	interface IsometricViewProps {
		obstacles?: PlotObstacle[];
		slope?: PlotSlope;
		shadows?: ShadowPolygon[];
		sunPosition?: SolarPosition | null;
		exposureGrid?: ExposureGrid | null;
		displayMode?: DisplayMode;
		colorScale?: HeatmapColorStop[];
		showModeToggle?: boolean;
	}

	let {
		obstacles = [],
		slope = { angle: 0, aspect: 180 },
		shadows = [],
		sunPosition = null,
		exposureGrid = null,
		displayMode = $bindable<DisplayMode>('shadows'),
		colorScale = DEFAULT_COLOR_SCALE,
		showModeToggle = true
	}: IsometricViewProps = $props();

	// View state for pan, zoom, and rotation
	let scale = $state(8); // pixels per meter
	let panX = $state(0);
	let panY = $state(0);
	let viewRotation = $state(0); // rotation in degrees (0, 45, 90, etc.)

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
	 * View rotation rotates the entire scene around the Z axis.
	 */
	function toIso(x: number, y: number, z: number = 0): { x: number; y: number } {
		// Apply view rotation around the Z axis (in world space)
		const rotRad = viewRotation * (Math.PI / 180);
		const cosRot = Math.cos(rotRad);
		const sinRot = Math.sin(rotRad);
		const rx = x * cosRot - y * sinRot;
		const ry = x * sinRot + y * cosRot;

		// Standard isometric: rotate 45 deg around Z, then tilt down 35.264 deg
		// Simplified to: screenX = cos(30) * (x - y), screenY = sin(30) * (x + y) - z
		return {
			x: COS30 * (rx - ry) * scale + centerX + panX,
			y: SIN30 * (rx + ry) * scale - z * scale + centerY + panY
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

		// Inverse isometric transform (gives rotated coordinates)
		const rx = (adjY / SIN30 + adjX / COS30) / 2;
		const ry = (adjY / SIN30 - adjX / COS30) / 2;

		// Inverse rotation
		const rotRad = viewRotation * (Math.PI / 180);
		const cosRot = Math.cos(rotRad);
		const sinRot = Math.sin(rotRad);
		const worldX = rx * cosRot + ry * sinRot;
		const worldY = -rx * sinRot + ry * cosRot;

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

	const groundVertices = $derived.by(() => {
		const half = groundPlaneSize / 2;
		// Corners in world space: NW, NE, SE, SW (going clockwise from top-left in plan view)
		const corners: Array<{ x: number; y: number; z: number }> = [
			{ x: -half, y: half, z: 0 },  // NW
			{ x: half, y: half, z: 0 },   // NE
			{ x: half, y: -half, z: 0 },  // SE
			{ x: -half, y: -half, z: 0 }  // SW
		];

		// Apply slope: aspect is the direction the slope FACES (uphill/surface normal direction)
		// So downhill is OPPOSITE to aspect. A south-facing slope (aspect=180) drops toward north.
		// z drops as we move in the downhill direction (opposite to aspect)
		if (slope.angle >= 0.5) {
			const slopeRad = slope.angle * (Math.PI / 180);
			const aspectRad = slope.aspect * (Math.PI / 180);
			const dropPerMeter = Math.sin(slopeRad);

			for (const c of corners) {
				// Distance in the aspect (facing) direction - positive means uphill
				const aspectDist = c.x * Math.sin(aspectRad) + c.y * Math.cos(aspectRad);
				// Terrain is higher in the aspect direction, lower opposite to it
				c.z = dropPerMeter * aspectDist;
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
	 * Renders a tree obstacle as a trunk with a conical/lollipop canopy.
	 * The trunk is a vertical line, and the canopy is rendered as stacked
	 * elliptical disks that form a cone shape (larger at bottom, smaller at top).
	 */
	function renderTree(obstacle: PlotObstacle): {
		trunk: { base: { x: number; y: number }; top: { x: number; y: number } };
		canopyDisks: Array<{ center: { x: number; y: number }; rx: number; ry: number; opacity: number }>;
	} {
		const canopyRadius = obstacle.width / 2;
		const trunkHeight = Math.max(0, obstacle.height - canopyRadius * 2);
		const canopyBaseZ = trunkHeight;
		const canopyHeight = obstacle.height - trunkHeight;

		const base = toIso(obstacle.x, obstacle.y, 0);
		const trunkTop = toIso(obstacle.x, obstacle.y, trunkHeight);

		// Create multiple disks from bottom to top of canopy to form cone/lollipop shape
		// More disks at the top where it's rounder, fewer at the bottom
		const numDisks = 8;
		const canopyDisks: Array<{ center: { x: number; y: number }; rx: number; ry: number; opacity: number }> = [];

		for (let i = 0; i < numDisks; i++) {
			// Progress from 0 (bottom) to 1 (top)
			const t = i / (numDisks - 1);

			// Height of this disk
			const diskZ = canopyBaseZ + t * canopyHeight;

			// Radius varies: lollipop/cone shape - wider at bottom, narrower at top
			// Use a curve that gives a nice rounded cone appearance
			const radiusFactor = Math.cos(t * Math.PI * 0.5); // 1 at bottom, 0 at top
			const diskRadius = canopyRadius * Math.max(0.15, radiusFactor);

			const diskCenter = toIso(obstacle.x, obstacle.y, diskZ);

			canopyDisks.push({
				center: diskCenter,
				rx: diskRadius * scale * COS30,
				ry: diskRadius * scale * SIN30,
				// Lower disks are slightly more transparent to show depth
				opacity: 0.7 + t * 0.25
			});
		}

		return {
			trunk: { base, top: trunkTop },
			canopyDisks
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
	 * Resets the view to default position, zoom, and rotation.
	 */
	function resetView(): void {
		scale = 8;
		panX = 0;
		panY = 0;
		viewRotation = 0;
	}

	/**
	 * Rotates the view by 45 degrees clockwise.
	 */
	function rotateViewCW(): void {
		viewRotation = (viewRotation + 45) % 360;
	}

	/**
	 * Rotates the view by 45 degrees counter-clockwise.
	 */
	function rotateViewCCW(): void {
		viewRotation = (viewRotation - 45 + 360) % 360;
	}

	// Calculate sun direction indicator position
	// Sun is placed far from the plot to appear more realistic (small and distant)
	const sunIndicator = $derived.by(() => {
		if (!sunPosition || sunPosition.altitude <= 0) return null;

		// Sun direction arrow showing where light comes from
		const azRad = sunPosition.azimuth * (Math.PI / 180);
		const distance = 50; // meters from center - farther for realism
		const sunX = distance * Math.sin(azRad);
		const sunY = distance * Math.cos(azRad);

		// Place sun indicator at edge of visible area, elevated based on altitude
		// Higher altitude = higher in the sky (more Z offset)
		const altitude = sunPosition.altitude;
		const sunZ = distance * Math.tan(altitude * (Math.PI / 180));

		return {
			position: toIso(sunX, sunY, Math.min(sunZ, 60)),
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

	// Constants for coordinate conversion
	const METERS_PER_DEGREE_LAT = 111320;

	/**
	 * Converts a lat/lng point to world coordinates (meters from center).
	 * The center is defined by the exposure grid's center point.
	 */
	function latLngToWorld(lat: number, lng: number, gridCenterLat: number, gridCenterLng: number): { x: number; y: number } {
		const latRad = gridCenterLat * (Math.PI / 180);
		const metersPerDegreeLng = METERS_PER_DEGREE_LAT * Math.cos(latRad);

		// X is east (positive longitude), Y is north (positive latitude)
		const x = (lng - gridCenterLng) * metersPerDegreeLng;
		const y = (lat - gridCenterLat) * METERS_PER_DEGREE_LAT;

		return { x, y };
	}

	/**
	 * Interpolates between two hex colors.
	 */
	function interpolateColor(color1: string, color2: string, t: number): string {
		const r1 = parseInt(color1.slice(1, 3), 16);
		const g1 = parseInt(color1.slice(3, 5), 16);
		const b1 = parseInt(color1.slice(5, 7), 16);

		const r2 = parseInt(color2.slice(1, 3), 16);
		const g2 = parseInt(color2.slice(3, 5), 16);
		const b2 = parseInt(color2.slice(5, 7), 16);

		const r = Math.round(r1 + (r2 - r1) * t);
		const g = Math.round(g1 + (g2 - g1) * t);
		const b = Math.round(b1 + (b2 - b1) * t);

		return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
	}

	/**
	 * Gets the heatmap color for a given sun-hours value using the color scale.
	 */
	function getSunHoursColor(hours: number): string {
		const stops = colorScale;

		if (hours <= stops[0].hours) return stops[0].color;
		if (hours >= stops[stops.length - 1].hours) return stops[stops.length - 1].color;

		for (let i = 0; i < stops.length - 1; i++) {
			if (hours >= stops[i].hours && hours <= stops[i + 1].hours) {
				const t = (hours - stops[i].hours) / (stops[i + 1].hours - stops[i].hours);
				return interpolateColor(stops[i].color, stops[i + 1].color, t);
			}
		}

		return stops[stops.length - 1].color;
	}

	/**
	 * Represents a heatmap cell with isometric screen coordinates and color.
	 */
	interface HeatmapCell {
		id: string;
		corners: Array<{ x: number; y: number }>;
		color: string;
		sunHours: number;
	}

	/**
	 * Computed heatmap cells derived from the exposure grid.
	 * Converts grid cells to isometric polygons with appropriate colors.
	 * Uses a coarser resolution for isometric view to improve performance.
	 */
	const heatmapCells = $derived.by<HeatmapCell[]>(() => {
		if (!exposureGrid || displayMode !== 'heatmap') return [];

		const grid = exposureGrid;
		const { bounds, width: gridWidth, height: gridHeight, values } = grid;

		// Calculate grid center for coordinate conversion
		const centerLat = (bounds.south + bounds.north) / 2;
		const centerLng = (bounds.west + bounds.east) / 2;

		// For isometric view, we may want to use coarser resolution if grid is large
		// Skip cells to maintain performance (every 2nd cell if grid is large)
		const skipFactor = Math.max(1, Math.floor(Math.max(gridWidth, gridHeight) / 40));

		const cells: HeatmapCell[] = [];

		for (let row = 0; row < gridHeight; row += skipFactor) {
			for (let col = 0; col < gridWidth; col += skipFactor) {
				// Calculate cell bounds in lat/lng
				const latFraction = row / gridHeight;
				const lngFraction = col / gridWidth;
				const latFractionNext = Math.min(1, (row + skipFactor) / gridHeight);
				const lngFractionNext = Math.min(1, (col + skipFactor) / gridWidth);

				const south = bounds.south + latFraction * (bounds.north - bounds.south);
				const north = bounds.south + latFractionNext * (bounds.north - bounds.south);
				const west = bounds.west + lngFraction * (bounds.east - bounds.west);
				const east = bounds.west + lngFractionNext * (bounds.east - bounds.west);

				// Calculate average sun hours for this (possibly merged) cell
				let totalHours = 0;
				let count = 0;
				for (let r = row; r < Math.min(row + skipFactor, gridHeight); r++) {
					for (let c = col; c < Math.min(col + skipFactor, gridWidth); c++) {
						totalHours += values[r * gridWidth + c];
						count++;
					}
				}
				const avgHours = count > 0 ? totalHours / count : 0;

				// Convert corners to world coordinates (meters from center)
				const sw = latLngToWorld(south, west, centerLat, centerLng);
				const se = latLngToWorld(south, east, centerLat, centerLng);
				const ne = latLngToWorld(north, east, centerLat, centerLng);
				const nw = latLngToWorld(north, west, centerLat, centerLng);

				// Skip cells that are too far from the visible ground plane
				const maxDist = groundPlaneSize / 2;
				if (Math.abs(sw.x) > maxDist * 1.5 || Math.abs(sw.y) > maxDist * 1.5) continue;

				// Convert to isometric screen coordinates (on ground plane z=0)
				const corners = [
					toIso(sw.x, sw.y, 0),
					toIso(se.x, se.y, 0),
					toIso(ne.x, ne.y, 0),
					toIso(nw.x, nw.y, 0)
				];

				cells.push({
					id: `cell-${row}-${col}`,
					corners,
					color: getSunHoursColor(avgHours),
					sunHours: avgHours
				});
			}
		}

		return cells;
	});

	/**
	 * Toggles between shadow view and heatmap view.
	 */
	function toggleDisplayMode(): void {
		displayMode = displayMode === 'shadows' ? 'heatmap' : 'shadows';
	}
</script>

<div class="isometric-view">
	<div class="toolbar">
		<div class="view-info">
			<span class="view-label">Isometric View</span>
			{#if displayMode === 'shadows' && sunPosition && sunPosition.altitude > 0}
				<span class="sun-info">
					Sun: {Math.round(sunPosition.altitude)}° alt, {Math.round(sunPosition.azimuth)}° az
				</span>
			{:else if displayMode === 'shadows'}
				<span class="sun-info no-sun">Sun below horizon</span>
			{:else}
				<span class="sun-info">Exposure heatmap</span>
			{/if}
		</div>
		<div class="view-controls">
			{#if showModeToggle && exposureGrid}
				<div class="mode-toggle" role="group" aria-label="Display mode">
					<button
						type="button"
						class="mode-btn"
						class:active={displayMode === 'shadows'}
						onclick={() => (displayMode = 'shadows')}
						aria-pressed={displayMode === 'shadows'}
					>
						Shadows
					</button>
					<button
						type="button"
						class="mode-btn"
						class:active={displayMode === 'heatmap'}
						onclick={() => (displayMode = 'heatmap')}
						aria-pressed={displayMode === 'heatmap'}
					>
						Heatmap
					</button>
				</div>
			{/if}
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
				points={pointsString(groundVertices)}
				fill="url(#ground-gradient)"
				stroke="#94a3a0"
				stroke-width="1"
			/>

			<!-- Grid lines on ground plane (in world coordinates, projected) - only in shadow mode -->
			{#if displayMode === 'shadows'}
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
			{/if}

			<!-- Heatmap cells (render when in heatmap mode) -->
			{#if displayMode === 'heatmap' && heatmapCells.length > 0}
				<g class="heatmap-layer">
					{#each heatmapCells as cell (cell.id)}
						<polygon
							points={pointsString(cell.corners)}
							fill={cell.color}
							fill-opacity="0.7"
							stroke={cell.color}
							stroke-width="0.5"
							stroke-opacity="0.3"
						/>
					{/each}
				</g>
			{/if}

			<!-- Shadow polygons (render before obstacles for correct layering) - only in shadow mode -->
			{#if displayMode === 'shadows'}
				{#each shadows as shadow (shadow.obstacleId)}
					{@const screenVertices = shadowToScreen(shadow)}
					<polygon
						points={pointsString(screenVertices)}
						fill="rgba(0, 0, 0, {shadow.shadeIntensity * 0.4})"
						stroke="none"
					/>
				{/each}
			{/if}

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
						<!-- Canopy rendered as stacked disks forming a cone/lollipop shape -->
						{#each tree.canopyDisks as disk, i}
							<ellipse
								cx={disk.center.x}
								cy={disk.center.y}
								rx={disk.rx}
								ry={disk.ry}
								fill={colors.fill}
								fill-opacity={disk.opacity}
								stroke={i === tree.canopyDisks.length - 1 ? colors.stroke : 'none'}
								stroke-width="1"
							/>
						{/each}
						<!-- Top highlight for 3D effect -->
						{@const topDisk = tree.canopyDisks[tree.canopyDisks.length - 1]}
						{#if topDisk}
							<ellipse
								cx={topDisk.center.x - topDisk.rx * 0.3}
								cy={topDisk.center.y - topDisk.ry * 0.4}
								rx={topDisk.rx * 0.4}
								ry={topDisk.ry * 0.4}
								fill="rgba(255,255,255,0.25)"
							/>
						{/if}
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

			<!-- Sun indicator (when sun is up) - small and distant for realism -->
			{#if sunIndicator}
				{@const sun = sunIndicator}
				<g class="sun-indicator">
					<circle
						cx={sun.position.x}
						cy={sun.position.y}
						r={8}
						fill="#fbbf24"
						stroke="#f59e0b"
						stroke-width="1.5"
					/>
					<!-- Sun rays -->
					{#each Array.from({ length: 8 }, (_, i) => i * 45) as angle}
						{@const rad = angle * (Math.PI / 180)}
						<line
							x1={sun.position.x + 10 * Math.cos(rad)}
							y1={sun.position.y + 10 * Math.sin(rad)}
							x2={sun.position.x + 14 * Math.cos(rad)}
							y2={sun.position.y + 14 * Math.sin(rad)}
							stroke="#f59e0b"
							stroke-width="1.5"
							stroke-linecap="round"
						/>
					{/each}
				</g>
			{/if}

			<!-- Interactive compass with rotation controls -->
			<!-- Shows cardinal directions as they appear in isometric projection -->
			<g class="compass-widget" transform="translate({width - 55}, 55)">
				<!-- Outer ring with rotation buttons -->
				<circle cx="0" cy="0" r="36" fill="rgba(255,255,255,0.95)" stroke="#d1d5db" stroke-width="1" />

				<!-- CCW rotation button (left arc) -->
				<path
					d="M -25.5 -25.5 A 36 36 0 0 0 -25.5 25.5"
					fill="transparent"
					stroke="transparent"
					stroke-width="20"
					class="rotate-btn"
					onclick={rotateViewCCW}
					onkeydown={(e) => { if (e.key === 'Enter' || e.key === ' ') rotateViewCCW(); }}
					role="button"
					tabindex="0"
					aria-label="Rotate view counter-clockwise"
				/>
				<text x="-32" y="4" text-anchor="middle" font-size="14" fill="#9ca3af" class="rotate-label" style="pointer-events: none;">↺</text>

				<!-- CW rotation button (right arc) -->
				<path
					d="M 25.5 -25.5 A 36 36 0 0 1 25.5 25.5"
					fill="transparent"
					stroke="transparent"
					stroke-width="20"
					class="rotate-btn"
					onclick={rotateViewCW}
					onkeydown={(e) => { if (e.key === 'Enter' || e.key === ' ') rotateViewCW(); }}
					role="button"
					tabindex="0"
					aria-label="Rotate view clockwise"
				/>
				<text x="32" y="4" text-anchor="middle" font-size="14" fill="#9ca3af" class="rotate-label" style="pointer-events: none;">↻</text>

				<!-- Inner compass rose - directions in isometric screen space -->
				<!-- Apply view rotation: positive viewRotation rotates world CW, so compass rotates CCW -->
				<g transform="rotate({-viewRotation})">
					<!-- In isometric projection (without view rotation):
					     North (Y+) points down-left: (-COS30, SIN30) = (-0.866, 0.5)
					     East (X+) points down-right: (COS30, SIN30) = (0.866, 0.5)
					     South (Y-) points up-right: (COS30, -SIN30) = (0.866, -0.5)
					     West (X-) points up-left: (-COS30, -SIN30) = (-0.866, -0.5)
					-->

					<!-- North arrow (down-left in isometric) -->
					<line x1="0" y1="0" x2={-COS30 * 16} y2={SIN30 * 16} stroke="#dc2626" stroke-width="3" />
					<polygon
						points="{-COS30 * 20},{SIN30 * 20} {-COS30 * 13 - 2},{SIN30 * 13 - 2} {-COS30 * 13 + 2},{SIN30 * 13 + 2}"
						fill="#dc2626"
					/>
					<text x={-COS30 * 26} y={SIN30 * 26 + 3} text-anchor="middle" font-size="9" fill="#dc2626" font-weight="bold">N</text>

					<!-- East arrow (down-right in isometric) -->
					<line x1="0" y1="0" x2={COS30 * 14} y2={SIN30 * 14} stroke="#374151" stroke-width="2" />
					<text x={COS30 * 24} y={SIN30 * 24 + 3} text-anchor="middle" font-size="8" fill="#374151">E</text>

					<!-- South arrow (up-right in isometric) -->
					<line x1="0" y1="0" x2={COS30 * 12} y2={-SIN30 * 12} stroke="#9ca3af" stroke-width="1.5" />
					<text x={COS30 * 22} y={-SIN30 * 22 + 3} text-anchor="middle" font-size="8" fill="#9ca3af">S</text>

					<!-- West arrow (up-left in isometric) -->
					<line x1="0" y1="0" x2={-COS30 * 12} y2={-SIN30 * 12} stroke="#9ca3af" stroke-width="1.5" />
					<text x={-COS30 * 22} y={-SIN30 * 22 + 3} text-anchor="middle" font-size="8" fill="#9ca3af">W</text>
				</g>

				<!-- Center dot -->
				<circle cx="0" cy="0" r="3" fill="#374151" />
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

		<!-- Heatmap legend (shown when in heatmap mode) -->
		{#if displayMode === 'heatmap' && exposureGrid}
			<div class="heatmap-legend">
				<div class="legend-title">Sun Exposure</div>
				<div class="legend-scale">
					<div
						class="legend-gradient"
						style="background: linear-gradient(to right, #4a90d9, #7bc47f, #f7c948, #ff6b35);"
					></div>
					<div class="legend-labels">
						<span>0h</span>
						<span>2h</span>
						<span>4h</span>
						<span>6h+</span>
					</div>
				</div>
				<div class="legend-categories">
					<span class="cat-shade">Full shade</span>
					<span class="cat-part-shade">Part shade</span>
					<span class="cat-part-sun">Part sun</span>
					<span class="cat-full-sun">Full sun</span>
				</div>
			</div>
		{/if}
	</div>
</div>

<script lang="ts" module>
	/**
	 * Display mode for the isometric view.
	 * - 'shadows': Shows real-time shadows based on sun position
	 * - 'heatmap': Shows aggregated sun exposure as a color-coded ground overlay
	 */
	export type IsometricDisplayMode = 'shadows' | 'heatmap';

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

	.compass-widget {
		cursor: default;
	}

	.compass-widget .rotate-btn {
		cursor: pointer;
	}

	.compass-widget .rotate-btn:hover + .rotate-label {
		fill: #374151;
	}

	.compass-widget .rotate-label {
		transition: fill 0.15s ease;
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

	.heatmap-layer {
		pointer-events: none;
	}

	/* Mode toggle button group */
	.mode-toggle {
		display: flex;
		background: #e7e5e4;
		border-radius: 4px;
		padding: 2px;
		margin-right: 0.5rem;
	}

	.mode-btn {
		padding: 0.25rem 0.5rem;
		background: transparent;
		border: none;
		border-radius: 3px;
		font-size: 0.75rem;
		font-weight: 500;
		color: #57534e;
		cursor: pointer;
		transition: all 0.15s ease;
	}

	.mode-btn:hover {
		color: #1c1917;
	}

	.mode-btn.active {
		background: white;
		color: #1c1917;
		box-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);
	}

	/* Heatmap legend overlay */
	.heatmap-legend {
		position: absolute;
		bottom: 12px;
		left: 12px;
		background: rgba(255, 255, 255, 0.95);
		border: 1px solid #d6d3d1;
		border-radius: 6px;
		padding: 0.5rem 0.75rem;
		font-size: 0.75rem;
		pointer-events: none;
		max-width: 180px;
	}

	.legend-title {
		font-weight: 600;
		color: #1c1917;
		margin-bottom: 0.375rem;
	}

	.legend-scale {
		display: flex;
		flex-direction: column;
		gap: 0.125rem;
	}

	.legend-gradient {
		height: 10px;
		border-radius: 2px;
		border: 1px solid #d6d3d1;
	}

	.legend-labels {
		display: flex;
		justify-content: space-between;
		font-size: 0.625rem;
		color: #57534e;
		font-family: ui-monospace, monospace;
	}

	.legend-categories {
		display: flex;
		flex-wrap: wrap;
		gap: 0.25rem 0.5rem;
		margin-top: 0.375rem;
		font-size: 0.625rem;
	}

	.cat-shade {
		color: #2563eb;
	}

	.cat-part-shade {
		color: #16a34a;
	}

	.cat-part-sun {
		color: #ca8a04;
	}

	.cat-full-sun {
		color: #c2410c;
	}
</style>
