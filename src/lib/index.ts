// Main library exports
// This file re-exports from submodules for convenient imports

// Solar module - core calculation types and functions
export type {
	SolarPosition,
	SunTimes,
	PolarCondition,
	DailySunData,
	SeasonalSummary
} from './solar/index.js';

export {
	SAMPLING_INTERVAL_MINUTES,
	SAMPLES_PER_DAY,
	getSunPosition,
	getSunTimes,
	getPolarCondition,
	getDailySunHours,
	getSeasonalSummary,
	getMonthlySummary,
	getYearlySummary
} from './solar/index.js';

// Geo module - location types and coordinate handling
// Note: Coordinates is defined in both solar and geo modules with identical structure.
// We export from geo since that's where location-related types naturally belong.
export type {
	Coordinates,
	Location,
	LocationResult,
	GeocodingOptions,
	GeocodingError,
	GeocodingResult,
	CoordinateFormat,
	ParsedCoordinates,
	ParseError,
	ParseResult
} from './geo/index.js';

export {
	LATITUDE_MIN,
	LATITUDE_MAX,
	LONGITUDE_MIN,
	LONGITUDE_MAX,
	GEOCODING_RATE_LIMIT_MS,
	validateCoordinates,
	validateCoordinatesWithError,
	parseCoordinates,
	tryParseCoordinates,
	formatCoordinates,
	formatCoordinatesDMS,
	getParseErrorMessage
} from './geo/index.js';

// Categories module
export * from './categories/index.js';
