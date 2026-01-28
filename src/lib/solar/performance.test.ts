/**
 * Performance benchmarks for the solar calculation engine.
 *
 * These tests verify that computations complete within acceptable time limits
 * to ensure the engine remains responsive for real-world usage patterns.
 *
 * Benchmark targets:
 * - Full year daily calculations: < 100ms
 * - 10 years monthly summaries: < 500ms
 */

import { describe, it, expect } from 'vitest';
import { getDailySunHours } from './sun-hours.js';
import { getAnnualSummary, getMonthlySummary, getYearlySummary } from './seasonal.js';
import type { Coordinates } from './types.js';

// Test location
const PORTLAND: Coordinates = { latitude: 45.5152, longitude: -122.6784 };
const TROMSO: Coordinates = { latitude: 69.6492, longitude: 18.9553 };

describe('Performance Benchmarks', () => {
	describe('Daily Calculation Performance', () => {
		it('computes single day sun hours quickly', () => {
			const date = new Date(Date.UTC(2024, 5, 20));

			const start = performance.now();
			getDailySunHours(PORTLAND, date);
			const elapsed = performance.now() - start;

			// Single day should be very fast (< 10ms)
			expect(elapsed).toBeLessThan(10);
		});

		it('computes 7 days sequentially in under 50ms', () => {
			const dates = Array.from(
				{ length: 7 },
				(_, i) => new Date(Date.UTC(2024, 5, 15 + i))
			);

			const start = performance.now();
			for (const date of dates) {
				getDailySunHours(PORTLAND, date);
			}
			const elapsed = performance.now() - start;

			expect(elapsed).toBeLessThan(50);
		});
	});

	describe('Annual Calculation Performance', () => {
		it('computes full year of daily sun hours in under 100ms', () => {
			const start = performance.now();
			const result = getAnnualSummary(PORTLAND, 2024);
			const elapsed = performance.now() - start;

			// Verify we got a full year of data
			expect(result.dailyData).toHaveLength(366); // 2024 is leap year

			// Primary benchmark: must complete in under 100ms
			expect(elapsed).toBeLessThan(100);

			// Log actual time for reference
			console.log(`Annual summary for Portland: ${elapsed.toFixed(2)}ms`);
		});

		it('computes full year for Tromsø (with polar conditions) in under 100ms', () => {
			const start = performance.now();
			const result = getAnnualSummary(TROMSO, 2024);
			const elapsed = performance.now() - start;

			expect(result.dailyData).toHaveLength(366);
			expect(elapsed).toBeLessThan(100);

			console.log(`Annual summary for Tromsø: ${elapsed.toFixed(2)}ms`);
		});

		it('computes yearly summary (12 monthly breakdowns) in under 100ms', () => {
			const start = performance.now();
			const result = getYearlySummary(PORTLAND, 2024);
			const elapsed = performance.now() - start;

			expect(result).toHaveLength(12);
			expect(elapsed).toBeLessThan(100);

			console.log(`Yearly summary (12 months) for Portland: ${elapsed.toFixed(2)}ms`);
		});
	});

	describe('Multi-Year Performance', () => {
		it('computes 10 years of monthly summaries in under 500ms', () => {
			const start = performance.now();

			const years = [2020, 2021, 2022, 2023, 2024, 2025, 2026, 2027, 2028, 2029];
			const summaries = [];

			for (const year of years) {
				summaries.push(getYearlySummary(PORTLAND, year));
			}

			const elapsed = performance.now() - start;

			// Verify we got data for all years
			expect(summaries).toHaveLength(10);
			expect(summaries.every((s) => s.length === 12)).toBe(true);

			// Secondary benchmark: 10 years in under 500ms
			expect(elapsed).toBeLessThan(500);

			console.log(`10 years of monthly summaries: ${elapsed.toFixed(2)}ms`);
		});

		it('computes 5 years of annual summaries in under 500ms', () => {
			const start = performance.now();

			const years = [2020, 2021, 2022, 2023, 2024];
			const summaries = [];

			for (const year of years) {
				summaries.push(getAnnualSummary(PORTLAND, year));
			}

			const elapsed = performance.now() - start;

			// 5 years = ~1826 days of calculations
			const totalDays = summaries.reduce((sum, s) => sum + s.dailyData.length, 0);
			expect(totalDays).toBeGreaterThan(1800);

			expect(elapsed).toBeLessThan(500);

			console.log(`5 years of annual summaries (${totalDays} days): ${elapsed.toFixed(2)}ms`);
		});
	});

	describe('Monthly Calculation Performance', () => {
		it('computes single month summary in under 20ms', () => {
			const start = performance.now();
			const result = getMonthlySummary(PORTLAND, 2024, 6);
			const elapsed = performance.now() - start;

			expect(result.dailyData).toHaveLength(30); // June has 30 days
			expect(elapsed).toBeLessThan(20);

			console.log(`Monthly summary for June: ${elapsed.toFixed(2)}ms`);
		});

		it('computes all 12 months sequentially in under 100ms', () => {
			const start = performance.now();

			for (let month = 1; month <= 12; month++) {
				getMonthlySummary(PORTLAND, 2024, month);
			}

			const elapsed = performance.now() - start;
			expect(elapsed).toBeLessThan(100);

			console.log(`All 12 months sequentially: ${elapsed.toFixed(2)}ms`);
		});
	});

	describe('Performance Consistency', () => {
		it('maintains consistent performance across multiple runs', () => {
			const timings: number[] = [];

			// Run the same calculation multiple times
			for (let i = 0; i < 5; i++) {
				const start = performance.now();
				getAnnualSummary(PORTLAND, 2024);
				timings.push(performance.now() - start);
			}

			// Calculate variance
			const avg = timings.reduce((a, b) => a + b, 0) / timings.length;
			const maxDeviation = Math.max(...timings.map((t) => Math.abs(t - avg)));

			// Performance should be relatively consistent (within 50% of average)
			// This allows for JIT warmup on first run
			expect(maxDeviation / avg).toBeLessThan(0.5);

			console.log(
				`5 runs average: ${avg.toFixed(2)}ms, max deviation: ${maxDeviation.toFixed(2)}ms`
			);
		});
	});
});
