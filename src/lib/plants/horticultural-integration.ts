/**
 * Horticultural integration module for Solar-Sim.
 *
 * This module bridges the combined sun-hours calculation (which includes tree
 * shadow data) with the plant recommendation engine. It provides functions to
 * generate gardening guidance that accounts for actual shade conditions from
 * user-placed trees, terrain, and buildings.
 *
 * The key insight is that tree shadows create different growing conditions than
 * building shadows. Trees provide dappled shade that many plants tolerate well,
 * and deciduous trees allow winter sun while providing summer cooling. This
 * module generates contextual advice that reflects these nuances.
 */

import type { ClimateData } from '$lib/climate/index.js';
import type {
	SunHoursBreakdown,
	CombinedSunHoursResult,
	SeasonalCombinedSunHours
} from '$lib/solar/combined-sun-hours.js';
import {
	classifySunHours,
	getComparativeCategoryInfo,
	type LightCategory,
	type CategoryInfo
} from '$lib/solar/categories.js';
import type { MapTreeConfig } from '$lib/solar/shadow-projection.js';
import {
	getRecommendations,
	createRecommendationInput,
	type RecommendationInput,
	type RecommendationResult,
	type ContextualNote
} from './recommendations.js';

/**
 * Extended recommendation input that includes tree shadow details.
 * This allows the recommendation engine to generate tree-specific advice.
 */
export interface TreeAwareRecommendationInput extends RecommendationInput {
	/** Sun hours breakdown with tree and terrain shadow details */
	breakdown: SunHoursBreakdown;

	/** Number of trees affecting the observation point */
	treeCount: number;

	/** Average tree height in meters (for shade quality assessment) */
	averageTreeHeight?: number;

	/** Whether the trees are primarily deciduous (affects seasonal sun) */
	hasDeciduousTrees?: boolean;
}

/**
 * Enhanced recommendation result with tree-aware gardening guidance.
 */
export interface TreeAwareRecommendationResult extends RecommendationResult {
	/** Light category based on effective sun hours */
	effectiveCategory: CategoryInfo;

	/** Light category if there were no obstacles (for comparison) */
	theoreticalCategory: CategoryInfo;

	/** True if trees/obstacles caused a category downgrade */
	hasShadeDowngrade: boolean;

	/** Additional notes specific to tree shade conditions */
	treeShadeNotes: ContextualNote[];

	/** Formatted summary of shade impact */
	shadeImpactSummary: string;
}

/**
 * Creates a tree-aware recommendation input from combined sun-hours data.
 * This bridges the output of calculateCombinedSunHours or calculateSeasonalCombinedSunHours
 * to the recommendation engine.
 */
export function createTreeAwareInput(
	sunHoursResult: CombinedSunHoursResult | SeasonalCombinedSunHours,
	climate: ClimateData,
	trees: MapTreeConfig[]
): TreeAwareRecommendationInput {
	const breakdown =
		'averageBreakdown' in sunHoursResult
			? sunHoursResult.averageBreakdown
			: sunHoursResult.breakdown;

	// Calculate average tree height for shade quality assessment
	const averageTreeHeight =
		trees.length > 0
			? trees.reduce((sum, t) => sum + t.height, 0) / trees.length
			: undefined;

	return {
		effectiveSunHours: breakdown.effective,
		theoreticalSunHours: breakdown.theoretical,
		climate,
		breakdown,
		treeCount: trees.length,
		averageTreeHeight,
		hasDeciduousTrees: undefined // Could be enhanced with tree type data
	};
}

/**
 * Generates contextual notes specific to tree shade conditions.
 * These notes help gardeners understand how tree shade affects their options
 * and provide actionable advice for shaded gardens.
 */
export function generateTreeShadeNotes(input: TreeAwareRecommendationInput): ContextualNote[] {
	const notes: ContextualNote[] = [];
	const { breakdown, treeCount, averageTreeHeight } = input;
	const treeShadeHours = breakdown.treeShadow;
	const totalShade = breakdown.theoretical - breakdown.effective;

	// No notes needed if trees aren't causing significant shade
	if (treeShadeHours < 0.5 || treeCount === 0) {
		return notes;
	}

	// Tree shade as percentage of total shade
	const treeShadePercent =
		totalShade > 0 ? (treeShadeHours / totalShade) * 100 : 0;

	// Note about tree shade being primary shade source
	if (treeShadePercent > 70) {
		notes.push({
			type: 'tip',
			text: `Trees are the primary shade source, blocking ${treeShadeHours.toFixed(1)} hours of sun. Consider tree pruning to increase light for sun-loving crops.`
		});
	}

	// Dappled shade benefit for heat-sensitive plants
	if (treeShadeHours >= 2 && treeShadeHours <= 4) {
		notes.push({
			type: 'benefit',
			text: 'Tree shade provides dappled light ideal for lettuce, spinach, and other heat-sensitive crops that bolt in full sun.'
		});
	}

	// Heavy tree shade advice
	if (treeShadeHours > 4) {
		notes.push({
			type: 'caution',
			text: 'Heavy tree shade limits vegetable options. Focus on leafy greens, herbs like mint and parsley, and shade-tolerant flowers.'
		});
	}

	// Tall tree benefit (afternoon shade)
	if (averageTreeHeight && averageTreeHeight > 8) {
		notes.push({
			type: 'benefit',
			text: 'Tall trees provide afternoon shade that protects plants from heat stress during the hottest part of the day.'
		});
	}

	// Multiple trees creating complex shade patterns
	if (treeCount >= 3) {
		notes.push({
			type: 'tip',
			text: 'Multiple trees create varied microclimates. Map sunny pockets between trees for sun-loving plants.'
		});
	}

	// Combined shade sources (trees + terrain/buildings)
	if (breakdown.terrainAndBuildingShadow > 1 && treeShadeHours > 1) {
		notes.push({
			type: 'caution',
			text: 'Shade from both trees and structures compounds light reduction. Prioritize the sunniest spot for fruiting vegetables.'
		});
	}

	return notes;
}

/**
 * Generates a human-readable summary of how shade affects gardening options.
 */
export function generateShadeImpactSummary(
	breakdown: SunHoursBreakdown,
	treeCount: number
): string {
	const { theoretical, effective, treeShadow, terrainAndBuildingShadow } = breakdown;
	const totalReduction = theoretical - effective;
	const reductionPercent = theoretical > 0 ? (totalReduction / theoretical) * 100 : 0;

	// No significant shade
	if (totalReduction < 0.5) {
		return 'This spot receives unobstructed sunlight throughout the day.';
	}

	// Build shade source description
	const sources: string[] = [];
	if (treeShadow > 0.5) {
		sources.push(`${treeCount} tree${treeCount !== 1 ? 's' : ''} (${treeShadow.toFixed(1)}h)`);
	}
	if (terrainAndBuildingShadow > 0.5) {
		sources.push(`terrain/buildings (${terrainAndBuildingShadow.toFixed(1)}h)`);
	}

	const sourceText = sources.join(' and ');
	const effectiveCategory = classifySunHours(effective);
	const theoreticalCategory = classifySunHours(theoretical);

	// Category downgrade messaging
	if (effectiveCategory !== theoreticalCategory) {
		const theoreticalLabel = getCategoryLabel(theoreticalCategory);
		const effectiveLabel = getCategoryLabel(effectiveCategory);
		return `Shade from ${sourceText} reduces this spot from ${theoreticalLabel} to ${effectiveLabel}, with ${effective.toFixed(1)} effective sun hours.`;
	}

	// Same category but notable reduction
	return `Shade from ${sourceText} reduces sun by ${reductionPercent.toFixed(0)}%, but this spot still qualifies as ${getCategoryLabel(effectiveCategory)} with ${effective.toFixed(1)} hours.`;
}

/**
 * Helper to get a user-friendly category label.
 */
function getCategoryLabel(category: LightCategory): string {
	const labels: Record<LightCategory, string> = {
		'full-sun': 'full sun',
		'part-sun': 'part sun',
		'part-shade': 'part shade',
		'full-shade': 'full shade'
	};
	return labels[category];
}

/**
 * Main integration function that generates tree-aware plant recommendations.
 * This is the primary entry point for the horticultural integration, combining
 * sun-hours data, climate data, and tree information to produce comprehensive
 * gardening recommendations.
 */
export function getTreeAwareRecommendations(
	input: TreeAwareRecommendationInput
): TreeAwareRecommendationResult {
	// Get base recommendations from the standard engine
	const baseRecommendations = getRecommendations(input);

	// Calculate category comparison
	const { theoretical, effective, hasDowngrade } = getComparativeCategoryInfo({
		theoreticalHours: input.theoreticalSunHours,
		effectiveHours: input.effectiveSunHours
	});

	// Generate tree-specific notes
	const treeShadeNotes = generateTreeShadeNotes(input);

	// Generate shade impact summary
	const shadeImpactSummary = generateShadeImpactSummary(
		input.breakdown,
		input.treeCount
	);

	return {
		...baseRecommendations,
		effectiveCategory: effective,
		theoreticalCategory: theoretical,
		hasShadeDowngrade: hasDowngrade,
		treeShadeNotes,
		shadeImpactSummary
	};
}

/**
 * Convenience function that combines sun-hours calculation output with climate
 * data and trees to produce complete recommendations in a single call.
 */
export function getRecommendationsFromSunHours(
	sunHoursResult: CombinedSunHoursResult | SeasonalCombinedSunHours,
	climate: ClimateData,
	trees: MapTreeConfig[]
): TreeAwareRecommendationResult {
	const input = createTreeAwareInput(sunHoursResult, climate, trees);
	return getTreeAwareRecommendations(input);
}

/**
 * Generates planting guidance that considers both climate and shade conditions.
 * This produces actionable advice for the gardener's specific situation.
 */
export function getPlantingGuidance(
	input: TreeAwareRecommendationInput,
	recommendations: TreeAwareRecommendationResult
): string[] {
	const guidance: string[] = [];
	const { breakdown, treeCount } = input;
	const { hasShadeDowngrade, effectiveCategory } = recommendations;
	const category = effectiveCategory.category;

	// Category-specific guidance
	if (category === 'full-sun') {
		guidance.push(
			'With full sun conditions, you can grow the widest range of vegetables including tomatoes, peppers, squash, and beans.'
		);
	} else if (category === 'part-sun') {
		guidance.push(
			'Part sun suits many crops. Leafy greens, root vegetables, and herbs thrive here, while tomatoes and peppers may produce less fruit.'
		);
	} else if (category === 'part-shade') {
		guidance.push(
			'Focus on shade-tolerant crops like lettuce, spinach, kale, and herbs such as mint, parsley, and chives.'
		);
	} else {
		guidance.push(
			'Deep shade limits vegetable options. Consider hostas, ferns, and other ornamental shade plants, or create a raised bed in a sunnier location.'
		);
	}

	// Tree-specific guidance
	if (treeCount > 0 && breakdown.treeShadow > 1) {
		if (hasShadeDowngrade) {
			guidance.push(
				'Tree shade has shifted your growing conditions. You might prune lower branches to raise the canopy and increase light penetration.'
			);
		}

		// Understory gardening tip
		guidance.push(
			'Use the space under trees for shade-loving perennials and ground covers that thrive in the natural woodland environment.'
		);
	}

	// Season-specific guidance based on climate
	const seasonLength = input.climate.growingSeason.lengthDays.typical;
	if (seasonLength < 120) {
		guidance.push(
			'Your short growing season means starting seeds indoors is essential for warm-season crops. Choose fast-maturing varieties.'
		);
	} else if (seasonLength > 180) {
		guidance.push(
			'Your long growing season allows succession planting for extended harvests. Consider fall crops of broccoli and cabbage.'
		);
	}

	return guidance;
}

/**
 * Determines if tree removal or pruning would significantly improve growing options.
 * Returns a recommendation only if the improvement would be meaningful.
 */
export function assessTreeManagementBenefit(
	input: TreeAwareRecommendationInput
): { beneficial: boolean; recommendation: string | null } {
	const { breakdown, treeCount } = input;

	// No trees or minimal tree shade
	if (treeCount === 0 || breakdown.treeShadow < 1) {
		return { beneficial: false, recommendation: null };
	}

	// Check if removing tree shade would change the category
	const currentCategory = classifySunHours(breakdown.effective);
	const withoutTreesHours = breakdown.effective + breakdown.treeShadow;
	const potentialCategory = classifySunHours(withoutTreesHours);

	// Category improvement possible
	if (potentialCategory !== currentCategory) {
		const currentLabel = getCategoryLabel(currentCategory);
		const potentialLabel = getCategoryLabel(potentialCategory);

		if (potentialCategory === 'full-sun' && currentCategory !== 'full-sun') {
			return {
				beneficial: true,
				recommendation: `Reducing tree shade could upgrade this spot from ${currentLabel} to ${potentialLabel}, opening options for tomatoes, peppers, and other sun-loving vegetables. Consider selective pruning or canopy raising.`
			};
		}

		return {
			beneficial: true,
			recommendation: `Pruning nearby trees could improve light from ${currentLabel} to ${potentialLabel}, expanding your growing options.`
		};
	}

	// Same category but notable hour gain
	if (breakdown.treeShadow > 2) {
		return {
			beneficial: true,
			recommendation: `Tree pruning could add ${breakdown.treeShadow.toFixed(1)} hours of sun, improving yields even within the same light category.`
		};
	}

	return { beneficial: false, recommendation: null };
}
