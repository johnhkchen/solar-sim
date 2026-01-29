/**
 * Shade calculation type definitions and presets.
 *
 * This module defines TypeScript interfaces for modeling obstacles that cast
 * shadows, along with presets for common obstacles and transparency values.
 * The shade calculation system uses these types to determine effective sun
 * hours after accounting for shade from buildings, trees, fences, and hedges.
 */

/**
 * Obstacle type affects default transparency and seasonal behavior.
 * Buildings and fences are fully opaque year-round, while trees and hedges
 * allow varying amounts of light through their foliage.
 */
export type ObstacleType =
	| 'building'
	| 'fence'
	| 'evergreen-tree'
	| 'deciduous-tree'
	| 'hedge';

/**
 * Full obstacle definition representing a shadow-casting object.
 * Direction is measured clockwise from north, so 90 degrees is east.
 * Distance, height, and width are all in meters.
 */
export interface Obstacle {
	id: string;
	type: ObstacleType;
	label: string;
	direction: number; // degrees from north, 0-360
	distance: number; // meters from observation point
	height: number; // meters
	width: number; // meters
}

/**
 * User-friendly preset for common obstacles.
 * These presets provide sensible defaults so users don't need precise
 * measurements for typical suburban scenarios.
 */
export interface ObstaclePreset {
	label: string;
	type: ObstacleType;
	height: number; // meters
	width: number; // meters
}

/**
 * Common obstacle presets covering typical suburban scenarios.
 * Heights are provided in meters with approximate feet equivalents in labels.
 */
export const OBSTACLE_PRESETS: ObstaclePreset[] = [
	{ label: '6ft fence', type: 'fence', height: 1.8, width: 10 },
	{ label: '4ft fence', type: 'fence', height: 1.2, width: 10 },
	{ label: '1-story house', type: 'building', height: 4, width: 12 },
	{ label: '2-story house', type: 'building', height: 8, width: 12 },
	{ label: '3-story building', type: 'building', height: 12, width: 15 },
	{ label: 'Small tree (6m)', type: 'deciduous-tree', height: 6, width: 5 },
	{ label: 'Medium tree (12m)', type: 'deciduous-tree', height: 12, width: 8 },
	{ label: 'Large tree (20m)', type: 'deciduous-tree', height: 20, width: 12 },
	{ label: 'Tall tree (30m)', type: 'deciduous-tree', height: 30, width: 15 },
	{ label: 'Evergreen tree', type: 'evergreen-tree', height: 15, width: 6 },
	{ label: 'Tall hedge', type: 'hedge', height: 2.5, width: 8 }
];

/**
 * Returns the summer transparency value for an obstacle type.
 * A value of 0 means fully opaque (no light passes through), while higher
 * values indicate partial transparency. Trees allow some light through their
 * canopy, while buildings and fences block all direct sunlight.
 *
 * For MVP, we use summer transparency only without seasonal variation.
 * A future enhancement could adjust deciduous tree transparency for winter.
 */
export function getTransparency(type: ObstacleType): number {
	switch (type) {
		case 'building':
		case 'fence':
			return 0;
		case 'evergreen-tree':
			return 0.4;
		case 'deciduous-tree':
			return 0.4;
		case 'hedge':
			return 0.3;
		default:
			return 0;
	}
}

/**
 * Result of checking whether an obstacle blocks the sun at a given moment.
 * The shadeIntensity ranges from 0 (full sun) to 1 (full shade), accounting
 * for obstacle transparency.
 */
export interface BlockingResult {
	blocked: boolean;
	shadeIntensity: number; // 0 = full sun, 1 = full shade
}

/**
 * Time period when an obstacle blocks the sun.
 * Used for visualization to show users exactly when and why shade occurs.
 */
export interface ShadeWindow {
	obstacleId: string;
	startTime: Date;
	endTime: Date;
	shadeIntensity: number; // 0-1
}

/**
 * Analysis results for a single day at a specific location.
 * Compares theoretical sun hours (ignoring obstacles) with effective hours
 * after accounting for shade.
 */
export interface DailyShadeAnalysis {
	date: Date;
	theoreticalSunHours: number;
	effectiveSunHours: number;
	percentBlocked: number;
	shadeWindows: ShadeWindow[];
}

/**
 * Aggregated shade analysis for a date range.
 * Provides both summary statistics and per-day breakdown for detailed
 * visualization of shade patterns across the growing season.
 */
export interface ShadeAnalysis {
	obstacles: Obstacle[];
	startDate: Date;
	endDate: Date;
	averageTheoreticalHours: number;
	averageEffectiveHours: number;
	averagePercentBlocked: number;
	dailyAnalysis: DailyShadeAnalysis[];
	dominantBlocker: string | null; // obstacle id that causes most blocking
}
