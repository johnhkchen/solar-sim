<script lang="ts" module>
	/**
	 * A tree placed on the map, using lat/lng coordinates.
	 * This type is used for the map-based tree placement workflow.
	 */
	export interface MapTree {
		id: string;
		lat: number;
		lng: number;
		type: 'deciduous-tree' | 'evergreen-tree';
		label: string;
		height: number; // meters
		canopyWidth: number; // meters (diameter)
		/** Whether this tree was auto-detected from satellite data or manually placed by the user */
		source?: 'auto' | 'manual';
		/** True if user has modified properties of an auto-detected tree */
		modified?: boolean;
	}

	/**
	 * Preset configurations for common tree sizes.
	 */
	export interface TreePreset {
		label: string;
		type: 'deciduous-tree' | 'evergreen-tree';
		height: number;
		canopyWidth: number;
	}

	/**
	 * Coordinates for the observation point where sun-hours are calculated.
	 */
	export interface ObservationPoint {
		lat: number;
		lng: number;
	}

	export const TREE_PRESETS: TreePreset[] = [
		{ label: 'Small tree', type: 'deciduous-tree', height: 6, canopyWidth: 5 },
		{ label: 'Medium tree', type: 'deciduous-tree', height: 12, canopyWidth: 8 },
		{ label: 'Large tree', type: 'deciduous-tree', height: 20, canopyWidth: 12 },
		{ label: 'Tall tree', type: 'deciduous-tree', height: 30, canopyWidth: 15 },
		{ label: 'Small evergreen', type: 'evergreen-tree', height: 8, canopyWidth: 4 },
		{ label: 'Large evergreen', type: 'evergreen-tree', height: 20, canopyWidth: 8 }
	];
</script>

<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { browser } from '$app/environment';
	import { getTimezone, type Location, type Coordinates } from '$lib/geo';
	import { getSunPosition, calculateAllTreeShadowsLatLng, type LatLngShadowPolygon, type MapTreeConfig } from '$lib/solar';
	import { loadLocationData, saveLocationData } from '$lib/storage';
	import { fetchCanopyData, extractTrees, toMapTrees, type LatLngBounds } from '$lib/canopy';
	import TreeConfigPanel from './TreeConfigPanel.svelte';

	/**
	 * Props for the MapPicker component.
	 */
	interface MapPickerProps {
		initialLocation?: Coordinates;
		zoom?: number;
		onselect?: (location: Location) => void;
		showShadows?: boolean;
		trees?: MapTree[];
		ontreeschange?: (trees: MapTree[]) => void;
		enableTreePlacement?: boolean;
		enableObservationPoint?: boolean;
		observationPoint?: ObservationPoint;
		onobservationchange?: (point: ObservationPoint) => void;
		/** Shadow view mode: 'shadows' shows time-of-day, 'solar-hours' shows heatmap. Default: 'shadows' */
		shadowViewMode?: 'shadows' | 'solar-hours';
		/** Callback when shadow view mode changes */
		onshadowviewmodechange?: (mode: 'shadows' | 'solar-hours') => void;
		/** Date for shadow/sun exposure analysis. If provided, overrides internal date control. */
		date?: Date;
		/** Allow building data fetch from OpenStreetMap. Set to true to enable fetching. Default: false */
		allowBuildingFetch?: boolean;
		/** Enable localStorage persistence for trees. Trees will be saved per-location. */
		persistTrees?: boolean;
		/** Enable automatic tree detection from canopy height data. */
		enableAutoTreeDetection?: boolean;
		/** Minimum zoom level required for auto tree detection. Lower zoom levels cover too large an area. Default: 15 */
		autoTreeDetectionMinZoom?: number;
		/** Buffer distance in degrees around the map center for fetching canopy data. Default: 0.003 (~300m) */
		autoTreeDetectionBuffer?: number;
		/** Maximum number of auto-detected trees. Default: 200 */
		autoTreeDetectionMaxTrees?: number;
		/** Callback when auto tree detection starts. */
		onautodetectionstart?: () => void;
		/** Callback when auto tree detection completes. */
		onautodetectioncomplete?: (treeCount: number) => void;
		/** Callback when auto tree detection fails. */
		onautodetectionerror?: (error: string) => void;
		/** Callback when map is ready, provides the Leaflet map instance. */
		onmapready?: (map: L.Map) => void;
		/** Callback when ShadeMap is ready, provides query interface for terrain/building shadows. */
		onshademaready?: (shadeMap: ShadeMapInterface) => void;
		/** Disable default click behavior (marker placement). Use when another component handles clicks. */
		disableClickHandler?: boolean;
	}

	/**
	 * Interface for ShadeMap query capabilities exposed to parent components.
	 * Allows external components to query terrain/building shadows.
	 */
	export interface ShadeMapInterface {
		/** Check if a lat/lng position is in sun at the current time */
		isPositionInSun: (lat: number, lng: number) => Promise<boolean>;
		/** Set the date/time for shadow calculations */
		setDate: (date: Date) => void;
		/** Enable sun exposure mode for a date range, returns promise that resolves when rendering is complete */
		enableSunExposure: (startDate: Date, endDate: Date, iterations?: number) => Promise<void>;
		/** Disable sun exposure mode */
		disableSunExposure: () => void;
		/** Get hours of sun at a lat/lng position (requires sun exposure mode) */
		getHoursOfSun: (lat: number, lng: number) => number | null;
		/** Check if ShadeMap is available */
		isAvailable: () => boolean;
		/** Wait for ShadeMap to finish rendering */
		waitForIdle: () => Promise<void>;
		/** Force refresh building data (useful after enabling building fetch) */
		refreshBuildings: () => void;
		/** Set observation point calculation state (shows/hides loading indicator) */
		setObservationCalculating: (isCalculating: boolean) => void;
		/** Capture the current map view as a data URL image */
		captureMapImage: () => Promise<string | null>;
	}

	let {
		initialLocation,
		zoom = 10,
		onselect,
		showShadows = true,
		trees = $bindable([]),
		ontreeschange,
		enableTreePlacement = true,
		enableObservationPoint = false,
		observationPoint = $bindable(undefined),
		onobservationchange,
		shadowViewMode = 'shadows',
		date,
		allowBuildingFetch = false,
		persistTrees = false,
		enableAutoTreeDetection = false,
		autoTreeDetectionMinZoom = 15,
		autoTreeDetectionBuffer = 0.003,
		autoTreeDetectionMaxTrees = 200,
		onautodetectionstart,
		onautodetectioncomplete,
		onautodetectionerror,
		onmapready,
		onshademaready,
		disableClickHandler = false
	}: MapPickerProps = $props();

	// Map container element reference
	let mapContainer: HTMLDivElement;

	// Map instance (typed as any since Leaflet is dynamically imported)
	let map: L.Map | null = $state(null);
	let marker: L.Marker | null = $state(null);

	// ShadeMap layer instance (typed as any since the library lacks proper types)
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	let shadeMapLayer: any = $state(null);

	// Search state
	let searchQuery = $state('');
	let searchResults = $state<Array<{ label: string; x: number; y: number }>>([]);
	let searchLoading = $state(false);
	let showResults = $state(false);

	// GPS state
	let gpsLoading = $state(false);
	let gpsError = $state<string | null>(null);

	// Selected coordinates display
	let selectedCoords = $state<{ lat: number; lng: number } | null>(null);

	// Tree placement state
	let treePlacementMode = $state(false);
	let selectedTreeId = $state<string | null>(null);
	let treeMarkers = $state<Map<string, L.Marker>>(new Map());

	// Observation point state
	let observationMarker: L.Marker | null = $state(null);
	let observationPlacementMode = $state(false);
	let observationCalculating = $state(false);

	// Tree shadow layer state
	// Not reactive - just internal tracking of Leaflet polygon objects
	let treeShadowPolygons: L.Polygon[] = [];
	let lastShadowUpdateTime = 0;
	const SHADOW_THROTTLE_MS = 50; // Throttle shadow updates during rapid scrubbing
	const SHADOW_DEBOUNCE_MS = 1500; // Wait 1.5s after changes before rendering shadows
	let shadowRenderTimeout: ReturnType<typeof setTimeout> | null = null;
	let shadowsLoading = $state(false);

	// Derived selected tree for the config panel
	const selectedTree = $derived(trees.find((t) => t.id === selectedTreeId) ?? null);

	// Shadow time control state
	let shadowDate = $state(new Date());
	let shadowTimeValue = $state(720); // Minutes from midnight, default to noon
	let shadowsEnabled = $state(true);
	let shadeMapLoading = $state(false);

	// Building data buffer - reuse at lot-level zoom (20+) to avoid re-fetching tiny areas
	let lastFetchedBuildings: any[] = [];
	let lastFetchZoom = 0;

	// Sync internal shadowDate with external date prop (for seasonal comparisons)
	$effect(() => {
		if (date) {
			shadowDate = new Date(date);
		}
	});

	// Update ShadeMap layer when shadowDateTime changes (e.g., from seasonal preset changes)
	$effect(() => {
		const dt = shadowDateTime; // Track dependency
		if (shadeMapLayer && shadowsEnabled) {
			shadeMapLayer.setDate(dt);
		}
	});

	let shadeMapError = $state<string | null>(null);
	let buildingShadowsLoading = $state(false);
	let buildingFetchProgress = $state<string>('');

	// Store ShadeMapInterface for use in effects
	let localShadeMapInterface: ShadeMapInterface | null = $state(null);

	// Store provider and L module for use outside onMount
	let searchProvider: InstanceType<typeof import('leaflet-geosearch').OpenStreetMapProvider> | null =
		null;
	let L: typeof import('leaflet') | null = null;

	// Default center (San Francisco) if no initial location provided
	const defaultCenter: [number, number] = [37.7749, -122.4194];

	// Persistence state - tracks the location we've loaded data for to avoid
	// re-triggering loads on every selectedCoords update
	let persistenceLocation = $state<{ lat: number; lng: number } | null>(null);
	let persistenceLoaded = $state(false);
	let persistenceSaveTimeout: ReturnType<typeof setTimeout> | null = null;

	// Auto tree detection state
	let autoDetectionLoading = $state(false);
	let autoDetectionError = $state<string | null>(null);
	let autoDetectionDebounceTimeout: ReturnType<typeof setTimeout> | null = null;
	// Cache of auto-detected trees keyed by a hash of the map bounds
	// This prevents re-fetching when the user pans back to a previously viewed area
	let autoDetectedTreesCache = $state<Map<string, MapTree[]>>(new Map());
	// Track which trees were auto-detected vs manually placed
	let manuallyPlacedTreeIds = $state<Set<string>>(new Set());
	// Track deleted auto-detected tree IDs so they don't reappear on re-detection
	let deletedAutoTreeIds = $state<Set<string>>(new Set());
	// Track the last bounds we fetched to avoid refetching the same area
	let lastAutoDetectionBounds: LatLngBounds | null = null;
	// Debounce delay for auto detection (ms)
	const AUTO_DETECTION_DEBOUNCE_MS = 800;

	// Derive the full datetime from date + time slider
	const shadowDateTime = $derived.by(() => {
		const d = new Date(shadowDate);
		const hours = Math.floor(shadowTimeValue / 60);
		const minutes = shadowTimeValue % 60;
		d.setHours(hours, minutes, 0, 0);
		return d;
	});

	// Format time for display
	function formatTimeFromMinutes(mins: number): string {
		const hours = Math.floor(mins / 60);
		const minutes = mins % 60;
		const period = hours >= 12 ? 'PM' : 'AM';
		const displayHours = hours === 0 ? 12 : hours > 12 ? hours - 12 : hours;
		return `${displayHours}:${minutes.toString().padStart(2, '0')} ${period}`;
	}

	// Update ShadeMap when datetime changes
	function updateShadowTime(): void {
		if (shadeMapLayer && shadowsEnabled) {
			shadeMapLayer.setDate(shadowDateTime);
		}
	}

	/**
	 * Updates tree shadow polygons on the map.
	 * Calculates shadow positions based on current sun position and renders
	 * them as semi-transparent polygons layered on top of ShadeMap shadows.
	 */
	function updateTreeShadows(forceUpdate = false): void {
		if (!map || !L || !shadowsEnabled) {
			// Clear shadows if disabled
			clearTreeShadows();
			return;
		}

		// Throttle updates during rapid scrubbing
		const now = performance.now();
		if (!forceUpdate && now - lastShadowUpdateTime < SHADOW_THROTTLE_MS) {
			return;
		}
		lastShadowUpdateTime = now;

		// Remove existing shadow polygons
		clearTreeShadows();

		// Skip if no trees or map not ready
		if (trees.length === 0 || !selectedCoords) return;

		// Calculate sun position for current time at the map's center
		const sunPosition = getSunPosition(
			{ latitude: selectedCoords.lat, longitude: selectedCoords.lng },
			shadowDateTime
		);

		// Skip if sun is below horizon (no shadows when dark)
		if (sunPosition.altitude <= 0) return;

		// Convert trees to MapTreeConfig format
		const treeConfigs: MapTreeConfig[] = trees.map((t) => ({
			id: t.id,
			lat: t.lat,
			lng: t.lng,
			type: t.type,
			height: t.height,
			canopyWidth: t.canopyWidth
		}));

		// Calculate shadow polygons
		const shadows = calculateAllTreeShadowsLatLng(treeConfigs, sunPosition);

		// Render shadow polygons on the map
		const newPolygons: L.Polygon[] = [];
		for (const shadow of shadows) {
			const latLngs: L.LatLngExpression[] = shadow.vertices.map((v) => [v.lat, v.lng]);

			// Determine color based on tree type (deciduous are lighter due to leaf gaps)
			const isEvergreen = shadow.obstacleType === 'evergreen-tree';
			const opacity = shadow.shadeIntensity * (isEvergreen ? 0.45 : 0.35);

			const polygon = L.polygon(latLngs, {
				color: '#01112f',
				weight: 0,
				fillColor: '#01112f',
				fillOpacity: opacity,
				interactive: false // Don't capture clicks
			}).addTo(map);

			newPolygons.push(polygon);
		}

		treeShadowPolygons = newPolygons;
	}

	/**
	 * Removes all tree shadow polygons from the map.
	 */
	function clearTreeShadows(): void {
		for (const polygon of treeShadowPolygons) {
			polygon.remove();
		}
		treeShadowPolygons = [];
	}

	/**
	 * Schedules a debounced shadow update for geometry changes (trees moved, added, removed).
	 * Waits for SHADOW_DEBOUNCE_MS before rendering to avoid rendering during active panning/zooming.
	 */
	function scheduleTreeShadowUpdate(): void {
		// Clear any pending shadow render
		if (shadowRenderTimeout) {
			clearTimeout(shadowRenderTimeout);
		}

		// Show loading state
		shadowsLoading = true;

		// Keep existing shadows visible while waiting
		// Don't clear them - let the new calculation replace them

		// Schedule the shadow render after debounce period
		shadowRenderTimeout = setTimeout(() => {
			updateTreeShadows(true);
			shadowsLoading = false;
		}, SHADOW_DEBOUNCE_MS);
	}

	/**
	 * Updates tree shadows immediately for time changes.
	 * No debounce, no loading state - just instant position update.
	 */
	function updateTreeShadowsForTimeChange(): void {
		// Cancel any pending debounced updates
		if (shadowRenderTimeout) {
			clearTimeout(shadowRenderTimeout);
			shadowsLoading = false;
		}

		// Update shadows immediately without clearing
		updateTreeShadows(false);
	}

	/**
	 * Creates a custom tree icon based on tree type and source.
	 * Auto-detected trees have a dashed border; manual trees have a solid border.
	 * Modified auto-detected trees show a small edit indicator.
	 */
	function createTreeIcon(
		type: 'deciduous-tree' | 'evergreen-tree',
		isSelected: boolean,
		source: 'auto' | 'manual' = 'manual',
		modified: boolean = false
	): L.DivIcon | null {
		if (!L) return null;

		const isAuto = source === 'auto';
		const baseColor = type === 'evergreen-tree' ? '#166534' : '#22c55e';
		// Auto trees are slightly more transparent
		const color = isAuto ? (type === 'evergreen-tree' ? '#1e7b40' : '#4ade80') : baseColor;
		const borderColor = isSelected ? '#0066cc' : (type === 'evergreen-tree' ? '#14532d' : '#15803d');
		const size = isSelected ? 32 : 28;
		const borderWidth = isSelected ? 3 : 2;
		// Auto trees have dashed border
		const borderStyle = isAuto ? 'dashed' : 'solid';
		// Modified indicator (small dot) for edited auto trees
		const modifiedBadge = modified ? `<div style="
			position: absolute;
			top: -2px;
			right: -2px;
			width: 10px;
			height: 10px;
			background: #f59e0b;
			border: 2px solid white;
			border-radius: 50%;
		"></div>` : '';

		return L.divIcon({
			className: 'tree-marker-icon',
			html: `<div style="
				position: relative;
				width: ${size}px;
				height: ${size}px;
				background: ${color};
				border: ${borderWidth}px ${borderStyle} ${borderColor};
				border-radius: 50%;
				box-shadow: 0 2px 4px rgba(0,0,0,0.2);
				display: flex;
				align-items: center;
				justify-content: center;
				cursor: ${treePlacementMode ? 'crosshair' : 'move'};
				opacity: ${isAuto && !modified ? 0.85 : 1};
			"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="white" stroke="white" stroke-width="1">
				<path d="M12 2L5 12h4v8h6v-8h4L12 2z"/>
			</svg>${modifiedBadge}</div>`,
			iconSize: [size, size],
			iconAnchor: [size / 2, size / 2]
		});
	}

	/**
	 * Creates or updates a tree marker on the map.
	 */
	function createTreeMarker(tree: MapTree): void {
		if (!map || !L) return;

		// Remove existing marker if any
		const existingMarker = treeMarkers.get(tree.id);
		if (existingMarker) {
			existingMarker.remove();
		}

		const icon = createTreeIcon(
			tree.type,
			tree.id === selectedTreeId,
			tree.source ?? 'manual',
			tree.modified ?? false
		);
		if (!icon) return;

		const marker = L.marker([tree.lat, tree.lng], {
			icon,
			draggable: true,
			title: tree.label
		}).addTo(map);

		// Handle click to select
		marker.on('click', (e: L.LeafletMouseEvent) => {
			L?.DomEvent.stopPropagation(e);
			selectedTreeId = tree.id;
			updateAllTreeMarkers();
		});

		// Handle drag to reposition
		marker.on('dragend', () => {
			const pos = marker.getLatLng();
			updateTreePosition(tree.id, pos.lat, pos.lng);
		});

		treeMarkers.set(tree.id, marker);
	}

	/**
	 * Updates the position of a tree.
	 * For auto-detected trees, this marks them as modified.
	 */
	function updateTreePosition(id: string, lat: number, lng: number): void {
		trees = trees.map((t) => {
			if (t.id !== id) return t;
			// Mark auto-detected trees as modified when position changes
			const modified = t.source === 'auto' ? true : t.modified;
			return { ...t, lat, lng, modified };
		});
		// Update marker to show modified state
		const tree = trees.find(t => t.id === id);
		if (tree) {
			createTreeMarker(tree);
		}
		ontreeschange?.(trees);
	}

	/**
	 * Updates all tree markers to reflect current selection state.
	 */
	function updateAllTreeMarkers(): void {
		if (!L) return;
		for (const tree of trees) {
			const marker = treeMarkers.get(tree.id);
			if (marker) {
				const icon = createTreeIcon(
					tree.type,
					tree.id === selectedTreeId,
					tree.source ?? 'manual',
					tree.modified ?? false
				);
				if (icon) {
					marker.setIcon(icon);
				}
			}
		}
	}

	/**
	 * Adds a new tree at the given location.
	 */
	function addTree(lat: number, lng: number): void {
		const defaultPreset = TREE_PRESETS[1]; // Medium tree
		const newTree: MapTree = {
			id: crypto.randomUUID(),
			lat,
			lng,
			type: defaultPreset.type,
			label: defaultPreset.label,
			height: defaultPreset.height,
			canopyWidth: defaultPreset.canopyWidth,
			source: 'manual'
		};
		// Track this as a manually placed tree
		manuallyPlacedTreeIds.add(newTree.id);
		trees = [...trees, newTree];
		createTreeMarker(newTree);
		selectedTreeId = newTree.id;
		updateAllTreeMarkers();
		treePlacementMode = false;
		ontreeschange?.(trees);
	}

	/**
	 * Updates a tree's properties.
	 * For auto-detected trees, this marks them as modified.
	 */
	function updateTree(updatedTree: MapTree): void {
		trees = trees.map((t) => {
			if (t.id !== updatedTree.id) return t;
			// Mark auto-detected trees as modified when properties change
			const modified = updatedTree.source === 'auto' ? true : updatedTree.modified;
			return { ...updatedTree, modified };
		});

		// Recreate marker with updated properties (including modified state)
		const tree = trees.find(t => t.id === updatedTree.id);
		if (tree) {
			createTreeMarker(tree);
		}
		ontreeschange?.(trees);
	}

	/**
	 * Deletes a tree by ID.
	 * For auto-detected trees, their ID is stored so they don't reappear on re-detection.
	 */
	function deleteTree(id: string): void {
		const tree = trees.find(t => t.id === id);
		const marker = treeMarkers.get(id);
		if (marker) {
			marker.remove();
			treeMarkers.delete(id);
		}
		// Track deleted auto-detected trees to prevent reappearance
		if (tree?.source === 'auto') {
			deletedAutoTreeIds.add(id);
		}
		// Remove from manually placed tracking
		manuallyPlacedTreeIds.delete(id);
		trees = trees.filter((t) => t.id !== id);
		if (selectedTreeId === id) {
			selectedTreeId = null;
		}
		ontreeschange?.(trees);
	}

	/**
	 * Toggles tree placement mode.
	 */
	function toggleTreePlacement(): void {
		treePlacementMode = !treePlacementMode;
		observationPlacementMode = false; // Cancel observation placement if active
		if (treePlacementMode) {
			selectedTreeId = null;
			updateAllTreeMarkers();
		}
	}

	/**
	 * Creates the observation point icon (red crosshairs target).
	 * @param isLoading - Whether the sun exposure calculation is in progress
	 */
	function createObservationIcon(isLoading = false): L.DivIcon | null {
		if (!L) return null;

		const loadingRing = isLoading ? `
			<svg class="loading-ring" style="
				position: absolute;
				top: -6px;
				left: -6px;
				width: 48px;
				height: 48px;
				transform: rotate(-90deg);
			" viewBox="0 0 48 48">
				<circle
					cx="24"
					cy="24"
					r="22"
					fill="none"
					stroke="rgba(220, 38, 38, 0.2)"
					stroke-width="2"
				/>
				<circle
					class="progress-circle"
					cx="24"
					cy="24"
					r="22"
					fill="none"
					stroke="#dc2626"
					stroke-width="2"
					stroke-linecap="round"
					stroke-dasharray="138.23"
					stroke-dashoffset="138.23"
					style="
						animation: fillProgress 3s ease-in-out infinite;
						filter: drop-shadow(0 0 4px rgba(220, 38, 38, 0.8));
					"
				/>
			</svg>
		` : '';

		return L.divIcon({
			className: 'observation-marker-icon',
			html: `<div style="
				width: 36px;
				height: 36px;
				position: relative;
			">
				${loadingRing}
				<div style="
					width: 36px;
					height: 36px;
					background: rgba(220, 38, 38, 0.15);
					border: 3px solid #dc2626;
					border-radius: 50%;
					display: flex;
					align-items: center;
					justify-content: center;
					cursor: move;
					box-shadow: 0 2px 8px rgba(220, 38, 38, 0.4);
					position: relative;
					z-index: 1;
				">
					<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#dc2626" stroke-width="2.5">
						<circle cx="12" cy="12" r="3"/>
						<line x1="12" y1="2" x2="12" y2="6"/>
						<line x1="12" y1="18" x2="12" y2="22"/>
						<line x1="2" y1="12" x2="6" y2="12"/>
						<line x1="18" y1="12" x2="22" y2="12"/>
					</svg>
				</div>
			</div>`,
			iconSize: [48, 48],
			iconAnchor: [24, 24]
		});
	}

	/**
	 * Creates or updates the observation point marker.
	 */
	function createObservationMarker(lat: number, lng: number): void {
		if (!map || !L) return;

		// Remove existing marker if any
		if (observationMarker) {
			observationMarker.remove();
		}

		const icon = createObservationIcon(observationCalculating);
		if (!icon) return;

		observationMarker = L.marker([lat, lng], {
			icon,
			draggable: true,
			title: 'Observation point - drag to move'
		}).addTo(map);

		// Add tooltip to show it's the calculation reference point
		observationMarker.bindTooltip('Sun-hours calculated here', {
			permanent: false,
			direction: 'top',
			offset: [0, -20]
		});

		// Handle drag to reposition
		observationMarker.on('dragend', () => {
			if (!observationMarker) return;
			const pos = observationMarker.getLatLng();
			observationPoint = { lat: pos.lat, lng: pos.lng };
			onobservationchange?.({ lat: pos.lat, lng: pos.lng });
		});
	}

	/**
	 * Places the observation point at the given coordinates.
	 */
	function placeObservationPoint(lat: number, lng: number): void {
		observationPoint = { lat, lng };
		createObservationMarker(lat, lng);
		observationPlacementMode = false;
		onobservationchange?.({ lat, lng });
	}

	/**
	 * Toggles observation point placement mode.
	 */
	function toggleObservationPlacement(): void {
		observationPlacementMode = !observationPlacementMode;
		treePlacementMode = false; // Cancel tree placement if active
		if (observationPlacementMode) {
			selectedTreeId = null;
			updateAllTreeMarkers();
		}
	}

	/**
	 * Centers observation point on current map view.
	 */
	function centerObservationPoint(): void {
		if (!map) return;
		const center = map.getCenter();
		placeObservationPoint(center.lat, center.lng);
	}

	/**
	 * Creates a cache key for the given map bounds.
	 * Rounds to reduce cache misses for small pans.
	 */
	function boundsToKey(bounds: LatLngBounds): string {
		const precision = 1000; // ~100m precision
		return [
			Math.round(bounds.south * precision),
			Math.round(bounds.north * precision),
			Math.round(bounds.west * precision),
			Math.round(bounds.east * precision)
		].join(',');
	}

	/**
	 * Checks if two bounds significantly overlap.
	 * Returns true if the new bounds are mostly covered by the old bounds.
	 */
	function boundsOverlap(oldBounds: LatLngBounds | null, newBounds: LatLngBounds): boolean {
		if (!oldBounds) return false;

		// Calculate overlap percentage
		const overlapSouth = Math.max(oldBounds.south, newBounds.south);
		const overlapNorth = Math.min(oldBounds.north, newBounds.north);
		const overlapWest = Math.max(oldBounds.west, newBounds.west);
		const overlapEast = Math.min(oldBounds.east, newBounds.east);

		if (overlapNorth <= overlapSouth || overlapEast <= overlapWest) {
			return false;
		}

		const overlapArea = (overlapNorth - overlapSouth) * (overlapEast - overlapWest);
		const newArea = (newBounds.north - newBounds.south) * (newBounds.east - newBounds.west);

		// Consider overlapping if >70% of new bounds covered by old
		return overlapArea / newArea > 0.7;
	}

	/**
	 * Triggers auto tree detection for the current map view.
	 * Fetches canopy height data and extracts tree positions.
	 */
	async function detectTreesForCurrentView(): Promise<void> {
		if (!map || !enableAutoTreeDetection) return;

		// Check zoom level - don't detect when zoomed out too far
		const currentZoom = map.getZoom();
		if (currentZoom < autoTreeDetectionMinZoom) {
			autoDetectionError = `Zoom in to detect trees (current: ${currentZoom}, need: ${autoTreeDetectionMinZoom}+)`;
			return;
		}

		// Get map center for fetching
		const center = map.getCenter();

		// Create bounds for the detection area
		const detectionBounds: LatLngBounds = {
			south: center.lat - autoTreeDetectionBuffer,
			north: center.lat + autoTreeDetectionBuffer,
			west: center.lng - autoTreeDetectionBuffer,
			east: center.lng + autoTreeDetectionBuffer
		};

		// Check if we've already fetched this area
		const boundsKey = boundsToKey(detectionBounds);
		const cached = autoDetectedTreesCache.get(boundsKey);
		if (cached) {
			// Merge cached trees with manually placed trees
			mergeAutoDetectedTrees(cached);
			return;
		}

		// Skip if bounds significantly overlap with last fetch
		if (boundsOverlap(lastAutoDetectionBounds, detectionBounds)) {
			return;
		}

		autoDetectionLoading = true;
		autoDetectionError = null;
		onautodetectionstart?.();

		try {
			console.log('[TreeDetection] Starting fetch for', center.lat, center.lng);
			// Fetch canopy height data
			const canopyData = await fetchCanopyData(center.lat, center.lng, {
				bufferDegrees: autoTreeDetectionBuffer
			});
			console.log('[TreeDetection] Fetch complete, data:', canopyData ? 'received' : 'null');

			if (!canopyData) {
				// No canopy data for this area (likely water, desert, or urban)
				autoDetectionError = null; // Not an error, just no data
				lastAutoDetectionBounds = detectionBounds;
				onautodetectioncomplete?.(0);
				return;
			}

			console.log('[TreeDetection] Extracting trees from', canopyData.width, 'x', canopyData.height, 'raster');
			// Extract trees from the height raster
			const detectedTrees = extractTrees(
				canopyData.heights,
				canopyData.width,
				canopyData.height,
				canopyData.bounds,
				{
					minTreeHeight: 3,
					searchRadiusPixels: 3,
					maxTrees: autoTreeDetectionMaxTrees
				}
			);
			console.log('[TreeDetection] Extracted', detectedTrees.length, 'trees');

			// Convert to MapTree format
			const mapTrees = toMapTrees(detectedTrees, 'auto');

			// Cache the results
			autoDetectedTreesCache.set(boundsKey, mapTrees);
			lastAutoDetectionBounds = detectionBounds;

			// Merge with current trees
			mergeAutoDetectedTrees(mapTrees);

			onautodetectioncomplete?.(mapTrees.length);
		} catch (error) {
			const message = error instanceof Error ? error.message : 'Unknown error';
			console.error('Auto tree detection failed:', message, error);
			autoDetectionError = `Tree detection failed: ${message}`;
			onautodetectionerror?.(message);
		} finally {
			autoDetectionLoading = false;
		}
	}

	/**
	 * Merges auto-detected trees with manually placed trees.
	 * Avoids duplicates by checking proximity to existing trees.
	 * Filters out trees that the user has previously deleted.
	 */
	function mergeAutoDetectedTrees(autoDetected: MapTree[]): void {
		// Get manually placed or modified trees (those with IDs in manuallyPlacedTreeIds,
		// without 'auto-' prefix, or marked as modified)
		const manualTrees = trees.filter(t =>
			manuallyPlacedTreeIds.has(t.id) ||
			!t.id.startsWith('auto-') ||
			t.source === 'manual' ||
			t.modified
		);

		// Filter auto-detected trees:
		// 1. Exclude those the user has deleted
		// 2. Exclude those too close to manual/modified trees
		const minDistance = 0.00003; // ~3 meters at mid-latitudes
		const newAutoTrees = autoDetected.filter(autoTree => {
			// Skip if user has deleted this tree
			if (deletedAutoTreeIds.has(autoTree.id)) {
				return false;
			}

			// Skip if too close to a manual/modified tree
			for (const manualTree of manualTrees) {
				const latDiff = Math.abs(autoTree.lat - manualTree.lat);
				const lngDiff = Math.abs(autoTree.lng - manualTree.lng);
				if (latDiff < minDistance && lngDiff < minDistance) {
					return false;
				}
			}
			return true;
		}).map(t => ({ ...t, source: 'auto' as const })); // Ensure source is set

		// Combine manual trees with filtered auto trees
		const combinedTrees = [...manualTrees, ...newAutoTrees];

		// Update trees if changed
		if (combinedTrees.length !== trees.length ||
			combinedTrees.some((t, i) => t.id !== trees[i]?.id)) {
			trees = combinedTrees;
			ontreeschange?.(trees);
		}
	}

	/**
	 * Schedules auto tree detection with debouncing.
	 * Called on map moveend events to avoid excessive API calls.
	 */
	function scheduleAutoDetection(): void {
		if (!enableAutoTreeDetection) return;

		// Clear any pending detection
		if (autoDetectionDebounceTimeout) {
			clearTimeout(autoDetectionDebounceTimeout);
		}

		// Schedule new detection
		autoDetectionDebounceTimeout = setTimeout(() => {
			detectTreesForCurrentView();
		}, AUTO_DETECTION_DEBOUNCE_MS);
	}

	/**
	 * Resets all tree refinements to the original satellite data.
	 * Clears user modifications (deletions, edits, and manual additions),
	 * then re-fetches auto-detected trees for the current view.
	 */
	function resetToSatelliteData(): void {
		// Remove all tree markers
		for (const [, marker] of treeMarkers) {
			marker.remove();
		}
		treeMarkers.clear();

		// Clear all refinement state
		deletedAutoTreeIds.clear();
		manuallyPlacedTreeIds.clear();

		// Clear trees
		trees = [];
		selectedTreeId = null;

		// Clear cache to force re-fetch
		autoDetectedTreesCache.clear();
		lastAutoDetectionBounds = null;

		ontreeschange?.(trees);

		// Re-detect trees for the current view
		if (enableAutoTreeDetection && map) {
			detectTreesForCurrentView();
		}
	}

	/**
	 * Closes the tree config panel.
	 */
	function closeTreeConfig(): void {
		selectedTreeId = null;
		updateAllTreeMarkers();
	}

	// Toggle shadow layer visibility
	function toggleShadows(): void {
		if (!map || !shadeMapLayer) return;

		try {
			if (shadowsEnabled) {
				if (map.hasLayer(shadeMapLayer as unknown as L.Layer)) {
					map.removeLayer(shadeMapLayer as unknown as L.Layer);
				}
			} else {
				if (!map.hasLayer(shadeMapLayer as unknown as L.Layer)) {
					map.addLayer(shadeMapLayer as unknown as L.Layer);
					shadeMapLayer.setDate(shadowDateTime);
				}
			}
			shadowsEnabled = !shadowsEnabled;
		} catch (err) {
			console.error('Failed to toggle shadows:', err);
		}
	}

	onMount(async () => {
		if (!browser) return;

		// Dynamic import of Leaflet to avoid SSR issues
		L = await import('leaflet');

		// Import Leaflet CSS
		await import('leaflet/dist/leaflet.css');

		// Fix marker icon paths for bundled applications
		const iconDefault = L.icon({
			iconUrl: '/marker-icon.png',
			shadowUrl: '/marker-shadow.png',
			iconRetinaUrl: '/marker-icon-2x.png',
			iconSize: [25, 41],
			iconAnchor: [12, 41],
			popupAnchor: [1, -34],
			shadowSize: [41, 41]
		});
		L.Marker.prototype.options.icon = iconDefault;

		// Initialize map
		const center: [number, number] = initialLocation
			? [initialLocation.latitude, initialLocation.longitude]
			: defaultCenter;

		map = L.map(mapContainer).setView(center, zoom);

		// Add OpenStreetMap tiles
		L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
			attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
			maxZoom: 22,
			maxNativeZoom: 19 // OSM tiles go up to 19, higher zooms will upscale
		}).addTo(map);

		// Initialize ShadeMap layer if shadows are enabled
		if (showShadows) {
			await initShadeMap();
		}

		// If initial location provided, place marker
		if (initialLocation) {
			marker = L.marker([initialLocation.latitude, initialLocation.longitude]).addTo(map);
			selectedCoords = { lat: initialLocation.latitude, lng: initialLocation.longitude };
		}

		// Handle map clicks to place marker, tree, or observation point
		map.on('click', (e: L.LeafletMouseEvent) => {
			// Skip if click handling is disabled (e.g., when ZoneEditor is active)
			if (disableClickHandler) return;

			if (observationPlacementMode && enableObservationPoint) {
				placeObservationPoint(e.latlng.lat, e.latlng.lng);
			} else if (treePlacementMode && enableTreePlacement) {
				addTree(e.latlng.lat, e.latlng.lng);
			} else {
				placeMarker(e.latlng.lat, e.latlng.lng);
				// Deselect tree when clicking elsewhere
				if (selectedTreeId) {
					selectedTreeId = null;
					updateAllTreeMarkers();
				}
			}
		});

		// Create markers for any initial trees
		for (const tree of trees) {
			createTreeMarker(tree);
		}

		// Initialize observation point at map center if enabled
		if (enableObservationPoint) {
			const mapCenter = map.getCenter();
			// Use provided observationPoint or default to map center
			if (observationPoint) {
				createObservationMarker(observationPoint.lat, observationPoint.lng);
			} else {
				placeObservationPoint(mapCenter.lat, mapCenter.lng);
			}
		}

		// Set up auto tree detection on map movement
		if (enableAutoTreeDetection) {
			map.on('moveend', scheduleAutoDetection);

			// Trigger initial detection after map settles
			setTimeout(() => {
				scheduleAutoDetection();
			}, 500);
		}

		// Initialize search provider
		const { OpenStreetMapProvider } = await import('leaflet-geosearch');
		searchProvider = new OpenStreetMapProvider();

		// Notify parent that map is ready
		if (map) {
			onmapready?.(map);
		}
	});

	/**
	 * Initializes the ShadeMap shadow layer.
	 */
	async function initShadeMap(): Promise<void> {
		if (!map) return;

		const apiKey = import.meta.env.VITE_SHADEMAP_API_KEY;
		if (!apiKey || apiKey === 'your_api_key_here') {
			shadeMapError = 'ShadeMap API key not configured. Set VITE_SHADEMAP_API_KEY in .env';
			console.warn('ShadeMap API key not configured. Shadow layer disabled.');
			return;
		}

		shadeMapLoading = true;
		shadeMapError = null;

		try {
			const ShadeMap = (await import('leaflet-shadow-simulator')).default;

			shadeMapLayer = new ShadeMap({
				apiKey,
				date: shadowDateTime,
				color: '#01112f',
				opacity: 0.5,
				maxNativeZoom: 19, // Native rendering up to zoom 19
				maxZoom: 22, // Allow display up to zoom 22 (will upscale)
				tileSize: 512, // Larger tiles for better coverage at high zoom
				zoomOffset: 0, // No zoom offset
				terrainSource: {
					tileSize: 256,
					maxZoom: 15,
					getSourceUrl: ({ x, y, z }: { x: number; y: number; z: number }) => {
						return `https://s3.amazonaws.com/elevation-tiles-prod/terrarium/${z}/${x}/${y}.png`;
					},
					getElevation: ({ r, g, b }: { r: number; g: number; b: number }) => {
						return (r * 256 + g + b / 256) - 32768;
					}
				},
				// Load building footprints from OpenStreetMap via Overpass API
				getFeatures: async () => {
					if (!map || map.getZoom() < 16) {
						// Require higher zoom to reduce area and number of buildings
						buildingShadowsLoading = false;
						return [];
					}

					const currentZoom = map.getZoom();

					// At lot-level zoom (20+), reuse buildings from wider zoom to maintain context
					// Fetching at this zoom would get too small an area and wreck the heatmap
					if (currentZoom >= 20 && lastFetchedBuildings.length > 0) {
						console.log(`[ShadeMap] Zoom ${currentZoom}: Reusing ${lastFetchedBuildings.length} buildings from zoom ${lastFetchZoom} (prevents re-fetch at lot-level)`);
						buildingShadowsLoading = false;
						buildingFetchProgress = '';
						return lastFetchedBuildings;
					}

					const bounds = map.getBounds();
					const south = bounds.getSouth();
					const north = bounds.getNorth();
					const east = bounds.getEast();
					const west = bounds.getWest();

					// Create cache key from rounded bounds (to ~10m precision)
					const cacheKey = `buildings_${south.toFixed(4)}_${west.toFixed(4)}_${north.toFixed(4)}_${east.toFixed(4)}`;

					// Check cache first
					try {
						const cached = localStorage.getItem(cacheKey);
						if (cached) {
							const { features, timestamp } = JSON.parse(cached);
							// Cache valid for 30 days
							if (Date.now() - timestamp < 30 * 24 * 60 * 60 * 1000) {
								console.log(`[ShadeMap] Using cached building data (${features.length} buildings)`);
								buildingShadowsLoading = false;
								buildingFetchProgress = '';
								// Store in buffer for reuse at lot-level zoom (20+)
								lastFetchedBuildings = features;
								lastFetchZoom = currentZoom;
								return features;
							}
						}
					} catch (err) {
						console.warn('[ShadeMap] Cache read failed:', err);
					}

					// If building fetch not allowed, return empty (user needs to confirm site first)
					if (!allowBuildingFetch) {
						console.log('[ShadeMap] Building fetch not allowed yet (waiting for site confirmation)');
						buildingShadowsLoading = false;
						buildingFetchProgress = '';
						return [];
					}

					// Show loading indicator
					buildingShadowsLoading = true;
					buildingFetchProgress = 'Preparing query...';

					try {
						// Calculate area to avoid fetching too much data
						const latDiff = north - south;
						const lngDiff = east - west;
						const area = latDiff * lngDiff;

						// Skip if area is too large (even at high zoom)
						if (area > 0.001) {
							console.log('[ShadeMap] Area too large, skipping building fetch');
							buildingShadowsLoading = false;
							buildingFetchProgress = '';
							return [];
						}

						console.log('[ShadeMap] Fetching buildings for area:', { area, zoom: map.getZoom() });

						// Query Overpass API for buildings in the current view
						buildingFetchProgress = 'Querying OpenStreetMap (may take 10-30s)...';
						const query = `[out:json][timeout:25];(way["building"](${south},${west},${north},${east}););out body;>;out skel qt;`;
						const url = `https://overpass-api.de/api/interpreter?data=${encodeURIComponent(query)}`;

						// Add timeout to detect if API is too slow
						const controller = new AbortController();
						const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout

						let response;
						try {
							response = await fetch(url, { signal: controller.signal });
							clearTimeout(timeoutId);

							if (!response.ok) {
								console.warn('Overpass API request failed:', response.status);
								buildingShadowsLoading = false;
								buildingFetchProgress = '';
								return [];
							}
						} catch (fetchErr) {
							clearTimeout(timeoutId);
							if (fetchErr instanceof Error && fetchErr.name === 'AbortError') {
								console.warn('Overpass API request timed out after 30s');
								buildingFetchProgress = 'Request timed out - try zooming in more';
								setTimeout(() => {
									buildingShadowsLoading = false;
									buildingFetchProgress = '';
								}, 3000);
								return [];
							}
							throw fetchErr;
						}

						buildingFetchProgress = 'Parsing response...';
						const data = await response.json();

						// Convert OSM data to GeoJSON features
						buildingFetchProgress = `Processing ${data.elements?.length || 0} elements...`;
						const nodes = new Map<number, { lat: number; lon: number }>();
						const features: Array<{
							type: string;
							geometry: { type: string; coordinates: number[][][] };
							properties: { height: number; render_height: number; name?: string };
						}> = [];

						// First pass: collect all nodes
						for (const element of data.elements) {
							if (element.type === 'node') {
								nodes.set(element.id, { lat: element.lat, lon: element.lon });
							}
						}

						// Second pass: build building polygons
						buildingFetchProgress = `Building geometries...`;
						for (const element of data.elements) {
							if (element.type === 'way' && element.tags?.building) {
								const ring: number[][] = [];
								for (const nodeId of element.nodes) {
									const node = nodes.get(nodeId);
									if (node) {
										ring.push([node.lon, node.lat]);
									}
								}

								if (ring.length >= 3) {
									// Parse height from OSM tags, default to 8m (~2.5 stories)
									let height = 8;
									if (element.tags.height) {
										const parsed = parseFloat(element.tags.height);
										if (!isNaN(parsed)) height = parsed;
									} else if (element.tags['building:levels']) {
										const levels = parseInt(element.tags['building:levels'], 10);
										if (!isNaN(levels)) height = levels * 3.2;
									}

									features.push({
										type: 'Feature',
										geometry: {
											type: 'Polygon',
											coordinates: [ring] // GeoJSON Polygon needs array of rings
										},
										properties: {
											height,
											render_height: height, // ShadeMap uses render_height
											name: element.tags.name
										}
									});
								}
							}
						}

						console.log(`[ShadeMap] Loaded ${features.length} buildings from OSM`);
						buildingFetchProgress = `Rendering ${features.length} buildings...`;

						// Cache the results
						const cacheData = {
							features,
							timestamp: Date.now()
						};

						try {
							localStorage.setItem(cacheKey, JSON.stringify(cacheData));
							console.log('[ShadeMap] Cached building data for future use');
						} catch (err) {
							// If quota exceeded, clear old building caches and retry
							if (err instanceof DOMException && err.name === 'QuotaExceededError') {
								console.warn('[ShadeMap] localStorage quota exceeded, clearing old caches...');
								try {
									// Remove old building caches (older than 7 days)
									const now = Date.now();
									const maxAge = 7 * 24 * 60 * 60 * 1000; // 7 days
									const keysToRemove: string[] = [];

									for (let i = 0; i < localStorage.length; i++) {
										const key = localStorage.key(i);
										if (key && key.startsWith('buildings_')) {
											try {
												const cached = localStorage.getItem(key);
												if (cached) {
													const { timestamp } = JSON.parse(cached);
													if (now - timestamp > maxAge) {
														keysToRemove.push(key);
													}
												}
											} catch {
												keysToRemove.push(key); // Remove corrupted entries
											}
										}
									}

									keysToRemove.forEach(key => localStorage.removeItem(key));
									console.log(`[ShadeMap] Cleared ${keysToRemove.length} old cache entries`);

									// Retry caching with the same data
									localStorage.setItem(cacheKey, JSON.stringify(cacheData));
									console.log('[ShadeMap] Cached building data after cleanup');
								} catch (retryErr) {
									console.warn('[ShadeMap] Still failed to cache after cleanup:', retryErr);
								}
							} else {
								console.warn('[ShadeMap] Failed to cache building data:', err);
							}
						}

						// Small delay to show the final progress message
						setTimeout(() => {
							buildingShadowsLoading = false;
							buildingFetchProgress = '';
						}, 100);

						// Store in buffer for reuse at lot-level zoom (20+)
						lastFetchedBuildings = features;
						lastFetchZoom = currentZoom;

						return features;
					} catch (err) {
						console.warn('Failed to load buildings from Overpass:', err);
						buildingShadowsLoading = false;
						buildingFetchProgress = '';
						return [];
					}
				}
			});

			shadeMapLayer.addTo(map);

			// Debug: Check WebGL availability after adding to map
			console.log('ShadeMap layer added, checking WebGL:', {
				hasGL: !!shadeMapLayer._gl,
				hasCanvas: !!shadeMapLayer._canvas,
				canvasContext: shadeMapLayer._canvas?.getContext?.('webgl') ? 'webgl available' : 'webgl NOT available',
				canvasContext2: shadeMapLayer._canvas?.getContext?.('webgl2') ? 'webgl2 available' : 'webgl2 NOT available'
			});
			// Log all properties of the shadeMapLayer to find the GL context
			console.log('ShadeMap layer keys:', Object.keys(shadeMapLayer));
			// Check for common WebGL property names
			console.log('ShadeMap WebGL properties:', {
				gl: shadeMapLayer.gl,
				_gl: shadeMapLayer._gl,
				webgl: shadeMapLayer.webgl,
				context: shadeMapLayer.context,
				_context: shadeMapLayer._context,
				renderer: shadeMapLayer.renderer,
				_renderer: shadeMapLayer._renderer
			});

			// Notify parent that ShadeMap is ready with query interface
			if (onshademaready && map) {
				const shadeMapInterface: ShadeMapInterface = {
					isPositionInSun: async (lat: number, lng: number) => {
						if (!shadeMapLayer || !map) return true;
						const point = map.latLngToContainerPoint([lat, lng]);
						return shadeMapLayer.isPositionInSun(point.x, point.y);
					},
					setDate: (date: Date) => {
						if (shadeMapLayer) {
							shadeMapLayer.setDate(date);
						}
					},
					enableSunExposure: async (startDate: Date, endDate: Date, iterations = 32) => {
						if (shadeMapLayer) {
							try {
								// Wait for heightMap to be available (terrain tiles must load first)
								const waitForHeightMap = async (timeout = 10000): Promise<boolean> => {
									const startTime = Date.now();
									while (!shadeMapLayer._heightMap) {
										if (Date.now() - startTime > timeout) {
											console.warn('ShadeMap: Timeout waiting for heightMap');
											return false;
										}
										// Wait for idle event which fires after terrain loads
										await new Promise<void>(resolve => {
											let done = false;
											const onIdle = () => {
												if (!done) {
													done = true;
													resolve();
												}
											};
											shadeMapLayer.on('idle', onIdle);
											setTimeout(() => {
												if (!done) {
													done = true;
													resolve();
												}
											}, 500);
										});
									}
									return true;
								};

								const hasHeightMap = await waitForHeightMap();

								if (!hasHeightMap) {
									console.error('ShadeMap: Cannot enable sun exposure - heightMap not available');
									return;
								}

								// Force a render cycle by calling setDate - this triggers _flush()
								// which processes the heightMap and prepares it for sun exposure
								const currentDate = shadeMapLayer.options.date || new Date();
								const tempDate = new Date(currentDate.getTime() + 1);
								shadeMapLayer.setDate(tempDate);
								shadeMapLayer.setDate(currentDate);

								// Wait for the render to complete
								await new Promise<void>(resolve => {
									let done = false;
									const onIdle = () => {
										if (!done) {
											done = true;
											resolve();
										}
									};
									shadeMapLayer.on('idle', onIdle);
									setTimeout(() => {
										if (!done) {
											done = true;
											resolve();
										}
									}, 2000);
								});

								// Give the kernel a moment to fully initialize after heightMap loads
								await new Promise(resolve => setTimeout(resolve, 100));

								// setSunExposure returns a Promise - we must await it!
								await shadeMapLayer.setSunExposure(true, {
									startDate,
									endDate,
									iterations
								});

								// Wait for idle event to ensure rendering is complete
								await new Promise<void>((resolve) => {
									let resolved = false;
									const onIdle = () => {
										if (resolved) return;
										resolved = true;
										resolve();
									};
									shadeMapLayer.on('idle', onIdle);
									// Timeout fallback
									setTimeout(() => {
										if (resolved) return;
										resolved = true;
										resolve();
									}, 5000);
								});
							} catch (err) {
								console.error('ShadeMap setSunExposure failed:', err);
								throw err;
							}
						}
					},
					disableSunExposure: () => {
						if (shadeMapLayer) {
							shadeMapLayer.setSunExposure(false, {});
						}
					},
					getHoursOfSun: (lat: number, lng: number) => {
						if (!shadeMapLayer || !map) return null;
						if (!shadeMapLayer.options?.sunExposure?.enabled) return 0;

						const point = map.latLngToContainerPoint([lat, lng]);
						const gl: WebGLRenderingContext = shadeMapLayer._gl;
						const canvas = shadeMapLayer._canvas;

						if (!gl || !canvas) return null;

						// Debug: Check all canvases on the page
						const allCanvases = document.querySelectorAll('canvas');
						console.log(`[getHoursOfSun] Found ${allCanvases.length} canvas elements on page`);
						allCanvases.forEach((c, i) => {
							console.log(`  Canvas ${i}: ${c.width}x${c.height}, class="${c.className}", visible=${c.offsetParent !== null}`);
						});
						console.log(`[getHoursOfSun] Reading from ShadeMap canvas: ${canvas.width}x${canvas.height}, class="${canvas.className}"`);

						// Check if ShadeMap has other properties that might point to the sun exposure buffer
						console.log('[getHoursOfSun] ShadeMap sun exposure properties:', {
							enabled: shadeMapLayer.options?.sunExposure?.enabled,
							startDate: shadeMapLayer.options?.sunExposure?.startDate,
							endDate: shadeMapLayer.options?.sunExposure?.endDate,
							iterations: shadeMapLayer.options?.sunExposure?.iterations,
							_sunExposureCanvas: shadeMapLayer._sunExposureCanvas !== undefined,
							_sunExposureTexture: shadeMapLayer._sunExposureTexture !== undefined,
							_sunExposureBuffer: shadeMapLayer._sunExposureBuffer !== undefined
						});

						// Read pixel directly using correct Y coordinate
						// ShadeMap's readPixel uses window.innerHeight which is WRONG when canvas doesn't fill window
						// WebGL Y-axis is flipped (0 at bottom), and we need to use canvas height, not window height
						const x = Math.floor(point.x);
						const y = canvas.height - Math.floor(point.y); // Flip Y: screen coords -> WebGL coords

						// Bounds check
						if (x < 0 || x >= canvas.width || y < 0 || y >= canvas.height) {
							return null;
						}

						// Force WebGL to finish all pending operations before reading pixels
						// This ensures the framebuffer is fully rendered and not in an intermediate state
						console.log('[getHoursOfSun] Calling gl.finish()...');
						gl.finish();

						// Check for GL errors
						const glError = gl.getError();
						console.log(`[getHoursOfSun] GL error after finish: ${glError} (0 = no error)`);

						// Check what framebuffer we're reading from
						const boundFB = gl.getParameter(gl.FRAMEBUFFER_BINDING);
						console.log(`[getHoursOfSun] Bound framebuffer: ${boundFB} (null = default/screen)`);

						// Check viewport
						const viewport = gl.getParameter(gl.VIEWPORT);
						console.log(`[getHoursOfSun] GL Viewport: [${viewport[0]}, ${viewport[1]}, ${viewport[2]}, ${viewport[3]}]`);

						// Sample a 3x3 grid of pixels around the target to check for coordinate issues
						const sampleSize = 9;
						const samples = new Uint8Array(sampleSize * 4);
						const sampleX = Math.max(0, x - 1);
						const sampleY = Math.max(0, y - 1);
						const sampleW = Math.min(3, canvas.width - sampleX);
						const sampleH = Math.min(3, canvas.height - sampleY);
						gl.readPixels(sampleX, sampleY, sampleW, sampleH, gl.RGBA, gl.UNSIGNED_BYTE, samples);

						// Log all sampled pixels
						console.log('[getHoursOfSun] 3x3 pixel sample around target:');
						for (let dy = 0; dy < sampleH; dy++) {
							for (let dx = 0; dx < sampleW; dx++) {
								const idx = (dy * sampleW + dx) * 4;
								const r = samples[idx];
								const g = samples[idx + 1];
								const b = samples[idx + 2];
								const a = samples[idx + 3];
								const isCenterPixel = (dx === 1 && dy === 1);
								console.log(`  [${dx-1},${dy-1}]${isCenterPixel ? ' (TARGET)' : ''}: [${r}, ${g}, ${b}, ${a}]`);
							}
						}

						const pixel = new Uint8Array(4);
						gl.readPixels(x, y, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, pixel);

						// Check for GL errors after reading
						const readError = gl.getError();
						console.log(`[getHoursOfSun] GL error after readPixels: ${readError} (0 = no error)`);

						// Debug: Log canvas and GL state
						console.log(`[getHoursOfSun] Canvas: ${canvas.width}x${canvas.height}, GL: ${gl.drawingBufferWidth}x${gl.drawingBufferHeight}`);
						console.log(`[getHoursOfSun] Point: screen(${point.x.toFixed(1)}, ${point.y.toFixed(1)}) -> GL(${x}, ${y})`);
						console.log(`[getHoursOfSun] Pixel RGBA: [${pixel[0]}, ${pixel[1]}, ${pixel[2]}, ${pixel[3]}]`);

						// Log what the pixel SHOULD look like based on visual heatmap color
						// Red = lots of sun, Blue = little sun
						if (pixel[0] > pixel[2]) {
							console.log('[getHoursOfSun] Pixel is RED-ish (high sun exposure)');
						} else if (pixel[2] > pixel[0]) {
							console.log('[getHoursOfSun] Pixel is BLUE-ish (low sun exposure)');
						} else if (pixel[1] > 0) {
							console.log('[getHoursOfSun] Pixel is GREEN-ish (medium sun exposure)');
						} else {
							console.log('[getHoursOfSun] Pixel is BLACK (no data or error)');
						}

						// Check if any nearby pixels have different values
						let hasVariation = false;
						for (let i = 0; i < sampleSize; i++) {
							const idx = i * 4;
							if (samples[idx] !== pixel[0] || samples[idx+1] !== pixel[1] || samples[idx+2] !== pixel[2]) {
								hasVariation = true;
								break;
							}
						}
						if (hasVariation) {
							console.log('[getHoursOfSun] ⚠️  WARNING: Nearby pixels have different colors! Coordinate might be slightly off.');
						} else {
							console.log('[getHoursOfSun] ✓ Nearby pixels are consistent');
						}

						// Decode hours from pixel using ShadeMap's V() formula
						// V(pixel, 0.5, timeRange) formula from ShadeMap source
						const sunExposureOpts = shadeMapLayer.options.sunExposure;
						const startDate = sunExposureOpts?.startDate;
						const endDate = sunExposureOpts?.endDate;

						console.log(`[getHoursOfSun] Sun exposure opts:`, { enabled: sunExposureOpts?.enabled, startDate, endDate });

						if (!startDate || !endDate) {
							console.warn('[getHoursOfSun] No start/end date in sun exposure options');
							return 0;
						}

						const timeRange = endDate.getTime() - startDate.getTime();
						const e = 0.5;
						const o = 1 / e; // = 2

						// Scale RGB channels
						const r = Math.min(pixel[0] * o, 255);
						const g = Math.min(pixel[1] * o, 255);
						const b = Math.min(pixel[2] * o, 255);

						console.log(`[getHoursOfSun] Scaled RGB: [${r}, ${g}, ${b}]`);

						let s = 0;
						if (r + g + b !== 0) {
							// R channel indicates more sun, B channel indicates less sun
							s = r > 0 ? (r / 255) * 0.5 + 0.5 : b > 0 ? 0.5 * (1 - b / 255) : 0.5;
						}

						const hoursMs = s * timeRange;
						const hours = Math.abs(hoursMs / 1000 / 3600);

						console.log(`[getHoursOfSun] s=${s}, timeRange=${timeRange}ms, hours=${hours.toFixed(2)}`);

						return hours;
					},
					isAvailable: () => !!shadeMapLayer,
					waitForIdle: () => {
						if (!shadeMapLayer) return Promise.resolve();
						return new Promise<void>((resolve) => {
							let resolved = false;
							const onIdle = () => {
								if (resolved) return;
								resolved = true;
								resolve();
							};
							shadeMapLayer.on('idle', onIdle);
							// Timeout fallback
							setTimeout(() => {
								if (resolved) return;
								resolved = true;
								resolve();
							}, 10000);
						});
					},
					refreshBuildings: () => {
						if (!shadeMapLayer || !map) return;
						// Force ShadeMap to reload building data by triggering a redraw
						// Toggle the date to force a re-render which will call getFeatures
						const currentDate = shadeMapLayer.options.date || new Date();
						const tempDate = new Date(currentDate.getTime() + 1);
						shadeMapLayer.setDate(tempDate);
						shadeMapLayer.setDate(currentDate);
					},
					setObservationCalculating: (isCalculating: boolean) => {
						observationCalculating = isCalculating;
					},
					captureMapImage: async (): Promise<string | null> => {
						if (!map) return null;

						try {
							// Dynamically import html2canvas
							const html2canvas = (await import('html2canvas')).default;

							// Get the map container
							const mapContainer = map.getContainer();

							// Capture the map container as canvas
							const canvas = await html2canvas(mapContainer, {
								useCORS: true,
								allowTaint: true,
								backgroundColor: null,
								scale: 1, // 1x scale for performance
								logging: false
							});

							// Convert to data URL
							return canvas.toDataURL('image/png');
						} catch (err) {
							console.error('Failed to capture map image:', err);
							return null;
						}
					}
				};
				localShadeMapInterface = shadeMapInterface;
				onshademaready(shadeMapInterface);
			}
		} catch (err) {
			console.error('Failed to initialize ShadeMap:', err);
			shadeMapError = 'Failed to load shadow layer. Check console for details.';
		} finally {
			shadeMapLoading = false;
		}
	}

	// Cleanup on unmount
	onDestroy(() => {
		// Clean up tree markers
		for (const [, treeMarker] of treeMarkers) {
			treeMarker.remove();
		}
		treeMarkers.clear();

		// Clean up tree shadow polygons
		clearTreeShadows();

		// Clean up observation marker
		if (observationMarker) {
			observationMarker.remove();
			observationMarker = null;
		}

		// Clean up persistence save timeout
		if (persistenceSaveTimeout) {
			clearTimeout(persistenceSaveTimeout);
		}

		// Clean up auto detection debounce timeout
		if (autoDetectionDebounceTimeout) {
			clearTimeout(autoDetectionDebounceTimeout);
		}

		// Clean up shadow render timeout
		if (shadowRenderTimeout) {
			clearTimeout(shadowRenderTimeout);
		}

		// Remove auto detection listener
		if (map && enableAutoTreeDetection) {
			map.off('moveend', scheduleAutoDetection);
		}

		if (shadeMapLayer && map) {
			map.removeLayer(shadeMapLayer as unknown as L.Layer);
		}
		shadeMapLayer = null;
		map?.remove();
		map = null;
		marker = null;
	});

	// Sync tree markers when trees array changes externally
	$effect(() => {
		if (!map || !L) return;

		// Get current tree IDs
		const currentIds = new Set(trees.map((t) => t.id));

		// Remove markers for deleted trees
		for (const [id, treeMarker] of treeMarkers) {
			if (!currentIds.has(id)) {
				treeMarker.remove();
				treeMarkers.delete(id);
			}
		}

		// Create/update markers for trees
		for (const tree of trees) {
			if (!treeMarkers.has(tree.id)) {
				createTreeMarker(tree);
			}
		}
	});

	// Update shadow layer when time changes (only in Time of Day mode)
	$effect(() => {
		// Only update time-of-day shadows when in shadows mode
		if (shadowViewMode !== 'shadows') return;

		if (shadeMapLayer && shadowsEnabled) {
			// Update ShadeMap to show building/terrain shadows at this time
			shadeMapLayer.setDate(shadowDateTime);
		}

		// Update tree shadows immediately when time changes (smooth scrubbing)
		updateTreeShadowsForTimeChange();
	});

	// Update tree shadows when trees change (position, size, or number)
	$effect(() => {
		// Track trees array for changes
		void trees.length;
		void trees.map((t) => `${t.id}:${t.lat}:${t.lng}:${t.height}:${t.canopyWidth}:${t.type}`).join(',');
		// Debounce geometry changes (wait for dragging to finish)
		scheduleTreeShadowUpdate();
	});

	// Update tree shadows when shadow toggle changes
	$effect(() => {
		void shadowsEnabled;
		if (map && L) {
			// Immediate update when toggling shadows on/off
			if (shadowsEnabled) {
				updateTreeShadows(true);
			} else {
				clearTreeShadows();
			}
		}
	});

	// Manage sun exposure mode based on view mode
	$effect(() => {
		const mode = shadowViewMode;
		const sm = shadeMapLayer;
		const smInterface = localShadeMapInterface;

		if (!sm || !shadowsEnabled) return;

		if (mode === 'solar-hours') {
			// SOLAR HOURS MODE: Show heatmap only, no shadows

			// Clear tree shadows (not meaningful in aggregate view)
			clearTreeShadows();

			// Enable sun exposure heatmap for full day using the proper interface method
			// This ensures heightMap and terrain data are ready before enabling sun exposure
			const date = shadowDate;
			const startOfDay = new Date(date);
			startOfDay.setHours(0, 0, 0, 0);
			const endOfDay = new Date(date);
			endOfDay.setHours(23, 59, 59, 999);

			buildingShadowsLoading = true;

			// Use the proper enableSunExposure method which handles initialization
			if (smInterface && map) {
				(async () => {
					console.log('[ShadeMap] Enabling sun exposure for full day analysis');

					// Store current zoom to restore after enabling sun exposure
					const currentZoom = map.getZoom();
					const currentCenter = map.getCenter();

					// At zoom 20+, temporarily zoom to 18 for sun exposure calculation
					// This ensures minimum area coverage for proper edge effects (magnifying glass principle)
					const calculationZoom = Math.min(currentZoom, 18);

					if (currentZoom > 18) {
						console.log(`[ShadeMap] Temporarily zooming to ${calculationZoom} for minimum area coverage (current: ${currentZoom})`);
						map.setView(currentCenter, calculationZoom, { animate: false });
						// Brief wait for map to update bounds
						await new Promise(resolve => setTimeout(resolve, 100));
					}

					try {
						await smInterface.enableSunExposure(startOfDay, endOfDay, 24);

						// Restore original zoom after sun exposure is calculated
						if (currentZoom > 18) {
							await new Promise(resolve => setTimeout(resolve, 100));
							map.setView(currentCenter, currentZoom, { animate: false });
							console.log(`[ShadeMap] Restored zoom to ${currentZoom}`);
						}
						console.log('[ShadeMap] Sun exposure enabled successfully');
						buildingShadowsLoading = false;
					} catch (err) {
						// Restore zoom even on error
						if (currentZoom > 18) {
							map.setView(currentCenter, currentZoom, { animate: false });
						}
						console.error('Failed to enable sun exposure:', err);
						buildingShadowsLoading = false;
					}
				})();
			} else {
				console.warn('[ShadeMap] Cannot enable sun exposure - interface not ready');
				buildingShadowsLoading = false;
			}
		} else {
			// TIME OF DAY MODE: Show shadows at specific time only
			// (Site phase - for exploring shadow patterns throughout the day/year)

			// Disable sun exposure mode if it was enabled
			if (smInterface) {
				smInterface.disableSunExposure();
			}

			// Show time-of-day building/terrain shadows
			sm.setDate(shadowDateTime);

			// Show tree shadows for this time
			updateTreeShadows(true);
		}
	});

	// Sync observation marker when observationPoint prop changes externally
	$effect(() => {
		if (!map || !L || !enableObservationPoint || !observationPoint) return;

		// Check if marker position matches prop
		if (observationMarker) {
			const pos = observationMarker.getLatLng();
			if (Math.abs(pos.lat - observationPoint.lat) > 0.00001 ||
				Math.abs(pos.lng - observationPoint.lng) > 0.00001) {
				observationMarker.setLatLng([observationPoint.lat, observationPoint.lng]);
			}
		} else {
			createObservationMarker(observationPoint.lat, observationPoint.lng);
		}
	});

	// Update observation marker icon when calculation state changes
	$effect(() => {
		if (!map || !L || !observationMarker || !observationPoint) return;

		// Recreate the icon with the current loading state
		const isLoading = observationCalculating;
		const newIcon = createObservationIcon(isLoading);
		if (newIcon) {
			observationMarker.setIcon(newIcon);
		}
	});

	// Load stored trees and observation point when a new location is selected.
	// This only runs when persistTrees is enabled and the location has changed
	// significantly (different storage key).
	$effect(() => {
		if (!persistTrees || !browser || !selectedCoords) return;

		// Check if we've already loaded for this location (rounded coordinates)
		const roundedLat = Math.round(selectedCoords.lat * 1000) / 1000;
		const roundedLng = Math.round(selectedCoords.lng * 1000) / 1000;

		if (persistenceLocation &&
			Math.abs(persistenceLocation.lat - roundedLat) < 0.001 &&
			Math.abs(persistenceLocation.lng - roundedLng) < 0.001) {
			return; // Already loaded for this location
		}

		// Load stored data for this location
		const stored = loadLocationData(selectedCoords.lat, selectedCoords.lng);
		if (stored) {
			// Update trees from storage
			if (stored.trees.length > 0) {
				trees = stored.trees;
				ontreeschange?.(trees);
			}

			// Update observation point from storage if enabled
			if (stored.observationPoint && enableObservationPoint) {
				observationPoint = stored.observationPoint;
				onobservationchange?.(stored.observationPoint);
			}

			// Restore deleted auto tree IDs
			if (stored.deletedAutoTreeIds?.length) {
				deletedAutoTreeIds = new Set(stored.deletedAutoTreeIds);
			}
		}

		persistenceLocation = { lat: roundedLat, lng: roundedLng };
		persistenceLoaded = true;
	});

	// Save trees and observation point to localStorage when they change.
	// Uses debouncing to avoid excessive writes during rapid dragging.
	$effect(() => {
		if (!persistTrees || !browser || !persistenceLoaded || !selectedCoords) return;

		// Capture current values for the debounced save
		const currentTrees = trees;
		const currentObservation = observationPoint;
		const currentDeletedIds = Array.from(deletedAutoTreeIds);
		const lat = selectedCoords.lat;
		const lng = selectedCoords.lng;

		// Cancel any pending save
		if (persistenceSaveTimeout) {
			clearTimeout(persistenceSaveTimeout);
		}

		// Debounce saves to batch rapid updates (e.g., dragging a tree)
		persistenceSaveTimeout = setTimeout(() => {
			saveLocationData(lat, lng, currentTrees, currentObservation, currentDeletedIds);
		}, 500);
	});

	/**
	 * Places a marker at the given coordinates and emits the selection event.
	 */
	function placeMarker(lat: number, lng: number): void {
		if (!map || !L) return;

		// Remove existing marker
		if (marker) {
			marker.remove();
		}

		// Create new marker
		marker = L.marker([lat, lng]).addTo(map);
		selectedCoords = { lat, lng };

		// Get timezone for the location
		const tzResult = getTimezone({ latitude: lat, longitude: lng });

		const location: Location = {
			latitude: lat,
			longitude: lng,
			timezone: tzResult.timezone,
			timezoneIsEstimate: tzResult.isEstimate
		};

		onselect?.(location);
	}

	/**
	 * Handles search input with debouncing.
	 */
	let searchTimeout: ReturnType<typeof setTimeout> | null = null;

	function handleSearchInput(): void {
		if (searchTimeout) clearTimeout(searchTimeout);

		if (!searchQuery.trim()) {
			searchResults = [];
			showResults = false;
			return;
		}

		searchTimeout = setTimeout(async () => {
			await performSearch();
		}, 300);
	}

	/**
	 * Performs the search using OpenStreetMap provider.
	 */
	async function performSearch(): Promise<void> {
		if (!searchProvider || !searchQuery.trim()) return;

		searchLoading = true;
		searchResults = [];

		try {
			const results = await searchProvider.search({ query: searchQuery });
			searchResults = results.map((r) => ({
				label: r.label,
				x: r.x,
				y: r.y
			}));
			showResults = searchResults.length > 0;
		} catch {
			searchResults = [];
			showResults = false;
		} finally {
			searchLoading = false;
		}
	}

	/**
	 * Selects a search result and moves the map to that location.
	 */
	function selectSearchResult(result: { label: string; x: number; y: number }): void {
		if (!map) return;

		const lat = result.y;
		const lng = result.x;

		map.setView([lat, lng], 13);
		placeMarker(lat, lng);

		searchQuery = result.label;
		searchResults = [];
		showResults = false;
	}

	/**
	 * Requests the user's current location via browser geolocation.
	 */
	async function requestGPS(): Promise<void> {
		if (!navigator.geolocation) {
			gpsError = 'Geolocation is not supported by your browser.';
			return;
		}

		gpsLoading = true;
		gpsError = null;

		try {
			const position = await new Promise<GeolocationPosition>((resolve, reject) => {
				navigator.geolocation.getCurrentPosition(resolve, reject, {
					enableHighAccuracy: true,
					timeout: 10000,
					maximumAge: 60000
				});
			});

			const lat = position.coords.latitude;
			const lng = position.coords.longitude;

			if (map) {
				map.setView([lat, lng], 15);
			}
			placeMarker(lat, lng);
		} catch (error) {
			if (error instanceof GeolocationPositionError) {
				switch (error.code) {
					case error.PERMISSION_DENIED:
						gpsError = 'Location access was denied.';
						break;
					case error.POSITION_UNAVAILABLE:
						gpsError = 'Could not determine your location.';
						break;
					case error.TIMEOUT:
						gpsError = 'Location request timed out.';
						break;
					default:
						gpsError = 'Error getting location.';
				}
			} else {
				gpsError = 'Unexpected error getting location.';
			}
		} finally {
			gpsLoading = false;
		}
	}

	/**
	 * Formats coordinates for display.
	 */
	function formatCoords(lat: number, lng: number): string {
		const latDir = lat >= 0 ? 'N' : 'S';
		const lngDir = lng >= 0 ? 'E' : 'W';
		return `${Math.abs(lat).toFixed(4)}° ${latDir}, ${Math.abs(lng).toFixed(4)}° ${lngDir}`;
	}

	/**
	 * Closes search results when clicking outside.
	 */
	function handleClickOutside(event: MouseEvent): void {
		const target = event.target as HTMLElement;
		if (!target.closest('.search-container')) {
			showResults = false;
		}
	}
</script>

<svelte:window onclick={handleClickOutside} />

<div class="map-picker">
	<div class="controls">
		<div class="search-container">
			<input
				type="text"
				bind:value={searchQuery}
				oninput={handleSearchInput}
				placeholder="Search for a location..."
				aria-label="Search location"
				class="search-input"
			/>
			{#if searchLoading}
				<span class="search-spinner" aria-hidden="true"></span>
			{/if}

			{#if showResults && searchResults.length > 0}
				<ul class="search-results" role="listbox">
					{#each searchResults as result}
						<li>
							<button
								type="button"
								role="option"
								aria-selected="false"
								class="result-item"
								onclick={() => selectSearchResult(result)}
							>
								{result.label}
							</button>
						</li>
					{/each}
				</ul>
			{/if}
		</div>

		{#if enableObservationPoint}
			<button
				type="button"
				class="observation-button"
				class:active={observationPlacementMode}
				onclick={toggleObservationPlacement}
				title={observationPlacementMode ? 'Cancel observation point placement' : 'Move observation point'}
			>
				<svg
					xmlns="http://www.w3.org/2000/svg"
					width="18"
					height="18"
					viewBox="0 0 24 24"
					fill="none"
					stroke={observationPlacementMode ? 'white' : 'currentColor'}
					stroke-width="2"
					aria-hidden="true"
				>
					<circle cx="12" cy="12" r="3"/>
					<line x1="12" y1="2" x2="12" y2="6"/>
					<line x1="12" y1="18" x2="12" y2="22"/>
					<line x1="2" y1="12" x2="6" y2="12"/>
					<line x1="18" y1="12" x2="22" y2="12"/>
				</svg>
				<span class="visually-hidden">{observationPlacementMode ? 'Cancel' : 'Move observation point'}</span>
			</button>
		{/if}

		{#if enableTreePlacement}
			<button
				type="button"
				class="tree-button"
				class:active={treePlacementMode}
				onclick={toggleTreePlacement}
				title={treePlacementMode ? 'Cancel tree placement' : 'Add a tree'}
			>
				<svg
					xmlns="http://www.w3.org/2000/svg"
					width="18"
					height="18"
					viewBox="0 0 24 24"
					fill={treePlacementMode ? 'white' : 'currentColor'}
					stroke="none"
					aria-hidden="true"
				>
					<path d="M12 2L5 12h4v8h6v-8h4L12 2z"/>
				</svg>
				<span class="visually-hidden">{treePlacementMode ? 'Cancel' : 'Add tree'}</span>
			</button>
		{/if}

		<button
			type="button"
			class="gps-button"
			onclick={requestGPS}
			disabled={gpsLoading}
			title="Use my location"
		>
			{#if gpsLoading}
				<span class="button-spinner"></span>
			{:else}
				<svg
					xmlns="http://www.w3.org/2000/svg"
					width="18"
					height="18"
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					stroke-width="2"
					stroke-linecap="round"
					stroke-linejoin="round"
					aria-hidden="true"
				>
					<circle cx="12" cy="12" r="10" />
					<circle cx="12" cy="12" r="3" />
					<line x1="12" y1="2" x2="12" y2="6" />
					<line x1="12" y1="18" x2="12" y2="22" />
					<line x1="2" y1="12" x2="6" y2="12" />
					<line x1="18" y1="12" x2="22" y2="12" />
				</svg>
			{/if}
			<span class="visually-hidden">Use my location</span>
		</button>
	</div>

	{#if gpsError}
		<div class="gps-error" role="alert">{gpsError}</div>
	{/if}

	{#if showShadows}
		<div class="shadow-controls">
			<div class="shadow-header">
				<label class="shadow-toggle">
					<input
						type="checkbox"
						checked={shadowsEnabled}
						onchange={toggleShadows}
						disabled={shadeMapLoading || !!shadeMapError}
					/>
					<span>Show shadows</span>
				</label>
				{#if shadeMapLoading}
					<span class="shadow-loading">Loading...</span>
				{/if}
			</div>

			{#if shadeMapError}
				<div class="shadow-error" role="alert">{shadeMapError}</div>
			{:else if shadowsEnabled && shadeMapLayer && shadowViewMode === 'shadows'}
				<div class="time-controls">
					<div class="date-control">
						<label for="shadow-date">Date:</label>
						<input
							id="shadow-date"
							type="date"
							value={shadowDate instanceof Date && !isNaN(shadowDate.getTime()) ? shadowDate.toISOString().split('T')[0] : new Date().toISOString().split('T')[0]}
							onchange={(e) => {
								const target = e.target as HTMLInputElement;
								const newDate = new Date(target.value + 'T12:00:00');
								if (!isNaN(newDate.getTime())) {
									shadowDate = newDate;
								}
							}}
						/>
					</div>
					<div class="time-slider-control">
						<label for="shadow-time">Time: {formatTimeFromMinutes(shadowTimeValue)}</label>
						<input
							id="shadow-time"
							type="range"
							min="0"
							max="1439"
							step="15"
							bind:value={shadowTimeValue}
							class="time-range"
						/>
						<div class="time-labels">
							<span>12 AM</span>
							<span>6 AM</span>
							<span>12 PM</span>
							<span>6 PM</span>
							<span>12 AM</span>
						</div>
					</div>
				</div>
			{/if}
		</div>
	{/if}

	<div class="map-wrapper">
		<div bind:this={mapContainer} class="map-container" role="application" aria-label="Map"></div>

		{#if autoDetectionLoading}
			{@const currentZoom = map?.getZoom() ?? 0}
			<div class="auto-detection-indicator" role="status" aria-live="polite">
				<span class="auto-detection-spinner" aria-hidden="true"></span>
				<div class="loading-info">
					<span>Detecting trees from satellite data</span>
					<span class="loading-detail">Analyzing canopy height (zoom {currentZoom.toFixed(0)})</span>
				</div>
			</div>
		{:else if enableAutoTreeDetection && autoDetectionError}
			<div class="auto-detection-info" role="status">
				{autoDetectionError}
			</div>
		{/if}

		{#if shadowsLoading && shadowsEnabled && trees.length > 0}
			{@const treeCount = trees.length}
			{@const currentTime = formatTimeFromMinutes(shadowTimeValue)}
			{@const currentDate = shadowDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
			<div class="shadow-loading-indicator" role="status" aria-live="polite">
				<div class="loading-bar">
					<div class="loading-bar-fill"></div>
				</div>
				<span>Calculating shadows for {treeCount} tree{treeCount === 1 ? '' : 's'}</span>
				<span class="loading-detail">{currentDate} at {currentTime}</span>
			</div>
		{/if}

		{#if buildingShadowsLoading}
			{@const currentZoom = map?.getZoom() ?? 0}
			<div class="building-loading-indicator" role="status" aria-live="polite">
				<div class="loading-bar">
					<div class="loading-bar-fill"></div>
				</div>
				<span>Fetching building data from OpenStreetMap</span>
				{#if buildingFetchProgress}
					<span class="loading-detail loading-progress">{buildingFetchProgress}</span>
				{/if}
				<span class="loading-detail">Zoom level {currentZoom.toFixed(0)}</span>
			</div>
		{/if}

		{#if treePlacementMode}
			<div class="placement-hint tree-hint">Click on the map to place a tree</div>
		{:else if observationPlacementMode}
			<div class="placement-hint observation-hint">Click on the map to set observation point</div>
		{/if}

		{#if selectedTree}
			<TreeConfigPanel
				tree={selectedTree}
				onupdate={updateTree}
				ondelete={deleteTree}
				onclose={closeTreeConfig}
			/>
		{/if}
	</div>

	{#if enableObservationPoint && observationPoint}
		<div class="observation-info">
			<div class="observation-header">
				<svg
					xmlns="http://www.w3.org/2000/svg"
					width="16"
					height="16"
					viewBox="0 0 24 24"
					fill="none"
					stroke="#dc2626"
					stroke-width="2"
					aria-hidden="true"
				>
					<circle cx="12" cy="12" r="3"/>
					<line x1="12" y1="2" x2="12" y2="6"/>
					<line x1="12" y1="18" x2="12" y2="22"/>
					<line x1="2" y1="12" x2="6" y2="12"/>
					<line x1="18" y1="12" x2="22" y2="12"/>
				</svg>
				<span class="observation-label">Observation Point</span>
			</div>
			<span class="observation-coords">{formatCoords(observationPoint.lat, observationPoint.lng)}</span>
			<span class="observation-hint">Sun-hours calculated at this spot</span>
		</div>
	{/if}

	{#if enableTreePlacement && trees.length > 0}
		{@const autoTrees = trees.filter(t => t.source === 'auto' && !t.modified)}
		{@const modifiedTrees = trees.filter(t => t.source === 'auto' && t.modified)}
		{@const manualTrees = trees.filter(t => t.source === 'manual' || t.source === undefined)}
		{@const hasRefinements = deletedAutoTreeIds.size > 0 || modifiedTrees.length > 0 || manualTrees.length > 0}
		<div class="trees-info">
			<div class="trees-summary">
				<span class="trees-count">{trees.length} tree{trees.length === 1 ? '' : 's'}</span>
				{#if enableAutoTreeDetection && (autoTrees.length > 0 || modifiedTrees.length > 0)}
					<span class="trees-breakdown">
						({autoTrees.length} auto{modifiedTrees.length > 0 ? `, ${modifiedTrees.length} edited` : ''}{manualTrees.length > 0 ? `, ${manualTrees.length} manual` : ''})
					</span>
				{/if}
			</div>
			<div class="trees-actions">
				{#if enableAutoTreeDetection && hasRefinements}
					<button
						type="button"
						class="reset-trees-btn"
						onclick={resetToSatelliteData}
						title="Undo all edits and deletions, re-detect trees from satellite data"
					>
						Reset to satellite
					</button>
				{/if}
				<button
					type="button"
					class="clear-trees-btn"
					onclick={() => {
						for (const tree of trees) {
							const m = treeMarkers.get(tree.id);
							if (m) m.remove();
						}
						treeMarkers.clear();
						manuallyPlacedTreeIds.clear();
						deletedAutoTreeIds.clear();
						trees = [];
						selectedTreeId = null;
						ontreeschange?.(trees);
					}}
				>
					Clear all
				</button>
			</div>
		</div>
	{/if}

	{#if selectedCoords}
		<div class="coords-display">
			<span class="coords-label">Selected:</span>
			<span class="coords-value">{formatCoords(selectedCoords.lat, selectedCoords.lng)}</span>
		</div>
	{:else}
		<div class="coords-hint">Click on the map to select a location</div>
	{/if}
</div>

<style>
	.map-picker {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
		font-family: system-ui, -apple-system, sans-serif;
	}

	.controls {
		display: flex;
		gap: 0.5rem;
	}

	.search-container {
		flex: 1;
		position: relative;
	}

	.search-input {
		width: 100%;
		padding: 0.75rem;
		padding-right: 2.5rem;
		border: 1px solid #ccc;
		border-radius: 4px;
		font-size: 1rem;
		box-sizing: border-box;
	}

	.search-input:focus {
		outline: none;
		border-color: #0066cc;
		box-shadow: 0 0 0 2px rgba(0, 102, 204, 0.2);
	}

	.search-spinner {
		position: absolute;
		right: 0.75rem;
		top: 50%;
		transform: translateY(-50%);
		width: 1rem;
		height: 1rem;
		border: 2px solid #ccc;
		border-top-color: #0066cc;
		border-radius: 50%;
		animation: spin 0.8s linear infinite;
	}

	.search-results {
		position: absolute;
		top: 100%;
		left: 0;
		right: 0;
		z-index: 1000;
		list-style: none;
		padding: 0;
		margin: 0.25rem 0 0;
		background: white;
		border: 1px solid #ccc;
		border-radius: 4px;
		box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
		max-height: 240px;
		overflow-y: auto;
	}

	.search-results li {
		border-bottom: 1px solid #eee;
	}

	.search-results li:last-child {
		border-bottom: none;
	}

	.result-item {
		width: 100%;
		padding: 0.75rem;
		background: none;
		border: none;
		text-align: left;
		cursor: pointer;
		font-size: 0.9375rem;
		color: #333;
	}

	.result-item:hover {
		background: #f5f5f5;
	}

	.observation-button {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 48px;
		min-width: 48px;
		height: 48px;
		padding: 0;
		background: #dc2626;
		color: white;
		border: none;
		border-radius: 4px;
		cursor: pointer;
		transition: all 0.15s;
	}

	.observation-button:hover {
		background: #b91c1c;
	}

	.observation-button.active {
		background: #991b1b;
		box-shadow: inset 0 2px 4px rgba(0, 0, 0, 0.2);
	}

	.tree-button {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 48px;
		min-width: 48px;
		height: 48px;
		padding: 0;
		background: #22c55e;
		color: white;
		border: none;
		border-radius: 4px;
		cursor: pointer;
		transition: all 0.15s;
	}

	.tree-button:hover {
		background: #16a34a;
	}

	.tree-button.active {
		background: #15803d;
		box-shadow: inset 0 2px 4px rgba(0, 0, 0, 0.2);
	}

	.gps-button {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 48px;
		min-width: 48px;
		height: 48px;
		padding: 0;
		background: #0066cc;
		color: white;
		border: none;
		border-radius: 4px;
		cursor: pointer;
	}

	.gps-button:hover:not(:disabled) {
		background: #0052a3;
	}

	.gps-button:disabled {
		background: #6699cc;
		cursor: wait;
	}

	.button-spinner {
		width: 1.25rem;
		height: 1.25rem;
		border: 2px solid rgba(255, 255, 255, 0.3);
		border-top-color: white;
		border-radius: 50%;
		animation: spin 0.8s linear infinite;
	}

	@keyframes spin {
		to {
			transform: rotate(360deg);
		}
	}

	.gps-error {
		padding: 0.5rem 0.75rem;
		background: #fee;
		border: 1px solid #f5c6cb;
		border-radius: 4px;
		color: #721c24;
		font-size: 0.875rem;
	}

	.shadow-controls {
		padding: 0.75rem;
		background: #f8f9fa;
		border: 1px solid #dee2e6;
		border-radius: 4px;
	}

	.shadow-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		margin-bottom: 0.5rem;
	}

	.shadow-toggle {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		cursor: pointer;
		font-weight: 500;
		font-size: 0.9375rem;
	}

	.shadow-toggle input[type='checkbox'] {
		width: 1rem;
		height: 1rem;
		cursor: pointer;
	}

	.shadow-loading {
		font-size: 0.8125rem;
		color: #6c757d;
		font-style: italic;
	}

	.shadow-error {
		padding: 0.5rem 0.75rem;
		background: #fff3cd;
		border: 1px solid #ffeeba;
		border-radius: 4px;
		color: #856404;
		font-size: 0.8125rem;
		margin-top: 0.5rem;
	}

	.time-controls {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
		margin-top: 0.5rem;
	}

	.date-control {
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}

	.date-control label {
		font-size: 0.875rem;
		color: #495057;
		font-weight: 500;
	}

	.date-control input[type='date'] {
		padding: 0.375rem 0.5rem;
		border: 1px solid #ced4da;
		border-radius: 4px;
		font-size: 0.875rem;
	}

	.time-slider-control {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
	}

	.time-slider-control label {
		font-size: 0.875rem;
		color: #495057;
		font-weight: 500;
	}

	.time-range {
		width: 100%;
		height: 8px;
		-webkit-appearance: none;
		appearance: none;
		background: #dee2e6;
		border-radius: 4px;
		outline: none;
		cursor: pointer;
		touch-action: pan-x; /* Allow horizontal dragging, prevent vertical scroll */
	}

	.time-range::-webkit-slider-thumb {
		-webkit-appearance: none;
		appearance: none;
		width: 18px;
		height: 18px;
		background: #0066cc;
		border-radius: 50%;
		cursor: pointer;
		box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);
	}

	.time-range::-moz-range-thumb {
		width: 18px;
		height: 18px;
		background: #0066cc;
		border: none;
		border-radius: 50%;
		cursor: pointer;
		box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);
	}

	.time-labels {
		display: flex;
		justify-content: space-between;
		font-size: 0.6875rem;
		color: #6c757d;
		padding: 0 2px;
	}

	.map-wrapper {
		position: relative;
		height: 100%;
	}

	.map-container {
		width: 100%;
		height: 100%;
		min-height: 400px;
		border-radius: 4px;
		border: 1px solid #ccc;
		background: #f0f0f0;
		touch-action: pan-x pan-y; /* Allow map panning but prevent page scroll */
	}

	.placement-hint {
		position: absolute;
		bottom: 1rem;
		left: 50%;
		transform: translateX(-50%);
		padding: 0.5rem 1rem;
		color: white;
		border-radius: 4px;
		font-size: 0.875rem;
		font-weight: 500;
		pointer-events: none;
		z-index: 1000;
		box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
	}

	.placement-hint.tree-hint {
		background: rgba(34, 197, 94, 0.95);
	}

	.placement-hint.observation-hint {
		background: rgba(220, 38, 38, 0.95);
	}

	.auto-detection-indicator {
		position: absolute;
		top: 1rem;
		left: 50%;
		transform: translateX(-50%);
		display: flex;
		align-items: center;
		gap: 0.625rem;
		padding: 0.625rem 1rem;
		background: rgba(34, 197, 94, 0.95);
		color: white;
		border-radius: 6px;
		font-size: 0.875rem;
		font-weight: 500;
		pointer-events: none;
		z-index: 1000;
		box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
	}

	.auto-detection-spinner {
		width: 1rem;
		height: 1rem;
		border: 2px solid rgba(255, 255, 255, 0.3);
		border-top-color: white;
		border-radius: 50%;
		animation: spin 0.8s linear infinite;
		flex-shrink: 0;
	}

	.loading-info {
		display: flex;
		flex-direction: column;
		gap: 0.125rem;
		align-items: flex-start;
	}

	.loading-detail {
		font-size: 0.6875rem;
		opacity: 0.85;
		font-weight: 400;
	}

	.auto-detection-info {
		position: absolute;
		top: 1rem;
		left: 50%;
		transform: translateX(-50%);
		padding: 0.375rem 0.75rem;
		background: rgba(59, 130, 246, 0.9);
		color: white;
		border-radius: 4px;
		font-size: 0.75rem;
		pointer-events: none;
		z-index: 1000;
		box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
		max-width: 80%;
		text-align: center;
	}

	.shadow-loading-indicator {
		position: absolute;
		bottom: 1rem;
		left: 50%;
		transform: translateX(-50%);
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.375rem;
		padding: 0.75rem 1rem 0.625rem;
		background: rgba(15, 23, 42, 0.9);
		color: white;
		border-radius: 6px;
		font-size: 0.8125rem;
		font-weight: 500;
		pointer-events: none;
		z-index: 1000;
		box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
		min-width: 220px;
		text-align: center;
	}

	.shadow-loading-indicator .loading-detail {
		margin-top: -0.125rem;
	}

	.loading-bar {
		width: 100%;
		height: 4px;
		background: rgba(255, 255, 255, 0.2);
		border-radius: 2px;
		overflow: hidden;
	}

	.loading-bar-fill {
		height: 100%;
		background: linear-gradient(90deg, #3b82f6, #60a5fa, #3b82f6);
		background-size: 200% 100%;
		animation: loading-bar-animation 1.5s ease-in-out infinite;
		border-radius: 2px;
	}

	@keyframes loading-bar-animation {
		0% {
			transform: translateX(-100%);
			background-position: 0% 50%;
		}
		50% {
			background-position: 100% 50%;
		}
		100% {
			transform: translateX(100%);
			background-position: 0% 50%;
		}
	}

	.building-loading-indicator {
		position: absolute;
		bottom: 4.5rem;
		left: 50%;
		transform: translateX(-50%);
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.375rem;
		padding: 0.75rem 1rem 0.625rem;
		background: rgba(55, 65, 81, 0.9);
		color: white;
		border-radius: 6px;
		font-size: 0.8125rem;
		font-weight: 500;
		pointer-events: none;
		z-index: 1000;
		box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
		min-width: 240px;
		text-align: center;
	}

	.building-loading-indicator .loading-detail {
		margin-top: -0.125rem;
	}

	.observation-info {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
		padding: 0.625rem 0.75rem;
		background: #fef2f2;
		border: 1px solid #fecaca;
		border-radius: 4px;
	}

	.observation-header {
		display: flex;
		align-items: center;
		gap: 0.375rem;
	}

	.observation-label {
		font-size: 0.875rem;
		font-weight: 600;
		color: #991b1b;
	}

	.observation-coords {
		font-family: ui-monospace, monospace;
		font-size: 0.8125rem;
		color: #1c1917;
		padding-left: 1.375rem;
	}

	.observation-hint {
		font-size: 0.75rem;
		color: #dc2626;
		padding-left: 1.375rem;
	}

	.trees-info {
		display: flex;
		align-items: center;
		justify-content: space-between;
		flex-wrap: wrap;
		gap: 0.5rem;
		padding: 0.5rem 0.75rem;
		background: #f0fdf4;
		border: 1px solid #bbf7d0;
		border-radius: 4px;
	}

	.trees-summary {
		display: flex;
		align-items: center;
		gap: 0.375rem;
		flex-wrap: wrap;
	}

	.trees-count {
		font-size: 0.875rem;
		color: #166534;
		font-weight: 500;
	}

	.trees-breakdown {
		font-size: 0.75rem;
		color: #15803d;
	}

	.trees-actions {
		display: flex;
		gap: 0.375rem;
	}

	.reset-trees-btn {
		padding: 0.25rem 0.5rem;
		background: #fef3c7;
		border: 1px solid #fcd34d;
		border-radius: 4px;
		color: #92400e;
		font-size: 0.8125rem;
		cursor: pointer;
		transition: all 0.15s;
	}

	.reset-trees-btn:hover {
		background: #fde68a;
		border-color: #f59e0b;
	}

	.clear-trees-btn {
		padding: 0.25rem 0.5rem;
		background: transparent;
		border: 1px solid #86efac;
		border-radius: 4px;
		color: #166534;
		font-size: 0.8125rem;
		cursor: pointer;
		transition: all 0.15s;
	}

	.clear-trees-btn:hover {
		background: #dcfce7;
		border-color: #22c55e;
	}

	.coords-display {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.75rem;
		background: #f0f7ff;
		border: 1px solid #b3d4fc;
		border-radius: 4px;
	}

	.coords-label {
		color: #555;
		font-size: 0.875rem;
	}

	.coords-value {
		font-family: monospace;
		font-weight: 500;
		color: #1a1a1a;
	}

	.coords-hint {
		padding: 0.75rem;
		background: #f5f5f5;
		border: 1px solid #ddd;
		border-radius: 4px;
		color: #666;
		font-size: 0.875rem;
		text-align: center;
	}

	.visually-hidden {
		position: absolute;
		width: 1px;
		height: 1px;
		padding: 0;
		margin: -1px;
		overflow: hidden;
		clip: rect(0, 0, 0, 0);
		white-space: nowrap;
		border: 0;
	}

	/* Responsive adjustments for mobile */
	@media (max-width: 640px) {
		.map-picker {
			gap: 0.5rem;
		}

		.controls {
			flex-wrap: wrap;
			gap: 0.5rem;
		}

		.search-container {
			flex: 1 1 100%;
			order: 1;
		}

		.search-input {
			font-size: 16px; /* Prevents zoom on iOS */
			padding: 0.875rem;
			min-height: 48px;
		}

		.observation-button,
		.tree-button,
		.gps-button {
			flex: 1;
			order: 2;
			min-width: 0;
			min-height: 48px;
		}

		.map-container {
			height: 350px;
			min-height: 280px;
		}

		/* Larger touch target for time slider */
		.time-range {
			height: 12px;
		}

		.time-range::-webkit-slider-thumb {
			width: 28px;
			height: 28px;
		}

		.time-range::-moz-range-thumb {
			width: 28px;
			height: 28px;
		}

		.shadow-controls {
			padding: 0.625rem;
		}

		.shadow-toggle {
			gap: 0.625rem;
		}

		.shadow-toggle input[type='checkbox'] {
			width: 1.25rem;
			height: 1.25rem;
		}

		.time-controls {
			gap: 0.625rem;
		}

		.date-control {
			flex-direction: column;
			align-items: stretch;
			gap: 0.25rem;
		}

		.date-control input[type='date'] {
			font-size: 16px; /* Prevents iOS zoom */
			padding: 0.625rem;
			min-height: 44px;
		}

		.time-slider-control label {
			font-size: 0.9375rem;
		}

		.time-labels {
			font-size: 0.625rem;
		}

		.placement-hint {
			padding: 0.625rem 1rem;
			font-size: 0.9375rem;
			bottom: 0.75rem;
			left: 0.5rem;
			right: 0.5rem;
			transform: none;
			text-align: center;
		}

		.observation-info,
		.trees-info,
		.coords-display,
		.coords-hint {
			padding: 0.625rem;
		}

		.observation-info {
			flex-direction: row;
			flex-wrap: wrap;
			align-items: center;
			gap: 0.5rem;
		}

		.observation-header {
			flex: 0 0 auto;
		}

		.observation-coords {
			padding-left: 0;
			flex: 1;
		}

		.observation-hint {
			display: none; /* Hide on mobile to save space */
		}

		.result-item {
			padding: 0.875rem;
			font-size: 1rem;
			min-height: 48px;
		}

		.gps-error {
			font-size: 0.8125rem;
		}

		.clear-trees-btn {
			padding: 0.5rem 0.75rem;
			min-height: 36px;
		}
	}

	/* Extra small screens */
	@media (max-width: 380px) {
		.map-container {
			height: 280px;
		}

		.controls {
			gap: 0.375rem;
		}

		.time-labels span:nth-child(2),
		.time-labels span:nth-child(4) {
			display: none; /* Hide 6AM/6PM labels on very small screens */
		}
	}

	/* Observation marker loading animation */
	@keyframes fillProgress {
		0% {
			stroke-dashoffset: 138.23;
		}
		50% {
			stroke-dashoffset: 0;
		}
		100% {
			stroke-dashoffset: -138.23;
		}
	}

	/* Global animation for observation marker (since icon is in HTML string) */
	:global(.observation-marker-icon .loading-ring .progress-circle) {
		animation: fillProgress 3s ease-in-out infinite;
		filter: drop-shadow(0 0 4px rgba(220, 38, 38, 0.8));
	}
</style>
