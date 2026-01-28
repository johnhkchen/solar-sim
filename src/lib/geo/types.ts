/**
 * Geographic types for the location input system.
 *
 * This module defines TypeScript interfaces for coordinates, locations,
 * geocoding results, and coordinate parsing. These types are used across
 * the geo module to ensure type safety and clear contracts.
 */

/**
 * Geographic coordinates representing a location on Earth.
 * Latitude is positive for north, negative for south.
 * Longitude is positive for east, negative for west.
 */
export interface Coordinates {
	latitude: number; // -90 to 90
	longitude: number; // -180 to 180
}

/**
 * A location with timezone information for displaying local times.
 * Extends Coordinates with timezone data and optional display name.
 */
export interface Location extends Coordinates {
	timezone: string; // IANA timezone identifier like "America/Los_Angeles"
	name?: string; // display name from geocoding
	timezoneIsEstimate?: boolean; // true when tz-lookup fell back to UTC
}

/**
 * A geocoded location with attribution for display.
 * The attribution must be shown in UI per OpenStreetMap license requirements.
 */
export interface LocationResult {
	location: Location;
	attribution: string; // OpenStreetMap attribution for display
}

/**
 * Options for geocoding API calls.
 */
export interface GeocodingOptions {
	limit?: number; // max results to return, default 5
	bounded?: boolean; // restrict to viewport bounds
}

/**
 * Structured error types for geocoding failures.
 * Each type represents a distinct failure mode with relevant details.
 */
export type GeocodingError =
	| { type: 'rate-limited'; retryAfter: number }
	| { type: 'network-error'; message: string }
	| { type: 'no-results'; query: string }
	| { type: 'invalid-response'; message: string };

/**
 * Result of a geocoding operation. Either succeeds with results
 * or fails with a structured error indicating what went wrong.
 */
export type GeocodingResult =
	| { success: true; results: LocationResult[] }
	| { success: false; error: GeocodingError };

/**
 * The format detected when parsing user-entered coordinates.
 * Helps users understand how their input was interpreted.
 */
export type CoordinateFormat = 'decimal' | 'dms' | 'ddm' | 'unknown';

/**
 * Successfully parsed coordinates with detected format.
 * The format field indicates how the input string was interpreted.
 */
export interface ParsedCoordinates extends Coordinates {
	format: CoordinateFormat;
}

/**
 * Structured error types for coordinate parsing failures.
 * Provides specific information to help users correct their input.
 */
export type ParseError =
	| { type: 'invalid-format'; input: string }
	| { type: 'out-of-range'; field: 'latitude' | 'longitude'; value: number };

/**
 * Result of parsing a coordinate string. Either succeeds with
 * normalized decimal coordinates or fails with a descriptive error.
 */
export type ParseResult =
	| { success: true; coordinates: ParsedCoordinates }
	| { success: false; error: ParseError };

/**
 * Validation constants for coordinate ranges.
 */
export const LATITUDE_MIN = -90;
export const LATITUDE_MAX = 90;
export const LONGITUDE_MIN = -180;
export const LONGITUDE_MAX = 180;

/**
 * Rate limiting constant for Nominatim API (one request per second).
 */
export const GEOCODING_RATE_LIMIT_MS = 1000;
