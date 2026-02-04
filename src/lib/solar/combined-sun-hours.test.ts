/**
 * Tests for the combined sun-hours calculation module.
 *
 * These tests verify that the combined calculation correctly integrates
 * tree shadow impact with theoretical sun hours, and produces accurate
 * breakdowns and formatted outputs.
 */

import { describe, it, expect } from 'vitest';
import {
	calculateTreeShadowHours,
	calculateCombinedSunHoursSync,
	calculateSeasonalCombinedSunHours,
	formatSunHoursBreakdown,
	getTreeShadePercent,
	getTotalShadePercent,
	type SunHoursBreakdown
} from './combined-sun-hours.js';
import type { MapTreeConfig, LatLng } from './shadow-projection.js';
import type { Coordinates } from './types.js';

// Test location: San Francisco
const SF_COORDS: Coordinates = { latitude: 37.7749, longitude: -122.4194 };
const SF_OBSERVATION: LatLng = { lat: 37.7749, lng: -122.4194 };

// Summer solstice (longest day in northern hemisphere)
const SUMMER_SOLSTICE = new Date('2024-06-21T12:00:00Z');

// Winter solstice (shortest day in northern hemisphere)
const WINTER_SOLSTICE = new Date('2024-12-21T12:00:00Z');

// A tree placed to the EAST of the observation point (close, ~8m)
// In the morning when sun is in the east (low altitude), shadows extend west
// This tree will shade the observation point during morning hours
const NEARBY_TREE: MapTreeConfig = {
	id: 'tree-1',
	lat: 37.7749,
	lng: -122.4193, // ~8m east, shadow extends west in morning
	type: 'deciduous-tree',
	height: 10,
	canopyWidth: 8
};

// A tree placed to the WEST of the observation point
// Afternoon shadows extend east, so a tree to the west will shade in afternoon
const WEST_TREE: MapTreeConfig = {
	id: 'tree-2',
	lat: 37.7749,
	lng: -122.4195, // ~8m west
	type: 'evergreen-tree',
	height: 12,
	canopyWidth: 6
};

// A tree far from the observation point (40 meters east) - less shadow impact
// Only shades when sun is very low
const FAR_TREE: MapTreeConfig = {
	id: 'tree-3',
	lat: 37.7749,
	lng: -122.4189, // ~40m east
	type: 'evergreen-tree',
	height: 15,
	canopyWidth: 8
};

describe('calculateCombinedSunHoursSync', () => {
	it('returns positive theoretical hours on a summer day', () => {
		const result = calculateCombinedSunHoursSync(
			SF_OBSERVATION,
			[],
			SF_COORDS,
			SUMMER_SOLSTICE
		);

		// San Francisco gets about 14-15 hours of daylight at summer solstice
		expect(result.breakdown.theoretical).toBeGreaterThan(14);
		expect(result.breakdown.theoretical).toBeLessThan(16);
	});

	it('returns theoretical hours when no trees present', () => {
		const result = calculateCombinedSunHoursSync(
			SF_OBSERVATION,
			[],
			SF_COORDS,
			SUMMER_SOLSTICE
		);

		// No trees means effective equals theoretical
		expect(result.breakdown.treeShadow).toBe(0);
		expect(result.breakdown.effective).toBe(result.breakdown.theoretical);
	});

	it('reduces effective hours when tree shadows observation point', () => {
		const result = calculateCombinedSunHoursSync(
			SF_OBSERVATION,
			[NEARBY_TREE],
			SF_COORDS,
			SUMMER_SOLSTICE
		);

		// Tree should cast shadow on observation point for some period
		expect(result.breakdown.treeShadow).toBeGreaterThan(0);
		expect(result.breakdown.effective).toBeLessThan(result.breakdown.theoretical);
	});

	it('has less impact from distant trees', () => {
		const nearResult = calculateCombinedSunHoursSync(
			SF_OBSERVATION,
			[NEARBY_TREE],
			SF_COORDS,
			SUMMER_SOLSTICE
		);

		const farResult = calculateCombinedSunHoursSync(
			SF_OBSERVATION,
			[FAR_TREE],
			SF_COORDS,
			SUMMER_SOLSTICE
		);

		// Far tree should block less (or equal) time than near tree
		expect(farResult.breakdown.treeShadow).toBeLessThanOrEqual(
			nearResult.breakdown.treeShadow
		);
	});

	it('returns shorter sun hours in winter', () => {
		const summerResult = calculateCombinedSunHoursSync(
			SF_OBSERVATION,
			[],
			SF_COORDS,
			SUMMER_SOLSTICE
		);

		const winterResult = calculateCombinedSunHoursSync(
			SF_OBSERVATION,
			[],
			SF_COORDS,
			WINTER_SOLSTICE
		);

		// Winter should have fewer theoretical hours
		expect(winterResult.breakdown.theoretical).toBeLessThan(
			summerResult.breakdown.theoretical
		);
	});

	it('includes sunrise and sunset times', () => {
		const result = calculateCombinedSunHoursSync(
			SF_OBSERVATION,
			[],
			SF_COORDS,
			SUMMER_SOLSTICE
		);

		expect(result.sunriseTime).toBeInstanceOf(Date);
		expect(result.sunsetTime).toBeInstanceOf(Date);
		expect(result.sunriseTime!.getTime()).toBeLessThan(result.sunsetTime!.getTime());
	});

	it('reports shadeMapAvailable as false for sync version', () => {
		const result = calculateCombinedSunHoursSync(
			SF_OBSERVATION,
			[],
			SF_COORDS,
			SUMMER_SOLSTICE
		);

		expect(result.shadeMapAvailable).toBe(false);
	});

	it('returns zero hours during polar night', () => {
		// Use a location north of Arctic Circle in winter
		const arcticCoords: Coordinates = { latitude: 75, longitude: 25 };
		const arcticObs: LatLng = { lat: 75, lng: 25 };

		const result = calculateCombinedSunHoursSync(
			arcticObs,
			[],
			arcticCoords,
			WINTER_SOLSTICE
		);

		expect(result.breakdown.theoretical).toBe(0);
		expect(result.breakdown.effective).toBe(0);
	});
});

describe('calculateTreeShadowHours', () => {
	it('returns zero when no trees present', () => {
		const result = calculateTreeShadowHours(
			SF_OBSERVATION,
			[],
			SF_COORDS,
			SUMMER_SOLSTICE
		);

		expect(result.blockedHours).toBe(0);
	});

	it('returns sample results array matching day samples', () => {
		const result = calculateTreeShadowHours(
			SF_OBSERVATION,
			[NEARBY_TREE],
			SF_COORDS,
			SUMMER_SOLSTICE
		);

		// Should have 288 samples (24 * 60 / 5)
		expect(result.sampleResults.length).toBe(288);
	});

	it('tracks blocked periods from nearby tree', () => {
		const result = calculateTreeShadowHours(
			SF_OBSERVATION,
			[NEARBY_TREE],
			SF_COORDS,
			SUMMER_SOLSTICE
		);

		// Tree to the east should block morning sun
		expect(result.blockedHours).toBeGreaterThan(0);
		expect(result.sampleResults.some((b) => b)).toBe(true);
	});
});

describe('calculateSeasonalCombinedSunHours', () => {
	it('calculates averages across date range', () => {
		const startDate = new Date('2024-06-01');
		const endDate = new Date('2024-06-07'); // One week

		const result = calculateSeasonalCombinedSunHours(
			SF_OBSERVATION,
			[],
			SF_COORDS,
			startDate,
			endDate
		);

		// Should have 7 daily results
		expect(result.dailyResults.length).toBe(7);

		// Average should be reasonable for early June
		expect(result.averageBreakdown.theoretical).toBeGreaterThan(14);
		expect(result.averageBreakdown.effective).toBeGreaterThan(14);
	});

	it('includes tree count in result', () => {
		const result = calculateSeasonalCombinedSunHours(
			SF_OBSERVATION,
			[NEARBY_TREE, FAR_TREE],
			SF_COORDS,
			new Date('2024-06-01'),
			new Date('2024-06-03')
		);

		expect(result.treeCount).toBe(2);
	});

	it('shows tree shadow impact on seasonal average', () => {
		const noTreesResult = calculateSeasonalCombinedSunHours(
			SF_OBSERVATION,
			[],
			SF_COORDS,
			new Date('2024-06-01'),
			new Date('2024-06-03')
		);

		const withTreesResult = calculateSeasonalCombinedSunHours(
			SF_OBSERVATION,
			[NEARBY_TREE],
			SF_COORDS,
			new Date('2024-06-01'),
			new Date('2024-06-03')
		);

		expect(withTreesResult.averageBreakdown.treeShadow).toBeGreaterThan(0);
		expect(withTreesResult.averageBreakdown.effective).toBeLessThan(
			noTreesResult.averageBreakdown.effective
		);
	});
});

describe('formatSunHoursBreakdown', () => {
	it('formats simple case with no shade', () => {
		const breakdown: SunHoursBreakdown = {
			theoretical: 14.5,
			terrainAndBuildingShadow: 0,
			treeShadow: 0,
			overlapShadow: 0,
			effective: 14.5
		};

		const formatted = formatSunHoursBreakdown(breakdown);
		expect(formatted).toBe('14.5h sun');
	});

	it('formats tree shade breakdown', () => {
		const breakdown: SunHoursBreakdown = {
			theoretical: 14.5,
			terrainAndBuildingShadow: 0,
			treeShadow: 2.3,
			overlapShadow: 0,
			effective: 12.2
		};

		const formatted = formatSunHoursBreakdown(breakdown);
		expect(formatted).toContain('14.5h base');
		expect(formatted).toContain('2.3h tree shade');
		expect(formatted).toContain('12.2h effective');
	});

	it('formats terrain and tree shade breakdown', () => {
		const breakdown: SunHoursBreakdown = {
			theoretical: 14.5,
			terrainAndBuildingShadow: 1.5,
			treeShadow: 2.3,
			overlapShadow: 0.5,
			effective: 10.7
		};

		const formatted = formatSunHoursBreakdown(breakdown);
		expect(formatted).toContain('terrain/building shade');
		expect(formatted).toContain('tree shade');
	});

	it('skips tiny shade values in formatting', () => {
		const breakdown: SunHoursBreakdown = {
			theoretical: 14.5,
			terrainAndBuildingShadow: 0.05, // Below 0.1 threshold
			treeShadow: 0.05,
			overlapShadow: 0,
			effective: 14.4
		};

		const formatted = formatSunHoursBreakdown(breakdown);
		expect(formatted).toBe('14.4h sun');
	});
});

describe('getTreeShadePercent', () => {
	it('returns zero when no theoretical hours', () => {
		const breakdown: SunHoursBreakdown = {
			theoretical: 0,
			terrainAndBuildingShadow: 0,
			treeShadow: 0,
			overlapShadow: 0,
			effective: 0
		};

		expect(getTreeShadePercent(breakdown)).toBe(0);
	});

	it('calculates correct percentage', () => {
		const breakdown: SunHoursBreakdown = {
			theoretical: 10,
			terrainAndBuildingShadow: 0,
			treeShadow: 2,
			overlapShadow: 0,
			effective: 8
		};

		expect(getTreeShadePercent(breakdown)).toBe(20);
	});
});

describe('getTotalShadePercent', () => {
	it('calculates total shade from all sources', () => {
		const breakdown: SunHoursBreakdown = {
			theoretical: 10,
			terrainAndBuildingShadow: 1,
			treeShadow: 2,
			overlapShadow: 0,
			effective: 7
		};

		expect(getTotalShadePercent(breakdown)).toBe(30);
	});

	it('handles case with overlap correctly', () => {
		const breakdown: SunHoursBreakdown = {
			theoretical: 10,
			terrainAndBuildingShadow: 2, // Includes overlap
			treeShadow: 3, // Includes overlap
			overlapShadow: 1,
			effective: 6
		};

		// Total blocked = 10 - 6 = 4, so 40%
		expect(getTotalShadePercent(breakdown)).toBe(40);
	});
});
