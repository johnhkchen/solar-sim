/**
 * Grid-based sun exposure calculation module.
 *
 * This module extends the point-based sun-hours calculation to compute exposure
 * across a grid of points, producing data suitable for heatmap rendering. The
 * grid samples sun hours at regular intervals within a geographic bounding box,
 * integrating results over a configurable date range.
 *
 * The approach balances accuracy with performance by sampling representative
 * days rather than calculating every day. For a 6-month growing season, sampling
 * 12-18 days captures the seasonal variation in sun position while keeping
 * computation under 5 seconds for a typical residential lot at 2m resolution.
 */

import type { Coordinates } from './types.js';
import { getSunPosition, getSunTimes, getPolarCondition } from './position.js';
import { SAMPLING_INTERVAL_MINUTES, SAMPLES_PER_DAY } from './types.js';
import {
	calculateTreeShadowLatLng,
	type MapTreeConfig,
	type LatLngShadowPolygon,
	type LatLng
} from './shadow-projection.js';

/**
 * Geographic bounding box defining the area to analyze.
 * Southwest corner is the origin, northeast defines the extent.
 */
export interface LatLngBounds {
	south: number;
	west: number;
	north: number;
	east: number;
}

/**
 * Date range for exposure calculation.
 * The module samples representative days within this range.
 */
export interface DateRange {
	start: Date;
	end: Date;
}

/**
 * Configuration for grid calculation.
 * Controls the trade-off between accuracy and performance.
 */
export interface GridConfig {
	resolution: number; // meters per cell
	sampleDays?: number; // number of representative days to sample (default: 12)
	timeIntervalMinutes?: number; // minutes between time samples within each day (default: 15)
}

/**
 * Result of grid-based exposure calculation.
 * Contains the exposure values for each cell in row-major order.
 */
export interface ExposureGrid {
	bounds: LatLngBounds;
	resolution: number; // meters per cell
	width: number; // number of cells horizontally
	height: number; // number of cells vertically
	values: Float32Array; // average sun-hours per cell, row-major (south to north, west to east)
	dateRange: DateRange;
	sampleDaysUsed: number;
	computeTimeMs: number;
}

/**
 * Single cell in the exposure grid with position and value.
 * Useful for rendering or inspecting individual cells.
 */
export interface ExposureCell {
	row: number;
	col: number;
	lat: number;
	lng: number;
	sunHours: number;
}

/**
 * Progress callback for long-running calculations.
 * Reports progress as a fraction from 0 to 1.
 */
export type ProgressCallback = (progress: number) => void;

/**
 * Meters per degree of latitude (approximately constant).
 * Earth's circumference divided by 360 degrees.
 */
const METERS_PER_DEGREE_LAT = 111320;

/**
 * Converts meters to latitude offset.
 */
function metersToLatDegrees(meters: number): number {
	return meters / METERS_PER_DEGREE_LAT;
}

/**
 * Converts meters to longitude offset at a given latitude.
 * Longitude degrees shrink toward the poles as meridians converge.
 */
function metersToLngDegrees(meters: number, latitude: number): number {
	const latRad = (latitude * Math.PI) / 180;
	const metersPerDegreeLng = METERS_PER_DEGREE_LAT * Math.cos(latRad);
	return meters / metersPerDegreeLng;
}

/**
 * Converts latitude offset to meters.
 */
function latDegreesToMeters(degrees: number): number {
	return degrees * METERS_PER_DEGREE_LAT;
}

/**
 * Converts longitude offset to meters at a given latitude.
 */
function lngDegreesToMeters(degrees: number, latitude: number): number {
	const latRad = (latitude * Math.PI) / 180;
	const metersPerDegreeLng = METERS_PER_DEGREE_LAT * Math.cos(latRad);
	return degrees * metersPerDegreeLng;
}

/**
 * Calculates the dimensions of the grid in cells.
 * Returns the width (columns) and height (rows) of the grid.
 */
export function calculateGridDimensions(
	bounds: LatLngBounds,
	resolutionMeters: number
): { width: number; height: number } {
	const centerLat = (bounds.south + bounds.north) / 2;

	// Calculate extent in meters
	const heightMeters = latDegreesToMeters(bounds.north - bounds.south);
	const widthMeters = lngDegreesToMeters(bounds.east - bounds.west, centerLat);

	// Calculate number of cells (at least 1 in each dimension)
	const height = Math.max(1, Math.ceil(heightMeters / resolutionMeters));
	const width = Math.max(1, Math.ceil(widthMeters / resolutionMeters));

	return { width, height };
}

/**
 * Generates an array of sample dates spanning the date range.
 * Distributes samples evenly across the range to capture seasonal variation.
 */
export function generateSampleDates(dateRange: DateRange, sampleCount: number): Date[] {
	const start = dateRange.start.getTime();
	const end = dateRange.end.getTime();
	const duration = end - start;

	if (sampleCount <= 1) {
		// Single sample at midpoint
		return [new Date(start + duration / 2)];
	}

	const dates: Date[] = [];
	for (let i = 0; i < sampleCount; i++) {
		// Distribute samples evenly, starting from the midpoint of each segment
		const fraction = (i + 0.5) / sampleCount;
		const timestamp = start + fraction * duration;
		dates.push(new Date(timestamp));
	}

	return dates;
}

/**
 * Calculates the center lat/lng for a grid cell.
 * Row 0 is the southernmost row, column 0 is the westernmost column.
 */
export function getCellCenter(
	bounds: LatLngBounds,
	row: number,
	col: number,
	width: number,
	height: number
): LatLng {
	// Calculate cell offsets as fraction of total extent
	const latFraction = (row + 0.5) / height;
	const lngFraction = (col + 0.5) / width;

	return {
		lat: bounds.south + latFraction * (bounds.north - bounds.south),
		lng: bounds.west + lngFraction * (bounds.east - bounds.west)
	};
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

		if (yi > point.lat !== yj > point.lat && point.lng < ((xj - xi) * (point.lat - yi)) / (yj - yi) + xi) {
			inside = !inside;
		}
	}

	return inside;
}

/**
 * Gets the maximum shade intensity from any overlapping tree shadow at a point.
 */
function getTreeShadeAtPoint(point: LatLng, shadows: LatLngShadowPolygon[]): number {
	let maxIntensity = 0;

	for (const shadow of shadows) {
		if (isPointInLatLngShadow(point, shadow)) {
			maxIntensity = Math.max(maxIntensity, shadow.shadeIntensity);
		}
	}

	return maxIntensity;
}

/**
 * Creates a Date at the start of a day in UTC.
 */
function getStartOfDayUTC(date: Date): Date {
	const start = new Date(date);
	start.setUTCHours(0, 0, 0, 0);
	return start;
}

/**
 * Calculates sun hours for a single point on a single day.
 * Returns the effective sun hours after accounting for tree shadows.
 */
function calculatePointSunHoursForDay(
	point: LatLng,
	trees: MapTreeConfig[],
	coords: Coordinates,
	date: Date,
	timeIntervalMinutes: number
): number {
	const startOfDay = getStartOfDayUTC(date);
	const polarCondition = getPolarCondition(coords, date);

	// Polar night: no sun hours
	if (polarCondition === 'polar-night') {
		return 0;
	}

	const samplesPerDay = Math.ceil((24 * 60) / timeIntervalMinutes);
	let effectiveSamples = 0;

	for (let i = 0; i < samplesPerDay; i++) {
		const sampleTime = new Date(startOfDay.getTime() + i * timeIntervalMinutes * 60 * 1000);
		const sunPosition = getSunPosition(coords, sampleTime);

		// Skip samples when sun is below horizon
		if (sunPosition.altitude <= 0) {
			continue;
		}

		// Check tree shadow at this time
		let isBlocked = false;
		if (trees.length > 0) {
			const treeShadows: LatLngShadowPolygon[] = [];
			for (const tree of trees) {
				const shadow = calculateTreeShadowLatLng(tree, sunPosition);
				if (shadow) {
					treeShadows.push(shadow);
				}
			}
			const treeShadeIntensity = getTreeShadeAtPoint(point, treeShadows);
			isBlocked = treeShadeIntensity > 0.5;
		}

		if (!isBlocked) {
			effectiveSamples++;
		}
	}

	return (effectiveSamples * timeIntervalMinutes) / 60;
}

/**
 * Calculates sun exposure across a grid of points.
 *
 * This function samples sun hours at each grid cell center across a set of
 * representative days within the date range. For each day and time sample, it
 * checks whether the cell is in shadow from any user-placed trees.
 *
 * The result is an ExposureGrid containing average sun hours per cell, suitable
 * for rendering as a heatmap. The values array is in row-major order (south to
 * north, west to east), meaning the first element is the southwest corner.
 *
 * @param bounds - Geographic bounding box defining the analysis area
 * @param trees - Array of trees that cast shadows
 * @param dateRange - Date range to analyze (e.g., growing season)
 * @param config - Grid resolution and sampling configuration
 * @param onProgress - Optional callback for progress updates
 * @returns ExposureGrid with average sun hours for each cell
 */
export function calculateExposureGrid(
	bounds: LatLngBounds,
	trees: MapTreeConfig[],
	dateRange: DateRange,
	config: GridConfig,
	onProgress?: ProgressCallback
): ExposureGrid {
	const startTime = performance.now();

	const resolution = config.resolution;
	const sampleDays = config.sampleDays ?? 12;
	const timeIntervalMinutes = config.timeIntervalMinutes ?? 15;

	// Calculate grid dimensions
	const { width, height } = calculateGridDimensions(bounds, resolution);
	const totalCells = width * height;

	// Generate sample dates
	const sampleDates = generateSampleDates(dateRange, sampleDays);

	// Center of bounds for coordinate reference
	const centerLat = (bounds.south + bounds.north) / 2;
	const coords: Coordinates = {
		latitude: centerLat,
		longitude: (bounds.west + bounds.east) / 2
	};

	// Allocate result array
	const values = new Float32Array(totalCells);

	// Calculate sun hours for each cell
	let cellsProcessed = 0;

	for (let row = 0; row < height; row++) {
		for (let col = 0; col < width; col++) {
			const cellIndex = row * width + col;
			const cellCenter = getCellCenter(bounds, row, col, width, height);

			// Cell coordinates for sun position calculation
			const cellCoords: Coordinates = {
				latitude: cellCenter.lat,
				longitude: cellCenter.lng
			};

			// Accumulate sun hours across sample days
			let totalSunHours = 0;
			for (const sampleDate of sampleDates) {
				totalSunHours += calculatePointSunHoursForDay(
					cellCenter,
					trees,
					cellCoords,
					sampleDate,
					timeIntervalMinutes
				);
			}

			// Store average sun hours
			values[cellIndex] = totalSunHours / sampleDates.length;

			cellsProcessed++;
			if (onProgress && cellsProcessed % 10 === 0) {
				onProgress(cellsProcessed / totalCells);
			}
		}
	}

	if (onProgress) {
		onProgress(1);
	}

	const computeTimeMs = performance.now() - startTime;

	return {
		bounds,
		resolution,
		width,
		height,
		values,
		dateRange,
		sampleDaysUsed: sampleDates.length,
		computeTimeMs
	};
}

/**
 * Calculates exposure grid asynchronously, yielding to the event loop.
 *
 * This version breaks up the calculation into chunks and uses setTimeout
 * to avoid blocking the UI for long calculations. Use this in browser
 * contexts where responsiveness matters.
 *
 * @param bounds - Geographic bounding box defining the analysis area
 * @param trees - Array of trees that cast shadows
 * @param dateRange - Date range to analyze (e.g., growing season)
 * @param config - Grid resolution and sampling configuration
 * @param onProgress - Optional callback for progress updates
 * @returns Promise resolving to ExposureGrid with average sun hours for each cell
 */
export async function calculateExposureGridAsync(
	bounds: LatLngBounds,
	trees: MapTreeConfig[],
	dateRange: DateRange,
	config: GridConfig,
	onProgress?: ProgressCallback
): Promise<ExposureGrid> {
	const startTime = performance.now();

	const resolution = config.resolution;
	const sampleDays = config.sampleDays ?? 12;
	const timeIntervalMinutes = config.timeIntervalMinutes ?? 15;

	// Calculate grid dimensions
	const { width, height } = calculateGridDimensions(bounds, resolution);
	const totalCells = width * height;

	// Generate sample dates
	const sampleDates = generateSampleDates(dateRange, sampleDays);

	// Allocate result array
	const values = new Float32Array(totalCells);

	// Process in chunks to avoid blocking
	const chunkSize = 50; // cells per chunk
	let cellsProcessed = 0;

	for (let row = 0; row < height; row++) {
		for (let col = 0; col < width; col++) {
			const cellIndex = row * width + col;
			const cellCenter = getCellCenter(bounds, row, col, width, height);

			// Cell coordinates for sun position calculation
			const cellCoords: Coordinates = {
				latitude: cellCenter.lat,
				longitude: cellCenter.lng
			};

			// Accumulate sun hours across sample days
			let totalSunHours = 0;
			for (const sampleDate of sampleDates) {
				totalSunHours += calculatePointSunHoursForDay(
					cellCenter,
					trees,
					cellCoords,
					sampleDate,
					timeIntervalMinutes
				);
			}

			// Store average sun hours
			values[cellIndex] = totalSunHours / sampleDates.length;

			cellsProcessed++;

			// Yield to event loop periodically
			if (cellsProcessed % chunkSize === 0) {
				if (onProgress) {
					onProgress(cellsProcessed / totalCells);
				}
				await new Promise((resolve) => setTimeout(resolve, 0));
			}
		}
	}

	if (onProgress) {
		onProgress(1);
	}

	const computeTimeMs = performance.now() - startTime;

	return {
		bounds,
		resolution,
		width,
		height,
		values,
		dateRange,
		sampleDaysUsed: sampleDates.length,
		computeTimeMs
	};
}

/**
 * Gets the exposure value for a specific cell in the grid.
 *
 * @param grid - The exposure grid
 * @param row - Row index (0 is southernmost)
 * @param col - Column index (0 is westernmost)
 * @returns Sun hours for the cell, or undefined if out of bounds
 */
export function getExposureAt(grid: ExposureGrid, row: number, col: number): number | undefined {
	if (row < 0 || row >= grid.height || col < 0 || col >= grid.width) {
		return undefined;
	}
	return grid.values[row * grid.width + col];
}

/**
 * Gets the exposure cell data including position and value.
 *
 * @param grid - The exposure grid
 * @param row - Row index (0 is southernmost)
 * @param col - Column index (0 is westernmost)
 * @returns ExposureCell with position and sun hours, or undefined if out of bounds
 */
export function getExposureCellAt(grid: ExposureGrid, row: number, col: number): ExposureCell | undefined {
	if (row < 0 || row >= grid.height || col < 0 || col >= grid.width) {
		return undefined;
	}

	const center = getCellCenter(grid.bounds, row, col, grid.width, grid.height);

	return {
		row,
		col,
		lat: center.lat,
		lng: center.lng,
		sunHours: grid.values[row * grid.width + col]
	};
}

/**
 * Finds the grid cell containing a given lat/lng coordinate.
 *
 * @param grid - The exposure grid
 * @param lat - Latitude of the point
 * @param lng - Longitude of the point
 * @returns { row, col } indices, or undefined if outside grid bounds
 */
export function findCellAtLatLng(
	grid: ExposureGrid,
	lat: number,
	lng: number
): { row: number; col: number } | undefined {
	const { bounds, width, height } = grid;

	// Check if point is within bounds
	if (lat < bounds.south || lat > bounds.north || lng < bounds.west || lng > bounds.east) {
		return undefined;
	}

	// Calculate fractional position within bounds
	const latFraction = (lat - bounds.south) / (bounds.north - bounds.south);
	const lngFraction = (lng - bounds.west) / (bounds.east - bounds.west);

	// Convert to cell indices
	const row = Math.min(height - 1, Math.floor(latFraction * height));
	const col = Math.min(width - 1, Math.floor(lngFraction * width));

	return { row, col };
}

/**
 * Gets the sun hours at a specific lat/lng coordinate.
 *
 * @param grid - The exposure grid
 * @param lat - Latitude of the point
 * @param lng - Longitude of the point
 * @returns Sun hours at the point, or undefined if outside grid bounds
 */
export function getExposureAtLatLng(grid: ExposureGrid, lat: number, lng: number): number | undefined {
	const cell = findCellAtLatLng(grid, lat, lng);
	if (!cell) {
		return undefined;
	}
	return grid.values[cell.row * grid.width + cell.col];
}

/**
 * Calculates statistics for an exposure grid.
 *
 * @param grid - The exposure grid
 * @returns Statistics including min, max, mean, and standard deviation
 */
export function getExposureGridStats(grid: ExposureGrid): {
	min: number;
	max: number;
	mean: number;
	stdDev: number;
} {
	const { values } = grid;
	const n = values.length;

	if (n === 0) {
		return { min: 0, max: 0, mean: 0, stdDev: 0 };
	}

	let min = values[0];
	let max = values[0];
	let sum = 0;

	for (let i = 0; i < n; i++) {
		const v = values[i];
		if (v < min) min = v;
		if (v > max) max = v;
		sum += v;
	}

	const mean = sum / n;

	// Calculate variance
	let variance = 0;
	for (let i = 0; i < n; i++) {
		const diff = values[i] - mean;
		variance += diff * diff;
	}
	variance /= n;

	return {
		min,
		max,
		mean,
		stdDev: Math.sqrt(variance)
	};
}

/**
 * Iterates over all cells in the grid, calling the callback for each.
 * Useful for rendering or analysis without manual index management.
 *
 * @param grid - The exposure grid
 * @param callback - Function called for each cell with its data
 */
export function forEachExposureCell(
	grid: ExposureGrid,
	callback: (cell: ExposureCell) => void
): void {
	for (let row = 0; row < grid.height; row++) {
		for (let col = 0; col < grid.width; col++) {
			const center = getCellCenter(grid.bounds, row, col, grid.width, grid.height);
			callback({
				row,
				col,
				lat: center.lat,
				lng: center.lng,
				sunHours: grid.values[row * grid.width + col]
			});
		}
	}
}

/**
 * Interface for ShadeMap query capabilities.
 * This mirrors the ShadeMapInterface from MapPicker but is defined here
 * to avoid circular dependencies.
 */
export interface ShadeMapQueryInterface {
	/** Get hours of sun at a lat/lng position (requires sun exposure mode) */
	getHoursOfSun: (lat: number, lng: number) => number | null;
	/** Enable sun exposure mode for a date range */
	enableSunExposure: (startDate: Date, endDate: Date, iterations?: number) => void;
	/** Disable sun exposure mode */
	disableSunExposure: () => void;
	/** Check if ShadeMap is available */
	isAvailable: () => boolean;
}

/**
 * Extended exposure grid result that includes terrain/building shadow contribution.
 */
export interface CombinedExposureGrid extends ExposureGrid {
	/** Sun hours from terrain/building shadows only (before tree adjustment) */
	terrainValues: Float32Array;
	/** Whether ShadeMap data was used */
	shadeMapUsed: boolean;
}

/**
 * Calculates combined exposure grid using ShadeMap for terrain/building shadows
 * and our tree shadow calculations.
 *
 * This function leverages ShadeMap's sun exposure mode to get terrain/building
 * shadow data, then subtracts tree shadow effects to produce a combined result.
 * The ShadeMap provides accurate building heights and terrain horizon shadows
 * that our local calculations can't replicate.
 *
 * Flow:
 * 1. Enable ShadeMap sun exposure mode for the date range
 * 2. Wait for ShadeMap to compute (it renders shadows internally)
 * 3. Query each grid cell for ShadeMap sun hours
 * 4. Subtract tree shadow effects using our ray-tracing
 * 5. Return combined grid with breakdown
 *
 * @param bounds - Geographic bounding box defining the analysis area
 * @param trees - Array of trees that cast shadows
 * @param dateRange - Date range to analyze (e.g., growing season)
 * @param config - Grid resolution and sampling configuration
 * @param shadeMap - ShadeMap query interface from MapPicker
 * @param onProgress - Optional callback for progress updates
 * @returns Promise resolving to CombinedExposureGrid with terrain and tree shadow data
 */
export async function calculateCombinedExposureGrid(
	bounds: LatLngBounds,
	trees: MapTreeConfig[],
	dateRange: DateRange,
	config: GridConfig,
	shadeMap: ShadeMapQueryInterface | null,
	onProgress?: ProgressCallback
): Promise<CombinedExposureGrid> {
	const startTime = performance.now();

	const resolution = config.resolution;
	const sampleDays = config.sampleDays ?? 12;
	const timeIntervalMinutes = config.timeIntervalMinutes ?? 15;

	// Calculate grid dimensions
	const { width, height } = calculateGridDimensions(bounds, resolution);
	const totalCells = width * height;

	// Generate sample dates
	const sampleDates = generateSampleDates(dateRange, sampleDays);

	// Allocate result arrays
	const values = new Float32Array(totalCells);
	const terrainValues = new Float32Array(totalCells);

	// Check if ShadeMap is available
	const useShadeMap = shadeMap?.isAvailable() ?? false;

	if (useShadeMap && shadeMap) {
		// Enable ShadeMap sun exposure mode for our date range
		// Using more iterations for better accuracy
		const iterations = Math.min(64, sampleDays * 4);
		shadeMap.enableSunExposure(dateRange.start, dateRange.end, iterations);

		// Wait for ShadeMap to compute shadows
		// The library needs time to render shadows for each iteration
		await new Promise((resolve) => setTimeout(resolve, 500));
	}

	// Process cells
	const chunkSize = 50;
	let cellsProcessed = 0;

	for (let row = 0; row < height; row++) {
		for (let col = 0; col < width; col++) {
			const cellIndex = row * width + col;
			const cellCenter = getCellCenter(bounds, row, col, width, height);

			// Get ShadeMap sun hours (terrain + buildings only)
			let shadeMapHours: number | null = null;
			if (useShadeMap && shadeMap) {
				shadeMapHours = shadeMap.getHoursOfSun(cellCenter.lat, cellCenter.lng);
			}

			// Cell coordinates for sun position calculation
			const cellCoords: Coordinates = {
				latitude: cellCenter.lat,
				longitude: cellCenter.lng
			};

			// Calculate tree shadow reduction
			let treeShadowHours = 0;
			if (trees.length > 0) {
				// Sample tree shadows across the date range
				for (const sampleDate of sampleDates) {
					treeShadowHours += calculateTreeShadowHoursForDay(
						cellCenter,
						trees,
						cellCoords,
						sampleDate,
						timeIntervalMinutes
					);
				}
				treeShadowHours /= sampleDates.length;
			}

			// Combine results
			if (shadeMapHours !== null) {
				// ShadeMap gives us hours including terrain/building shadows
				terrainValues[cellIndex] = shadeMapHours;
				// Subtract tree shadows (but don't go negative)
				values[cellIndex] = Math.max(0, shadeMapHours - treeShadowHours);
			} else {
				// Fall back to theoretical calculation without terrain data
				let theoreticalHours = 0;
				for (const sampleDate of sampleDates) {
					theoreticalHours += calculatePointSunHoursForDay(
						cellCenter,
						[], // No trees - get theoretical max
						cellCoords,
						sampleDate,
						timeIntervalMinutes
					);
				}
				theoreticalHours /= sampleDates.length;
				terrainValues[cellIndex] = theoreticalHours;
				values[cellIndex] = theoreticalHours - treeShadowHours;
			}

			cellsProcessed++;

			// Yield to event loop periodically
			if (cellsProcessed % chunkSize === 0) {
				if (onProgress) {
					onProgress(cellsProcessed / totalCells);
				}
				await new Promise((resolve) => setTimeout(resolve, 0));
			}
		}
	}

	// Disable sun exposure mode when done
	if (useShadeMap && shadeMap) {
		shadeMap.disableSunExposure();
	}

	if (onProgress) {
		onProgress(1);
	}

	const computeTimeMs = performance.now() - startTime;

	return {
		bounds,
		resolution,
		width,
		height,
		values,
		terrainValues,
		dateRange,
		sampleDaysUsed: sampleDates.length,
		computeTimeMs,
		shadeMapUsed: useShadeMap
	};
}

/**
 * Calculates hours blocked by tree shadows for a single day at a point.
 * This is a helper for the combined grid calculation.
 */
function calculateTreeShadowHoursForDay(
	point: LatLng,
	trees: MapTreeConfig[],
	coords: Coordinates,
	date: Date,
	timeIntervalMinutes: number
): number {
	const startOfDay = getStartOfDayUTC(date);
	const polarCondition = getPolarCondition(coords, date);

	if (polarCondition === 'polar-night') {
		return 0;
	}

	const samplesPerDay = Math.ceil((24 * 60) / timeIntervalMinutes);
	let blockedSamples = 0;

	for (let i = 0; i < samplesPerDay; i++) {
		const sampleTime = new Date(startOfDay.getTime() + i * timeIntervalMinutes * 60 * 1000);
		const sunPosition = getSunPosition(coords, sampleTime);

		// Skip samples when sun is below horizon
		if (sunPosition.altitude <= 0) {
			continue;
		}

		// Calculate tree shadows
		const treeShadows: LatLngShadowPolygon[] = [];
		for (const tree of trees) {
			const shadow = calculateTreeShadowLatLng(tree, sunPosition);
			if (shadow) {
				treeShadows.push(shadow);
			}
		}

		const treeShadeIntensity = getTreeShadeAtPoint(point, treeShadows);
		if (treeShadeIntensity > 0.5) {
			blockedSamples++;
		}
	}

	return (blockedSamples * timeIntervalMinutes) / 60;
}
