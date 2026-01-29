/**
 * Tests for shade calculation types and presets.
 */

import { describe, it, expect } from 'vitest';
import {
	OBSTACLE_PRESETS,
	getTransparency,
	type ObstacleType
} from './shade-types.js';

describe('OBSTACLE_PRESETS', () => {
	it('should have at least 10 presets covering common obstacles', () => {
		expect(OBSTACLE_PRESETS.length).toBeGreaterThanOrEqual(10);
	});

	it('should have valid height values (positive and reasonable)', () => {
		for (const preset of OBSTACLE_PRESETS) {
			expect(preset.height).toBeGreaterThan(0);
			expect(preset.height).toBeLessThanOrEqual(50);
		}
	});

	it('should have valid width values (positive and reasonable)', () => {
		for (const preset of OBSTACLE_PRESETS) {
			expect(preset.width).toBeGreaterThan(0);
			expect(preset.width).toBeLessThanOrEqual(30);
		}
	});

	it('should include all obstacle types', () => {
		const types = new Set(OBSTACLE_PRESETS.map((p) => p.type));
		expect(types.has('building')).toBe(true);
		expect(types.has('fence')).toBe(true);
		expect(types.has('evergreen-tree')).toBe(true);
		expect(types.has('deciduous-tree')).toBe(true);
		expect(types.has('hedge')).toBe(true);
	});

	it('should have non-empty labels', () => {
		for (const preset of OBSTACLE_PRESETS) {
			expect(preset.label.length).toBeGreaterThan(0);
		}
	});
});

describe('getTransparency', () => {
	it('returns 0 for opaque obstacles (buildings and fences)', () => {
		expect(getTransparency('building')).toBe(0);
		expect(getTransparency('fence')).toBe(0);
	});

	it('returns 0.4 for trees (both evergreen and deciduous)', () => {
		expect(getTransparency('evergreen-tree')).toBe(0.4);
		expect(getTransparency('deciduous-tree')).toBe(0.4);
	});

	it('returns 0.3 for hedges', () => {
		expect(getTransparency('hedge')).toBe(0.3);
	});

	it('returns values between 0 and 1 for all known types', () => {
		const types: ObstacleType[] = [
			'building',
			'fence',
			'evergreen-tree',
			'deciduous-tree',
			'hedge'
		];
		for (const type of types) {
			const transparency = getTransparency(type);
			expect(transparency).toBeGreaterThanOrEqual(0);
			expect(transparency).toBeLessThanOrEqual(1);
		}
	});
});
