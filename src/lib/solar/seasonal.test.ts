/**
 * Tests for the seasonal aggregation module.
 *
 * These tests verify that the aggregation functions correctly compute statistics
 * across date ranges, handle leap years, and count polar conditions accurately.
 */

import { describe, it, expect } from 'vitest';
import {
	getSeasonalSummary,
	getMonthlySummary,
	getYearlySummary,
	getAnnualSummary
} from './seasonal.js';
import type { Coordinates } from './types.js';

// Test locations
const PORTLAND: Coordinates = { latitude: 45.5152, longitude: -122.6784 };
const TROMSO: Coordinates = { latitude: 69.6492, longitude: 18.9553 };

describe('getSeasonalSummary', () => {
	it('computes correct statistics for a short range', () => {
		const startDate = new Date(Date.UTC(2024, 5, 18));
		const endDate = new Date(Date.UTC(2024, 5, 22));
		const result = getSeasonalSummary(PORTLAND, startDate, endDate);

		// 5 days around summer solstice
		expect(result.dailyData).toHaveLength(5);
		expect(result.startDate.getTime()).toBe(startDate.getTime());
		expect(result.endDate.getTime()).toBe(endDate.getTime());

		// All days should be roughly similar (within an hour)
		expect(result.maxSunHours - result.minSunHours).toBeLessThan(1);

		// Average should be around 15.5 hours
		expect(result.averageSunHours).toBeGreaterThan(15);
		expect(result.averageSunHours).toBeLessThan(16.5);

		// No polar conditions at this latitude
		expect(result.daysOfMidnightSun).toBe(0);
		expect(result.daysOfPolarNight).toBe(0);
	});

	it('handles single day range', () => {
		const date = new Date(Date.UTC(2024, 5, 20));
		const result = getSeasonalSummary(PORTLAND, date, date);

		expect(result.dailyData).toHaveLength(1);
		expect(result.averageSunHours).toBe(result.dailyData[0].sunHours);
		expect(result.minSunHours).toBe(result.dailyData[0].sunHours);
		expect(result.maxSunHours).toBe(result.dailyData[0].sunHours);
	});

	it('counts polar conditions in Tromsø', () => {
		// A week during midnight sun period
		const summerStart = new Date(Date.UTC(2024, 5, 15));
		const summerEnd = new Date(Date.UTC(2024, 5, 21));
		const summerResult = getSeasonalSummary(TROMSO, summerStart, summerEnd);

		expect(summerResult.daysOfMidnightSun).toBe(7);
		expect(summerResult.daysOfPolarNight).toBe(0);
		expect(summerResult.averageSunHours).toBe(24);

		// A week during polar night period
		const winterStart = new Date(Date.UTC(2024, 11, 18));
		const winterEnd = new Date(Date.UTC(2024, 11, 24));
		const winterResult = getSeasonalSummary(TROMSO, winterStart, winterEnd);

		expect(winterResult.daysOfPolarNight).toBe(7);
		expect(winterResult.daysOfMidnightSun).toBe(0);
		expect(winterResult.averageSunHours).toBe(0);
	});
});

describe('getMonthlySummary', () => {
	it('returns correct number of days for each month', () => {
		const jan = getMonthlySummary(PORTLAND, 2024, 1);
		expect(jan.dailyData).toHaveLength(31);

		const feb = getMonthlySummary(PORTLAND, 2024, 2);
		expect(feb.dailyData).toHaveLength(29); // 2024 is a leap year

		const feb2023 = getMonthlySummary(PORTLAND, 2023, 2);
		expect(feb2023.dailyData).toHaveLength(28);

		const apr = getMonthlySummary(PORTLAND, 2024, 4);
		expect(apr.dailyData).toHaveLength(30);
	});

	it('throws error for invalid month', () => {
		expect(() => getMonthlySummary(PORTLAND, 2024, 0)).toThrow();
		expect(() => getMonthlySummary(PORTLAND, 2024, 13)).toThrow();
	});

	it('returns longer days in summer months', () => {
		const june = getMonthlySummary(PORTLAND, 2024, 6);
		const december = getMonthlySummary(PORTLAND, 2024, 12);

		expect(june.averageSunHours).toBeGreaterThan(december.averageSunHours);
		expect(june.averageSunHours - december.averageSunHours).toBeGreaterThan(6);
	});
});

describe('getYearlySummary', () => {
	it('returns 12 monthly summaries', () => {
		const result = getYearlySummary(PORTLAND, 2024);

		expect(result).toHaveLength(12);

		// Verify months are in order January through December
		expect(result[0].startDate.getUTCMonth()).toBe(0); // January
		expect(result[11].startDate.getUTCMonth()).toBe(11); // December
	});

	it('shows seasonal variation in Portland', () => {
		const result = getYearlySummary(PORTLAND, 2024);

		// June (index 5) should have the longest days
		const june = result[5];
		// December (index 11) should have the shortest days
		const december = result[11];

		expect(june.averageSunHours).toBeGreaterThan(14);
		expect(december.averageSunHours).toBeLessThan(10);
	});

	it('captures polar conditions throughout the year in Tromsø', () => {
		const result = getYearlySummary(TROMSO, 2024);

		// Sum up polar condition days across all months
		let totalMidnightSun = 0;
		let totalPolarNight = 0;

		for (const month of result) {
			totalMidnightSun += month.daysOfMidnightSun;
			totalPolarNight += month.daysOfPolarNight;
		}

		// Tromsø should have roughly 2 months of each polar condition
		expect(totalMidnightSun).toBeGreaterThan(45);
		expect(totalPolarNight).toBeGreaterThan(45);
	});
});

describe('getAnnualSummary', () => {
	it('returns single summary covering entire year', () => {
		const result = getAnnualSummary(PORTLAND, 2024);

		// 2024 is a leap year, so 366 days
		expect(result.dailyData).toHaveLength(366);

		expect(result.startDate.getUTCMonth()).toBe(0);
		expect(result.startDate.getUTCDate()).toBe(1);
		expect(result.endDate.getUTCMonth()).toBe(11);
		expect(result.endDate.getUTCDate()).toBe(31);
	});

	it('returns 365 days for non-leap year', () => {
		const result = getAnnualSummary(PORTLAND, 2023);
		expect(result.dailyData).toHaveLength(365);
	});

	it('computes reasonable annual statistics for Portland', () => {
		const result = getAnnualSummary(PORTLAND, 2024);

		// Annual average should be close to 12 hours (since day length averages out)
		expect(result.averageSunHours).toBeGreaterThan(11);
		expect(result.averageSunHours).toBeLessThan(13);

		// Min should be around winter solstice (~8.5 hours)
		expect(result.minSunHours).toBeGreaterThan(7.5);
		expect(result.minSunHours).toBeLessThan(9.5);

		// Max should be around summer solstice (~15.5 hours)
		expect(result.maxSunHours).toBeGreaterThan(15);
		expect(result.maxSunHours).toBeLessThan(17);

		// No polar conditions at this latitude
		expect(result.daysOfMidnightSun).toBe(0);
		expect(result.daysOfPolarNight).toBe(0);
	});
});
