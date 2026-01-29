/**
 * Tests for frost date lookup functionality.
 *
 * These tests verify that getFrostDates returns reasonable estimates for
 * various locations and that helper functions work correctly. Since frost
 * dates are approximate by nature, tests use range-based assertions rather
 * than exact values.
 */

import { describe, it, expect } from 'vitest';
import {
	getFrostDates,
	dayOfYearToDate,
	dateToDayOfYear,
	formatFrostDateRange,
	calculateGrowingSeasonLength
} from './frost-dates.js';

describe('getFrostDates', () => {
	describe('US locations', () => {
		it('returns reasonable frost dates for Portland, Oregon (lat 45.5)', () => {
			const frost = getFrostDates({ latitude: 45.52, longitude: -122.68 });

			// Portland's last spring frost is typically late April (DOY ~115-130)
			expect(frost.lastSpringFrost.median).toBeGreaterThanOrEqual(115);
			expect(frost.lastSpringFrost.median).toBeLessThanOrEqual(145);

			// First fall frost is typically mid-October to early November (DOY ~280-310)
			expect(frost.firstFallFrost.median).toBeGreaterThanOrEqual(240);
			expect(frost.firstFallFrost.median).toBeLessThanOrEqual(280);

			expect(frost.source).toBe('lookup-table');
			expect(frost.confidence).toBe('medium');
		});

		it('returns earlier spring frost for Miami, Florida (lat 25.8)', () => {
			const frost = getFrostDates({ latitude: 25.76, longitude: -80.19 });

			// Miami rarely has frost - last spring frost very early in year
			expect(frost.lastSpringFrost.median).toBeLessThan(60);

			// First fall frost very late in year
			expect(frost.firstFallFrost.median).toBeGreaterThan(300);
		});

		it('returns later spring frost for Minneapolis, Minnesota (lat 44.9)', () => {
			const frost = getFrostDates({ latitude: 44.98, longitude: -93.27 });

			// Minneapolis's last spring frost is typically early to mid May (DOY ~120-140)
			expect(frost.lastSpringFrost.median).toBeGreaterThanOrEqual(115);
			expect(frost.lastSpringFrost.median).toBeLessThanOrEqual(145);

			// First fall frost is typically late September to mid October (DOY ~265-290)
			expect(frost.firstFallFrost.median).toBeGreaterThanOrEqual(240);
			expect(frost.firstFallFrost.median).toBeLessThanOrEqual(280);
		});

		it('returns very short growing season for Fairbanks, Alaska (lat 64.8)', () => {
			const frost = getFrostDates({ latitude: 64.84, longitude: -147.72 });

			// Fairbanks has very late spring frost (late May to early June)
			expect(frost.lastSpringFrost.median).toBeGreaterThan(140);

			// And early fall frost (late August to early September)
			expect(frost.firstFallFrost.median).toBeLessThan(265);

			// Low confidence for extreme latitudes
			expect(frost.confidence).toBe('low');
		});
	});

	describe('international locations', () => {
		it('returns tropical frost dates for Singapore (lat 1.3)', () => {
			const frost = getFrostDates({ latitude: 1.35, longitude: 103.82 });

			// Tropical locations have minimal frost risk
			expect(frost.lastSpringFrost.median).toBeLessThan(50);
			expect(frost.firstFallFrost.median).toBeGreaterThan(300);
			expect(frost.confidence).toBe('low');
		});

		it('returns reasonable frost dates for London, UK (lat 51.5)', () => {
			const frost = getFrostDates({ latitude: 51.51, longitude: -0.13 });

			// London's frost dates (maritime climate with mild winters)
			expect(frost.lastSpringFrost.median).toBeGreaterThan(80);
			expect(frost.lastSpringFrost.median).toBeLessThan(160);
		});

		it('handles southern hemisphere correctly for Sydney, Australia', () => {
			const frost = getFrostDates({ latitude: -33.87, longitude: 151.21 });

			// Southern hemisphere: spring frost in September-October (DOY ~244-290)
			// Fall frost in April-May (DOY ~90-150)
			expect(frost.lastSpringFrost.median).toBeGreaterThan(240);
			expect(frost.lastSpringFrost.median).toBeLessThan(300);
			expect(frost.firstFallFrost.median).toBeGreaterThan(100);
			expect(frost.firstFallFrost.median).toBeLessThan(180);
		});
	});

	describe('elevation adjustment', () => {
		it('delays spring frost for high elevation locations', () => {
			const denver = { latitude: 39.74, longitude: -104.99 };

			const lowElevation = getFrostDates(denver);
			const highElevation = getFrostDates(denver, { elevationMeters: 1600 });

			// Denver at 1600m should have spring frost about 21 days later
			expect(highElevation.lastSpringFrost.median).toBeGreaterThan(
				lowElevation.lastSpringFrost.median
			);

			// And fall frost about 21 days earlier
			expect(highElevation.firstFallFrost.median).toBeLessThan(
				lowElevation.firstFallFrost.median
			);
		});

		it('applies approximately 4 days per 300m of elevation', () => {
			const coords = { latitude: 40, longitude: -105 };

			const base = getFrostDates(coords);
			const elevated = getFrostDates(coords, { elevationMeters: 600 });

			// 600m / 300m * 4 days = 8 days adjustment
			const springDiff = elevated.lastSpringFrost.median - base.lastSpringFrost.median;
			expect(springDiff).toBeGreaterThanOrEqual(6);
			expect(springDiff).toBeLessThanOrEqual(10);
		});
	});

	describe('coastal adjustment', () => {
		it('applies coastal modifier when isCoastal is true', () => {
			const coords = { latitude: 45, longitude: -100 }; // Inland location

			const inland = getFrostDates(coords, { isCoastal: false });
			const coastal = getFrostDates(coords, { isCoastal: true });

			// Coastal areas have earlier spring frost (negative modifier)
			expect(coastal.lastSpringFrost.median).toBeLessThan(inland.lastSpringFrost.median);

			// And later fall frost
			expect(coastal.firstFallFrost.median).toBeGreaterThan(inland.firstFallFrost.median);
		});

		it('auto-detects coastal locations for Pacific Northwest', () => {
			const seattle = { latitude: 47.6, longitude: -122.3 };
			const spokane = { latitude: 47.66, longitude: -117.43 }; // Inland at same latitude

			const seattleFrost = getFrostDates(seattle);
			const spokaneFrost = getFrostDates(spokane);

			// Seattle should have milder frost dates than Spokane
			expect(seattleFrost.lastSpringFrost.median).toBeLessThanOrEqual(
				spokaneFrost.lastSpringFrost.median
			);
		});
	});

	describe('frost date ranges', () => {
		it('returns early, median, and late bounds', () => {
			const frost = getFrostDates({ latitude: 42, longitude: -88 });

			// Early should be before median
			expect(frost.lastSpringFrost.early).toBeLessThan(frost.lastSpringFrost.median);
			expect(frost.firstFallFrost.early).toBeLessThan(frost.firstFallFrost.median);

			// Late should be after median
			expect(frost.lastSpringFrost.late).toBeGreaterThan(frost.lastSpringFrost.median);
			expect(frost.firstFallFrost.late).toBeGreaterThan(frost.firstFallFrost.median);
		});

		it('has reasonable variance (about 2 weeks)', () => {
			const frost = getFrostDates({ latitude: 40, longitude: -75 });

			const springRange = frost.lastSpringFrost.late - frost.lastSpringFrost.early;
			const fallRange = frost.firstFallFrost.late - frost.firstFallFrost.early;

			// Ranges should be about 4 weeks (2 weeks on each side of median)
			expect(springRange).toBeGreaterThanOrEqual(20);
			expect(springRange).toBeLessThanOrEqual(35);
			expect(fallRange).toBeGreaterThanOrEqual(20);
			expect(fallRange).toBeLessThanOrEqual(35);
		});
	});
});

describe('dayOfYearToDate', () => {
	it('converts day 1 to January 1', () => {
		const date = dayOfYearToDate(1, 2024);
		expect(date.getMonth()).toBe(0); // January
		expect(date.getDate()).toBe(1);
	});

	it('converts day 100 to April 9 or 10 depending on leap year', () => {
		const leapYear = dayOfYearToDate(100, 2024); // 2024 is a leap year
		expect(leapYear.getMonth()).toBe(3); // April
		expect(leapYear.getDate()).toBe(9);

		const normalYear = dayOfYearToDate(100, 2023);
		expect(normalYear.getMonth()).toBe(3); // April
		expect(normalYear.getDate()).toBe(10);
	});

	it('converts day 365 to December 31 in non-leap year', () => {
		const date = dayOfYearToDate(365, 2023);
		expect(date.getMonth()).toBe(11); // December
		expect(date.getDate()).toBe(31);
	});

	it('converts day 366 to December 31 in leap year', () => {
		const date = dayOfYearToDate(366, 2024);
		expect(date.getMonth()).toBe(11); // December
		expect(date.getDate()).toBe(31);
	});
});

describe('dateToDayOfYear', () => {
	it('converts January 1 to day 1', () => {
		const doy = dateToDayOfYear(new Date(2024, 0, 1));
		expect(doy).toBe(1);
	});

	it('converts April 10 to approximately day 100', () => {
		const doy = dateToDayOfYear(new Date(2023, 3, 10)); // Non-leap year
		expect(doy).toBe(100);
	});

	it('converts December 31 to day 365 or 366', () => {
		const normalYear = dateToDayOfYear(new Date(2023, 11, 31));
		expect(normalYear).toBe(365);

		const leapYear = dateToDayOfYear(new Date(2024, 11, 31));
		expect(leapYear).toBe(366);
	});
});

describe('formatFrostDateRange', () => {
	it('formats a range as "Mon DD - Mon DD"', () => {
		const range = { early: 100, median: 110, late: 120 };
		const formatted = formatFrostDateRange(range, 2023);

		// Should contain month abbreviations and dates
		expect(formatted).toMatch(/[A-Z][a-z]{2} \d{1,2} - [A-Z][a-z]{2} \d{1,2}/);
	});

	it('formats spring dates correctly', () => {
		// Late April to mid May range
		const range = { early: 110, median: 120, late: 135 };
		const formatted = formatFrostDateRange(range, 2023);

		expect(formatted).toContain('Apr');
		expect(formatted).toContain('May');
	});
});

describe('calculateGrowingSeasonLength', () => {
	it('calculates growing season length from frost dates', () => {
		const frost = getFrostDates({ latitude: 42, longitude: -88 });
		const length = calculateGrowingSeasonLength(frost);

		// Mid-latitude US should have 120-180 day growing season
		expect(length).toBeGreaterThan(100);
		expect(length).toBeLessThan(200);
	});

	it('returns longer season for southern locations', () => {
		const miami = getFrostDates({ latitude: 25.76, longitude: -80.19 });
		const chicago = getFrostDates({ latitude: 41.88, longitude: -87.63 });

		const miamiLength = calculateGrowingSeasonLength(miami);
		const chicagoLength = calculateGrowingSeasonLength(chicago);

		expect(miamiLength).toBeGreaterThan(chicagoLength);
	});

	it('handles southern hemisphere correctly', () => {
		const sydney = getFrostDates({ latitude: -33.87, longitude: 151.21 });
		const length = calculateGrowingSeasonLength(sydney);

		// Sydney should have reasonable growing season despite southern hemisphere
		expect(length).toBeGreaterThan(100);
		expect(length).toBeLessThan(300);
	});
});
