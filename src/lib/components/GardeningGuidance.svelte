<script lang="ts">
	/**
	 * GardeningGuidance component displays tree-aware planting recommendations
	 * based on combined sun-hours calculations and climate data.
	 *
	 * This component bridges the map-based shade visualization with actionable
	 * gardening guidance, showing users how their specific tree placement and
	 * terrain affects what they can grow.
	 */
	import type { ClimateData } from '$lib/climate';
	import type { MapTreeConfig, CombinedSunHoursResult, SeasonalCombinedSunHours } from '$lib/solar';
	import {
		getRecommendationsFromSunHours,
		getPlantingGuidance,
		assessTreeManagementBenefit,
		type TreeAwareRecommendationResult
	} from '$lib/plants';

	interface GardeningGuidanceProps {
		sunHoursResult: CombinedSunHoursResult | SeasonalCombinedSunHours;
		climate: ClimateData;
		trees: MapTreeConfig[];
	}

	let { sunHoursResult, climate, trees }: GardeningGuidanceProps = $props();

	// Generate tree-aware recommendations
	const recommendations = $derived<TreeAwareRecommendationResult>(
		getRecommendationsFromSunHours(sunHoursResult, climate, trees)
	);

	// Generate planting guidance based on recommendations
	const guidance = $derived.by(() => {
		const input = {
			effectiveSunHours: recommendations.effectiveCategory.category === 'full-sun' ? 8 : 4,
			theoreticalSunHours: recommendations.theoreticalCategory.category === 'full-sun' ? 10 : 6,
			climate,
			breakdown:
				'averageBreakdown' in sunHoursResult
					? sunHoursResult.averageBreakdown
					: sunHoursResult.breakdown,
			treeCount: trees.length
		};
		return getPlantingGuidance(input, recommendations);
	});

	// Check if tree management would be beneficial
	const treeManagement = $derived.by(() => {
		const breakdown =
			'averageBreakdown' in sunHoursResult
				? sunHoursResult.averageBreakdown
				: sunHoursResult.breakdown;
		return assessTreeManagementBenefit({
			effectiveSunHours: breakdown.effective,
			theoreticalSunHours: breakdown.theoretical,
			climate,
			breakdown,
			treeCount: trees.length
		});
	});

	// Category colors
	const categoryColors: Record<string, string> = {
		'full-sun': '#f59e0b',
		'part-sun': '#84cc16',
		'part-shade': '#22c55e',
		'full-shade': '#6b7280'
	};
</script>

<div class="gardening-guidance">
	<header class="header">
		<h3>Gardening Guidance</h3>
		<div
			class="category-badge"
			style="background-color: {categoryColors[recommendations.effectiveCategory.category]}"
		>
			{recommendations.effectiveCategory.label}
		</div>
	</header>

	{#if recommendations.hasShadeDowngrade}
		<div class="shade-impact">
			<div class="impact-indicator downgrade">
				<span class="impact-icon">⬇</span>
				<span class="impact-text">
					{recommendations.shadeImpactSummary}
				</span>
			</div>
		</div>
	{:else if trees.length > 0}
		<div class="shade-impact">
			<div class="impact-indicator neutral">
				<span class="impact-icon">ℹ</span>
				<span class="impact-text">
					{recommendations.shadeImpactSummary}
				</span>
			</div>
		</div>
	{/if}

	{#if recommendations.treeShadeNotes.length > 0}
		<div class="tree-notes">
			{#each recommendations.treeShadeNotes as note}
				<div class="note note-{note.type}">
					<span class="note-icon">
						{#if note.type === 'benefit'}✨
						{:else if note.type === 'caution'}⚠️
						{:else}💡{/if}
					</span>
					<span class="note-text">{note.text}</span>
				</div>
			{/each}
		</div>
	{/if}

	<div class="guidance-list">
		<h4>What You Can Grow</h4>
		{#each guidance as tip}
			<p class="guidance-item">{tip}</p>
		{/each}
	</div>

	{#if treeManagement.beneficial && treeManagement.recommendation}
		<div class="tree-management">
			<h4>Improve Your Light</h4>
			<p class="management-tip">{treeManagement.recommendation}</p>
		</div>
	{/if}

	<div class="quick-picks">
		<h4>Top Picks for This Spot</h4>
		{#if recommendations.excellent.length > 0}
			<div class="picks-category excellent">
				<span class="picks-label">Excellent:</span>
				<span class="picks-list">
					{recommendations.excellent
						.slice(0, 4)
						.map((r) => r.plant.name)
						.join(', ')}
				</span>
			</div>
		{/if}
		{#if recommendations.good.length > 0}
			<div class="picks-category good">
				<span class="picks-label">Good:</span>
				<span class="picks-list">
					{recommendations.good
						.slice(0, 4)
						.map((r) => r.plant.name)
						.join(', ')}
				</span>
			</div>
		{/if}
		{#if recommendations.excellent.length === 0 && recommendations.good.length === 0}
			<p class="no-picks">
				This location is best suited for shade-tolerant ornamentals and ground covers.
			</p>
		{/if}
	</div>
</div>

<style>
	.gardening-guidance {
		display: flex;
		flex-direction: column;
		gap: 1rem;
		padding: 1rem;
		background: #fefce8;
		border: 1px solid #fde047;
		border-radius: 8px;
		font-family: system-ui, -apple-system, sans-serif;
	}

	.header {
		display: flex;
		justify-content: space-between;
		align-items: center;
	}

	.header h3 {
		margin: 0;
		font-size: 1rem;
		font-weight: 600;
		color: #854d0e;
	}

	.category-badge {
		padding: 0.25rem 0.75rem;
		border-radius: 9999px;
		font-size: 0.75rem;
		font-weight: 500;
		color: white;
	}

	.shade-impact {
		padding: 0.75rem;
		background: #fffbeb;
		border-radius: 6px;
	}

	.impact-indicator {
		display: flex;
		align-items: flex-start;
		gap: 0.5rem;
		font-size: 0.875rem;
		line-height: 1.4;
	}

	.impact-indicator.downgrade .impact-text {
		color: #b45309;
	}

	.impact-indicator.neutral .impact-text {
		color: #78350f;
	}

	.impact-icon {
		font-size: 1rem;
		flex-shrink: 0;
	}

	.tree-notes {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.note {
		display: flex;
		align-items: flex-start;
		gap: 0.5rem;
		padding: 0.5rem 0.75rem;
		border-radius: 6px;
		font-size: 0.8125rem;
		line-height: 1.4;
	}

	.note-benefit {
		background: #ecfdf5;
		border: 1px solid #a7f3d0;
	}

	.note-benefit .note-text {
		color: #065f46;
	}

	.note-caution {
		background: #fef3c7;
		border: 1px solid #fde68a;
	}

	.note-caution .note-text {
		color: #92400e;
	}

	.note-tip {
		background: #e0f2fe;
		border: 1px solid #bae6fd;
	}

	.note-tip .note-text {
		color: #0369a1;
	}

	.note-icon {
		flex-shrink: 0;
	}

	.guidance-list {
		border-top: 1px solid #fde68a;
		padding-top: 0.75rem;
	}

	.guidance-list h4 {
		margin: 0 0 0.5rem;
		font-size: 0.875rem;
		font-weight: 600;
		color: #78350f;
	}

	.guidance-item {
		margin: 0 0 0.5rem;
		font-size: 0.875rem;
		color: #374151;
		line-height: 1.5;
	}

	.guidance-item:last-child {
		margin-bottom: 0;
	}

	.tree-management {
		padding: 0.75rem;
		background: #f0fdf4;
		border: 1px solid #86efac;
		border-radius: 6px;
	}

	.tree-management h4 {
		margin: 0 0 0.375rem;
		font-size: 0.8125rem;
		font-weight: 600;
		color: #166534;
	}

	.management-tip {
		margin: 0;
		font-size: 0.8125rem;
		color: #15803d;
		line-height: 1.4;
	}

	.quick-picks {
		border-top: 1px solid #fde68a;
		padding-top: 0.75rem;
	}

	.quick-picks h4 {
		margin: 0 0 0.5rem;
		font-size: 0.875rem;
		font-weight: 600;
		color: #78350f;
	}

	.picks-category {
		display: flex;
		gap: 0.5rem;
		margin-bottom: 0.375rem;
		font-size: 0.8125rem;
	}

	.picks-label {
		font-weight: 500;
		color: #6b7280;
		flex-shrink: 0;
	}

	.picks-category.excellent .picks-label {
		color: #166534;
	}

	.picks-category.good .picks-label {
		color: #1e40af;
	}

	.picks-list {
		color: #374151;
	}

	.no-picks {
		margin: 0;
		font-size: 0.875rem;
		color: #6b7280;
		font-style: italic;
	}

	@media (max-width: 480px) {
		.gardening-guidance {
			padding: 0.75rem;
			gap: 0.75rem;
		}

		.header {
			flex-direction: column;
			align-items: flex-start;
			gap: 0.375rem;
		}

		.header h3 {
			font-size: 0.9375rem;
		}

		.category-badge {
			padding: 0.1875rem 0.5rem;
			font-size: 0.6875rem;
		}

		.shade-impact {
			padding: 0.5rem;
		}

		.impact-indicator {
			font-size: 0.8125rem;
		}

		.impact-icon {
			font-size: 0.875rem;
		}

		.note {
			padding: 0.375rem 0.5rem;
			font-size: 0.75rem;
		}

		.guidance-list h4,
		.quick-picks h4 {
			font-size: 0.8125rem;
			margin-bottom: 0.375rem;
		}

		.guidance-item {
			font-size: 0.8125rem;
			margin-bottom: 0.375rem;
		}

		.tree-management {
			padding: 0.625rem;
		}

		.tree-management h4 {
			font-size: 0.75rem;
		}

		.management-tip {
			font-size: 0.75rem;
		}

		.picks-category {
			flex-direction: column;
			gap: 0.25rem;
			font-size: 0.75rem;
		}

		.picks-label {
			flex-shrink: 0;
		}

		.no-picks {
			font-size: 0.8125rem;
		}
	}
</style>
