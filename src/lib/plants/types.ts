/**
 * Plant data types and interfaces for Solar-Sim recommendations.
 *
 * This module defines TypeScript interfaces for plant requirements, temperature
 * tolerance, timing data, and recommendation results. The type system supports
 * a scoring-based recommendation engine that matches plants to locations based
 * on effective sun hours (from shade analysis) and climate data (frost dates,
 * growing season length).
 */

import type { ShadeAnalysis } from '$lib/solar/shade-types.js';
import type { ClimateData } from '$lib/climate/index.js';
import type { LightCategory } from '$lib/solar/categories.js';

// ============================================================================
// Plant Category and Classification
// ============================================================================

/**
 * Broad category of plant for filtering and organization. Vegetables are
 * food-producing plants, herbs are culinary or medicinal plants, and flowers
 * are ornamental plants.
 */
export type PlantCategory = 'vegetable' | 'herb' | 'flower';

/**
 * Frost tolerance determines when a plant can be transplanted relative to
 * frost dates. Tender plants die at the first touch of frost and must wait
 * until after the last spring frost. Semi-hardy plants tolerate light frost
 * (28-32F) and can go out 2-3 weeks before last frost. Hardy plants survive
 * hard freezes (below 28F) and can be planted very early or overwinter.
 */
export type FrostTolerance = 'tender' | 'semi-hardy' | 'hardy';

/**
 * Suitability rating for a plant at a given location. Ratings are based on
 * a combined score considering light match, season length, and climate fit.
 * Excellent means the plant should thrive, good means it will grow well,
 * marginal means it may struggle or require extra care.
 */
export type SuitabilityRating = 'excellent' | 'good' | 'marginal' | 'not-recommended';

// ============================================================================
// Plant Light Requirements
// ============================================================================

/**
 * Light requirements for a plant. The minSunHours is the absolute minimum for
 * survival, while idealMinHours and idealMaxHours define the optimal range.
 * Some plants like lettuce have a maxSunHours because they bolt (go to seed)
 * with excessive sun and heat.
 */
export interface PlantLightRequirements {
	/** Minimum daily sun hours for the plant to survive */
	minSunHours: number;

	/** Maximum daily sun hours the plant tolerates (optional, for heat-sensitive plants) */
	maxSunHours?: number;

	/** Lower bound of the optimal sun hours range (defaults to minSunHours if not specified) */
	idealMinHours?: number;

	/** Upper bound of the optimal sun hours range (optional) */
	idealMaxHours?: number;

	/** True if the plant tolerates afternoon shade without suffering */
	toleratesAfternoonShade: boolean;

	/** True if the plant actively benefits from afternoon shade (heat-sensitive plants) */
	benefitsFromAfternoonShade: boolean;
}

// ============================================================================
// Plant Temperature Requirements
// ============================================================================

/**
 * Temperature requirements for a plant. The frostTolerance determines planting
 * timing relative to frost dates, while temperature ranges define the growing
 * conditions where the plant performs best.
 */
export interface PlantTemperatureRequirements {
	/** How well the plant handles frost (tender, semi-hardy, or hardy) */
	frostTolerance: FrostTolerance;

	/** Minimum soil/air temperature (F) for the plant to grow at all */
	minGrowingTempF: number;

	/** Maximum temperature (F) the plant tolerates before heat stress */
	maxGrowingTempF: number;

	/** Lower bound of the optimal growing temperature range (F) */
	optimalMinTempF: number;

	/** Upper bound of the optimal growing temperature range (F) */
	optimalMaxTempF: number;
}

// ============================================================================
// Plant Timing
// ============================================================================

/**
 * Timing information for a plant including days to maturity and indoor seed
 * starting guidance. Days to maturity varies by variety, so we store a range.
 */
export interface PlantTiming {
	/** Minimum days from transplant/sow to harvest for fast varieties */
	daysToMaturityMin: number;

	/** Maximum days from transplant/sow to harvest for slow varieties */
	daysToMaturityMax: number;

	/** Whether the plant can be started indoors before transplanting */
	canStartIndoors: boolean;

	/** Weeks before transplant date to start seeds indoors (if applicable) */
	weeksToStartIndoors?: number;

	/** Weeks between plantings for continuous harvest (if applicable) */
	successionPlantingWeeks?: number;
}

// ============================================================================
// Plant Definition
// ============================================================================

/**
 * Complete plant definition with all requirements and metadata. This is the
 * core data structure stored in the plant database and used by the
 * recommendation engine.
 */
export interface Plant {
	/** Unique identifier for the plant (e.g., "tomato", "lettuce") */
	id: string;

	/** Display name for the plant (e.g., "Tomato", "Lettuce") */
	name: string;

	/** Broad category for filtering (vegetable, herb, or flower) */
	category: PlantCategory;

	/** Brief description of the plant and its uses */
	description: string;

	/** Light requirements including sun hours and shade tolerance */
	light: PlantLightRequirements;

	/** Temperature requirements including frost tolerance */
	temperature: PlantTemperatureRequirements;

	/** Timing information for planting and harvest */
	timing: PlantTiming;
}

// ============================================================================
// Contextual Notes
// ============================================================================

/**
 * Type of contextual note to display with a recommendation. Benefits highlight
 * positive aspects of the location for the plant, cautions warn about potential
 * issues, and tips provide actionable advice.
 */
export type ContextualNoteType = 'benefit' | 'caution' | 'tip';

/**
 * A contextual note providing personalized advice based on the location's
 * shade and climate characteristics. Notes make recommendations feel tailored
 * rather than generic.
 */
export interface ContextualNote {
	/** Note category (benefit, caution, or tip) */
	type: ContextualNoteType;

	/** Human-readable note text */
	text: string;
}

// ============================================================================
// Planting Window
// ============================================================================

/**
 * Planting window information indicating when a plant can be planted at a
 * given location. Day-of-year values (1-366) match the climate module format
 * for consistency with frost date calculations.
 */
export interface PlantingWindow {
	/** Whether the plant can be planted in spring */
	canPlantSpring: boolean;

	/** Whether the plant can be planted for a fall harvest */
	canPlantFall: boolean;

	/** Day of year to start spring planting (after last frost adjustment) */
	springStartDoy?: number;

	/** Day of year for last spring planting (to mature before heat or frost) */
	springEndDoy?: number;

	/** Day of year to start fall planting (counting back from first frost) */
	fallStartDoy?: number;

	/** Day of year for last fall planting */
	fallEndDoy?: number;
}

// ============================================================================
// Plant Recommendation
// ============================================================================

/**
 * A plant recommendation with suitability scoring and contextual notes.
 * The recommendation engine produces these for each plant in the database
 * that scores above the "not recommended" threshold.
 */
export interface PlantRecommendation {
	/** The plant being recommended */
	plant: Plant;

	/** Combined score from 0 to 1 (higher is better) */
	overallScore: number;

	/** Human-readable suitability rating based on overall score */
	suitability: SuitabilityRating;

	/** Light match score from 0 to 1 */
	lightScore: number;

	/** Growing season length match score from 0 to 1 */
	seasonScore: number;

	/** Climate/temperature match score from 0 to 1 */
	climateScore: number;

	/** Personalized notes based on shade patterns and climate */
	notes: ContextualNote[];

	/** When the plant can be planted at this location */
	plantingWindow: PlantingWindow;
}

// ============================================================================
// Recommendation Engine Input/Output
// ============================================================================

/**
 * Input parameters for the recommendation engine. Combines sun data from shade
 * analysis with climate data from the climate module.
 */
export interface RecommendationInput {
	/** Effective sun hours after accounting for shade */
	effectiveSunHours: number;

	/** Theoretical maximum sun hours ignoring obstacles */
	theoreticalSunHours: number;

	/** Full shade analysis for contextual note generation (optional) */
	shadeAnalysis?: ShadeAnalysis;

	/** Climate data including frost dates and growing season */
	climate: ClimateData;

	/** Current date for seasonal awareness (defaults to today) */
	currentDate?: Date;
}

/**
 * Complete recommendation results grouped by suitability rating. The engine
 * returns plants organized for easy UI rendering with a summary note for
 * the overall assessment.
 */
export interface RecommendationResult {
	/** Plants that should thrive at this location */
	excellent: PlantRecommendation[];

	/** Plants that will grow well at this location */
	good: PlantRecommendation[];

	/** Plants that may struggle but could work with extra care */
	marginal: PlantRecommendation[];

	/** Human-readable summary of the location's suitability */
	summaryNote: string;
}

// ============================================================================
// Planting Calendar Types
// ============================================================================

/**
 * Calendar information for a specific plant at a specific location. Provides
 * key dates for seed starting, transplanting, and expected harvest window.
 */
export interface PlantCalendar {
	/** Plant identifier for lookup */
	plantId: string;

	/** Plant display name */
	plantName: string;

	/** Date to start seeds indoors (null if direct sow only) */
	seedStartDate: Date | null;

	/** Date to transplant outdoors or direct sow */
	transplantDate: Date;

	/** Expected start of harvest window */
	harvestStartDate: Date;

	/** Expected end of harvest window */
	harvestEndDate: Date;

	/** Additional timing notes (e.g., "succession plant every 2 weeks") */
	notes: string[];
}

// ============================================================================
// Seasonal Light Chart Types
// ============================================================================

/**
 * Monthly light data for seasonal variation visualization. Shows how effective
 * sun hours change throughout the growing season due to sun angle changes and
 * shade patterns.
 */
export interface MonthlyLightData {
	/** Month number (1-12) */
	month: number;

	/** Average effective sun hours for this month */
	averageEffectiveHours: number;

	/** Average theoretical sun hours for this month */
	averageTheoreticalHours: number;

	/** Light category based on average effective hours */
	lightCategory: LightCategory;
}

/**
 * Props for the seasonal light chart component. The chart visualizes how
 * light conditions vary across the growing season.
 */
export interface SeasonalLightChartData {
	/** Monthly light data for visualization */
	monthlyData: MonthlyLightData[];

	/** Month number (1-12) when the growing season starts */
	growingSeasonStart: number;

	/** Month number (1-12) when the growing season ends */
	growingSeasonEnd: number;
}
