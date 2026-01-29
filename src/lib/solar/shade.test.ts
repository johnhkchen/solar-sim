/**
 * Tests for shadow intersection math.
 *
 * These tests verify the geometric calculations that determine when obstacles
 * block the sun. Coverage includes basic blocking scenarios, edge cases around
 * the north bearing (0/360 wraparound), partial transparency, and the aggregate
 * effective sunlight calculation.
 */

import { describe, it, expect } from 'vitest';
import { normalizeAngle, angularDifference, isBlocked, calculateEffectiveSunlight } from './shade.js';
import type { SolarPosition } from './types.js';
import type { Obstacle } from './shade-types.js';

describe('normalizeAngle', () => {
	it('returns angles already in range unchanged', () => {
		expect(normalizeAngle(0)).toBe(0);
		expect(normalizeAngle(90)).toBe(90);
		expect(normalizeAngle(180)).toBe(180);
		expect(normalizeAngle(270)).toBe(270);
		expect(normalizeAngle(359)).toBe(359);
	});

	it('wraps angles at or above 360', () => {
		expect(normalizeAngle(360)).toBe(0);
		expect(normalizeAngle(361)).toBe(1);
		expect(normalizeAngle(450)).toBe(90);
		expect(normalizeAngle(720)).toBe(0);
	});

	it('handles negative angles', () => {
		expect(normalizeAngle(-1)).toBe(359);
		expect(normalizeAngle(-90)).toBe(270);
		expect(normalizeAngle(-180)).toBe(180);
		expect(normalizeAngle(-360)).toBe(0);
		expect(normalizeAngle(-450)).toBe(270);
	});
});

describe('angularDifference', () => {
	it('calculates simple differences', () => {
		expect(angularDifference(0, 90)).toBe(90);
		expect(angularDifference(90, 0)).toBe(90);
		expect(angularDifference(45, 135)).toBe(90);
		expect(angularDifference(0, 180)).toBe(180);
	});

	it('handles wraparound at 360/0 correctly', () => {
		// 350 to 10 should be 20 degrees, not 340
		expect(angularDifference(350, 10)).toBe(20);
		expect(angularDifference(10, 350)).toBe(20);
		// 355 to 5 should be 10 degrees
		expect(angularDifference(355, 5)).toBe(10);
		// 1 to 359 should be 2 degrees
		expect(angularDifference(1, 359)).toBe(2);
	});

	it('returns 0 for identical angles', () => {
		expect(angularDifference(0, 0)).toBe(0);
		expect(angularDifference(180, 180)).toBe(0);
		expect(angularDifference(0, 360)).toBe(0);
	});

	it('handles negative input angles', () => {
		expect(angularDifference(-10, 10)).toBe(20);
		expect(angularDifference(-90, 90)).toBe(180);
	});
});

describe('isBlocked', () => {
	// Helper to create a basic obstacle
	const createObstacle = (overrides: Partial<Obstacle> = {}): Obstacle => ({
		id: 'test-obstacle',
		type: 'building',
		label: 'Test building',
		direction: 180, // due south
		distance: 10, // 10 meters
		height: 8, // 8 meters tall (2-story house)
		width: 12, // 12 meters wide
		...overrides
	});

	// Helper to create a basic sun position
	const createSunPosition = (
		altitude: number,
		azimuth: number
	): SolarPosition => ({
		altitude,
		azimuth,
		timestamp: new Date()
	});

	describe('sun below horizon', () => {
		it('returns not blocked when sun is below horizon', () => {
			const sun = createSunPosition(-5, 180);
			const obstacle = createObstacle();
			const result = isBlocked(sun, obstacle);
			expect(result.blocked).toBe(false);
			expect(result.shadeIntensity).toBe(0);
		});

		it('returns not blocked when sun is exactly at horizon', () => {
			const sun = createSunPosition(0, 180);
			const obstacle = createObstacle();
			const result = isBlocked(sun, obstacle);
			expect(result.blocked).toBe(false);
			expect(result.shadeIntensity).toBe(0);
		});
	});

	describe('sun higher than obstacle', () => {
		it('returns not blocked when sun is clearly above obstacle', () => {
			// 8m building at 10m distance has angular height of atan(8/10) ≈ 38.7°
			// Sun at 60° is well above this
			const sun = createSunPosition(60, 180);
			const obstacle = createObstacle();
			const result = isBlocked(sun, obstacle);
			expect(result.blocked).toBe(false);
			expect(result.shadeIntensity).toBe(0);
		});

		it('returns not blocked when sun is just above obstacle angular height', () => {
			// Angular height is ~38.7°, sun at 40° should be clear
			const sun = createSunPosition(40, 180);
			const obstacle = createObstacle();
			const result = isBlocked(sun, obstacle);
			expect(result.blocked).toBe(false);
		});
	});

	describe('sun outside azimuth span', () => {
		it('returns not blocked when sun is in wrong direction', () => {
			// Obstacle is south (180°), sun is north (0°)
			const sun = createSunPosition(30, 0);
			const obstacle = createObstacle();
			const result = isBlocked(sun, obstacle);
			expect(result.blocked).toBe(false);
			expect(result.shadeIntensity).toBe(0);
		});

		it('returns not blocked when sun is just outside obstacle span', () => {
			// 12m wide obstacle at 10m has half-angular-width of atan(6/10) ≈ 31°
			// Obstacle at 180°, sun at 220° (40° off center) should be clear
			const sun = createSunPosition(30, 220);
			const obstacle = createObstacle();
			const result = isBlocked(sun, obstacle);
			expect(result.blocked).toBe(false);
		});
	});

	describe('blocking scenarios', () => {
		it('blocks when sun is directly behind opaque obstacle', () => {
			// Sun low (30°) and directly behind south-facing obstacle
			const sun = createSunPosition(30, 180);
			const obstacle = createObstacle();
			const result = isBlocked(sun, obstacle);
			expect(result.blocked).toBe(true);
			expect(result.shadeIntensity).toBe(1); // building is fully opaque
		});

		it('blocks when sun is at edge of obstacle span', () => {
			// Half-angular-width ≈ 31°, sun at 180+30 = 210° should be just inside
			const sun = createSunPosition(30, 210);
			const obstacle = createObstacle();
			const result = isBlocked(sun, obstacle);
			expect(result.blocked).toBe(true);
		});

		it('returns partial shade for semi-transparent obstacles', () => {
			// Deciduous tree has 40% transparency, so 60% shade
			const sun = createSunPosition(30, 180);
			const obstacle = createObstacle({ type: 'deciduous-tree' });
			const result = isBlocked(sun, obstacle);
			expect(result.blocked).toBe(true);
			expect(result.shadeIntensity).toBeCloseTo(0.6, 1);
		});

		it('returns appropriate shade for evergreen tree', () => {
			const sun = createSunPosition(30, 180);
			const obstacle = createObstacle({ type: 'evergreen-tree' });
			const result = isBlocked(sun, obstacle);
			expect(result.blocked).toBe(true);
			expect(result.shadeIntensity).toBeCloseTo(0.6, 1);
		});

		it('returns appropriate shade for hedge', () => {
			// Hedge has 30% transparency, so 70% shade
			const sun = createSunPosition(30, 180);
			const obstacle = createObstacle({ type: 'hedge' });
			const result = isBlocked(sun, obstacle);
			expect(result.blocked).toBe(true);
			expect(result.shadeIntensity).toBeCloseTo(0.7, 1);
		});
	});

	describe('north wraparound (0/360 boundary)', () => {
		it('blocks when obstacle is at north and sun is just east of north', () => {
			// Obstacle at 0° (north), sun at 10°
			const obstacle = createObstacle({ direction: 0 });
			const sun = createSunPosition(30, 10);
			const result = isBlocked(sun, obstacle);
			// Half-width ~31°, 10° diff should be blocked
			expect(result.blocked).toBe(true);
		});

		it('blocks when obstacle is at north and sun is just west of north', () => {
			// Obstacle at 0° (north), sun at 350°
			const obstacle = createObstacle({ direction: 0 });
			const sun = createSunPosition(30, 350);
			const result = isBlocked(sun, obstacle);
			expect(result.blocked).toBe(true);
		});

		it('does not block when sun is far from north-facing obstacle', () => {
			// Obstacle at 0° (north), sun at 90° (east)
			const obstacle = createObstacle({ direction: 0 });
			const sun = createSunPosition(30, 90);
			const result = isBlocked(sun, obstacle);
			expect(result.blocked).toBe(false);
		});

		it('handles obstacle at 359 degrees', () => {
			const obstacle = createObstacle({ direction: 359 });
			const sun = createSunPosition(30, 5);
			const result = isBlocked(sun, obstacle);
			// Diff is 6°, well within the ~31° half-width
			expect(result.blocked).toBe(true);
		});
	});

	describe('distance effects', () => {
		it('tall distant obstacle has small angular height', () => {
			// 8m building at 100m distance: atan(8/100) ≈ 4.6°
			// Sun at 10° should clear it
			const sun = createSunPosition(10, 180);
			const obstacle = createObstacle({ distance: 100 });
			const result = isBlocked(sun, obstacle);
			expect(result.blocked).toBe(false);
		});

		it('same building close up blocks more sky', () => {
			// 8m building at 5m distance: atan(8/5) ≈ 58°
			// Sun at 50° should be blocked
			const sun = createSunPosition(50, 180);
			const obstacle = createObstacle({ distance: 5 });
			const result = isBlocked(sun, obstacle);
			expect(result.blocked).toBe(true);
		});
	});
});

describe('calculateEffectiveSunlight', () => {
	const createSunPosition = (
		altitude: number,
		azimuth: number
	): SolarPosition => ({
		altitude,
		azimuth,
		timestamp: new Date()
	});

	const createObstacle = (overrides: Partial<Obstacle> = {}): Obstacle => ({
		id: 'test',
		type: 'building',
		label: 'Test',
		direction: 180,
		distance: 10,
		height: 8,
		width: 12,
		...overrides
	});

	it('returns 0 when sun is below horizon', () => {
		const sun = createSunPosition(-5, 180);
		const obstacles = [createObstacle()];
		expect(calculateEffectiveSunlight(sun, obstacles)).toBe(0);
	});

	it('returns 1 when no obstacles present', () => {
		const sun = createSunPosition(45, 180);
		expect(calculateEffectiveSunlight(sun, [])).toBe(1);
	});

	it('returns 1 when sun is not blocked by any obstacle', () => {
		const sun = createSunPosition(60, 0); // high sun, north direction
		const obstacles = [
			createObstacle({ direction: 180 }), // south
			createObstacle({ direction: 90 }) // east
		];
		expect(calculateEffectiveSunlight(sun, obstacles)).toBe(1);
	});

	it('returns 0 when blocked by opaque obstacle', () => {
		const sun = createSunPosition(30, 180);
		const obstacles = [createObstacle({ type: 'building' })];
		expect(calculateEffectiveSunlight(sun, obstacles)).toBe(0);
	});

	it('returns partial value for semi-transparent obstacle', () => {
		const sun = createSunPosition(30, 180);
		const obstacles = [createObstacle({ type: 'deciduous-tree' })];
		// 40% transparency = 60% shade = 0.4 effective sunlight
		expect(calculateEffectiveSunlight(sun, obstacles)).toBeCloseTo(0.4, 1);
	});

	it('uses maximum shade when multiple obstacles overlap', () => {
		const sun = createSunPosition(30, 180);
		const obstacles = [
			createObstacle({ id: 'tree', type: 'deciduous-tree', direction: 180 }), // 60% shade
			createObstacle({ id: 'hedge', type: 'hedge', direction: 180 }) // 70% shade
		];
		// Maximum shade wins, so effective sunlight is 1 - 0.7 = 0.3
		expect(calculateEffectiveSunlight(sun, obstacles)).toBeCloseTo(0.3, 1);
	});

	it('ignores non-blocking obstacles', () => {
		const sun = createSunPosition(30, 180);
		const obstacles = [
			createObstacle({ id: 'blocking', direction: 180 }), // blocks (south)
			createObstacle({ id: 'not-blocking', direction: 0 }) // doesn't block (north)
		];
		// Only the south building blocks, which is opaque
		expect(calculateEffectiveSunlight(sun, obstacles)).toBe(0);
	});

	it('handles many obstacles efficiently', () => {
		const sun = createSunPosition(45, 90); // east
		const obstacles: Obstacle[] = [];
		// Create 100 obstacles in all directions
		for (let i = 0; i < 100; i++) {
			obstacles.push(
				createObstacle({
					id: `obstacle-${i}`,
					direction: (i * 3.6) % 360
				})
			);
		}
		// Should complete quickly and return a valid number
		const result = calculateEffectiveSunlight(sun, obstacles);
		expect(result).toBeGreaterThanOrEqual(0);
		expect(result).toBeLessThanOrEqual(1);
	});
});
