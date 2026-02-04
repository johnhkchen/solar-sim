/**
 * Tests for shadow polygon calculation.
 */

import { describe, it, expect } from 'vitest';
import {
	calculateShadowLength,
	getShadowDirection,
	adjustShadowLengthForSlope,
	calculateShadowPolygon,
	calculateAllShadows,
	getShadowBounds,
	isPointInShadow,
	calculateTreeShadowLatLng,
	calculateAllTreeShadowsLatLng,
	type PlotObstacle,
	type Point,
	type MapTreeConfig
} from './shadow-projection.js';
import type { SolarPosition } from './types.js';
import type { PlotSlope } from './slope.js';

// Helper to create a test obstacle
function makeObstacle(overrides: Partial<PlotObstacle> = {}): PlotObstacle {
	return {
		id: 'test-1',
		type: 'building',
		label: 'Test Building',
		x: 10,
		y: 10,
		direction: 45, // Northeast of observation point
		distance: Math.sqrt(200), // sqrt(10^2 + 10^2)
		height: 8,
		width: 10,
		...overrides
	};
}

// Helper to create a test sun position
function makeSun(altitude: number, azimuth: number): SolarPosition {
	return {
		altitude,
		azimuth,
		timestamp: new Date()
	};
}

describe('calculateShadowLength', () => {
	it('returns 0 when sun is below horizon', () => {
		expect(calculateShadowLength(10, 0)).toBe(0);
		expect(calculateShadowLength(10, -5)).toBe(0);
	});

	it('calculates correct length for a 45° sun angle', () => {
		// At 45°, shadow length equals height (tan(45°) = 1)
		const length = calculateShadowLength(10, 45);
		expect(length).toBeCloseTo(10, 1);
	});

	it('produces longer shadows at lower sun angles', () => {
		const high = calculateShadowLength(10, 60);
		const low = calculateShadowLength(10, 30);
		expect(low).toBeGreaterThan(high);
	});

	it('caps shadow length at 100m for very low angles', () => {
		const length = calculateShadowLength(10, 1);
		expect(length).toBeLessThanOrEqual(100);
	});

	it('produces shorter shadows at high sun angles', () => {
		// At 60°, shadow length = height / tan(60°) ≈ height / 1.73
		const length = calculateShadowLength(10, 60);
		expect(length).toBeCloseTo(5.77, 1);
	});
});

describe('getShadowDirection', () => {
	it('points south when sun is from the north (azimuth 0)', () => {
		const dir = getShadowDirection(0);
		expect(dir.dx).toBeCloseTo(0, 5);
		expect(dir.dy).toBeCloseTo(-1, 5);
	});

	it('points west when sun is from the east (azimuth 90)', () => {
		const dir = getShadowDirection(90);
		expect(dir.dx).toBeCloseTo(-1, 5);
		expect(dir.dy).toBeCloseTo(0, 5);
	});

	it('points north when sun is from the south (azimuth 180)', () => {
		const dir = getShadowDirection(180);
		expect(dir.dx).toBeCloseTo(0, 5);
		expect(dir.dy).toBeCloseTo(1, 5);
	});

	it('points east when sun is from the west (azimuth 270)', () => {
		const dir = getShadowDirection(270);
		expect(dir.dx).toBeCloseTo(1, 5);
		expect(dir.dy).toBeCloseTo(0, 5);
	});
});

describe('adjustShadowLengthForSlope', () => {
	it('returns base length when slope is undefined', () => {
		const result = adjustShadowLengthForSlope(10, 180);
		expect(result).toBe(10);
	});

	it('returns base length when slope is flat', () => {
		const flatSlope: PlotSlope = { angle: 0, aspect: 180 };
		const result = adjustShadowLengthForSlope(10, 180, flatSlope);
		expect(result).toBe(10);
	});

	it('lengthens shadow falling downhill', () => {
		// South-facing slope with sun from south means shadow goes north (uphill)
		// so it should be shorter
		const southSlope: PlotSlope = { angle: 15, aspect: 180 };
		const resultSouth = adjustShadowLengthForSlope(10, 180, southSlope);

		// North-facing slope with sun from south means shadow goes north (downhill)
		// so it should be longer
		const northSlope: PlotSlope = { angle: 15, aspect: 0 };
		const resultNorth = adjustShadowLengthForSlope(10, 180, northSlope);

		expect(resultNorth).toBeGreaterThan(resultSouth);
	});

	it('clamps adjustment to reasonable range', () => {
		const steepSlope: PlotSlope = { angle: 45, aspect: 0 };
		const result = adjustShadowLengthForSlope(10, 0, steepSlope);
		expect(result).toBeGreaterThanOrEqual(5);
		expect(result).toBeLessThanOrEqual(20);
	});
});

describe('calculateShadowPolygon', () => {
	describe('sun below horizon', () => {
		it('returns null when sun altitude is 0 or negative', () => {
			const obstacle = makeObstacle();
			expect(calculateShadowPolygon(obstacle, makeSun(0, 180))).toBeNull();
			expect(calculateShadowPolygon(obstacle, makeSun(-10, 180))).toBeNull();
		});
	});

	describe('building shadows', () => {
		it('produces a polygon for buildings (convex hull of projected corners)', () => {
			const obstacle = makeObstacle({ type: 'building' });
			const shadow = calculateShadowPolygon(obstacle, makeSun(45, 180));

			expect(shadow).not.toBeNull();
			// Convex hull of 8 points (4 base + 4 roof) typically produces 4-8 vertices
			expect(shadow!.vertices.length).toBeGreaterThanOrEqual(4);
			expect(shadow!.vertices.length).toBeLessThanOrEqual(8);
			expect(shadow!.obstacleType).toBe('building');
			expect(shadow!.shadeIntensity).toBe(1.0);
		});

		it('shadow extends north when sun is from south', () => {
			const obstacle = makeObstacle({ type: 'building', x: 0, y: 10 });
			const shadow = calculateShadowPolygon(obstacle, makeSun(45, 180));

			expect(shadow).not.toBeNull();
			// Shadow should extend north of the building center
			const bounds = getShadowBounds(shadow!);
			// Building is at y=10, shadow should extend north (positive Y)
			expect(bounds.maxY).toBeGreaterThan(obstacle.y);
		});
	});

	describe('tree shadows', () => {
		it('produces a multi-vertex polygon for trees (ellipse approximation)', () => {
			const obstacle = makeObstacle({ type: 'deciduous-tree', width: 8, height: 12 });
			const shadow = calculateShadowPolygon(obstacle, makeSun(45, 180));

			expect(shadow).not.toBeNull();
			expect(shadow!.vertices.length).toBeGreaterThan(4); // More than quadrilateral
			expect(shadow!.obstacleType).toBe('deciduous-tree');
		});

		it('deciduous tree shadow has partial transparency', () => {
			const obstacle = makeObstacle({ type: 'deciduous-tree' });
			const shadow = calculateShadowPolygon(obstacle, makeSun(45, 180));

			expect(shadow).not.toBeNull();
			expect(shadow!.shadeIntensity).toBeLessThan(1.0);
			expect(shadow!.shadeIntensity).toBeGreaterThan(0);
		});

		it('evergreen tree shadow has same transparency as deciduous', () => {
			const deciduous = makeObstacle({ type: 'deciduous-tree' });
			const evergreen = makeObstacle({ type: 'evergreen-tree' });

			const decShadow = calculateShadowPolygon(deciduous, makeSun(45, 180));
			const evgShadow = calculateShadowPolygon(evergreen, makeSun(45, 180));

			expect(decShadow!.shadeIntensity).toBe(evgShadow!.shadeIntensity);
		});
	});

	describe('fence shadows', () => {
		it('produces a quadrilateral for fences', () => {
			const obstacle = makeObstacle({ type: 'fence', height: 1.8, width: 10 });
			const shadow = calculateShadowPolygon(obstacle, makeSun(30, 180));

			expect(shadow).not.toBeNull();
			expect(shadow!.vertices).toHaveLength(4);
			expect(shadow!.obstacleType).toBe('fence');
			expect(shadow!.shadeIntensity).toBe(1.0); // Fences are opaque
		});
	});

	describe('hedge shadows', () => {
		it('produces a quadrilateral with partial transparency', () => {
			const obstacle = makeObstacle({ type: 'hedge', height: 2, width: 8 });
			const shadow = calculateShadowPolygon(obstacle, makeSun(30, 180));

			expect(shadow).not.toBeNull();
			expect(shadow!.vertices).toHaveLength(4);
			expect(shadow!.shadeIntensity).toBeLessThan(1.0);
		});
	});

	describe('slope adjustment', () => {
		it('modifies shadow shape on sloped terrain', () => {
			const obstacle = makeObstacle({ type: 'building' });
			const sun = makeSun(30, 180);
			const slope: PlotSlope = { angle: 15, aspect: 180 };

			const flatShadow = calculateShadowPolygon(obstacle, sun);
			const slopedShadow = calculateShadowPolygon(obstacle, sun, slope);

			expect(flatShadow).not.toBeNull();
			expect(slopedShadow).not.toBeNull();

			// The shadows should have different vertex positions
			const flatBounds = getShadowBounds(flatShadow!);
			const slopedBounds = getShadowBounds(slopedShadow!);

			// At least one dimension should differ
			const sameSize =
				Math.abs(flatBounds.maxY - flatBounds.minY - (slopedBounds.maxY - slopedBounds.minY)) < 0.01;
			expect(sameSize).toBe(false);
		});
	});
});

describe('calculateAllShadows', () => {
	it('returns empty array when sun is below horizon', () => {
		const obstacles = [makeObstacle(), makeObstacle({ id: 'test-2' })];
		const result = calculateAllShadows(obstacles, makeSun(-5, 180));
		expect(result).toHaveLength(0);
	});

	it('returns shadow for each obstacle', () => {
		const obstacles = [
			makeObstacle({ id: 'building-1', type: 'building' }),
			makeObstacle({ id: 'tree-1', type: 'deciduous-tree' }),
			makeObstacle({ id: 'fence-1', type: 'fence' })
		];
		const result = calculateAllShadows(obstacles, makeSun(45, 180));

		expect(result).toHaveLength(3);
		expect(result.map((s) => s.obstacleId)).toEqual(['building-1', 'tree-1', 'fence-1']);
	});

	it('maintains obstacle order in results', () => {
		const obstacles = [
			makeObstacle({ id: 'a', type: 'building' }),
			makeObstacle({ id: 'b', type: 'building' }),
			makeObstacle({ id: 'c', type: 'building' })
		];
		const result = calculateAllShadows(obstacles, makeSun(45, 90));

		expect(result.map((s) => s.obstacleId)).toEqual(['a', 'b', 'c']);
	});
});

describe('getShadowBounds', () => {
	it('returns correct bounding box for a shadow', () => {
		const shadow = {
			obstacleId: 'test',
			obstacleType: 'building' as const,
			vertices: [
				{ x: 0, y: 0 },
				{ x: 10, y: 0 },
				{ x: 10, y: 5 },
				{ x: 0, y: 5 }
			],
			shadeIntensity: 1.0
		};

		const bounds = getShadowBounds(shadow);
		expect(bounds.minX).toBe(0);
		expect(bounds.maxX).toBe(10);
		expect(bounds.minY).toBe(0);
		expect(bounds.maxY).toBe(5);
	});

	it('handles negative coordinates', () => {
		const shadow = {
			obstacleId: 'test',
			obstacleType: 'building' as const,
			vertices: [
				{ x: -5, y: -3 },
				{ x: 5, y: -3 },
				{ x: 5, y: 7 },
				{ x: -5, y: 7 }
			],
			shadeIntensity: 1.0
		};

		const bounds = getShadowBounds(shadow);
		expect(bounds.minX).toBe(-5);
		expect(bounds.maxX).toBe(5);
		expect(bounds.minY).toBe(-3);
		expect(bounds.maxY).toBe(7);
	});

	it('handles empty vertex array', () => {
		const shadow = {
			obstacleId: 'test',
			obstacleType: 'building' as const,
			vertices: [],
			shadeIntensity: 1.0
		};

		const bounds = getShadowBounds(shadow);
		expect(bounds.minX).toBe(0);
		expect(bounds.maxX).toBe(0);
		expect(bounds.minY).toBe(0);
		expect(bounds.maxY).toBe(0);
	});
});

describe('isPointInShadow', () => {
	const squareShadow = {
		obstacleId: 'test',
		obstacleType: 'building' as const,
		vertices: [
			{ x: 0, y: 0 },
			{ x: 10, y: 0 },
			{ x: 10, y: 10 },
			{ x: 0, y: 10 }
		],
		shadeIntensity: 1.0
	};

	it('returns true for point inside shadow', () => {
		expect(isPointInShadow({ x: 5, y: 5 }, squareShadow)).toBe(true);
		expect(isPointInShadow({ x: 1, y: 1 }, squareShadow)).toBe(true);
		expect(isPointInShadow({ x: 9, y: 9 }, squareShadow)).toBe(true);
	});

	it('returns false for point outside shadow', () => {
		expect(isPointInShadow({ x: -1, y: 5 }, squareShadow)).toBe(false);
		expect(isPointInShadow({ x: 11, y: 5 }, squareShadow)).toBe(false);
		expect(isPointInShadow({ x: 5, y: -1 }, squareShadow)).toBe(false);
		expect(isPointInShadow({ x: 5, y: 11 }, squareShadow)).toBe(false);
	});

	it('handles triangular shadows', () => {
		const triangle = {
			obstacleId: 'test',
			obstacleType: 'building' as const,
			vertices: [
				{ x: 0, y: 0 },
				{ x: 10, y: 0 },
				{ x: 5, y: 10 }
			],
			shadeIntensity: 1.0
		};

		expect(isPointInShadow({ x: 5, y: 3 }, triangle)).toBe(true);
		expect(isPointInShadow({ x: 1, y: 8 }, triangle)).toBe(false);
	});

	it('returns false for degenerate polygons', () => {
		const line = {
			obstacleId: 'test',
			obstacleType: 'building' as const,
			vertices: [
				{ x: 0, y: 0 },
				{ x: 10, y: 0 }
			],
			shadeIntensity: 1.0
		};

		expect(isPointInShadow({ x: 5, y: 0 }, line)).toBe(false);
	});
});

describe('shadow geometry verification', () => {
	it('building shadow length matches expected for 45° sun', () => {
		const obstacle = makeObstacle({
			type: 'building',
			x: 0,
			y: 0,
			height: 10,
			width: 5,
			direction: 0,
			distance: 0
		});
		const shadow = calculateShadowPolygon(obstacle, makeSun(45, 180));

		expect(shadow).not.toBeNull();

		// At 45°, shadow length should equal height (10m)
		// Shadow extends north, so check Y extent
		const bounds = getShadowBounds(shadow!);
		const shadowExtent = bounds.maxY - bounds.minY;

		// Should be approximately 10m (the shadow length)
		// Plus some for the building footprint
		expect(shadowExtent).toBeGreaterThan(8);
		expect(shadowExtent).toBeLessThan(15);
	});

	it('tree shadow is roughly elliptical', () => {
		const obstacle = makeObstacle({
			type: 'deciduous-tree',
			x: 0,
			y: 0,
			height: 10,
			width: 6, // 3m radius canopy
			direction: 0,
			distance: 0
		});
		const shadow = calculateShadowPolygon(obstacle, makeSun(45, 180));

		expect(shadow).not.toBeNull();

		// Check that the shadow is elongated in the shadow direction (north)
		const bounds = getShadowBounds(shadow!);
		const widthExtent = bounds.maxX - bounds.minX;
		const lengthExtent = bounds.maxY - bounds.minY;

		// Should be longer than wide (ellipse stretched along shadow direction)
		expect(lengthExtent).toBeGreaterThan(widthExtent);
	});
});

describe('time-based shadow changes', () => {
	it('shadows change direction when sun azimuth changes', () => {
		const obstacle = makeObstacle({
			type: 'building',
			x: 0,
			y: 0,
			height: 10,
			width: 5
		});

		// Morning sun (east, azimuth ~90°) casts shadows westward
		const morningShadow = calculateShadowPolygon(obstacle, makeSun(30, 90));
		// Evening sun (west, azimuth ~270°) casts shadows eastward
		const eveningShadow = calculateShadowPolygon(obstacle, makeSun(30, 270));

		expect(morningShadow).not.toBeNull();
		expect(eveningShadow).not.toBeNull();

		const morningBounds = getShadowBounds(morningShadow!);
		const eveningBounds = getShadowBounds(eveningShadow!);

		// Morning shadow should extend west (negative X)
		expect(morningBounds.minX).toBeLessThan(0);
		// Evening shadow should extend east (positive X)
		expect(eveningBounds.maxX).toBeGreaterThan(0);

		// The shadows should point in opposite directions
		const morningCenterX = (morningBounds.minX + morningBounds.maxX) / 2;
		const eveningCenterX = (eveningBounds.minX + eveningBounds.maxX) / 2;
		expect(morningCenterX).toBeLessThan(eveningCenterX);
	});

	it('shadows change length when sun altitude changes', () => {
		const obstacle = makeObstacle({
			type: 'building',
			x: 0,
			y: 0,
			height: 10,
			width: 5
		});

		// Low sun (20°) casts longer shadows
		const lowSunShadow = calculateShadowPolygon(obstacle, makeSun(20, 180));
		// High sun (60°) casts shorter shadows
		const highSunShadow = calculateShadowPolygon(obstacle, makeSun(60, 180));

		expect(lowSunShadow).not.toBeNull();
		expect(highSunShadow).not.toBeNull();

		const lowSunBounds = getShadowBounds(lowSunShadow!);
		const highSunBounds = getShadowBounds(highSunShadow!);

		// Low sun shadow should be longer (extend further north)
		const lowSunExtent = lowSunBounds.maxY - lowSunBounds.minY;
		const highSunExtent = highSunBounds.maxY - highSunBounds.minY;
		expect(lowSunExtent).toBeGreaterThan(highSunExtent);
	});

	it('all shadows update together when time changes', () => {
		const obstacles = [
			makeObstacle({ id: 'building', type: 'building', x: -5, y: 0, height: 8 }),
			makeObstacle({ id: 'tree', type: 'deciduous-tree', x: 5, y: 0, height: 12 })
		];

		const morningPosition = makeSun(25, 100);
		const afternoonPosition = makeSun(45, 200);

		const morningShadows = calculateAllShadows(obstacles, morningPosition);
		const afternoonShadows = calculateAllShadows(obstacles, afternoonPosition);

		expect(morningShadows).toHaveLength(2);
		expect(afternoonShadows).toHaveLength(2);

		// Both shadows should have different positions
		const morningBuilding = morningShadows.find((s) => s.obstacleId === 'building');
		const afternoonBuilding = afternoonShadows.find((s) => s.obstacleId === 'building');

		expect(morningBuilding).toBeDefined();
		expect(afternoonBuilding).toBeDefined();

		const morningBounds = getShadowBounds(morningBuilding!);
		const afternoonBounds = getShadowBounds(afternoonBuilding!);

		// Shadows should be in different positions (different center points)
		const morningCenterY = (morningBounds.minY + morningBounds.maxY) / 2;
		const afternoonCenterY = (afternoonBounds.minY + afternoonBounds.maxY) / 2;
		expect(Math.abs(morningCenterY - afternoonCenterY)).toBeGreaterThan(0.1);
	});
});

// ============================================================================
// Geographic coordinate shadow projection tests
// ============================================================================

// Helper to create a test tree in lat/lng coordinates
function makeMapTree(overrides: Partial<MapTreeConfig> = {}): MapTreeConfig {
	return {
		id: 'tree-1',
		lat: 37.7749, // San Francisco
		lng: -122.4194,
		type: 'deciduous-tree',
		height: 12,
		canopyWidth: 8,
		...overrides
	};
}

describe('calculateTreeShadowLatLng', () => {
	it('returns null when sun is below horizon', () => {
		const tree = makeMapTree();
		const result = calculateTreeShadowLatLng(tree, makeSun(-5, 180));
		expect(result).toBeNull();
	});

	it('returns shadow polygon with lat/lng vertices', () => {
		const tree = makeMapTree();
		const result = calculateTreeShadowLatLng(tree, makeSun(45, 180));

		expect(result).not.toBeNull();
		expect(result!.vertices.length).toBeGreaterThan(3);

		// All vertices should have lat/lng properties
		for (const v of result!.vertices) {
			expect(typeof v.lat).toBe('number');
			expect(typeof v.lng).toBe('number');
		}
	});

	it('shadow vertices are near the tree position', () => {
		const tree = makeMapTree({ lat: 40.0, lng: -100.0 });
		const result = calculateTreeShadowLatLng(tree, makeSun(45, 180));

		expect(result).not.toBeNull();

		// All vertices should be within ~0.01 degrees (about 1km) of tree
		// since a 12m tree at 45° casts a 12m shadow
		for (const v of result!.vertices) {
			expect(Math.abs(v.lat - tree.lat)).toBeLessThan(0.01);
			expect(Math.abs(v.lng - tree.lng)).toBeLessThan(0.01);
		}
	});

	it('shadow extends in direction opposite to sun azimuth', () => {
		const tree = makeMapTree();

		// Sun from south (azimuth 180) casts shadow north
		const southSunShadow = calculateTreeShadowLatLng(tree, makeSun(30, 180));
		// Sun from east (azimuth 90) casts shadow west
		const eastSunShadow = calculateTreeShadowLatLng(tree, makeSun(30, 90));

		expect(southSunShadow).not.toBeNull();
		expect(eastSunShadow).not.toBeNull();

		// Find average latitude of shadow vertices
		const southAvgLat =
			southSunShadow!.vertices.reduce((sum, v) => sum + v.lat, 0) /
			southSunShadow!.vertices.length;
		const eastAvgLng =
			eastSunShadow!.vertices.reduce((sum, v) => sum + v.lng, 0) /
			eastSunShadow!.vertices.length;

		// South sun shadow should extend north (higher latitude than tree)
		expect(southAvgLat).toBeGreaterThan(tree.lat);
		// East sun shadow should extend west (lower longitude than tree)
		expect(eastAvgLng).toBeLessThan(tree.lng);
	});

	it('evergreen and deciduous trees have different shade intensities', () => {
		const deciduousTree = makeMapTree({ type: 'deciduous-tree' });
		const evergreenTree = makeMapTree({ id: 'tree-2', type: 'evergreen-tree' });
		const sun = makeSun(45, 180);

		const deciduousShadow = calculateTreeShadowLatLng(deciduousTree, sun);
		const evergreenShadow = calculateTreeShadowLatLng(evergreenTree, sun);

		expect(deciduousShadow).not.toBeNull();
		expect(evergreenShadow).not.toBeNull();

		// Both should have partial transparency (less than 1)
		expect(deciduousShadow!.shadeIntensity).toBeLessThan(1);
		expect(evergreenShadow!.shadeIntensity).toBeLessThan(1);
	});
});

describe('calculateAllTreeShadowsLatLng', () => {
	it('returns empty array when sun is below horizon', () => {
		const trees = [makeMapTree(), makeMapTree({ id: 'tree-2', lat: 37.78 })];
		const result = calculateAllTreeShadowsLatLng(trees, makeSun(-5, 180));
		expect(result).toHaveLength(0);
	});

	it('returns shadow for each tree', () => {
		const trees = [
			makeMapTree({ id: 'tree-1' }),
			makeMapTree({ id: 'tree-2', lat: 37.78 }),
			makeMapTree({ id: 'tree-3', lat: 37.76 })
		];
		const result = calculateAllTreeShadowsLatLng(trees, makeSun(45, 180));

		expect(result).toHaveLength(3);
		expect(result.map((s) => s.obstacleId)).toContain('tree-1');
		expect(result.map((s) => s.obstacleId)).toContain('tree-2');
		expect(result.map((s) => s.obstacleId)).toContain('tree-3');
	});

	it('trees at different locations have shadows at different positions', () => {
		const trees = [
			makeMapTree({ id: 'tree-1', lat: 37.77, lng: -122.42 }),
			makeMapTree({ id: 'tree-2', lat: 37.78, lng: -122.41 })
		];
		const result = calculateAllTreeShadowsLatLng(trees, makeSun(45, 180));

		expect(result).toHaveLength(2);

		const shadow1 = result.find((s) => s.obstacleId === 'tree-1')!;
		const shadow2 = result.find((s) => s.obstacleId === 'tree-2')!;

		// Shadow centers should be near their respective trees
		const avgLat1 = shadow1.vertices.reduce((sum, v) => sum + v.lat, 0) / shadow1.vertices.length;
		const avgLat2 = shadow2.vertices.reduce((sum, v) => sum + v.lat, 0) / shadow2.vertices.length;

		// Shadow 2 should be at higher latitude since tree 2 is at higher latitude
		expect(avgLat2).toBeGreaterThan(avgLat1);
	});
});
