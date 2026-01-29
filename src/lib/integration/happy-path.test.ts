/**
 * End-to-end integration test for the Solar-Sim happy path.
 *
 * This test simulates the complete user journey: entering a location (Portland, OR)
 * and verifying that the correct sun data appears. It exercises the full calculation
 * pipeline from geo coordinates through the solar engine to light category classification.
 *
 * Reference: docs/happy_path.md describes Maria's journey from Portland entering her
 * location and receiving actionable sun data for garden planning.
 */

import { describe, it, expect } from 'vitest';
import { getDailySunHours, getSeasonalSummary, type Coordinates } from '$lib/solar';
import { classifySunHours, getCategoryInfo, type LightCategory } from '$lib/categories';
import { validateCoordinates, getTimezone } from '$lib/geo';

// Portland, Oregon - the demo user "Maria" from happy_path.md
const PORTLAND: Coordinates = { latitude: 45.5152, longitude: -122.6784 };

// Known astronomical dates for testing predictable conditions
const SUMMER_SOLSTICE_2024 = new Date(Date.UTC(2024, 5, 20));
const WINTER_SOLSTICE_2024 = new Date(Date.UTC(2024, 11, 21));
const SPRING_EQUINOX_2024 = new Date(Date.UTC(2024, 2, 20));

describe('Happy Path Integration', () => {
	describe('Step 1: Location validation', () => {
		it('validates Portland coordinates as correct', () => {
			expect(validateCoordinates(PORTLAND.latitude, PORTLAND.longitude)).toBe(true);
		});

		it('infers Pacific timezone for Portland', () => {
			const result = getTimezone(PORTLAND);
			expect(result.timezone).toBe('America/Los_Angeles');
			expect(result.isEstimate).toBe(false);
		});
	});

	describe('Step 2: Sun data calculation', () => {
		it('returns sun data structure for Portland', () => {
			const sunData = getDailySunHours(PORTLAND, SUMMER_SOLSTICE_2024);

			expect(sunData).toHaveProperty('date');
			expect(sunData).toHaveProperty('sunHours');
			expect(sunData).toHaveProperty('sunTimes');
			expect(sunData).toHaveProperty('polarCondition');
			expect(sunData.polarCondition).toBe('normal');
		});

		it('calculates summer sun hours in expected range (15-16 hours)', () => {
			const sunData = getDailySunHours(PORTLAND, SUMMER_SOLSTICE_2024);

			// Summer solstice at Portland latitude should yield ~15.5 hours of daylight
			// The happy_path.md mentions 14+ hours for summer which we exceed
			expect(sunData.sunHours).toBeGreaterThanOrEqual(15);
			expect(sunData.sunHours).toBeLessThanOrEqual(16);
		});

		it('calculates winter sun hours in expected range (8-9 hours)', () => {
			const sunData = getDailySunHours(PORTLAND, WINTER_SOLSTICE_2024);

			// Winter solstice at Portland latitude should yield ~8.5 hours
			// The happy_path.md mentions 8-9 hours for winter
			expect(sunData.sunHours).toBeGreaterThanOrEqual(8);
			expect(sunData.sunHours).toBeLessThanOrEqual(9.5);
		});

		it('returns reasonable sunrise and sunset times', () => {
			const sunData = getDailySunHours(PORTLAND, SUMMER_SOLSTICE_2024);

			// Portland summer solstice: sunrise ~5:21 UTC (22:21 PDT previous day becomes 5:21 UTC)
			// sunset ~3:55 UTC next day (20:55 PDT)
			expect(sunData.sunTimes.sunrise).not.toBeNull();
			expect(sunData.sunTimes.sunset).not.toBeNull();
			expect(sunData.sunTimes.solarNoon).toBeInstanceOf(Date);

			// Day length should match sun hours within sampling tolerance
			expect(sunData.sunTimes.dayLength).toBeGreaterThan(14);
			expect(sunData.sunTimes.dayLength).toBeLessThan(17);
		});
	});

	describe('Step 3: Light category classification', () => {
		it('classifies summer days as full-sun', () => {
			const sunData = getDailySunHours(PORTLAND, SUMMER_SOLSTICE_2024);
			const category = classifySunHours(sunData.sunHours);

			expect(category).toBe('full-sun');
		});

		it('classifies winter days as full-sun despite fewer hours', () => {
			// Even winter solstice with ~8.5 hours exceeds the 6-hour threshold for full-sun
			const sunData = getDailySunHours(PORTLAND, WINTER_SOLSTICE_2024);
			const category = classifySunHours(sunData.sunHours);

			expect(category).toBe('full-sun');
		});

		it('provides category info with gardening recommendations', () => {
			const sunData = getDailySunHours(PORTLAND, SUMMER_SOLSTICE_2024);
			const info = getCategoryInfo(sunData.sunHours);

			expect(info.category).toBe('full-sun');
			expect(info.label).toBe('Full Sun');
			expect(info.description).toContain('tomatoes');
			expect(info.sunHoursRange).toBe('6+ hours');
		});
	});

	describe('Step 4: Seasonal patterns', () => {
		it('calculates growing season average correctly', () => {
			// Growing season: April through October (months 3-9 in JS, 0-indexed)
			const startOfSeason = new Date(Date.UTC(2024, 3, 1)); // April 1
			const endOfSeason = new Date(Date.UTC(2024, 9, 31)); // October 31

			const seasonal = getSeasonalSummary(PORTLAND, startOfSeason, endOfSeason);

			// happy_path.md mentions 11.3 hours/day average for growing season
			// Our calculation should be in a reasonable range
			expect(seasonal.averageSunHours).toBeGreaterThan(10);
			expect(seasonal.averageSunHours).toBeLessThan(14);
		});

		it('shows expected seasonal variation', () => {
			const summer = getDailySunHours(PORTLAND, SUMMER_SOLSTICE_2024);
			const winter = getDailySunHours(PORTLAND, WINTER_SOLSTICE_2024);
			const spring = getDailySunHours(PORTLAND, SPRING_EQUINOX_2024);

			// Summer should have more hours than spring
			expect(summer.sunHours).toBeGreaterThan(spring.sunHours);

			// Spring should have more hours than winter
			expect(spring.sunHours).toBeGreaterThan(winter.sunHours);

			// The seasonal difference should be significant (at least 3 hours between extremes)
			const seasonalRange = summer.sunHours - winter.sunHours;
			expect(seasonalRange).toBeGreaterThan(6);
		});

		it('identifies Portland as never experiencing polar conditions', () => {
			const summer = getDailySunHours(PORTLAND, SUMMER_SOLSTICE_2024);
			const winter = getDailySunHours(PORTLAND, WINTER_SOLSTICE_2024);

			expect(summer.polarCondition).toBe('normal');
			expect(winter.polarCondition).toBe('normal');
		});
	});

	describe('Step 5: Complete user journey validation', () => {
		it('simulates Maria from Portland receiving correct gardening advice', () => {
			// This test follows the happy_path.md scenario exactly
			const location = PORTLAND;
			const timezone = getTimezone(location);
			const sunData = getDailySunHours(location, new Date());
			const categoryInfo = getCategoryInfo(sunData.sunHours);

			// Maria should see her timezone confirmed as Pacific
			expect(timezone.timezone).toBe('America/Los_Angeles');

			// She should get a clear category classification
			expect(['full-sun', 'part-sun', 'part-shade', 'full-shade'] as LightCategory[]).toContain(
				categoryInfo.category
			);

			// The category info should be actionable (contains plant recommendations)
			expect(categoryInfo.description.length).toBeGreaterThan(0);
			expect(categoryInfo.sunHoursRange.length).toBeGreaterThan(0);
		});

		it('produces shareable URL parameters', () => {
			// Verify the data needed for URL state is available and valid
			const { latitude, longitude } = PORTLAND;
			const { timezone } = getTimezone(PORTLAND);

			// These values would be encoded as: ?lat=45.5152&lon=-122.6784&tz=America/Los_Angeles
			expect(latitude).toBeCloseTo(45.5152, 4);
			expect(longitude).toBeCloseTo(-122.6784, 4);
			expect(timezone).toBe('America/Los_Angeles');

			// URL should be reconstructable from these values
			const urlParams = new URLSearchParams({
				lat: latitude.toString(),
				lon: longitude.toString(),
				tz: timezone,
				name: 'Portland, Oregon'
			});

			expect(urlParams.get('lat')).toBe('45.5152');
			expect(urlParams.get('lon')).toBe('-122.6784');
			expect(urlParams.get('tz')).toBe('America/Los_Angeles');
		});
	});
});

describe('Edge Cases for Gardening Contexts', () => {
	it('handles locations at different latitudes correctly', () => {
		// Test that the pipeline works for various latitudes
		const locations: Array<{ name: string; coords: Coordinates; expectedMinSummer: number }> = [
			{ name: 'Miami', coords: { latitude: 25.7617, longitude: -80.1918 }, expectedMinSummer: 13 },
			{
				name: 'Seattle',
				coords: { latitude: 47.6062, longitude: -122.3321 },
				expectedMinSummer: 15.5
			},
			{
				name: 'Anchorage',
				coords: { latitude: 61.2181, longitude: -149.9003 },
				expectedMinSummer: 18.5
			}
		];

		for (const loc of locations) {
			expect(validateCoordinates(loc.coords.latitude, loc.coords.longitude)).toBe(true);

			const sunData = getDailySunHours(loc.coords, SUMMER_SOLSTICE_2024);
			expect(sunData.sunHours).toBeGreaterThanOrEqual(loc.expectedMinSummer);

			const category = classifySunHours(sunData.sunHours);
			expect(category).toBe('full-sun'); // Summer always provides full sun at US latitudes
		}
	});

	it('correctly classifies marginal light conditions', () => {
		// Test the category boundaries
		expect(classifySunHours(7)).toBe('full-sun');
		expect(classifySunHours(6)).toBe('full-sun');
		expect(classifySunHours(5.9)).toBe('part-sun');
		expect(classifySunHours(5)).toBe('part-sun');
		expect(classifySunHours(4)).toBe('part-sun');
		expect(classifySunHours(3.9)).toBe('part-shade');
		expect(classifySunHours(2)).toBe('part-shade');
		expect(classifySunHours(1.9)).toBe('full-shade');
		expect(classifySunHours(0)).toBe('full-shade');
	});
});
