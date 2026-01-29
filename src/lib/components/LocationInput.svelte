<script lang="ts">
	import {
		geocodeAddress,
		getGeocodingErrorMessage,
		parseCoordinates,
		getParseErrorMessage,
		formatCoordinates,
		getTimezone,
		type Location,
		type LocationResult,
		type GeocodingError,
		type ParseError
	} from '$lib/geo';
	import MapPicker from './MapPicker.svelte';

	/**
	 * Input mode determines which UI is shown for location entry.
	 * - map: Interactive map picker (default)
	 * - search: Address search using Nominatim geocoding
	 * - coordinates: Manual lat/lon entry with format detection
	 */
	type InputMode = 'map' | 'search' | 'coordinates';

	/**
	 * Source of the current location, used for attribution display.
	 */
	type LocationSource = 'map' | 'geocoding' | 'manual' | 'geolocation';

	/**
	 * Component props for LocationInput.
	 */
	interface LocationInputProps {
		onselect?: (location: Location, source: LocationSource, attribution?: string) => void;
		onclear?: () => void;
		initialMode?: InputMode;
	}

	let { onselect, onclear, initialMode = 'map' }: LocationInputProps = $props();

	// State for input mode selection - map is the default
	let mode: InputMode = $state(initialMode);

	// Mobile map collapsed state
	let mapCollapsed = $state(false);

	// Address search state
	let searchQuery = $state('');
	let searchLoading = $state(false);
	let searchError = $state<GeocodingError | null>(null);
	let searchResults = $state<LocationResult[]>([]);
	let showResults = $state(false);

	// Manual coordinates state
	let coordsInput = $state('');
	let coordsError = $state<ParseError | null>(null);
	let coordsPreview = $state<{ lat: number; lon: number; format: string } | null>(null);


	// Selected location state
	let selectedLocation = $state<Location | null>(null);
	let selectedSource = $state<LocationSource | null>(null);
	let selectedAttribution = $state<string | null>(null);

	/**
	 * Handles location selection from the map picker.
	 */
	function handleMapSelect(location: Location): void {
		selectedLocation = location;
		selectedSource = 'map';
		selectedAttribution = null;

		onselect?.(location, 'map');
	}

	/**
	 * Handles address search form submission.
	 */
	async function handleSearch(): Promise<void> {
		if (!searchQuery.trim() || searchLoading) return;

		searchLoading = true;
		searchError = null;
		searchResults = [];
		showResults = false;

		const result = await geocodeAddress(searchQuery);

		searchLoading = false;

		if (result.success) {
			searchResults = result.results;
			showResults = true;
		} else {
			searchError = result.error;
		}
	}

	/**
	 * Selects a location from geocoding results.
	 */
	function selectGeocodingResult(result: LocationResult): void {
		selectedLocation = result.location;
		selectedSource = 'geocoding';
		selectedAttribution = result.attribution;
		showResults = false;
		searchQuery = result.location.name ?? formatCoordinates(result.location);

		onselect?.(result.location, 'geocoding', result.attribution);
	}

	/**
	 * Parses manual coordinate input and updates preview or error state.
	 */
	function handleCoordsInput(): void {
		coordsError = null;
		coordsPreview = null;

		if (!coordsInput.trim()) return;

		const result = parseCoordinates(coordsInput);

		if (result.success) {
			coordsPreview = {
				lat: result.coordinates.latitude,
				lon: result.coordinates.longitude,
				format: result.coordinates.format
			};
		} else {
			coordsError = result.error;
		}
	}

	/**
	 * Confirms manual coordinate entry and emits location event.
	 */
	function confirmCoordinates(): void {
		if (!coordsPreview) return;

		const tzResult = getTimezone({
			latitude: coordsPreview.lat,
			longitude: coordsPreview.lon
		});

		const location: Location = {
			latitude: coordsPreview.lat,
			longitude: coordsPreview.lon,
			timezone: tzResult.timezone,
			timezoneIsEstimate: tzResult.isEstimate
		};

		selectedLocation = location;
		selectedSource = 'manual';
		selectedAttribution = null;

		onselect?.(location, 'manual');
	}

	/**
	 * Clears the current selection and resets state.
	 */
	function clearSelection(): void {
		selectedLocation = null;
		selectedSource = null;
		selectedAttribution = null;
		searchQuery = '';
		searchResults = [];
		showResults = false;
		searchError = null;
		coordsInput = '';
		coordsPreview = null;
		coordsError = null;
		mapCollapsed = false;

		onclear?.();
	}

	/**
	 * Changes the input mode and resets mode-specific state.
	 */
	function setMode(newMode: InputMode): void {
		mode = newMode;
		searchError = null;
		searchResults = [];
		showResults = false;
		coordsError = null;
		coordsPreview = null;
		mapCollapsed = false;
	}

	/**
	 * Toggles the map collapsed state for mobile view.
	 */
	function toggleMapCollapsed(): void {
		mapCollapsed = !mapCollapsed;
	}
</script>

<div class="location-input">
	{#if selectedLocation}
		<div class="selected-location">
			<div class="location-details">
				<span class="location-name">
					{selectedLocation.name ?? formatCoordinates(selectedLocation)}
				</span>
				<span class="location-timezone">
					{selectedLocation.timezone}
					{#if selectedLocation.timezoneIsEstimate}
						<span class="estimate-warning" title="Timezone could not be determined precisely">(estimated)</span>
					{/if}
				</span>
				{#if selectedAttribution}
					<span class="attribution">{selectedAttribution}</span>
				{/if}
			</div>
			<button type="button" class="clear-btn" onclick={clearSelection}>
				Change location
			</button>
		</div>
	{:else}
		<div class="mode-tabs" role="tablist">
			<button
				type="button"
				role="tab"
				aria-selected={mode === 'map'}
				class:active={mode === 'map'}
				onclick={() => setMode('map')}
			>
				Map
			</button>
			<button
				type="button"
				role="tab"
				aria-selected={mode === 'search'}
				class:active={mode === 'search'}
				onclick={() => setMode('search')}
			>
				Search
			</button>
			<button
				type="button"
				role="tab"
				aria-selected={mode === 'coordinates'}
				class:active={mode === 'coordinates'}
				onclick={() => setMode('coordinates')}
			>
				Coordinates
			</button>
		</div>

		<div class="mode-content" role="tabpanel">
			{#if mode === 'map'}
				<div class="map-mode">
					<button
						type="button"
						class="collapse-toggle mobile-only"
						onclick={toggleMapCollapsed}
						aria-expanded={!mapCollapsed}
					>
						{mapCollapsed ? 'Show map' : 'Hide map'}
						<span class="collapse-icon" class:collapsed={mapCollapsed}>▼</span>
					</button>
					{#if !mapCollapsed}
						<MapPicker onselect={handleMapSelect} />
					{/if}
					<p class="map-hint">Click on the map to select a location, or use the search bar and GPS button on the map.</p>
				</div>
			{:else if mode === 'search'}
				<form class="search-form" onsubmit={(e) => { e.preventDefault(); handleSearch(); }}>
					<input
						type="text"
						bind:value={searchQuery}
						placeholder="Enter city, address, or place name..."
						aria-label="Location search"
						disabled={searchLoading}
					/>
					<button
						type="submit"
						disabled={!searchQuery.trim() || searchLoading}
					>
						{searchLoading ? 'Searching...' : 'Search'}
					</button>
				</form>

				{#if searchError}
					<div class="error" role="alert">
						{getGeocodingErrorMessage(searchError)}
						{#if searchError.type === 'network-error'}
							<p class="error-hint">You can enter coordinates manually using the Coordinates tab.</p>
						{/if}
					</div>
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
									onclick={() => selectGeocodingResult(result)}
								>
									<span class="result-name">{result.location.name}</span>
									<span class="result-coords">
										{result.location.latitude.toFixed(4)}, {result.location.longitude.toFixed(4)}
									</span>
								</button>
							</li>
						{/each}
					</ul>
				{/if}

			{:else if mode === 'coordinates'}
				<div class="coords-form">
					<label for="coords-input">
						Enter coordinates (decimal or degrees-minutes-seconds):
					</label>
					<input
						id="coords-input"
						type="text"
						bind:value={coordsInput}
						oninput={handleCoordsInput}
						placeholder="45.5231, -122.6765 or 45° 31' 23&quot; N, 122° 40' 35&quot; W"
						aria-describedby={coordsError ? 'coords-error' : coordsPreview ? 'coords-preview' : undefined}
					/>

					{#if coordsError}
						<div id="coords-error" class="error" role="alert">
							{getParseErrorMessage(coordsError)}
						</div>
					{/if}

					{#if coordsPreview}
						<div id="coords-preview" class="coords-preview">
							<span class="preview-label">Parsed as:</span>
							<span class="preview-value">
								{coordsPreview.lat.toFixed(6)}, {coordsPreview.lon.toFixed(6)}
							</span>
							<span class="preview-format">({coordsPreview.format} format)</span>
							<button
								type="button"
								class="confirm-btn"
								onclick={confirmCoordinates}
							>
								Use this location
							</button>
						</div>
					{/if}

					<p class="coords-help">
						Supported formats include decimal degrees (45.5, -122.6), degrees-minutes-seconds (45° 31' 23" N), and degrees-decimal-minutes (45° 31.5' N).
					</p>
				</div>

			{/if}
		</div>
	{/if}
</div>

<style>
	.location-input {
		font-family: system-ui, -apple-system, sans-serif;
	}

	/* Selected location display */
	.selected-location {
		display: flex;
		justify-content: space-between;
		align-items: flex-start;
		padding: 1rem;
		background: #f0f7ff;
		border: 1px solid #b3d4fc;
		border-radius: 8px;
	}

	.location-details {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
	}

	.location-name {
		font-weight: 500;
		color: #1a1a1a;
	}

	.location-timezone {
		font-size: 0.875rem;
		color: #555;
	}

	.estimate-warning {
		color: #b45309;
		font-style: italic;
	}

	.attribution {
		font-size: 0.75rem;
		color: #777;
	}

	.clear-btn {
		padding: 0.5rem 1rem;
		background: #fff;
		border: 1px solid #ccc;
		border-radius: 4px;
		cursor: pointer;
		font-size: 0.875rem;
	}

	.clear-btn:hover {
		background: #f5f5f5;
	}

	/* Mode tabs */
	.mode-tabs {
		display: flex;
		gap: 0;
		border-bottom: 1px solid #ddd;
		margin-bottom: 1rem;
	}

	.mode-tabs button {
		padding: 0.75rem 1.25rem;
		background: none;
		border: none;
		border-bottom: 2px solid transparent;
		cursor: pointer;
		font-size: 0.9375rem;
		color: #555;
		transition: color 0.15s, border-color 0.15s;
	}

	.mode-tabs button:hover {
		color: #1a1a1a;
	}

	.mode-tabs button.active {
		color: #0066cc;
		border-bottom-color: #0066cc;
	}

	.mode-content {
		padding: 0.5rem 0;
	}

	/* Search form */
	.search-form {
		display: flex;
		gap: 0.5rem;
	}

	.search-form input {
		flex: 1;
		padding: 0.75rem;
		border: 1px solid #ccc;
		border-radius: 4px;
		font-size: 1rem;
	}

	.search-form input:focus {
		outline: none;
		border-color: #0066cc;
		box-shadow: 0 0 0 2px rgba(0, 102, 204, 0.2);
	}

	.search-form button {
		padding: 0.75rem 1.5rem;
		background: #0066cc;
		color: white;
		border: none;
		border-radius: 4px;
		cursor: pointer;
		font-size: 1rem;
	}

	.search-form button:hover:not(:disabled) {
		background: #0052a3;
	}

	.search-form button:disabled {
		background: #ccc;
		cursor: not-allowed;
	}

	/* Search results */
	.search-results {
		list-style: none;
		padding: 0;
		margin: 1rem 0 0;
		border: 1px solid #ddd;
		border-radius: 4px;
		max-height: 300px;
		overflow-y: auto;
	}

	.search-results li {
		border-bottom: 1px solid #eee;
	}

	.search-results li:last-child {
		border-bottom: none;
	}

	.result-item {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
		width: 100%;
		padding: 0.75rem 1rem;
		background: none;
		border: none;
		text-align: left;
		cursor: pointer;
	}

	.result-item:hover {
		background: #f5f5f5;
	}

	.result-name {
		color: #1a1a1a;
	}

	.result-coords {
		font-size: 0.8125rem;
		color: #777;
	}

	/* Coordinates form */
	.coords-form {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}

	.coords-form label {
		font-weight: 500;
		color: #333;
	}

	.coords-form input {
		padding: 0.75rem;
		border: 1px solid #ccc;
		border-radius: 4px;
		font-size: 1rem;
	}

	.coords-form input:focus {
		outline: none;
		border-color: #0066cc;
		box-shadow: 0 0 0 2px rgba(0, 102, 204, 0.2);
	}

	.coords-preview {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.5rem;
		padding: 0.75rem;
		background: #f0f7ff;
		border-radius: 4px;
	}

	.preview-label {
		color: #555;
	}

	.preview-value {
		font-family: monospace;
		font-weight: 500;
	}

	.preview-format {
		font-size: 0.8125rem;
		color: #777;
	}

	.confirm-btn {
		margin-left: auto;
		padding: 0.5rem 1rem;
		background: #0066cc;
		color: white;
		border: none;
		border-radius: 4px;
		cursor: pointer;
		font-size: 0.875rem;
	}

	.confirm-btn:hover {
		background: #0052a3;
	}

	.coords-help {
		font-size: 0.8125rem;
		color: #777;
		margin: 0;
	}

	/* Map mode */
	.map-mode {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}

	.map-hint {
		font-size: 0.8125rem;
		color: #777;
		margin: 0;
	}

	.collapse-toggle {
		display: none;
		align-items: center;
		justify-content: center;
		gap: 0.5rem;
		padding: 0.75rem 1rem;
		background: #f5f5f5;
		border: 1px solid #ddd;
		border-radius: 4px;
		cursor: pointer;
		font-size: 0.9375rem;
		color: #333;
	}

	.collapse-toggle:hover {
		background: #eee;
	}

	.collapse-icon {
		font-size: 0.75rem;
		transition: transform 0.2s ease;
	}

	.collapse-icon.collapsed {
		transform: rotate(-90deg);
	}

	/* Mobile-only elements */
	@media (max-width: 640px) {
		.mobile-only {
			display: flex;
		}
	}

	/* Error messages */
	.error {
		padding: 0.75rem;
		background: #fee;
		border: 1px solid #f5c6cb;
		border-radius: 4px;
		color: #721c24;
		margin-top: 0.75rem;
	}

	.error-hint {
		margin: 0.5rem 0 0;
		font-size: 0.875rem;
		color: #856404;
	}
</style>
