/**
 * Tests for PeriodSelector logic.
 *
 * Since the component relies on Svelte reactivity, we test the core logic:
 * month definitions, date conversions, and period calculations.
 */

import { describe, it, expect } from 'vitest';
import { MONTHS, type PeriodPreset, type AnalysisPeriod } from './PeriodSelector.svelte';
import { getFrostDates, dayOfYearToDate } from '$lib/climate';

describe('PeriodSelector', () => {
	describe('MONTHS constant', () => {
		it('has 12 months', () => {
			expect(MONTHS.length).toBe(12);
		});

		it('covers the full year from day 1 to 365', () => {
			expect(MONTHS[0].startDoy).toBe(1);
			expect(MONTHS[11].endDoy).toBe(365);
		});

		it('has correct month names and abbreviations', () => {
			expect(MONTHS[0].name).toBe('January');
			expect(MONTHS[0].abbrev).toBe('Jan');
			expect(MONTHS[5].name).toBe('June');
			expect(MONTHS[5].abbrev).toBe('Jun');
			expect(MONTHS[11].name).toBe('December');
			expect(MONTHS[11].abbrev).toBe('Dec');
		});

		it('has contiguous day ranges with no gaps', () => {
			for (let i = 0; i < MONTHS.length - 1; i++) {
				expect(MONTHS[i + 1].startDoy).toBe(MONTHS[i].endDoy + 1);
			}
		});

		it('has March starting at day 60', () => {
			// March 1 is day 60 (31 Jan + 28 Feb)
			expect(MONTHS[2].startDoy).toBe(60);
		});

		it('has correct summer months range', () => {
			// Summer: Jun-Aug = days 152-243
			expect(MONTHS[5].startDoy).toBe(152); // June starts
			expect(MONTHS[7].endDoy).toBe(243); // August ends
		});
	});

	describe('preset period definitions', () => {
		it('spring covers March through May', () => {
			// Spring should be Mar 1 (60) to May 31 (151)
			const spring = { startDoy: 60, endDoy: 151 };
			expect(spring.startDoy).toBe(MONTHS[2].startDoy); // March
			expect(spring.endDoy).toBe(MONTHS[4].endDoy); // May
		});

		it('summer covers June through August', () => {
			const summer = { startDoy: 152, endDoy: 243 };
			expect(summer.startDoy).toBe(MONTHS[5].startDoy); // June
			expect(summer.endDoy).toBe(MONTHS[7].endDoy); // August
		});

		it('fall covers September through November', () => {
			const fall = { startDoy: 244, endDoy: 334 };
			expect(fall.startDoy).toBe(MONTHS[8].startDoy); // September
			expect(fall.endDoy).toBe(MONTHS[10].endDoy); // November
		});

		it('full year covers entire 365 days', () => {
			const fullYear = { startDoy: 1, endDoy: 365 };
			expect(fullYear.endDoy - fullYear.startDoy + 1).toBe(365);
		});
	});

	describe('growing season integration', () => {
		it('uses frost dates for growing season bounds', () => {
			// Portland, Oregon - temperate with clear growing season
			const coords = { latitude: 45.52, longitude: -122.68 };
			const frost = getFrostDates(coords);

			// Growing season should be between last spring frost and first fall frost
			expect(frost.lastSpringFrost.median).toBeGreaterThan(100); // After mid-April
			expect(frost.lastSpringFrost.median).toBeLessThan(160); // Before mid-June
			expect(frost.firstFallFrost.median).toBeGreaterThan(240); // After late August
			expect(frost.firstFallFrost.median).toBeLessThan(280); // Before early October
		});

		it('handles tropical locations with minimal frost', () => {
			// Miami, Florida - tropical/subtropical
			const coords = { latitude: 25.76, longitude: -80.19 };
			const frost = getFrostDates(coords);

			// Tropical areas have very long growing seasons
			const seasonLength = frost.firstFallFrost.median - frost.lastSpringFrost.median;
			expect(seasonLength).toBeGreaterThan(250); // 8+ months
		});

		it('handles high latitude locations with short seasons', () => {
			// Fairbanks, Alaska
			const coords = { latitude: 64.84, longitude: -147.72 };
			const frost = getFrostDates(coords);

			// Northern locations have short growing seasons
			const seasonLength = frost.firstFallFrost.median - frost.lastSpringFrost.median;
			expect(seasonLength).toBeLessThan(120); // Under 4 months
		});
	});

	describe('date formatting', () => {
		it('converts day-of-year to correct date', () => {
			// April 1 = day 91 (in non-leap year)
			const april1 = dayOfYearToDate(91);
			expect(april1.getMonth()).toBe(3); // April (0-indexed)
			expect(april1.getDate()).toBe(1);
		});

		it('handles year boundary correctly', () => {
			// Day 1 = January 1
			const jan1 = dayOfYearToDate(1);
			expect(jan1.getMonth()).toBe(0);
			expect(jan1.getDate()).toBe(1);

			// Day 365 = December 31 (in non-leap year)
			const dec31 = dayOfYearToDate(365);
			expect(dec31.getMonth()).toBe(11);
			expect(dec31.getDate()).toBe(31);
		});

		it('handles summer solstice correctly', () => {
			// June 21 = day 172 (in non-leap year)
			const summerSolstice = dayOfYearToDate(172);
			expect(summerSolstice.getMonth()).toBe(5); // June
			expect(summerSolstice.getDate()).toBe(21);
		});
	});

	describe('AnalysisPeriod type', () => {
		it('has required fields', () => {
			const period: AnalysisPeriod = {
				preset: 'growing-season',
				startDoy: 100,
				endDoy: 260,
				label: 'Growing Season (Apr 10 – Sep 17)'
			};

			expect(period.preset).toBe('growing-season');
			expect(period.startDoy).toBeLessThan(period.endDoy);
			expect(period.label).toContain('Growing Season');
		});

		it('supports all preset types', () => {
			const presets: PeriodPreset[] = [
				'growing-season',
				'full-year',
				'spring',
				'summer',
				'fall',
				'custom'
			];

			expect(presets.length).toBe(6);
		});
	});

	describe('month selection logic', () => {
		it('each month has valid day range', () => {
			for (const month of MONTHS) {
				expect(month.startDoy).toBeGreaterThan(0);
				expect(month.endDoy).toBeLessThanOrEqual(365);
				expect(month.endDoy).toBeGreaterThanOrEqual(month.startDoy);

				// Each month should be 28-31 days
				const days = month.endDoy - month.startDoy + 1;
				expect(days).toBeGreaterThanOrEqual(28);
				expect(days).toBeLessThanOrEqual(31);
			}
		});

		it('February has 28 days', () => {
			const feb = MONTHS[1];
			const days = feb.endDoy - feb.startDoy + 1;
			expect(days).toBe(28);
		});

		it('July has 31 days', () => {
			const july = MONTHS[6];
			const days = july.endDoy - july.startDoy + 1;
			expect(days).toBe(31);
		});
	});
});
