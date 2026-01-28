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
