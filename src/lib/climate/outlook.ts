/**
 * NOAA Climate Prediction Center Seasonal Outlook Client for Solar-Sim.
 *
 * This module fetches seasonal temperature and precipitation outlooks from NOAA's
 * Climate Prediction Center MapServer APIs. The data tells gardeners about current
 * weather anomalies and near-term patterns, which is more actionable than long-term
 * "zones are shifting" messaging. A gardener establishing new plantings needs to know
 * "this winter has been 10°F warmer than normal and above-normal temps are expected
 * through spring" rather than abstract climate trend information.
 *
 * The CPC provides probability-based outlooks: a 40% "Above" category means there's
 * a 40% chance of above-normal temperatures compared to the climatological 33% base
 * rate. We translate these probabilities into practical gardening guidance about
 * planting timing, frost risk, and irrigation needs.
 *
 * Coverage is limited to the continental US, Alaska, and Hawaii. For international
 * locations, the functions return null gracefully since NOAA CPC data isn't available.
 */

import type { Coordinates } from '../geo/types.js';

/**
 * Outlook category indicating whether conditions are expected to be above normal,
 * below normal, near normal, or equal chances (no clear signal).
 */
export type OutlookCategoryType = 'Above' | 'Below' | 'Normal' | 'EC';

/**
 * A single outlook category with its probability. The probability represents
 * how much more likely that category is compared to the climatological 33% base.
 * For example, 40% "Above" means a 40% chance of above-normal conditions vs the
 * baseline 33%, indicating a modest tilt toward warmer/wetter conditions.
 */
export interface OutlookCategory {
	/** The predicted category */
	type: OutlookCategoryType;
	/** Probability percentage (typically 33-90) */
	probability: number;
}

/**
 * Seasonal temperature and precipitation outlook for the next three months.
 * The valid period is expressed as three-letter month abbreviations like "FMA 2026"
 * for February-March-April 2026.
 */
export interface SeasonalOutlook {
	/** Three-month period like "FMA 2026" */
	validPeriod: string;
	/** Temperature outlook category and probability */
	temperature: OutlookCategory;
	/** Precipitation outlook category and probability, null if not available */
	precipitation: OutlookCategory | null;
	/** When this data was fetched */
	fetchedAt: Date;
}

/**
 * Drought status categories from the CPC drought outlook. The status indicates
 * whether drought conditions are expected to develop, persist, improve, or be
 * removed over the forecast period.
 */
export type DroughtStatus = 'none' | 'developing' | 'persisting' | 'improving' | 'removing';

/**
 * Drought outlook for a location. This indicates whether drought conditions
 * are expected to develop, persist, improve, or be removed.
 */
export interface DroughtOutlook {
	/** Forecast period description */
	validPeriod: string;
	/** Expected drought status */
	status: DroughtStatus;
	/** When this data was fetched */
	fetchedAt: Date;
}

/**
 * Combined seasonal outlook data with gardening guidance. This is the primary
 * data structure returned to consumers and displayed in the UI.
 */
export interface CombinedOutlook {
	/** Seasonal temperature and precipitation outlook */
	seasonal: SeasonalOutlook | null;
	/** Drought outlook */
	drought: DroughtOutlook | null;
	/** Generated gardening guidance based on the outlook data */
	guidance: string;
	/** Whether the location is within NOAA CPC coverage area (continental US, AK, HI) */
	isWithinCoverage: boolean;
}

/**
 * Cached outlook data stored in localStorage with a 24-hour TTL.
 */
interface CachedOutlookData {
	seasonal: SeasonalOutlook | null;
	drought: DroughtOutlook | null;
	fetchedAt: number;
	latitude: number;
	longitude: number;
}

/**
 * Raw response from the NOAA CPC MapServer query endpoint.
 */
interface MapServerQueryResponse {
	features?: Array<{
		attributes: {
			objectid?: number;
			fcst_date?: number;
			valid_seas?: string;
			prob?: number;
			cat?: string;
			idp_filedate?: number;
			idp_source?: string;
		};
	}>;
	error?: {
		code: number;
		message: string;
	};
}

/**
 * Raw response from the drought outlook MapServer query.
 */
interface DroughtQueryResponse {
	features?: Array<{
		attributes: {
			objectid?: number;
			fld_cat?: string;
			valid_start?: number;
			valid_end?: number;
			idp_filedate?: number;
		};
	}>;
	error?: {
		code: number;
		message: string;
	};
}

// NOAA CPC MapServer endpoints
const TEMP_OUTLOOK_URL =
	'https://mapservices.weather.noaa.gov/vector/rest/services/outlooks/cpc_sea_temp_outlk/MapServer/0/query';
const PRECIP_OUTLOOK_URL =
	'https://mapservices.weather.noaa.gov/vector/rest/services/outlooks/cpc_sea_prcp_outlk/MapServer/0/query';
const DROUGHT_OUTLOOK_URL =
	'https://mapservices.weather.noaa.gov/vector/rest/services/outlooks/cpc_drought_outlk/MapServer/0/query';

// Cache configuration
const CACHE_KEY_PREFIX = 'solar-sim:outlook:';
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

// Approximate bounding box for US coverage (continental + AK + HI)
const US_BOUNDS = {
	minLat: 18, // South of Hawaii
	maxLat: 72, // North of Alaska
	minLng: -180, // Alaska extends past -180
	maxLng: -65 // East coast
};

/**
 * Checks if coordinates are within the approximate US coverage area.
 * This is a rough check to avoid making unnecessary API calls for locations
 * that definitely won't have data.
 */
function isWithinUSBounds(coords: Coordinates): boolean {
	const { latitude, longitude } = coords;

	// Alaska extends past the date line, so we need special handling
	// For simplicity, we just check if it's in the rough US area
	if (latitude < US_BOUNDS.minLat || latitude > US_BOUNDS.maxLat) {
		return false;
	}

	// Handle Alaska's extent past -180
	if (longitude > 0 && longitude < 180) {
		// Could be Alaska (170-180E is actually -180 to -170W)
		return latitude > 50 && longitude > 170;
	}

	return longitude >= US_BOUNDS.minLng && longitude <= US_BOUNDS.maxLng;
}

/**
 * Rounds a coordinate value for cache key generation.
 * Uses 0.5 degree precision (~55km) since outlook polygons are regional.
 */
function roundCoordinate(value: number): string {
	return (Math.round(value * 2) / 2).toFixed(1);
}

/**
 * Generates a cache key for storing outlook data by location.
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
		const testKey = '__solar_sim_outlook_test__';
		localStorage.setItem(testKey, 'test');
		localStorage.removeItem(testKey);
		return true;
	} catch {
		return false;
	}
}

/**
 * Retrieves cached outlook data if it exists and hasn't expired.
 */
function getCachedData(coords: Coordinates): CachedOutlookData | null {
	if (!isLocalStorageAvailable()) {
		return null;
	}

	const key = getCacheKey(coords);
	const cached = localStorage.getItem(key);

	if (!cached) {
		return null;
	}

	try {
		const data: CachedOutlookData = JSON.parse(cached);
		const now = Date.now();

		if (now - data.fetchedAt > CACHE_TTL_MS) {
			localStorage.removeItem(key);
			return null;
		}

		return data;
	} catch {
		localStorage.removeItem(key);
		return null;
	}
}

/**
 * Stores outlook data in localStorage.
 */
function setCachedData(coords: Coordinates, data: CachedOutlookData): void {
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
 * Builds the query URL for the NOAA CPC MapServer endpoint.
 * The query uses point geometry to find intersecting outlook polygons.
 */
function buildQueryUrl(baseUrl: string, coords: Coordinates): string {
	const params = new URLSearchParams({
		geometry: `${coords.longitude},${coords.latitude}`,
		geometryType: 'esriGeometryPoint',
		spatialRel: 'esriSpatialRelIntersects',
		outFields: '*',
		f: 'json'
	});

	return `${baseUrl}?${params}`;
}

/**
 * Parses the outlook category from the CPC response.
 */
function parseOutlookCategory(cat: string | undefined, prob: number | undefined): OutlookCategory {
	const type = parseCategory(cat);
	return {
		type,
		probability: prob ?? 33
	};
}

/**
 * Converts the category string from the API to our type.
 */
function parseCategory(cat: string | undefined): OutlookCategoryType {
	if (!cat) {
		return 'EC';
	}

	const normalized = cat.toLowerCase().trim();

	if (normalized === 'above' || normalized === 'a') {
		return 'Above';
	}
	if (normalized === 'below' || normalized === 'b') {
		return 'Below';
	}
	if (normalized === 'normal' || normalized === 'n') {
		return 'Normal';
	}

	return 'EC';
}

/**
 * Parses the drought status from the API response.
 */
function parseDroughtStatus(fldCat: string | undefined): DroughtStatus {
	if (!fldCat) {
		return 'none';
	}

	const normalized = fldCat.toLowerCase().trim();

	if (normalized.includes('develop')) {
		return 'developing';
	}
	if (normalized.includes('persist') || normalized.includes('ongoing')) {
		return 'persisting';
	}
	if (normalized.includes('improv')) {
		return 'improving';
	}
	if (normalized.includes('remov') || normalized.includes('end')) {
		return 'removing';
	}

	return 'none';
}

/**
 * Fetches the seasonal temperature outlook for a location from NOAA CPC.
 * Returns null if the location is outside coverage or the API fails.
 */
async function fetchTemperatureOutlook(coords: Coordinates): Promise<SeasonalOutlook | null> {
	try {
		const url = buildQueryUrl(TEMP_OUTLOOK_URL, coords);
		const response = await fetch(url);

		if (!response.ok) {
			return null;
		}

		const data: MapServerQueryResponse = await response.json();

		if (data.error || !data.features || data.features.length === 0) {
			return null;
		}

		const feature = data.features[0];
		const attrs = feature.attributes;

		return {
			validPeriod: attrs.valid_seas ?? 'Unknown',
			temperature: parseOutlookCategory(attrs.cat, attrs.prob),
			precipitation: null, // Will be filled by separate precip fetch
			fetchedAt: new Date()
		};
	} catch {
		return null;
	}
}

/**
 * Fetches the seasonal precipitation outlook and merges it with temperature data.
 */
async function fetchPrecipitationOutlook(coords: Coordinates): Promise<OutlookCategory | null> {
	try {
		const url = buildQueryUrl(PRECIP_OUTLOOK_URL, coords);
		const response = await fetch(url);

		if (!response.ok) {
			return null;
		}

		const data: MapServerQueryResponse = await response.json();

		if (data.error || !data.features || data.features.length === 0) {
			return null;
		}

		const feature = data.features[0];
		const attrs = feature.attributes;

		return parseOutlookCategory(attrs.cat, attrs.prob);
	} catch {
		return null;
	}
}

/**
 * Fetches the drought outlook for a location from NOAA CPC.
 * Returns null if the location has no drought outlook (good news!) or if the API fails.
 */
async function fetchDroughtOutlookData(coords: Coordinates): Promise<DroughtOutlook | null> {
	try {
		const url = buildQueryUrl(DROUGHT_OUTLOOK_URL, coords);
		const response = await fetch(url);

		if (!response.ok) {
			return null;
		}

		const data: DroughtQueryResponse = await response.json();

		if (data.error || !data.features || data.features.length === 0) {
			// No drought outlook means no drought expected
			return {
				validPeriod: 'Current',
				status: 'none',
				fetchedAt: new Date()
			};
		}

		const feature = data.features[0];
		const attrs = feature.attributes;

		// Build a human-readable period from timestamps
		let validPeriod = 'Current outlook';
		if (attrs.valid_start && attrs.valid_end) {
			const start = new Date(attrs.valid_start);
			const end = new Date(attrs.valid_end);
			validPeriod = `${start.toLocaleDateString('en-US', { month: 'short' })} - ${end.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}`;
		}

		return {
			validPeriod,
			status: parseDroughtStatus(attrs.fld_cat),
			fetchedAt: new Date()
		};
	} catch {
		return null;
	}
}

/**
 * Fetches the complete seasonal outlook for a location. This function queries
 * both temperature and precipitation outlooks from NOAA CPC, then combines
 * them with drought data to provide a complete picture of near-term conditions.
 *
 * Results are cached for 24 hours since outlooks update monthly. For locations
 * outside the US coverage area, the function returns null immediately without
 * making API calls.
 *
 * @param coords - Geographic coordinates for the location
 * @returns Seasonal outlook with temperature and precipitation categories
 *
 * @example
 * ```typescript
 * const sanFrancisco = { latitude: 37.7749, longitude: -122.4194 };
 * const outlook = await fetchSeasonalOutlook(sanFrancisco);
 * if (outlook) {
 *   console.log(`${outlook.validPeriod}: ${outlook.temperature.type}`);
 * }
 * ```
 */
export async function fetchSeasonalOutlook(coords: Coordinates): Promise<SeasonalOutlook | null> {
	if (!isWithinUSBounds(coords)) {
		return null;
	}

	// Fetch temperature and precipitation outlooks in parallel
	const [tempOutlook, precipOutlook] = await Promise.all([
		fetchTemperatureOutlook(coords),
		fetchPrecipitationOutlook(coords)
	]);

	if (!tempOutlook) {
		return null;
	}

	// Merge precipitation data if available
	return {
		...tempOutlook,
		precipitation: precipOutlook
	};
}

/**
 * Fetches the drought outlook for a location. Returns information about whether
 * drought conditions are expected to develop, persist, improve, or be removed.
 * A null status field indicates no drought concerns for the location.
 *
 * @param coords - Geographic coordinates for the location
 * @returns Drought outlook, or null if outside coverage area
 *
 * @example
 * ```typescript
 * const phoenix = { latitude: 33.4484, longitude: -112.0740 };
 * const drought = await fetchDroughtOutlook(phoenix);
 * if (drought && drought.status !== 'none') {
 *   console.log(`Drought ${drought.status}`);
 * }
 * ```
 */
export async function fetchDroughtOutlook(coords: Coordinates): Promise<DroughtOutlook | null> {
	if (!isWithinUSBounds(coords)) {
		return null;
	}

	return fetchDroughtOutlookData(coords);
}

/**
 * Generates gardening-relevant guidance from outlook data. The guidance translates
 * the probability-based outlook into practical advice about planting timing, frost
 * risk, irrigation needs, and pest/disease pressure.
 *
 * The function considers both the outlook category and probability magnitude.
 * A 70% "Above" probability warrants stronger recommendations than a 40% tilt.
 *
 * @param seasonal - Seasonal outlook data, or null if not available
 * @param drought - Drought outlook data, or null if not available
 * @returns Practical gardening guidance as a formatted string
 *
 * @example
 * ```typescript
 * const guidance = getOutlookGuidance(seasonal, drought);
 * console.log(guidance);
 * // "Above-normal temperatures expected through spring. Consider earlier planting
 * // dates for warm-season crops, but watch for late frost surprises..."
 * ```
 */
export function getOutlookGuidance(
	seasonal: SeasonalOutlook | null,
	drought: DroughtOutlook | null
): string {
	const parts: string[] = [];

	if (seasonal) {
		parts.push(getTemperatureGuidance(seasonal.temperature, seasonal.validPeriod));

		if (seasonal.precipitation) {
			parts.push(getPrecipitationGuidance(seasonal.precipitation));
		}
	}

	if (drought && drought.status !== 'none') {
		parts.push(getDroughtGuidance(drought));
	}

	if (parts.length === 0) {
		return 'No significant weather anomalies expected. Plan according to historical averages for your area.';
	}

	return parts.join('\n\n');
}

/**
 * Generates temperature-specific gardening guidance.
 */
function getTemperatureGuidance(outlook: OutlookCategory, period: string): string {
	const { type, probability } = outlook;
	const isStrong = probability >= 60;
	const isModerate = probability >= 40 && probability < 60;

	if (type === 'Above') {
		const confidence = isStrong ? 'likely' : isModerate ? 'somewhat likely' : 'slightly favored';

		let guidance = `Above-normal temperatures are ${confidence} through ${period}.`;

		if (isStrong) {
			guidance +=
				' Consider moving up planting dates for warm-season crops. Fruit trees may receive fewer chill hours than normal, potentially affecting next year\'s production. Start preparing irrigation systems earlier than usual.';
		} else if (isModerate) {
			guidance +=
				' Earlier planting may be possible, but watch for late frost surprises. Reduced snowpack could mean earlier irrigation needs.';
		} else {
			guidance += ' Conditions lean warm but stay flexible with your planting schedule.';
		}

		return guidance;
	}

	if (type === 'Below') {
		const confidence = isStrong ? 'likely' : isModerate ? 'somewhat likely' : 'slightly favored';

		let guidance = `Below-normal temperatures are ${confidence} through ${period}.`;

		if (isStrong) {
			guidance +=
				' Delay planting warm-season crops until soil temperatures are reliably warm. Extended cold could provide good chill hours for fruit trees. Consider cold-hardy varieties and season extension techniques.';
		} else if (isModerate) {
			guidance +=
				' Be prepared for late cold snaps. Cool-season crops will have an extended productive period.';
		} else {
			guidance += ' Conditions lean cool but expect normal variability.';
		}

		return guidance;
	}

	if (type === 'Normal') {
		return `Near-normal temperatures expected through ${period}. Plan according to your typical frost dates and growing season length.`;
	}

	// Equal chances
	return `No strong temperature signal for ${period}. The odds of above, below, or near normal conditions are roughly equal, so plan according to historical averages.`;
}

/**
 * Generates precipitation-specific gardening guidance.
 */
function getPrecipitationGuidance(outlook: OutlookCategory): string {
	const { type, probability } = outlook;
	const isStrong = probability >= 60;

	if (type === 'Above') {
		if (isStrong) {
			return 'Wetter conditions expected. Good soil moisture heading into planting season, but watch for fungal issues in wet conditions. Delay working wet soil to avoid compaction.';
		}
		return 'Slightly wetter conditions favored. Soil moisture should be adequate for planting, but ensure good drainage in garden beds.';
	}

	if (type === 'Below') {
		if (isStrong) {
			return 'Drier conditions expected. Plan for supplemental irrigation early in the season. Mulch heavily to conserve soil moisture and consider drought-tolerant varieties.';
		}
		return 'Slightly drier conditions favored. Monitor soil moisture and be ready to irrigate earlier than usual.';
	}

	if (type === 'Normal') {
		return 'Near-normal precipitation expected. Standard irrigation planning should suffice.';
	}

	return '';
}

/**
 * Generates drought-specific gardening guidance.
 */
function getDroughtGuidance(drought: DroughtOutlook): string {
	switch (drought.status) {
		case 'developing':
			return 'Drought conditions may develop. Prioritize water-efficient practices: mulching, drip irrigation, and drought-tolerant plants. Consider reducing lawn areas and grouping plants by water needs.';

		case 'persisting':
			return 'Existing drought conditions expected to persist. Water restrictions may tighten. Focus on maintaining established plants rather than new plantings. Deep watering less frequently encourages deeper root growth.';

		case 'improving':
			return 'Drought conditions expected to improve. Some relief is coming, but continue water-wise practices. This is a good time to plan drought-resilient garden improvements.';

		case 'removing':
			return 'Drought conditions expected to end. Soil moisture should recover, though deep groundwater may take longer. Gradual return to normal watering as conditions allow.';

		default:
			return '';
	}
}

/**
 * Fetches the complete outlook data for a location and generates guidance.
 * This is the primary function for consumers who want all outlook information
 * in a single call with caching handled automatically.
 *
 * For locations outside the US, the function returns immediately with
 * isWithinCoverage set to false and generic guidance about using historical
 * averages.
 *
 * @param coords - Geographic coordinates for the location
 * @returns Combined outlook data with seasonal, drought, and guidance
 *
 * @example
 * ```typescript
 * const portland = { latitude: 45.5152, longitude: -122.6784 };
 * const outlook = await getCompleteOutlook(portland);
 * console.log(outlook.guidance);
 * ```
 */
export async function getCompleteOutlook(coords: Coordinates): Promise<CombinedOutlook> {
	// Quick check for non-US locations
	if (!isWithinUSBounds(coords)) {
		return {
			seasonal: null,
			drought: null,
			guidance:
				'Seasonal outlook data is not available for locations outside the United States. Plan according to historical climate patterns for your region.',
			isWithinCoverage: false
		};
	}

	// Check cache first
	const cached = getCachedData(coords);
	if (cached) {
		const seasonal = cached.seasonal
			? { ...cached.seasonal, fetchedAt: new Date(cached.seasonal.fetchedAt) }
			: null;
		const drought = cached.drought
			? { ...cached.drought, fetchedAt: new Date(cached.drought.fetchedAt) }
			: null;

		return {
			seasonal,
			drought,
			guidance: getOutlookGuidance(seasonal, drought),
			isWithinCoverage: true
		};
	}

	// Fetch fresh data
	const [seasonal, drought] = await Promise.all([
		fetchSeasonalOutlook(coords),
		fetchDroughtOutlook(coords)
	]);

	// Cache the results
	setCachedData(coords, {
		seasonal,
		drought,
		fetchedAt: Date.now(),
		latitude: coords.latitude,
		longitude: coords.longitude
	});

	return {
		seasonal,
		drought,
		guidance: getOutlookGuidance(seasonal, drought),
		isWithinCoverage: true
	};
}

/**
 * Clears cached outlook data for a specific location.
 */
export function clearOutlookCache(coords: Coordinates): void {
	if (!isLocalStorageAvailable()) {
		return;
	}

	const key = getCacheKey(coords);
	localStorage.removeItem(key);
}

/**
 * Clears all cached outlook data.
 */
export function clearAllOutlookCache(): void {
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

/**
 * Formats an outlook category for display. Returns a human-readable string
 * describing the outlook with confidence level.
 *
 * @param category - The outlook category to format
 * @param metric - What the category measures, like "temperatures" or "precipitation"
 * @returns Formatted string like "Above-normal temperatures (60% probability)"
 *
 * @example
 * ```typescript
 * const outlook = { type: 'Above', probability: 60 };
 * formatOutlookCategory(outlook, 'temperatures');
 * // "Above-normal temperatures (60% probability)"
 * ```
 */
export function formatOutlookCategory(category: OutlookCategory, metric: string): string {
	if (category.type === 'EC') {
		return `Equal chances for ${metric}`;
	}

	const typeLabel = category.type === 'Normal' ? 'Near-normal' : `${category.type}-normal`;
	return `${typeLabel} ${metric} (${category.probability}% probability)`;
}

/**
 * Formats a drought status for display.
 *
 * @param status - The drought status to format
 * @returns Human-readable description of the drought status
 */
export function formatDroughtStatus(status: DroughtStatus): string {
	switch (status) {
		case 'none':
			return 'No drought expected';
		case 'developing':
			return 'Drought may develop';
		case 'persisting':
			return 'Drought conditions persisting';
		case 'improving':
			return 'Drought conditions improving';
		case 'removing':
			return 'Drought ending';
		default:
			return 'Unknown drought status';
	}
}
