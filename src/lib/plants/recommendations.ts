/**
 * Plant recommendation engine for Solar-Sim.
 *
 * This module analyzes a location's effective sun hours and climate data to
 * recommend suitable plants. The engine scores each plant on three dimensions:
 * light match (does the plant get enough sun), season match (is there enough
 * time for the plant to mature), and climate match (can the plant handle the
 * temperature range). Scores combine into an overall suitability rating.
 *
 * The engine also generates contextual notes that provide personalized advice
 * based on the specific conditions. For example, a location with afternoon
 * shade might get a note recommending heat-sensitive crops like lettuce.
 */

import type { ClimateData, GrowingSeason, FrostDates, DayOfYearRange } from '$lib/climate/index.js';
import type { ShadeAnalysis } from '$lib/solar/shade-types.js';
import type {
	Plant,
	PlantRecommendation,
	RecommendationInput,
	RecommendationResult,
	ContextualNote,
	PlantingWindow,
	SuitabilityRating,
	FrostTolerance
} from './types.js';
import { PLANTS } from './database.js';

// ============================================================================
// Score Thresholds
// ============================================================================

/** Minimum overall score to be recommended (below this is "not recommended") */
const SCORE_THRESHOLD_MARGINAL = 0.3;

/** Threshold for "good" suitability */
const SCORE_THRESHOLD_GOOD = 0.6;

/** Threshold for "excellent" suitability */
const SCORE_THRESHOLD_EXCELLENT = 0.8;

/** Weeks before/after frost dates based on frost tolerance */
const FROST_TOLERANCE_WEEKS: Record<FrostTolerance, number> = {
	tender: 0,
	'semi-hardy': 2,
	hardy: 4
};

// ============================================================================
// Light Scoring
// ============================================================================

/**
 * Calculates a score from 0 to 1 based on how well the effective sun hours
 * match the plant's light requirements. A perfect match in the ideal range
 * scores 1.0, while falling below the minimum scores poorly. Plants with a
 * maximum sun hour limit (like lettuce) also lose points if they get too much
 * light.
 */
function calculateLightScore(plant: Plant, effectiveSunHours: number): number {
	const { minSunHours, maxSunHours, idealMinHours, idealMaxHours } = plant.light;

	// Below minimum is a hard fail
	if (effectiveSunHours < minSunHours) {
		return effectiveSunHours / minSunHours * 0.3;
	}

	// Above maximum (if defined) penalizes the score
	if (maxSunHours !== undefined && effectiveSunHours > maxSunHours) {
		const excess = effectiveSunHours - maxSunHours;
		return Math.max(0.3, 1.0 - excess * 0.15);
	}

	// In the ideal range is perfect
	const idealMin = idealMinHours ?? minSunHours;
	const idealMax = idealMaxHours ?? (maxSunHours ?? 12);

	if (effectiveSunHours >= idealMin && effectiveSunHours <= idealMax) {
		return 1.0;
	}

	// Between minimum and ideal minimum
	if (effectiveSunHours < idealMin) {
		const range = idealMin - minSunHours;
		if (range <= 0) return 1.0;
		const position = (effectiveSunHours - minSunHours) / range;
		return 0.7 + position * 0.3;
	}

	// Between ideal maximum and hard maximum
	if (maxSunHours !== undefined && effectiveSunHours > idealMax) {
		const range = maxSunHours - idealMax;
		if (range <= 0) return 1.0;
		const position = (effectiveSunHours - idealMax) / range;
		return 1.0 - position * 0.2;
	}

	// Above ideal maximum but no hard maximum
	return 0.95;
}

// ============================================================================
// Season Scoring
// ============================================================================

/**
 * Calculates a score based on whether the growing season is long enough for
 * the plant to mature. Uses the typical growing season length and compares
 * it to the plant's days to maturity. Plants with a tight fit score lower
 * since they have less margin for error.
 */
function calculateSeasonScore(plant: Plant, growingSeason: GrowingSeason): number {
	const seasonLength = growingSeason.lengthDays.typical;
	const daysNeeded = plant.timing.daysToMaturityMax;
	const daysNeededMin = plant.timing.daysToMaturityMin;

	// Calculate how much buffer exists beyond what the plant needs
	const buffer = seasonLength - daysNeeded;

	// Plenty of buffer (4+ weeks) is excellent
	if (buffer >= 28) return 1.0;

	// Some buffer (2-4 weeks) is good
	if (buffer >= 14) return 0.85;

	// Tight fit but possible
	if (buffer >= 0) return 0.7;

	// Can fast varieties make it?
	const minBuffer = seasonLength - daysNeededMin;
	if (minBuffer >= 0) return 0.5;

	// Season is too short even for fast varieties
	if (minBuffer >= -14) return 0.3;

	return 0.1;
}

// ============================================================================
// Climate Scoring
// ============================================================================

/**
 * Calculates a score based on temperature compatibility. Hardy plants get
 * bonus points in cold climates, while tender plants score better in mild
 * climates with long warm periods.
 */
function calculateClimateScore(plant: Plant, climate: ClimateData): number {
	const { frostTolerance } = plant.temperature;
	const seasonLength = climate.growingSeason.lengthDays.typical;

	// Hardy plants do well almost anywhere
	if (frostTolerance === 'hardy') {
		return seasonLength > 120 ? 1.0 : 0.9;
	}

	// Semi-hardy plants need a moderate season
	if (frostTolerance === 'semi-hardy') {
		if (seasonLength >= 150) return 1.0;
		if (seasonLength >= 120) return 0.85;
		if (seasonLength >= 90) return 0.7;
		return 0.5;
	}

	// Tender plants need a long warm season
	if (seasonLength >= 180) return 1.0;
	if (seasonLength >= 150) return 0.9;
	if (seasonLength >= 120) return 0.75;
	if (seasonLength >= 90) return 0.5;
	return 0.3;
}

// ============================================================================
// Contextual Notes
// ============================================================================

/**
 * Generates contextual notes based on the specific conditions at a location.
 * Notes help users understand why a plant is or isn't recommended and provide
 * actionable advice.
 */
function generateNotes(
	plant: Plant,
	input: RecommendationInput,
	lightScore: number,
	seasonScore: number
): ContextualNote[] {
	const notes: ContextualNote[] = [];
	const { effectiveSunHours, theoreticalSunHours, climate, shadeAnalysis } = input;

	// Afternoon shade benefits
	if (plant.light.benefitsFromAfternoonShade && effectiveSunHours < theoreticalSunHours) {
		notes.push({
			type: 'benefit',
			text: 'Afternoon shade helps prevent bolting and heat stress'
		});
	}

	// Tolerates partial shade
	if (plant.light.toleratesAfternoonShade && effectiveSunHours >= plant.light.minSunHours) {
		if (effectiveSunHours < 6 && theoreticalSunHours >= 6) {
			notes.push({
				type: 'tip',
				text: 'Tolerates the reduced light from nearby obstacles'
			});
		}
	}

	// Too much sun for shade-loving plants
	if (plant.light.maxSunHours !== undefined && effectiveSunHours > plant.light.maxSunHours) {
		notes.push({
			type: 'caution',
			text: `May bolt or suffer heat stress with ${effectiveSunHours.toFixed(1)} hours of sun`
		});
	}

	// Tight growing season
	if (seasonScore < 0.7 && seasonScore >= 0.5) {
		notes.push({
			type: 'caution',
			text: 'Choose fast-maturing varieties for your short growing season'
		});
	}

	// Very tight season
	if (seasonScore < 0.5 && seasonScore >= 0.3) {
		notes.push({
			type: 'caution',
			text: 'Start indoors early to extend the growing season'
		});
	}

	// Can start indoors
	if (plant.timing.canStartIndoors && plant.timing.weeksToStartIndoors) {
		const weeksEarly = plant.timing.weeksToStartIndoors;
		if (seasonScore < 0.85) {
			notes.push({
				type: 'tip',
				text: `Start seeds indoors ${weeksEarly} weeks before transplanting`
			});
		}
	}

	// Succession planting option
	if (plant.timing.successionPlantingWeeks) {
		notes.push({
			type: 'tip',
			text: `Plant every ${plant.timing.successionPlantingWeeks} weeks for continuous harvest`
		});
	}

	// Hardy plant benefits
	if (plant.temperature.frostTolerance === 'hardy') {
		notes.push({
			type: 'benefit',
			text: 'Survives frost and can be planted early or overwintered'
		});
	}

	// Insufficient light warning
	if (lightScore < 0.5) {
		notes.push({
			type: 'caution',
			text: `Needs at least ${plant.light.minSunHours} hours of sun, receiving only ${effectiveSunHours.toFixed(1)}`
		});
	}

	return notes;
}

// ============================================================================
// Planting Window Calculation
// ============================================================================

/**
 * Calculates planting windows based on frost dates and the plant's frost
 * tolerance. Hardy plants can go out earlier in spring and later in fall,
 * while tender plants must wait until after the last frost.
 */
function calculatePlantingWindow(plant: Plant, climate: ClimateData): PlantingWindow {
	const { frostDates, growingSeason } = climate;
	const { frostTolerance } = plant.temperature;
	const toleranceWeeks = FROST_TOLERANCE_WEEKS[frostTolerance];
	const toleranceDays = toleranceWeeks * 7;

	const lastSpringFrost = frostDates.lastSpringFrost.median;
	const firstFallFrost = frostDates.firstFallFrost.median;
	const daysNeeded = plant.timing.daysToMaturityMax;

	// Spring planting: adjust start based on frost tolerance
	const springStartDoy = Math.max(1, lastSpringFrost - toleranceDays);
	const springEndDoy = Math.min(
		firstFallFrost - daysNeeded,
		lastSpringFrost + 60 // Don't plant too late in spring
	);
	const canPlantSpring = springEndDoy > springStartDoy;

	// Fall planting: count back from first frost
	const fallEndDoy = firstFallFrost - daysNeeded + toleranceDays;
	const fallStartDoy = fallEndDoy - 30; // 4-week planting window
	const canPlantFall =
		plant.temperature.frostTolerance !== 'tender' &&
		fallStartDoy > lastSpringFrost + 90 && // Don't overlap with spring
		fallEndDoy > fallStartDoy;

	return {
		canPlantSpring,
		canPlantFall,
		springStartDoy: canPlantSpring ? springStartDoy : undefined,
		springEndDoy: canPlantSpring ? springEndDoy : undefined,
		fallStartDoy: canPlantFall ? fallStartDoy : undefined,
		fallEndDoy: canPlantFall ? fallEndDoy : undefined
	};
}

// ============================================================================
// Suitability Rating
// ============================================================================

/**
 * Converts a numeric score to a suitability rating. Thresholds are set to
 * ensure that "excellent" plants will truly thrive, while "marginal" plants
 * need extra care or may struggle.
 */
function getSuitabilityRating(score: number): SuitabilityRating {
	if (score >= SCORE_THRESHOLD_EXCELLENT) return 'excellent';
	if (score >= SCORE_THRESHOLD_GOOD) return 'good';
	if (score >= SCORE_THRESHOLD_MARGINAL) return 'marginal';
	return 'not-recommended';
}

// ============================================================================
// Summary Note Generation
// ============================================================================

/**
 * Generates a human-readable summary of the location's growing conditions.
 * The summary helps users quickly understand what they can grow.
 */
function generateSummaryNote(
	input: RecommendationInput,
	excellentCount: number,
	goodCount: number
): string {
	const { effectiveSunHours, climate } = input;
	const seasonLength = climate.growingSeason.lengthDays.typical;

	// Describe light conditions
	let lightDescription: string;
	if (effectiveSunHours >= 8) {
		lightDescription = 'abundant sunlight';
	} else if (effectiveSunHours >= 6) {
		lightDescription = 'good sun exposure';
	} else if (effectiveSunHours >= 4) {
		lightDescription = 'partial sun';
	} else if (effectiveSunHours >= 2) {
		lightDescription = 'partial shade';
	} else {
		lightDescription = 'deep shade';
	}

	// Describe season length
	let seasonDescription: string;
	if (seasonLength >= 180) {
		seasonDescription = 'a long growing season';
	} else if (seasonLength >= 150) {
		seasonDescription = 'a generous growing season';
	} else if (seasonLength >= 120) {
		seasonDescription = 'a moderate growing season';
	} else if (seasonLength >= 90) {
		seasonDescription = 'a short growing season';
	} else {
		seasonDescription = 'a very short growing season';
	}

	// Build the summary
	const totalRecommended = excellentCount + goodCount;
	if (totalRecommended === 0) {
		return `This location has ${lightDescription} and ${seasonDescription}, which limits growing options. Consider container gardening or shade-tolerant plants.`;
	}

	if (excellentCount >= 10) {
		return `This location offers ${lightDescription} and ${seasonDescription}, making it excellent for growing a wide variety of plants.`;
	}

	if (excellentCount >= 5) {
		return `With ${lightDescription} and ${seasonDescription}, this spot supports many vegetables, herbs, and flowers.`;
	}

	if (goodCount >= 5) {
		return `This location with ${lightDescription} and ${seasonDescription} works well for shade-tolerant crops and cool-season vegetables.`;
	}

	return `With ${lightDescription} and ${seasonDescription}, focus on plants suited to these specific conditions for best results.`;
}

// ============================================================================
// Main Recommendation Function
// ============================================================================

/**
 * Generates plant recommendations based on effective sun hours and climate
 * data. Returns plants grouped by suitability rating with contextual notes
 * explaining why each plant is or isn't recommended.
 *
 * The algorithm scores each plant on light match, season fit, and climate
 * compatibility, then combines these into an overall score. Plants scoring
 * below the marginal threshold are excluded from results.
 */
export function getRecommendations(input: RecommendationInput): RecommendationResult {
	const recommendations: PlantRecommendation[] = [];

	for (const plant of PLANTS) {
		const lightScore = calculateLightScore(plant, input.effectiveSunHours);
		const seasonScore = calculateSeasonScore(plant, input.climate.growingSeason);
		const climateScore = calculateClimateScore(plant, input.climate);

		// Weight light most heavily since it's the primary constraint
		const overallScore = lightScore * 0.5 + seasonScore * 0.3 + climateScore * 0.2;

		const suitability = getSuitabilityRating(overallScore);

		// Skip plants that aren't recommended
		if (suitability === 'not-recommended') continue;

		const notes = generateNotes(plant, input, lightScore, seasonScore);
		const plantingWindow = calculatePlantingWindow(plant, input.climate);

		recommendations.push({
			plant,
			overallScore,
			suitability,
			lightScore,
			seasonScore,
			climateScore,
			notes,
			plantingWindow
		});
	}

	// Sort by score within each category
	recommendations.sort((a, b) => b.overallScore - a.overallScore);

	// Group by suitability
	const excellent = recommendations.filter((r) => r.suitability === 'excellent');
	const good = recommendations.filter((r) => r.suitability === 'good');
	const marginal = recommendations.filter((r) => r.suitability === 'marginal');

	const summaryNote = generateSummaryNote(input, excellent.length, good.length);

	return {
		excellent,
		good,
		marginal,
		summaryNote
	};
}

/**
 * Helper function that creates recommendation input from sun hours and climate
 * data. Use this when you don't have a full shade analysis object.
 */
export function createRecommendationInput(
	effectiveSunHours: number,
	climate: ClimateData,
	theoreticalSunHours?: number
): RecommendationInput {
	return {
		effectiveSunHours,
		theoreticalSunHours: theoreticalSunHours ?? effectiveSunHours,
		climate
	};
}
