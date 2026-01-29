/**
 * Shadow intersection math for calculating when obstacles block the sun.
 *
 * This module provides the core geometric calculations for determining whether
 * an obstacle blocks direct sunlight at a specific moment. The math compares
 * the sun's position (altitude and azimuth) against each obstacle's angular
 * size as seen from the observation point.
 *
 * An obstacle blocks the sun when two conditions are met: the sun's altitude
 * is below the obstacle's angular height, and the sun's azimuth falls within
 * the obstacle's angular span.
 */

import type { SolarPosition } from './types.js';
import type { Obstacle, BlockingResult } from './shade-types.js';
import { getTransparency } from './shade-types.js';

/**
 * Normalizes an angle to the range [0, 360).
 * Handles both positive and negative angles, wrapping them into the standard
 * compass bearing range where 0 is north.
 */
export function normalizeAngle(angle: number): number {
	let normalized = angle % 360;
	if (normalized < 0) normalized += 360;
	// Ensure we return +0 not -0 (JavaScript distinguishes these)
	return normalized === 0 ? 0 : normalized;
}

/**
 * Calculates the shortest angular difference between two bearings.
 * Returns a value between 0 and 180, representing the minimum angular
 * distance regardless of direction. This handles the wraparound case
 * at 360/0 degrees correctly.
 */
export function angularDifference(a: number, b: number): number {
	const diff = Math.abs(normalizeAngle(a) - normalizeAngle(b));
	return diff > 180 ? 360 - diff : diff;
}

/**
 * Tests whether a single obstacle blocks the sun at a given position.
 *
 * The function performs three checks in order:
 * 1. If the sun is below the horizon, it's not relevant (returns not blocked)
 * 2. If the sun is higher than the obstacle's angular height, no blocking
 * 3. If the sun's azimuth is outside the obstacle's angular span, no blocking
 *
 * When blocking occurs, the shade intensity depends on the obstacle's
 * transparency. A fully opaque building produces intensity 1.0, while
 * a tree canopy might produce 0.6 (40% of light passes through).
 */
export function isBlocked(sun: SolarPosition, obstacle: Obstacle): BlockingResult {
	// Sun below horizon means no direct sunlight to block
	if (sun.altitude <= 0) {
		return { blocked: false, shadeIntensity: 0 };
	}

	// Calculate the obstacle's angular height as seen from the observation point.
	// This is the angle you'd have to look up from horizontal to see the top
	// of the obstacle. atan(height / distance) gives radians, then convert to degrees.
	const obstacleAngularHeight =
		Math.atan(obstacle.height / obstacle.distance) * (180 / Math.PI);

	// If the sun is higher than the obstacle appears, the obstacle cannot block it
	if (sun.altitude > obstacleAngularHeight) {
		return { blocked: false, shadeIntensity: 0 };
	}

	// Calculate the obstacle's angular half-width. For a building of width w
	// at distance d, the total angular span is 2 * atan((w/2) / d).
	const halfAngularWidth =
		Math.atan(obstacle.width / 2 / obstacle.distance) * (180 / Math.PI);

	// Check if the sun's azimuth falls within the obstacle's span.
	// The obstacle spans from (direction - halfWidth) to (direction + halfWidth).
	const azimuthDiff = angularDifference(sun.azimuth, obstacle.direction);

	if (azimuthDiff <= halfAngularWidth) {
		// Sun is behind the obstacle, so it's blocked
		const transparency = getTransparency(obstacle.type);
		const shadeIntensity = 1 - transparency;
		return { blocked: shadeIntensity > 0, shadeIntensity };
	}

	// Sun is outside the obstacle's angular span
	return { blocked: false, shadeIntensity: 0 };
}

/**
 * Calculates how much sunlight reaches the observation point after accounting
 * for all obstacles.
 *
 * Returns a value from 0 to 1 where 1 means full sun (no blocking) and 0 means
 * completely blocked. When multiple obstacles would block the sun simultaneously,
 * we use the maximum shade intensity since you can't be more than fully shaded.
 *
 * When the sun is below the horizon, returns 0 since there's no direct sunlight.
 */
export function calculateEffectiveSunlight(
	sun: SolarPosition,
	obstacles: Obstacle[]
): number {
	// No sunlight when sun is below horizon
	if (sun.altitude <= 0) return 0;

	// Find the maximum shade from any blocking obstacle
	let maxShade = 0;
	for (const obstacle of obstacles) {
		const result = isBlocked(sun, obstacle);
		if (result.shadeIntensity > maxShade) {
			maxShade = result.shadeIntensity;
		}
	}

	// Return the sunlight fraction that gets through
	return 1 - maxShade;
}
