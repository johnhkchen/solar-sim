/**
 * Tests for the horticultural integration module.
 *
 * These tests verify that the integration between combined sun-hours calculation
 * and the plant recommendation engine works correctly, generating appropriate
 * tree-aware gardening guidance.
 */

import { describe, it, expect } from 'vitest';
import {
	createTreeAwareInput,
	generateTreeShadeNotes,
	generateShadeImpactSummary,
	getTreeAwareRecommendations,
	getRecommendationsFromSunHours,
	getPlantingGuidance,
	assessTreeManagementBenefit,
	type TreeAwareRecommendationInput
} from './horticultural-integration.js';
import type { ClimateData } from '$lib/climate/index.js';
import type { CombinedSunHoursResult, SunHoursBreakdown } from '$lib/solar/combined-sun-hours.js';
import type { MapTreeConfig } from '$lib/solar/shadow-projection.js';

// Test fixtures
const mockClimate: ClimateData = {
	frostDates: {
		lastSpringFrost: { early: 100, median: 110, late: 120 },
		firstFallFrost: { early: 270, median: 280, late: 290 },
		source: 'calculated',
		confidence: 'high'
	},
	hardinessZone: {
		zone: '7b',
		zoneNumber: 7,
		subzone: 'b',
		minTempF: 5,
		maxTempF: 10,
		source: 'calculated',
		isApproximate: false
	},
	growingSeason: {
		lengthDays: { short: 150, typical: 170, long: 190 },
		frostFreePeriod: {
			start: { early: 100, median: 110, late: 120 },
			end: { early: 270, median: 280, late: 290 }
		},
		coolSeasonWindows: { spring: null, fall: null }
	},
	fetchedAt: new Date()
};

const mockTrees: MapTreeConfig[] = [
	{
		position: { lat: 40.0, lng: -75.0 },
		height: 10,
		canopyRadius: 4,
		shadeType: 'deciduous'
	},
	{
		position: { lat: 40.001, lng: -75.001 },
		height: 8,
		canopyRadius: 3,
		shadeType: 'deciduous'
	}
];

function createMockSunHoursResult(breakdown: SunHoursBreakdown): CombinedSunHoursResult {
	return {
		date: new Date(),
		location: { lat: 40.0, lng: -75.0 },
		breakdown,
		sunriseTime: new Date(),
		sunsetTime: new Date(),
		shadeMapAvailable: false
	};
}

describe('createTreeAwareInput', () => {
	it('should create input from combined sun hours result', () => {
		const breakdown: SunHoursBreakdown = {
			theoretical: 14,
			terrainAndBuildingShadow: 0,
			treeShadow: 3,
			overlapShadow: 0,
			effective: 11
		};
		const sunHoursResult = createMockSunHoursResult(breakdown);

		const input = createTreeAwareInput(sunHoursResult, mockClimate, mockTrees);

		expect(input.effectiveSunHours).toBe(11);
		expect(input.theoreticalSunHours).toBe(14);
		expect(input.breakdown).toBe(breakdown);
		expect(input.treeCount).toBe(2);
		expect(input.averageTreeHeight).toBe(9); // (10 + 8) / 2
	});

	it('should handle zero trees', () => {
		const breakdown: SunHoursBreakdown = {
			theoretical: 14,
			terrainAndBuildingShadow: 0,
			treeShadow: 0,
			overlapShadow: 0,
			effective: 14
		};
		const sunHoursResult = createMockSunHoursResult(breakdown);

		const input = createTreeAwareInput(sunHoursResult, mockClimate, []);

		expect(input.treeCount).toBe(0);
		expect(input.averageTreeHeight).toBeUndefined();
	});
});

describe('generateTreeShadeNotes', () => {
	it('should return empty array when no significant tree shade', () => {
		const input: TreeAwareRecommendationInput = {
			effectiveSunHours: 14,
			theoreticalSunHours: 14,
			climate: mockClimate,
			breakdown: {
				theoretical: 14,
				terrainAndBuildingShadow: 0,
				treeShadow: 0.3,
				overlapShadow: 0,
				effective: 13.7
			},
			treeCount: 1
		};

		const notes = generateTreeShadeNotes(input);
		expect(notes).toHaveLength(0);
	});

	it('should generate note when trees are primary shade source', () => {
		const input: TreeAwareRecommendationInput = {
			effectiveSunHours: 8,
			theoreticalSunHours: 14,
			climate: mockClimate,
			breakdown: {
				theoretical: 14,
				terrainAndBuildingShadow: 1,
				treeShadow: 5,
				overlapShadow: 0,
				effective: 8
			},
			treeCount: 2
		};

		const notes = generateTreeShadeNotes(input);
		const primaryShadeNote = notes.find((n) => n.text.includes('primary shade source'));
		expect(primaryShadeNote).toBeDefined();
		expect(primaryShadeNote?.type).toBe('tip');
	});

	it('should generate dappled shade benefit note for moderate tree shade', () => {
		const input: TreeAwareRecommendationInput = {
			effectiveSunHours: 11,
			theoreticalSunHours: 14,
			climate: mockClimate,
			breakdown: {
				theoretical: 14,
				terrainAndBuildingShadow: 0,
				treeShadow: 3,
				overlapShadow: 0,
				effective: 11
			},
			treeCount: 1
		};

		const notes = generateTreeShadeNotes(input);
		const dappledNote = notes.find((n) => n.text.includes('dappled light'));
		expect(dappledNote).toBeDefined();
		expect(dappledNote?.type).toBe('benefit');
	});

	it('should generate caution for heavy tree shade', () => {
		const input: TreeAwareRecommendationInput = {
			effectiveSunHours: 5,
			theoreticalSunHours: 14,
			climate: mockClimate,
			breakdown: {
				theoretical: 14,
				terrainAndBuildingShadow: 0,
				treeShadow: 9,
				overlapShadow: 0,
				effective: 5
			},
			treeCount: 4
		};

		const notes = generateTreeShadeNotes(input);
		const heavyShadeNote = notes.find((n) => n.text.includes('Heavy tree shade'));
		expect(heavyShadeNote).toBeDefined();
		expect(heavyShadeNote?.type).toBe('caution');
	});

	it('should note tall tree benefit for afternoon shade', () => {
		const input: TreeAwareRecommendationInput = {
			effectiveSunHours: 10,
			theoreticalSunHours: 14,
			climate: mockClimate,
			breakdown: {
				theoretical: 14,
				terrainAndBuildingShadow: 0,
				treeShadow: 4,
				overlapShadow: 0,
				effective: 10
			},
			treeCount: 1,
			averageTreeHeight: 12
		};

		const notes = generateTreeShadeNotes(input);
		const tallTreeNote = notes.find((n) => n.text.includes('Tall trees'));
		expect(tallTreeNote).toBeDefined();
		expect(tallTreeNote?.type).toBe('benefit');
	});
});

describe('generateShadeImpactSummary', () => {
	it('should report unobstructed sunlight when no shade', () => {
		const breakdown: SunHoursBreakdown = {
			theoretical: 14,
			terrainAndBuildingShadow: 0,
			treeShadow: 0.2,
			overlapShadow: 0,
			effective: 13.8
		};

		const summary = generateShadeImpactSummary(breakdown, 0);
		expect(summary).toContain('unobstructed sunlight');
	});

	it('should describe tree shade when trees are the source', () => {
		const breakdown: SunHoursBreakdown = {
			theoretical: 14,
			terrainAndBuildingShadow: 0,
			treeShadow: 4,
			overlapShadow: 0,
			effective: 10
		};

		const summary = generateShadeImpactSummary(breakdown, 2);
		expect(summary).toContain('2 trees');
		expect(summary).toContain('4.0h');
	});

	it('should describe category downgrade when shade changes category', () => {
		const breakdown: SunHoursBreakdown = {
			theoretical: 8,
			terrainAndBuildingShadow: 0,
			treeShadow: 4,
			overlapShadow: 0,
			effective: 4
		};

		const summary = generateShadeImpactSummary(breakdown, 1);
		expect(summary).toContain('full sun');
		expect(summary).toContain('part sun');
	});

	it('should mention both shade sources when present', () => {
		const breakdown: SunHoursBreakdown = {
			theoretical: 14,
			terrainAndBuildingShadow: 2,
			treeShadow: 3,
			overlapShadow: 0,
			effective: 9
		};

		const summary = generateShadeImpactSummary(breakdown, 2);
		expect(summary).toContain('trees');
		expect(summary).toContain('terrain/buildings');
	});
});

describe('getTreeAwareRecommendations', () => {
	it('should return base recommendations plus tree-aware data', () => {
		const input: TreeAwareRecommendationInput = {
			effectiveSunHours: 8,
			theoreticalSunHours: 14,
			climate: mockClimate,
			breakdown: {
				theoretical: 14,
				terrainAndBuildingShadow: 1,
				treeShadow: 5,
				overlapShadow: 0,
				effective: 8
			},
			treeCount: 2,
			averageTreeHeight: 10
		};

		const result = getTreeAwareRecommendations(input);

		// Should have standard recommendation result fields
		expect(result.excellent).toBeDefined();
		expect(result.good).toBeDefined();
		expect(result.marginal).toBeDefined();
		expect(result.summaryNote).toBeDefined();

		// Should have tree-aware fields
		expect(result.effectiveCategory).toBeDefined();
		expect(result.theoreticalCategory).toBeDefined();
		expect(result.hasShadeDowngrade).toBeDefined();
		expect(result.treeShadeNotes).toBeDefined();
		expect(result.shadeImpactSummary).toBeDefined();
	});

	it('should detect shade downgrade when category changes', () => {
		const input: TreeAwareRecommendationInput = {
			effectiveSunHours: 4,
			theoreticalSunHours: 8,
			climate: mockClimate,
			breakdown: {
				theoretical: 8,
				terrainAndBuildingShadow: 0,
				treeShadow: 4,
				overlapShadow: 0,
				effective: 4
			},
			treeCount: 2
		};

		const result = getTreeAwareRecommendations(input);

		expect(result.hasShadeDowngrade).toBe(true);
		expect(result.theoreticalCategory.category).toBe('full-sun');
		expect(result.effectiveCategory.category).toBe('part-sun');
	});
});

describe('getRecommendationsFromSunHours', () => {
	it('should work as convenience wrapper', () => {
		const breakdown: SunHoursBreakdown = {
			theoretical: 14,
			terrainAndBuildingShadow: 0,
			treeShadow: 3,
			overlapShadow: 0,
			effective: 11
		};
		const sunHoursResult = createMockSunHoursResult(breakdown);

		const result = getRecommendationsFromSunHours(sunHoursResult, mockClimate, mockTrees);

		expect(result.excellent).toBeDefined();
		expect(result.effectiveCategory).toBeDefined();
		expect(result.treeShadeNotes).toBeDefined();
	});
});

describe('getPlantingGuidance', () => {
	it('should provide category-specific guidance', () => {
		const input: TreeAwareRecommendationInput = {
			effectiveSunHours: 8,
			theoreticalSunHours: 10,
			climate: mockClimate,
			breakdown: {
				theoretical: 10,
				terrainAndBuildingShadow: 0,
				treeShadow: 2,
				overlapShadow: 0,
				effective: 8
			},
			treeCount: 1
		};
		const result = getTreeAwareRecommendations(input);

		const guidance = getPlantingGuidance(input, result);

		expect(guidance.length).toBeGreaterThan(0);
		// Full sun category should mention wide range of vegetables
		expect(guidance.some((g) => g.includes('tomatoes'))).toBe(true);
	});

	it('should include tree-specific guidance when trees cause shade', () => {
		const input: TreeAwareRecommendationInput = {
			effectiveSunHours: 4,
			theoreticalSunHours: 8,
			climate: mockClimate,
			breakdown: {
				theoretical: 8,
				terrainAndBuildingShadow: 0,
				treeShadow: 4,
				overlapShadow: 0,
				effective: 4
			},
			treeCount: 2
		};
		const result = getTreeAwareRecommendations(input);

		const guidance = getPlantingGuidance(input, result);

		// Should mention tree-related guidance
		expect(guidance.some((g) => g.toLowerCase().includes('tree'))).toBe(true);
	});

	it('should provide short season guidance', () => {
		const shortSeasonClimate: ClimateData = {
			...mockClimate,
			growingSeason: {
				...mockClimate.growingSeason,
				lengthDays: { short: 80, typical: 100, long: 120 }
			}
		};

		const input: TreeAwareRecommendationInput = {
			effectiveSunHours: 8,
			theoreticalSunHours: 8,
			climate: shortSeasonClimate,
			breakdown: {
				theoretical: 8,
				terrainAndBuildingShadow: 0,
				treeShadow: 0,
				overlapShadow: 0,
				effective: 8
			},
			treeCount: 0
		};
		const result = getTreeAwareRecommendations(input);

		const guidance = getPlantingGuidance(input, result);

		expect(guidance.some((g) => g.includes('short growing season'))).toBe(true);
	});
});

describe('assessTreeManagementBenefit', () => {
	it('should return not beneficial when no trees', () => {
		const input: TreeAwareRecommendationInput = {
			effectiveSunHours: 8,
			theoreticalSunHours: 8,
			climate: mockClimate,
			breakdown: {
				theoretical: 8,
				terrainAndBuildingShadow: 0,
				treeShadow: 0,
				overlapShadow: 0,
				effective: 8
			},
			treeCount: 0
		};

		const assessment = assessTreeManagementBenefit(input);

		expect(assessment.beneficial).toBe(false);
		expect(assessment.recommendation).toBeNull();
	});

	it('should recommend pruning when category upgrade is possible', () => {
		const input: TreeAwareRecommendationInput = {
			effectiveSunHours: 5,
			theoreticalSunHours: 10,
			climate: mockClimate,
			breakdown: {
				theoretical: 10,
				terrainAndBuildingShadow: 0,
				treeShadow: 5,
				overlapShadow: 0,
				effective: 5
			},
			treeCount: 2
		};

		const assessment = assessTreeManagementBenefit(input);

		expect(assessment.beneficial).toBe(true);
		expect(assessment.recommendation).toContain('full sun');
		expect(assessment.recommendation).toContain('tomatoes');
	});

	it('should not recommend pruning for minimal tree shade', () => {
		const input: TreeAwareRecommendationInput = {
			effectiveSunHours: 7.5,
			theoreticalSunHours: 8,
			climate: mockClimate,
			breakdown: {
				theoretical: 8,
				terrainAndBuildingShadow: 0,
				treeShadow: 0.5,
				overlapShadow: 0,
				effective: 7.5
			},
			treeCount: 1
		};

		const assessment = assessTreeManagementBenefit(input);

		expect(assessment.beneficial).toBe(false);
	});
});
