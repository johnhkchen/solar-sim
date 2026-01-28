/**
 * Edge case tests for the solar calculation engine.
 *
 * These tests verify correct behavior for unusual situations including
 * polar regions, Arctic Circle boundaries, extreme dates, and equatorial locations.
 */

import { describe, it, expect } from 'vitest';
import { getSunPosition, getSunTimes, getPolarCondition } from './position.js';
import { getDailySunHours } from './sun-hours.js';
import { getSeasonalSummary, getMonthlySummary } from './seasonal.js';
import type { Coordinates } from './types.js';

// Test locations
const TROMSO: Coordinates = { latitude: 69.6492, longitude: 18.9553 };
const ARCTIC_CIRCLE: Coordinates = { latitude: 66.5, longitude: 25.0 };
const SINGAPORE: Coordinates = { latitude: 1.3521, longitude: 103.8198 };
const QUITO: Coordinates = { latitude: -0.1807, longitude: -78.4678 }; // Nearly exactly on equator
const SOUTH_POLE: Coordinates = { latitude: -90, longitude: 0 };
const NORTH_POLE: Coordinates = { latitude: 90, longitude: 0 };

describe('Polar Region Tests - Tromsø', () => {
	describe('Midnight Sun Detection', () => {
		it('detects midnight sun on summer solstice', () => {
			const date = new Date(Date.UTC(2024, 5, 21));
			const condition = getPolarCondition(TROMSO, date);
			expect(condition).toBe('midnight-sun');
		});

		it('sun times return null sunrise/sunset during midnight sun', () => {
			const date = new Date(Date.UTC(2024, 5, 21));
			const times = getSunTimes(TROMSO, date);

			expect(times.sunrise).toBeNull();
			expect(times.sunset).toBeNull();
			expect(times.dayLength).toBe(24);
		});

		it('returns 24 sun hours during midnight sun', () => {
			const date = new Date(Date.UTC(2024, 5, 21));
			const data = getDailySunHours(TROMSO, date);

			expect(data.sunHours).toBe(24);
			expect(data.polarCondition).toBe('midnight-sun');
		});

		it('midnight sun period spans multiple days', () => {
			// Check a range around summer solstice
			const start = new Date(Date.UTC(2024, 4, 20)); // May 20
			const end = new Date(Date.UTC(2024, 6, 22)); // July 22
			const summary = getSeasonalSummary(TROMSO, start, end);

			// Should have many days of midnight sun
			expect(summary.daysOfMidnightSun).toBeGreaterThan(50);
		});
	});

	describe('Polar Night Detection', () => {
		it('detects polar night on winter solstice', () => {
			const date = new Date(Date.UTC(2024, 11, 21));
			const condition = getPolarCondition(TROMSO, date);
			expect(condition).toBe('polar-night');
		});

		it('sun times return null sunrise/sunset during polar night', () => {
			const date = new Date(Date.UTC(2024, 11, 21));
			const times = getSunTimes(TROMSO, date);

			expect(times.sunrise).toBeNull();
			expect(times.sunset).toBeNull();
			expect(times.dayLength).toBe(0);
		});

		it('returns 0 sun hours during polar night', () => {
			const date = new Date(Date.UTC(2024, 11, 21));
			const data = getDailySunHours(TROMSO, date);

			expect(data.sunHours).toBe(0);
			expect(data.polarCondition).toBe('polar-night');
		});

		it('polar night period spans multiple days', () => {
			// Check a range around winter solstice
			const start = new Date(Date.UTC(2024, 10, 27)); // Nov 27
			const end = new Date(Date.UTC(2025, 0, 15)); // Jan 15
			const summary = getSeasonalSummary(TROMSO, start, end);

			// Should have many days of polar night
			expect(summary.daysOfPolarNight).toBeGreaterThan(40);
		});
	});

	describe('Transition Periods', () => {
		it('transitions from normal to midnight sun in spring', () => {
			// May in Tromsø is a transition period
			const may = getMonthlySummary(TROMSO, 2024, 5);

			// Should have mix of normal days and midnight sun days
			const normalDays = may.dailyData.filter((d) => d.polarCondition === 'normal').length;
			const midnightSunDays = may.dailyData.filter(
				(d) => d.polarCondition === 'midnight-sun'
			).length;

			expect(normalDays).toBeGreaterThan(0);
			expect(midnightSunDays).toBeGreaterThan(0);
		});

		it('transitions from polar night to normal in late January', () => {
			// Late January in Tromsø emerges from polar night
			const january = getMonthlySummary(TROMSO, 2024, 1);

			// Should have mix of polar night and normal days
			const polarNightDays = january.dailyData.filter(
				(d) => d.polarCondition === 'polar-night'
			).length;
			const normalDays = january.dailyData.filter((d) => d.polarCondition === 'normal').length;

			expect(polarNightDays).toBeGreaterThan(0);
			expect(normalDays).toBeGreaterThan(0);
		});
	});
});

describe('Arctic Circle Boundary Tests', () => {
	it('experiences near-24-hour days at summer solstice', () => {
		const date = new Date(Date.UTC(2024, 5, 21));
		const data = getDailySunHours(ARCTIC_CIRCLE, date);

		// At Arctic Circle boundary, the sun barely dips below horizon
		// Either midnight sun or very close to 24 hours
		expect(data.sunHours).toBeGreaterThan(23);
	});

	it('experiences very short days at winter solstice', () => {
		const date = new Date(Date.UTC(2024, 11, 21));
		const data = getDailySunHours(ARCTIC_CIRCLE, date);

		// Sun barely rises above horizon
		expect(data.sunHours).toBeLessThan(3);
	});

	it('has normal sunrise/sunset near equinox', () => {
		const date = new Date(Date.UTC(2024, 2, 20));
		const condition = getPolarCondition(ARCTIC_CIRCLE, date);

		expect(condition).toBe('normal');

		const data = getDailySunHours(ARCTIC_CIRCLE, date);
		expect(data.sunHours).toBeGreaterThan(11);
		expect(data.sunHours).toBeLessThan(13);
	});
});

describe('Equatorial Tests - Singapore', () => {
	it('has consistent day length throughout the year', () => {
		const dates = [
			new Date(Date.UTC(2024, 0, 15)), // January
			new Date(Date.UTC(2024, 3, 15)), // April
			new Date(Date.UTC(2024, 6, 15)), // July
			new Date(Date.UTC(2024, 9, 15)) // October
		];

		const sunHours = dates.map((d) => getDailySunHours(SINGAPORE, d).sunHours);

		// All values should be close to 12 hours
		for (const hours of sunHours) {
			expect(hours).toBeGreaterThan(11.75);
			expect(hours).toBeLessThan(12.25);
		}

		// Maximum variation should be less than 30 minutes
		const max = Math.max(...sunHours);
		const min = Math.min(...sunHours);
		expect(max - min).toBeLessThan(0.5);
	});

	it('always has normal polar condition', () => {
		const dates = [
			new Date(Date.UTC(2024, 5, 21)), // Summer solstice
			new Date(Date.UTC(2024, 11, 21)), // Winter solstice
			new Date(Date.UTC(2024, 2, 20)), // Spring equinox
			new Date(Date.UTC(2024, 8, 22)) // Fall equinox
		];

		for (const date of dates) {
			expect(getPolarCondition(SINGAPORE, date)).toBe('normal');
		}
	});
});

describe('Equatorial Tests - Quito', () => {
	it('has nearly equal day and night on equinoxes', () => {
		const springEquinox = new Date(Date.UTC(2024, 2, 20));
		const data = getDailySunHours(QUITO, springEquinox);

		// Should be very close to 12 hours
		expect(data.sunHours).toBeGreaterThan(11.9);
		expect(data.sunHours).toBeLessThan(12.1);
	});

	it('experiences minimal seasonal variation', () => {
		const summerSolstice = getDailySunHours(QUITO, new Date(Date.UTC(2024, 5, 21)));
		const winterSolstice = getDailySunHours(QUITO, new Date(Date.UTC(2024, 11, 21)));

		// Difference should be minimal (less than 10 minutes)
		expect(Math.abs(summerSolstice.sunHours - winterSolstice.sunHours)).toBeLessThan(0.17);
	});
});

describe('Pole Tests', () => {
	describe('North Pole', () => {
		it('has 24-hour sun on summer solstice', () => {
			const date = new Date(Date.UTC(2024, 5, 21));
			const data = getDailySunHours(NORTH_POLE, date);

			expect(data.sunHours).toBe(24);
			expect(data.polarCondition).toBe('midnight-sun');
		});

		it('has 0-hour sun on winter solstice', () => {
			const date = new Date(Date.UTC(2024, 11, 21));
			const data = getDailySunHours(NORTH_POLE, date);

			expect(data.sunHours).toBe(0);
			expect(data.polarCondition).toBe('polar-night');
		});

		it('has 6 months of continuous daylight', () => {
			// Check April through August
			let midnightSunDays = 0;
			for (let month = 3; month <= 8; month++) {
				const summary = getMonthlySummary(NORTH_POLE, 2024, month + 1);
				midnightSunDays += summary.daysOfMidnightSun;
			}

			// Should be at least 150 days of midnight sun (roughly 5 months)
			expect(midnightSunDays).toBeGreaterThan(150);
		});
	});

	describe('South Pole', () => {
		it('has 0-hour sun on June solstice (southern winter)', () => {
			const date = new Date(Date.UTC(2024, 5, 21));
			const data = getDailySunHours(SOUTH_POLE, date);

			expect(data.sunHours).toBe(0);
			expect(data.polarCondition).toBe('polar-night');
		});

		it('has 24-hour sun on December solstice (southern summer)', () => {
			const date = new Date(Date.UTC(2024, 11, 21));
			const data = getDailySunHours(SOUTH_POLE, date);

			expect(data.sunHours).toBe(24);
			expect(data.polarCondition).toBe('midnight-sun');
		});
	});
});

describe('Extreme Date Tests', () => {
	it('handles dates in the far past (1950)', () => {
		const date = new Date(Date.UTC(1950, 5, 21));
		const data = getDailySunHours(SINGAPORE, date);

		// Should still return reasonable values
		expect(data.sunHours).toBeGreaterThan(11.5);
		expect(data.sunHours).toBeLessThan(12.5);
		expect(data.polarCondition).toBe('normal');
	});

	it('handles dates in the far future (2099)', () => {
		const date = new Date(Date.UTC(2099, 5, 21));
		const data = getDailySunHours(SINGAPORE, date);

		// Should still return reasonable values
		expect(data.sunHours).toBeGreaterThan(11.5);
		expect(data.sunHours).toBeLessThan(12.5);
		expect(data.polarCondition).toBe('normal');
	});

	it('handles leap year dates correctly', () => {
		const leapDay = new Date(Date.UTC(2024, 1, 29)); // Feb 29, 2024
		const data = getDailySunHours(SINGAPORE, leapDay);

		// Should return valid data
		expect(data.sunHours).toBeGreaterThan(0);
		expect(data.date.getUTCMonth()).toBe(1);
		expect(data.date.getUTCDate()).toBe(29);
	});
});

describe('Coordinate Boundary Tests', () => {
	it('handles exactly latitude 0 (equator)', () => {
		const equator: Coordinates = { latitude: 0, longitude: 0 };
		const date = new Date(Date.UTC(2024, 2, 20)); // Equinox

		const data = getDailySunHours(equator, date);

		expect(data.sunHours).toBeGreaterThan(11.9);
		expect(data.sunHours).toBeLessThan(12.1);
	});

	it('handles international date line crossing', () => {
		const westOfDateLine: Coordinates = { latitude: 0, longitude: 179 };
		const eastOfDateLine: Coordinates = { latitude: 0, longitude: -179 };

		const date = new Date(Date.UTC(2024, 5, 21));

		const west = getDailySunHours(westOfDateLine, date);
		const east = getDailySunHours(eastOfDateLine, date);

		// Both should have similar sun hours (same latitude)
		expect(Math.abs(west.sunHours - east.sunHours)).toBeLessThan(0.5);
	});

	it('handles negative longitudes correctly', () => {
		const westHemisphere: Coordinates = { latitude: 45, longitude: -120 };
		const eastHemisphere: Coordinates = { latitude: 45, longitude: 120 };

		const date = new Date(Date.UTC(2024, 5, 21));

		const west = getDailySunHours(westHemisphere, date);
		const east = getDailySunHours(eastHemisphere, date);

		// Same latitude should have same sun hours
		expect(Math.abs(west.sunHours - east.sunHours)).toBeLessThan(0.2);
	});
});
