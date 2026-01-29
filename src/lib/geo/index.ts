/**
 * Geographic and location handling module.
 *
 * This module provides coordinate validation, parsing, timezone inference,
 * and geocoding functionality for the Solar-Sim application.
 */

// Re-export all types
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
} from './types.js';

export {
	LATITUDE_MIN,
	LATITUDE_MAX,
	LONGITUDE_MIN,
	LONGITUDE_MAX,
	GEOCODING_RATE_LIMIT_MS
} from './types.js';

// Re-export coordinate functions
export {
	validateCoordinates,
	validateCoordinatesWithError,
	parseCoordinates,
	tryParseCoordinates,
	formatCoordinates,
	formatCoordinatesDMS,
	getParseErrorMessage
} from './coordinates.js';

// Re-export timezone functions
export type { TimezoneResult } from './timezone.js';
export { getTimezone, getTimezoneString } from './timezone.js';

// Re-export geocoding functions
export { geocodeAddress, getGeocodingErrorMessage, resetRateLimiter } from './geocoding.js';
