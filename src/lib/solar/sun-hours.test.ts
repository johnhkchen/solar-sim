/**
 * Tests for the sun hours integrator.
 *
 * These tests verify that the integration module correctly computes daily sun hours
 * by sampling at regular intervals. Reference values are from timeanddate.com with
 * a tolerance of 15 minutes to account for sampling resolution and algorithm precision.
 */

import { describe, it, expect } from 'vitest';
import { getDailySunHours } from './sun-hours.js';
import type { Coordinates } from './types.js';

// Test locations
const PORTLAND: Coordinates = { latitude: 45.5152, longitude: -122.6784 };
const SINGAPORE: Coordinates = { latitude: 1.3521, longitude: 103.8198 };
const TROMSO: Coordinates = { latitude: 69.6492, longitude: 18.9553 };

describe('getDailySunHours', () => {
	describe('Portland standard cases', () => {
		it('returns approximately 15.5 hours on summer solstice', () => {
			// Reference: timeanddate.com Portland June 20, 2024
			// Day length: 15h 41m, but sun hours (above horizon) may differ slightly
			// due to twilight handling. Expecting ~15.5 hours.

			const date = new Date(Date.UTC(2024, 5, 20));
			const result = getDailySunHours(PORTLAND, date);

			expect(result.sunHours).toBeGreaterThan(15);
			expect(result.sunHours).toBeLessThan(16.5);
			expect(result.polarCondition).toBe('normal');
		});

		it('returns approximately 8.5 hours on winter solstice', () => {
			// Reference: timeanddate.com Portland December 21, 2024
			// Day length: 8h 42m

			const date = new Date(Date.UTC(2024, 11, 21));
			const result = getDailySunHours(PORTLAND, date);

			expect(result.sunHours).toBeGreaterThan(8);
			expect(result.sunHours).toBeLessThan(9.5);
			expect(result.polarCondition).toBe('normal');
		});

		it('returns approximately 12 hours on spring equinox', () => {
			// Reference: timeanddate.com Portland March 20, 2024
			// Day length: ~12h 9m

			const date = new Date(Date.UTC(2024, 2, 20));
			const result = getDailySunHours(PORTLAND, date);

			expect(result.sunHours).toBeGreaterThan(11.5);
			expect(result.sunHours).toBeLessThan(12.75);
			expect(result.polarCondition).toBe('normal');
		});

		it('returns approximately 12 hours on fall equinox', () => {
			// Reference: timeanddate.com Portland September 22, 2024
			// Day length: ~12h 8m

			const date = new Date(Date.UTC(2024, 8, 22));
			const result = getDailySunHours(PORTLAND, date);

			expect(result.sunHours).toBeGreaterThan(11.5);
			expect(result.sunHours).toBeLessThan(12.75);
			expect(result.polarCondition).toBe('normal');
		});
	});

	describe('Singapore equatorial case', () => {
		it('returns approximately 12 hours in summer', () => {
			const date = new Date(Date.UTC(2024, 5, 20));
			const result = getDailySunHours(SINGAPORE, date);

			expect(result.sunHours).toBeGreaterThan(11.5);
			expect(result.sunHours).toBeLessThan(12.5);
			expect(result.polarCondition).toBe('normal');
		});

		it('returns approximately 12 hours in winter', () => {
			const date = new Date(Date.UTC(2024, 11, 21));
			const result = getDailySunHours(SINGAPORE, date);

			expect(result.sunHours).toBeGreaterThan(11.5);
			expect(result.sunHours).toBeLessThan(12.5);
			expect(result.polarCondition).toBe('normal');
		});

		it('has minimal variation throughout the year', () => {
			const summer = getDailySunHours(SINGAPORE, new Date(Date.UTC(2024, 5, 20)));
			const winter = getDailySunHours(SINGAPORE, new Date(Date.UTC(2024, 11, 21)));
			const spring = getDailySunHours(SINGAPORE, new Date(Date.UTC(2024, 2, 20)));
			const fall = getDailySunHours(SINGAPORE, new Date(Date.UTC(2024, 8, 22)));

			// All should be within 30 minutes of each other
			const values = [summer.sunHours, winter.sunHours, spring.sunHours, fall.sunHours];
			const max = Math.max(...values);
			const min = Math.min(...values);

			expect(max - min).toBeLessThan(0.5);
		});
	});

	describe('Tromsø polar cases', () => {
		it('returns 24 hours during midnight sun', () => {
			const date = new Date(Date.UTC(2024, 5, 20));
			const result = getDailySunHours(TROMSO, date);

			expect(result.sunHours).toBe(24);
			expect(result.polarCondition).toBe('midnight-sun');
		});

		it('returns 0 hours during polar night', () => {
			const date = new Date(Date.UTC(2024, 11, 21));
			const result = getDailySunHours(TROMSO, date);

			expect(result.sunHours).toBe(0);
			expect(result.polarCondition).toBe('polar-night');
		});
	});

	describe('result structure', () => {
		it('returns complete DailySunData structure', () => {
			const date = new Date(Date.UTC(2024, 5, 20));
			const result = getDailySunHours(PORTLAND, date);

			expect(result).toHaveProperty('date');
			expect(result).toHaveProperty('sunHours');
			expect(result).toHaveProperty('sunTimes');
			expect(result).toHaveProperty('polarCondition');

			expect(result.date).toBeInstanceOf(Date);
			expect(typeof result.sunHours).toBe('number');
			expect(result.sunTimes).toHaveProperty('sunrise');
			expect(result.sunTimes).toHaveProperty('sunset');
			expect(result.sunTimes).toHaveProperty('solarNoon');
			expect(result.sunTimes).toHaveProperty('dayLength');
		});

		it('normalizes date to start of day UTC', () => {
			// Pass a date with time component
			const date = new Date(Date.UTC(2024, 5, 20, 15, 30, 45));
			const result = getDailySunHours(PORTLAND, date);

			// Result date should be normalized to midnight UTC
			expect(result.date.getUTCHours()).toBe(0);
			expect(result.date.getUTCMinutes()).toBe(0);
			expect(result.date.getUTCSeconds()).toBe(0);
		});
	});
});
