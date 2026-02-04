/**
 * Tests for PlanCanvas component and supporting utilities.
 */

import { describe, it, expect } from 'vitest';
import { feetToMeters, metersToFeet } from './PlanCanvas.svelte';
import { generatePlantCode, getSpacingStatus, PLANT_COLORS } from './PlantMarker.svelte';

describe('feetToMeters', () => {
	it('converts feet to meters correctly', () => {
		expect(feetToMeters(1)).toBeCloseTo(0.3048, 4);
		expect(feetToMeters(3)).toBeCloseTo(0.9144, 4);
		expect(feetToMeters(10)).toBeCloseTo(3.048, 3);
	});
});

describe('metersToFeet', () => {
	it('converts meters to feet correctly', () => {
		expect(metersToFeet(1)).toBeCloseTo(3.2808, 2);
		expect(metersToFeet(0.3048)).toBeCloseTo(1, 4);
		expect(metersToFeet(3)).toBeCloseTo(9.8425, 2);
	});

	it('is inverse of feetToMeters', () => {
		const feet = 5.5;
		const meters = feetToMeters(feet);
		expect(metersToFeet(meters)).toBeCloseTo(feet, 4);
	});
});

describe('generatePlantCode', () => {
	it('generates 2-letter code for single-word names', () => {
		expect(generatePlantCode('Tomato')).toBe('TO');
		expect(generatePlantCode('Basil')).toBe('BA');
		expect(generatePlantCode('Kale')).toBe('KA');
	});

	it('generates code from first letters of multi-word names', () => {
		expect(generatePlantCode('Bell Pepper')).toBe('BP');
		expect(generatePlantCode('Bush Beans')).toBe('BB');
		expect(generatePlantCode('Swiss Chard')).toBe('SC');
	});

	it('limits code to 3 characters for names with many words', () => {
		expect(generatePlantCode('Red Oak Leaf Lettuce')).toBe('ROL');
	});
});

describe('getSpacingStatus', () => {
	it('returns valid for 0% overlap', () => {
		expect(getSpacingStatus(0)).toBe('valid');
	});

	it('returns valid for overlap up to 20%', () => {
		expect(getSpacingStatus(10)).toBe('valid');
		expect(getSpacingStatus(20)).toBe('valid');
	});

	it('returns warning for overlap between 20% and 50%', () => {
		expect(getSpacingStatus(21)).toBe('warning');
		expect(getSpacingStatus(35)).toBe('warning');
		expect(getSpacingStatus(50)).toBe('warning');
	});

	it('returns error for overlap above 50%', () => {
		expect(getSpacingStatus(51)).toBe('error');
		expect(getSpacingStatus(75)).toBe('error');
		expect(getSpacingStatus(100)).toBe('error');
	});
});

describe('PLANT_COLORS', () => {
	it('has colors for all plant categories', () => {
		expect(PLANT_COLORS.vegetable).toBeDefined();
		expect(PLANT_COLORS.herb).toBeDefined();
		expect(PLANT_COLORS.flower).toBeDefined();
	});

	it('returns hex color values', () => {
		expect(PLANT_COLORS.vegetable).toMatch(/^#[0-9a-f]{6}$/i);
		expect(PLANT_COLORS.herb).toMatch(/^#[0-9a-f]{6}$/i);
		expect(PLANT_COLORS.flower).toMatch(/^#[0-9a-f]{6}$/i);
	});
});
