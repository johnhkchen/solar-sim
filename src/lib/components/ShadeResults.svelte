<script lang="ts">
	import type { DailyShadeAnalysis, Obstacle } from '$lib/solar';
	import { getCategoryInfo, type LightCategory } from '$lib/categories';

	interface ShadeResultsProps {
		analysis: DailyShadeAnalysis;
		obstacles: Obstacle[];
	}

	let { analysis, obstacles }: ShadeResultsProps = $props();

	const theoreticalCategory = $derived(getCategoryInfo(analysis.theoreticalSunHours));
	const effectiveCategory = $derived(getCategoryInfo(analysis.effectiveSunHours));
	const hoursBlocked = $derived(analysis.theoreticalSunHours - analysis.effectiveSunHours);
	const effectivePercent = $derived(
		analysis.theoreticalSunHours > 0
			? Math.round((analysis.effectiveSunHours / analysis.theoreticalSunHours) * 100)
			: 100
	);

	const categoryIcons: Record<LightCategory, string> = {
		'full-sun': '☀️',
		'part-sun': '🌤️',
		'part-shade': '⛅',
		'full-shade': '☁️'
	};

	const effectiveIcon = $derived(categoryIcons[effectiveCategory.category]);

	/**
	 * Determines whether the shade impact should be considered significant.
	 * A loss of more than 10% of sun hours is considered meaningful.
	 */
	const hasSignificantShade = $derived(analysis.percentBlocked > 10);

	/**
	 * Determines whether the category changed due to shade.
	 * This is important to highlight since it affects planting recommendations.
	 */
	const categoryChanged = $derived(
		theoreticalCategory.category !== effectiveCategory.category
	);
</script>

<article class="shade-results">
	<header class="card-header">
		<h3>Shade Impact</h3>
		{#if obstacles.length === 0}
			<span class="no-obstacles">No obstacles added</span>
		{:else}
			<span class="obstacle-count">
				{obstacles.length} obstacle{obstacles.length === 1 ? '' : 's'}
			</span>
		{/if}
	</header>

	<div class="card-body">
		{#if obstacles.length === 0}
			<p class="no-data-message">
				Add obstacles to see how they affect your sun hours.
			</p>
		{:else}
			<div class="comparison">
				<div class="comparison-row">
					<span class="comparison-label">Theoretical maximum</span>
					<span class="comparison-value">{analysis.theoreticalSunHours.toFixed(1)} hours</span>
				</div>
				<div class="comparison-row effective">
					<span class="comparison-label">With your obstacles</span>
					<span class="comparison-value">
						{analysis.effectiveSunHours.toFixed(1)} hours
						<span class="percent">({effectivePercent}%)</span>
					</span>
				</div>
				<div class="comparison-row blocked">
					<span class="comparison-label">Sun hours blocked</span>
					<span class="comparison-value negative">{hoursBlocked.toFixed(1)} hours</span>
				</div>
			</div>

			<div class="effective-category">
				<span class="category-icon">{effectiveIcon}</span>
				<span class="category-label">{effectiveCategory.label}</span>
				{#if categoryChanged}
					<span class="category-change">
						(was {theoreticalCategory.label})
					</span>
				{/if}
			</div>

			{#if categoryChanged}
				<p class="category-warning">
					Shade reduces your light category from {theoreticalCategory.label.toLowerCase()} to {effectiveCategory.label.toLowerCase()}, which affects plant recommendations.
				</p>
			{:else if hasSignificantShade}
				<p class="shade-note">
					Your obstacles block {analysis.percentBlocked.toFixed(0)}% of available sunlight, but you remain in the {effectiveCategory.label.toLowerCase()} category.
				</p>
			{:else}
				<p class="shade-note">
					Minimal shade impact on this location.
				</p>
			{/if}
		{/if}
	</div>
</article>

<style>
	.shade-results {
		font-family: system-ui, -apple-system, sans-serif;
		background: #f0fdf4;
		border: 1px solid #86efac;
		border-radius: 8px;
		overflow: hidden;
	}

	.card-header {
		background: #dcfce7;
		padding: 0.75rem 1rem;
		border-bottom: 1px solid #86efac;
		display: flex;
		justify-content: space-between;
		align-items: center;
	}

	.card-header h3 {
		margin: 0;
		font-size: 0.9375rem;
		color: #166534;
		font-weight: 600;
	}

	.no-obstacles,
	.obstacle-count {
		font-size: 0.8125rem;
		color: #15803d;
	}

	.card-body {
		padding: 1.25rem 1rem;
		display: flex;
		flex-direction: column;
		gap: 1rem;
	}

	.no-data-message {
		margin: 0;
		color: #4b5563;
		font-size: 0.9375rem;
	}

	.comparison {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		font-family: ui-monospace, SFMono-Regular, Consolas, monospace;
		font-size: 0.9375rem;
	}

	.comparison-row {
		display: flex;
		justify-content: space-between;
		align-items: center;
	}

	.comparison-label {
		color: #374151;
	}

	.comparison-value {
		font-weight: 500;
		color: #1f2937;
	}

	.comparison-row.effective .comparison-value {
		color: #166534;
		font-weight: 600;
	}

	.percent {
		font-weight: normal;
		color: #4b5563;
	}

	.comparison-row.blocked {
		padding-top: 0.5rem;
		border-top: 1px solid #bbf7d0;
	}

	.comparison-value.negative {
		color: #dc2626;
	}

	.effective-category {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.75rem;
		background: #dcfce7;
		border-radius: 6px;
	}

	.category-icon {
		font-size: 1.5rem;
	}

	.category-label {
		font-size: 1.125rem;
		font-weight: 500;
		color: #1a1a1a;
	}

	.category-change {
		font-size: 0.875rem;
		color: #dc2626;
		font-style: italic;
	}

	.category-warning {
		margin: 0;
		padding: 0.75rem;
		background: #fef2f2;
		border: 1px solid #fecaca;
		border-radius: 6px;
		color: #991b1b;
		font-size: 0.875rem;
		line-height: 1.4;
	}

	.shade-note {
		margin: 0;
		color: #4b5563;
		font-size: 0.875rem;
		line-height: 1.4;
	}
</style>
