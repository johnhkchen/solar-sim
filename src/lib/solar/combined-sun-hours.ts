/**
 * Combined sun-hours calculation module.
 *
 * This module combines ShadeMap's terrain/building shadow data with our tree
 * shadow calculations to produce total effective sun hours at an observation
 * point. It provides both real-time integration with ShadeMap (when available)
 * and standalone calculations for tree shadow impact.
 *
 * The approach samples time intervals throughout the day, checking both terrain
 * shade (from ShadeMap) and tree shadows (from our calculations) at each sample.
 * This produces an accurate combined sun-hours value along with a breakdown
 * showing how much shade comes from each source.
 */

import { getSunPosition, getSunTimes, getPolarCondition } from './position.js';
import type { Coordinates, SolarPosition } from './types.js';
import { SAMPLING_INTERVAL_MINUTES, SAMPLES_PER_DAY } from './types.js';
import {
	calculateTreeShadowLatLng,
	isPointInShadow,
	type MapTreeConfig,
	type LatLngShadowPolygon,
	type LatLng
} from './shadow-projection.js';
import { getTransparency } from './shade-types.js';

/**
 * Breakdown of sun hours showing contributions from different shade sources.
 * This enables the "X hours base - Y hours tree shade = Z effective" display.
 */
export interface SunHoursBreakdown {
	theoretical: number; // Maximum possible sun hours (no obstacles)
	terrainAndBuildingShadow: number; // Hours blocked by terrain/buildings (from ShadeMap)
	treeShadow: number; // Hours blocked by user-placed trees
	overlapShadow: number; // Hours when both terrain AND trees block (counted once)
	effective: number; // Actual sun hours after all shadows
}

/**
 * Result of a combined sun-hours calculation for a single day.
 */
export interface CombinedSunHoursResult {
	date: Date;
	location: LatLng;
	breakdown: SunHoursBreakdown;
	sunriseTime: Date | null;
	sunsetTime: Date | null;
	shadeMapAvailable: boolean;
}

/**
 * Result for a growing season or date range calculation.
 */
export interface SeasonalCombinedSunHours {
	startDate: Date;
	endDate: Date;
	location: LatLng;
	averageBreakdown: SunHoursBreakdown;
	dailyResults: CombinedSunHoursResult[];
	treeCount: number;
}

/**
 * Interface for ShadeMap layer sun queries.
 * This abstracts the ShadeMap API so we can mock it for testing.
 */
export interface ShadeMapQuery {
	/**
	 * Checks if a position is currently in the sun at the rendered time.
	 * Returns true if in sun, false if in shade from terrain/buildings.
	 */
	isPositionInSun(x: number, y: number): Promise<boolean>;

	/**
	 * Converts lat/lng to pixel coordinates for the current map view.
	 */
	latLngToPoint(lat: number, lng: number): { x: number; y: number } | null;

	/**
	 * Sets the date/time for the ShadeMap layer.
	 */
	setDate(date: Date): void;
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
 * Checks if a point is inside any of the tree shadow polygons.
 * Returns the maximum shade intensity from any overlapping shadow.
 */
function getTreeShadeAtPoint(
	point: LatLng,
	shadows: LatLngShadowPolygon[]
): number {
	let maxIntensity = 0;

	for (const shadow of shadows) {
		if (isPointInLatLngShadow(point, shadow)) {
			maxIntensity = Math.max(maxIntensity, shadow.shadeIntensity);
		}
	}

	return maxIntensity;
}

/**
 * Checks if a lat/lng point is inside a lat/lng shadow polygon.
 * Uses the ray casting algorithm adapted for geographic coordinates.
 */
function isPointInLatLngShadow(point: LatLng, shadow: LatLngShadowPolygon): boolean {
	const vertices = shadow.vertices;
	const n = vertices.length;
	if (n < 3) return false;

	let inside = false;
	for (let i = 0, j = n - 1; i < n; j = i++) {
		const xi = vertices[i].lng;
		const yi = vertices[i].lat;
		const xj = vertices[j].lng;
		const yj = vertices[j].lat;

		if (
			yi > point.lat !== yj > point.lat &&
			point.lng < ((xj - xi) * (point.lat - yi)) / (yj - yi) + xi
		) {
			inside = !inside;
		}
	}

	return inside;
}

/**
 * Calculates tree shadow hours at a specific observation point for a single day.
 *
 * This function samples throughout the day and checks if the observation point
 * falls within any tree shadow polygon at each sample time. It returns the total
 * hours blocked by trees, accounting for tree canopy transparency.
 *
 * @param observationPoint - The lat/lng where sun hours are measured
 * @param trees - Array of trees with positions and dimensions
 * @param coords - Coordinates for sun position calculation
 * @param date - The day to calculate for
 * @returns Hours blocked by tree shadows and the detailed shade samples
 */
export function calculateTreeShadowHours(
	observationPoint: LatLng,
	trees: MapTreeConfig[],
	coords: Coordinates,
	date: Date
): { blockedHours: number; sampleResults: boolean[] } {
	const startOfDay = getStartOfDayUTC(date);
	const sampleResults: boolean[] = [];
	let blockedSamples = 0;

	for (let i = 0; i < SAMPLES_PER_DAY; i++) {
		const sampleTime = new Date(
			startOfDay.getTime() + i * SAMPLING_INTERVAL_MINUTES * 60 * 1000
		);
		const sunPosition = getSunPosition(coords, sampleTime);

		// Skip samples when sun is below horizon
		if (sunPosition.altitude <= 0) {
			sampleResults.push(false);
			continue;
		}

		// Calculate tree shadows for this sun position
		const shadows: LatLngShadowPolygon[] = [];
		for (const tree of trees) {
			const shadow = calculateTreeShadowLatLng(tree, sunPosition);
			if (shadow) {
				shadows.push(shadow);
			}
		}

		// Check if observation point is in any tree shadow
		const shadeIntensity = getTreeShadeAtPoint(observationPoint, shadows);
		const isBlocked = shadeIntensity > 0.5; // Consider blocked if more than 50% shaded
		sampleResults.push(isBlocked);

		if (isBlocked) {
			blockedSamples++;
		}
	}

	const blockedHours = (blockedSamples * SAMPLING_INTERVAL_MINUTES) / 60;
	return { blockedHours, sampleResults };
}

/**
 * Calculates combined sun hours for a single day at an observation point.
 *
 * When a ShadeMap query interface is provided, this function samples both
 * terrain/building shade (from ShadeMap) and tree shadows (from our calculations)
 * at each interval. Without ShadeMap, it calculates theoretical sun hours minus
 * tree shadow hours.
 *
 * @param observationPoint - The lat/lng where sun hours are measured
 * @param trees - Array of trees affecting the observation point
 * @param coords - Coordinates for sun position calculation
 * @param date - The day to calculate for
 * @param shadeMapQuery - Optional ShadeMap interface for terrain/building queries
 * @returns Combined sun hours result with detailed breakdown
 */
export async function calculateCombinedSunHours(
	observationPoint: LatLng,
	trees: MapTreeConfig[],
	coords: Coordinates,
	date: Date,
	shadeMapQuery?: ShadeMapQuery
): Promise<CombinedSunHoursResult> {
	const startOfDay = getStartOfDayUTC(date);
	const sunTimes = getSunTimes(coords, date);
	const polarCondition = getPolarCondition(coords, date);

	// Initialize counters
	let theoreticalSamples = 0;
	let terrainBlockedSamples = 0;
	let treeBlockedSamples = 0;
	let bothBlockedSamples = 0;
	let effectiveSamples = 0;

	// For polar night, return zeros
	if (polarCondition === 'polar-night') {
		return {
			date: startOfDay,
			location: observationPoint,
			breakdown: {
				theoretical: 0,
				terrainAndBuildingShadow: 0,
				treeShadow: 0,
				overlapShadow: 0,
				effective: 0
			},
			sunriseTime: null,
			sunsetTime: null,
			shadeMapAvailable: !!shadeMapQuery
		};
	}

	// Get pixel coordinates for ShadeMap queries if available
	let pixelPoint: { x: number; y: number } | null = null;
	if (shadeMapQuery) {
		pixelPoint = shadeMapQuery.latLngToPoint(observationPoint.lat, observationPoint.lng);
	}

	// Sample throughout the day
	for (let i = 0; i < SAMPLES_PER_DAY; i++) {
		const sampleTime = new Date(
			startOfDay.getTime() + i * SAMPLING_INTERVAL_MINUTES * 60 * 1000
		);
		const sunPosition = getSunPosition(coords, sampleTime);

		// Skip samples when sun is below horizon
		if (sunPosition.altitude <= 0) {
			continue;
		}

		theoreticalSamples++;

		// Check tree shadow at this time
		const treeShadows: LatLngShadowPolygon[] = [];
		for (const tree of trees) {
			const shadow = calculateTreeShadowLatLng(tree, sunPosition);
			if (shadow) {
				treeShadows.push(shadow);
			}
		}
		const treeShadeIntensity = getTreeShadeAtPoint(observationPoint, treeShadows);
		const treeBlocked = treeShadeIntensity > 0.5;

		// Check terrain/building shadow if ShadeMap available
		let terrainBlocked = false;
		if (shadeMapQuery && pixelPoint) {
			try {
				// Update ShadeMap time and query shade status
				shadeMapQuery.setDate(sampleTime);
				// Small delay to allow render (ShadeMap is async)
				await new Promise((resolve) => setTimeout(resolve, 10));
				terrainBlocked = !(await shadeMapQuery.isPositionInSun(pixelPoint.x, pixelPoint.y));
			} catch {
				// If ShadeMap query fails, assume no terrain blocking
				terrainBlocked = false;
			}
		}

		// Count different shade conditions
		if (terrainBlocked && treeBlocked) {
			bothBlockedSamples++;
		} else if (terrainBlocked) {
			terrainBlockedSamples++;
		} else if (treeBlocked) {
			treeBlockedSamples++;
		} else {
			effectiveSamples++;
		}
	}

	// Convert sample counts to hours
	const toHours = (samples: number) => (samples * SAMPLING_INTERVAL_MINUTES) / 60;

	const breakdown: SunHoursBreakdown = {
		theoretical: toHours(theoreticalSamples),
		terrainAndBuildingShadow: toHours(terrainBlockedSamples + bothBlockedSamples),
		treeShadow: toHours(treeBlockedSamples + bothBlockedSamples),
		overlapShadow: toHours(bothBlockedSamples),
		effective: toHours(effectiveSamples)
	};

	return {
		date: startOfDay,
		location: observationPoint,
		breakdown,
		sunriseTime: sunTimes.sunrise,
		sunsetTime: sunTimes.sunset,
		shadeMapAvailable: !!shadeMapQuery
	};
}

/**
 * Calculates combined sun hours without ShadeMap integration.
 *
 * This synchronous version calculates theoretical sun hours minus tree shadow
 * hours. It's useful when ShadeMap isn't available or for quick estimates.
 * The terrainAndBuildingShadow field will be 0 since we can't query ShadeMap.
 *
 * @param observationPoint - The lat/lng where sun hours are measured
 * @param trees - Array of trees affecting the observation point
 * @param coords - Coordinates for sun position calculation
 * @param date - The day to calculate for
 * @returns Combined sun hours result with tree shadow breakdown
 */
export function calculateCombinedSunHoursSync(
	observationPoint: LatLng,
	trees: MapTreeConfig[],
	coords: Coordinates,
	date: Date
): CombinedSunHoursResult {
	const startOfDay = getStartOfDayUTC(date);
	const sunTimes = getSunTimes(coords, date);
	const polarCondition = getPolarCondition(coords, date);

	// Initialize counters
	let theoreticalSamples = 0;
	let treeBlockedSamples = 0;

	// For polar night, return zeros
	if (polarCondition === 'polar-night') {
		return {
			date: startOfDay,
			location: observationPoint,
			breakdown: {
				theoretical: 0,
				terrainAndBuildingShadow: 0,
				treeShadow: 0,
				overlapShadow: 0,
				effective: 0
			},
			sunriseTime: null,
			sunsetTime: null,
			shadeMapAvailable: false
		};
	}

	// For midnight sun, count all samples but still check tree shadows
	// Sample throughout the day
	for (let i = 0; i < SAMPLES_PER_DAY; i++) {
		const sampleTime = new Date(
			startOfDay.getTime() + i * SAMPLING_INTERVAL_MINUTES * 60 * 1000
		);
		const sunPosition = getSunPosition(coords, sampleTime);

		// Skip samples when sun is below horizon
		if (sunPosition.altitude <= 0) {
			continue;
		}

		theoreticalSamples++;

		// Check tree shadow at this time
		if (trees.length > 0) {
			const treeShadows: LatLngShadowPolygon[] = [];
			for (const tree of trees) {
				const shadow = calculateTreeShadowLatLng(tree, sunPosition);
				if (shadow) {
					treeShadows.push(shadow);
				}
			}
			const treeShadeIntensity = getTreeShadeAtPoint(observationPoint, treeShadows);
			if (treeShadeIntensity > 0.5) {
				treeBlockedSamples++;
			}
		}
	}

	// Convert sample counts to hours
	const toHours = (samples: number) => (samples * SAMPLING_INTERVAL_MINUTES) / 60;
	const theoretical = toHours(theoreticalSamples);
	const treeBlocked = toHours(treeBlockedSamples);

	const breakdown: SunHoursBreakdown = {
		theoretical,
		terrainAndBuildingShadow: 0, // Unknown without ShadeMap
		treeShadow: treeBlocked,
		overlapShadow: 0,
		effective: theoretical - treeBlocked
	};

	return {
		date: startOfDay,
		location: observationPoint,
		breakdown,
		sunriseTime: sunTimes.sunrise,
		sunsetTime: sunTimes.sunset,
		shadeMapAvailable: false
	};
}

/**
 * Calculates seasonal (growing season) average sun hours at an observation point.
 *
 * This function aggregates daily calculations across a date range, producing
 * averages that are useful for horticultural planning. The growing season
 * average is typically more relevant than a single day's reading.
 *
 * @param observationPoint - The lat/lng where sun hours are measured
 * @param trees - Array of trees affecting the observation point
 * @param coords - Coordinates for sun position calculation
 * @param startDate - First day of the range
 * @param endDate - Last day of the range
 * @returns Seasonal summary with averages and daily breakdowns
 */
export function calculateSeasonalCombinedSunHours(
	observationPoint: LatLng,
	trees: MapTreeConfig[],
	coords: Coordinates,
	startDate: Date,
	endDate: Date
): SeasonalCombinedSunHours {
	const dailyResults: CombinedSunHoursResult[] = [];

	// Iterate day by day
	const current = new Date(startDate);
	current.setUTCHours(0, 0, 0, 0);
	const end = new Date(endDate);
	end.setUTCHours(0, 0, 0, 0);

	while (current <= end) {
		const result = calculateCombinedSunHoursSync(
			observationPoint,
			trees,
			coords,
			new Date(current)
		);
		dailyResults.push(result);
		current.setUTCDate(current.getUTCDate() + 1);
	}

	// Calculate averages
	const count = dailyResults.length;
	if (count === 0) {
		return {
			startDate: new Date(startDate),
			endDate: new Date(endDate),
			location: observationPoint,
			averageBreakdown: {
				theoretical: 0,
				terrainAndBuildingShadow: 0,
				treeShadow: 0,
				overlapShadow: 0,
				effective: 0
			},
			dailyResults: [],
			treeCount: trees.length
		};
	}

	const sumBreakdown = dailyResults.reduce(
		(acc, r) => ({
			theoretical: acc.theoretical + r.breakdown.theoretical,
			terrainAndBuildingShadow:
				acc.terrainAndBuildingShadow + r.breakdown.terrainAndBuildingShadow,
			treeShadow: acc.treeShadow + r.breakdown.treeShadow,
			overlapShadow: acc.overlapShadow + r.breakdown.overlapShadow,
			effective: acc.effective + r.breakdown.effective
		}),
		{
			theoretical: 0,
			terrainAndBuildingShadow: 0,
			treeShadow: 0,
			overlapShadow: 0,
			effective: 0
		}
	);

	const averageBreakdown: SunHoursBreakdown = {
		theoretical: sumBreakdown.theoretical / count,
		terrainAndBuildingShadow: sumBreakdown.terrainAndBuildingShadow / count,
		treeShadow: sumBreakdown.treeShadow / count,
		overlapShadow: sumBreakdown.overlapShadow / count,
		effective: sumBreakdown.effective / count
	};

	return {
		startDate: new Date(startDate),
		endDate: new Date(endDate),
		location: observationPoint,
		averageBreakdown,
		dailyResults,
		treeCount: trees.length
	};
}

/**
 * Formats a sun hours breakdown for display.
 * Returns a human-readable string like "14.2h base - 2.1h tree shade = 12.1h effective"
 */
export function formatSunHoursBreakdown(breakdown: SunHoursBreakdown): string {
	const { theoretical, treeShadow, terrainAndBuildingShadow, effective } = breakdown;

	const parts: string[] = [];
	parts.push(`${theoretical.toFixed(1)}h base`);

	if (terrainAndBuildingShadow > 0.1) {
		parts.push(`${terrainAndBuildingShadow.toFixed(1)}h terrain/building shade`);
	}

	if (treeShadow > 0.1) {
		parts.push(`${treeShadow.toFixed(1)}h tree shade`);
	}

	if (terrainAndBuildingShadow > 0.1 || treeShadow > 0.1) {
		return `${parts.join(' - ')} = ${effective.toFixed(1)}h effective`;
	}

	return `${effective.toFixed(1)}h sun`;
}

/**
 * Calculates the percent reduction in sun hours from trees.
 */
export function getTreeShadePercent(breakdown: SunHoursBreakdown): number {
	if (breakdown.theoretical <= 0) return 0;
	return (breakdown.treeShadow / breakdown.theoretical) * 100;
}

/**
 * Calculates the total percent reduction from all shade sources.
 */
export function getTotalShadePercent(breakdown: SunHoursBreakdown): number {
	if (breakdown.theoretical <= 0) return 0;
	return ((breakdown.theoretical - breakdown.effective) / breakdown.theoretical) * 100;
}
