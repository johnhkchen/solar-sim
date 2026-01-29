/**
 * Slope data types and calculations for terrain-adjusted sun analysis.
 *
 * This module handles the geometric relationship between the sun and sloped
 * terrain. A south-facing slope receives more winter sun because it effectively
 * "tilts" toward the sun, increasing the angle of incidence. Conversely, a
 * north-facing slope receives less direct sunlight. The math involves computing
 * the dot product between the sun vector and the surface normal.
 */

import type { SolarPosition, Coordinates, DailySunData } from './types.js';
import { SAMPLING_INTERVAL_MINUTES, SAMPLES_PER_DAY } from './types.js';
import { getSunPosition, getSunTimes, getPolarCondition } from './position.js';

/**
 * Represents the slope of a plot of land.
 * Angle measures the steepness (0 is flat, 30 is quite steep for gardening).
 * Aspect indicates the compass direction the slope faces (180 is south-facing
 * in the northern hemisphere, which is optimal for sun exposure).
 */
export interface PlotSlope {
	angle: number; // degrees from horizontal, 0-45 typical range
	aspect: number; // compass bearing the slope faces, 0-360 where 0 is north
}

/**
 * Common slope presets for quick selection in the UI. Each preset represents
 * a typical terrain configuration that gardeners might encounter.
 */
export const SLOPE_PRESETS: Record<string, PlotSlope> = {
	flat: { angle: 0, aspect: 180 },
	'gentle-south': { angle: 5, aspect: 180 },
	'moderate-south': { angle: 15, aspect: 180 },
	'gentle-north': { angle: 5, aspect: 0 },
	'gentle-east': { angle: 5, aspect: 90 },
	'gentle-west': { angle: 5, aspect: 270 }
};

/**
 * Calculates the irradiance factor for sunlight hitting a sloped surface.
 *
 * The irradiance factor represents what fraction of maximum possible sunlight
 * the surface receives given the sun's position and the slope orientation.
 * A value of 1.0 means the sun is perpendicular to the surface (maximum
 * intensity), while 0 means the surface faces away from the sun (no direct
 * light). For a flat surface at sun altitude A, the factor equals sin(A).
 *
 * The calculation uses the dot product of the sun direction vector and the
 * surface normal vector. When positive, the surface is illuminated; when
 * negative or zero, the surface is in self-shadow because it faces away.
 *
 * @param sun - Current sun position with altitude and azimuth
 * @param slope - Terrain slope angle and aspect direction
 * @returns Irradiance factor between 0 and 1
 */
export function calculateSlopeIrradiance(sun: SolarPosition, slope: PlotSlope): number {
	if (sun.altitude <= 0) return 0;

	// Convert degrees to radians for trig functions
	const sunAlt = sun.altitude * (Math.PI / 180);
	const sunAz = sun.azimuth * (Math.PI / 180);
	const slopeAngle = slope.angle * (Math.PI / 180);
	const slopeAspect = slope.aspect * (Math.PI / 180);

	// The formula computes dot(sun_vector, surface_normal):
	// cos(slope) * sin(sun_alt) gives the vertical component contribution,
	// while sin(slope) * cos(sun_alt) * cos(azimuth_diff) gives the
	// horizontal component contribution based on how well the slope
	// orientation matches the sun direction.
	const irradiance =
		Math.cos(slopeAngle) * Math.sin(sunAlt) +
		Math.sin(slopeAngle) * Math.cos(sunAlt) * Math.cos(sunAz - slopeAspect);

	// Return 0 for negative values (surface in self-shadow)
	return Math.max(0, irradiance);
}

/**
 * Calculates the effective sun altitude as seen by a sloped surface.
 *
 * This transforms the actual sun altitude into an "effective" altitude that
 * accounts for the slope's orientation. A south-facing slope makes the sun
 * appear higher (more direct), while a north-facing slope makes it appear
 * lower. The effective altitude is useful for understanding how slope
 * affects growing conditions.
 *
 * @param sun - Current sun position
 * @param slope - Terrain slope configuration
 * @returns Effective altitude in degrees, or 0 if surface is in shadow
 */
export function calculateEffectiveAltitude(sun: SolarPosition, slope: PlotSlope): number {
	const irradiance = calculateSlopeIrradiance(sun, slope);
	if (irradiance <= 0) return 0;

	// Convert irradiance factor back to angle: effective_alt = arcsin(irradiance)
	const effectiveAltRad = Math.asin(Math.min(1, irradiance));
	return effectiveAltRad * (180 / Math.PI);
}

/**
 * Computes the irradiance ratio comparing a sloped surface to a flat one.
 *
 * Values greater than 1 mean the slope receives more energy than flat ground,
 * while values less than 1 mean it receives less. This ratio helps gardeners
 * understand the benefit or penalty of their slope orientation. A south-facing
 * slope in winter might show a ratio of 1.4 or higher, meaning 40% more solar
 * energy than a flat surface at the same location.
 *
 * @param sun - Current sun position
 * @param slope - Terrain slope configuration
 * @returns Ratio of sloped to flat irradiance, or 1 if sun is below horizon
 */
export function calculateSlopeBoostFactor(sun: SolarPosition, slope: PlotSlope): number {
	if (sun.altitude <= 0) return 1;

	const slopedIrradiance = calculateSlopeIrradiance(sun, slope);

	// Flat surface irradiance is simply sin(altitude)
	const flatIrradiance = Math.sin(sun.altitude * (Math.PI / 180));

	if (flatIrradiance <= 0) return 1;

	return slopedIrradiance / flatIrradiance;
}

/**
 * Creates a Date object representing the start of a day in UTC.
 */
function getStartOfDayUTC(date: Date): Date {
	const start = new Date(date);
	start.setUTCHours(0, 0, 0, 0);
	return start;
}

/**
 * Computes effective sun hours for a sloped surface over a single day.
 *
 * Unlike the basic sun hours calculation which counts hours of daylight,
 * this function weights each time interval by the irradiance factor on
 * the sloped surface. The result represents "effective sun hours" - the
 * equivalent hours of perpendicular sunlight the surface receives.
 *
 * For example, a south-facing slope might accumulate 8 effective sun hours
 * while a flat surface at the same location only gets 6, because the slope
 * captures sunlight at a more favorable angle throughout the day.
 *
 * @param coords - Geographic coordinates
 * @param date - Date to calculate for
 * @param slope - Terrain slope configuration
 * @returns DailySunData with slope-adjusted effective sun hours
 */
export function getDailySunHoursWithSlope(
	coords: Coordinates,
	date: Date,
	slope: PlotSlope
): DailySunData {
	const sunTimes = getSunTimes(coords, date);
	const polarCondition = getPolarCondition(coords, date);

	// For polar conditions, we still need to calculate because slope affects
	// the effective irradiance even during midnight sun
	const startOfDay = getStartOfDayUTC(date);
	let irradianceSum = 0;

	for (let i = 0; i < SAMPLES_PER_DAY; i++) {
		const sampleTime = new Date(startOfDay.getTime() + i * SAMPLING_INTERVAL_MINUTES * 60 * 1000);
		const position = getSunPosition(coords, sampleTime);

		if (position.altitude > 0) {
			const irradiance = calculateSlopeIrradiance(position, slope);
			irradianceSum += irradiance;
		}
	}

	// Convert irradiance sum to effective sun hours. Each sample represents
	// SAMPLING_INTERVAL_MINUTES of time, and the irradiance factor scales
	// that contribution.
	const effectiveSunHours = (irradianceSum * SAMPLING_INTERVAL_MINUTES) / 60;

	return {
		date: startOfDay,
		sunHours: effectiveSunHours,
		sunTimes,
		polarCondition
	};
}

/**
 * Calculates the slope boost percentage for a typical day.
 *
 * This is a convenience function for UI display, showing how much extra
 * (or reduced) sun exposure a slope provides compared to flat ground.
 * The percentage accounts for the full day's sun path, not just a single
 * moment.
 *
 * @param coords - Geographic coordinates
 * @param date - Representative date (e.g., winter solstice for worst case)
 * @param slope - Terrain slope configuration
 * @returns Percentage change in sun hours (e.g., +14 for 14% more sun)
 */
export function calculateDailyBoostPercent(
	coords: Coordinates,
	date: Date,
	slope: PlotSlope
): number {
	// Compare sloped vs flat sun hours
	const flatSlope: PlotSlope = { angle: 0, aspect: 180 };
	const slopedData = getDailySunHoursWithSlope(coords, date, slope);
	const flatData = getDailySunHoursWithSlope(coords, date, flatSlope);

	if (flatData.sunHours <= 0) return 0;

	const percentChange = ((slopedData.sunHours - flatData.sunHours) / flatData.sunHours) * 100;
	return Math.round(percentChange);
}

/**
 * Validates a slope configuration and returns a normalized version.
 *
 * Ensures angle is within the 0-45 degree range (steeper slopes are unusual
 * for gardening) and aspect is normalized to 0-360. Returns the flat preset
 * for invalid inputs.
 *
 * @param slope - Slope configuration to validate
 * @returns Normalized slope with valid ranges
 */
export function normalizeSlope(slope: PlotSlope): PlotSlope {
	let angle = Math.max(0, Math.min(45, slope.angle));
	let aspect = slope.aspect % 360;
	if (aspect < 0) aspect += 360;

	// Very small angles are effectively flat
	if (angle < 0.5) {
		return SLOPE_PRESETS.flat;
	}

	return { angle, aspect };
}

/**
 * Returns a human-readable description of a slope configuration.
 *
 * Converts the numeric values into text like "Gentle south-facing slope (5°)"
 * for display in the UI.
 *
 * @param slope - Slope configuration to describe
 * @returns Human-readable description
 */
export function describeSlopeDirection(slope: PlotSlope): string {
	if (slope.angle < 0.5) return 'Flat';

	const intensity =
		slope.angle < 8 ? 'Gentle' : slope.angle < 18 ? 'Moderate' : slope.angle < 30 ? 'Steep' : 'Very steep';

	// Convert aspect to compass direction
	const directions = ['north', 'northeast', 'east', 'southeast', 'south', 'southwest', 'west', 'northwest'];
	const index = Math.round(slope.aspect / 45) % 8;
	const direction = directions[index];

	return `${intensity} ${direction}-facing slope (${Math.round(slope.angle)}°)`;
}
