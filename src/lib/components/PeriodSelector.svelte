<script lang="ts" module>
	/**
	 * Analysis period presets for heatmap calculation.
	 * Each preset defines a date range that makes sense for gardening analysis.
	 */
	export type PeriodPreset =
		| 'growing-season'
		| 'full-year'
		| 'spring'
		| 'summer'
		| 'fall'
		| 'custom';

	/**
	 * Represents a selected analysis period as start and end day-of-year values.
	 * Using day-of-year (1-366) simplifies calculations and avoids timezone issues.
	 */
	export interface AnalysisPeriod {
		preset: PeriodPreset;
		startDoy: number;
		endDoy: number;
		label: string;
	}

	/**
	 * Month definitions for the monthly breakdown selector.
	 */
	export const MONTHS = [
		{ name: 'January', abbrev: 'Jan', startDoy: 1, endDoy: 31 },
		{ name: 'February', abbrev: 'Feb', startDoy: 32, endDoy: 59 },
		{ name: 'March', abbrev: 'Mar', startDoy: 60, endDoy: 90 },
		{ name: 'April', abbrev: 'Apr', startDoy: 91, endDoy: 120 },
		{ name: 'May', abbrev: 'May', startDoy: 121, endDoy: 151 },
		{ name: 'June', abbrev: 'Jun', startDoy: 152, endDoy: 181 },
		{ name: 'July', abbrev: 'Jul', startDoy: 182, endDoy: 212 },
		{ name: 'August', abbrev: 'Aug', startDoy: 213, endDoy: 243 },
		{ name: 'September', abbrev: 'Sep', startDoy: 244, endDoy: 273 },
		{ name: 'October', abbrev: 'Oct', startDoy: 274, endDoy: 304 },
		{ name: 'November', abbrev: 'Nov', startDoy: 305, endDoy: 334 },
		{ name: 'December', abbrev: 'Dec', startDoy: 335, endDoy: 365 }
	] as const;
</script>

<script lang="ts">
	import type { Coordinates } from '$lib/geo';
	import type { FrostDates } from '$lib/climate';
	import { getFrostDates, dayOfYearToDate } from '$lib/climate';

	/**
	 * Props for the PeriodSelector component.
	 */
	interface PeriodSelectorProps {
		/** Location coordinates for determining growing season */
		location: Coordinates | null;
		/** Currently selected period (bindable) */
		period?: AnalysisPeriod;
		/** Callback when period changes */
		onchange?: (period: AnalysisPeriod) => void;
		/** Whether to show the monthly breakdown tabs */
		showMonthlyBreakdown?: boolean;
		/** Optional elevation in meters for frost date adjustment */
		elevationMeters?: number;
		/** Whether the location is coastal */
		isCoastal?: boolean;
	}

	let {
		location,
		period = $bindable(),
		onchange,
		showMonthlyBreakdown = true,
		elevationMeters,
		isCoastal
	}: PeriodSelectorProps = $props();

	// Internal state
	let selectedPreset = $state<PeriodPreset>('growing-season');
	let customStartDoy = $state(91); // April 1
	let customEndDoy = $state(273); // September 30
	let selectedMonth = $state<number | null>(null);

	// Get frost dates for the current location
	const frostDates = $derived<FrostDates | null>(() => {
		if (!location) return null;
		return getFrostDates(location, { elevationMeters, isCoastal });
	});

	/**
	 * Calculates the preset period bounds based on current location.
	 */
	function getPresetPeriod(preset: PeriodPreset): { startDoy: number; endDoy: number; label: string } {
		switch (preset) {
			case 'growing-season': {
				const frost = frostDates();
				if (frost) {
					const start = frost.lastSpringFrost.median;
					const end = frost.firstFallFrost.median;
					const startDate = dayOfYearToDate(start);
					const endDate = dayOfYearToDate(end);
					const label = `Growing Season (${formatShortDate(startDate)} – ${formatShortDate(endDate)})`;
					return { startDoy: start, endDoy: end, label };
				}
				// Fallback for tropical or unknown locations
				return { startDoy: 91, endDoy: 304, label: 'Growing Season (Apr – Oct)' };
			}
			case 'full-year':
				return { startDoy: 1, endDoy: 365, label: 'Full Year (Jan – Dec)' };
			case 'spring':
				return { startDoy: 60, endDoy: 151, label: 'Spring (Mar – May)' };
			case 'summer':
				return { startDoy: 152, endDoy: 243, label: 'Summer (Jun – Aug)' };
			case 'fall':
				return { startDoy: 244, endDoy: 334, label: 'Fall (Sep – Nov)' };
			case 'custom': {
				const startDate = dayOfYearToDate(customStartDoy);
				const endDate = dayOfYearToDate(customEndDoy);
				return {
					startDoy: customStartDoy,
					endDoy: customEndDoy,
					label: `Custom (${formatShortDate(startDate)} – ${formatShortDate(endDate)})`
				};
			}
		}
	}

	/**
	 * Formats a date as "MMM D" (e.g., "Apr 15").
	 */
	function formatShortDate(date: Date): string {
		return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
	}

	/**
	 * Formats a date as "YYYY-MM-DD" for input[type=date].
	 */
	function formatInputDate(doy: number): string {
		const date = dayOfYearToDate(doy);
		const year = date.getFullYear();
		const month = String(date.getMonth() + 1).padStart(2, '0');
		const day = String(date.getDate()).padStart(2, '0');
		return `${year}-${month}-${day}`;
	}

	/**
	 * Parses an input date string to day-of-year.
	 */
	function parseInputDate(value: string): number {
		const [, month, day] = value.split('-').map(Number);
		const date = new Date(2024, month - 1, day);
		const jan1 = new Date(2024, 0, 1);
		return Math.floor((date.getTime() - jan1.getTime()) / (1000 * 60 * 60 * 24)) + 1;
	}

	// Calculate current period whenever inputs change
	const currentPeriod = $derived<AnalysisPeriod>(() => {
		// If a month is selected, use that month's range
		if (selectedMonth !== null) {
			const month = MONTHS[selectedMonth];
			return {
				preset: 'custom',
				startDoy: month.startDoy,
				endDoy: month.endDoy,
				label: month.name
			};
		}
		const bounds = getPresetPeriod(selectedPreset);
		return {
			preset: selectedPreset,
			...bounds
		};
	});

	// Sync external period prop with internal state
	$effect(() => {
		const newPeriod = currentPeriod();
		period = newPeriod;
		onchange?.(newPeriod);
	});

	// Handle preset selection
	function handlePresetChange(event: Event): void {
		const target = event.target as HTMLSelectElement;
		selectedPreset = target.value as PeriodPreset;
		selectedMonth = null; // Clear month selection when preset changes
	}

	// Handle custom date inputs
	function handleStartDateChange(event: Event): void {
		const target = event.target as HTMLInputElement;
		customStartDoy = parseInputDate(target.value);
		selectedPreset = 'custom';
		selectedMonth = null;
	}

	function handleEndDateChange(event: Event): void {
		const target = event.target as HTMLInputElement;
		customEndDoy = parseInputDate(target.value);
		selectedPreset = 'custom';
		selectedMonth = null;
	}

	// Handle month selection
	function handleMonthClick(monthIndex: number): void {
		if (selectedMonth === monthIndex) {
			// Clicking again deselects and returns to preset
			selectedMonth = null;
		} else {
			selectedMonth = monthIndex;
		}
	}

	// Preset options for the dropdown
	const presetOptions = [
		{ value: 'growing-season', label: 'Growing Season' },
		{ value: 'full-year', label: 'Full Year' },
		{ value: 'spring', label: 'Spring' },
		{ value: 'summer', label: 'Summer' },
		{ value: 'fall', label: 'Fall' },
		{ value: 'custom', label: 'Custom Range' }
	] as const;

	// Calculate growing season info for display
	const growingSeasonInfo = $derived(() => {
		const frost = frostDates();
		if (!frost) return null;
		const length = frost.firstFallFrost.median - frost.lastSpringFrost.median;
		return {
			length,
			confidence: frost.confidence
		};
	});
</script>

<div class="period-selector">
	<div class="selector-row">
		<label class="selector-label" for="period-preset">
			Analysis Period
		</label>
		<select
			id="period-preset"
			class="preset-select"
			value={selectedPreset}
			onchange={handlePresetChange}
		>
			{#each presetOptions as opt}
				<option value={opt.value}>{opt.label}</option>
			{/each}
		</select>
	</div>

	{#if selectedPreset === 'custom'}
		<div class="custom-dates">
			<div class="date-field">
				<label for="start-date">Start</label>
				<input
					type="date"
					id="start-date"
					value={formatInputDate(customStartDoy)}
					onchange={handleStartDateChange}
				/>
			</div>
			<span class="date-separator">to</span>
			<div class="date-field">
				<label for="end-date">End</label>
				<input
					type="date"
					id="end-date"
					value={formatInputDate(customEndDoy)}
					onchange={handleEndDateChange}
				/>
			</div>
		</div>
	{/if}

	<div class="period-display">
		<span class="period-label">{currentPeriod().label}</span>
		{#if selectedPreset === 'growing-season' && growingSeasonInfo()}
			<span class="period-info">
				{growingSeasonInfo()?.length} days
				{#if growingSeasonInfo()?.confidence === 'low'}
					<span class="confidence-badge low" title="Approximate estimate">~</span>
				{/if}
			</span>
		{/if}
	</div>

	{#if showMonthlyBreakdown}
		<div class="monthly-breakdown">
			<div class="monthly-header">
				<span class="monthly-title">Monthly View</span>
				{#if selectedMonth !== null}
					<button
						type="button"
						class="clear-month-btn"
						onclick={() => selectedMonth = null}
					>
						Clear
					</button>
				{/if}
			</div>
			<div class="month-tabs">
				{#each MONTHS as month, i}
					<button
						type="button"
						class="month-tab"
						class:selected={selectedMonth === i}
						onclick={() => handleMonthClick(i)}
						title={month.name}
					>
						{month.abbrev}
					</button>
				{/each}
			</div>
		</div>
	{/if}
</div>

<style>
	.period-selector {
		display: flex;
		flex-direction: column;
		gap: 0.625rem;
		padding: 0.75rem;
		background: #fafaf9;
		border: 1px solid #e7e5e4;
		border-radius: 8px;
		font-family: system-ui, -apple-system, sans-serif;
	}

	.selector-row {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.75rem;
	}

	.selector-label {
		font-size: 0.875rem;
		font-weight: 500;
		color: #44403c;
	}

	.preset-select {
		flex: 1;
		max-width: 200px;
		padding: 0.375rem 0.625rem;
		font-size: 0.875rem;
		border: 1px solid #d6d3d1;
		border-radius: 6px;
		background: white;
		color: #1c1917;
		cursor: pointer;
	}

	.preset-select:hover {
		border-color: #a8a29e;
	}

	.preset-select:focus {
		outline: none;
		border-color: #78716c;
		box-shadow: 0 0 0 2px rgba(120, 113, 108, 0.2);
	}

	.custom-dates {
		display: flex;
		align-items: flex-end;
		gap: 0.5rem;
		padding: 0.625rem;
		background: white;
		border: 1px solid #e7e5e4;
		border-radius: 6px;
	}

	.date-field {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
	}

	.date-field label {
		font-size: 0.75rem;
		color: #78716c;
	}

	.date-field input[type='date'] {
		padding: 0.375rem 0.5rem;
		font-size: 0.875rem;
		border: 1px solid #d6d3d1;
		border-radius: 4px;
		background: #fafaf9;
		color: #1c1917;
	}

	.date-field input[type='date']:focus {
		outline: none;
		border-color: #78716c;
	}

	.date-separator {
		padding-bottom: 0.375rem;
		font-size: 0.875rem;
		color: #78716c;
	}

	.period-display {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 0.5rem 0.625rem;
		background: #f5f5f4;
		border-radius: 6px;
	}

	.period-label {
		font-size: 0.875rem;
		font-weight: 500;
		color: #1c1917;
	}

	.period-info {
		font-size: 0.8125rem;
		color: #57534e;
	}

	.confidence-badge {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 1rem;
		height: 1rem;
		margin-left: 0.25rem;
		font-size: 0.75rem;
		font-weight: 600;
		border-radius: 50%;
		cursor: help;
	}

	.confidence-badge.low {
		background: #fef3c7;
		color: #d97706;
	}

	.monthly-breakdown {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		padding-top: 0.5rem;
		border-top: 1px solid #e7e5e4;
	}

	.monthly-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
	}

	.monthly-title {
		font-size: 0.8125rem;
		font-weight: 500;
		color: #57534e;
	}

	.clear-month-btn {
		padding: 0.125rem 0.5rem;
		font-size: 0.75rem;
		color: #57534e;
		background: transparent;
		border: 1px solid #d6d3d1;
		border-radius: 4px;
		cursor: pointer;
	}

	.clear-month-btn:hover {
		background: #f5f5f4;
		border-color: #a8a29e;
	}

	.month-tabs {
		display: flex;
		flex-wrap: wrap;
		gap: 0.25rem;
	}

	.month-tab {
		flex: 1;
		min-width: 2.5rem;
		padding: 0.375rem 0.25rem;
		font-size: 0.75rem;
		font-weight: 500;
		color: #57534e;
		background: white;
		border: 1px solid #e7e5e4;
		border-radius: 4px;
		cursor: pointer;
		transition: all 0.15s ease;
	}

	.month-tab:hover {
		background: #f5f5f4;
		border-color: #a8a29e;
		color: #1c1917;
	}

	.month-tab.selected {
		background: #78716c;
		border-color: #57534e;
		color: white;
	}

	/* Mobile adjustments - ensure 44pt touch targets */
	@media (max-width: 480px) {
		.selector-row {
			flex-direction: column;
			align-items: stretch;
		}

		.preset-select {
			max-width: none;
			/* 44px minimum touch target */
			min-height: 44px;
			padding: 0.625rem 0.75rem;
			font-size: 1rem;
		}

		.custom-dates {
			flex-direction: column;
			align-items: stretch;
		}

		.date-field input[type='date'] {
			min-height: 44px;
			padding: 0.625rem;
			font-size: 1rem;
		}

		.date-separator {
			text-align: center;
			padding: 0.25rem 0;
		}

		.monthly-header {
			padding: 0.25rem 0;
		}

		.clear-month-btn {
			min-height: 36px;
			padding: 0.375rem 0.75rem;
			font-size: 0.8125rem;
		}

		.month-tabs {
			gap: 0.25rem;
		}

		.month-tab {
			/* 44px minimum for touch targets - use 6 per row */
			min-height: 40px;
			min-width: calc((100% - 1.25rem) / 6);
			padding: 0.5rem 0.25rem;
			font-size: 0.8125rem;
		}
	}

	/* Tablet (iPad) optimizations */
	@media (min-width: 481px) and (max-width: 1024px) and (hover: none) {
		.preset-select {
			min-height: 48px;
			padding: 0.75rem 1rem;
			font-size: 1rem;
		}

		.date-field input[type='date'] {
			min-height: 48px;
			padding: 0.75rem;
			font-size: 1rem;
		}

		.clear-month-btn {
			min-height: 40px;
			padding: 0.5rem 1rem;
			font-size: 0.875rem;
		}

		.month-tab {
			min-height: 44px;
			padding: 0.625rem 0.5rem;
			font-size: 0.875rem;
		}

		.period-label {
			font-size: 0.9375rem;
		}

		.period-info {
			font-size: 0.875rem;
		}
	}

	/* High contrast for outdoor visibility */
	@media (prefers-contrast: more) {
		.period-selector {
			border-width: 2px;
			border-color: #78716c;
			background: #fafaf9;
		}

		.selector-label {
			color: #000;
			font-weight: 700;
		}

		.preset-select {
			border-width: 2px;
			border-color: #57534e;
			font-weight: 600;
		}

		.preset-select:focus {
			border-color: #1c1917;
			box-shadow: 0 0 0 3px rgba(28, 25, 23, 0.25);
		}

		.date-field label {
			color: #44403c;
			font-weight: 600;
		}

		.date-field input[type='date'] {
			border-width: 2px;
			font-weight: 500;
		}

		.period-display {
			background: #e7e5e4;
		}

		.period-label {
			color: #000;
			font-weight: 700;
		}

		.period-info {
			color: #1c1917;
			font-weight: 600;
		}

		.monthly-breakdown {
			border-top-width: 2px;
		}

		.monthly-title {
			color: #1c1917;
			font-weight: 700;
		}

		.month-tab {
			border-width: 2px;
			font-weight: 600;
		}

		.month-tab.selected {
			background: #44403c;
			border-color: #1c1917;
			font-weight: 700;
		}
	}
</style>
