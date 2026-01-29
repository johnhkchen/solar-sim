<script lang="ts">
	/**
	 * Monthly temperature averages for display. Temperatures are in Celsius internally
	 * and converted to Fahrenheit when that unit is selected.
	 */
	import type { MonthlyAverages } from '$lib/climate/openmeteo.js';

	interface TemperatureChartProps {
		monthly: MonthlyAverages;
		units?: 'fahrenheit' | 'celsius';
	}

	let { monthly, units = 'fahrenheit' }: TemperatureChartProps = $props();

	const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

	/**
	 * Converts Celsius to Fahrenheit when needed.
	 */
	function toDisplayUnit(celsius: number): number {
		if (units === 'fahrenheit') {
			return celsius * 9 / 5 + 32;
		}
		return celsius;
	}

	/**
	 * Formats temperature for display with one decimal place.
	 */
	function formatTemp(celsius: number): string {
		const value = toDisplayUnit(celsius);
		return value.toFixed(0);
	}

	/**
	 * Returns the temperature unit symbol.
	 */
	const unitSymbol = $derived(units === 'fahrenheit' ? '°F' : '°C');

	/**
	 * Converts all temperature arrays to display units for chart rendering.
	 */
	const displayHighs = $derived(monthly.avgHighs.map(toDisplayUnit));
	const displayLows = $derived(monthly.avgLows.map(toDisplayUnit));

	/**
	 * Chart dimensions and layout constants.
	 */
	const chartWidth = 320;
	const chartHeight = 180;
	const padding = { top: 20, right: 20, bottom: 30, left: 40 };
	const plotWidth = chartWidth - padding.left - padding.right;
	const plotHeight = chartHeight - padding.top - padding.bottom;

	/**
	 * Calculates the Y-axis range based on temperature data, adding some padding
	 * so lines don't touch the edges.
	 */
	const yMin = $derived(Math.floor(Math.min(...displayLows) / 10) * 10 - 5);
	const yMax = $derived(Math.ceil(Math.max(...displayHighs) / 10) * 10 + 5);
	const yRange = $derived(yMax - yMin);

	/**
	 * Converts a temperature value to Y coordinate in SVG space.
	 */
	function tempToY(temp: number): number {
		return padding.top + plotHeight - ((temp - yMin) / yRange) * plotHeight;
	}

	/**
	 * Converts a month index (0-11) to X coordinate in SVG space.
	 */
	function monthToX(monthIndex: number): number {
		return padding.left + (monthIndex / 11) * plotWidth;
	}

	/**
	 * Generates the SVG path for the high temperature line.
	 */
	const highLinePath = $derived(
		displayHighs.map((temp, i) => `${i === 0 ? 'M' : 'L'} ${monthToX(i)} ${tempToY(temp)}`).join(' ')
	);

	/**
	 * Generates the SVG path for the low temperature line.
	 */
	const lowLinePath = $derived(
		displayLows.map((temp, i) => `${i === 0 ? 'M' : 'L'} ${monthToX(i)} ${tempToY(temp)}`).join(' ')
	);

	/**
	 * Generates the SVG path for the filled area between high and low lines.
	 * This creates a closed polygon starting with the highs left-to-right,
	 * then the lows right-to-left.
	 */
	const areaPath = $derived(() => {
		const highPoints = displayHighs.map((temp, i) => `${monthToX(i)},${tempToY(temp)}`);
		const lowPoints = displayLows.map((temp, i) => `${monthToX(i)},${tempToY(temp)}`).reverse();
		return `M ${highPoints.join(' L ')} L ${lowPoints.join(' L ')} Z`;
	});

	/**
	 * Generates Y-axis tick positions at nice intervals.
	 */
	const yTicks = $derived(() => {
		const ticks: number[] = [];
		const step = yRange <= 40 ? 10 : yRange <= 80 ? 20 : 30;
		for (let t = Math.ceil(yMin / step) * step; t <= yMax; t += step) {
			ticks.push(t);
		}
		return ticks;
	});

	/**
	 * Calculates summary statistics for display below the chart.
	 */
	const warmestMonth = $derived(() => {
		let maxIdx = 0;
		for (let i = 1; i < 12; i++) {
			if (monthly.avgHighs[i] > monthly.avgHighs[maxIdx]) maxIdx = i;
		}
		return { month: monthNames[maxIdx], temp: monthly.avgHighs[maxIdx] };
	});

	const coldestMonth = $derived(() => {
		let minIdx = 0;
		for (let i = 1; i < 12; i++) {
			if (monthly.avgLows[i] < monthly.avgLows[minIdx]) minIdx = i;
		}
		return { month: monthNames[minIdx], temp: monthly.avgLows[minIdx] };
	});

	const annualRange = $derived(() => {
		const avgHigh = monthly.avgHighs.reduce((a, b) => a + b, 0) / 12;
		const avgLow = monthly.avgLows.reduce((a, b) => a + b, 0) / 12;
		return { high: avgHigh, low: avgLow };
	});
</script>

<article class="temperature-chart" role="figure" aria-label="Monthly temperature chart showing average high and low temperatures throughout the year">
	<header class="card-header">
		<h3>Temperature Patterns</h3>
		<span class="summary">
			{formatTemp(annualRange().low)}–{formatTemp(annualRange().high)}{unitSymbol} average
		</span>
	</header>

	<div class="card-body">
		<svg
			viewBox="0 0 {chartWidth} {chartHeight}"
			class="chart-svg"
			aria-hidden="true"
		>
			<!-- Grid lines -->
			{#each yTicks() as tick}
				<line
					x1={padding.left}
					y1={tempToY(tick)}
					x2={chartWidth - padding.right}
					y2={tempToY(tick)}
					class="grid-line"
				/>
				<text
					x={padding.left - 4}
					y={tempToY(tick)}
					class="y-tick-label"
					text-anchor="end"
					dominant-baseline="middle"
				>
					{tick}°
				</text>
			{/each}

			<!-- Area fill between high and low -->
			<path d={areaPath()} class="temp-area" />

			<!-- High temperature line -->
			<path d={highLinePath} class="temp-line temp-high" fill="none" />

			<!-- Low temperature line -->
			<path d={lowLinePath} class="temp-line temp-low" fill="none" />

			<!-- Data points for highs -->
			{#each displayHighs as temp, i}
				<circle
					cx={monthToX(i)}
					cy={tempToY(temp)}
					r="3"
					class="data-point point-high"
				>
					<title>{monthNames[i]}: High {temp.toFixed(0)}{unitSymbol}</title>
				</circle>
			{/each}

			<!-- Data points for lows -->
			{#each displayLows as temp, i}
				<circle
					cx={monthToX(i)}
					cy={tempToY(temp)}
					r="3"
					class="data-point point-low"
				>
					<title>{monthNames[i]}: Low {temp.toFixed(0)}{unitSymbol}</title>
				</circle>
			{/each}

			<!-- Month labels on X-axis -->
			{#each monthNames as name, i}
				<text
					x={monthToX(i)}
					y={chartHeight - 8}
					class="x-tick-label"
					text-anchor="middle"
				>
					{name}
				</text>
			{/each}
		</svg>

		<div class="legend">
			<div class="legend-item">
				<span class="legend-swatch high-swatch"></span>
				<span class="legend-text">Average high</span>
			</div>
			<div class="legend-item">
				<span class="legend-swatch low-swatch"></span>
				<span class="legend-text">Average low</span>
			</div>
			<div class="legend-item">
				<span class="legend-swatch range-swatch"></span>
				<span class="legend-text">Daily range</span>
			</div>
		</div>

		<div class="details">
			<div class="detail-row">
				<span class="detail-label">Warmest month</span>
				<span class="detail-value warm">
					{warmestMonth().month} ({formatTemp(warmestMonth().temp)}{unitSymbol})
				</span>
			</div>
			<div class="detail-row">
				<span class="detail-label">Coldest month</span>
				<span class="detail-value cold">
					{coldestMonth().month} ({formatTemp(coldestMonth().temp)}{unitSymbol})
				</span>
			</div>
		</div>
	</div>

	<!-- Screen reader description -->
	<div class="sr-only">
		Monthly temperature averages:
		{#each monthNames as name, i}
			{name} high {formatTemp(monthly.avgHighs[i])}, low {formatTemp(monthly.avgLows[i])}{unitSymbol}.
		{/each}
	</div>
</article>

<style>
	.temperature-chart {
		font-family: system-ui, -apple-system, sans-serif;
		background: #fef3c7;
		border: 1px solid #f59e0b;
		border-radius: 8px;
		overflow: hidden;
	}

	.card-header {
		background: #fef9c3;
		padding: 0.75rem 1rem;
		border-bottom: 1px solid #f59e0b;
		display: flex;
		justify-content: space-between;
		align-items: center;
		flex-wrap: wrap;
		gap: 0.5rem;
	}

	.card-header h3 {
		margin: 0;
		font-size: 0.9375rem;
		color: #b45309;
		font-weight: 600;
	}

	.summary {
		font-size: 0.8125rem;
		color: #d97706;
		font-weight: 500;
	}

	.card-body {
		padding: 1rem;
		display: flex;
		flex-direction: column;
		gap: 1rem;
	}

	.chart-svg {
		width: 100%;
		height: auto;
		max-height: 200px;
	}

	.grid-line {
		stroke: #fde68a;
		stroke-width: 1;
	}

	.y-tick-label {
		font-size: 10px;
		fill: #78716c;
	}

	.x-tick-label {
		font-size: 9px;
		fill: #78716c;
	}

	.temp-area {
		fill: #fef3c7;
		opacity: 0.7;
	}

	.temp-line {
		stroke-width: 2;
		stroke-linecap: round;
		stroke-linejoin: round;
	}

	.temp-high {
		stroke: #ef4444;
	}

	.temp-low {
		stroke: #3b82f6;
	}

	.data-point {
		stroke: white;
		stroke-width: 1.5;
	}

	.point-high {
		fill: #ef4444;
	}

	.point-low {
		fill: #3b82f6;
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
		height: 0.5rem;
		border-radius: 2px;
	}

	.high-swatch {
		background: #ef4444;
	}

	.low-swatch {
		background: #3b82f6;
	}

	.range-swatch {
		background: #fef3c7;
		border: 1px solid #fde68a;
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
		border-top: 1px solid #fde68a;
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
		font-weight: 500;
	}

	.detail-value.warm {
		color: #dc2626;
	}

	.detail-value.cold {
		color: #2563eb;
	}

	.sr-only {
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
		.card-header {
			flex-direction: column;
			align-items: flex-start;
		}

		.chart-svg {
			max-height: 160px;
		}

		.x-tick-label {
			font-size: 7px;
		}

		.legend {
			flex-direction: column;
			gap: 0.5rem;
		}

		.data-point {
			r: 2;
		}
	}
</style>
