<script lang="ts" module>
	/**
	 * View mode for the map/plan toggle.
	 */
	export type ViewMode = 'map' | 'plan';

	/**
	 * Converts feet to meters for spacing calculations.
	 */
	export function feetToMeters(feet: number): number {
		return feet * 0.3048;
	}

	/**
	 * Converts meters to feet for display.
	 */
	export function metersToFeet(meters: number): number {
		return meters / 0.3048;
	}
</script>

<script lang="ts">
	import { onMount } from 'svelte';
	import { browser } from '$app/environment';
	import type { Zone, PlacedPlant } from './ZoneEditor.svelte';
	import { LIGHT_COLORS } from './ZoneEditor.svelte';
	import PlantMarker, { getSpacingStatus, type SpacingStatus } from './PlantMarker.svelte';
	import { getPlantById } from '$lib/plants';
	import type { Plant } from '$lib/plants';

	interface Props {
		/** Zones to render */
		zones: Zone[];
		/** Callback when zones change (plant positions updated) */
		onzoneschange?: (zones: Zone[]) => void;
		/** Selected zone ID */
		selectedZoneId?: string | null;
		/** Callback when selection changes */
		onselect?: (zoneId: string | null) => void;
		/** Grid size in meters (default 1m) */
		gridSize?: number;
		/** Whether to show grid lines */
		showGrid?: boolean;
		/** Whether to enable plant snapping to grid */
		snapToGrid?: boolean;
		/** Callback to expose SVG ref for capture */
		onsvgref?: (svg: SVGSVGElement | null) => void;
	}

	let {
		zones = [],
		onzoneschange,
		selectedZoneId = null,
		onselect,
		gridSize = 1,
		showGrid = true,
		snapToGrid = false,
		onsvgref
	}: Props = $props();

	// Canvas state
	let containerRef: HTMLDivElement;
	let svgRef: SVGSVGElement;
	let width = $state(800);
	let height = $state(600);

	// Pan and zoom state
	let viewBox = $state({ x: 0, y: 0, width: 800, height: 600 });
	let isPanning = $state(false);
	let panStart = { x: 0, y: 0 };
	let lastViewBox = { x: 0, y: 0 };

	// Drag state for plants
	let draggingPlant = $state<{
		zoneId: string;
		plantIndex: number;
		positionIndex: number;
		startX: number;
		startY: number;
	} | null>(null);

	// Selected plant state
	let selectedPlant = $state<{
		zoneId: string;
		plantIndex: number;
		positionIndex: number;
	} | null>(null);

	// Spacing issues count
	const spacingIssues = $derived.by(() => {
		let count = 0;
		for (const zone of zones) {
			for (const placed of zone.plants) {
				const plant = getPlantById(placed.plantId);
				if (!plant) continue;
				for (let i = 0; i < placed.positions.length; i++) {
					const status = calculateSpacingStatus(zone, placed, i);
					if (status !== 'valid') count++;
				}
			}
		}
		return count;
	});

	// Constants for coordinate conversion (meters per degree at mid-latitudes)
	const METERS_PER_DEGREE_LAT = 111320;

	// Compute bounds of all zones with padding
	const allBounds = $derived.by(() => {
		if (zones.length === 0) {
			return { north: 0, south: 0, east: 0, west: 0 };
		}

		let north = -90,
			south = 90,
			east = -180,
			west = 180;

		for (const zone of zones) {
			north = Math.max(north, zone.bounds.north);
			south = Math.min(south, zone.bounds.south);
			east = Math.max(east, zone.bounds.east);
			west = Math.min(west, zone.bounds.west);
		}

		// Add 10% padding
		const latPadding = (north - south) * 0.1;
		const lngPadding = (east - west) * 0.1;

		return {
			north: north + latPadding,
			south: south - latPadding,
			east: east + lngPadding,
			west: west - lngPadding
		};
	});

	// Scale factor: pixels per degree
	const scale = $derived.by(() => {
		if (zones.length === 0) return { x: 1, y: 1 };

		const latRange = allBounds.north - allBounds.south;
		const lngRange = allBounds.east - allBounds.west;

		if (latRange === 0 || lngRange === 0) return { x: 1, y: 1 };

		// Calculate center latitude for longitude correction
		const centerLat = (allBounds.north + allBounds.south) / 2;
		const cosLat = Math.cos((centerLat * Math.PI) / 180);

		// Convert to meters for aspect-correct scaling
		const latMeters = latRange * METERS_PER_DEGREE_LAT;
		const lngMeters = lngRange * METERS_PER_DEGREE_LAT * cosLat;

		// Fit to viewport with margin
		const margin = 60;
		const availableWidth = width - margin * 2;
		const availableHeight = height - margin * 2;

		const scaleX = availableWidth / lngMeters;
		const scaleY = availableHeight / latMeters;
		const uniformScale = Math.min(scaleX, scaleY);

		return {
			x: uniformScale,
			y: uniformScale,
			metersPerPixel: 1 / uniformScale,
			pixelsPerMeter: uniformScale
		};
	});

	// Convert lat/lng to canvas coordinates
	function toCanvasCoords(lat: number, lng: number): { x: number; y: number } {
		const centerLat = (allBounds.north + allBounds.south) / 2;
		const cosLat = Math.cos((centerLat * Math.PI) / 180);

		// Convert to meters from bottom-left corner
		const xMeters = (lng - allBounds.west) * METERS_PER_DEGREE_LAT * cosLat;
		const yMeters = (lat - allBounds.south) * METERS_PER_DEGREE_LAT;

		// Convert to pixels (flip Y for SVG coordinate system)
		const margin = 60;
		const x = margin + xMeters * scale.x;
		const y = height - margin - yMeters * scale.y;

		return { x, y };
	}

	// Convert canvas coordinates back to lat/lng
	function toLatLng(x: number, y: number): { lat: number; lng: number } {
		const centerLat = (allBounds.north + allBounds.south) / 2;
		const cosLat = Math.cos((centerLat * Math.PI) / 180);

		const margin = 60;
		const xMeters = (x - margin) / scale.x;
		const yMeters = (height - margin - y) / scale.y;

		const lng = allBounds.west + xMeters / (METERS_PER_DEGREE_LAT * cosLat);
		const lat = allBounds.south + yMeters / METERS_PER_DEGREE_LAT;

		return { lat, lng };
	}

	// Convert meters to pixels
	function metersToPixels(meters: number): number {
		return meters * (scale.pixelsPerMeter ?? 1);
	}

	// Generate grid lines
	const gridLines = $derived.by(() => {
		if (!showGrid || zones.length === 0) return { horizontal: [], vertical: [] };

		const horizontal: { y: number; label: string }[] = [];
		const vertical: { x: number; label: string }[] = [];

		const centerLat = (allBounds.north + allBounds.south) / 2;
		const cosLat = Math.cos((centerLat * Math.PI) / 180);

		// Calculate total dimensions in meters
		const totalWidth = (allBounds.east - allBounds.west) * METERS_PER_DEGREE_LAT * cosLat;
		const totalHeight = (allBounds.north - allBounds.south) * METERS_PER_DEGREE_LAT;

		// Generate lines every gridSize meters
		const margin = 60;
		for (let m = 0; m <= totalWidth; m += gridSize) {
			const x = margin + m * scale.x;
			vertical.push({ x, label: `${m}m` });
		}

		for (let m = 0; m <= totalHeight; m += gridSize) {
			const y = height - margin - m * scale.y;
			horizontal.push({ y, label: `${m}m` });
		}

		return { horizontal, vertical };
	});

	// Calculate scale bar dimensions
	const scaleBar = $derived.by(() => {
		if (zones.length === 0) return null;

		// Choose a nice round number for the scale bar
		const metersPerPixel = scale.metersPerPixel ?? 1;
		const targetPixelWidth = 100;
		const targetMeters = targetPixelWidth * metersPerPixel;

		// Round to a nice value (1, 2, 5, 10, 20, 50, etc.)
		const magnitude = Math.pow(10, Math.floor(Math.log10(targetMeters)));
		const normalized = targetMeters / magnitude;
		let niceValue: number;
		if (normalized < 1.5) niceValue = 1;
		else if (normalized < 3.5) niceValue = 2;
		else if (normalized < 7.5) niceValue = 5;
		else niceValue = 10;

		const meters = niceValue * magnitude;
		const pixelWidth = meters / metersPerPixel;

		return { meters, pixelWidth };
	});

	// Calculate spacing status for a plant position
	function calculateSpacingStatus(
		zone: Zone,
		placed: PlacedPlant,
		positionIndex: number
	): SpacingStatus {
		const plant = getPlantById(placed.plantId);
		if (!plant) return 'valid';

		const pos = placed.positions[positionIndex];
		// Use a default spread of 1 foot if not specified (typical for small plants)
		const spreadMeters = feetToMeters(1);
		const radius = spreadMeters / 2;

		// Check against other plants in the same zone
		let maxOverlap = 0;

		for (const otherPlaced of zone.plants) {
			const otherPlant = getPlantById(otherPlaced.plantId);
			if (!otherPlant) continue;

			const otherSpread = feetToMeters(1);
			const otherRadius = otherSpread / 2;

			for (let i = 0; i < otherPlaced.positions.length; i++) {
				// Skip self
				if (otherPlaced.plantId === placed.plantId && i === positionIndex) continue;

				const otherPos = otherPlaced.positions[i];

				// Calculate distance in meters
				const centerLat = (allBounds.north + allBounds.south) / 2;
				const cosLat = Math.cos((centerLat * Math.PI) / 180);

				const latDiff = (pos.lat - otherPos.lat) * METERS_PER_DEGREE_LAT;
				const lngDiff = (pos.lng - otherPos.lng) * METERS_PER_DEGREE_LAT * cosLat;
				const distance = Math.sqrt(latDiff * latDiff + lngDiff * lngDiff);

				const combinedRadii = radius + otherRadius;
				if (distance < combinedRadii) {
					const overlap = ((combinedRadii - distance) / combinedRadii) * 100;
					maxOverlap = Math.max(maxOverlap, overlap);
				}
			}
		}

		// Check if extending outside zone
		const { x, y } = toCanvasCoords(pos.lat, pos.lng);
		const zoneNW = toCanvasCoords(zone.bounds.north, zone.bounds.west);
		const zoneSE = toCanvasCoords(zone.bounds.south, zone.bounds.east);
		const plantPixelRadius = metersToPixels(radius);

		const extendsOutside =
			x - plantPixelRadius < zoneNW.x ||
			x + plantPixelRadius > zoneSE.x ||
			y - plantPixelRadius < zoneNW.y ||
			y + plantPixelRadius > zoneSE.y;

		if (extendsOutside) {
			return 'error';
		}

		return getSpacingStatus(maxOverlap);
	}

	// Handle pan start
	function handlePanStart(e: MouseEvent) {
		if (e.button !== 0) return; // Only left click
		if ((e.target as HTMLElement).closest('.plant-marker')) return; // Don't pan when clicking plants

		isPanning = true;
		panStart = { x: e.clientX, y: e.clientY };
		lastViewBox = { x: viewBox.x, y: viewBox.y };
	}

	// Handle pan move
	function handlePanMove(e: MouseEvent) {
		if (isPanning) {
			const dx = e.clientX - panStart.x;
			const dy = e.clientY - panStart.y;
			const scaleFactor = viewBox.width / width;
			viewBox = {
				...viewBox,
				x: lastViewBox.x - dx * scaleFactor,
				y: lastViewBox.y - dy * scaleFactor
			};
		}

		if (draggingPlant) {
			handlePlantDrag(e);
		}
	}

	// Handle pan end
	function handlePanEnd() {
		isPanning = false;
		if (draggingPlant) {
			draggingPlant = null;
		}
	}

	// Handle zoom
	function handleWheel(e: WheelEvent) {
		e.preventDefault();

		const rect = svgRef.getBoundingClientRect();
		const mouseX = e.clientX - rect.left;
		const mouseY = e.clientY - rect.top;

		// Convert mouse position to viewBox coordinates
		const viewX = viewBox.x + (mouseX / width) * viewBox.width;
		const viewY = viewBox.y + (mouseY / height) * viewBox.height;

		// Calculate zoom factor
		const zoomFactor = e.deltaY > 0 ? 1.1 : 0.9;
		const newWidth = viewBox.width * zoomFactor;
		const newHeight = viewBox.height * zoomFactor;

		// Limit zoom
		const minSize = 100;
		const maxSize = 10000;
		if (newWidth < minSize || newWidth > maxSize) return;

		// Adjust viewBox to zoom toward mouse position
		viewBox = {
			x: viewX - (mouseX / width) * newWidth,
			y: viewY - (mouseY / height) * newHeight,
			width: newWidth,
			height: newHeight
		};
	}

	// Handle plant drag
	function handlePlantDrag(e: MouseEvent) {
		if (!draggingPlant) return;

		const rect = svgRef.getBoundingClientRect();
		const mouseX = e.clientX - rect.left;
		const mouseY = e.clientY - rect.top;

		// Convert to viewBox coordinates
		const viewX = viewBox.x + (mouseX / width) * viewBox.width;
		const viewY = viewBox.y + (mouseY / height) * viewBox.height;

		// Convert to lat/lng
		let { lat, lng } = toLatLng(viewX, viewY);

		// Snap to grid if enabled
		if (snapToGrid) {
			const centerLat = (allBounds.north + allBounds.south) / 2;
			const cosLat = Math.cos((centerLat * Math.PI) / 180);

			const latMeters = (lat - allBounds.south) * METERS_PER_DEGREE_LAT;
			const lngMeters = (lng - allBounds.west) * METERS_PER_DEGREE_LAT * cosLat;

			const snappedLatMeters = Math.round(latMeters / gridSize) * gridSize;
			const snappedLngMeters = Math.round(lngMeters / gridSize) * gridSize;

			lat = allBounds.south + snappedLatMeters / METERS_PER_DEGREE_LAT;
			lng = allBounds.west + snappedLngMeters / (METERS_PER_DEGREE_LAT * cosLat);
		}

		// Update plant position
		zones = zones.map((z, zi) => {
			if (z.id !== draggingPlant!.zoneId) return z;
			return {
				...z,
				plants: z.plants.map((p, pi) => {
					if (pi !== draggingPlant!.plantIndex) return p;
					return {
						...p,
						positions: p.positions.map((pos, posI) => {
							if (posI !== draggingPlant!.positionIndex) return pos;
							return { lat, lng };
						})
					};
				})
			};
		});
		onzoneschange?.(zones);
	}

	// Start dragging a plant
	function startPlantDrag(
		zoneId: string,
		plantIndex: number,
		positionIndex: number,
		e: MouseEvent
	) {
		draggingPlant = {
			zoneId,
			plantIndex,
			positionIndex,
			startX: e.clientX,
			startY: e.clientY
		};
		selectedPlant = { zoneId, plantIndex, positionIndex };
	}

	// Fit view to all zones
	function fitToZones() {
		viewBox = { x: 0, y: 0, width, height };
	}

	// Handle zone click
	function handleZoneClick(zoneId: string, e: MouseEvent) {
		e.stopPropagation();
		onselect?.(zoneId);
	}

	// Handle background click
	function handleBackgroundClick() {
		onselect?.(null);
		selectedPlant = null;
	}

	// Observe container size
	onMount(() => {
		if (!browser || !containerRef) return;

		const resizeObserver = new ResizeObserver((entries) => {
			for (const entry of entries) {
				width = entry.contentRect.width;
				height = entry.contentRect.height;
				viewBox = { x: 0, y: 0, width, height };
			}
		});

		resizeObserver.observe(containerRef);
		return () => resizeObserver.disconnect();
	});

	// Expose SVG ref to parent
	$effect(() => {
		if (onsvgref) {
			onsvgref(svgRef);
		}
	});
</script>

<div class="plan-canvas" bind:this={containerRef}>
	<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
	<svg
		bind:this={svgRef}
		{width}
		{height}
		viewBox="{viewBox.x} {viewBox.y} {viewBox.width} {viewBox.height}"
		class="canvas-svg"
		role="application"
		aria-label="Garden plan canvas - drag to pan, scroll to zoom"
		onmousedown={handlePanStart}
		onmousemove={handlePanMove}
		onmouseup={handlePanEnd}
		onmouseleave={handlePanEnd}
		onwheel={handleWheel}
	>
		<!-- Background - click to deselect -->
		<!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
		<rect
			x={viewBox.x}
			y={viewBox.y}
			width={viewBox.width}
			height={viewBox.height}
			fill="#f8fafc"
			onclick={handleBackgroundClick}
		/>

		<!-- Grid lines -->
		{#if showGrid && zones.length > 0}
			<g class="grid-lines">
				{#each gridLines.vertical as line}
					<line
						x1={line.x}
						y1={viewBox.y}
						x2={line.x}
						y2={viewBox.y + viewBox.height}
						stroke="#e2e8f0"
						stroke-width="1"
					/>
				{/each}
				{#each gridLines.horizontal as line}
					<line
						x1={viewBox.x}
						y1={line.y}
						x2={viewBox.x + viewBox.width}
						y2={line.y}
						stroke="#e2e8f0"
						stroke-width="1"
					/>
				{/each}
			</g>
		{/if}

		<!-- Zones -->
		{#each zones as zone}
			{@const nw = toCanvasCoords(zone.bounds.north, zone.bounds.west)}
			{@const se = toCanvasCoords(zone.bounds.south, zone.bounds.east)}
			{@const zoneWidth = se.x - nw.x}
			{@const zoneHeight = se.y - nw.y}
			{@const color = LIGHT_COLORS[zone.lightCategory]}
			{@const isSelected = zone.id === selectedZoneId}

			<g class="zone" class:selected={isSelected}>
				<!-- Zone fill -->
				<!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
				<rect
					x={nw.x}
					y={nw.y}
					width={zoneWidth}
					height={zoneHeight}
					fill={color}
					fill-opacity="0.25"
					stroke={color}
					stroke-width={isSelected ? 3 : 2}
					stroke-dasharray={isSelected ? undefined : '5,5'}
					onclick={(e) => handleZoneClick(zone.id, e)}
					class="zone-rect"
				/>

				<!-- Zone label -->
				<text
					x={nw.x + zoneWidth / 2}
					y={nw.y + zoneHeight / 2}
					text-anchor="middle"
					dominant-baseline="central"
					class="zone-label"
				>
					<tspan fill="white" stroke="white" stroke-width="3" paint-order="stroke">
						{zone.name}
					</tspan>
				</text>
				<text
					x={nw.x + zoneWidth / 2}
					y={nw.y + zoneHeight / 2}
					text-anchor="middle"
					dominant-baseline="central"
					class="zone-label"
					fill={color}
				>
					{zone.name}
				</text>

				<!-- Plants in zone -->
				{#each zone.plants as placed, plantIndex}
					{@const plant = getPlantById(placed.plantId)}
					{#if plant}
						{#each placed.positions as pos, posIndex}
							{@const coords = toCanvasCoords(pos.lat, pos.lng)}
							{@const spreadMeters = feetToMeters(1)}
							{@const diameter = metersToPixels(spreadMeters)}
							{@const spacingStatus = calculateSpacingStatus(zone, placed, posIndex)}
							{@const isSelectedPlant =
								selectedPlant?.zoneId === zone.id &&
								selectedPlant?.plantIndex === plantIndex &&
								selectedPlant?.positionIndex === posIndex}
							{@const isDragging =
								draggingPlant?.zoneId === zone.id &&
								draggingPlant?.plantIndex === plantIndex &&
								draggingPlant?.positionIndex === posIndex}

							<PlantMarker
								{plant}
								x={coords.x}
								y={coords.y}
								diameter={Math.max(24, diameter)}
								quantity={posIndex === 0 ? placed.quantity : undefined}
								{spacingStatus}
								selected={isSelectedPlant}
								dragging={isDragging}
								onclick={() => {
									selectedPlant = { zoneId: zone.id, plantIndex, positionIndex: posIndex };
								}}
								ondragstart={(e) => startPlantDrag(zone.id, plantIndex, posIndex, e)}
							/>
						{/each}
					{/if}
				{/each}
			</g>
		{/each}

		<!-- North arrow -->
		{#if zones.length > 0}
			<g class="north-arrow" transform="translate({viewBox.x + viewBox.width - 40}, {viewBox.y + 40})">
				<circle r="18" fill="white" stroke="#64748b" stroke-width="1" />
				<path d="M0,-12 L4,8 L0,4 L-4,8 Z" fill="#1e293b" />
				<text y="14" text-anchor="middle" font-size="10" font-weight="600" fill="#1e293b">N</text>
			</g>
		{/if}

		<!-- Scale bar -->
		{#if scaleBar && zones.length > 0}
			<g class="scale-bar" transform="translate({viewBox.x + 20}, {viewBox.y + viewBox.height - 30})">
				<rect x="0" y="0" width={scaleBar.pixelWidth} height="6" fill="#1e293b" />
				<line x1="0" y1="0" x2="0" y2="10" stroke="#1e293b" stroke-width="2" />
				<line
					x1={scaleBar.pixelWidth}
					y1="0"
					x2={scaleBar.pixelWidth}
					y2="10"
					stroke="#1e293b"
					stroke-width="2"
				/>
				<text x={scaleBar.pixelWidth / 2} y="-5" text-anchor="middle" font-size="11" fill="#1e293b">
					{scaleBar.meters}m
				</text>
			</g>
		{/if}
	</svg>

	<!-- Toolbar overlay -->
	<div class="canvas-toolbar">
		<button type="button" class="toolbar-button" onclick={fitToZones} title="Fit to zones">
			<svg
				xmlns="http://www.w3.org/2000/svg"
				width="18"
				height="18"
				viewBox="0 0 24 24"
				fill="none"
				stroke="currentColor"
				stroke-width="2"
			>
				<path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7" />
			</svg>
		</button>
		<label class="toolbar-toggle" title="Snap to grid">
			<input type="checkbox" bind:checked={snapToGrid} />
			<svg
				xmlns="http://www.w3.org/2000/svg"
				width="18"
				height="18"
				viewBox="0 0 24 24"
				fill="none"
				stroke="currentColor"
				stroke-width="2"
			>
				<rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
				<line x1="3" y1="9" x2="21" y2="9" />
				<line x1="3" y1="15" x2="21" y2="15" />
				<line x1="9" y1="3" x2="9" y2="21" />
				<line x1="15" y1="3" x2="15" y2="21" />
			</svg>
		</label>
	</div>

	<!-- Spacing issues indicator -->
	{#if spacingIssues > 0}
		<div class="spacing-issues">
			<svg
				xmlns="http://www.w3.org/2000/svg"
				width="16"
				height="16"
				viewBox="0 0 24 24"
				fill="none"
				stroke="currentColor"
				stroke-width="2"
			>
				<path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
				<line x1="12" y1="9" x2="12" y2="13" />
				<line x1="12" y1="17" x2="12.01" y2="17" />
			</svg>
			<span>{spacingIssues} spacing issue{spacingIssues === 1 ? '' : 's'}</span>
		</div>
	{/if}

	<!-- Empty state -->
	{#if zones.length === 0}
		<div class="empty-state">
			<p>No zones defined yet.</p>
			<p class="hint">Go to the Plants phase to create planting zones.</p>
		</div>
	{/if}
</div>

<style>
	.plan-canvas {
		position: relative;
		width: 100%;
		height: 100%;
		min-height: 400px;
		background: #f8fafc;
		border-radius: 8px;
		overflow: hidden;
	}

	.canvas-svg {
		display: block;
		cursor: grab;
	}

	.canvas-svg:active {
		cursor: grabbing;
	}

	.zone rect {
		cursor: pointer;
		transition: stroke-width 0.15s;
	}

	.zone rect:hover {
		stroke-width: 3;
	}

	.zone.selected rect {
		stroke-width: 3;
	}

	.zone-label {
		font-size: 14px;
		font-weight: 600;
		pointer-events: none;
		user-select: none;
	}

	.north-arrow {
		pointer-events: none;
	}

	.scale-bar {
		pointer-events: none;
	}

	.canvas-toolbar {
		position: absolute;
		top: 12px;
		left: 12px;
		display: flex;
		flex-direction: column;
		gap: 8px;
		z-index: 10;
	}

	.toolbar-button {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 36px;
		height: 36px;
		background: white;
		border: 1px solid #e2e8f0;
		border-radius: 6px;
		cursor: pointer;
		color: #64748b;
		transition: all 0.15s;
	}

	.toolbar-button:hover {
		background: #f1f5f9;
		color: #1e293b;
	}

	.toolbar-toggle {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 36px;
		height: 36px;
		background: white;
		border: 1px solid #e2e8f0;
		border-radius: 6px;
		cursor: pointer;
		color: #64748b;
		transition: all 0.15s;
	}

	.toolbar-toggle:hover {
		background: #f1f5f9;
		color: #1e293b;
	}

	.toolbar-toggle input {
		display: none;
	}

	.toolbar-toggle:has(input:checked) {
		background: #3b82f6;
		border-color: #3b82f6;
		color: white;
	}

	.spacing-issues {
		position: absolute;
		bottom: 12px;
		left: 50%;
		transform: translateX(-50%);
		display: flex;
		align-items: center;
		gap: 6px;
		padding: 8px 12px;
		background: #fef3c7;
		border: 1px solid #fcd34d;
		border-radius: 6px;
		font-size: 0.875rem;
		color: #92400e;
		z-index: 10;
	}

	.empty-state {
		position: absolute;
		top: 50%;
		left: 50%;
		transform: translate(-50%, -50%);
		text-align: center;
		color: #64748b;
	}

	.empty-state p {
		margin: 0 0 0.5rem;
	}

	.empty-state .hint {
		font-size: 0.875rem;
		color: #94a3b8;
	}
</style>
