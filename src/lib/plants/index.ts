/**
 * Plant data module for Solar-Sim.
 *
 * This module provides types and (eventually) functions for plant data,
 * light requirements, and recommendation results. The recommendation engine
 * matches plants to locations based on effective sun hours from shade analysis
 * and growing season data from the climate module.
 */

// Plant category and classification types
export type {
	PlantCategory,
	FrostTolerance,
	SuitabilityRating
} from './types.js';

// Plant requirement interfaces
export type {
	PlantLightRequirements,
	PlantTemperatureRequirements,
	PlantTiming,
	Plant
} from './types.js';

// Contextual note types
export type {
	ContextualNoteType,
	ContextualNote
} from './types.js';

// Planting window types
export type { PlantingWindow } from './types.js';

// Recommendation types
export type {
	PlantRecommendation,
	RecommendationInput,
	RecommendationResult
} from './types.js';

// Calendar types
export type { PlantCalendar } from './types.js';

// Seasonal chart types
export type {
	MonthlyLightData,
	SeasonalLightChartData
} from './types.js';

// Plant database
export { PLANTS, getPlantById, getPlantsByCategory, getPlantsForSunHours } from './database.js';

// Recommendation engine
export { getRecommendations, createRecommendationInput } from './recommendations.js';

// Horticultural integration (tree-aware recommendations)
export type {
	TreeAwareRecommendationInput,
	TreeAwareRecommendationResult
} from './horticultural-integration.js';

export {
	createTreeAwareInput,
	generateTreeShadeNotes,
	generateShadeImpactSummary,
	getTreeAwareRecommendations,
	getRecommendationsFromSunHours,
	getPlantingGuidance,
	assessTreeManagementBenefit
} from './horticultural-integration.js';

// Plant query API (zone-aware plant selection)
export type {
	PlantFilters,
	PlantQuery,
	PlantWithAttributes
} from './query.js';

export {
	queryPlants,
	getPlantsForLightCategory,
	searchPlantsForZone,
	formatLightCategoryLabel,
	FILTER_OPTIONS
} from './query.js';
