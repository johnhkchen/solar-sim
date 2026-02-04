<script lang="ts" module>
	/**
	 * Zone represents a rectangular planting area on the map.
	 * Each zone captures sun exposure for plant selection.
	 */
	export interface Zone {
		id: string;
		name: string;
		bounds: {
			north: number;
			south: number;
			east: number;
			west: number;
		};
		avgSunHours: number;
		lightCategory: 'full-sun' | 'part-sun' | 'part-shade' | 'full-shade';
		plants: PlacedPlant[];
	}

	/**
	 * A plant placed within a zone.
	 */
	export interface PlacedPlant {
		plantId: string;
		quantity: number;
		positions: { lat: number; lng: number }[];
	}

	/**
	 * Light category thresholds (sun hours per day).
	 */
	export const LIGHT_THRESHOLDS = {
		FULL_SUN: 6, // 6+ hours
		PART_SUN: 4, // 4-6 hours
		PART_SHADE: 2 // 2-4 hours, below 2 is full-shade
	};

	/**
	 * Colors for each light category.
	 */
	export const LIGHT_COLORS: Record<Zone['lightCategory'], string> = {
		'full-sun': '#f97316', // orange
		'part-sun': '#facc15', // yellow
		'part-shade': '#22c55e', // green
		'full-shade': '#3b82f6' // blue
	};

	/**
	 * Classifies sun hours into a light category.
	 */
	export function classifyLightCategory(sunHours: number): Zone['lightCategory'] {
		if (sunHours >= LIGHT_THRESHOLDS.FULL_SUN) return 'full-sun';
		if (sunHours >= LIGHT_THRESHOLDS.PART_SUN) return 'part-sun';
		if (sunHours >= LIGHT_THRESHOLDS.PART_SHADE) return 'part-shade';
		return 'full-shade';
	}

	/**
	 * Generates the next zone name in sequence (Bed A, Bed B, etc.).
	 */
	export function generateZoneName(existingZones: Zone[]): string {
		const usedLetters = new Set(
			existingZones
				.map((z) => z.name.match(/^Bed ([A-Z])$/))
				.filter((m): m is RegExpMatchArray => m !== null)
				.map((m) => m[1])
		);

		for (let i = 0; i < 26; i++) {
			const letter = String.fromCharCode(65 + i); // A-Z
			if (!usedLetters.has(letter)) {
				return `Bed ${letter}`;
			}
		}
		// Fallback for more than 26 zones
		return `Bed ${existingZones.length + 1}`;
	}

	/**
	 * Calculates the area of a zone in square meters.
	 */
	export function calculateZoneArea(bounds: Zone['bounds']): number {
		const METERS_PER_DEGREE_LAT = 111320;
		const centerLat = (bounds.north + bounds.south) / 2;
		const latRad = (centerLat * Math.PI) / 180;
		const metersPerDegreeLng = METERS_PER_DEGREE_LAT * Math.cos(latRad);

		const heightMeters = (bounds.north - bounds.south) * METERS_PER_DEGREE_LAT;
		const widthMeters = (bounds.east - bounds.west) * metersPerDegreeLng;

		return heightMeters * widthMeters;
	}

	/**
	 * Formats area for display in appropriate units.
	 */
	export function formatArea(squareMeters: number): string {
		if (squareMeters < 1) {
			return `${Math.round(squareMeters * 10000)} cm²`;
		}
		if (squareMeters < 100) {
			return `${squareMeters.toFixed(1)} m²`;
		}
		return `${Math.round(squareMeters)} m²`;
	}
</script>

<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { browser } from '$app/environment';
	import type { ExposureGrid } from '$lib/solar/exposure-grid';
	import { findCellAtLatLng, getExposureAt } from '$lib/solar/exposure-grid';

	interface Props {
		/** Leaflet map instance to draw on */
		map: L.Map | null;
		/** Current zones */
		zones?: Zone[];
		/** Callback when zones change */
		onzoneschange?: (zones: Zone[]) => void;
		/** Selected zone ID */
		selectedZoneId?: string | null;
		/** Callback when selection changes */
		onselect?: (zoneId: string | null) => void;
		/** Whether zone drawing mode is active */
		drawingMode?: boolean;
		/** Callback when drawing mode changes */
		ondrawingmodechange?: (active: boolean) => void;
		/** Exposure grid for calculating zone sun hours */
		exposureGrid?: ExposureGrid | null;
	}

	let {
		map,
		zones = $bindable([]),
		onzoneschange,
		selectedZoneId = null,
		onselect,
		drawingMode = $bindable(false),
		ondrawingmodechange,
		exposureGrid = null
	}: Props = $props();

	let L = $state<typeof import('leaflet') | null>(null);
	// Not reactive - internal Leaflet object tracking to avoid infinite effect loops
	let zoneRectangles: Map<string, L.Rectangle> = new Map();
	let zoneLabels: Map<string, L.Marker> = new Map();

	// Drawing state
	let isDrawing = $state(false);
	let drawStartLatLng: L.LatLng | null = null;
	let drawPreviewRect: L.Rectangle | null = null;

	// Resize state - not reactive to avoid infinite effect loops
	let resizeHandles: L.Marker[] = [];
	let isResizing = $state(false);
	let resizeCorner: 'nw' | 'ne' | 'sw' | 'se' | null = null;
	let resizeZoneId: string | null = null;
	let resizeOriginalBounds: Zone['bounds'] | null = null;

	/**
	 * Calculates average sun hours for a zone from the exposure grid.
	 */
	function calculateZoneSunHours(bounds: Zone['bounds']): number {
		if (!exposureGrid) {
			// Default to 6 hours if no grid data
			return 6;
		}

		// Sample points within the zone bounds
		const sampleCount = 5;
		let totalSunHours = 0;
		let validSamples = 0;

		for (let i = 0; i < sampleCount; i++) {
			for (let j = 0; j < sampleCount; j++) {
				const lat = bounds.south + ((i + 0.5) / sampleCount) * (bounds.north - bounds.south);
				const lng = bounds.west + ((j + 0.5) / sampleCount) * (bounds.east - bounds.west);

				const cell = findCellAtLatLng(exposureGrid, lat, lng);
				if (cell) {
					const sunHours = getExposureAt(exposureGrid, cell.row, cell.col);
					if (sunHours !== undefined) {
						totalSunHours += sunHours;
						validSamples++;
					}
				}
			}
		}

		return validSamples > 0 ? totalSunHours / validSamples : 6;
	}

	/**
	 * Creates or updates the visual rectangle for a zone.
	 */
	function renderZoneRectangle(zone: Zone): void {
		if (!map || !L) return;

		// Remove existing rectangle if any
		const existing = zoneRectangles.get(zone.id);
		if (existing) {
			existing.remove();
		}

		const isSelected = zone.id === selectedZoneId;
		const color = LIGHT_COLORS[zone.lightCategory];

		const rect = L.rectangle(
			[
				[zone.bounds.south, zone.bounds.west],
				[zone.bounds.north, zone.bounds.east]
			],
			{
				color,
				weight: isSelected ? 3 : 2,
				fillColor: color,
				fillOpacity: 0.25,
				dashArray: isSelected ? undefined : '5, 5'
			}
		).addTo(map);

		// Handle click to select
		rect.on('click', (e: L.LeafletMouseEvent) => {
			L?.DomEvent.stopPropagation(e);
			onselect?.(zone.id);
		});

		zoneRectangles.set(zone.id, rect);

		// Render label
		renderZoneLabel(zone);

		// Render resize handles if selected
		if (isSelected) {
			renderResizeHandles(zone);
		}
	}

	/**
	 * Renders the zone name label at the center of the zone.
	 */
	function renderZoneLabel(zone: Zone): void {
		if (!map || !L) return;

		// Remove existing label
		const existingLabel = zoneLabels.get(zone.id);
		if (existingLabel) {
			existingLabel.remove();
		}

		const centerLat = (zone.bounds.north + zone.bounds.south) / 2;
		const centerLng = (zone.bounds.east + zone.bounds.west) / 2;
		const color = LIGHT_COLORS[zone.lightCategory];

		const labelIcon = L.divIcon({
			className: 'zone-label-icon',
			html: `<div class="zone-label" style="
				background: white;
				border: 2px solid ${color};
				border-radius: 4px;
				padding: 2px 6px;
				font-size: 12px;
				font-weight: 600;
				color: ${color};
				white-space: nowrap;
				box-shadow: 0 1px 3px rgba(0,0,0,0.2);
			">${zone.name}</div>`,
			iconSize: [0, 0],
			iconAnchor: [0, 0]
		});

		const label = L.marker([centerLat, centerLng], {
			icon: labelIcon,
			interactive: false
		}).addTo(map);

		zoneLabels.set(zone.id, label);
	}

	/**
	 * Renders resize handles at the corners of a selected zone.
	 */
	function renderResizeHandles(zone: Zone): void {
		if (!map || !L) return;

		// Clear existing handles
		clearResizeHandles();

		const corners: Array<{ corner: 'nw' | 'ne' | 'sw' | 'se'; lat: number; lng: number }> = [
			{ corner: 'nw', lat: zone.bounds.north, lng: zone.bounds.west },
			{ corner: 'ne', lat: zone.bounds.north, lng: zone.bounds.east },
			{ corner: 'sw', lat: zone.bounds.south, lng: zone.bounds.west },
			{ corner: 'se', lat: zone.bounds.south, lng: zone.bounds.east }
		];

		const color = LIGHT_COLORS[zone.lightCategory];

		for (const { corner, lat, lng } of corners) {
			const handleIcon = L.divIcon({
				className: 'zone-resize-handle',
				html: `<div style="
					width: 12px;
					height: 12px;
					background: white;
					border: 2px solid ${color};
					border-radius: 2px;
					cursor: ${corner === 'nw' || corner === 'se' ? 'nwse-resize' : 'nesw-resize'};
					box-shadow: 0 1px 3px rgba(0,0,0,0.3);
				"></div>`,
				iconSize: [12, 12],
				iconAnchor: [6, 6]
			});

			const handle = L.marker([lat, lng], {
				icon: handleIcon,
				draggable: true
			}).addTo(map);

			handle.on('dragstart', () => {
				isResizing = true;
				resizeCorner = corner;
				resizeZoneId = zone.id;
				resizeOriginalBounds = { ...zone.bounds };
			});

			handle.on('drag', (e: L.LeafletEvent) => {
				if (!resizeOriginalBounds || !resizeZoneId || !resizeCorner) return;

				const marker = e.target as L.Marker;
				const newPos = marker.getLatLng();

				const updatedBounds = { ...resizeOriginalBounds };

				if (resizeCorner.includes('n')) {
					updatedBounds.north = Math.max(newPos.lat, resizeOriginalBounds.south + 0.00001);
				}
				if (resizeCorner.includes('s')) {
					updatedBounds.south = Math.min(newPos.lat, resizeOriginalBounds.north - 0.00001);
				}
				if (resizeCorner.includes('e')) {
					updatedBounds.east = Math.max(newPos.lng, resizeOriginalBounds.west + 0.00001);
				}
				if (resizeCorner.includes('w')) {
					updatedBounds.west = Math.min(newPos.lng, resizeOriginalBounds.east - 0.00001);
				}

				// Update preview
				const rect = zoneRectangles.get(resizeZoneId);
				if (rect) {
					rect.setBounds([
						[updatedBounds.south, updatedBounds.west],
						[updatedBounds.north, updatedBounds.east]
					]);
				}
			});

			handle.on('dragend', (e: L.LeafletEvent) => {
				if (!resizeZoneId || !resizeCorner || !resizeOriginalBounds) return;

				const marker = e.target as L.Marker;
				const newPos = marker.getLatLng();

				const updatedBounds = { ...resizeOriginalBounds };

				if (resizeCorner.includes('n')) {
					updatedBounds.north = Math.max(newPos.lat, resizeOriginalBounds.south + 0.00001);
				}
				if (resizeCorner.includes('s')) {
					updatedBounds.south = Math.min(newPos.lat, resizeOriginalBounds.north - 0.00001);
				}
				if (resizeCorner.includes('e')) {
					updatedBounds.east = Math.max(newPos.lng, resizeOriginalBounds.west + 0.00001);
				}
				if (resizeCorner.includes('w')) {
					updatedBounds.west = Math.min(newPos.lng, resizeOriginalBounds.east - 0.00001);
				}

				// Update the zone
				const avgSunHours = calculateZoneSunHours(updatedBounds);
				zones = zones.map((z) =>
					z.id === resizeZoneId
						? {
								...z,
								bounds: updatedBounds,
								avgSunHours,
								lightCategory: classifyLightCategory(avgSunHours)
							}
						: z
				);
				onzoneschange?.(zones);

				isResizing = false;
				resizeCorner = null;
				resizeZoneId = null;
				resizeOriginalBounds = null;
			});

			resizeHandles.push(handle);
		}
	}

	/**
	 * Clears all resize handles from the map.
	 */
	function clearResizeHandles(): void {
		for (const handle of resizeHandles) {
			handle.remove();
		}
		resizeHandles = [];
	}

	/**
	 * Starts drawing a new zone.
	 */
	function startDrawing(e: L.LeafletMouseEvent): void {
		if (!drawingMode || !map || !L) return;

		isDrawing = true;
		drawStartLatLng = e.latlng;

		// Create preview rectangle
		drawPreviewRect = L.rectangle(
			[
				[e.latlng.lat, e.latlng.lng],
				[e.latlng.lat, e.latlng.lng]
			],
			{
				color: '#6b7280',
				weight: 2,
				fillColor: '#6b7280',
				fillOpacity: 0.2,
				dashArray: '5, 5'
			}
		).addTo(map);
	}

	/**
	 * Updates the preview rectangle while drawing.
	 */
	function updateDrawing(e: L.LeafletMouseEvent): void {
		if (!isDrawing || !drawStartLatLng || !drawPreviewRect) return;

		drawPreviewRect.setBounds([
			[drawStartLatLng.lat, drawStartLatLng.lng],
			[e.latlng.lat, e.latlng.lng]
		]);
	}

	/**
	 * Finishes drawing and creates the zone.
	 */
	function finishDrawing(e: L.LeafletMouseEvent): void {
		if (!isDrawing || !drawStartLatLng || !drawPreviewRect) return;

		// Remove preview
		drawPreviewRect.remove();
		drawPreviewRect = null;

		// Calculate bounds (ensure north > south, east > west)
		const bounds: Zone['bounds'] = {
			north: Math.max(drawStartLatLng.lat, e.latlng.lat),
			south: Math.min(drawStartLatLng.lat, e.latlng.lat),
			east: Math.max(drawStartLatLng.lng, e.latlng.lng),
			west: Math.min(drawStartLatLng.lng, e.latlng.lng)
		};

		// Check minimum size (roughly 1m in each direction)
		const MIN_SIZE = 0.00001;
		if (bounds.north - bounds.south < MIN_SIZE || bounds.east - bounds.west < MIN_SIZE) {
			isDrawing = false;
			drawStartLatLng = null;
			return;
		}

		// Calculate sun hours
		const avgSunHours = calculateZoneSunHours(bounds);
		const lightCategory = classifyLightCategory(avgSunHours);

		// Create new zone
		const newZone: Zone = {
			id: crypto.randomUUID(),
			name: generateZoneName(zones),
			bounds,
			avgSunHours,
			lightCategory,
			plants: []
		};

		zones = [...zones, newZone];
		onzoneschange?.(zones);

		// Select the new zone
		onselect?.(newZone.id);

		// Exit drawing mode
		isDrawing = false;
		drawStartLatLng = null;
		drawingMode = false;
		ondrawingmodechange?.(false);
	}

	/**
	 * Cancels the current drawing operation.
	 */
	function cancelDrawing(): void {
		if (drawPreviewRect) {
			drawPreviewRect.remove();
			drawPreviewRect = null;
		}
		isDrawing = false;
		drawStartLatLng = null;
	}

	/**
	 * Deletes a zone by ID.
	 */
	export function deleteZone(zoneId: string): void {
		// Remove visual elements
		const rect = zoneRectangles.get(zoneId);
		if (rect) {
			rect.remove();
			zoneRectangles.delete(zoneId);
		}

		const label = zoneLabels.get(zoneId);
		if (label) {
			label.remove();
			zoneLabels.delete(zoneId);
		}

		if (selectedZoneId === zoneId) {
			clearResizeHandles();
			onselect?.(null);
		}

		zones = zones.filter((z) => z.id !== zoneId);
		onzoneschange?.(zones);
	}

	/**
	 * Updates a zone's name.
	 */
	export function renameZone(zoneId: string, newName: string): void {
		zones = zones.map((z) => (z.id === zoneId ? { ...z, name: newName } : z));
		onzoneschange?.(zones);
	}

	/**
	 * Recalculates sun hours for all zones (call when heatmap changes).
	 */
	export function recalculateAllZones(): void {
		zones = zones.map((z) => {
			const avgSunHours = calculateZoneSunHours(z.bounds);
			return {
				...z,
				avgSunHours,
				lightCategory: classifyLightCategory(avgSunHours)
			};
		});
		onzoneschange?.(zones);
	}

	// Initialize Leaflet and set up event handlers
	onMount(async () => {
		if (!browser) return;

		L = await import('leaflet');

		// Render existing zones
		for (const zone of zones) {
			renderZoneRectangle(zone);
		}
	});

	// Disable map dragging when in drawing mode so we can capture mouse events
	$effect(() => {
		if (!map) return;

		if (drawingMode) {
			map.dragging.disable();
		} else {
			map.dragging.enable();
		}

		return () => {
			// Re-enable dragging on cleanup
			map.dragging.enable();
		};
	});

	// Set up map event handlers when map becomes available
	// Explicitly track reactive dependencies so handlers are re-attached when state changes
	$effect(() => {
		if (!map || !L) return;

		// Read reactive values to create dependencies - effect re-runs when these change
		const currentDrawingMode = drawingMode;
		const currentSelectedZoneId = selectedZoneId;

		const handleMouseDown = (e: L.LeafletMouseEvent) => {
			if (currentDrawingMode && !isResizing) {
				startDrawing(e);
			}
		};

		const handleMouseMove = (e: L.LeafletMouseEvent) => {
			if (isDrawing) {
				updateDrawing(e);
			}
		};

		const handleMouseUp = (e: L.LeafletMouseEvent) => {
			if (isDrawing) {
				finishDrawing(e);
			}
		};

		const handleClick = (e: L.LeafletMouseEvent) => {
			// Deselect when clicking on map (not on a zone)
			if (!currentDrawingMode && !isResizing && currentSelectedZoneId) {
				onselect?.(null);
			}
		};

		const handleKeyDown = (e: KeyboardEvent) => {
			if (e.key === 'Escape') {
				if (isDrawing) {
					cancelDrawing();
				}
				if (currentDrawingMode) {
					drawingMode = false;
					ondrawingmodechange?.(false);
				}
			}
		};

		map.on('mousedown', handleMouseDown);
		map.on('mousemove', handleMouseMove);
		map.on('mouseup', handleMouseUp);
		map.on('click', handleClick);
		document.addEventListener('keydown', handleKeyDown);

		return () => {
			map.off('mousedown', handleMouseDown);
			map.off('mousemove', handleMouseMove);
			map.off('mouseup', handleMouseUp);
			map.off('click', handleClick);
			document.removeEventListener('keydown', handleKeyDown);
		};
	});

	// Update zone visuals when zones change
	$effect(() => {
		if (!map || !L) return;

		// Track current zone IDs
		const currentIds = new Set(zones.map((z) => z.id));

		// Remove rectangles for deleted zones
		for (const [id, rect] of zoneRectangles) {
			if (!currentIds.has(id)) {
				rect.remove();
				zoneRectangles.delete(id);
			}
		}

		// Remove labels for deleted zones
		for (const [id, label] of zoneLabels) {
			if (!currentIds.has(id)) {
				label.remove();
				zoneLabels.delete(id);
			}
		}

		// Create/update rectangles for current zones
		for (const zone of zones) {
			renderZoneRectangle(zone);
		}
	});

	// Update selection visuals
	$effect(() => {
		if (!map || !L) return;

		// Read selectedZoneId to create dependency - effect re-runs when selection changes
		const _selectedId = selectedZoneId;

		// Clear old resize handles
		clearResizeHandles();

		// Re-render all zones to update selection styling
		for (const zone of zones) {
			renderZoneRectangle(zone);
		}
	});

	// Clean up on unmount
	onDestroy(() => {
		cancelDrawing();
		clearResizeHandles();

		for (const rect of zoneRectangles.values()) {
			rect.remove();
		}
		zoneRectangles.clear();

		for (const label of zoneLabels.values()) {
			label.remove();
		}
		zoneLabels.clear();
	});
</script>

<!-- No visual DOM needed - this component only manages map layers -->
