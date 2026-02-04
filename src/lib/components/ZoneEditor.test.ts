/**
 * Tests for ZoneEditor utility functions.
 */

import { describe, it, expect } from 'vitest';
import {
	classifyLightCategory,
	generateZoneName,
	calculateZoneArea,
	formatArea,
	LIGHT_THRESHOLDS,
	type Zone
} from './ZoneEditor.svelte';

describe('classifyLightCategory', () => {
	it('classifies 6+ hours as full-sun', () => {
		expect(classifyLightCategory(6)).toBe('full-sun');
		expect(classifyLightCategory(8)).toBe('full-sun');
		expect(classifyLightCategory(12)).toBe('full-sun');
	});

	it('classifies 4-6 hours as part-sun', () => {
		expect(classifyLightCategory(4)).toBe('part-sun');
		expect(classifyLightCategory(5)).toBe('part-sun');
		expect(classifyLightCategory(5.9)).toBe('part-sun');
	});

	it('classifies 2-4 hours as part-shade', () => {
		expect(classifyLightCategory(2)).toBe('part-shade');
		expect(classifyLightCategory(3)).toBe('part-shade');
		expect(classifyLightCategory(3.9)).toBe('part-shade');
	});

	it('classifies less than 2 hours as full-shade', () => {
		expect(classifyLightCategory(0)).toBe('full-shade');
		expect(classifyLightCategory(1)).toBe('full-shade');
		expect(classifyLightCategory(1.9)).toBe('full-shade');
	});
});

describe('generateZoneName', () => {
	it('generates Bed A for first zone', () => {
		expect(generateZoneName([])).toBe('Bed A');
	});

	it('generates Bed B when Bed A exists', () => {
		const zones: Zone[] = [
			{
				id: '1',
				name: 'Bed A',
				bounds: { north: 0, south: 0, east: 0, west: 0 },
				avgSunHours: 6,
				lightCategory: 'full-sun',
				plants: []
			}
		];
		expect(generateZoneName(zones)).toBe('Bed B');
	});

	it('fills gaps in the sequence', () => {
		const zones: Zone[] = [
			{
				id: '1',
				name: 'Bed A',
				bounds: { north: 0, south: 0, east: 0, west: 0 },
				avgSunHours: 6,
				lightCategory: 'full-sun',
				plants: []
			},
			{
				id: '2',
				name: 'Bed C',
				bounds: { north: 0, south: 0, east: 0, west: 0 },
				avgSunHours: 6,
				lightCategory: 'full-sun',
				plants: []
			}
		];
		expect(generateZoneName(zones)).toBe('Bed B');
	});

	it('ignores non-standard names', () => {
		const zones: Zone[] = [
			{
				id: '1',
				name: 'Custom Zone',
				bounds: { north: 0, south: 0, east: 0, west: 0 },
				avgSunHours: 6,
				lightCategory: 'full-sun',
				plants: []
			}
		];
		expect(generateZoneName(zones)).toBe('Bed A');
	});
});

describe('calculateZoneArea', () => {
	it('calculates area for a small zone near equator', () => {
		const bounds = {
			north: 0.001,
			south: 0,
			east: 0.001,
			west: 0
		};
		// At equator, 0.001 degrees ≈ 111 meters in both directions
		// So area should be roughly 111 * 111 ≈ 12321 m²
		const area = calculateZoneArea(bounds);
		expect(area).toBeGreaterThan(10000);
		expect(area).toBeLessThan(15000);
	});

	it('accounts for latitude in longitude calculation', () => {
		// At 45° latitude, longitude degrees are smaller
		const boundsEquator = {
			north: 0.001,
			south: 0,
			east: 0.001,
			west: 0
		};
		const bounds45 = {
			north: 45.001,
			south: 45,
			east: 0.001,
			west: 0
		};
		const areaEquator = calculateZoneArea(boundsEquator);
		const area45 = calculateZoneArea(bounds45);
		// At 45°, longitude degrees are cos(45°) ≈ 0.707 times as wide
		// So area should be smaller
		expect(area45).toBeLessThan(areaEquator);
		expect(area45).toBeGreaterThan(areaEquator * 0.5);
	});
});

describe('formatArea', () => {
	it('formats very small areas in cm²', () => {
		expect(formatArea(0.5)).toBe('5000 cm²');
		expect(formatArea(0.01)).toBe('100 cm²');
	});

	it('formats small areas in m² with one decimal', () => {
		expect(formatArea(1.5)).toBe('1.5 m²');
		expect(formatArea(50.3)).toBe('50.3 m²');
	});

	it('formats larger areas in m² as integers', () => {
		expect(formatArea(100)).toBe('100 m²');
		expect(formatArea(250.7)).toBe('251 m²');
	});
});

describe('LIGHT_THRESHOLDS', () => {
	it('has expected threshold values', () => {
		expect(LIGHT_THRESHOLDS.FULL_SUN).toBe(6);
		expect(LIGHT_THRESHOLDS.PART_SUN).toBe(4);
		expect(LIGHT_THRESHOLDS.PART_SHADE).toBe(2);
	});
});
