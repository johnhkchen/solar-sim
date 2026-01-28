/**
 * Seasonal aggregation module.
 *
 * This module computes sun hours across date ranges and produces averages
 * and patterns. It can calculate summaries for arbitrary ranges, single months,
 * or full years, making it useful for planning and analysis.
 */

import { getDailySunHours } from './sun-hours.js';
import type { Coordinates, DailySunData, SeasonalSummary } from './types.js';

/**
 * Creates a Date representing the start of a day in UTC.
 * Normalizes time components to zero for consistent date comparison.
 */
function startOfDayUTC(date: Date): Date {
	const d = new Date(date);
	d.setUTCHours(0, 0, 0, 0);
	return d;
}

/**
 * Adds a specified number of days to a date, returning a new Date.
 */
function addDays(date: Date, days: number): Date {
	const result = new Date(date);
	result.setUTCDate(result.getUTCDate() + days);
	return result;
}

/**
 * Returns the number of days in a given month (1-12) for a given year.
 * Accounts for leap years when calculating February.
 */
function getDaysInMonth(year: number, month: number): number {
	// Month is 1-indexed here but Date constructor expects 0-indexed month,
	// so passing `month` as the month argument gives us the first day of the next month.
	// Setting day to 0 gives the last day of the previous month (our target month).
	return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

/**
 * Checks if a year is a leap year.
 */
function isLeapYear(year: number): boolean {
	return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

/**
 * Computes summary statistics from an array of daily sun data.
 * Extracts min, max, average sun hours and counts polar condition days.
 */
function computeStats(dailyData: DailySunData[]): {
	averageSunHours: number;
	minSunHours: number;
	maxSunHours: number;
	daysOfMidnightSun: number;
	daysOfPolarNight: number;
} {
	if (dailyData.length === 0) {
		return {
			averageSunHours: 0,
			minSunHours: 0,
			maxSunHours: 0,
			daysOfMidnightSun: 0,
			daysOfPolarNight: 0
		};
	}

	let totalSunHours = 0;
	let minSunHours = Infinity;
	let maxSunHours = -Infinity;
	let daysOfMidnightSun = 0;
	let daysOfPolarNight = 0;

	for (const day of dailyData) {
		totalSunHours += day.sunHours;
		if (day.sunHours < minSunHours) minSunHours = day.sunHours;
		if (day.sunHours > maxSunHours) maxSunHours = day.sunHours;
		if (day.polarCondition === 'midnight-sun') daysOfMidnightSun++;
		if (day.polarCondition === 'polar-night') daysOfPolarNight++;
	}

	return {
		averageSunHours: totalSunHours / dailyData.length,
		minSunHours,
		maxSunHours,
		daysOfMidnightSun,
		daysOfPolarNight
	};
}

/**
 * Computes a seasonal summary for an arbitrary date range.
 *
 * This function iterates over every day from startDate to endDate (inclusive),
 * calculates daily sun hours for each day, and aggregates the results into
 * a summary with averages, minimums, maximums, and polar condition counts.
 *
 * For large ranges spanning many years, consider using getYearlySummary instead
 * which provides annual breakdowns more efficiently for display purposes.
 *
 * @param coords - Geographic coordinates of the location
 * @param startDate - First day of the range (inclusive)
 * @param endDate - Last day of the range (inclusive)
 * @returns SeasonalSummary with aggregate statistics and daily breakdown
 */
export function getSeasonalSummary(
	coords: Coordinates,
	startDate: Date,
	endDate: Date
): SeasonalSummary {
	const start = startOfDayUTC(startDate);
	const end = startOfDayUTC(endDate);

	// Collect daily data for every day in the range
	const dailyData: DailySunData[] = [];
	let currentDate = start;

	while (currentDate <= end) {
		dailyData.push(getDailySunHours(coords, currentDate));
		currentDate = addDays(currentDate, 1);
	}

	const stats = computeStats(dailyData);

	return {
		startDate: start,
		endDate: end,
		...stats,
		dailyData
	};
}

/**
 * Computes a summary for a single calendar month.
 *
 * This convenience function wraps getSeasonalSummary with appropriate date
 * boundaries for the specified month. It handles varying month lengths
 * including February in leap years.
 *
 * @param coords - Geographic coordinates of the location
 * @param year - Full year (e.g., 2024)
 * @param month - Month number, 1-indexed (1 = January, 12 = December)
 * @returns SeasonalSummary covering the entire month
 */
export function getMonthlySummary(
	coords: Coordinates,
	year: number,
	month: number
): SeasonalSummary {
	// Validate month range
	if (month < 1 || month > 12) {
		throw new Error(`Month must be between 1 and 12, received ${month}`);
	}

	const daysInMonth = getDaysInMonth(year, month);
	const startDate = new Date(Date.UTC(year, month - 1, 1));
	const endDate = new Date(Date.UTC(year, month - 1, daysInMonth));

	return getSeasonalSummary(coords, startDate, endDate);
}

/**
 * Computes monthly summaries for an entire year, providing annual patterns.
 *
 * This function returns an array of 12 SeasonalSummary objects, one for each
 * month of the year. The array is ordered January through December regardless
 * of hemisphere. This format is useful for visualizing how sun exposure varies
 * throughout the seasons.
 *
 * For locations in the southern hemisphere, remember that December-February
 * represents summer and June-August represents winter.
 *
 * @param coords - Geographic coordinates of the location
 * @param year - Full year to analyze (e.g., 2024)
 * @returns Array of 12 SeasonalSummary objects, one per month
 */
export function getYearlySummary(
	coords: Coordinates,
	year: number
): SeasonalSummary[] {
	const monthlySummaries: SeasonalSummary[] = [];

	for (let month = 1; month <= 12; month++) {
		monthlySummaries.push(getMonthlySummary(coords, year, month));
	}

	return monthlySummaries;
}

/**
 * Computes a single combined summary for an entire year.
 *
 * Unlike getYearlySummary which returns monthly breakdowns, this function
 * returns a single SeasonalSummary covering all 365 (or 366) days of the year.
 * This is useful when you need overall annual statistics rather than monthly
 * patterns.
 *
 * @param coords - Geographic coordinates of the location
 * @param year - Full year to analyze (e.g., 2024)
 * @returns SeasonalSummary covering the entire year
 */
export function getAnnualSummary(
	coords: Coordinates,
	year: number
): SeasonalSummary {
	const startDate = new Date(Date.UTC(year, 0, 1));
	const endDate = new Date(Date.UTC(year, 11, 31));

	return getSeasonalSummary(coords, startDate, endDate);
}
