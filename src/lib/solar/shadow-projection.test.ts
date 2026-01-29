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
	type PlotObstacle,
	type Point
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
		it('produces a quadrilateral for buildings', () => {
			const obstacle = makeObstacle({ type: 'building' });
			const shadow = calculateShadowPolygon(obstacle, makeSun(45, 180));

			expect(shadow).not.toBeNull();
			expect(shadow!.vertices).toHaveLength(4);
			expect(shadow!.obstacleType).toBe('building');
			expect(shadow!.shadeIntensity).toBe(1.0);
		});

		it('shadow extends north when sun is from south', () => {
			const obstacle = makeObstacle({ type: 'building', x: 0, y: 10 });
			const shadow = calculateShadowPolygon(obstacle, makeSun(45, 180));

			expect(shadow).not.toBeNull();
			// Shadow tips should be north of the building base
			const maxBaseY = Math.max(...shadow!.vertices.slice(0, 2).map((v) => v.y));
			const minShadowY = Math.min(...shadow!.vertices.slice(2).map((v) => v.y));
			expect(minShadowY).toBeGreaterThan(maxBaseY - 1);
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
