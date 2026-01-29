/**
 * Geocoding module for Nominatim API integration.
 *
 * This module handles converting addresses to coordinates using the OpenStreetMap
 * Nominatim service. It implements client-side rate limiting to respect Nominatim's
 * one-request-per-second policy and provides structured error handling for network
 * failures, rate limit violations, and empty results.
 */

import type {
	Coordinates,
	Location,
	LocationResult,
	GeocodingOptions,
	GeocodingError,
	GeocodingResult
} from './types.js';
import { GEOCODING_RATE_LIMIT_MS } from './types.js';
import { getTimezone } from './timezone.js';

/**
 * Nominatim API response structure for a single place result.
 */
interface NominatimPlace {
	place_id: number;
	licence: string;
	osm_type: string;
	osm_id: number;
	lat: string;
	lon: string;
	display_name: string;
	class: string;
	type: string;
	importance: number;
	boundingbox: string[];
}

/**
 * User-Agent header identifying our application as required by Nominatim usage policy.
 */
const USER_AGENT = 'SolarSim/1.0 (https://github.com/solar-sim; solar-sim@example.com)';

/**
 * Nominatim API base URL.
 */
const NOMINATIM_BASE_URL = 'https://nominatim.openstreetmap.org';

/**
 * OpenStreetMap attribution text required when displaying geocoding results.
 */
const OSM_ATTRIBUTION = 'Data © OpenStreetMap contributors';

/**
 * Timestamp of the last geocoding request. Used for rate limiting.
 */
let lastRequestTime = 0;

/**
 * Queued request promise. When a request is waiting for rate limit window,
 * subsequent requests chain onto this promise to maintain ordering.
 */
let pendingRequest: Promise<void> | null = null;

/**
 * Waits until the rate limit window has passed since the last request.
 * Multiple concurrent calls are serialized to ensure proper spacing.
 */
async function waitForRateLimit(): Promise<void> {
	const now = Date.now();
	const timeSinceLastRequest = now - lastRequestTime;
	const waitTime = Math.max(0, GEOCODING_RATE_LIMIT_MS - timeSinceLastRequest);

	if (waitTime > 0) {
		if (pendingRequest) {
			await pendingRequest;
			return waitForRateLimit();
		}

		pendingRequest = new Promise((resolve) => {
			setTimeout(() => {
				pendingRequest = null;
				resolve();
			}, waitTime);
		});

		await pendingRequest;
	}

	lastRequestTime = Date.now();
}

/**
 * Builds the Nominatim search URL with query parameters.
 */
function buildSearchUrl(query: string, options: GeocodingOptions): string {
	const params = new URLSearchParams({
		q: query,
		format: 'json',
		limit: String(options.limit ?? 5)
	});

	return `${NOMINATIM_BASE_URL}/search?${params.toString()}`;
}

/**
 * Converts a Nominatim place result to our internal LocationResult type.
 */
function parseNominatimPlace(place: NominatimPlace): LocationResult {
	const latitude = parseFloat(place.lat);
	const longitude = parseFloat(place.lon);

	const coordinates: Coordinates = { latitude, longitude };
	const timezoneResult = getTimezone(coordinates);

	const location: Location = {
		latitude,
		longitude,
		timezone: timezoneResult.timezone,
		name: place.display_name,
		timezoneIsEstimate: timezoneResult.isEstimate
	};

	return {
		location,
		attribution: OSM_ATTRIBUTION
	};
}

/**
 * Geocodes an address string to coordinates using the Nominatim API.
 *
 * This function implements client-side rate limiting to respect Nominatim's
 * one-request-per-second policy. Multiple concurrent calls are serialized
 * to ensure proper spacing between requests.
 *
 * @param query - Address or place name to search for
 * @param options - Optional configuration for the search
 * @returns GeocodingResult with either results array or structured error
 *
 * @example
 * ```ts
 * const result = await geocodeAddress('Portland, OR');
 * if (result.success) {
 *   console.log(result.results[0].location);
 * } else {
 *   console.error(result.error.type);
 * }
 * ```
 */
export async function geocodeAddress(
	query: string,
	options: GeocodingOptions = {}
): Promise<GeocodingResult> {
	const trimmedQuery = query.trim();

	if (!trimmedQuery) {
		return {
			success: false,
			error: { type: 'no-results', query }
		};
	}

	await waitForRateLimit();

	const url = buildSearchUrl(trimmedQuery, options);

	let response: Response;
	try {
		response = await fetch(url, {
			headers: {
				'User-Agent': USER_AGENT,
				Accept: 'application/json'
			}
		});
	} catch (error) {
		const message = error instanceof Error ? error.message : 'Unknown network error';
		return {
			success: false,
			error: { type: 'network-error', message }
		};
	}

	if (response.status === 429) {
		const retryAfter = parseInt(response.headers.get('Retry-After') ?? '1', 10);
		return {
			success: false,
			error: { type: 'rate-limited', retryAfter: retryAfter * 1000 }
		};
	}

	if (!response.ok) {
		return {
			success: false,
			error: {
				type: 'network-error',
				message: `HTTP ${response.status}: ${response.statusText}`
			}
		};
	}

	let data: unknown;
	try {
		data = await response.json();
	} catch {
		return {
			success: false,
			error: {
				type: 'invalid-response',
				message: 'Failed to parse JSON response'
			}
		};
	}

	if (!Array.isArray(data)) {
		return {
			success: false,
			error: {
				type: 'invalid-response',
				message: 'Expected array response from Nominatim'
			}
		};
	}

	if (data.length === 0) {
		return {
			success: false,
			error: { type: 'no-results', query: trimmedQuery }
		};
	}

	const results = data.map((place: NominatimPlace) => parseNominatimPlace(place));

	return {
		success: true,
		results
	};
}

/**
 * Gets a user-friendly error message for a geocoding error.
 *
 * @param error - The GeocodingError to describe
 * @returns Human-readable error message
 */
export function getGeocodingErrorMessage(error: GeocodingError): string {
	switch (error.type) {
		case 'rate-limited':
			return `Please wait a moment before searching again.`;
		case 'network-error':
			return `Unable to reach location service. ${error.message}`;
		case 'no-results':
			return `No locations found for "${error.query}". Try a different search term.`;
		case 'invalid-response':
			return `Received an invalid response from the location service.`;
	}
}

/**
 * Resets the rate limiter state. Primarily useful for testing.
 */
export function resetRateLimiter(): void {
	lastRequestTime = 0;
	pendingRequest = null;
}
