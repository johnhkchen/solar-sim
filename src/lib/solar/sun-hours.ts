/**
 * Sun hours integration module.
 *
 * This module computes total sun hours for a day by sampling solar altitude
 * at regular intervals. It uses the position module to get altitude readings
 * and counts intervals where the sun is above the horizon.
 */

import { getSunPosition, getSunTimes, getPolarCondition } from './position.js';
import type { Coordinates, DailySunData, PolarCondition } from './types.js';
import { SAMPLING_INTERVAL_MINUTES, SAMPLES_PER_DAY } from './types.js';

/**
 * Creates a Date object representing the start of a day in UTC.
 * Sets hours, minutes, seconds, and milliseconds to zero.
 */
function getStartOfDayUTC(date: Date): Date {
	const start = new Date(date);
	start.setUTCHours(0, 0, 0, 0);
	return start;
}

/**
 * Computes total sun hours for a single day at the specified location.
 *
 * The algorithm samples solar altitude at 5-minute intervals throughout
 * the 24-hour period starting at midnight UTC. Each interval where the
 * sun's altitude exceeds zero contributes to the total. For polar regions
 * experiencing midnight sun or polar night, the function takes a fast path
 * and returns 24 or 0 hours respectively.
 *
 * @param coords - Geographic coordinates of the location
 * @param date - The day to calculate sun hours for (time component is ignored)
 * @returns DailySunData with sun hours, sun times, and polar condition
 */
export function getDailySunHours(coords: Coordinates, date: Date): DailySunData {
	const sunTimes = getSunTimes(coords, date);
	const polarCondition = getPolarCondition(coords, date);

	// Fast path for polar conditions where we already know the answer
	if (polarCondition === 'midnight-sun') {
		return {
			date: getStartOfDayUTC(date),
			sunHours: 24,
			sunTimes,
			polarCondition
		};
	}

	if (polarCondition === 'polar-night') {
		return {
			date: getStartOfDayUTC(date),
			sunHours: 0,
			sunTimes,
			polarCondition
		};
	}

	// Normal condition: sample altitude at regular intervals
	const startOfDay = getStartOfDayUTC(date);
	let positiveAltitudeCount = 0;

	for (let i = 0; i < SAMPLES_PER_DAY; i++) {
		const sampleTime = new Date(
			startOfDay.getTime() + i * SAMPLING_INTERVAL_MINUTES * 60 * 1000
		);
		const position = getSunPosition(coords, sampleTime);

		if (position.altitude > 0) {
			positiveAltitudeCount++;
		}
	}

	// Convert sample count to hours
	// Each sample represents SAMPLING_INTERVAL_MINUTES of time
	const sunHours = (positiveAltitudeCount * SAMPLING_INTERVAL_MINUTES) / 60;

	return {
		date: startOfDay,
		sunHours,
		sunTimes,
		polarCondition
	};
}
