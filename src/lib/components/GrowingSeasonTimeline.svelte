<script lang="ts">
	import type { FrostDates, GrowingSeason } from '$lib/climate';

	interface GrowingSeasonTimelineProps {
		frostDates: FrostDates;
		growingSeason: GrowingSeason;
	}

	let { frostDates, growingSeason }: GrowingSeasonTimelineProps = $props();

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

	const springFrostPercent = $derived(dayToPercent(frostDates.lastSpringFrost.median));
	const fallFrostPercent = $derived(dayToPercent(frostDates.firstFallFrost.median));
	const springFrostDate = $derived(dayToDate(frostDates.lastSpringFrost.median));
	const fallFrostDate = $derived(dayToDate(frostDates.firstFallFrost.median));
	const typicalLength = $derived(growingSeason.lengthDays.typical);
	const rangeText = $derived(
		`${growingSeason.lengthDays.short}–${growingSeason.lengthDays.long} days`
	);

	/**
	 * Width of the growing season bar as a percentage of the timeline.
	 */
	const growingSeasonWidth = $derived(fallFrostPercent - springFrostPercent);

	/**
	 * Determines confidence label for frost date estimates.
	 */
	const confidenceLabel = $derived({
		high: 'High confidence',
		medium: 'Moderate confidence',
		low: 'Approximate estimate'
	}[frostDates.confidence]);
</script>

<article class="growing-season-timeline">
	<header class="card-header">
		<h3>Growing Season</h3>
		<span class="season-length">{typicalLength} days typical</span>
	</header>

	<div class="card-body">
		<div class="timeline-container">
			<div class="timeline">
				<!-- Frost risk periods (winter) -->
				<div
					class="frost-period frost-period-winter-start"
					style="left: 0; width: {springFrostPercent}%"
				></div>
				<div
					class="frost-period frost-period-winter-end"
					style="left: {fallFrostPercent}%; width: {100 - fallFrostPercent}%"
				></div>

				<!-- Growing season (frost-free period) -->
				<div
					class="growing-period"
					style="left: {springFrostPercent}%; width: {growingSeasonWidth}%"
				></div>

				<!-- Frost date markers -->
				<div
					class="frost-marker frost-marker-spring"
					style="left: {springFrostPercent}%"
				>
					<div class="marker-line"></div>
					<div class="marker-label marker-label-spring">
						<span class="marker-date">{springFrostDate}</span>
						<span class="marker-text">Last frost</span>
					</div>
				</div>

				<div
					class="frost-marker frost-marker-fall"
					style="left: {fallFrostPercent}%"
				>
					<div class="marker-line"></div>
					<div class="marker-label marker-label-fall">
						<span class="marker-date">{fallFrostDate}</span>
						<span class="marker-text">First frost</span>
					</div>
				</div>
			</div>

			<!-- Month labels -->
			<div class="month-labels">
				{#each months as month, i}
					<span
						class="month-label"
						style="left: {(i / 12) * 100}%"
					>{month}</span>
				{/each}
			</div>
		</div>

		<div class="legend">
			<div class="legend-item">
				<span class="legend-swatch growing-swatch"></span>
				<span class="legend-text">Frost-free growing season</span>
			</div>
			<div class="legend-item">
				<span class="legend-swatch frost-swatch"></span>
				<span class="legend-text">Frost risk period</span>
			</div>
		</div>

		<div class="details">
			<div class="detail-row">
				<span class="detail-label">Growing season length</span>
				<span class="detail-value">{rangeText}</span>
			</div>
			<div class="detail-row">
				<span class="detail-label">Data quality</span>
				<span class="detail-value confidence-{frostDates.confidence}">{confidenceLabel}</span>
			</div>
		</div>
	</div>
</article>

<style>
	.growing-season-timeline {
		font-family: system-ui, -apple-system, sans-serif;
		background: #f0f9ff;
		border: 1px solid #7dd3fc;
		border-radius: 8px;
		overflow: hidden;
	}

	.card-header {
		background: #e0f2fe;
		padding: 0.75rem 1rem;
		border-bottom: 1px solid #7dd3fc;
		display: flex;
		justify-content: space-between;
		align-items: center;
	}

	.card-header h3 {
		margin: 0;
		font-size: 0.9375rem;
		color: #0369a1;
		font-weight: 600;
	}

	.season-length {
		font-size: 0.8125rem;
		color: #0284c7;
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
		padding-top: 2.5rem;
		padding-bottom: 1.5rem;
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

	.growing-period {
		position: absolute;
		top: 0;
		height: 100%;
		background: linear-gradient(90deg, #22c55e, #4ade80, #22c55e);
		border-radius: 0;
	}

	.frost-marker {
		position: absolute;
		top: -2.25rem;
		transform: translateX(-50%);
		display: flex;
		flex-direction: column;
		align-items: center;
	}

	.marker-line {
		width: 2px;
		height: calc(24px + 2.25rem);
		background: #0369a1;
	}

	.marker-label {
		position: absolute;
		top: 0;
		display: flex;
		flex-direction: column;
		align-items: center;
		white-space: nowrap;
	}

	.marker-label-spring {
		transform: translateX(-100%) translateX(-0.5rem);
		align-items: flex-end;
	}

	.marker-label-fall {
		transform: translateX(0.5rem);
		align-items: flex-start;
	}

	.marker-date {
		font-size: 0.8125rem;
		font-weight: 600;
		color: #0369a1;
	}

	.marker-text {
		font-size: 0.6875rem;
		color: #64748b;
		text-transform: uppercase;
		letter-spacing: 0.025em;
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
		gap: 1.5rem;
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

	.growing-swatch {
		background: #4ade80;
	}

	.frost-swatch {
		background: #cbd5e1;
	}

	.legend-text {
		font-size: 0.8125rem;
		color: #4b5563;
	}

	.details {
		display: flex;
		flex-direction: column;
		gap: 0.375rem;
		padding-top: 0.75rem;
		border-top: 1px solid #bae6fd;
	}

	.detail-row {
		display: flex;
		justify-content: space-between;
		align-items: center;
		font-size: 0.875rem;
	}

	.detail-label {
		color: #64748b;
	}

	.detail-value {
		color: #1e293b;
		font-weight: 500;
	}

	.detail-value.confidence-high {
		color: #16a34a;
	}

	.detail-value.confidence-medium {
		color: #ca8a04;
	}

	.detail-value.confidence-low {
		color: #dc2626;
	}

	/* Responsive adjustments */
	@media (max-width: 480px) {
		.card-header {
			flex-direction: column;
			align-items: flex-start;
			gap: 0.25rem;
		}

		.timeline-container {
			padding-top: 3rem;
		}

		.marker-label-spring,
		.marker-label-fall {
			transform: translateX(-50%);
			align-items: center;
		}

		.marker-label-spring {
			top: -0.5rem;
		}

		.marker-label-fall {
			top: -0.5rem;
		}

		.frost-marker-spring .marker-label {
			left: 0;
			transform: none;
		}

		.frost-marker-fall .marker-label {
			right: 0;
			left: auto;
			transform: none;
		}

		.legend {
			flex-direction: column;
			gap: 0.5rem;
		}

		.month-label {
			font-size: 0.625rem;
		}
	}
</style>
