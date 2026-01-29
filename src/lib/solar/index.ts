/**
 * Solar calculation engine main entry point.
 *
 * This module re-exports all public types and functions from the solar engine,
 * allowing consumers to import everything from '$lib/solar' without knowing
 * about the internal module structure.
 */

// Types
export type {
	Coordinates,
	SolarPosition,
	SunTimes,
	PolarCondition,
	DailySunData,
	SeasonalSummary
} from './types.js';

// Constants
export { SAMPLING_INTERVAL_MINUTES, SAMPLES_PER_DAY } from './types.js';

// Position module - sun position and times
export { getSunPosition, getSunTimes, getPolarCondition } from './position.js';

// Sun hours module - daily sun hour calculation
export { getDailySunHours } from './sun-hours.js';

// Seasonal module - date range aggregation
export {
	getSeasonalSummary,
	getMonthlySummary,
	getYearlySummary,
	getAnnualSummary
} from './seasonal.js';

// Shade types and presets
export type {
	ObstacleType,
	Obstacle,
	ObstaclePreset,
	BlockingResult,
	ShadeWindow,
	DailyShadeAnalysis,
	ShadeAnalysis
} from './shade-types.js';

export { OBSTACLE_PRESETS, getTransparency } from './shade-types.js';

// Shade calculation functions
export {
	normalizeAngle,
	angularDifference,
	isBlocked,
	calculateEffectiveSunlight
} from './shade.js';

// Shade-aware sun hours integration
export type { DailySunDataWithShade } from './sun-hours-shade.js';

export {
	getDailySunHoursWithShade,
	calculateDailyShadeAnalysis,
	getSeasonalSummaryWithShade
} from './sun-hours-shade.js';

// Light category classification (shade-aware)
export type { LightCategory, CategoryInfo, SunHoursForCategory } from './categories.js';

export {
	CATEGORIES,
	classifySunHours,
	getCategoryInfo,
	getEffectiveCategoryInfo,
	hasShadeDowngrade,
	getComparativeCategoryInfo
} from './categories.js';

// Slope types and calculations
export type { PlotSlope } from './slope.js';

export {
	SLOPE_PRESETS,
	calculateSlopeIrradiance,
	calculateEffectiveAltitude,
	calculateSlopeBoostFactor,
	getDailySunHoursWithSlope,
	calculateDailyBoostPercent,
	normalizeSlope,
	describeSlopeDirection
} from './slope.js';

// Shadow projection for visualization
export type { Point, ShadowPolygon, PlotObstacle } from './shadow-projection.js';

export {
	calculateShadowLength,
	getShadowDirection,
	adjustShadowLengthForSlope,
	calculateShadowPolygon,
	calculateAllShadows,
	getShadowBounds,
	isPointInShadow
} from './shadow-projection.js';
