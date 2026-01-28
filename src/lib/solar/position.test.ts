/**
 * Tests for the sun position calculator.
 *
 * Reference values sourced from timeanddate.com for verification.
 * Tolerances account for algorithm precision and atmospheric refraction variations.
 */

import { describe, it, expect } from 'vitest';
import { getSunPosition, getSunTimes, getPolarCondition } from './position.js';
import type { Coordinates } from './types.js';

// Test locations
const PORTLAND: Coordinates = { latitude: 45.5152, longitude: -122.6784 };
const SINGAPORE: Coordinates = { latitude: 1.3521, longitude: 103.8198 };
const TROMSO: Coordinates = { latitude: 69.6492, longitude: 18.9553 };

describe('getSunPosition', () => {
	it('returns correct altitude at solar noon in Portland on summer solstice', () => {
		// Summer solstice 2024: June 20
		// At solar noon, the sun should be at its highest point for the day.
		// For Portland at 45.5°N, the maximum altitude on summer solstice is approximately
		// 90 - 45.5 + 23.5 = 68 degrees (where 23.5 is the Earth's axial tilt)
		// Reference: timeanddate.com shows ~68.5° at solar noon

		const date = new Date(Date.UTC(2024, 5, 20, 20, 15)); // Approximate solar noon in Portland (UTC-7 + ~13:15 local)
		const position = getSunPosition(PORTLAND, date);

		expect(position.altitude).toBeGreaterThan(65);
		expect(position.altitude).toBeLessThan(72);
	});

	it('returns correct azimuth at solar noon (due south in northern hemisphere)', () => {
		// At solar noon, the sun should be due south (180°) for northern hemisphere locations
		const date = new Date(Date.UTC(2024, 5, 20, 20, 15));
		const position = getSunPosition(PORTLAND, date);

		// Allow some tolerance since we're not hitting exact solar noon
		expect(position.azimuth).toBeGreaterThan(170);
		expect(position.azimuth).toBeLessThan(190);
	});

	it('returns lower altitude in Portland on winter solstice', () => {
		// Winter solstice 2024: December 21
		// Maximum altitude is approximately 90 - 45.5 - 23.5 = 21 degrees
		// Reference: timeanddate.com shows ~21° at solar noon

		const date = new Date(Date.UTC(2024, 11, 21, 20, 15)); // Approximate solar noon
		const position = getSunPosition(PORTLAND, date);

		expect(position.altitude).toBeGreaterThan(18);
		expect(position.altitude).toBeLessThan(25);
	});

	it('returns negative altitude at night', () => {
		// Midnight in Portland
		const date = new Date(Date.UTC(2024, 5, 21, 7, 0)); // Midnight local time (UTC-7)
		const position = getSunPosition(PORTLAND, date);

		expect(position.altitude).toBeLessThan(0);
	});

	it('includes timestamp in the returned position', () => {
		const date = new Date(Date.UTC(2024, 5, 20, 12, 0));
		const position = getSunPosition(PORTLAND, date);

		expect(position.timestamp).toEqual(date);
	});
});

describe('getSunTimes', () => {
	it('returns valid sunrise and sunset for Portland on summer solstice', () => {
		// Reference: timeanddate.com for Portland on June 20, 2024
		// Sunrise: ~5:19 AM PDT (12:19 UTC)
		// Sunset: ~9:02 PM PDT (04:02 UTC next day)

		const date = new Date(Date.UTC(2024, 5, 20));
		const times = getSunTimes(PORTLAND, date);

		expect(times.sunrise).not.toBeNull();
		expect(times.sunset).not.toBeNull();

		if (times.sunrise && times.sunset) {
			// Check sunrise is in the early morning UTC
			const sunriseHour = times.sunrise.getUTCHours();
			expect(sunriseHour).toBeGreaterThanOrEqual(11);
			expect(sunriseHour).toBeLessThanOrEqual(14);

			// Day length should be around 15.5 hours on summer solstice
			expect(times.dayLength).toBeGreaterThan(15);
			expect(times.dayLength).toBeLessThan(16.5);
		}
	});

	it('returns shorter day length in Portland on winter solstice', () => {
		// Reference: timeanddate.com for Portland on December 21, 2024
		// Day length: ~8h 42m

		const date = new Date(Date.UTC(2024, 11, 21));
		const times = getSunTimes(PORTLAND, date);

		expect(times.sunrise).not.toBeNull();
		expect(times.sunset).not.toBeNull();
		expect(times.dayLength).toBeGreaterThan(8);
		expect(times.dayLength).toBeLessThan(9.5);
	});

	it('returns approximately 12 hour days in Singapore year-round', () => {
		// Singapore is near the equator, so day length varies minimally
		const summerDate = new Date(Date.UTC(2024, 5, 20));
		const winterDate = new Date(Date.UTC(2024, 11, 21));

		const summerTimes = getSunTimes(SINGAPORE, summerDate);
		const winterTimes = getSunTimes(SINGAPORE, winterDate);

		// Both should be close to 12 hours
		expect(summerTimes.dayLength).toBeGreaterThan(11.5);
		expect(summerTimes.dayLength).toBeLessThan(12.5);
		expect(winterTimes.dayLength).toBeGreaterThan(11.5);
		expect(winterTimes.dayLength).toBeLessThan(12.5);

		// Difference between summer and winter should be minimal
		expect(Math.abs(summerTimes.dayLength - winterTimes.dayLength)).toBeLessThan(1);
	});

	it('always has solar noon defined', () => {
		const date = new Date(Date.UTC(2024, 5, 20));
		const times = getSunTimes(PORTLAND, date);

		expect(times.solarNoon).toBeInstanceOf(Date);
		expect(times.solarNoon.getTime()).not.toBeNaN();
	});
});

describe('getPolarCondition', () => {
	it('returns normal for mid-latitude locations', () => {
		const date = new Date(Date.UTC(2024, 5, 20));
		const condition = getPolarCondition(PORTLAND, date);

		expect(condition).toBe('normal');
	});

	it('returns midnight-sun for Tromsø on summer solstice', () => {
		// Tromsø is above the Arctic Circle and experiences midnight sun in summer
		const date = new Date(Date.UTC(2024, 5, 20));
		const condition = getPolarCondition(TROMSO, date);

		expect(condition).toBe('midnight-sun');
	});

	it('returns polar-night for Tromsø on winter solstice', () => {
		// Tromsø experiences polar night in winter
		const date = new Date(Date.UTC(2024, 11, 21));
		const condition = getPolarCondition(TROMSO, date);

		expect(condition).toBe('polar-night');
	});

	it('returns normal for Tromsø near equinox', () => {
		// Around the equinoxes, even Arctic locations have sunrise and sunset
		const date = new Date(Date.UTC(2024, 2, 20)); // March equinox
		const condition = getPolarCondition(TROMSO, date);

		expect(condition).toBe('normal');
	});
});
