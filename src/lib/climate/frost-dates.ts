/**
 * Frost date lookup for Solar-Sim.
 *
 * This module provides frost date estimates based on geographic location using
 * an embedded lookup table. Frost dates vary primarily with latitude, but are
 * also affected by elevation and proximity to large water bodies. The lookup
 * table uses latitude bands as the primary key with adjustments for these
 * secondary factors.
 *
 * Frost dates inherently have high year-to-year variance, so all results are
 * returned as ranges rather than single dates. Even station-based historical
 * averages can differ by 2-4 weeks from actual frost dates in any given year.
 */

import type { Coordinates } from '../geo/index.js';
import type {
	DayOfYearRange,
	FrostDates,
	FrostLookupEntry,
	FrostLookupOptions
} from './types.js';
import { ELEVATION_ADJUSTMENT_DAYS_PER_300M } from './types.js';

/**
 * Embedded frost date lookup table organized by latitude bands. Each entry
 * covers a 2.5-degree latitude range and provides median frost dates for
 * continental locations. The data is derived from NOAA climate normals and
 * represents typical patterns across North America, Europe, and other
 * temperate regions.
 *
 * Latitude bands progress from south to north. Southern latitudes (below 25°N)
 * are tropical with no typical frost, while northern latitudes (above 55°N)
 * have very short growing seasons.
 */
const FROST_LOOKUP_TABLE: FrostLookupEntry[] = [
	// Tropical/subtropical - minimal frost risk (southern tip of Florida, Hawaii)
	{ latMin: 20, latMax: 25, coastalModifier: -5, lastSpringDoy: 32, firstFallDoy: 350, varianceDays: 14 },

	// Deep South - very mild winters (southern Florida, Gulf Coast)
	{ latMin: 25, latMax: 27.5, coastalModifier: -7, lastSpringDoy: 45, firstFallDoy: 335, varianceDays: 14 },

	// Gulf states - mild winters (southern Texas, Louisiana, Mississippi, Alabama)
	{ latMin: 27.5, latMax: 30, coastalModifier: -7, lastSpringDoy: 60, firstFallDoy: 320, varianceDays: 14 },

	// Lower South - occasional hard freezes (central Texas, Georgia, South Carolina)
	{ latMin: 30, latMax: 32.5, coastalModifier: -7, lastSpringDoy: 75, firstFallDoy: 305, varianceDays: 14 },

	// Upper South - regular winter freezes (southern California inland, Arizona, New Mexico)
	{ latMin: 32.5, latMax: 35, coastalModifier: -10, lastSpringDoy: 90, firstFallDoy: 295, varianceDays: 14 },

	// Mid-Atlantic/Border states - moderate winters (North Carolina, Tennessee, Oklahoma)
	{ latMin: 35, latMax: 37.5, coastalModifier: -10, lastSpringDoy: 100, firstFallDoy: 285, varianceDays: 14 },

	// Central states - cold winters (Virginia, Kentucky, southern Missouri, Kansas)
	{ latMin: 37.5, latMax: 40, coastalModifier: -10, lastSpringDoy: 110, firstFallDoy: 275, varianceDays: 14 },

	// Northern tier lower - significant winter (Pennsylvania, Ohio, Indiana, Illinois)
	{ latMin: 40, latMax: 42.5, coastalModifier: -10, lastSpringDoy: 120, firstFallDoy: 265, varianceDays: 14 },

	// Northern tier upper - harsh winters (southern New York, Michigan, Wisconsin, Iowa)
	{ latMin: 42.5, latMax: 45, coastalModifier: -10, lastSpringDoy: 130, firstFallDoy: 255, varianceDays: 14 },

	// Northern plains/New England - very cold winters (Minnesota, Vermont, New Hampshire)
	{ latMin: 45, latMax: 47.5, coastalModifier: -10, lastSpringDoy: 140, firstFallDoy: 250, varianceDays: 14 },

	// Upper northern tier - extreme winters (northern Minnesota, Montana, North Dakota)
	{ latMin: 47.5, latMax: 50, coastalModifier: -10, lastSpringDoy: 145, firstFallDoy: 245, varianceDays: 14 },

	// Southern Canada - short growing season
	{ latMin: 50, latMax: 52.5, coastalModifier: -10, lastSpringDoy: 150, firstFallDoy: 240, varianceDays: 14 },

	// Central Canada - very short growing season
	{ latMin: 52.5, latMax: 55, coastalModifier: -10, lastSpringDoy: 155, firstFallDoy: 235, varianceDays: 14 },

	// Northern Canada/Alaska - extremely short growing season
	{ latMin: 55, latMax: 60, coastalModifier: -7, lastSpringDoy: 160, firstFallDoy: 230, varianceDays: 14 },

	// Far northern regions
	{ latMin: 60, latMax: 70, coastalModifier: -5, lastSpringDoy: 170, firstFallDoy: 220, varianceDays: 14 }
];

/**
 * Southern hemisphere frost table mirrors the northern hemisphere but with
 * seasons inverted. Spring frost occurs in September-November (DOY 240-330)
 * and fall frost occurs in March-May (DOY 60-150).
 */
const FROST_LOOKUP_TABLE_SOUTH: FrostLookupEntry[] = [
	// Subtropical southern hemisphere (northern Australia, southern Brazil)
	{ latMin: -25, latMax: -20, coastalModifier: -5, lastSpringDoy: 244, firstFallDoy: 166, varianceDays: 14 },

	// Temperate southern (southern Australia, central Argentina, South Africa)
	{ latMin: -30, latMax: -25, coastalModifier: -7, lastSpringDoy: 258, firstFallDoy: 152, varianceDays: 14 },

	// Cool temperate (Tasmania, southern Chile, New Zealand South Island)
	{ latMin: -35, latMax: -30, coastalModifier: -7, lastSpringDoy: 273, firstFallDoy: 135, varianceDays: 14 },

	// Cold temperate
	{ latMin: -40, latMax: -35, coastalModifier: -10, lastSpringDoy: 288, firstFallDoy: 121, varianceDays: 14 },

	// Sub-Antarctic
	{ latMin: -50, latMax: -40, coastalModifier: -10, lastSpringDoy: 305, firstFallDoy: 105, varianceDays: 14 },

	// Antarctic fringe
	{ latMin: -60, latMax: -50, coastalModifier: -5, lastSpringDoy: 320, firstFallDoy: 91, varianceDays: 14 }
];

/**
 * Finds the appropriate lookup table entry for a given latitude. Returns null
 * for tropical latitudes where frost is not a typical concern.
 */
function findLookupEntry(latitude: number): FrostLookupEntry | null {
	const absLat = Math.abs(latitude);

	// Tropical regions (within 20 degrees of equator) rarely experience frost
	if (absLat < 20) {
		return null;
	}

	const table = latitude >= 0 ? FROST_LOOKUP_TABLE : FROST_LOOKUP_TABLE_SOUTH;

	for (const entry of table) {
		// For southern hemisphere, latMin is more negative (e.g., -30) and latMax is less negative (e.g., -25)
		// So we compare against absolute values with correct ordering
		const entryLatMin = Math.min(Math.abs(entry.latMin), Math.abs(entry.latMax));
		const entryLatMax = Math.max(Math.abs(entry.latMin), Math.abs(entry.latMax));
		if (absLat >= entryLatMin && absLat < entryLatMax) {
			return entry;
		}
	}

	// Latitude beyond table range - use the extreme entry
	if (latitude >= 0) {
		return FROST_LOOKUP_TABLE[FROST_LOOKUP_TABLE.length - 1];
	} else {
		return FROST_LOOKUP_TABLE_SOUTH[FROST_LOOKUP_TABLE_SOUTH.length - 1];
	}
}

/**
 * Determines if a location is likely coastal based on its position. This is
 * a rough heuristic that considers major coastlines. For more accurate results,
 * the caller can explicitly set isCoastal in the options.
 *
 * The function checks if the location is within a few degrees of known coastal
 * boundaries like the US Atlantic and Pacific coasts, Gulf Coast, and major
 * European coastlines.
 */
function estimateIsCoastal(coords: Coordinates): boolean {
	const { latitude, longitude } = coords;

	// US Pacific Coast (roughly)
	if (longitude >= -125 && longitude <= -117 && latitude >= 32 && latitude <= 49) {
		return true;
	}

	// US Atlantic Coast (roughly)
	if (longitude >= -82 && longitude <= -66 && latitude >= 25 && latitude <= 45) {
		return true;
	}

	// US Gulf Coast
	if (longitude >= -98 && longitude <= -80 && latitude >= 25 && latitude <= 31) {
		return true;
	}

	// Western Europe Atlantic Coast
	if (longitude >= -10 && longitude <= 5 && latitude >= 36 && latitude <= 60) {
		return true;
	}

	// Mediterranean coast
	if (longitude >= -6 && longitude <= 36 && latitude >= 35 && latitude <= 45) {
		return true;
	}

	return false;
}

/**
 * Calculates elevation adjustment in days. Higher elevations have later spring
 * frosts and earlier fall frosts. The adjustment is approximately 3-4 days
 * per 300 meters (1000 feet) of elevation gain.
 */
function calculateElevationAdjustment(elevationMeters: number): number {
	if (elevationMeters <= 0) {
		return 0;
	}
	return Math.round((elevationMeters / 300) * ELEVATION_ADJUSTMENT_DAYS_PER_300M);
}

/**
 * Creates a DayOfYearRange from a median day and variance. The early bound
 * represents the 10% probability date (frost could end this early), and the
 * late bound represents the 90% probability date (frost usually ends by now).
 */
function createDayRange(median: number, variance: number): DayOfYearRange {
	return {
		early: Math.max(1, median - variance),
		median,
		late: Math.min(366, median + variance)
	};
}

/**
 * Clamps a day-of-year value to the valid range of 1-366.
 */
function clampDayOfYear(day: number): number {
	return Math.max(1, Math.min(366, Math.round(day)));
}

/**
 * Creates frost dates for tropical regions where frost is rare or nonexistent.
 * Returns very early spring frost (late January) and very late fall frost
 * (mid-December) with low confidence since frost events are unusual.
 */
function createTropicalFrostDates(): FrostDates {
	return {
		lastSpringFrost: { early: 1, median: 15, late: 32 },
		firstFallFrost: { early: 335, median: 350, late: 366 },
		source: 'lookup-table',
		confidence: 'low'
	};
}

/**
 * Looks up frost dates for a given geographic location. The function uses an
 * embedded lookup table based on latitude bands, with adjustments for elevation
 * and coastal position. Results are returned as ranges to reflect the inherent
 * year-to-year variability in frost timing.
 *
 * For tropical locations (within 20 degrees of the equator), the function
 * returns minimal frost dates with low confidence since frost is rare.
 *
 * @param coords - Geographic coordinates (latitude and longitude)
 * @param options - Optional adjustments for elevation and coastal position
 * @returns Frost date information including date ranges and confidence level
 *
 * @example
 * ```typescript
 * // Portland, Oregon
 * const frost = getFrostDates({ latitude: 45.52, longitude: -122.68 });
 * console.log(frost.lastSpringFrost.median); // ~130 (early May)
 * console.log(frost.firstFallFrost.median);  // ~255 (mid-September)
 *
 * // With elevation adjustment for Denver, Colorado (1600m elevation)
 * const denverFrost = getFrostDates(
 *   { latitude: 39.74, longitude: -104.99 },
 *   { elevationMeters: 1600 }
 * );
 * // Spring frost is about 21 days later due to elevation
 * ```
 */
export function getFrostDates(
	coords: Coordinates,
	options: FrostLookupOptions = {}
): FrostDates {
	const entry = findLookupEntry(coords.latitude);

	// Tropical regions have minimal frost
	if (!entry) {
		return createTropicalFrostDates();
	}

	// Start with baseline dates from lookup table
	let springDoy = entry.lastSpringDoy;
	let fallDoy = entry.firstFallDoy;

	// Apply elevation adjustment (later spring, earlier fall)
	const elevationAdjustment = options.elevationMeters
		? calculateElevationAdjustment(options.elevationMeters)
		: 0;
	springDoy += elevationAdjustment;
	fallDoy -= elevationAdjustment;

	// Apply coastal modifier (earlier spring, later fall for coastal areas)
	const isCoastal = options.isCoastal ?? estimateIsCoastal(coords);
	if (isCoastal && entry.coastalModifier) {
		springDoy += entry.coastalModifier; // Negative modifier = earlier spring frost
		fallDoy -= entry.coastalModifier; // Negative modifier = later fall frost
	}

	// Clamp values to valid range
	springDoy = clampDayOfYear(springDoy);
	fallDoy = clampDayOfYear(fallDoy);

	// Determine confidence based on how much we're interpolating
	// Coastal and high-elevation adjustments reduce confidence slightly
	let confidence: 'high' | 'medium' | 'low' = 'medium';
	if (Math.abs(coords.latitude) < 25 || Math.abs(coords.latitude) > 55) {
		confidence = 'low'; // Extreme latitudes have less reliable data
	} else if (!options.elevationMeters && !isCoastal) {
		confidence = 'medium'; // Standard lookup
	}

	return {
		lastSpringFrost: createDayRange(springDoy, entry.varianceDays),
		firstFallFrost: createDayRange(fallDoy, entry.varianceDays),
		source: 'lookup-table',
		confidence
	};
}

/**
 * Converts a day-of-year number to a Date object for a given year. This is
 * useful for displaying frost dates in a human-readable format.
 *
 * @param dayOfYear - Day of year (1-366)
 * @param year - The year to use (defaults to current year)
 * @returns Date object for that day
 *
 * @example
 * ```typescript
 * const date = dayOfYearToDate(100, 2024);
 * console.log(date.toDateString()); // "Wed Apr 10 2024" (or Apr 09 in leap year)
 * ```
 */
export function dayOfYearToDate(dayOfYear: number, year: number = new Date().getFullYear()): Date {
	const date = new Date(year, 0, 1); // January 1st
	date.setDate(dayOfYear);
	return date;
}

/**
 * Converts a Date object to day-of-year (1-366). Uses UTC dates to avoid
 * daylight saving time complications.
 *
 * @param date - The date to convert
 * @returns Day of year (1-366)
 */
export function dateToDayOfYear(date: Date): number {
	const startOfYear = new Date(Date.UTC(date.getFullYear(), 0, 1));
	const dateUtc = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
	const diff = dateUtc.getTime() - startOfYear.getTime();
	const oneDay = 1000 * 60 * 60 * 24;
	return Math.floor(diff / oneDay) + 1; // +1 because January 1 is day 1, not day 0
}

/**
 * Formats a day-of-year range as a human-readable string like "Apr 10 - Apr 25".
 *
 * @param range - Day of year range to format
 * @param year - Year to use for date formatting (defaults to current year)
 * @returns Formatted date range string
 */
export function formatFrostDateRange(
	range: DayOfYearRange,
	year: number = new Date().getFullYear()
): string {
	const early = dayOfYearToDate(range.early, year);
	const late = dayOfYearToDate(range.late, year);

	const formatOptions: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' };
	const earlyStr = early.toLocaleDateString('en-US', formatOptions);
	const lateStr = late.toLocaleDateString('en-US', formatOptions);

	return `${earlyStr} - ${lateStr}`;
}

/**
 * Calculates the growing season length in days from frost dates.
 *
 * @param frostDates - Frost date information
 * @returns Growing season length in days (using median dates)
 */
export function calculateGrowingSeasonLength(frostDates: FrostDates): number {
	const springFrost = frostDates.lastSpringFrost.median;
	const fallFrost = frostDates.firstFallFrost.median;

	// Handle southern hemisphere where fall frost DOY is less than spring frost DOY
	if (fallFrost < springFrost) {
		return (366 - springFrost) + fallFrost;
	}

	return fallFrost - springFrost;
}
