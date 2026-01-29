/**
 * Light category classification module.
 *
 * This module re-exports categorization functions from the solar library.
 * The implementation moved to $lib/solar/categories.ts to consolidate
 * solar-related logic, but this re-export maintains backward compatibility
 * for existing imports.
 */

export type { LightCategory, CategoryInfo, SunHoursForCategory } from '$lib/solar/categories.js';

export {
	CATEGORIES,
	classifySunHours,
	getCategoryInfo,
	getEffectiveCategoryInfo,
	hasShadeDowngrade,
	getComparativeCategoryInfo
} from '$lib/solar/categories.js';
