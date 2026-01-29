<script lang="ts">
	import type {
		RecommendationResult,
		PlantRecommendation,
		PlantCategory,
		ContextualNoteType
	} from '$lib/plants';

	interface PlantRecommendationsProps {
		recommendations: RecommendationResult;
	}

	let { recommendations }: PlantRecommendationsProps = $props();

	const categoryLabels: Record<PlantCategory, string> = {
		vegetable: 'Vegetables',
		herb: 'Herbs',
		flower: 'Flowers'
	};

	const noteIcons: Record<ContextualNoteType, string> = {
		benefit: '✨',
		caution: '⚠️',
		tip: '💡'
	};

	/**
	 * Groups recommendations by plant category for display. This makes it
	 * easier for users to scan the list and find plants they're interested in.
	 */
	function groupByCategory(
		plants: PlantRecommendation[]
	): Record<PlantCategory, PlantRecommendation[]> {
		const groups: Record<PlantCategory, PlantRecommendation[]> = {
			vegetable: [],
			herb: [],
			flower: []
		};

		for (const rec of plants) {
			groups[rec.plant.category].push(rec);
		}

		return groups;
	}

	const excellentByCategory = $derived(groupByCategory(recommendations.excellent));
	const goodByCategory = $derived(groupByCategory(recommendations.good));
	const marginalByCategory = $derived(groupByCategory(recommendations.marginal));

	const totalExcellent = $derived(recommendations.excellent.length);
	const totalGood = $derived(recommendations.good.length);
	const totalMarginal = $derived(recommendations.marginal.length);
	const totalRecommended = $derived(totalExcellent + totalGood + totalMarginal);

	/**
	 * Determines which categories have plants in this suitability tier.
	 * Used to avoid rendering empty category sections.
	 */
	function getNonEmptyCategories(
		groups: Record<PlantCategory, PlantRecommendation[]>
	): PlantCategory[] {
		return (['vegetable', 'herb', 'flower'] as PlantCategory[]).filter(
			(cat) => groups[cat].length > 0
		);
	}
</script>

<article class="plant-recommendations">
	<header class="card-header">
		<h3>Recommendations</h3>
		{#if totalRecommended > 0}
			<span class="recommendation-count">
				{totalRecommended} plant{totalRecommended === 1 ? '' : 's'} suited
			</span>
		{/if}
	</header>

	<div class="card-body">
		<p class="summary-note">{recommendations.summaryNote}</p>

		{#if totalRecommended === 0}
			<p class="no-recommendations">
				No plants in our database match these conditions well. Consider container
				gardening in a sunnier spot or growing shade-tolerant native plants.
			</p>
		{:else}
			{#if totalExcellent > 0}
				<section class="suitability-section excellent">
					<h4 class="suitability-header">
						<span class="suitability-icon">🌟</span>
						<span class="suitability-label">Excellent Match</span>
						<span class="suitability-count">({totalExcellent})</span>
					</h4>

					{#each getNonEmptyCategories(excellentByCategory) as category}
						<div class="category-group">
							<h5 class="category-label">{categoryLabels[category]}</h5>
							<ul class="plant-list">
								{#each excellentByCategory[category] as rec}
									<li class="plant-item">
										<span class="plant-check">✓</span>
										<span class="plant-name">{rec.plant.name}</span>
										{#if rec.notes.length > 0}
											<span class="plant-notes">
												{#each rec.notes.slice(0, 2) as note}
													<span class="note note-{note.type}" title={note.text}>
														{noteIcons[note.type]}
													</span>
												{/each}
											</span>
										{/if}
									</li>
								{/each}
							</ul>
						</div>
					{/each}
				</section>
			{/if}

			{#if totalGood > 0}
				<section class="suitability-section good">
					<h4 class="suitability-header">
						<span class="suitability-icon">👍</span>
						<span class="suitability-label">Good Match</span>
						<span class="suitability-count">({totalGood})</span>
					</h4>

					{#each getNonEmptyCategories(goodByCategory) as category}
						<div class="category-group">
							<h5 class="category-label">{categoryLabels[category]}</h5>
							<ul class="plant-list">
								{#each goodByCategory[category] as rec}
									<li class="plant-item">
										<span class="plant-check">✓</span>
										<span class="plant-name">{rec.plant.name}</span>
										{#if rec.notes.length > 0}
											<span class="plant-notes">
												{#each rec.notes.slice(0, 2) as note}
													<span class="note note-{note.type}" title={note.text}>
														{noteIcons[note.type]}
													</span>
												{/each}
											</span>
										{/if}
									</li>
								{/each}
							</ul>
						</div>
					{/each}
				</section>
			{/if}

			{#if totalMarginal > 0}
				<section class="suitability-section marginal">
					<h4 class="suitability-header">
						<span class="suitability-icon">🤔</span>
						<span class="suitability-label">May Work</span>
						<span class="suitability-count">({totalMarginal})</span>
					</h4>
					<p class="marginal-note">
						These plants may struggle or require extra care at this location.
					</p>

					{#each getNonEmptyCategories(marginalByCategory) as category}
						<div class="category-group">
							<h5 class="category-label">{categoryLabels[category]}</h5>
							<ul class="plant-list">
								{#each marginalByCategory[category] as rec}
									<li class="plant-item">
										<span class="plant-check muted">✓</span>
										<span class="plant-name">{rec.plant.name}</span>
										{#if rec.notes.length > 0}
											<span class="plant-notes">
												{#each rec.notes.slice(0, 2) as note}
													<span class="note note-{note.type}" title={note.text}>
														{noteIcons[note.type]}
													</span>
												{/each}
											</span>
										{/if}
									</li>
								{/each}
							</ul>
						</div>
					{/each}
				</section>
			{/if}

			{#if recommendations.excellent.length > 0 || recommendations.good.length > 0}
				{@const topNotes = [
					...recommendations.excellent.flatMap((r) => r.notes),
					...recommendations.good.flatMap((r) => r.notes)
				].filter((n) => n.type === 'tip' || n.type === 'benefit')}
				{#if topNotes.length > 0}
					<section class="tips-section">
						<h4 class="tips-header">
							<span class="tips-icon">💡</span>
							<span class="tips-label">Tips for This Location</span>
						</h4>
						<ul class="tips-list">
							{#each [...new Set(topNotes.map((n) => n.text))].slice(0, 3) as tipText}
								<li class="tip-item">{tipText}</li>
							{/each}
						</ul>
					</section>
				{/if}
			{/if}
		{/if}
	</div>
</article>

<style>
	.plant-recommendations {
		font-family: system-ui, -apple-system, sans-serif;
		background: #fefce8;
		border: 1px solid #fde047;
		border-radius: 8px;
		overflow: hidden;
	}

	.card-header {
		background: #fef9c3;
		padding: 0.75rem 1rem;
		border-bottom: 1px solid #fde047;
		display: flex;
		justify-content: space-between;
		align-items: center;
	}

	.card-header h3 {
		margin: 0;
		font-size: 0.9375rem;
		color: #854d0e;
		font-weight: 600;
	}

	.recommendation-count {
		font-size: 0.8125rem;
		color: #a16207;
	}

	.card-body {
		padding: 1.25rem 1rem;
		display: flex;
		flex-direction: column;
		gap: 1.25rem;
	}

	.summary-note {
		margin: 0;
		font-size: 0.9375rem;
		color: #374151;
		line-height: 1.5;
		padding: 0.75rem;
		background: #fffbeb;
		border-radius: 6px;
		border-left: 3px solid #f59e0b;
	}

	.no-recommendations {
		margin: 0;
		color: #6b7280;
		font-size: 0.9375rem;
		font-style: italic;
	}

	.suitability-section {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}

	.suitability-header {
		margin: 0;
		display: flex;
		align-items: center;
		gap: 0.5rem;
		font-size: 1rem;
		font-weight: 600;
		color: #1f2937;
	}

	.suitability-icon {
		font-size: 1.125rem;
	}

	.suitability-label {
		flex: 1;
	}

	.suitability-count {
		font-size: 0.875rem;
		font-weight: normal;
		color: #6b7280;
	}

	.marginal-note {
		margin: 0;
		font-size: 0.8125rem;
		color: #6b7280;
		font-style: italic;
	}

	.category-group {
		display: flex;
		flex-direction: column;
		gap: 0.375rem;
		padding-left: 0.5rem;
	}

	.category-label {
		margin: 0;
		font-size: 0.8125rem;
		font-weight: 500;
		color: #78350f;
		text-transform: uppercase;
		letter-spacing: 0.05em;
	}

	.plant-list {
		margin: 0;
		padding: 0;
		list-style: none;
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
	}

	.plant-item {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.25rem 0;
		font-size: 0.9375rem;
	}

	.plant-check {
		color: #16a34a;
		font-weight: 600;
	}

	.plant-check.muted {
		color: #9ca3af;
	}

	.plant-name {
		color: #1f2937;
	}

	.plant-notes {
		display: flex;
		gap: 0.25rem;
		margin-left: auto;
	}

	.note {
		font-size: 0.875rem;
		cursor: help;
	}

	.note-benefit {
		color: #16a34a;
	}

	.note-caution {
		color: #d97706;
	}

	.note-tip {
		color: #0891b2;
	}

	.tips-section {
		margin-top: 0.5rem;
		padding-top: 1rem;
		border-top: 1px solid #fde68a;
	}

	.tips-header {
		margin: 0 0 0.75rem 0;
		display: flex;
		align-items: center;
		gap: 0.5rem;
		font-size: 0.9375rem;
		font-weight: 600;
		color: #1f2937;
	}

	.tips-icon {
		font-size: 1rem;
	}

	.tips-label {
		flex: 1;
	}

	.tips-list {
		margin: 0;
		padding: 0;
		list-style: none;
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.tip-item {
		font-size: 0.875rem;
		color: #374151;
		line-height: 1.4;
		padding: 0.5rem 0.75rem;
		background: #ecfdf5;
		border-radius: 4px;
		border-left: 2px solid #10b981;
	}

	/* Responsive adjustments */
	@media (max-width: 480px) {
		.card-body {
			padding: 1rem 0.75rem;
		}

		.plant-item {
			flex-wrap: wrap;
		}

		.plant-notes {
			margin-left: 1.25rem;
			width: 100%;
		}
	}
</style>
