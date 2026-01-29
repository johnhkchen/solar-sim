/**
 * Open-Meteo Historical Weather API Client for Solar-Sim.
 *
 * This module fetches historical daily temperature data from Open-Meteo's archive API
 * and computes climate metrics like frost dates and monthly averages. Open-Meteo provides
 * free access to over 80 years of hourly weather data at 10-kilometer resolution globally
 * without requiring an API key for non-commercial use.
 *
 * The client implements aggressive caching to minimize API calls since historical climate
 * data changes slowly. Cache entries are keyed by location (rounded to 0.1°) with a 30-day
 * TTL. When the API is unavailable, the client falls back to cached data if available.
 */

import type { Coordinates } from '../geo/types.js';
import type { DayOfYearRange, FrostDates } from './types.js';

/**
 * A single day's temperature data from the Open-Meteo API.
 */
export interface DailyTemperatureData {
	/** ISO8601 date string (YYYY-MM-DD) */
	date: string;
	/** Daily maximum temperature in Celsius */
	maxTemp: number;
	/** Daily minimum temperature in Celsius */
	minTemp: number;
}

/**
 * Monthly temperature averages computed from historical data.
 */
export interface MonthlyAverages {
	/** Average daily high temperature for each month (12 values, index 0 = January) */
	avgHighs: number[];
	/** Average daily low temperature for each month (12 values, index 0 = January) */
	avgLows: number[];
	/** Average temperature (midpoint of high and low) for each month */
	avgTemps: number[];
}

/**
 * Raw response structure from the Open-Meteo archive API.
 */
interface OpenMeteoResponse {
	latitude: number;
	longitude: number;
	elevation: number;
	timezone: string;
	daily_units: {
		time: string;
		temperature_2m_max: string;
		temperature_2m_min: string;
	};
	daily: {
		time: string[];
		temperature_2m_max: (number | null)[];
		temperature_2m_min: (number | null)[];
	};
}

/**
 * Cached climate data stored in localStorage.
 */
interface CachedClimateData {
	temperatures: DailyTemperatureData[];
	fetchedAt: number;
	startYear: number;
	endYear: number;
}

const OPEN_METEO_ARCHIVE_URL = 'https://archive-api.open-meteo.com/v1/archive';
const CACHE_KEY_PREFIX = 'solar-sim:climate:';
const CACHE_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days
const MAX_RETRIES = 3;
const BASE_BACKOFF_MS = 1000;

/**
 * Rounds a coordinate value to 0.1 degree precision for cache key generation.
 * This enables cache hits for nearby queries since 0.1 degree is approximately
 * 11km at the equator, well within the 10km resolution of Open-Meteo data.
 */
function roundCoordinate(value: number): string {
	return value.toFixed(1);
}

/**
 * Generates a cache key for storing climate data by location.
 */
function getCacheKey(coords: Coordinates): string {
	const lat = roundCoordinate(coords.latitude);
	const lng = roundCoordinate(coords.longitude);
	return `${CACHE_KEY_PREFIX}${lat}:${lng}`;
}

/**
 * Checks if localStorage is available in the current environment.
 */
function isLocalStorageAvailable(): boolean {
	try {
		const testKey = '__solar_sim_test__';
		localStorage.setItem(testKey, 'test');
		localStorage.removeItem(testKey);
		return true;
	} catch {
		return false;
	}
}

/**
 * Retrieves cached climate data if it exists and hasn't expired.
 */
function getCachedData(coords: Coordinates, requiredYears: number): CachedClimateData | null {
	if (!isLocalStorageAvailable()) {
		return null;
	}

	const key = getCacheKey(coords);
	const cached = localStorage.getItem(key);

	if (!cached) {
		return null;
	}

	try {
		const data: CachedClimateData = JSON.parse(cached);
		const now = Date.now();

		// Check if cache has expired
		if (now - data.fetchedAt > CACHE_TTL_MS) {
			localStorage.removeItem(key);
			return null;
		}

		// Check if cache has enough years of data
		const cachedYears = data.endYear - data.startYear + 1;
		if (cachedYears < requiredYears) {
			return null;
		}

		return data;
	} catch {
		localStorage.removeItem(key);
		return null;
	}
}

/**
 * Stores climate data in localStorage.
 */
function setCachedData(coords: Coordinates, data: CachedClimateData): void {
	if (!isLocalStorageAvailable()) {
		return;
	}

	const key = getCacheKey(coords);
	try {
		localStorage.setItem(key, JSON.stringify(data));
	} catch {
		// Storage quota exceeded or other error - silently fail
	}
}

/**
 * Validates the structure of an Open-Meteo API response.
 */
function validateResponse(response: unknown): response is OpenMeteoResponse {
	if (typeof response !== 'object' || response === null) {
		return false;
	}

	const r = response as Record<string, unknown>;

	if (typeof r.latitude !== 'number' || typeof r.longitude !== 'number') {
		return false;
	}

	if (typeof r.daily !== 'object' || r.daily === null) {
		return false;
	}

	const daily = r.daily as Record<string, unknown>;

	if (!Array.isArray(daily.time) || !Array.isArray(daily.temperature_2m_max) || !Array.isArray(daily.temperature_2m_min)) {
		return false;
	}

	if (daily.time.length !== daily.temperature_2m_max.length || daily.time.length !== daily.temperature_2m_min.length) {
		return false;
	}

	return true;
}

/**
 * Sleeps for a specified number of milliseconds. Used for exponential backoff
 * when the API returns rate limit errors.
 */
function sleep(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Fetches data from the Open-Meteo API with exponential backoff retry logic.
 */
async function fetchWithRetry(url: string): Promise<OpenMeteoResponse> {
	let lastError: Error | null = null;

	for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
		try {
			const response = await fetch(url);

			if (response.status === 429) {
				// Rate limited - wait and retry
				const backoffMs = BASE_BACKOFF_MS * Math.pow(2, attempt);
				await sleep(backoffMs);
				continue;
			}

			if (!response.ok) {
				throw new Error(`Open-Meteo API error: ${response.status} ${response.statusText}`);
			}

			const data: unknown = await response.json();

			if (!validateResponse(data)) {
				throw new Error('Invalid response structure from Open-Meteo API');
			}

			return data;
		} catch (error) {
			lastError = error instanceof Error ? error : new Error(String(error));

			// Network errors get retried with backoff
			if (attempt < MAX_RETRIES - 1) {
				const backoffMs = BASE_BACKOFF_MS * Math.pow(2, attempt);
				await sleep(backoffMs);
			}
		}
	}

	throw lastError ?? new Error('Failed to fetch from Open-Meteo API');
}

/**
 * Converts Open-Meteo API response to our internal data structure.
 */
function parseResponse(response: OpenMeteoResponse): DailyTemperatureData[] {
	const result: DailyTemperatureData[] = [];
	const { time, temperature_2m_max, temperature_2m_min } = response.daily;

	for (let i = 0; i < time.length; i++) {
		const maxTemp = temperature_2m_max[i];
		const minTemp = temperature_2m_min[i];

		// Skip days with missing data
		if (maxTemp === null || minTemp === null) {
			continue;
		}

		result.push({
			date: time[i],
			maxTemp,
			minTemp
		});
	}

	return result;
}

/**
 * Fetches historical daily temperature data for a location. The function retrieves
 * N years of daily minimum and maximum temperatures from the Open-Meteo archive API.
 * Results are cached in localStorage keyed by location (rounded to 0.1°) with a
 * 30-day TTL.
 *
 * When the API is unavailable, the function returns cached data if available. If no
 * cached data exists, the function throws an error.
 *
 * @param coords - Geographic coordinates for the location
 * @param years - Number of years of historical data to fetch (default 30)
 * @returns Array of daily temperature records
 * @throws Error if the API is unavailable and no cached data exists
 *
 * @example
 * ```typescript
 * const sanFrancisco = { latitude: 37.7749, longitude: -122.4194 };
 * const temps = await fetchHistoricalTemperatures(sanFrancisco, 30);
 * console.log(temps.length); // ~10950 days (30 years)
 * ```
 */
export async function fetchHistoricalTemperatures(
	coords: Coordinates,
	years: number = 30
): Promise<DailyTemperatureData[]> {
	// Check cache first
	const cached = getCachedData(coords, years);
	if (cached) {
		return cached.temperatures;
	}

	// Calculate date range
	const endDate = new Date();
	endDate.setDate(endDate.getDate() - 1); // Yesterday (most recent available data)
	const startDate = new Date(endDate);
	startDate.setFullYear(startDate.getFullYear() - years);

	const startStr = startDate.toISOString().split('T')[0];
	const endStr = endDate.toISOString().split('T')[0];

	// Build API URL
	const params = new URLSearchParams({
		latitude: coords.latitude.toString(),
		longitude: coords.longitude.toString(),
		start_date: startStr,
		end_date: endStr,
		daily: 'temperature_2m_max,temperature_2m_min',
		timezone: 'auto'
	});

	const url = `${OPEN_METEO_ARCHIVE_URL}?${params}`;

	try {
		const response = await fetchWithRetry(url);
		const temperatures = parseResponse(response);

		// Cache the result
		const cacheData: CachedClimateData = {
			temperatures,
			fetchedAt: Date.now(),
			startYear: startDate.getFullYear(),
			endYear: endDate.getFullYear()
		};
		setCachedData(coords, cacheData);

		return temperatures;
	} catch (error) {
		// On network failure, return stale cache if available
		const staleCache = localStorage.getItem(getCacheKey(coords));
		if (staleCache) {
			try {
				const data: CachedClimateData = JSON.parse(staleCache);
				console.warn('Open-Meteo API unavailable, using stale cache');
				return data.temperatures;
			} catch {
				// Fall through to throw
			}
		}

		throw error;
	}
}

/**
 * Calculates frost dates from historical temperature data. The function finds
 * the last spring date and first fall date when temperatures dropped below
 * freezing (0°C) for each year, then computes the median and range bounds.
 *
 * Spring frost dates are found by scanning backward from mid-year to find the
 * last frost event. Fall frost dates are found by scanning forward from mid-year.
 * The median of all years gives the 50% probability date, while the 10th and 90th
 * percentiles give the early and late bounds.
 *
 * @param data - Array of daily temperature records (should span multiple years)
 * @param latitude - Latitude of the location (needed for hemisphere detection)
 * @returns Frost date information with ranges
 *
 * @example
 * ```typescript
 * const temps = await fetchHistoricalTemperatures(coords, 30);
 * const frostDates = calculateFrostDatesFromHistory(temps, coords.latitude);
 * console.log(`Last spring frost: day ${frostDates.lastSpringFrost.median}`);
 * ```
 */
export function calculateFrostDatesFromHistory(
	data: DailyTemperatureData[],
	latitude: number
): FrostDates {
	// Group data by year
	const byYear = new Map<number, DailyTemperatureData[]>();

	for (const record of data) {
		const year = parseInt(record.date.split('-')[0], 10);
		const existing = byYear.get(year) ?? [];
		existing.push(record);
		byYear.set(year, existing);
	}

	const springFrostDoys: number[] = [];
	const fallFrostDoys: number[] = [];

	// Determine hemisphere-appropriate search windows
	// Northern hemisphere: spring = Jan-Jun, fall = Jul-Dec
	// Southern hemisphere: spring = Jul-Dec, fall = Jan-Jun
	const isNorthern = latitude >= 0;

	for (const [year, yearData] of byYear) {
		// Sort by date
		yearData.sort((a, b) => a.date.localeCompare(b.date));

		// Convert dates to day-of-year
		const frostDays: number[] = [];
		for (const record of yearData) {
			if (record.minTemp <= 0) {
				const doy = dateToDoy(record.date);
				frostDays.push(doy);
			}
		}

		if (frostDays.length === 0) {
			// No frost this year - skip
			continue;
		}

		// Find last spring frost and first fall frost
		// For northern hemisphere: spring is days 1-172, fall is days 173-366
		// For southern hemisphere: spring is days 173-366, fall is days 1-172
		const midYear = 172;

		if (isNorthern) {
			// Last spring frost: latest frost day before mid-year
			const springFrosts = frostDays.filter((d) => d <= midYear);
			if (springFrosts.length > 0) {
				springFrostDoys.push(Math.max(...springFrosts));
			}

			// First fall frost: earliest frost day after mid-year
			const fallFrosts = frostDays.filter((d) => d > midYear);
			if (fallFrosts.length > 0) {
				fallFrostDoys.push(Math.min(...fallFrosts));
			}
		} else {
			// Southern hemisphere: seasons are inverted
			// Spring (warming) is Jul-Dec (days 173-366)
			// Fall (cooling) is Jan-Jun (days 1-172)

			// Last spring frost: latest frost day in Jul-Dec
			const springFrosts = frostDays.filter((d) => d > midYear);
			if (springFrosts.length > 0) {
				springFrostDoys.push(Math.max(...springFrosts));
			}

			// First fall frost: earliest frost day in following Jan-Jun
			// But since we're looking at one year at a time, we need the earliest frost
			// in the Jan-Jun period, which represents the start of fall cooling
			const fallFrosts = frostDays.filter((d) => d <= midYear);
			if (fallFrosts.length > 0) {
				fallFrostDoys.push(Math.min(...fallFrosts));
			}
		}
	}

	// Calculate statistics
	const springStats = calculateDateStats(springFrostDoys);
	const fallStats = calculateDateStats(fallFrostDoys);

	return {
		lastSpringFrost: springStats,
		firstFallFrost: fallStats,
		source: 'calculated',
		confidence: springFrostDoys.length >= 20 && fallFrostDoys.length >= 20 ? 'high' : 'medium'
	};
}

/**
 * Converts an ISO date string to day-of-year (1-366).
 */
function dateToDoy(dateStr: string): number {
	const [yearStr, monthStr, dayStr] = dateStr.split('-');
	const year = parseInt(yearStr, 10);
	const month = parseInt(monthStr, 10);
	const day = parseInt(dayStr, 10);

	const date = new Date(year, month - 1, day);
	const startOfYear = new Date(year, 0, 1);
	const diffMs = date.getTime() - startOfYear.getTime();
	const oneDay = 24 * 60 * 60 * 1000;

	return Math.floor(diffMs / oneDay) + 1;
}

/**
 * Calculates median and percentile bounds for a set of day-of-year values.
 */
function calculateDateStats(doys: number[]): DayOfYearRange {
	if (doys.length === 0) {
		// No data - return default values indicating year-round frost risk
		return { early: 1, median: 60, late: 120 };
	}

	const sorted = [...doys].sort((a, b) => a - b);

	const medianIdx = Math.floor(sorted.length / 2);
	const median = sorted.length % 2 === 0
		? Math.round((sorted[medianIdx - 1] + sorted[medianIdx]) / 2)
		: sorted[medianIdx];

	// 10th and 90th percentiles
	const earlyIdx = Math.floor(sorted.length * 0.1);
	const lateIdx = Math.min(Math.floor(sorted.length * 0.9), sorted.length - 1);

	return {
		early: sorted[earlyIdx],
		median,
		late: sorted[lateIdx]
	};
}

/**
 * Calculates monthly average temperatures from historical daily data. The function
 * aggregates daily min/max temperatures into monthly averages for typical year
 * display and Köppen classification.
 *
 * @param data - Array of daily temperature records (should span multiple years)
 * @returns Monthly averages with high, low, and mean temperatures for each month
 *
 * @example
 * ```typescript
 * const temps = await fetchHistoricalTemperatures(coords, 30);
 * const monthly = calculateMonthlyAverages(temps);
 * console.log(`January avg high: ${monthly.avgHighs[0].toFixed(1)}°C`);
 * console.log(`July avg low: ${monthly.avgLows[6].toFixed(1)}°C`);
 * ```
 */
export function calculateMonthlyAverages(data: DailyTemperatureData[]): MonthlyAverages {
	// Accumulate sums and counts for each month
	const monthSums = Array.from({ length: 12 }, () => ({
		highSum: 0,
		lowSum: 0,
		count: 0
	}));

	for (const record of data) {
		const month = parseInt(record.date.split('-')[1], 10) - 1; // 0-indexed

		monthSums[month].highSum += record.maxTemp;
		monthSums[month].lowSum += record.minTemp;
		monthSums[month].count += 1;
	}

	const avgHighs: number[] = [];
	const avgLows: number[] = [];
	const avgTemps: number[] = [];

	for (let i = 0; i < 12; i++) {
		const { highSum, lowSum, count } = monthSums[i];

		if (count === 0) {
			// No data for this month - use placeholder
			avgHighs.push(0);
			avgLows.push(0);
			avgTemps.push(0);
		} else {
			const avgHigh = highSum / count;
			const avgLow = lowSum / count;

			avgHighs.push(Math.round(avgHigh * 10) / 10);
			avgLows.push(Math.round(avgLow * 10) / 10);
			avgTemps.push(Math.round(((avgHigh + avgLow) / 2) * 10) / 10);
		}
	}

	return { avgHighs, avgLows, avgTemps };
}

/**
 * Clears cached climate data for a specific location.
 */
export function clearCache(coords: Coordinates): void {
	if (!isLocalStorageAvailable()) {
		return;
	}

	const key = getCacheKey(coords);
	localStorage.removeItem(key);
}

/**
 * Clears all cached climate data.
 */
export function clearAllCache(): void {
	if (!isLocalStorageAvailable()) {
		return;
	}

	const keysToRemove: string[] = [];

	for (let i = 0; i < localStorage.length; i++) {
		const key = localStorage.key(i);
		if (key?.startsWith(CACHE_KEY_PREFIX)) {
			keysToRemove.push(key);
		}
	}

	for (const key of keysToRemove) {
		localStorage.removeItem(key);
	}
}
