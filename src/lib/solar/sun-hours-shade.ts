/**
 * Shade-aware sun hours integration module.
 *
 * This module extends the base sun hours calculation to account for obstacles
 * that block sunlight. It applies the calculateEffectiveSunlight() multiplier
 * at each sample point to reduce credited sun hours when obstacles cast shadows.
 *
 * The 5-minute sampling interval from the base module is retained since the
 * research confirmed it provides accurate results for shade calculation too.
 */

import { getSunPosition, getSunTimes, getPolarCondition } from './position.js';
import { calculateEffectiveSunlight, isBlocked } from './shade.js';
import type { Coordinates, DailySunData, SunTimes, PolarCondition } from './types.js';
import type {
	Obstacle,
	DailyShadeAnalysis,
	ShadeAnalysis,
	ShadeWindow
} from './shade-types.js';
import { SAMPLING_INTERVAL_MINUTES, SAMPLES_PER_DAY } from './types.js';

/**
 * Extended daily sun data that includes shade-adjusted values.
 * The base sunHours field contains theoretical maximum, while effectiveHours
 * reflects actual sunlight after accounting for obstacles.
 */
export interface DailySunDataWithShade extends DailySunData {
	effectiveHours: number;
	percentBlocked: number;
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
 * Calculates sun hours for a day, accounting for obstacles that block sunlight.
 *
 * This function extends the base getDailySunHours by applying shade calculations
 * at each sample point. The returned sunHours field contains the theoretical
 * maximum (as if no obstacles existed), while effectiveHours contains the
 * actual sunlight accounting for shade.
 *
 * For polar conditions, the function handles edge cases: midnight sun returns
 * 24 theoretical hours with shade applied throughout, while polar night returns
 * 0 hours regardless of obstacles since there's no sun to block.
 */
export function getDailySunHoursWithShade(
	coords: Coordinates,
	date: Date,
	obstacles: Obstacle[]
): DailySunDataWithShade {
	const sunTimes = getSunTimes(coords, date);
	const polarCondition = getPolarCondition(coords, date);
	const startOfDay = getStartOfDayUTC(date);

	// Polar night means no sun, so no shade impact possible
	if (polarCondition === 'polar-night') {
		return {
			date: startOfDay,
			sunHours: 0,
			effectiveHours: 0,
			percentBlocked: 0,
			sunTimes,
			polarCondition
		};
	}

	// For midnight sun and normal conditions, sample throughout the day
	let positiveAltitudeCount = 0;
	let effectiveSunlightSum = 0;

	for (let i = 0; i < SAMPLES_PER_DAY; i++) {
		const sampleTime = new Date(
			startOfDay.getTime() + i * SAMPLING_INTERVAL_MINUTES * 60 * 1000
		);
		const position = getSunPosition(coords, sampleTime);

		if (position.altitude > 0) {
			positiveAltitudeCount++;
			const effectiveSunlight = calculateEffectiveSunlight(position, obstacles);
			effectiveSunlightSum += effectiveSunlight;
		}
	}

	// Convert counts to hours
	const sunHours = (positiveAltitudeCount * SAMPLING_INTERVAL_MINUTES) / 60;
	const effectiveHours = (effectiveSunlightSum * SAMPLING_INTERVAL_MINUTES) / 60;

	// Calculate percent blocked, avoiding division by zero
	const percentBlocked =
		sunHours > 0 ? ((sunHours - effectiveHours) / sunHours) * 100 : 0;

	return {
		date: startOfDay,
		sunHours,
		effectiveHours,
		percentBlocked,
		sunTimes,
		polarCondition
	};
}

/**
 * Tracks which obstacles are currently blocking the sun during shade window detection.
 */
interface BlockingState {
	obstacleId: string;
	startTime: Date;
	shadeIntensity: number;
}

/**
 * Performs detailed shade analysis for a single day, including shade windows.
 *
 * Beyond just calculating effective hours, this function tracks exactly when
 * each obstacle blocks the sun, producing a timeline of shade events. This
 * enables visualizations showing users "the oak tree blocks sun from 2pm to 5pm."
 *
 * Shade windows are detected by comparing consecutive samples. When an obstacle
 * transitions from not-blocking to blocking, a window opens. When it transitions
 * back to not-blocking, the window closes.
 */
export function calculateDailyShadeAnalysis(
	coords: Coordinates,
	date: Date,
	obstacles: Obstacle[]
): DailyShadeAnalysis {
	const sunTimes = getSunTimes(coords, date);
	const polarCondition = getPolarCondition(coords, date);
	const startOfDay = getStartOfDayUTC(date);

	// Polar night: no sun, no shade
	if (polarCondition === 'polar-night') {
		return {
			date: startOfDay,
			theoreticalSunHours: 0,
			effectiveSunHours: 0,
			percentBlocked: 0,
			shadeWindows: []
		};
	}

	let positiveAltitudeCount = 0;
	let effectiveSunlightSum = 0;
	const shadeWindows: ShadeWindow[] = [];

	// Track which obstacles are currently blocking (for shade window detection)
	const currentlyBlocking = new Map<string, BlockingState>();

	for (let i = 0; i < SAMPLES_PER_DAY; i++) {
		const sampleTime = new Date(
			startOfDay.getTime() + i * SAMPLING_INTERVAL_MINUTES * 60 * 1000
		);
		const position = getSunPosition(coords, sampleTime);

		if (position.altitude > 0) {
			positiveAltitudeCount++;

			// Check each obstacle individually for shade window tracking
			for (const obstacle of obstacles) {
				const result = isBlocked(position, obstacle);
				const wasBlocking = currentlyBlocking.has(obstacle.id);

				if (result.blocked && !wasBlocking) {
					// Obstacle started blocking: open a shade window
					currentlyBlocking.set(obstacle.id, {
						obstacleId: obstacle.id,
						startTime: sampleTime,
						shadeIntensity: result.shadeIntensity
					});
				} else if (!result.blocked && wasBlocking) {
					// Obstacle stopped blocking: close the shade window
					const state = currentlyBlocking.get(obstacle.id)!;
					shadeWindows.push({
						obstacleId: state.obstacleId,
						startTime: state.startTime,
						endTime: sampleTime,
						shadeIntensity: state.shadeIntensity
					});
					currentlyBlocking.delete(obstacle.id);
				} else if (result.blocked && wasBlocking) {
					// Update shade intensity if it changed (unusual but possible at edges)
					const state = currentlyBlocking.get(obstacle.id)!;
					if (Math.abs(state.shadeIntensity - result.shadeIntensity) > 0.01) {
						// Close the current window and start a new one with the new intensity
						shadeWindows.push({
							obstacleId: state.obstacleId,
							startTime: state.startTime,
							endTime: sampleTime,
							shadeIntensity: state.shadeIntensity
						});
						currentlyBlocking.set(obstacle.id, {
							obstacleId: obstacle.id,
							startTime: sampleTime,
							shadeIntensity: result.shadeIntensity
						});
					}
				}
			}

			// Calculate effective sunlight accounting for all obstacles
			const effectiveSunlight = calculateEffectiveSunlight(position, obstacles);
			effectiveSunlightSum += effectiveSunlight;
		} else {
			// Sun below horizon: close any open shade windows
			for (const [obstacleId, state] of currentlyBlocking) {
				shadeWindows.push({
					obstacleId: state.obstacleId,
					startTime: state.startTime,
					endTime: sampleTime,
					shadeIntensity: state.shadeIntensity
				});
			}
			currentlyBlocking.clear();
		}
	}

	// Close any shade windows that remained open at end of day
	const endOfDay = new Date(startOfDay.getTime() + 24 * 60 * 60 * 1000);
	for (const [, state] of currentlyBlocking) {
		shadeWindows.push({
			obstacleId: state.obstacleId,
			startTime: state.startTime,
			endTime: endOfDay,
			shadeIntensity: state.shadeIntensity
		});
	}

	// Convert to hours
	const theoreticalSunHours = (positiveAltitudeCount * SAMPLING_INTERVAL_MINUTES) / 60;
	const effectiveSunHours = (effectiveSunlightSum * SAMPLING_INTERVAL_MINUTES) / 60;
	const percentBlocked =
		theoreticalSunHours > 0
			? ((theoreticalSunHours - effectiveSunHours) / theoreticalSunHours) * 100
			: 0;

	return {
		date: startOfDay,
		theoreticalSunHours,
		effectiveSunHours,
		percentBlocked,
		shadeWindows
	};
}

/**
 * Aggregates shade analysis across a date range (typically a growing season).
 *
 * This function produces a ShadeAnalysis object containing both summary statistics
 * and per-day breakdowns. It identifies the dominant blocker (the obstacle that
 * causes the most total shade) to help users understand which obstacle has the
 * biggest impact on their garden.
 */
export function getSeasonalSummaryWithShade(
	coords: Coordinates,
	startDate: Date,
	endDate: Date,
	obstacles: Obstacle[]
): ShadeAnalysis {
	const dailyAnalysis: DailyShadeAnalysis[] = [];

	// Track total blocking time by obstacle to find dominant blocker
	const blockingTimeByObstacle = new Map<string, number>();

	// Iterate day by day from start to end (inclusive)
	const current = new Date(startDate);
	current.setUTCHours(0, 0, 0, 0);
	const end = new Date(endDate);
	end.setUTCHours(0, 0, 0, 0);

	while (current <= end) {
		const analysis = calculateDailyShadeAnalysis(coords, new Date(current), obstacles);
		dailyAnalysis.push(analysis);

		// Accumulate blocking time by obstacle
		for (const window of analysis.shadeWindows) {
			const duration = window.endTime.getTime() - window.startTime.getTime();
			const durationHours = duration / (1000 * 60 * 60);
			const weightedHours = durationHours * window.shadeIntensity;

			const currentTotal = blockingTimeByObstacle.get(window.obstacleId) || 0;
			blockingTimeByObstacle.set(window.obstacleId, currentTotal + weightedHours);
		}

		// Move to next day
		current.setUTCDate(current.getUTCDate() + 1);
	}

	// Calculate averages
	const count = dailyAnalysis.length;
	const averageTheoreticalHours =
		count > 0
			? dailyAnalysis.reduce((sum, d) => sum + d.theoreticalSunHours, 0) / count
			: 0;
	const averageEffectiveHours =
		count > 0
			? dailyAnalysis.reduce((sum, d) => sum + d.effectiveSunHours, 0) / count
			: 0;
	const averagePercentBlocked =
		averageTheoreticalHours > 0
			? ((averageTheoreticalHours - averageEffectiveHours) / averageTheoreticalHours) *
			  100
			: 0;

	// Find the dominant blocker
	let dominantBlocker: string | null = null;
	let maxBlockingTime = 0;
	for (const [obstacleId, blockingTime] of blockingTimeByObstacle) {
		if (blockingTime > maxBlockingTime) {
			maxBlockingTime = blockingTime;
			dominantBlocker = obstacleId;
		}
	}

	return {
		obstacles,
		startDate: new Date(startDate),
		endDate: new Date(endDate),
		averageTheoreticalHours,
		averageEffectiveHours,
		averagePercentBlocked,
		dailyAnalysis,
		dominantBlocker
	};
}
