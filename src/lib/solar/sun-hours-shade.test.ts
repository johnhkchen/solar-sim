/**
 * Tests for shade-aware sun hours integration.
 *
 * These tests verify that obstacle shading correctly reduces credited sun hours
 * and that shade window detection accurately tracks when blocking occurs.
 */

import { describe, it, expect } from 'vitest';
import {
	getDailySunHoursWithShade,
	calculateDailyShadeAnalysis,
	getSeasonalSummaryWithShade
} from './sun-hours-shade.js';
import { getDailySunHours } from './sun-hours.js';
import type { Obstacle } from './shade-types.js';
import type { Coordinates } from './types.js';

// Test location: Los Angeles (moderate latitude with predictable sun path)
const LA_COORDS: Coordinates = { latitude: 34.05, longitude: -118.25 };

// Summer solstice in northern hemisphere - long day, high sun
const SUMMER_SOLSTICE = new Date('2024-06-21T12:00:00Z');

// Equinox - sun rises east, sets west, moderate path
const EQUINOX = new Date('2024-03-20T12:00:00Z');

// Helper to create an obstacle with default values
function makeObstacle(
	id: string,
	direction: number,
	distance: number,
	height: number,
	width: number,
	type: Obstacle['type'] = 'building'
): Obstacle {
	return { id, type, label: id, direction, distance, height, width };
}

describe('getDailySunHoursWithShade', () => {
	it('returns same hours as baseline when no obstacles exist', () => {
		const baseline = getDailySunHours(LA_COORDS, SUMMER_SOLSTICE);
		const withShade = getDailySunHoursWithShade(LA_COORDS, SUMMER_SOLSTICE, []);

		expect(withShade.sunHours).toBe(baseline.sunHours);
		expect(withShade.effectiveHours).toBe(baseline.sunHours);
		expect(withShade.percentBlocked).toBe(0);
	});

	it('reduces hours when opaque obstacle blocks the sun', () => {
		// Place tall buildings to the east and west where the sun is lower in the sky.
		// During summer solstice the noon sun is very high (~79 degrees at LA latitude),
		// so blocking requires extremely tall nearby obstacles. Morning/evening sun is lower.
		const eastBuilding = makeObstacle('building-east', 90, 10, 15, 30);
		const westBuilding = makeObstacle('building-west', 270, 10, 15, 30);
		const result = getDailySunHoursWithShade(LA_COORDS, EQUINOX, [
			eastBuilding,
			westBuilding
		]);

		expect(result.effectiveHours).toBeLessThan(result.sunHours);
		expect(result.percentBlocked).toBeGreaterThan(0);
	});

	it('has no effect when obstacle is in opposite direction from sun', () => {
		// Place a building to the north - sun is never there in northern hemisphere
		const northBuilding = makeObstacle('building-north', 0, 10, 20, 30);
		const result = getDailySunHoursWithShade(LA_COORDS, SUMMER_SOLSTICE, [northBuilding]);

		expect(result.effectiveHours).toBe(result.sunHours);
		expect(result.percentBlocked).toBe(0);
	});

	it('accounts for partial transparency with trees', () => {
		// Place obstacles to the east where morning sun is lower and easier to block.
		// Trees allow ~40% light through, buildings block 100%.
		const tree = makeObstacle('tree-east', 90, 8, 12, 15, 'deciduous-tree');
		const building = makeObstacle('building-east', 90, 8, 12, 15, 'building');

		const treeResult = getDailySunHoursWithShade(LA_COORDS, EQUINOX, [tree]);
		const buildingResult = getDailySunHoursWithShade(LA_COORDS, EQUINOX, [building]);

		// Tree should allow more light through than building
		expect(treeResult.effectiveHours).toBeGreaterThan(buildingResult.effectiveHours);
	});

	it('handles distant obstacles with less blocking effect', () => {
		// Same building at different distances - use east direction for lower sun angles
		const nearBuilding = makeObstacle('near', 90, 5, 10, 20);
		const farBuilding = makeObstacle('far', 90, 50, 10, 20);

		const nearResult = getDailySunHoursWithShade(LA_COORDS, EQUINOX, [nearBuilding]);
		const farResult = getDailySunHoursWithShade(LA_COORDS, EQUINOX, [farBuilding]);

		// Near building should block more (subtends larger angle)
		expect(nearResult.percentBlocked).toBeGreaterThan(farResult.percentBlocked);
	});

	it('handles polar night correctly', () => {
		// Location inside Arctic circle during winter
		const arctic: Coordinates = { latitude: 80, longitude: 0 };
		const winterDate = new Date('2024-12-21T12:00:00Z');
		const obstacle = makeObstacle('building', 180, 10, 20, 30);

		const result = getDailySunHoursWithShade(arctic, winterDate, [obstacle]);

		expect(result.sunHours).toBe(0);
		expect(result.effectiveHours).toBe(0);
		expect(result.percentBlocked).toBe(0);
		expect(result.polarCondition).toBe('polar-night');
	});

	it('handles midnight sun with shade calculation', () => {
		// Location inside Arctic circle during summer
		const arctic: Coordinates = { latitude: 80, longitude: 0 };
		const summerDate = new Date('2024-06-21T12:00:00Z');
		const obstacle = makeObstacle('building', 180, 10, 20, 30);

		const result = getDailySunHoursWithShade(arctic, summerDate, [obstacle]);

		// Should have 24 hours of theoretical sun but some blocked
		expect(result.sunHours).toBe(24);
		expect(result.effectiveHours).toBeLessThan(24);
		expect(result.polarCondition).toBe('midnight-sun');
	});
});

describe('calculateDailyShadeAnalysis', () => {
	it('returns empty shade windows when no obstacles', () => {
		const result = calculateDailyShadeAnalysis(LA_COORDS, SUMMER_SOLSTICE, []);

		expect(result.shadeWindows).toHaveLength(0);
		expect(result.effectiveSunHours).toBe(result.theoreticalSunHours);
	});

	it('detects shade windows when obstacle blocks sun', () => {
		// Tall building to the east blocks morning sun when it's lower in the sky.
		// On the equinox, sun rises due east at low altitude, making this geometry effective.
		const eastBuilding = makeObstacle('building-east', 90, 10, 15, 30);
		const result = calculateDailyShadeAnalysis(LA_COORDS, EQUINOX, [eastBuilding]);

		expect(result.shadeWindows.length).toBeGreaterThan(0);

		// Verify shade windows have valid structure
		for (const window of result.shadeWindows) {
			expect(window.obstacleId).toBe('building-east');
			expect(window.startTime.getTime()).toBeLessThan(window.endTime.getTime());
			expect(window.shadeIntensity).toBeGreaterThan(0);
			expect(window.shadeIntensity).toBeLessThanOrEqual(1);
		}
	});

	it('tracks multiple obstacles independently', () => {
		// Two obstacles in different directions
		const eastBuilding = makeObstacle('building-east', 90, 10, 20, 20);
		const westBuilding = makeObstacle('building-west', 270, 10, 20, 20);

		const result = calculateDailyShadeAnalysis(LA_COORDS, EQUINOX, [
			eastBuilding,
			westBuilding
		]);

		// Should have windows from both obstacles
		const eastWindows = result.shadeWindows.filter((w) => w.obstacleId === 'building-east');
		const westWindows = result.shadeWindows.filter((w) => w.obstacleId === 'building-west');

		// East building blocks morning sun, west blocks evening
		expect(eastWindows.length).toBeGreaterThan(0);
		expect(westWindows.length).toBeGreaterThan(0);
	});

	it('returns consistent data between simple and detailed analysis', () => {
		const obstacle = makeObstacle('building', 180, 10, 15, 25);

		const simple = getDailySunHoursWithShade(LA_COORDS, SUMMER_SOLSTICE, [obstacle]);
		const detailed = calculateDailyShadeAnalysis(LA_COORDS, SUMMER_SOLSTICE, [obstacle]);

		// Values should match within floating point tolerance
		expect(detailed.theoreticalSunHours).toBeCloseTo(simple.sunHours, 5);
		expect(detailed.effectiveSunHours).toBeCloseTo(simple.effectiveHours, 5);
		expect(detailed.percentBlocked).toBeCloseTo(simple.percentBlocked, 5);
	});
});

describe('getSeasonalSummaryWithShade', () => {
	it('aggregates daily analysis over date range', () => {
		const startDate = new Date('2024-06-01T00:00:00Z');
		const endDate = new Date('2024-06-07T00:00:00Z');
		const obstacle = makeObstacle('tree', 180, 15, 12, 8, 'deciduous-tree');

		const result = getSeasonalSummaryWithShade(LA_COORDS, startDate, endDate, [obstacle]);

		// Should have 7 days of analysis
		expect(result.dailyAnalysis).toHaveLength(7);
		expect(result.averageTheoreticalHours).toBeGreaterThan(0);
		expect(result.averageEffectiveHours).toBeGreaterThan(0);
		expect(result.averageEffectiveHours).toBeLessThanOrEqual(result.averageTheoreticalHours);
	});

	it('identifies dominant blocker correctly', () => {
		// Big building that blocks a lot vs small fence that blocks little
		const bigBuilding = makeObstacle('big-building', 180, 10, 30, 50, 'building');
		const smallFence = makeObstacle('small-fence', 90, 20, 1.8, 5, 'fence');

		const startDate = new Date('2024-06-01T00:00:00Z');
		const endDate = new Date('2024-06-07T00:00:00Z');

		const result = getSeasonalSummaryWithShade(LA_COORDS, startDate, endDate, [
			bigBuilding,
			smallFence
		]);

		// The big building to the south should be the dominant blocker
		expect(result.dominantBlocker).toBe('big-building');
	});

	it('returns null dominant blocker when no shade', () => {
		// Obstacle in north that never blocks sun
		const northFence = makeObstacle('north-fence', 0, 10, 1.8, 10, 'fence');

		const startDate = new Date('2024-06-01T00:00:00Z');
		const endDate = new Date('2024-06-03T00:00:00Z');

		const result = getSeasonalSummaryWithShade(LA_COORDS, startDate, endDate, [northFence]);

		expect(result.dominantBlocker).toBeNull();
	});

	it('stores obstacles in result', () => {
		const obstacles = [
			makeObstacle('a', 90, 10, 5, 5),
			makeObstacle('b', 270, 10, 5, 5)
		];

		const startDate = new Date('2024-06-01T00:00:00Z');
		const endDate = new Date('2024-06-01T00:00:00Z');

		const result = getSeasonalSummaryWithShade(LA_COORDS, startDate, endDate, obstacles);

		expect(result.obstacles).toEqual(obstacles);
		expect(result.startDate.getTime()).toBe(startDate.getTime());
		expect(result.endDate.getTime()).toBe(endDate.getTime());
	});
});
