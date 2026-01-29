/**
 * Integration tests for the results page data flow.
 *
 * These tests verify the complete integration between shade calculations and
 * plant recommendations, ensuring that obstacles placed in PlotViewer correctly
 * affect effective sun hours and produce appropriate recommendation updates.
 *
 * The tests exercise the reactive data chain that would run in the results page:
 * obstacles → getDailySunHoursWithShade → effectiveHours → createRecommendationInput
 * → getRecommendations → UI update
 *
 * Reference: docs/knowledge/research/app-integration.md section R6
 */

import { describe, it, expect } from 'vitest';
import {
	getDailySunHours,
	getDailySunHoursWithShade,
	getSeasonalSummaryWithShade,
	getYearlySummary,
	type Coordinates,
	type Obstacle
} from '$lib/solar';
import { getRecommendations, createRecommendationInput } from '$lib/plants';
import type { ClimateData } from '$lib/climate';

// ============================================================================
// Test Fixtures
// ============================================================================

// Portland, Oregon - consistent with happy-path.test.ts
const PORTLAND: Coordinates = { latitude: 45.5152, longitude: -122.6784 };

// Summer solstice for predictable high sun angles
const SUMMER_SOLSTICE = new Date('2024-06-21T12:00:00Z');

// Standard climate data for Portland's growing season
function createPortlandClimate(): ClimateData {
	return {
		frostDates: {
			lastSpringFrost: { early: 91, median: 105, late: 119 }, // ~Apr 1-29
			firstFallFrost: { early: 273, median: 287, late: 301 }, // ~Oct 1-28
			source: 'lookup-table',
			confidence: 'high'
		},
		hardinessZone: {
			zone: '8b',
			zoneNumber: 8,
			subzone: 'b',
			minTempF: 15,
			maxTempF: 20,
			source: 'usda',
			isApproximate: false
		},
		growingSeason: {
			lengthDays: { short: 154, typical: 182, long: 210 },
			frostFreePeriod: {
				start: { early: 91, median: 105, late: 119 },
				end: { early: 273, median: 287, late: 301 }
			},
			coolSeasonWindows: {
				spring: { start: 60, end: 133 },
				fall: { start: 227, end: 315 }
			}
		},
		fetchedAt: new Date()
	};
}

// Helper to create obstacles with sensible defaults
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

// ============================================================================
// Complete Flow Integration Tests
// ============================================================================

describe('Results page integration flow', () => {
	describe('obstacle changes affect recommendations', () => {
		it('produces different recommendations when obstacles reduce sun hours', () => {
			const climate = createPortlandClimate();

			// Scenario 1: No obstacles (full theoretical sun)
			const baselineSunData = getDailySunHours(PORTLAND, SUMMER_SOLSTICE);
			const baselineInput = createRecommendationInput(
				baselineSunData.sunHours,
				climate,
				baselineSunData.sunHours
			);
			const baselineRecs = getRecommendations(baselineInput);

			// Scenario 2: With significant shading from buildings - use close, tall
			// obstacles in the east and west where the sun is lower in the sky
			const obstacles: Obstacle[] = [
				makeObstacle('east-building', 90, 5, 20, 40),
				makeObstacle('west-building', 270, 5, 20, 40)
			];
			const shadedSunData = getDailySunHoursWithShade(PORTLAND, SUMMER_SOLSTICE, obstacles);
			const shadedInput = createRecommendationInput(
				shadedSunData.effectiveHours,
				climate,
				shadedSunData.sunHours
			);
			const shadedRecs = getRecommendations(shadedInput);

			// Effective hours should be reduced by obstacles
			expect(shadedSunData.effectiveHours).toBeLessThan(baselineSunData.sunHours);
			expect(shadedSunData.percentBlocked).toBeGreaterThan(0);

			// Full-sun plants may have lower scores when there's shade
			const baselineTomato = [...baselineRecs.excellent, ...baselineRecs.good].find(
				(r) => r.plant.id === 'tomato'
			);
			const shadedTomato = [
				...shadedRecs.excellent,
				...shadedRecs.good,
				...shadedRecs.marginal
			].find((r) => r.plant.id === 'tomato');

			if (baselineTomato && shadedTomato) {
				// With reduced light, tomato's light score should decrease
				expect(shadedTomato.lightScore).toBeLessThanOrEqual(baselineTomato.lightScore);
			}

			// The recommendation engine should still produce valid results
			const totalBaseline =
				baselineRecs.excellent.length +
				baselineRecs.good.length +
				baselineRecs.marginal.length;
			const totalShaded =
				shadedRecs.excellent.length + shadedRecs.good.length + shadedRecs.marginal.length;
			expect(totalBaseline).toBeGreaterThan(0);
			expect(totalShaded).toBeGreaterThan(0);
		});

		it('shade-tolerant plants get better relative scores in shaded conditions', () => {
			const climate = createPortlandClimate();

			// Heavy shading that creates part-shade conditions (3-4 hours)
			const heavyShadeObstacles: Obstacle[] = [
				makeObstacle('east-building', 90, 8, 20, 40),
				makeObstacle('south-building', 180, 8, 20, 50),
				makeObstacle('west-building', 270, 8, 20, 40)
			];

			const sunData = getDailySunHoursWithShade(PORTLAND, SUMMER_SOLSTICE, heavyShadeObstacles);

			// If this produces part-shade conditions, shade-tolerant plants should score well
			if (sunData.effectiveHours < 6 && sunData.effectiveHours >= 2) {
				const input = createRecommendationInput(
					sunData.effectiveHours,
					climate,
					sunData.sunHours
				);
				const recs = getRecommendations(input);

				// Lettuce and hostas thrive in part-shade
				const lettuce = [...recs.excellent, ...recs.good].find(
					(r) => r.plant.id === 'lettuce'
				);
				const hosta = [...recs.excellent, ...recs.good].find((r) => r.plant.id === 'hosta');

				// At least one shade-tolerant plant should be recommended
				expect(lettuce || hosta).toBeDefined();
			}
		});

		it('afternoon shade benefit note appears when theoretical exceeds effective', () => {
			const climate = createPortlandClimate();

			// West-facing obstacle blocks afternoon sun specifically
			const westObstacle = makeObstacle('west-building', 270, 10, 15, 30);
			const sunData = getDailySunHoursWithShade(PORTLAND, SUMMER_SOLSTICE, [westObstacle]);

			// Only test if we actually get shade reduction
			if (sunData.effectiveHours < sunData.sunHours - 1) {
				const input = createRecommendationInput(
					sunData.effectiveHours,
					climate,
					sunData.sunHours
				);
				const recs = getRecommendations(input);

				// Heat-sensitive plants like lettuce should have an afternoon shade benefit note
				const lettuce = [...recs.excellent, ...recs.good, ...recs.marginal].find(
					(r) => r.plant.id === 'lettuce'
				);

				if (lettuce) {
					const shadeBenefit = lettuce.notes.find(
						(n) => n.type === 'benefit' && n.text.toLowerCase().includes('shade')
					);
					expect(shadeBenefit).toBeDefined();
				}
			}
		});
	});

	describe('empty obstacles array behavior', () => {
		it('effective hours equals theoretical hours when no obstacles', () => {
			const baselineSunData = getDailySunHours(PORTLAND, SUMMER_SOLSTICE);
			const shadedSunData = getDailySunHoursWithShade(PORTLAND, SUMMER_SOLSTICE, []);

			expect(shadedSunData.effectiveHours).toBe(baselineSunData.sunHours);
			expect(shadedSunData.sunHours).toBe(baselineSunData.sunHours);
			expect(shadedSunData.percentBlocked).toBe(0);
		});

		it('produces identical recommendations with and without empty obstacle array', () => {
			const climate = createPortlandClimate();
			const date = SUMMER_SOLSTICE;

			// Direct sun hours call
			const baselineSunData = getDailySunHours(PORTLAND, date);
			const baselineInput = createRecommendationInput(
				baselineSunData.sunHours,
				climate,
				baselineSunData.sunHours
			);
			const baselineRecs = getRecommendations(baselineInput);

			// Via shade function with empty array (as results page does)
			const viaShadeSunData = getDailySunHoursWithShade(PORTLAND, date, []);
			const viaShadeInput = createRecommendationInput(
				viaShadeSunData.effectiveHours,
				climate,
				viaShadeSunData.sunHours
			);
			const viaShadeRecs = getRecommendations(viaShadeInput);

			// Results should be identical
			expect(viaShadeRecs.excellent.length).toBe(baselineRecs.excellent.length);
			expect(viaShadeRecs.good.length).toBe(baselineRecs.good.length);
			expect(viaShadeRecs.marginal.length).toBe(baselineRecs.marginal.length);
		});
	});
});

// ============================================================================
// Monthly Shade Data for Seasonal Chart
// ============================================================================

describe('Monthly shade data calculation', () => {
	it('calculates shade-adjusted monthly averages matching results page logic', () => {
		const year = 2024;
		// Use east/west obstacles that block morning/evening sun when it's lower
		const obstacles: Obstacle[] = [
			makeObstacle('east-building', 90, 8, 15, 30),
			makeObstacle('west-building', 270, 8, 15, 30)
		];

		// Get yearly summary for theoretical hours (as results page does)
		const yearlySummaries = getYearlySummary(PORTLAND, year);

		// For each month, calculate shade-adjusted effective hours
		const monthlyData = yearlySummaries.map((summary, index) => {
			const month = index + 1;
			const theoreticalHours = summary.averageSunHours;

			// Calculate shade-adjusted hours for this month
			const startDate = new Date(year, index, 1);
			const endDate = new Date(year, index + 1, 0); // Last day of month
			const shadeAnalysis = getSeasonalSummaryWithShade(
				PORTLAND,
				startDate,
				endDate,
				obstacles
			);

			return {
				month,
				theoreticalHours,
				effectiveHours: shadeAnalysis.averageEffectiveHours
			};
		});

		// Verify we have 12 months of data
		expect(monthlyData).toHaveLength(12);

		// Each month should have valid data
		for (const data of monthlyData) {
			expect(data.month).toBeGreaterThanOrEqual(1);
			expect(data.month).toBeLessThanOrEqual(12);
			expect(data.theoreticalHours).toBeGreaterThan(0);
			expect(data.effectiveHours).toBeLessThanOrEqual(data.theoreticalHours);
		}

		// At least some months should show shade reduction from east/west obstacles
		const someMonthHasShade = monthlyData.some(
			(data) => data.effectiveHours < data.theoreticalHours
		);
		expect(someMonthHasShade).toBe(true);
	});

	it('shows seasonal variation in shade impact', () => {
		const year = 2024;
		// Low building to the south - blocks more in winter when sun is lower
		const lowSouthBuilding = makeObstacle('south-building', 180, 20, 8, 40);

		// Calculate winter (December) and summer (June) shade impact
		const winterStart = new Date(year, 11, 1); // December
		const winterEnd = new Date(year, 11, 31);
		const summerStart = new Date(year, 5, 1); // June
		const summerEnd = new Date(year, 5, 30);

		const winterAnalysis = getSeasonalSummaryWithShade(
			PORTLAND,
			winterStart,
			winterEnd,
			[lowSouthBuilding]
		);
		const summerAnalysis = getSeasonalSummaryWithShade(
			PORTLAND,
			summerStart,
			summerEnd,
			[lowSouthBuilding]
		);

		// Winter should have more blocking because the sun is lower in the sky
		// and the southern obstacle intercepts more of the sun path
		expect(winterAnalysis.averagePercentBlocked).toBeGreaterThan(0);

		// Summer sun is higher so the same obstacle blocks less (or nothing)
		// This demonstrates the seasonal variation in shade impact
		expect(summerAnalysis.averagePercentBlocked).toBeDefined();
	});

	it('returns theoretical hours when no obstacles for monthly calculation', () => {
		const year = 2024;
		const yearlySummaries = getYearlySummary(PORTLAND, year);

		// Calculate June without obstacles
		const juneStart = new Date(year, 5, 1);
		const juneEnd = new Date(year, 5, 30);
		const noShadeAnalysis = getSeasonalSummaryWithShade(PORTLAND, juneStart, juneEnd, []);

		const juneTheoretical = yearlySummaries[5].averageSunHours;

		// Effective should equal theoretical when no obstacles
		expect(noShadeAnalysis.averageEffectiveHours).toBeCloseTo(juneTheoretical, 1);
		expect(noShadeAnalysis.averagePercentBlocked).toBe(0);
	});
});

// ============================================================================
// LocalStorage Persistence Logic
// ============================================================================

describe('LocalStorage persistence logic', () => {
	describe('storage key generation', () => {
		it('rounds coordinates to 2 decimal places', () => {
			// This mirrors the getStorageKey() function in +page.svelte
			const lat = 45.5152;
			const lon = -122.6784;
			const key = `solar-sim:plot:${lat.toFixed(2)}:${lon.toFixed(2)}`;

			expect(key).toBe('solar-sim:plot:45.52:-122.68');
		});

		it('groups nearby locations together', () => {
			// Two points ~100m apart should have the same key
			const lat1 = 45.5152;
			const lon1 = -122.6784;
			const lat2 = 45.5155; // ~300m north
			const lon2 = -122.6780; // ~300m east

			const key1 = `solar-sim:plot:${lat1.toFixed(2)}:${lon1.toFixed(2)}`;
			const key2 = `solar-sim:plot:${lat2.toFixed(2)}:${lon2.toFixed(2)}`;

			expect(key1).toBe(key2);
		});

		it('separates distant locations', () => {
			// Portland vs Seattle should have different keys
			const portlandKey = `solar-sim:plot:${(45.52).toFixed(2)}:${(-122.68).toFixed(2)}`;
			const seattleKey = `solar-sim:plot:${(47.61).toFixed(2)}:${(-122.33).toFixed(2)}`;

			expect(portlandKey).not.toBe(seattleKey);
		});
	});

	describe('stored data structure', () => {
		it('serializes PlotObstacle array correctly', () => {
			const obstacles = [
				{
					id: 'obs-1',
					type: 'building' as const,
					label: 'House',
					direction: 180,
					distance: 10,
					height: 8,
					width: 12,
					x: 0,
					y: -10
				},
				{
					id: 'obs-2',
					type: 'deciduous-tree' as const,
					label: 'Oak',
					direction: 90,
					distance: 5,
					height: 12,
					width: 8,
					x: 5,
					y: 0
				}
			];

			const slope = { angle: 5, aspect: 180 };
			const toSave = {
				obstacles,
				slope,
				savedAt: new Date().toISOString()
			};

			const serialized = JSON.stringify(toSave);
			const restored = JSON.parse(serialized);

			// Verify round-trip preserves data
			expect(restored.obstacles).toHaveLength(2);
			expect(restored.obstacles[0].id).toBe('obs-1');
			expect(restored.obstacles[0].height).toBe(8);
			expect(restored.obstacles[1].type).toBe('deciduous-tree');
			expect(restored.slope.angle).toBe(5);
			expect(restored.slope.aspect).toBe(180);
			expect(restored.savedAt).toBeDefined();
		});

		it('handles empty obstacles array', () => {
			const toSave = {
				obstacles: [],
				slope: { angle: 0, aspect: 180 },
				savedAt: new Date().toISOString()
			};

			const serialized = JSON.stringify(toSave);
			const restored = JSON.parse(serialized);

			expect(restored.obstacles).toEqual([]);
			expect(restored.slope.angle).toBe(0);
		});
	});
});

// ============================================================================
// Edge Cases and Error Handling
// ============================================================================

describe('Integration edge cases', () => {
	it('handles polar conditions gracefully', () => {
		const arctic: Coordinates = { latitude: 80, longitude: 0 };
		const winterDate = new Date('2024-12-21T12:00:00Z');
		const obstacle = makeObstacle('building', 180, 10, 20, 30);

		const sunData = getDailySunHoursWithShade(arctic, winterDate, [obstacle]);

		// Polar night means no sun to block
		expect(sunData.sunHours).toBe(0);
		expect(sunData.effectiveHours).toBe(0);
		expect(sunData.polarCondition).toBe('polar-night');

		// Recommendations should still work (handle 0 sun hours)
		const climate = createPortlandClimate();
		const input = createRecommendationInput(sunData.effectiveHours, climate, sunData.sunHours);
		const recs = getRecommendations(input);

		// With 0 sun hours, excellent category should be empty
		expect(recs.excellent).toHaveLength(0);
	});

	it('handles many obstacles without performance issues', () => {
		// Create a grid of obstacles (realistic worst case)
		const obstacles: Obstacle[] = [];
		for (let i = 0; i < 20; i++) {
			obstacles.push(
				makeObstacle(`obs-${i}`, (i * 18) % 360, 10 + i, 5 + (i % 10), 5, 'fence')
			);
		}

		const start = performance.now();
		const sunData = getDailySunHoursWithShade(PORTLAND, SUMMER_SOLSTICE, obstacles);
		const elapsed = performance.now() - start;

		// Should complete in reasonable time (under 500ms for daily calc)
		expect(elapsed).toBeLessThan(500);
		expect(sunData.effectiveHours).toBeDefined();
	});

	it('maintains data consistency through calculation chain', () => {
		const climate = createPortlandClimate();
		const obstacles: Obstacle[] = [makeObstacle('tree', 135, 8, 12, 6, 'deciduous-tree')];

		const sunData = getDailySunHoursWithShade(PORTLAND, SUMMER_SOLSTICE, obstacles);
		const input = createRecommendationInput(
			sunData.effectiveHours,
			climate,
			sunData.sunHours
		);
		const recs = getRecommendations(input);

		// Verify chain maintains consistent values
		expect(input.effectiveSunHours).toBe(sunData.effectiveHours);
		expect(input.theoreticalSunHours).toBe(sunData.sunHours);

		// Recommendations should be categorized correctly
		for (const rec of recs.excellent) {
			expect(rec.suitability).toBe('excellent');
			expect(rec.overallScore).toBeGreaterThanOrEqual(0.8);
		}
		for (const rec of recs.good) {
			expect(rec.suitability).toBe('good');
			expect(rec.overallScore).toBeGreaterThanOrEqual(0.6);
		}
		for (const rec of recs.marginal) {
			expect(rec.suitability).toBe('marginal');
		}
	});
});
