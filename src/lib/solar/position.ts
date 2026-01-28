/**
 * Sun position calculation module.
 *
 * This module wraps SunCalc to provide type-safe interfaces for computing
 * sun position and sun times at any location. It handles radian-to-degree
 * conversion and detects polar conditions when the sun never rises or sets.
 */

import SunCalc from 'suncalc';
import type { Coordinates, SolarPosition, SunTimes, PolarCondition } from './types.js';

/**
 * Converts radians to degrees.
 */
function radToDeg(rad: number): number {
	return rad * (180 / Math.PI);
}

/**
 * Normalizes an azimuth angle to the range 0-360 degrees.
 * SunCalc returns azimuth as radians measured from south,
 * so we convert to degrees and rotate to measure from north.
 */
function normalizeAzimuth(azimuthRad: number): number {
	let degrees = radToDeg(azimuthRad);
	// SunCalc measures from south, so add 180 to measure from north
	degrees = degrees + 180;
	// Normalize to 0-360 range
	while (degrees < 0) degrees += 360;
	while (degrees >= 360) degrees -= 360;
	return degrees;
}

/**
 * Returns the sun's position (altitude and azimuth) for a specific moment.
 *
 * @param coords - Geographic coordinates of the location
 * @param date - The moment to calculate position for
 * @returns SolarPosition with altitude in degrees above horizon and azimuth as compass bearing
 */
export function getSunPosition(coords: Coordinates, date: Date): SolarPosition {
	const pos = SunCalc.getPosition(date, coords.latitude, coords.longitude);

	return {
		altitude: radToDeg(pos.altitude),
		azimuth: normalizeAzimuth(pos.azimuth),
		timestamp: date
	};
}

/**
 * Detects the polar condition for a given day based on sun times.
 * When SunCalc returns NaN for sunrise or sunset, it means that event
 * doesn't occur. We determine which condition applies by checking
 * whether the sun is above or below the horizon at solar noon.
 */
function detectPolarCondition(
	times: SunCalc.GetTimesResult,
	coords: Coordinates,
	date: Date
): PolarCondition {
	const sunriseInvalid = times.sunrise === null || isNaN(times.sunrise.getTime());
	const sunsetInvalid = times.sunset === null || isNaN(times.sunset.getTime());

	if (!sunriseInvalid && !sunsetInvalid) {
		return 'normal';
	}

	// Check sun position at solar noon to determine which polar condition
	const noonPosition = getSunPosition(coords, times.solarNoon);

	if (noonPosition.altitude > 0) {
		// Sun is above horizon at noon but there's no sunrise/sunset
		// This means the sun never sets (midnight sun)
		return 'midnight-sun';
	} else {
		// Sun is below horizon at noon and there's no sunrise/sunset
		// This means the sun never rises (polar night)
		return 'polar-night';
	}
}

/**
 * Calculates day length from sunrise and sunset times.
 * Returns 24 for midnight sun, 0 for polar night.
 */
function calculateDayLength(
	sunrise: Date | null,
	sunset: Date | null,
	polarCondition: PolarCondition
): number {
	if (polarCondition === 'midnight-sun') {
		return 24;
	}
	if (polarCondition === 'polar-night') {
		return 0;
	}
	if (sunrise && sunset) {
		return (sunset.getTime() - sunrise.getTime()) / (1000 * 60 * 60);
	}
	return 0;
}

/**
 * Returns sun event times (sunrise, sunset, solar noon) for a specific day.
 *
 * For polar regions during summer or winter, sunrise or sunset may be null
 * when the sun never sets (midnight sun) or never rises (polar night).
 * The polarCondition return value from getDailySunData indicates which case applies.
 *
 * @param coords - Geographic coordinates of the location
 * @param date - The day to calculate times for (time component is ignored)
 * @returns SunTimes with event times and day length, or null values for polar conditions
 */
export function getSunTimes(coords: Coordinates, date: Date): SunTimes {
	const times = SunCalc.getTimes(date, coords.latitude, coords.longitude);

	const polarCondition = detectPolarCondition(times, coords, date);

	// Determine valid sunrise and sunset values
	const sunrise =
		polarCondition === 'normal' && times.sunrise && !isNaN(times.sunrise.getTime())
			? times.sunrise
			: null;

	const sunset =
		polarCondition === 'normal' && times.sunset && !isNaN(times.sunset.getTime())
			? times.sunset
			: null;

	const dayLength = calculateDayLength(sunrise, sunset, polarCondition);

	return {
		sunrise,
		sunset,
		solarNoon: times.solarNoon,
		dayLength
	};
}

/**
 * Returns the polar condition for a specific day at a location.
 * This is useful when you need to know the condition without computing
 * the full sun times structure.
 *
 * @param coords - Geographic coordinates of the location
 * @param date - The day to check
 * @returns PolarCondition indicating normal, midnight-sun, or polar-night
 */
export function getPolarCondition(coords: Coordinates, date: Date): PolarCondition {
	const times = SunCalc.getTimes(date, coords.latitude, coords.longitude);
	return detectPolarCondition(times, coords, date);
}
