/**
 * Solar engine type definitions and constants.
 *
 * This module defines all TypeScript interfaces for the solar calculation engine,
 * along with configuration constants for sampling resolution.
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
 * Sun position at a specific moment in time.
 * Altitude is degrees above the horizon, negative when below.
 * Azimuth is compass bearing where 0 is north, 90 is east.
 */
export interface SolarPosition {
	altitude: number; // degrees above horizon, negative when below
	azimuth: number; // compass bearing 0-360, 0 is north
	timestamp: Date; // when this position was calculated
}

/**
 * Key sun event times for a specific day.
 * Sunrise and sunset can be null during polar conditions when
 * the sun never rises (polar night) or never sets (midnight sun).
 */
export interface SunTimes {
	sunrise: Date | null; // null during polar night
	sunset: Date | null; // null during midnight sun
	solarNoon: Date;
	dayLength: number; // hours, 0 for polar night, 24 for midnight sun
}

/**
 * Indicates whether a day experiences normal sunrise/sunset,
 * continuous daylight (midnight sun), or continuous darkness (polar night).
 */
export type PolarCondition = 'normal' | 'midnight-sun' | 'polar-night';

/**
 * Complete sun data for a single day at a specific location.
 * Combines sun hours, event times, and polar condition flag.
 */
export interface DailySunData {
	date: Date;
	sunHours: number;
	sunTimes: SunTimes;
	polarCondition: PolarCondition;
}

/**
 * Summary statistics across a date range.
 * Includes both aggregate values and per-day breakdown.
 */
export interface SeasonalSummary {
	startDate: Date;
	endDate: Date;
	averageSunHours: number;
	minSunHours: number;
	maxSunHours: number;
	daysOfMidnightSun: number;
	daysOfPolarNight: number;
	dailyData: DailySunData[];
}

/**
 * Sampling interval in minutes for sun-hour integration.
 * Research determined 5 minutes provides optimal accuracy-to-performance ratio,
 * yielding results accurate to within 2-3 minutes while keeping computation
 * under 100ms for a full year of daily calculations.
 */
export const SAMPLING_INTERVAL_MINUTES = 5;

/**
 * Number of samples per day at the current sampling interval.
 * Used by the integration module to iterate over a day.
 */
export const SAMPLES_PER_DAY = (24 * 60) / SAMPLING_INTERVAL_MINUTES;
