<script lang="ts">
	import {
		getDailySunHours,
		getYearlySummary,
		type Coordinates,
		type DailySunData
	} from '$lib/solar';
	import {
		SunDataCard,
		GrowingSeasonTimeline,
		PlantRecommendations,
		PlantingCalendar,
		SeasonalLightChart,
		type MonthlySunData
	} from '$lib/components';
	import {
		getFrostDates,
		getHardinessZone,
		calculateGrowingSeasonLength,
		dayOfYearToDate,
		formatHardinessZone,
		formatZoneTempRange,
		type FrostDates,
		type HardinessZone,
		type GrowingSeason,
		type GrowingSeasonRange,
		type ClimateData
	} from '$lib/climate';
	import { getRecommendations, createRecommendationInput } from '$lib/plants';
	import type { PageData } from './$types';

	const { data }: { data: PageData } = $props();

	// Location is guaranteed to be valid by the load function
	const { latitude, longitude, timezone, name } = data.location;

	// Calculate sun data for the validated coordinates
	const coords: Coordinates = { latitude, longitude };
	const sunData: DailySunData = $derived(getDailySunHours(coords, new Date()));

	// Fetch climate data for the location
	const frostDates: FrostDates = $derived(getFrostDates(coords));
	const hardinessZone: HardinessZone = $derived(getHardinessZone(coords));

	// Build growing season data for the timeline component
	const growingSeason: GrowingSeason = $derived.by(() => {
		const typicalLength = calculateGrowingSeasonLength(frostDates);

		// Calculate short and long season lengths from frost date variance
		const shortLength = Math.max(
			0,
			frostDates.firstFallFrost.early - frostDates.lastSpringFrost.late
		);
		const longLength =
			frostDates.firstFallFrost.late - frostDates.lastSpringFrost.early;

		const lengthDays: GrowingSeasonRange = {
			short: shortLength,
			typical: typicalLength,
			long: longLength
		};

		return {
			lengthDays,
			frostFreePeriod: {
				start: frostDates.lastSpringFrost,
				end: frostDates.firstFallFrost
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
		frostDates,
		hardinessZone,
		growingSeason,
		fetchedAt: new Date()
	});

	// Calculate monthly sun hours for the seasonal light chart
	const monthlyData: MonthlySunData[] = $derived.by(() => {
		const year = new Date().getFullYear();
		const yearSummaries = getYearlySummary(coords, year);
		return yearSummaries.map((summary, index) => ({
			month: index + 1,
			theoreticalHours: summary.averageSunHours,
			effectiveHours: summary.averageSunHours
		}));
	});

	// Generate plant recommendations based on sun hours and climate
	const recommendations = $derived.by(() => {
		const input = createRecommendationInput(sunData.sunHours, climateData);
		return getRecommendations(input);
	});
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

			<div class="climate-card frost-card">
				<h3>Frost Dates</h3>
				<div class="frost-dates">
					<div class="frost-date">
						<span class="frost-label">Last Spring Frost</span>
						<span class="frost-value">{formatFrostDate(frostDates.lastSpringFrost.median)}</span>
						<span class="frost-range">
							{formatFrostDate(frostDates.lastSpringFrost.early)} – {formatFrostDate(frostDates.lastSpringFrost.late)}
						</span>
					</div>
					<div class="frost-date">
						<span class="frost-label">First Fall Frost</span>
						<span class="frost-value">{formatFrostDate(frostDates.firstFallFrost.median)}</span>
						<span class="frost-range">
							{formatFrostDate(frostDates.firstFallFrost.early)} – {formatFrostDate(frostDates.firstFallFrost.late)}
						</span>
					</div>
				</div>
			</div>
		</div>

		<div class="timeline-section">
			<GrowingSeasonTimeline {frostDates} {growingSeason} />
		</div>
	</section>

	<section class="recommendations-section">
		<h2>Plant Recommendations</h2>

		<div class="recommendations-grid">
			<div class="recommendations-main">
				<PlantRecommendations {recommendations} />
			</div>

			<div class="recommendations-sidebar">
				<SeasonalLightChart {monthlyData} hasShadeData={false} />
			</div>
		</div>

		<div class="calendar-section">
			<PlantingCalendar {frostDates} {growingSeason} />
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
	}
</style>
