/**
 * Tests for light category classification with shade-aware support.
 *
 * These tests verify that categorization uses effective hours when available,
 * ensuring that shaded locations get appropriate plant recommendations.
 */

import { describe, it, expect } from 'vitest';
import {
	classifySunHours,
	getCategoryInfo,
	getEffectiveCategoryInfo,
	hasShadeDowngrade,
	getComparativeCategoryInfo,
	CATEGORIES,
	type LightCategory
} from './categories.js';

describe('classifySunHours', () => {
	it('classifies 6+ hours as full-sun', () => {
		expect(classifySunHours(6)).toBe('full-sun');
		expect(classifySunHours(8)).toBe('full-sun');
		expect(classifySunHours(12)).toBe('full-sun');
	});

	it('classifies 4-6 hours as part-sun', () => {
		expect(classifySunHours(4)).toBe('part-sun');
		expect(classifySunHours(5)).toBe('part-sun');
		expect(classifySunHours(5.9)).toBe('part-sun');
	});

	it('classifies 2-4 hours as part-shade', () => {
		expect(classifySunHours(2)).toBe('part-shade');
		expect(classifySunHours(3)).toBe('part-shade');
		expect(classifySunHours(3.9)).toBe('part-shade');
	});

	it('classifies <2 hours as full-shade', () => {
		expect(classifySunHours(0)).toBe('full-shade');
		expect(classifySunHours(1)).toBe('full-shade');
		expect(classifySunHours(1.9)).toBe('full-shade');
	});
});

describe('getCategoryInfo', () => {
	it('returns full category details for given sun hours', () => {
		const info = getCategoryInfo(8);

		expect(info.category).toBe('full-sun');
		expect(info.label).toBe('Full Sun');
		expect(info.description).toContain('tomatoes');
		expect(info.sunHoursRange).toBe('6+ hours');
	});

	it('returns correct info for each category', () => {
		expect(getCategoryInfo(7).category).toBe('full-sun');
		expect(getCategoryInfo(5).category).toBe('part-sun');
		expect(getCategoryInfo(3).category).toBe('part-shade');
		expect(getCategoryInfo(1).category).toBe('full-shade');
	});
});

describe('getEffectiveCategoryInfo', () => {
	it('uses effective hours when provided', () => {
		const info = getEffectiveCategoryInfo({
			theoreticalHours: 8,
			effectiveHours: 5
		});

		expect(info.category).toBe('part-sun');
		expect(info.label).toBe('Part Sun');
	});

	it('falls back to theoretical when effective is undefined', () => {
		const info = getEffectiveCategoryInfo({
			theoreticalHours: 8
		});

		expect(info.category).toBe('full-sun');
	});

	it('handles the ticket example: 8 theoretical, 5 effective = part-sun', () => {
		// "A location that theoretically gets 8 hours but loses 3 to shade
		// should be classified as part sun (5 hours effective), not full sun."
		const info = getEffectiveCategoryInfo({
			theoreticalHours: 8,
			effectiveHours: 5
		});

		expect(info.category).toBe('part-sun');
	});

	it('handles zero effective hours', () => {
		const info = getEffectiveCategoryInfo({
			theoreticalHours: 10,
			effectiveHours: 0
		});

		expect(info.category).toBe('full-shade');
	});

	it('handles effective equal to theoretical (no shade)', () => {
		const info = getEffectiveCategoryInfo({
			theoreticalHours: 7,
			effectiveHours: 7
		});

		expect(info.category).toBe('full-sun');
	});
});

describe('hasShadeDowngrade', () => {
	it('returns true when effective category is lower than theoretical', () => {
		expect(
			hasShadeDowngrade({
				theoreticalHours: 8,
				effectiveHours: 5
			})
		).toBe(true);

		expect(
			hasShadeDowngrade({
				theoreticalHours: 8,
				effectiveHours: 1
			})
		).toBe(true);
	});

	it('returns false when categories match', () => {
		expect(
			hasShadeDowngrade({
				theoreticalHours: 8,
				effectiveHours: 7
			})
		).toBe(false);

		expect(
			hasShadeDowngrade({
				theoreticalHours: 5,
				effectiveHours: 4.5
			})
		).toBe(false);
	});

	it('returns false when effective hours not provided', () => {
		expect(
			hasShadeDowngrade({
				theoreticalHours: 8
			})
		).toBe(false);
	});

	it('returns false when effective equals theoretical', () => {
		expect(
			hasShadeDowngrade({
				theoreticalHours: 8,
				effectiveHours: 8
			})
		).toBe(false);
	});
});

describe('getComparativeCategoryInfo', () => {
	it('returns both theoretical and effective categories', () => {
		const result = getComparativeCategoryInfo({
			theoreticalHours: 8,
			effectiveHours: 5
		});

		expect(result.theoretical.category).toBe('full-sun');
		expect(result.effective.category).toBe('part-sun');
		expect(result.hasDowngrade).toBe(true);
	});

	it('handles no shade case correctly', () => {
		const result = getComparativeCategoryInfo({
			theoreticalHours: 8,
			effectiveHours: 8
		});

		expect(result.theoretical.category).toBe('full-sun');
		expect(result.effective.category).toBe('full-sun');
		expect(result.hasDowngrade).toBe(false);
	});

	it('handles missing effective hours', () => {
		const result = getComparativeCategoryInfo({
			theoreticalHours: 8
		});

		expect(result.theoretical.category).toBe('full-sun');
		expect(result.effective.category).toBe('full-sun');
		expect(result.hasDowngrade).toBe(false);
	});
});

describe('CATEGORIES constant', () => {
	it('defines all four light categories', () => {
		const categories: LightCategory[] = ['full-sun', 'part-sun', 'part-shade', 'full-shade'];

		for (const cat of categories) {
			expect(CATEGORIES[cat]).toBeDefined();
			expect(CATEGORIES[cat].category).toBe(cat);
			expect(CATEGORIES[cat].label).toBeTruthy();
			expect(CATEGORIES[cat].description).toBeTruthy();
			expect(CATEGORIES[cat].sunHoursRange).toBeTruthy();
		}
	});
});
