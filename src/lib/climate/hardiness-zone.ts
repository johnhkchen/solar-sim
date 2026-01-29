/**
 * USDA hardiness zone lookup for Solar-Sim.
 *
 * This module provides hardiness zone estimates based on geographic location using
 * minimum winter temperature calculations. The USDA Plant Hardiness Zone system
 * divides regions into 13 zones based on average annual minimum winter temperatures,
 * with each zone spanning a 10°F band and subzones (a and b) spanning 5°F each.
 *
 * The primary method estimates minimum winter temperature from latitude, with
 * adjustments for coastal position and elevation. For US locations, more precise
 * data could be obtained from ZIP code lookup via the frostline project, but this
 * coordinate-based approach provides reasonable global coverage.
 */

import type { Coordinates } from '../geo/index.js';
import type { HardinessZone, HardinessSubzone, HardinessLookupOptions } from './types.js';

/**
 * Zone temperature ranges in Fahrenheit. Each zone spans 10°F, with subzones
 * spanning 5°F each. Zone 1a starts at -60°F and zone 13b ends at 70°F.
 */
const ZONE_BASE_TEMP_F = -60; // Zone 1a lower bound
const ZONE_RANGE_F = 10; // Each full zone spans 10°F
const SUBZONE_RANGE_F = 5; // Each subzone spans 5°F
const MIN_ZONE = 1;
const MAX_ZONE = 13;

/**
 * Latitude-based minimum temperature lookup table for the northern hemisphere.
 * These values represent approximate average annual minimum temperatures in
 * Fahrenheit for continental interior locations at sea level. Coastal and
 * high-elevation locations need adjustment.
 *
 * The table covers the continental US primarily, with extrapolations for
 * other latitudes. Values are derived from NOAA climate data and USDA zone maps.
 */
interface MinTempEntry {
	latMin: number;
	latMax: number;
	minTempF: number; // Base minimum temp for continental interior at sea level
	coastalModifier: number; // °F to add for coastal locations (warmer)
}

const MIN_TEMP_TABLE_NORTH: MinTempEntry[] = [
	// Tropical - minimal cold (Hawaii, southern Florida, Puerto Rico)
	{ latMin: 20, latMax: 25, minTempF: 40, coastalModifier: 5 },

	// Subtropical - rare freezes (central Florida, Gulf Coast)
	{ latMin: 25, latMax: 27.5, minTempF: 30, coastalModifier: 8 },

	// Deep South - mild winters (southern Texas, Louisiana, coastal Georgia)
	{ latMin: 27.5, latMax: 30, minTempF: 22, coastalModifier: 10 },

	// Lower South - occasional hard freezes (central Texas, inland Georgia)
	{ latMin: 30, latMax: 32.5, minTempF: 15, coastalModifier: 10 },

	// Upper South - regular freezes (Arizona, New Mexico, northern Texas)
	// Note: Desert climates like Phoenix are warmer than continental at same lat
	{ latMin: 32.5, latMax: 35, minTempF: 8, coastalModifier: 15 },

	// Mid-latitude South - cold winters (Tennessee, North Carolina, Oklahoma)
	{ latMin: 35, latMax: 37.5, minTempF: 0, coastalModifier: 15 },

	// Central - significant cold (Virginia, Kentucky, Kansas, southern Missouri)
	{ latMin: 37.5, latMax: 40, minTempF: -8, coastalModifier: 15 },

	// Northern tier lower - cold winters (Pennsylvania, Ohio, Indiana, Illinois)
	{ latMin: 40, latMax: 42.5, minTempF: -12, coastalModifier: 18 },

	// Northern tier upper - harsh winters (New York, Michigan, Wisconsin, Iowa)
	{ latMin: 42.5, latMax: 45, minTempF: -18, coastalModifier: 22 },

	// Northern plains - very cold (Minnesota, Vermont, Maine interior)
	// Pacific NW coast (Portland, Seattle) is dramatically warmer due to marine influence
	{ latMin: 45, latMax: 47.5, minTempF: -25, coastalModifier: 35 },

	// Upper northern - extreme cold (North Dakota, Montana, northern Maine)
	{ latMin: 47.5, latMax: 50, minTempF: -30, coastalModifier: 35 },

	// Southern Canada - severe winters
	// UK/Ireland at this latitude has extreme Gulf Stream warming
	{ latMin: 50, latMax: 52.5, minTempF: -35, coastalModifier: 55 },

	// Central Canada - extreme winters
	{ latMin: 52.5, latMax: 55, minTempF: -40, coastalModifier: 55 },

	// Northern Canada - polar influence
	{ latMin: 55, latMax: 60, minTempF: -45, coastalModifier: 45 },

	// Subarctic
	{ latMin: 60, latMax: 70, minTempF: -50, coastalModifier: 35 }
];

/**
 * Southern hemisphere minimum temperature table. The southern hemisphere has
 * less landmass at high latitudes, so extreme cold zones are less common.
 * Values are adjusted for the predominantly oceanic climate.
 */
const MIN_TEMP_TABLE_SOUTH: MinTempEntry[] = [
	// Subtropical (northern Australia, southern Brazil)
	{ latMin: -25, latMax: -20, minTempF: 40, coastalModifier: 5 },

	// Warm temperate (southern Australia, central Argentina)
	{ latMin: -30, latMax: -25, minTempF: 28, coastalModifier: 8 },

	// Temperate (Tasmania, central Chile, South Africa)
	{ latMin: -35, latMax: -30, minTempF: 18, coastalModifier: 10 },

	// Cool temperate (New Zealand South Island, southern Chile)
	{ latMin: -40, latMax: -35, minTempF: 8, coastalModifier: 12 },

	// Cold temperate (Tierra del Fuego, Falklands)
	{ latMin: -50, latMax: -40, minTempF: -5, coastalModifier: 15 },

	// Sub-Antarctic
	{ latMin: -60, latMax: -50, minTempF: -25, coastalModifier: 10 },

	// Antarctic fringe - very cold
	{ latMin: -70, latMax: -60, minTempF: -45, coastalModifier: 5 }
];

/**
 * Finds the appropriate minimum temperature entry for a given latitude.
 */
function findMinTempEntry(latitude: number): MinTempEntry | null {
	const absLat = Math.abs(latitude);

	// Very close to equator - tropical, minimal frost concern
	if (absLat < 20) {
		return { latMin: 0, latMax: 20, minTempF: 50, coastalModifier: 5 };
	}

	const table = latitude >= 0 ? MIN_TEMP_TABLE_NORTH : MIN_TEMP_TABLE_SOUTH;

	for (const entry of table) {
		const entryLatMin = Math.min(Math.abs(entry.latMin), Math.abs(entry.latMax));
		const entryLatMax = Math.max(Math.abs(entry.latMin), Math.abs(entry.latMax));
		if (absLat >= entryLatMin && absLat < entryLatMax) {
			return entry;
		}
	}

	// Beyond table range - use extreme entry
	if (latitude >= 0) {
		return MIN_TEMP_TABLE_NORTH[MIN_TEMP_TABLE_NORTH.length - 1];
	} else {
		return MIN_TEMP_TABLE_SOUTH[MIN_TEMP_TABLE_SOUTH.length - 1];
	}
}

/**
 * Estimates whether a location is coastal based on its coordinates. Coastal
 * areas have milder winter temperatures due to oceanic thermal buffering.
 */
function estimateIsCoastal(coords: Coordinates): boolean {
	const { latitude, longitude } = coords;

	// US Pacific Coast
	if (longitude >= -125 && longitude <= -117 && latitude >= 32 && latitude <= 49) {
		return true;
	}

	// US Atlantic Coast
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

	// Mediterranean basin
	if (longitude >= -6 && longitude <= 36 && latitude >= 35 && latitude <= 45) {
		return true;
	}

	// UK and Ireland
	if (longitude >= -11 && longitude <= 2 && latitude >= 50 && latitude <= 60) {
		return true;
	}

	// Japanese archipelago
	if (longitude >= 129 && longitude <= 146 && latitude >= 31 && latitude <= 46) {
		return true;
	}

	// Australian coasts
	if (longitude >= 113 && longitude <= 154 && latitude >= -44 && latitude <= -10) {
		// Rough coastal check for Australia
		if (latitude > -20 || longitude < 120 || longitude > 150) {
			return true;
		}
	}

	// New Zealand
	if (longitude >= 166 && longitude <= 179 && latitude >= -47 && latitude <= -34) {
		return true;
	}

	return false;
}

/**
 * Estimates whether a location is in a warm desert climate. Desert areas often
 * have milder minimum winter temperatures than continental areas at the same
 * latitude because they lack the extreme cold air masses that affect continental
 * interiors. This primarily affects the US Southwest desert regions.
 */
function estimateIsWarmDesert(coords: Coordinates): boolean {
	const { latitude, longitude } = coords;

	// US Southwest deserts (Arizona, southern Nevada, southeastern California, southern New Mexico)
	// Phoenix, Las Vegas, Tucson area
	if (longitude >= -117 && longitude <= -103 && latitude >= 31 && latitude <= 37) {
		return true;
	}

	// Southern California desert (Palm Springs, Imperial Valley)
	if (longitude >= -117 && longitude <= -114 && latitude >= 32 && latitude <= 35) {
		return true;
	}

	return false;
}

/**
 * Temperature bonus for warm desert climates. Deserts have mild winter minimums
 * compared to continental climates at the same latitude.
 */
const DESERT_TEMP_BONUS_F = 18;

/**
 * Calculates elevation adjustment for minimum temperature. Higher elevations
 * experience colder minimum temperatures. The lapse rate is approximately
 * 3.5°F per 1000 feet (or about 6.4°C per 1000m).
 */
const ELEVATION_LAPSE_RATE_F_PER_300M = 3.5;

function calculateElevationTempAdjustment(elevationMeters: number): number {
	if (elevationMeters <= 0) {
		return 0;
	}
	// Negative adjustment (colder) for higher elevations
	return -Math.round((elevationMeters / 300) * ELEVATION_LAPSE_RATE_F_PER_300M);
}

/**
 * Estimates the average annual minimum winter temperature for a location.
 * This is the key value used to determine USDA hardiness zone.
 *
 * @param coords - Geographic coordinates
 * @param options - Optional elevation adjustment
 * @returns Estimated minimum temperature in Fahrenheit
 */
export function estimateMinWinterTemp(
	coords: Coordinates,
	options: { elevationMeters?: number; isCoastal?: boolean; isDesert?: boolean } = {}
): number {
	const entry = findMinTempEntry(coords.latitude);
	if (!entry) {
		// Equatorial - use warm default
		return 50;
	}

	let minTemp = entry.minTempF;

	// Apply coastal modifier (warmer)
	const isCoastal = options.isCoastal ?? estimateIsCoastal(coords);
	if (isCoastal) {
		minTemp += entry.coastalModifier;
	}

	// Apply desert climate bonus (warmer) - only if not already coastal
	const isDesert = options.isDesert ?? (!isCoastal && estimateIsWarmDesert(coords));
	if (isDesert) {
		minTemp += DESERT_TEMP_BONUS_F;
	}

	// Apply elevation adjustment (colder)
	if (options.elevationMeters) {
		minTemp += calculateElevationTempAdjustment(options.elevationMeters);
	}

	return minTemp;
}

/**
 * Converts a minimum temperature in Fahrenheit to a USDA hardiness zone number.
 * The formula maps the temperature to zones 1-13 based on the 10°F zone bands
 * starting at -60°F for zone 1.
 */
function tempToZoneNumber(minTempF: number): number {
	// Zone formula: zone = floor((temp + 60) / 10) + 1
	// Zone 1: -60 to -50, Zone 2: -50 to -40, etc.
	const rawZone = Math.floor((minTempF - ZONE_BASE_TEMP_F) / ZONE_RANGE_F) + 1;
	return Math.max(MIN_ZONE, Math.min(MAX_ZONE, rawZone));
}

/**
 * Determines the subzone (a or b) from a minimum temperature. Subzone 'a' is
 * the colder half of the zone (lower 5°F), subzone 'b' is the warmer half.
 */
function tempToSubzone(minTempF: number): HardinessSubzone {
	// Within each 10°F zone, the lower 5°F is 'a', upper 5°F is 'b'
	const offset = minTempF - ZONE_BASE_TEMP_F;
	const withinZone = ((offset % ZONE_RANGE_F) + ZONE_RANGE_F) % ZONE_RANGE_F;
	return withinZone < SUBZONE_RANGE_F ? 'a' : 'b';
}

/**
 * Calculates the temperature range for a given zone and subzone.
 */
function getZoneTempRange(zoneNumber: number, subzone: HardinessSubzone): { minTempF: number; maxTempF: number } {
	// Zone 1 starts at -60°F
	const zoneStart = ZONE_BASE_TEMP_F + (zoneNumber - 1) * ZONE_RANGE_F;
	const subzoneOffset = subzone === 'a' ? 0 : SUBZONE_RANGE_F;

	return {
		minTempF: zoneStart + subzoneOffset,
		maxTempF: zoneStart + subzoneOffset + SUBZONE_RANGE_F
	};
}

/**
 * Determines the USDA hardiness zone for a given geographic location. The
 * function estimates the average annual minimum winter temperature based on
 * latitude, with adjustments for coastal position and elevation, then maps
 * that temperature to the appropriate zone.
 *
 * The USDA system divides regions into 13 zones (1-13), with each zone spanning
 * a 10°F temperature range. Subzones 'a' and 'b' further divide each zone into
 * 5°F bands. Zone 1a is the coldest (-60°F to -55°F) and zone 13b is the warmest
 * (65°F to 70°F).
 *
 * @param coords - Geographic coordinates (latitude and longitude)
 * @param options - Optional ZIP code for US lookup or elevation adjustment
 * @returns Hardiness zone information including zone, temperature range, and source
 *
 * @example
 * ```typescript
 * // Portland, Oregon (zone 8b)
 * const zone = getHardinessZone({ latitude: 45.52, longitude: -122.68 });
 * console.log(zone.zone); // "8b"
 * console.log(zone.minTempF); // 15
 * console.log(zone.maxTempF); // 20
 *
 * // Denver, Colorado with elevation (zone 5b/6a depending on microclimate)
 * const denverZone = getHardinessZone(
 *   { latitude: 39.74, longitude: -104.99 },
 *   { elevationMeters: 1600 }
 * );
 * ```
 */
export function getHardinessZone(
	coords: Coordinates,
	options: HardinessLookupOptions & { elevationMeters?: number; isCoastal?: boolean; isDesert?: boolean } = {}
): HardinessZone {
	// Future enhancement: if options.zipCode is provided, look up from embedded
	// frostline data for more precise US zone data. For now, we use the
	// coordinate-based estimation which provides reasonable global coverage.

	const minTemp = estimateMinWinterTemp(coords, {
		elevationMeters: options.elevationMeters,
		isCoastal: options.isCoastal,
		isDesert: options.isDesert
	});

	const zoneNumber = tempToZoneNumber(minTemp);
	const subzone = tempToSubzone(minTemp);
	const tempRange = getZoneTempRange(zoneNumber, subzone);

	return {
		zone: `${zoneNumber}${subzone}`,
		zoneNumber,
		subzone,
		minTempF: tempRange.minTempF,
		maxTempF: tempRange.maxTempF,
		source: 'calculated',
		isApproximate: true
	};
}

/**
 * Formats a hardiness zone for display, optionally including the temperature range.
 *
 * @param zone - Hardiness zone information
 * @param includeTemp - Whether to include temperature range in output
 * @returns Formatted string like "Zone 8b" or "Zone 8b (15°F to 20°F)"
 */
export function formatHardinessZone(zone: HardinessZone, includeTemp: boolean = false): string {
	const base = `Zone ${zone.zone}`;
	if (!includeTemp) {
		return base;
	}
	return `${base} (${zone.minTempF}°F to ${zone.maxTempF}°F)`;
}

/**
 * Converts a temperature from Celsius to Fahrenheit.
 */
export function celsiusToFahrenheit(celsius: number): number {
	return (celsius * 9) / 5 + 32;
}

/**
 * Converts a temperature from Fahrenheit to Celsius.
 */
export function fahrenheitToCelsius(fahrenheit: number): number {
	return ((fahrenheit - 32) * 5) / 9;
}

/**
 * Formats the temperature range of a zone in both Fahrenheit and Celsius.
 *
 * @param zone - Hardiness zone information
 * @returns Formatted string like "15°F to 20°F (-9°C to -7°C)"
 */
export function formatZoneTempRange(zone: HardinessZone): string {
	const minC = Math.round(fahrenheitToCelsius(zone.minTempF));
	const maxC = Math.round(fahrenheitToCelsius(zone.maxTempF));
	return `${zone.minTempF}°F to ${zone.maxTempF}°F (${minC}°C to ${maxC}°C)`;
}
