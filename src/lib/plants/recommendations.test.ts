/**
 * Tests for the plant recommendation engine.
 *
 * These tests verify that the engine correctly filters plants by light and
 * season requirements, handles edge cases like very short growing seasons
 * or deep shade, and generates appropriate contextual notes.
 */

import { describe, it, expect } from 'vitest';
import { getRecommendations, createRecommendationInput } from './recommendations.js';
import type { ClimateData } from '$lib/climate/index.js';
import type { RecommendationInput } from './types.js';

// ============================================================================
// Test Fixtures
// ============================================================================

function createTestClimateData(overrides: Partial<{
	seasonLength: number;
	lastSpringFrost: number;
	firstFallFrost: number;
}>): ClimateData {
	const seasonLength = overrides.seasonLength ?? 150;
	const lastSpringFrost = overrides.lastSpringFrost ?? 120; // ~May 1
	const firstFallFrost = overrides.firstFallFrost ?? 270; // ~Sep 27

	return {
		frostDates: {
			lastSpringFrost: {
				early: lastSpringFrost - 14,
				median: lastSpringFrost,
				late: lastSpringFrost + 14
			},
			firstFallFrost: {
				early: firstFallFrost - 14,
				median: firstFallFrost,
				late: firstFallFrost + 14
			},
			source: 'lookup-table',
			confidence: 'high'
		},
		hardinessZone: {
			zone: '7a',
			zoneNumber: 7,
			subzone: 'a',
			minTempF: 0,
			maxTempF: 5,
			source: 'usda',
			isApproximate: false
		},
		growingSeason: {
			lengthDays: {
				short: seasonLength - 28,
				typical: seasonLength,
				long: seasonLength + 28
			},
			frostFreePeriod: {
				start: {
					early: lastSpringFrost - 14,
					median: lastSpringFrost,
					late: lastSpringFrost + 14
				},
				end: {
					early: firstFallFrost - 14,
					median: firstFallFrost,
					late: firstFallFrost + 14
				}
			},
			coolSeasonWindows: {
				spring: { start: lastSpringFrost - 28, end: lastSpringFrost + 14 },
				fall: { start: firstFallFrost - 60, end: firstFallFrost + 14 }
			}
		},
		fetchedAt: new Date()
	};
}

// ============================================================================
// Light Filtering Tests
// ============================================================================

describe('getRecommendations light filtering', () => {
	const climate = createTestClimateData({ seasonLength: 180 });

	it('recommends full-sun plants for locations with 8+ hours of sun', () => {
		const input = createRecommendationInput(8, climate);
		const result = getRecommendations(input);

		// Tomatoes need 6+ hours and should be excellent with 8 hours
		const tomato = [...result.excellent, ...result.good].find(
			(r) => r.plant.id === 'tomato'
		);
		expect(tomato).toBeDefined();
		expect(tomato!.lightScore).toBeGreaterThan(0.9);
	});

	it('excludes full-sun plants from excellent/good in deep shade locations', () => {
		const input = createRecommendationInput(2, climate);
		const result = getRecommendations(input);

		// Tomatoes (need 6 hours) should not be in excellent or good categories
		const excellentOrGood = [...result.excellent, ...result.good];
		const tomato = excellentOrGood.find((r) => r.plant.id === 'tomato');
		expect(tomato).toBeUndefined();

		// Tomato might appear in marginal with a caution note about insufficient light
		const marginalTomato = result.marginal.find((r) => r.plant.id === 'tomato');
		if (marginalTomato) {
			const lightWarning = marginalTomato.notes.find(
				(n) => n.type === 'caution' && n.text.includes('sun')
			);
			expect(lightWarning).toBeDefined();
		}
	});

	it('recommends shade-tolerant plants for part-shade locations', () => {
		const input = createRecommendationInput(3, climate);
		const result = getRecommendations(input);

		// Lettuce needs only 3 hours and benefits from shade
		const lettuce = [...result.excellent, ...result.good].find(
			(r) => r.plant.id === 'lettuce'
		);
		expect(lettuce).toBeDefined();
		expect(lettuce!.lightScore).toBeGreaterThanOrEqual(0.7);
	});

	it('penalizes plants when sun hours exceed their maximum', () => {
		const input = createRecommendationInput(8, climate);
		const result = getRecommendations(input);

		// Lettuce has maxSunHours of 6, so 8 hours should lower its score
		const lettuce = [...result.excellent, ...result.good, ...result.marginal].find(
			(r) => r.plant.id === 'lettuce'
		);
		if (lettuce) {
			expect(lettuce.lightScore).toBeLessThan(1.0);
		}
	});

	it('recommends hostas for full shade', () => {
		const input = createRecommendationInput(1.5, climate);
		const result = getRecommendations(input);

		// Hostas thrive in shade (minSunHours: 1)
		const hosta = [...result.excellent, ...result.good].find(
			(r) => r.plant.id === 'hosta'
		);
		expect(hosta).toBeDefined();
	});
});

// ============================================================================
// Season Filtering Tests
// ============================================================================

describe('getRecommendations season filtering', () => {
	it('recommends quick-maturing plants for short seasons', () => {
		const climate = createTestClimateData({ seasonLength: 90 });
		const input = createRecommendationInput(6, climate);
		const result = getRecommendations(input);

		// Radishes mature in 22-30 days and should work in a short season
		const radishes = [...result.excellent, ...result.good].find(
			(r) => r.plant.id === 'radishes'
		);
		expect(radishes).toBeDefined();
		expect(radishes!.seasonScore).toBeGreaterThan(0.8);
	});

	it('penalizes slow plants in short seasons', () => {
		const climate = createTestClimateData({ seasonLength: 90 });
		const input = createRecommendationInput(8, climate);
		const result = getRecommendations(input);

		// Onions need 90-120 days and might struggle in a 90-day season
		const onions = [...result.excellent, ...result.good, ...result.marginal].find(
			(r) => r.plant.id === 'onions'
		);
		if (onions) {
			expect(onions.seasonScore).toBeLessThan(0.8);
		}
	});

	it('handles very short growing seasons', () => {
		const climate = createTestClimateData({ seasonLength: 60 });
		const input = createRecommendationInput(6, climate);
		const result = getRecommendations(input);

		// Very short seasons should still recommend fast crops
		const allRecommended = [...result.excellent, ...result.good, ...result.marginal];
		expect(allRecommended.length).toBeGreaterThan(0);

		// Radishes should still work
		const radishes = allRecommended.find((r) => r.plant.id === 'radishes');
		expect(radishes).toBeDefined();
	});
});

// ============================================================================
// Contextual Notes Tests
// ============================================================================

describe('getRecommendations contextual notes', () => {
	const climate = createTestClimateData({ seasonLength: 150 });

	it('adds afternoon shade benefit note for heat-sensitive plants', () => {
		// Location with shade reducing theoretical to effective hours
		const input: RecommendationInput = {
			effectiveSunHours: 4,
			theoreticalSunHours: 7,
			climate
		};
		const result = getRecommendations(input);

		// Lettuce benefits from afternoon shade
		const lettuce = [...result.excellent, ...result.good, ...result.marginal].find(
			(r) => r.plant.id === 'lettuce'
		);
		expect(lettuce).toBeDefined();
		const benefitNote = lettuce!.notes.find(
			(n) => n.type === 'benefit' && n.text.includes('shade')
		);
		expect(benefitNote).toBeDefined();
	});

	it('adds succession planting tip for applicable plants', () => {
		const input = createRecommendationInput(6, climate);
		const result = getRecommendations(input);

		// Radishes support succession planting
		const radishes = [...result.excellent, ...result.good, ...result.marginal].find(
			(r) => r.plant.id === 'radishes'
		);
		expect(radishes).toBeDefined();
		const successionNote = radishes!.notes.find(
			(n) => n.type === 'tip' && n.text.includes('weeks')
		);
		expect(successionNote).toBeDefined();
	});

	it('adds hardy plant benefit note', () => {
		const input = createRecommendationInput(6, climate);
		const result = getRecommendations(input);

		// Spinach is hardy
		const spinach = [...result.excellent, ...result.good, ...result.marginal].find(
			(r) => r.plant.id === 'spinach'
		);
		expect(spinach).toBeDefined();
		const hardyNote = spinach!.notes.find(
			(n) => n.type === 'benefit' && n.text.includes('frost')
		);
		expect(hardyNote).toBeDefined();
	});
});

// ============================================================================
// Planting Window Tests
// ============================================================================

describe('getRecommendations planting windows', () => {
	const climate = createTestClimateData({
		lastSpringFrost: 120, // ~May 1
		firstFallFrost: 270, // ~Sep 27
		seasonLength: 150
	});

	it('calculates spring planting window for tender plants', () => {
		const input = createRecommendationInput(8, climate);
		const result = getRecommendations(input);

		const tomato = [...result.excellent, ...result.good].find(
			(r) => r.plant.id === 'tomato'
		);
		expect(tomato).toBeDefined();
		expect(tomato!.plantingWindow.canPlantSpring).toBe(true);
		// Tender plants start after last frost
		expect(tomato!.plantingWindow.springStartDoy).toBeGreaterThanOrEqual(120);
	});

	it('allows earlier planting for hardy plants', () => {
		const input = createRecommendationInput(6, climate);
		const result = getRecommendations(input);

		const spinach = [...result.excellent, ...result.good].find(
			(r) => r.plant.id === 'spinach'
		);
		expect(spinach).toBeDefined();
		expect(spinach!.plantingWindow.canPlantSpring).toBe(true);
		// Hardy plants can start 4 weeks before last frost
		expect(spinach!.plantingWindow.springStartDoy).toBeLessThan(120);
	});

	it('enables fall planting for hardy plants with long season', () => {
		// Use a longer season to ensure fall planting window fits
		const longSeasonClimate = createTestClimateData({
			lastSpringFrost: 90, // ~Apr 1
			firstFallFrost: 300, // ~Oct 27
			seasonLength: 210
		});
		const input = createRecommendationInput(6, longSeasonClimate);
		const result = getRecommendations(input);

		// Radishes are fast-maturing hardy plants ideal for fall
		const radishes = [...result.excellent, ...result.good].find(
			(r) => r.plant.id === 'radishes'
		);
		expect(radishes).toBeDefined();
		// With a 210-day season and fast maturity, fall planting should work
		expect(radishes!.plantingWindow.canPlantFall).toBe(true);
	});
});

// ============================================================================
// Suitability Rating Tests
// ============================================================================

describe('getRecommendations suitability ratings', () => {
	it('groups plants by suitability', () => {
		const climate = createTestClimateData({ seasonLength: 150 });
		const input = createRecommendationInput(6, climate);
		const result = getRecommendations(input);

		// Should have plants in each category
		expect(result.excellent.length + result.good.length + result.marginal.length).toBeGreaterThan(0);

		// Each plant should have correct suitability matching its category
		result.excellent.forEach((r) => expect(r.suitability).toBe('excellent'));
		result.good.forEach((r) => expect(r.suitability).toBe('good'));
		result.marginal.forEach((r) => expect(r.suitability).toBe('marginal'));
	});

	it('generates a meaningful summary note', () => {
		const climate = createTestClimateData({ seasonLength: 150 });
		const input = createRecommendationInput(6, climate);
		const result = getRecommendations(input);

		expect(result.summaryNote).toBeTruthy();
		expect(result.summaryNote.length).toBeGreaterThan(20);
	});
});

// ============================================================================
// Edge Cases
// ============================================================================

describe('getRecommendations edge cases', () => {
	it('handles zero sun hours', () => {
		const climate = createTestClimateData({ seasonLength: 150 });
		const input = createRecommendationInput(0, climate);
		const result = getRecommendations(input);

		// Even with 0 sun hours, hostas might survive
		const total = result.excellent.length + result.good.length + result.marginal.length;
		// No plants thrive with zero sun
		expect(result.excellent.length).toBe(0);
	});

	it('handles extreme sun hours', () => {
		const climate = createTestClimateData({ seasonLength: 150 });
		const input = createRecommendationInput(14, climate);
		const result = getRecommendations(input);

		// Sun-loving plants should still be recommended
		const tomato = [...result.excellent, ...result.good].find(
			(r) => r.plant.id === 'tomato'
		);
		expect(tomato).toBeDefined();
	});

	it('handles very long growing season', () => {
		const climate = createTestClimateData({ seasonLength: 365 });
		const input = createRecommendationInput(8, climate);
		const result = getRecommendations(input);

		// All plants should have good season scores
		result.excellent.forEach((r) => {
			expect(r.seasonScore).toBeGreaterThanOrEqual(0.85);
		});
	});
});
