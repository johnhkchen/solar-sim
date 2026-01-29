<script lang="ts">
	import {
		getDailySunHours,
		getDailySunHoursWithShade,
		getYearlySummary,
		getSeasonalSummaryWithShade,
		type Coordinates,
		type DailySunData,
		type Obstacle
	} from '$lib/solar';
	import {
		SunDataCard,
		GrowingSeasonTimeline,
		PlantRecommendations,
		PlantingCalendar,
		SeasonalLightChart,
		TemperatureChart,
		PlotViewer,
		type MonthlySunData,
		type PlotObstacle
	} from '$lib/components';
	import type { PlotSlope } from '$lib/solar/slope';
	import {
		getFrostDates,
		getHardinessZone,
		calculateGrowingSeasonLength,
		dayOfYearToDate,
		formatHardinessZone,
		formatZoneTempRange,
		fetchHistoricalTemperatures,
		calculateMonthlyAverages,
		calculateFrostDatesFromHistory,
		classifyKoppen,
		getCompleteOutlook,
		formatOutlookCategory,
		formatDroughtStatus,
		type FrostDates,
		type HardinessZone,
		type GrowingSeason,
		type GrowingSeasonRange,
		type ClimateData,
		type MonthlyAverages,
		type KoppenClassification,
		type CombinedOutlook
	} from '$lib/climate';
	import { getRecommendations, createRecommendationInput } from '$lib/plants';
	import type { PageData } from './$types';

	const { data }: { data: PageData } = $props();

	// Location is guaranteed to be valid by the load function
	const { latitude, longitude, timezone, name } = data.location;

	// Calculate sun data for the validated coordinates
	const coords: Coordinates = { latitude, longitude };
	const sunData: DailySunData = $derived(getDailySunHours(coords, new Date()));

	// Fetch climate data for the location (fallback to embedded tables)
	const frostDates: FrostDates = $derived(getFrostDates(coords));
	const hardinessZone: HardinessZone = $derived(getHardinessZone(coords));

	// Plot viewer state for obstacles and slope
	let obstacles = $state<PlotObstacle[]>([]);
	let slope = $state<PlotSlope>({ angle: 0, aspect: 180 });

	// LocalStorage persistence for plot data. The isLoaded flag prevents the save
	// effect from triggering during initial load, which would overwrite stored data
	// with empty defaults before the load completes.
	let isLoaded = $state(false);
	let saveTimeout: ReturnType<typeof setTimeout> | null = null;

	// Generate localStorage key using rounded coordinates (2 decimal places gives
	// approximately 1km precision, grouping nearby locations together)
	function getStorageKey(): string {
		return `solar-sim:plot:${latitude.toFixed(2)}:${longitude.toFixed(2)}`;
	}

	// Load saved plot data on mount
	$effect(() => {
		if (typeof window === 'undefined') return;
		const key = getStorageKey();
		const stored = localStorage.getItem(key);
		if (stored) {
			try {
				const data = JSON.parse(stored) as {
					obstacles: PlotObstacle[];
					slope: PlotSlope;
					savedAt: string;
				};
				obstacles = data.obstacles ?? [];
				slope = data.slope ?? { angle: 0, aspect: 180 };
			} catch {
				// Invalid JSON in storage, start fresh
			}
		}
		isLoaded = true;
	});

	// Save plot data on changes with 500ms debounce to batch rapid drag updates
	$effect(() => {
		if (!isLoaded) return;

		// Capture current values for the debounced save
		const toSave = {
			obstacles,
			slope,
			savedAt: new Date().toISOString()
		};

		if (saveTimeout) clearTimeout(saveTimeout);
		saveTimeout = setTimeout(() => {
			if (typeof window === 'undefined') return;
			const key = getStorageKey();
			localStorage.setItem(key, JSON.stringify(toSave));
		}, 500);
	});

	// Calculate shade-adjusted sun hours when obstacles are present. The derived
	// value recomputes whenever obstacles change, giving users immediate feedback
	// on how their garden layout affects available sunlight.
	const shadeAdjustedSunData = $derived.by(() => {
		if (obstacles.length === 0) {
			return null;
		}
		// PlotObstacle extends Obstacle so we can pass it directly
		return getDailySunHoursWithShade(coords, new Date(), obstacles as Obstacle[]);
	});

	// Effective sun hours uses shade-adjusted value when obstacles exist,
	// otherwise falls back to theoretical sun hours
	const effectiveSunHours = $derived(
		shadeAdjustedSunData?.effectiveHours ?? sunData.sunHours
	);

	// Enhanced climate data state (async)
	let enhancedClimateLoading = $state(true);
	let enhancedClimateError = $state<string | null>(null);
	let monthlyTemps = $state<MonthlyAverages | null>(null);
	let koppenClass = $state<KoppenClassification | null>(null);
	let seasonalOutlook = $state<CombinedOutlook | null>(null);
	let enhancedFrostDates = $state<FrostDates | null>(null);
	let showOutlookDetails = $state(false);

	// Fetch enhanced climate data from Open-Meteo
	async function loadEnhancedClimate() {
		try {
			enhancedClimateLoading = true;
			enhancedClimateError = null;

			// Fetch historical temperatures and outlook in parallel
			const [temps, outlook] = await Promise.all([
				fetchHistoricalTemperatures(coords, 30),
				getCompleteOutlook(coords)
			]);

			// Calculate derived data
			monthlyTemps = calculateMonthlyAverages(temps);
			enhancedFrostDates = calculateFrostDatesFromHistory(temps, latitude);
			seasonalOutlook = outlook;

			// Calculate Köppen classification from monthly data
			// Need to estimate monthly precipitation - use placeholder for now since
			// Open-Meteo archive doesn't include precip in our query
			// TODO: Add precipitation to API query for accurate Köppen classification
			const precipPlaceholder = [80, 70, 60, 40, 20, 5, 2, 5, 15, 40, 60, 80]; // Typical Mediterranean pattern
			koppenClass = classifyKoppen({
				latitude,
				temps: monthlyTemps.avgTemps,
				precip: precipPlaceholder
			});
		} catch (err) {
			enhancedClimateError = err instanceof Error ? err.message : 'Failed to load climate data';
		} finally {
			enhancedClimateLoading = false;
		}
	}

	// Load enhanced climate data on mount
	$effect(() => {
		loadEnhancedClimate();
	});

	// Use enhanced frost dates if available, otherwise fall back to embedded tables
	const activeFrostDates: FrostDates = $derived(enhancedFrostDates ?? frostDates);

	// Build growing season data for the timeline component
	const growingSeason: GrowingSeason = $derived.by(() => {
		const typicalLength = calculateGrowingSeasonLength(activeFrostDates);

		// Calculate short and long season lengths from frost date variance
		const shortLength = Math.max(
			0,
			activeFrostDates.firstFallFrost.early - activeFrostDates.lastSpringFrost.late
		);
		const longLength =
			activeFrostDates.firstFallFrost.late - activeFrostDates.lastSpringFrost.early;

		const lengthDays: GrowingSeasonRange = {
			short: shortLength,
			typical: typicalLength,
			long: longLength
		};

		return {
			lengthDays,
			frostFreePeriod: {
				start: activeFrostDates.lastSpringFrost,
				end: activeFrostDates.firstFallFrost
			},
			coolSeasonWindows: {
				spring: null,
				fall: null
			}
		};
	});

	// Format frost dates for display
	function formatFrostDate(dayOfYear: number): string {
		const date = dayOfYearToDate(dayOfYear);
		return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
	}

	// Build climate data for the recommendation engine
	const climateData: ClimateData = $derived({
		frostDates: activeFrostDates,
		hardinessZone,
		growingSeason,
		fetchedAt: new Date()
	});

	// Calculate monthly sun hours for the seasonal light chart. When obstacles
	// are present, this computes shade-adjusted effective hours for each month
	// using getSeasonalSummaryWithShade, giving users insight into how their
	// garden's light conditions vary seasonally with their specific obstacles.
	const monthlyData: MonthlySunData[] = $derived.by(() => {
		const year = new Date().getFullYear();
		const yearSummaries = getYearlySummary(coords, year);

		return yearSummaries.map((summary, index) => {
			const month = index + 1;
			const theoreticalHours = summary.averageSunHours;

			// When no obstacles exist, effective hours match theoretical
			if (obstacles.length === 0) {
				return {
					month,
					theoreticalHours,
					effectiveHours: theoreticalHours
				};
			}

			// Calculate shade-adjusted effective hours for this month
			const startDate = new Date(year, index, 1);
			const endDate = new Date(year, index + 1, 0); // Last day of month
			const shadeAnalysis = getSeasonalSummaryWithShade(
				coords,
				startDate,
				endDate,
				obstacles as Obstacle[]
			);

			return {
				month,
				theoreticalHours,
				effectiveHours: shadeAnalysis.averageEffectiveHours
			};
		});
	});

	// Generate plant recommendations based on effective sun hours and climate.
	// When obstacles are present, effectiveSunHours reflects shade-adjusted values,
	// producing recommendations tailored to the user's actual garden conditions.
	const recommendations = $derived.by(() => {
		const input = createRecommendationInput(
			effectiveSunHours,
			climateData,
			sunData.sunHours // theoretical hours for comparison
		);
		return getRecommendations(input);
	});

	// Helper to get color class for outlook categories
	function getOutlookColorClass(type: string): string {
		switch (type) {
			case 'Above':
				return 'outlook-warm';
			case 'Below':
				return 'outlook-cool';
			case 'Normal':
				return 'outlook-normal';
			default:
				return 'outlook-neutral';
		}
	}
</script>

<main>
	<h1>Solar Results</h1>

	<section class="location-info">
		<h2>Location</h2>
		{#if name}
			<p class="location-name">{name}</p>
		{/if}
		<p>
			Coordinates: {latitude.toFixed(4)}, {longitude.toFixed(4)}
			<br />Timezone: {timezone}
		</p>
	</section>

	<section class="sun-data">
		<SunDataCard data={sunData} {timezone} />
	</section>

	<section class="plot-section">
		<h2>Your Garden Plot</h2>
		<p class="plot-description">
			Place obstacles like buildings, trees, and fences to see how shadows affect your garden throughout the day. The 3D view shows shadow patterns at any time you choose.
		</p>
		<div class="plot-viewer-container">
			<PlotViewer
				{latitude}
				{longitude}
				date={new Date()}
				bind:obstacles
				bind:slope
			/>
		</div>
	</section>

	<section class="climate-data">
		<h2>Climate Information</h2>

		<div class="climate-summary">
			<div class="climate-card hardiness-card">
				<h3>USDA Hardiness Zone</h3>
				<div class="zone-badge">{hardinessZone.zone}</div>
				<p class="zone-temp">{formatZoneTempRange(hardinessZone)}</p>
				{#if hardinessZone.isApproximate}
					<p class="zone-note">Estimated from coordinates</p>
				{/if}
			</div>

			{#if koppenClass}
				<div class="climate-card koppen-card">
					<h3>Köppen Climate</h3>
					<div class="koppen-badge">{koppenClass.code}</div>
					<p class="koppen-description">{koppenClass.description}</p>
				</div>
			{:else if enhancedClimateLoading}
				<div class="climate-card koppen-card loading">
					<h3>Köppen Climate</h3>
					<div class="loading-placeholder">Loading...</div>
				</div>
			{/if}
		</div>

		<div class="climate-summary">
			<div class="climate-card frost-card">
				<h3>Frost Dates</h3>
				<div class="frost-dates">
					<div class="frost-date">
						<span class="frost-label">Last Spring Frost</span>
						<span class="frost-value">{formatFrostDate(activeFrostDates.lastSpringFrost.median)}</span>
						<span class="frost-range">
							{formatFrostDate(activeFrostDates.lastSpringFrost.early)} – {formatFrostDate(activeFrostDates.lastSpringFrost.late)}
						</span>
					</div>
					<div class="frost-date">
						<span class="frost-label">First Fall Frost</span>
						<span class="frost-value">{formatFrostDate(activeFrostDates.firstFallFrost.median)}</span>
						<span class="frost-range">
							{formatFrostDate(activeFrostDates.firstFallFrost.early)} – {formatFrostDate(activeFrostDates.firstFallFrost.late)}
						</span>
					</div>
				</div>
				{#if enhancedFrostDates && enhancedFrostDates.confidence === 'high'}
					<p class="frost-source">Based on 30 years of historical data</p>
				{/if}
			</div>

			{#if monthlyTemps}
				<div class="climate-card temp-chart-card">
					<TemperatureChart monthly={monthlyTemps} units="fahrenheit" />
				</div>
			{:else if enhancedClimateLoading}
				<div class="climate-card temp-chart-card loading">
					<h3>Temperature Patterns</h3>
					<div class="loading-placeholder chart-placeholder">Loading temperature data...</div>
				</div>
			{/if}
		</div>

		{#if koppenClass}
			<div class="gardening-notes">
				<h3>Gardening Notes for {koppenClass.description} Climate</h3>
				<p>{koppenClass.gardeningNotes}</p>
			</div>
		{/if}

		{#if seasonalOutlook && seasonalOutlook.isWithinCoverage}
			<div class="seasonal-outlook">
				<div class="outlook-header">
					<h3>Seasonal Outlook</h3>
					{#if seasonalOutlook.seasonal}
						<span class="outlook-period">{seasonalOutlook.seasonal.validPeriod}</span>
					{/if}
				</div>

				{#if seasonalOutlook.seasonal}
					<div class="outlook-categories">
						<div class="outlook-item {getOutlookColorClass(seasonalOutlook.seasonal.temperature.type)}">
							<span class="outlook-label">Temperature</span>
							<span class="outlook-value">
								{formatOutlookCategory(seasonalOutlook.seasonal.temperature, 'temperatures')}
							</span>
						</div>
						{#if seasonalOutlook.seasonal.precipitation}
							<div class="outlook-item {getOutlookColorClass(seasonalOutlook.seasonal.precipitation.type)}">
								<span class="outlook-label">Precipitation</span>
								<span class="outlook-value">
									{formatOutlookCategory(seasonalOutlook.seasonal.precipitation, 'precipitation')}
								</span>
							</div>
						{/if}
					</div>
				{/if}

				{#if seasonalOutlook.drought && seasonalOutlook.drought.status !== 'none'}
					<div class="drought-status">
						<span class="drought-label">Drought:</span>
						<span class="drought-value">{formatDroughtStatus(seasonalOutlook.drought.status)}</span>
					</div>
				{/if}

				<button
					type="button"
					class="outlook-toggle"
					onclick={() => (showOutlookDetails = !showOutlookDetails)}
				>
					{showOutlookDetails ? 'Hide guidance' : 'Show gardening guidance'}
				</button>

				{#if showOutlookDetails}
					<div class="outlook-guidance">
						{#each seasonalOutlook.guidance.split('\n\n') as paragraph}
							<p>{paragraph}</p>
						{/each}
					</div>
				{/if}
			</div>
		{:else if seasonalOutlook && !seasonalOutlook.isWithinCoverage}
			<p class="outlook-unavailable">
				Seasonal outlook data is only available for US locations. Plan according to historical climate patterns for your region.
			</p>
		{/if}

		{#if enhancedClimateError}
			<p class="climate-error">
				Could not load enhanced climate data: {enhancedClimateError}. Showing estimates from embedded tables.
			</p>
		{/if}

		<div class="timeline-section">
			<GrowingSeasonTimeline frostDates={activeFrostDates} {growingSeason} />
		</div>
	</section>

	<section class="recommendations-section">
		<h2>Plant Recommendations</h2>

		<div class="recommendations-grid">
			<div class="recommendations-main">
				<PlantRecommendations {recommendations} />
			</div>

			<div class="recommendations-sidebar">
				<SeasonalLightChart {monthlyData} hasShadeData={obstacles.length > 0} />
			</div>
		</div>

		<div class="calendar-section">
			<PlantingCalendar frostDates={activeFrostDates} {growingSeason} />
		</div>
	</section>

	<nav>
		<a href="/">Change location</a>
	</nav>
</main>

<style>
	main {
		max-width: 800px;
		margin: 0 auto;
		padding: 2rem;
		font-family: system-ui, -apple-system, sans-serif;
	}

	h1 {
		color: #333;
	}

	h2 {
		color: #555;
		font-size: 1.25rem;
		margin-top: 1.5rem;
	}

	section {
		margin-bottom: 1.5rem;
	}

	.location-info {
		background: #f5f5f5;
		padding: 1rem;
		border-radius: 8px;
	}

	.location-name {
		font-size: 1.25rem;
		font-weight: 500;
		margin: 0 0 0.5rem;
	}

	.sun-data {
		margin-top: 1.5rem;
	}

	.plot-section {
		margin-top: 2rem;
	}

	.plot-description {
		margin: 0.5rem 0 1rem;
		font-size: 0.875rem;
		color: #6b7280;
		line-height: 1.5;
	}

	.plot-viewer-container {
		background: #fafaf9;
		border: 1px solid #e7e5e4;
		border-radius: 8px;
		padding: 1rem;
		min-height: 650px;
	}

	/* Mobile: remove container min-height since PlotViewer shows collapsed view */
	@media (max-width: 600px) {
		.plot-viewer-container {
			min-height: auto;
			background: transparent;
			border: none;
			padding: 0;
		}
	}

	.climate-data {
		margin-top: 2rem;
	}

	.climate-summary {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 1rem;
		margin-top: 1rem;
	}

	.climate-card {
		padding: 1rem;
		border-radius: 8px;
	}

	.climate-card h3 {
		margin: 0 0 0.75rem;
		font-size: 0.875rem;
		text-transform: uppercase;
		letter-spacing: 0.025em;
	}

	.hardiness-card {
		background: #f0fdf4;
		border: 1px solid #86efac;
	}

	.hardiness-card h3 {
		color: #166534;
	}

	.zone-badge {
		font-size: 2.5rem;
		font-weight: 700;
		color: #15803d;
		line-height: 1;
	}

	.zone-temp {
		margin: 0.5rem 0 0;
		font-size: 0.875rem;
		color: #4b5563;
	}

	.zone-note {
		margin: 0.25rem 0 0;
		font-size: 0.75rem;
		color: #9ca3af;
		font-style: italic;
	}

	.koppen-card {
		background: #fef3c7;
		border: 1px solid #fcd34d;
	}

	.koppen-card h3 {
		color: #92400e;
	}

	.koppen-badge {
		font-size: 2rem;
		font-weight: 700;
		color: #b45309;
		line-height: 1;
		font-family: ui-monospace, monospace;
	}

	.koppen-description {
		margin: 0.5rem 0 0;
		font-size: 0.875rem;
		color: #78350f;
	}

	.frost-card {
		background: #eff6ff;
		border: 1px solid #93c5fd;
	}

	.frost-card h3 {
		color: #1e40af;
	}

	.frost-dates {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}

	.frost-date {
		display: flex;
		flex-direction: column;
	}

	.frost-label {
		font-size: 0.75rem;
		color: #64748b;
		text-transform: uppercase;
		letter-spacing: 0.025em;
	}

	.frost-value {
		font-size: 1.125rem;
		font-weight: 600;
		color: #1e293b;
	}

	.frost-range {
		font-size: 0.75rem;
		color: #64748b;
	}

	.frost-source {
		margin: 0.75rem 0 0;
		font-size: 0.75rem;
		color: #3b82f6;
		font-style: italic;
	}

	.temp-chart-card {
		background: transparent;
		border: none;
		padding: 0;
	}

	.temp-chart-card :global(.temperature-chart) {
		height: 100%;
	}

	.loading {
		opacity: 0.7;
	}

	.loading-placeholder {
		font-size: 0.875rem;
		color: #6b7280;
		font-style: italic;
	}

	.chart-placeholder {
		height: 150px;
		display: flex;
		align-items: center;
		justify-content: center;
		background: #f9fafb;
		border-radius: 4px;
	}

	.gardening-notes {
		margin-top: 1.5rem;
		padding: 1rem;
		background: #fffbeb;
		border: 1px solid #fde68a;
		border-radius: 8px;
	}

	.gardening-notes h3 {
		margin: 0 0 0.5rem;
		font-size: 0.9375rem;
		color: #92400e;
	}

	.gardening-notes p {
		margin: 0;
		font-size: 0.875rem;
		color: #78350f;
		line-height: 1.6;
	}

	.seasonal-outlook {
		margin-top: 1.5rem;
		padding: 1rem;
		background: #f0f9ff;
		border: 1px solid #bae6fd;
		border-radius: 8px;
	}

	.outlook-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 0.75rem;
	}

	.outlook-header h3 {
		margin: 0;
		font-size: 0.9375rem;
		color: #0369a1;
	}

	.outlook-period {
		font-size: 0.75rem;
		color: #0284c7;
		font-weight: 500;
	}

	.outlook-categories {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.outlook-item {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 0.5rem 0.75rem;
		border-radius: 4px;
		font-size: 0.875rem;
	}

	.outlook-warm {
		background: #fef2f2;
		border: 1px solid #fecaca;
	}

	.outlook-cool {
		background: #eff6ff;
		border: 1px solid #bfdbfe;
	}

	.outlook-normal {
		background: #f0fdf4;
		border: 1px solid #bbf7d0;
	}

	.outlook-neutral {
		background: #f9fafb;
		border: 1px solid #e5e7eb;
	}

	.outlook-label {
		font-weight: 500;
		color: #374151;
	}

	.outlook-value {
		color: #6b7280;
	}

	.drought-status {
		margin-top: 0.75rem;
		padding: 0.5rem 0.75rem;
		background: #fef3c7;
		border: 1px solid #fcd34d;
		border-radius: 4px;
		font-size: 0.875rem;
	}

	.drought-label {
		font-weight: 500;
		color: #92400e;
	}

	.drought-value {
		margin-left: 0.5rem;
		color: #b45309;
	}

	.outlook-toggle {
		margin-top: 0.75rem;
		padding: 0.375rem 0.75rem;
		font-size: 0.75rem;
		color: #0369a1;
		background: white;
		border: 1px solid #bae6fd;
		border-radius: 4px;
		cursor: pointer;
		transition: background-color 0.15s;
	}

	.outlook-toggle:hover {
		background: #e0f2fe;
	}

	.outlook-guidance {
		margin-top: 0.75rem;
		padding: 0.75rem;
		background: white;
		border-radius: 4px;
	}

	.outlook-guidance p {
		margin: 0 0 0.75rem;
		font-size: 0.875rem;
		color: #374151;
		line-height: 1.6;
	}

	.outlook-guidance p:last-child {
		margin-bottom: 0;
	}

	.outlook-unavailable {
		margin-top: 1rem;
		font-size: 0.875rem;
		color: #6b7280;
		font-style: italic;
	}

	.climate-error {
		margin-top: 1rem;
		padding: 0.75rem;
		background: #fef2f2;
		border: 1px solid #fecaca;
		border-radius: 4px;
		font-size: 0.875rem;
		color: #991b1b;
	}

	.timeline-section {
		margin-top: 1.5rem;
	}

	.recommendations-section {
		margin-top: 2rem;
	}

	.recommendations-grid {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 1.5rem;
		margin-top: 1rem;
	}

	.recommendations-main {
		min-width: 0;
	}

	.recommendations-sidebar {
		min-width: 0;
	}

	.calendar-section {
		margin-top: 1.5rem;
	}

	nav {
		margin-top: 2rem;
		padding-top: 1rem;
		border-top: 1px solid #eee;
	}

	a {
		color: #0066cc;
	}

	@media (max-width: 600px) {
		.climate-summary {
			grid-template-columns: 1fr;
		}

		.recommendations-grid {
			grid-template-columns: 1fr;
		}

		.outlook-header {
			flex-direction: column;
			align-items: flex-start;
			gap: 0.25rem;
		}
	}
</style>
