<script lang="ts">
	/**
	 * Monthly data for the seasonal light chart. Each entry represents one month
	 * and includes both theoretical sun hours (as if no obstacles existed) and
	 * effective sun hours (accounting for shade). When no obstacles are defined,
	 * effectiveHours equals theoreticalHours.
	 */
	export interface MonthlySunData {
		month: number; // 1-12
		theoreticalHours: number;
		effectiveHours: number;
	}

	interface SeasonalLightChartProps {
		monthlyData: MonthlySunData[];
		hasShadeData?: boolean;
	}

	let { monthlyData, hasShadeData = false }: SeasonalLightChartProps = $props();

	const monthNames = [
		'Jan',
		'Feb',
		'Mar',
		'Apr',
		'May',
		'Jun',
		'Jul',
		'Aug',
		'Sep',
		'Oct',
		'Nov',
		'Dec'
	];

	/**
	 * Finds the maximum hours value across all months to normalize bar heights.
	 * Uses theoretical hours since they're always >= effective hours.
	 */
	const maxHours = $derived(Math.max(...monthlyData.map((d) => d.theoreticalHours), 1));

	/**
	 * Calculates percent blocked for each month, used to highlight high-impact months.
	 */
	function getPercentBlocked(data: MonthlySunData): number {
		if (data.theoreticalHours === 0) return 0;
		return ((data.theoreticalHours - data.effectiveHours) / data.theoreticalHours) * 100;
	}

	/**
	 * Determines if a month has high shade impact (more than 20% blocked).
	 */
	function hasHighShadeImpact(data: MonthlySunData): boolean {
		return getPercentBlocked(data) > 20;
	}

	/**
	 * Finds the month with the highest shade impact for display in the summary.
	 */
	const highestImpactMonth = $derived(() => {
		if (!hasShadeData) return null;
		let maxBlocked = 0;
		let maxMonth: number | null = null;
		for (const data of monthlyData) {
			const blocked = getPercentBlocked(data);
			if (blocked > maxBlocked) {
				maxBlocked = blocked;
				maxMonth = data.month;
			}
		}
		return maxMonth !== null && maxBlocked > 5 ? { month: maxMonth, percent: maxBlocked } : null;
	});

	/**
	 * Calculates annual averages for the summary section.
	 */
	const annualAverage = $derived(() => {
		const sumTheoretical = monthlyData.reduce((sum, d) => sum + d.theoreticalHours, 0);
		const sumEffective = monthlyData.reduce((sum, d) => sum + d.effectiveHours, 0);
		return {
			theoretical: sumTheoretical / 12,
			effective: sumEffective / 12
		};
	});

	/**
	 * Formats hours for display, showing one decimal place.
	 */
	function formatHours(hours: number): string {
		return hours.toFixed(1);
	}
</script>

<article class="seasonal-light-chart">
	<header class="card-header">
		<h3>Seasonal Light Chart</h3>
		<span class="summary">
			{formatHours(annualAverage().effective)} hrs/day average
			{#if hasShadeData && annualAverage().theoretical > annualAverage().effective}
				<span class="shade-note">
					({formatHours(annualAverage().theoretical - annualAverage().effective)} lost to shade)
				</span>
			{/if}
		</span>
	</header>

	<div class="card-body">
		<div class="chart-container">
			<div class="chart">
				{#each monthlyData as data, i}
					{@const theoreticalPercent = (data.theoreticalHours / maxHours) * 100}
					{@const effectivePercent = (data.effectiveHours / maxHours) * 100}
					{@const percentBlocked = getPercentBlocked(data)}
					{@const isHighImpact = hasHighShadeImpact(data)}

					<div class="month-column">
						<div class="bar-container">
							<!-- Theoretical hours bar (background, lighter) -->
							{#if hasShadeData}
								<div
									class="bar bar-theoretical"
									style="height: {theoreticalPercent}%"
									title="{formatHours(data.theoreticalHours)} hours (theoretical)"
								></div>
							{/if}

							<!-- Effective hours bar (foreground, darker) -->
							<div
								class="bar bar-effective"
								class:bar-high-impact={isHighImpact && hasShadeData}
								style="height: {effectivePercent}%"
								title="{formatHours(data.effectiveHours)} hours{hasShadeData ? ' (effective)' : ''}"
							></div>

							<!-- Shade impact indicator -->
							{#if hasShadeData && percentBlocked > 5}
								<div class="shade-indicator" style="bottom: {effectivePercent}%">
									<span class="shade-percent">-{Math.round(percentBlocked)}%</span>
								</div>
							{/if}
						</div>

						<span class="month-label">{monthNames[i]}</span>
						<span class="hours-label">{formatHours(data.effectiveHours)}</span>
					</div>
				{/each}
			</div>

			<!-- Y-axis scale markers -->
			<div class="y-axis">
				<span class="y-label" style="bottom: 100%">{Math.round(maxHours)}h</span>
				<span class="y-label" style="bottom: 50%">{Math.round(maxHours / 2)}h</span>
				<span class="y-label" style="bottom: 0%">0h</span>
			</div>
		</div>

		{#if hasShadeData}
			<div class="legend">
				<div class="legend-item">
					<span class="legend-swatch theoretical-swatch"></span>
					<span class="legend-text">Theoretical sun hours</span>
				</div>
				<div class="legend-item">
					<span class="legend-swatch effective-swatch"></span>
					<span class="legend-text">Effective sun hours</span>
				</div>
				<div class="legend-item">
					<span class="legend-swatch high-impact-swatch"></span>
					<span class="legend-text">High shade impact (>20%)</span>
				</div>
			</div>
		{:else}
			<div class="legend">
				<div class="legend-item">
					<span class="legend-swatch effective-swatch"></span>
					<span class="legend-text">Daily sun hours</span>
				</div>
			</div>
		{/if}

		<div class="details">
			<div class="detail-row">
				<span class="detail-label">Summer peak</span>
				<span class="detail-value">
					{formatHours(Math.max(...monthlyData.map((d) => d.effectiveHours)))} hrs/day
				</span>
			</div>
			<div class="detail-row">
				<span class="detail-label">Winter minimum</span>
				<span class="detail-value">
					{formatHours(Math.min(...monthlyData.map((d) => d.effectiveHours)))} hrs/day
				</span>
			</div>
			{#if hasShadeData && highestImpactMonth()}
				<div class="detail-row">
					<span class="detail-label">Highest shade impact</span>
					<span class="detail-value shade-impact">
						{monthNames[highestImpactMonth()!.month - 1]} ({Math.round(highestImpactMonth()!.percent)}%
						blocked)
					</span>
				</div>
			{/if}
		</div>
	</div>
</article>

<style>
	.seasonal-light-chart {
		font-family: system-ui, -apple-system, sans-serif;
		background: #fdf4ff;
		border: 1px solid #e879f9;
		border-radius: 8px;
		overflow: hidden;
	}

	.card-header {
		background: #fae8ff;
		padding: 0.75rem 1rem;
		border-bottom: 1px solid #e879f9;
		display: flex;
		justify-content: space-between;
		align-items: center;
		flex-wrap: wrap;
		gap: 0.5rem;
	}

	.card-header h3 {
		margin: 0;
		font-size: 0.9375rem;
		color: #a21caf;
		font-weight: 600;
	}

	.summary {
		font-size: 0.8125rem;
		color: #c026d3;
		font-weight: 500;
	}

	.shade-note {
		font-size: 0.75rem;
		color: #86198f;
		font-weight: 400;
	}

	.card-body {
		padding: 1.25rem 1rem;
		display: flex;
		flex-direction: column;
		gap: 1rem;
	}

	.chart-container {
		position: relative;
		padding-left: 2rem;
	}

	.chart {
		display: flex;
		justify-content: space-between;
		align-items: flex-end;
		height: 150px;
		gap: 4px;
		border-bottom: 1px solid #f0abfc;
	}

	.month-column {
		flex: 1;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 4px;
	}

	.bar-container {
		position: relative;
		width: 100%;
		height: 100%;
		display: flex;
		flex-direction: column;
		justify-content: flex-end;
		align-items: center;
	}

	.bar {
		width: 80%;
		max-width: 32px;
		border-radius: 3px 3px 0 0;
		position: absolute;
		bottom: 0;
		transition: height 0.3s ease;
	}

	.bar-theoretical {
		background: #f5d0fe;
		z-index: 1;
	}

	.bar-effective {
		background: #d946ef;
		z-index: 2;
	}

	.bar-high-impact {
		background: #c026d3;
		box-shadow: 0 0 0 2px #fae8ff, 0 0 0 3px #a21caf;
	}

	.shade-indicator {
		position: absolute;
		z-index: 3;
		font-size: 0.5625rem;
		color: #86198f;
		font-weight: 600;
		white-space: nowrap;
		transform: translateY(-100%);
		padding-bottom: 2px;
	}

	.shade-percent {
		background: #fdf4ff;
		padding: 0 2px;
		border-radius: 2px;
	}

	.month-label {
		font-size: 0.625rem;
		color: #64748b;
		margin-top: 4px;
	}

	.hours-label {
		font-size: 0.5625rem;
		color: #a21caf;
		font-weight: 500;
	}

	.y-axis {
		position: absolute;
		left: 0;
		top: 0;
		bottom: 0;
		width: 1.75rem;
		display: flex;
		flex-direction: column;
	}

	.y-label {
		position: absolute;
		right: 0.25rem;
		font-size: 0.625rem;
		color: #64748b;
		transform: translateY(50%);
	}

	.y-label:first-child {
		transform: translateY(0);
	}

	.y-label:last-child {
		transform: translateY(100%);
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

	.theoretical-swatch {
		background: #f5d0fe;
	}

	.effective-swatch {
		background: #d946ef;
	}

	.high-impact-swatch {
		background: #c026d3;
		box-shadow: 0 0 0 1px #fae8ff, 0 0 0 2px #a21caf;
	}

	.legend-text {
		font-size: 0.75rem;
		color: #4b5563;
	}

	.details {
		display: flex;
		flex-direction: column;
		gap: 0.375rem;
		padding-top: 0.75rem;
		border-top: 1px solid #f0abfc;
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

	.detail-value.shade-impact {
		color: #a21caf;
	}

	/* Responsive adjustments */
	@media (max-width: 480px) {
		.card-header {
			flex-direction: column;
			align-items: flex-start;
		}

		.chart-container {
			padding-left: 1.5rem;
		}

		.chart {
			height: 120px;
		}

		.bar {
			max-width: 20px;
		}

		.month-label {
			font-size: 0.5625rem;
		}

		.hours-label {
			display: none;
		}

		.shade-indicator {
			display: none;
		}

		.legend {
			flex-direction: column;
			gap: 0.5rem;
		}

		.y-label {
			font-size: 0.5625rem;
		}
	}
</style>
