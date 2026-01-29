/**
 * Timezone detection module.
 *
 * This module wraps tz-lookup to infer IANA timezone identifiers from
 * geographic coordinates. It handles the edge case where tz-lookup
 * returns undefined for locations in international waters by falling
 * back to UTC and flagging the result as an estimate.
 */

import tzlookup from 'tz-lookup';
import type { Coordinates } from './types.js';

/**
 * Result of a timezone lookup operation.
 */
export interface TimezoneResult {
	/** IANA timezone identifier like "America/Los_Angeles" */
	timezone: string;
	/** True when tz-lookup returned undefined and we fell back to UTC */
	isEstimate: boolean;
}

/**
 * Looks up the IANA timezone for the given coordinates.
 *
 * Uses the tz-lookup library to determine timezone from latitude and
 * longitude. For most land locations, this returns the correct timezone.
 * For international waters or areas where tz-lookup returns undefined,
 * falls back to UTC and sets isEstimate to true so the UI can warn
 * users to verify the timezone manually.
 *
 * @param coordinates - The location to look up
 * @returns TimezoneResult with timezone identifier and estimate flag
 *
 * @example
 * ```ts
 * const result = getTimezone({ latitude: 45.5152, longitude: -122.6784 });
 * // result.timezone === "America/Los_Angeles"
 * // result.isEstimate === false
 * ```
 */
export function getTimezone(coordinates: Coordinates): TimezoneResult {
	const { latitude, longitude } = coordinates;

	const result = tzlookup(latitude, longitude);

	if (result === undefined) {
		return {
			timezone: 'UTC',
			isEstimate: true
		};
	}

	return {
		timezone: result,
		isEstimate: false
	};
}

/**
 * Convenience function that returns just the timezone string.
 * Use getTimezone if you need to know whether the result is an estimate.
 *
 * @param coordinates - The location to look up
 * @returns IANA timezone identifier, or "UTC" for unknown locations
 */
export function getTimezoneString(coordinates: Coordinates): string {
	return getTimezone(coordinates).timezone;
}
