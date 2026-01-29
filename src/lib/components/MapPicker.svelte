<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { browser } from '$app/environment';
	import { getTimezone, type Location, type Coordinates } from '$lib/geo';

	/**
	 * Props for the MapPicker component.
	 */
	interface MapPickerProps {
		initialLocation?: Coordinates;
		zoom?: number;
		onselect?: (location: Location) => void;
	}

	let { initialLocation, zoom = 10, onselect }: MapPickerProps = $props();

	// Map container element reference
	let mapContainer: HTMLDivElement;

	// Map instance (typed as any since Leaflet is dynamically imported)
	let map: L.Map | null = $state(null);
	let marker: L.Marker | null = $state(null);

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

	// Store provider and L module for use outside onMount
	let searchProvider: InstanceType<typeof import('leaflet-geosearch').OpenStreetMapProvider> | null =
		null;
	let L: typeof import('leaflet') | null = null;

	// Default center (San Francisco) if no initial location provided
	const defaultCenter: [number, number] = [37.7749, -122.4194];

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
			maxZoom: 19
		}).addTo(map);

		// If initial location provided, place marker
		if (initialLocation) {
			marker = L.marker([initialLocation.latitude, initialLocation.longitude]).addTo(map);
			selectedCoords = { lat: initialLocation.latitude, lng: initialLocation.longitude };
		}

		// Handle map clicks to place marker
		map.on('click', (e: L.LeafletMouseEvent) => {
			placeMarker(e.latlng.lat, e.latlng.lng);
		});

		// Initialize search provider
		const { OpenStreetMapProvider } = await import('leaflet-geosearch');
		searchProvider = new OpenStreetMapProvider();
	});

	// Cleanup on unmount
	onDestroy(() => {
		map?.remove();
		map = null;
		marker = null;
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

	<div bind:this={mapContainer} class="map-container" role="application" aria-label="Map"></div>

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

	.map-container {
		width: 100%;
		height: 400px;
		min-height: 300px;
		border-radius: 4px;
		border: 1px solid #ccc;
		background: #f0f0f0;
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

	/* Responsive adjustments */
	@media (max-width: 480px) {
		.map-container {
			height: 300px;
		}

		.search-input {
			font-size: 16px; /* Prevents zoom on iOS */
		}
	}
</style>
