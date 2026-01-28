/**
 * Coordinate parsing and validation module.
 *
 * This module handles parsing user-entered coordinates in various formats
 * (decimal degrees, degrees-minutes-seconds, etc.) and validating that
 * coordinates fall within valid geographic ranges.
 */

import { convert as parseCoords } from 'geo-coordinates-parser';
import {
	type Coordinates,
	type CoordinateFormat,
	type ParsedCoordinates,
	type ParseError,
	type ParseResult,
	LATITUDE_MIN,
	LATITUDE_MAX,
	LONGITUDE_MIN,
	LONGITUDE_MAX
} from './types.js';

/**
 * Validates that coordinates fall within valid geographic ranges.
 * Returns true if both latitude and longitude are within bounds.
 *
 * @param latitude - Value to check, should be between -90 and 90
 * @param longitude - Value to check, should be between -180 and 180
 * @returns true if coordinates are valid, false otherwise
 */
export function validateCoordinates(latitude: number, longitude: number): boolean {
	return (
		latitude >= LATITUDE_MIN &&
		latitude <= LATITUDE_MAX &&
		longitude >= LONGITUDE_MIN &&
		longitude <= LONGITUDE_MAX
	);
}

/**
 * Validates coordinates and returns detailed error information if invalid.
 * This function provides structured errors that the UI can use to show
 * specific feedback about what's wrong with the input.
 *
 * @param coordinates - Coordinates to validate
 * @returns ParseResult indicating success or specific validation error
 */
export function validateCoordinatesWithError(coordinates: Coordinates): ParseResult {
	if (coordinates.latitude < LATITUDE_MIN || coordinates.latitude > LATITUDE_MAX) {
		return {
			success: false,
			error: {
				type: 'out-of-range',
				field: 'latitude',
				value: coordinates.latitude
			}
		};
	}

	if (coordinates.longitude < LONGITUDE_MIN || coordinates.longitude > LONGITUDE_MAX) {
		return {
			success: false,
			error: {
				type: 'out-of-range',
				field: 'longitude',
				value: coordinates.longitude
			}
		};
	}

	return {
		success: true,
		coordinates: {
			...coordinates,
			format: 'decimal'
		}
	};
}

/**
 * Pattern for simple decimal degree coordinates. Matches formats like:
 * - "45.5231, -122.6765"
 * - "45.5231 -122.6765"
 * - "-33.8688, 151.2093"
 * - "90, 0" (boundary values)
 *
 * This handles the common case of copy-pasting from Google Maps or similar.
 */
const DECIMAL_PATTERN =
	/^\s*(-?\d+(?:\.\d*)?)\s*[,\s]\s*(-?\d+(?:\.\d*)?)\s*$/;

/**
 * Pattern for decimal degrees with hemisphere letters (N/S/E/W).
 * Matches formats like:
 * - "45.5231N 122.6765W"
 * - "45.5231 N, 122.6765 W"
 * - "N 45.5231, W 122.6765"
 */
const DECIMAL_WITH_HEMISPHERE_PATTERN =
	/^\s*([NSEW])?\s*(-?\d+(?:\.\d*)?)\s*([NS])?\s*[,\s]+\s*([NSEW])?\s*(-?\d+(?:\.\d*)?)\s*([EW])?\s*$/i;

/**
 * Attempts to parse simple decimal format coordinates directly.
 * This handles the common case where geo-coordinates-parser might
 * misinterpret values like "45.5" as degrees-minutes.
 */
function tryParseDecimalFormat(input: string): { latitude: number; longitude: number } | null {
	// Try simple decimal format first (most common case)
	const simpleMatch = input.match(DECIMAL_PATTERN);
	if (simpleMatch) {
		const lat = parseFloat(simpleMatch[1]);
		const lon = parseFloat(simpleMatch[2]);
		if (!isNaN(lat) && !isNaN(lon)) {
			return { latitude: lat, longitude: lon };
		}
	}

	// Try decimal with hemisphere letters
	const hemisphereMatch = input.match(DECIMAL_WITH_HEMISPHERE_PATTERN);
	if (hemisphereMatch) {
		const [, preLat, latVal, postLat, preLon, lonVal, postLon] = hemisphereMatch;

		let lat = parseFloat(latVal);
		let lon = parseFloat(lonVal);

		if (isNaN(lat) || isNaN(lon)) {
			return null;
		}

		// Apply hemisphere sign if present
		const latHemi = (preLat || postLat || '').toUpperCase();
		const lonHemi = (preLon || postLon || '').toUpperCase();

		if (latHemi === 'S') lat = -Math.abs(lat);
		else if (latHemi === 'N') lat = Math.abs(lat);

		if (lonHemi === 'W') lon = -Math.abs(lon);
		else if (lonHemi === 'E') lon = Math.abs(lon);

		return { latitude: lat, longitude: lon };
	}

	return null;
}

/**
 * Detects the format of the input coordinate string.
 * This helps users understand how their input was interpreted.
 */
function detectFormat(input: string): CoordinateFormat {
	// Check for DMS indicators (degrees symbol, minutes, seconds)
	const hasDegreeSymbol = /[°]/.test(input);
	const hasMinuteSymbol = /['′]/.test(input);
	const hasSecondSymbol = /["″]/.test(input);

	// Check for direction letters
	const hasDirectionLetters = /[NSEW]/i.test(input);

	// If we have degree and minute symbols but no seconds, it's DDM
	if (hasDegreeSymbol && hasMinuteSymbol && !hasSecondSymbol) {
		return 'ddm';
	}

	// If we have degree, minute, and second symbols, it's DMS
	if (hasDegreeSymbol && (hasMinuteSymbol || hasSecondSymbol)) {
		return 'dms';
	}

	// If we have direction letters with space-separated numbers, likely DMS
	if (hasDirectionLetters && /\d+\s+\d+\s+[\d.]+/.test(input)) {
		return 'dms';
	}

	// Pure numeric with optional negative signs is decimal
	if (/^[\s,\-\d.]+$/.test(input.trim())) {
		return 'decimal';
	}

	// Decimal with hemisphere letters
	if (hasDirectionLetters && DECIMAL_WITH_HEMISPHERE_PATTERN.test(input)) {
		return 'decimal';
	}

	// Default to unknown if we can't determine format
	return 'unknown';
}

/**
 * Parses a coordinate string in various formats into normalized decimal degrees.
 *
 * Supported formats include:
 * - Decimal degrees: "45.5231, -122.6765" or "45.5231 -122.6765"
 * - Degrees-minutes-seconds: "45° 31' 23\" N, 122° 40' 35\" W"
 * - Degrees-decimal-minutes: "45° 31.383' N, 122° 40.583' W"
 * - Various combinations with or without hemisphere indicators
 *
 * The function handles simple decimal format directly for reliability
 * and uses geo-coordinates-parser for DMS and complex formats.
 *
 * @param input - Coordinate string to parse
 * @returns ParseResult with normalized decimal coordinates or structured error
 */
export function parseCoordinates(input: string): ParseResult {
	const trimmedInput = input.trim();

	if (!trimmedInput) {
		return {
			success: false,
			error: { type: 'invalid-format', input }
		};
	}

	// Try simple decimal format first - this handles the common case
	// and avoids geo-coordinates-parser's quirks with values like "45.5"
	const decimalResult = tryParseDecimalFormat(trimmedInput);
	if (decimalResult) {
		const { latitude, longitude } = decimalResult;

		// Validate range
		if (latitude < LATITUDE_MIN || latitude > LATITUDE_MAX) {
			return {
				success: false,
				error: { type: 'out-of-range', field: 'latitude', value: latitude }
			};
		}

		if (longitude < LONGITUDE_MIN || longitude > LONGITUDE_MAX) {
			return {
				success: false,
				error: { type: 'out-of-range', field: 'longitude', value: longitude }
			};
		}

		return {
			success: true,
			coordinates: {
				latitude,
				longitude,
				format: 'decimal'
			}
		};
	}

	// Fall back to geo-coordinates-parser for DMS and complex formats
	try {
		const result = parseCoords(trimmedInput);

		const latitude = result.decimalLatitude;
		const longitude = result.decimalLongitude;

		// Validate the parsed coordinates are within range
		if (latitude < LATITUDE_MIN || latitude > LATITUDE_MAX) {
			return {
				success: false,
				error: { type: 'out-of-range', field: 'latitude', value: latitude }
			};
		}

		if (longitude < LONGITUDE_MIN || longitude > LONGITUDE_MAX) {
			return {
				success: false,
				error: { type: 'out-of-range', field: 'longitude', value: longitude }
			};
		}

		const format = detectFormat(trimmedInput);

		return {
			success: true,
			coordinates: {
				latitude,
				longitude,
				format
			}
		};
	} catch {
		// geo-coordinates-parser throws when it cannot parse the input
		return {
			success: false,
			error: { type: 'invalid-format', input }
		};
	}
}

/**
 * Convenience function to parse coordinates and return just the values
 * without the format information. Returns null if parsing fails.
 *
 * @param input - Coordinate string to parse
 * @returns Coordinates object or null if parsing failed
 */
export function tryParseCoordinates(input: string): Coordinates | null {
	const result = parseCoordinates(input);
	if (result.success) {
		return {
			latitude: result.coordinates.latitude,
			longitude: result.coordinates.longitude
		};
	}
	return null;
}

/**
 * Formats coordinates as a human-readable decimal string.
 * Useful for displaying normalized coordinates back to the user.
 *
 * @param coordinates - Coordinates to format
 * @param precision - Number of decimal places (default 6, roughly 0.1m accuracy)
 * @returns Formatted string like "45.5231, -122.6765"
 */
export function formatCoordinates(coordinates: Coordinates, precision: number = 6): string {
	return `${coordinates.latitude.toFixed(precision)}, ${coordinates.longitude.toFixed(precision)}`;
}

/**
 * Formats coordinates using degrees-minutes-seconds notation.
 *
 * @param coordinates - Coordinates to format
 * @returns Formatted string like "45° 31' 23" N, 122° 40' 35" W"
 */
export function formatCoordinatesDMS(coordinates: Coordinates): string {
	const formatDMS = (value: number, positive: string, negative: string): string => {
		const absolute = Math.abs(value);
		const degrees = Math.floor(absolute);
		const minutesDecimal = (absolute - degrees) * 60;
		const minutes = Math.floor(minutesDecimal);
		const seconds = ((minutesDecimal - minutes) * 60).toFixed(1);
		const direction = value >= 0 ? positive : negative;
		return `${degrees}° ${minutes}' ${seconds}" ${direction}`;
	};

	const lat = formatDMS(coordinates.latitude, 'N', 'S');
	const lon = formatDMS(coordinates.longitude, 'E', 'W');
	return `${lat}, ${lon}`;
}

/**
 * Gets a user-friendly error message for a parse error.
 * Used by UI components to display helpful feedback.
 *
 * @param error - The ParseError to describe
 * @returns Human-readable error message
 */
export function getParseErrorMessage(error: ParseError): string {
	switch (error.type) {
		case 'invalid-format':
			return `Unable to parse coordinates from "${error.input}". Try formats like "45.5, -122.6" or "45° 30' N, 122° 36' W".`;
		case 'out-of-range':
			if (error.field === 'latitude') {
				return `Latitude ${error.value} is out of range. Must be between -90 and 90.`;
			}
			return `Longitude ${error.value} is out of range. Must be between -180 and 180.`;
	}
}
