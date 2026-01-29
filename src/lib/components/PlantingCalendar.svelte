<script lang="ts">
	import type { FrostDates, GrowingSeason } from '$lib/climate';

	interface PlantingCalendarProps {
		frostDates: FrostDates;
		growingSeason: GrowingSeason;
	}

	let { frostDates, growingSeason }: PlantingCalendarProps = $props();

	const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

	/**
	 * Converts a day of year to a percentage position along the timeline.
	 * Day 1 is 0%, day 365 is 100%.
	 */
	function dayToPercent(dayOfYear: number): number {
		return ((dayOfYear - 1) / 365) * 100;
	}

	/**
	 * Converts a day of year to a human-readable date string.
	 * Uses a non-leap year for display consistency.
	 */
	function dayToDate(dayOfYear: number): string {
		const date = new Date(2024, 0, dayOfYear);
		return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
	}

	// Frost dates
	const lastFrostDoy = $derived(frostDates.lastSpringFrost.median);
	const firstFrostDoy = $derived(frostDates.firstFallFrost.median);

	// Seed starting window: 6-8 weeks before last frost
	// We'll use 7 weeks (49 days) as the middle of that range
	const seedStartEarlyDoy = $derived(Math.max(1, lastFrostDoy - 56)); // 8 weeks before
	const seedStartLateDoy = $derived(Math.max(1, lastFrostDoy - 42)); // 6 weeks before

	// Transplant window: from last frost to mid-season (around June 15 for typical zones)
	// or until it's too late for most warm-season crops (about 10 weeks before first frost)
	const transplantStartDoy = $derived(lastFrostDoy);
	const transplantEndDoy = $derived(Math.min(firstFrostDoy - 70, lastFrostDoy + 60));

	// Fall planting window for cool-season crops
	const fallPlantingWindow = $derived(growingSeason.coolSeasonWindows.fall);

	// Convert to percentages
	const seedStartEarlyPercent = $derived(dayToPercent(seedStartEarlyDoy));
	const seedStartLatePercent = $derived(dayToPercent(seedStartLateDoy));
	const seedStartWidth = $derived(seedStartLatePercent - seedStartEarlyPercent);

	const lastFrostPercent = $derived(dayToPercent(lastFrostDoy));
	const firstFrostPercent = $derived(dayToPercent(firstFrostDoy));
	const transplantEndPercent = $derived(dayToPercent(transplantEndDoy));

	const transplantWidth = $derived(transplantEndPercent - lastFrostPercent);
	const growingSeasonWidth = $derived(firstFrostPercent - lastFrostPercent);

	const fallPlantingPercent = $derived(
		fallPlantingWindow ? dayToPercent(fallPlantingWindow.start) : null
	);
	const fallPlantingEndPercent = $derived(
		fallPlantingWindow ? dayToPercent(fallPlantingWindow.end) : null
	);
	const fallPlantingWidth = $derived(
		fallPlantingPercent !== null && fallPlantingEndPercent !== null
			? fallPlantingEndPercent - fallPlantingPercent
			: 0
	);

	// Date labels
	const seedStartDate = $derived(dayToDate(seedStartEarlyDoy));
	const lastFrostDate = $derived(dayToDate(lastFrostDoy));
	const transplantEndDate = $derived(dayToDate(transplantEndDoy));
	const firstFrostDate = $derived(dayToDate(firstFrostDoy));
	const fallPlantingStartDate = $derived(
		fallPlantingWindow ? dayToDate(fallPlantingWindow.start) : null
	);
</script>

<article class="planting-calendar">
	<header class="card-header">
		<h3>Planting Calendar</h3>
		<span class="season-summary">Key dates for your growing season</span>
	</header>

	<div class="card-body">
		<div class="timeline-container">
			<div class="timeline">
				<!-- Frost risk periods (winter) -->
				<div
					class="frost-period frost-period-winter-start"
					style="left: 0; width: {lastFrostPercent}%"
				></div>
				<div
					class="frost-period frost-period-winter-end"
					style="left: {firstFrostPercent}%; width: {100 - firstFrostPercent}%"
				></div>

				<!-- Seed starting window (indoors) -->
				<div
					class="seed-starting-period"
					style="left: {seedStartEarlyPercent}%; width: {seedStartWidth}%"
				></div>

				<!-- Main growing season (frost-free period) -->
				<div
					class="growing-period"
					style="left: {lastFrostPercent}%; width: {growingSeasonWidth}%"
				></div>

				<!-- Transplant window (overlaid on growing season) -->
				<div
					class="transplant-period"
					style="left: {lastFrostPercent}%; width: {transplantWidth}%"
				></div>

				<!-- Fall planting window if available -->
				{#if fallPlantingPercent !== null}
					<div
						class="fall-planting-period"
						style="left: {fallPlantingPercent}%; width: {fallPlantingWidth}%"
					></div>
				{/if}

				<!-- Date markers -->
				<div class="date-marker marker-seed-start" style="left: {seedStartEarlyPercent}%">
					<div class="marker-line marker-line-short"></div>
					<div class="marker-label marker-label-top">
						<span class="marker-date">{seedStartDate}</span>
						<span class="marker-text">Start seeds</span>
					</div>
				</div>

				<div class="date-marker marker-last-frost" style="left: {lastFrostPercent}%">
					<div class="marker-line"></div>
					<div class="marker-label marker-label-bottom">
						<span class="marker-text">Last frost</span>
						<span class="marker-date">{lastFrostDate}</span>
					</div>
				</div>

				<div class="date-marker marker-transplant-end" style="left: {transplantEndPercent}%">
					<div class="marker-line marker-line-short"></div>
					<div class="marker-label marker-label-top">
						<span class="marker-date">{transplantEndDate}</span>
						<span class="marker-text">Transplant by</span>
					</div>
				</div>

				<div class="date-marker marker-first-frost" style="left: {firstFrostPercent}%">
					<div class="marker-line"></div>
					<div class="marker-label marker-label-bottom">
						<span class="marker-text">First frost</span>
						<span class="marker-date">{firstFrostDate}</span>
					</div>
				</div>
			</div>

			<!-- Month labels -->
			<div class="month-labels">
				{#each months as month, i}
					<span class="month-label" style="left: {(i / 12) * 100}%">{month}</span>
				{/each}
			</div>
		</div>

		<div class="legend">
			<div class="legend-item">
				<span class="legend-swatch seed-swatch"></span>
				<span class="legend-text">Start seeds indoors</span>
			</div>
			<div class="legend-item">
				<span class="legend-swatch transplant-swatch"></span>
				<span class="legend-text">Transplant outdoors</span>
			</div>
			<div class="legend-item">
				<span class="legend-swatch growing-swatch"></span>
				<span class="legend-text">Growing season</span>
			</div>
			{#if fallPlantingWindow}
				<div class="legend-item">
					<span class="legend-swatch fall-swatch"></span>
					<span class="legend-text">Fall planting</span>
				</div>
			{/if}
			<div class="legend-item">
				<span class="legend-swatch frost-swatch"></span>
				<span class="legend-text">Frost risk</span>
			</div>
		</div>

		<div class="tips">
			<h4>Timing Tips</h4>
			<ul>
				<li>
					Start seeds indoors 6-8 weeks before last frost ({seedStartDate} to {dayToDate(seedStartLateDoy)})
				</li>
				<li>
					Transplant warm-season crops after {lastFrostDate} when soil warms
				</li>
				<li>
					For fall harvest, plant cool-season crops {fallPlantingStartDate ? `around ${fallPlantingStartDate}` : 'mid-to-late summer'}
				</li>
				<li>
					Plan harvests to complete before first frost on {firstFrostDate}
				</li>
			</ul>
		</div>
	</div>
</article>

<style>
	.planting-calendar {
		font-family: system-ui, -apple-system, sans-serif;
		background: #fef9e7;
		border: 1px solid #f4d03f;
		border-radius: 8px;
		overflow: hidden;
	}

	.card-header {
		background: #fcf3cf;
		padding: 0.75rem 1rem;
		border-bottom: 1px solid #f4d03f;
		display: flex;
		justify-content: space-between;
		align-items: center;
	}

	.card-header h3 {
		margin: 0;
		font-size: 0.9375rem;
		color: #9a7b0a;
		font-weight: 600;
	}

	.season-summary {
		font-size: 0.8125rem;
		color: #b7950b;
		font-weight: 500;
	}

	.card-body {
		padding: 1.25rem 1rem;
		display: flex;
		flex-direction: column;
		gap: 1rem;
	}

	.timeline-container {
		position: relative;
		padding-top: 3rem;
		padding-bottom: 2.5rem;
	}

	.timeline {
		position: relative;
		height: 24px;
		background: #e2e8f0;
		border-radius: 4px;
		overflow: visible;
	}

	.frost-period {
		position: absolute;
		top: 0;
		height: 100%;
		background: #cbd5e1;
	}

	.frost-period-winter-start {
		border-radius: 4px 0 0 4px;
	}

	.frost-period-winter-end {
		border-radius: 0 4px 4px 0;
	}

	.seed-starting-period {
		position: absolute;
		top: 0;
		height: 100%;
		background: #a78bfa;
		border-radius: 2px;
	}

	.growing-period {
		position: absolute;
		top: 0;
		height: 100%;
		background: linear-gradient(90deg, #22c55e, #4ade80, #22c55e);
	}

	.transplant-period {
		position: absolute;
		top: 0;
		height: 100%;
		background: linear-gradient(90deg, #f97316, #fb923c, #fdba74);
		border-radius: 0;
	}

	.fall-planting-period {
		position: absolute;
		top: 0;
		height: 100%;
		background: #c084fc;
		border-radius: 2px;
	}

	.date-marker {
		position: absolute;
		top: 0;
		transform: translateX(-50%);
		display: flex;
		flex-direction: column;
		align-items: center;
	}

	.marker-line {
		width: 2px;
		height: calc(24px + 2.5rem);
		background: #64748b;
	}

	.marker-line-short {
		height: calc(24px + 1.5rem);
	}

	.marker-label {
		position: absolute;
		display: flex;
		flex-direction: column;
		align-items: center;
		white-space: nowrap;
	}

	.marker-label-top {
		top: -2.75rem;
	}

	.marker-label-bottom {
		top: calc(24px + 0.5rem);
	}

	.marker-date {
		font-size: 0.75rem;
		font-weight: 600;
		color: #374151;
	}

	.marker-text {
		font-size: 0.625rem;
		color: #64748b;
		text-transform: uppercase;
		letter-spacing: 0.025em;
	}

	.marker-seed-start .marker-line {
		background: #7c3aed;
	}

	.marker-seed-start .marker-date {
		color: #7c3aed;
	}

	.marker-last-frost .marker-line {
		background: #0369a1;
	}

	.marker-last-frost .marker-date {
		color: #0369a1;
	}

	.marker-transplant-end .marker-line {
		background: #c2410c;
	}

	.marker-transplant-end .marker-date {
		color: #c2410c;
	}

	.marker-first-frost .marker-line {
		background: #0369a1;
	}

	.marker-first-frost .marker-date {
		color: #0369a1;
	}

	.month-labels {
		position: relative;
		height: 1.25rem;
		margin-top: 0.5rem;
	}

	.month-label {
		position: absolute;
		font-size: 0.6875rem;
		color: #64748b;
		transform: translateX(-50%);
	}

	.month-label:first-child {
		transform: translateX(0);
	}

	.legend {
		display: flex;
		gap: 1rem;
		flex-wrap: wrap;
	}

	.legend-item {
		display: flex;
		align-items: center;
		gap: 0.375rem;
	}

	.legend-swatch {
		width: 1rem;
		height: 0.75rem;
		border-radius: 2px;
	}

	.seed-swatch {
		background: #a78bfa;
	}

	.transplant-swatch {
		background: #fb923c;
	}

	.growing-swatch {
		background: #4ade80;
	}

	.fall-swatch {
		background: #c084fc;
	}

	.frost-swatch {
		background: #cbd5e1;
	}

	.legend-text {
		font-size: 0.75rem;
		color: #4b5563;
	}

	.tips {
		padding-top: 0.75rem;
		border-top: 1px solid #f4d03f;
	}

	.tips h4 {
		margin: 0 0 0.5rem 0;
		font-size: 0.875rem;
		color: #9a7b0a;
		font-weight: 600;
	}

	.tips ul {
		margin: 0;
		padding-left: 1.25rem;
		font-size: 0.8125rem;
		color: #4b5563;
		line-height: 1.5;
	}

	.tips li {
		margin-bottom: 0.25rem;
	}

	.tips li:last-child {
		margin-bottom: 0;
	}

	/* Responsive adjustments */
	@media (max-width: 480px) {
		.card-header {
			flex-direction: column;
			align-items: flex-start;
			gap: 0.25rem;
		}

		.timeline-container {
			padding-top: 3.5rem;
			padding-bottom: 3rem;
		}

		.marker-label-top {
			top: -3.25rem;
		}

		.marker-label-bottom {
			top: calc(24px + 0.25rem);
		}

		.marker-date {
			font-size: 0.6875rem;
		}

		.marker-text {
			font-size: 0.5625rem;
		}

		.legend {
			flex-direction: column;
			gap: 0.5rem;
		}

		.month-label {
			font-size: 0.5625rem;
		}

		.tips ul {
			font-size: 0.75rem;
		}
	}
</style>
