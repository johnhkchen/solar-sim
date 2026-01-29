/**
 * Climate data types for Solar-Sim.
 *
 * These types represent frost dates, hardiness zones, and growing season data
 * used to help users understand their planting windows. Frost dates are represented
 * as day-of-year integers (1-366) rather than Date objects to simplify calculations
 * and avoid timezone complications.
 */

/**
 * A range of days representing the uncertainty window for a frost date.
 * The median is the 50% probability date, while early and late bounds
 * represent approximately 10% and 90% probability respectively.
 */
export interface DayOfYearRange {
	/** Day of year for early bound (10% probability) */
	early: number;
	/** Day of year for median (50% probability) */
	median: number;
	/** Day of year for late bound (90% probability) */
	late: number;
}

/** Data source for frost date information */
export type FrostDateSource = 'lookup-table' | 'noaa-station' | 'calculated';

/** Confidence level for frost date estimates */
export type FrostDateConfidence = 'high' | 'medium' | 'low';

/**
 * Frost date information for a location. Dates are represented as day-of-year
 * (1-366) rather than full Date objects since they represent typical annual
 * patterns rather than specific calendar dates.
 */
export interface FrostDates {
	/** Range of dates for the last spring frost */
	lastSpringFrost: DayOfYearRange;
	/** Range of dates for the first fall frost */
	firstFallFrost: DayOfYearRange;
	/** How the frost dates were determined */
	source: FrostDateSource;
	/** Confidence level based on data quality and proximity to reference stations */
	confidence: FrostDateConfidence;
}

/** Subzone within a hardiness zone (a or b) */
export type HardinessSubzone = 'a' | 'b';

/** Data source for hardiness zone information */
export type HardinessZoneSource = 'usda' | 'calculated';

/**
 * USDA Plant Hardiness Zone information. The USDA system divides regions into
 * 13 zones based on average annual minimum winter temperatures, with each zone
 * spanning a 10°F band. Subzones (a and b) divide each zone into 5°F bands.
 */
export interface HardinessZone {
	/** Full zone identifier including subzone (e.g., "7b") */
	zone: string;
	/** Numeric zone value (e.g., 7 for zone 7b) */
	zoneNumber: number;
	/** Temperature subzone within the zone */
	subzone: HardinessSubzone;
	/** Lower bound of zone temperature range in Fahrenheit */
	minTempF: number;
	/** Upper bound of zone temperature range in Fahrenheit */
	maxTempF: number;
	/** How the zone was determined */
	source: HardinessZoneSource;
	/** True for international or coordinate-based calculations that may be less precise */
	isApproximate: boolean;
}

/**
 * Range representing uncertainty in growing season length. Different years
 * can vary significantly in frost timing, so we represent the expected range.
 */
export interface GrowingSeasonRange {
	/** Days in a short season year (early fall frost, late spring frost) */
	short: number;
	/** Days in a typical year */
	typical: number;
	/** Days in a long season year (late fall frost, early spring frost) */
	long: number;
}

/**
 * A date range with explicit start and end days of year.
 */
export interface DateRange {
	/** Day of year for start of range (1-366) */
	start: number;
	/** Day of year for end of range (1-366) */
	end: number;
}

/**
 * Growing season calculation results including the frost-free period and
 * optional cool-season planting windows.
 */
export interface GrowingSeason {
	/** Growing season length in days, expressed as a range */
	lengthDays: GrowingSeasonRange;
	/** The frost-free period between last spring and first fall frost */
	frostFreePeriod: {
		/** Start of frost-free period (last spring frost dates) */
		start: DayOfYearRange;
		/** End of frost-free period (first fall frost dates) */
		end: DayOfYearRange;
	};
	/** Windows for cool-season crops that can tolerate light frost */
	coolSeasonWindows: {
		/** Spring window before warm-season planting, or null if too short */
		spring: DateRange | null;
		/** Fall window after warm-season harvest, or null if too short */
		fall: DateRange | null;
	};
}

/**
 * Combined climate data for a location. This is the primary data structure
 * returned by climate lookup operations.
 */
export interface ClimateData {
	/** Frost date information */
	frostDates: FrostDates;
	/** USDA hardiness zone information */
	hardinessZone: HardinessZone;
	/** Calculated growing season data */
	growingSeason: GrowingSeason;
	/** When this data was fetched or calculated */
	fetchedAt: Date;
}

/** Error types that can occur during climate data lookup */
export type ClimateErrorType =
	| 'location-not-supported'
	| 'api-error'
	| 'calculation-failed';

/**
 * Error information for failed climate data lookups.
 */
export interface ClimateError {
	/** Category of error */
	type: ClimateErrorType;
	/** Human-readable error message */
	message: string;
}

/**
 * Result type for climate data lookup operations. Uses discriminated union
 * pattern for type-safe error handling.
 */
export type ClimateResult =
	| { success: true; data: ClimateData }
	| { success: false; error: ClimateError };

/**
 * Entry in the frost date lookup table. Uses latitude bands with modifiers
 * for coastal position and elevation to approximate frost dates globally.
 */
export interface FrostLookupEntry {
	/** Minimum latitude for this band (inclusive) */
	latMin: number;
	/** Maximum latitude for this band (exclusive) */
	latMax: number;
	/** Days to add for coastal locations (typically negative for milder climate) */
	coastalModifier: number;
	/** Day of year for median last spring frost */
	lastSpringDoy: number;
	/** Day of year for median first fall frost */
	firstFallDoy: number;
	/** Typical +/- variance in days for range calculation */
	varianceDays: number;
}

/**
 * Options for frost date lookup operations.
 */
export interface FrostLookupOptions {
	/** Elevation in meters for altitude adjustment */
	elevationMeters?: number;
	/** Whether the location is within 50km of a large water body */
	isCoastal?: boolean;
}

/**
 * Options for hardiness zone lookup operations.
 */
export interface HardinessLookupOptions {
	/** ZIP code for US locations (uses embedded frostline data) */
	zipCode?: string;
}

/** Minimum valid day-of-year value */
export const DAY_OF_YEAR_MIN = 1;

/** Maximum valid day-of-year value (leap year) */
export const DAY_OF_YEAR_MAX = 366;

/** Days per 300m (1000ft) elevation gain for frost date adjustment */
export const ELEVATION_ADJUSTMENT_DAYS_PER_300M = 4;
