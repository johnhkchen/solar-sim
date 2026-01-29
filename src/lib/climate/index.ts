/**
 * Climate data module for Solar-Sim.
 *
 * This module provides types and functions for working with climate data
 * including frost dates, USDA hardiness zones, and growing season calculations.
 * The climate data helps users understand when they can plant, not just how
 * much light a location receives.
 */

// Core types for frost dates
export type {
	DayOfYearRange,
	FrostDateSource,
	FrostDateConfidence,
	FrostDates
} from './types.js';

// Hardiness zone types
export type {
	HardinessSubzone,
	HardinessZoneSource,
	HardinessZone
} from './types.js';

// Growing season types
export type {
	GrowingSeasonRange,
	DateRange,
	GrowingSeason
} from './types.js';

// Combined climate data types
export type {
	ClimateData,
	ClimateErrorType,
	ClimateError,
	ClimateResult
} from './types.js';

// Lookup table types
export type {
	FrostLookupEntry,
	FrostLookupOptions,
	HardinessLookupOptions
} from './types.js';

// Constants
export {
	DAY_OF_YEAR_MIN,
	DAY_OF_YEAR_MAX,
	ELEVATION_ADJUSTMENT_DAYS_PER_300M
} from './types.js';

// Frost date lookup functions
export {
	getFrostDates,
	dayOfYearToDate,
	dateToDayOfYear,
	formatFrostDateRange,
	calculateGrowingSeasonLength
} from './frost-dates.js';

// Hardiness zone lookup functions
export {
	getHardinessZone,
	estimateMinWinterTemp,
	formatHardinessZone,
	formatZoneTempRange,
	celsiusToFahrenheit,
	fahrenheitToCelsius
} from './hardiness-zone.js';

// Open-Meteo historical weather types
export type {
	DailyTemperatureData,
	MonthlyAverages
} from './openmeteo.js';

// Open-Meteo historical weather functions
export {
	fetchHistoricalTemperatures,
	calculateFrostDatesFromHistory,
	calculateMonthlyAverages,
	clearCache,
	clearAllCache
} from './openmeteo.js';

// Köppen climate classification types
export type {
	MonthlyClimateData,
	KoppenClassification
} from './koppen.js';

// Köppen climate classification functions
export {
	classifyKoppen,
	getKoppenDescription,
	getKoppenGardeningNotes,
	getKoppenPrimaryTypeName
} from './koppen.js';

// Seasonal outlook types
export type {
	OutlookCategoryType,
	OutlookCategory,
	SeasonalOutlook,
	DroughtStatus,
	DroughtOutlook,
	CombinedOutlook
} from './outlook.js';

// Seasonal outlook functions
export {
	fetchSeasonalOutlook,
	fetchDroughtOutlook,
	getOutlookGuidance,
	getCompleteOutlook,
	clearOutlookCache,
	clearAllOutlookCache,
	formatOutlookCategory,
	formatDroughtStatus
} from './outlook.js';
