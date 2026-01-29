/**
 * Light category classification module for sun hour data.
 *
 * This module translates sun hours into horticultural light categories that
 * gardeners use to select appropriate plants. The key insight is that when
 * obstacles block sunlight, the effective hours (not theoretical maximum)
 * determine which plants will thrive.
 *
 * A spot receiving 8 theoretical hours but only 5 effective hours due to
 * shade should be classified as "part sun" rather than "full sun" since
 * that's what plants actually experience.
 */

/**
 * Light category identifiers matching standard horticultural terminology.
 */
export type LightCategory = 'full-sun' | 'part-sun' | 'part-shade' | 'full-shade';

/**
 * Detailed information about a light category including gardening guidance.
 */
export interface CategoryInfo {
	category: LightCategory;
	label: string;
	description: string;
	sunHoursRange: string;
}

/**
 * Input for shade-aware categorization. When effectiveHours is provided,
 * it takes precedence over theoreticalHours for category determination
 * since effective hours represent what plants actually receive.
 */
export interface SunHoursForCategory {
	theoreticalHours: number;
	effectiveHours?: number;
}

/**
 * Category definitions with gardening recommendations.
 */
export const CATEGORIES: Record<LightCategory, CategoryInfo> = {
	'full-sun': {
		category: 'full-sun',
		label: 'Full Sun',
		description: 'Best for tomatoes, peppers, and most vegetables',
		sunHoursRange: '6+ hours'
	},
	'part-sun': {
		category: 'part-sun',
		label: 'Part Sun',
		description: 'Good for lettuce, herbs, and some flowers',
		sunHoursRange: '4-6 hours'
	},
	'part-shade': {
		category: 'part-shade',
		label: 'Part Shade',
		description: 'Suitable for shade-tolerant vegetables and ferns',
		sunHoursRange: '2-4 hours'
	},
	'full-shade': {
		category: 'full-shade',
		label: 'Full Shade',
		description: 'Best for hostas, mosses, and woodland plants',
		sunHoursRange: '<2 hours'
	}
};

/**
 * Classifies sun hours into a light category based on standard thresholds.
 * Uses: full-sun (6+), part-sun (4-6), part-shade (2-4), full-shade (<2).
 */
export function classifySunHours(sunHours: number): LightCategory {
	if (sunHours >= 6) return 'full-sun';
	if (sunHours >= 4) return 'part-sun';
	if (sunHours >= 2) return 'part-shade';
	return 'full-shade';
}

/**
 * Gets detailed category information for a given sun hour value.
 * For simple cases where shade isn't being tracked.
 */
export function getCategoryInfo(sunHours: number): CategoryInfo {
	const category = classifySunHours(sunHours);
	return CATEGORIES[category];
}

/**
 * Gets category information using effective hours when available.
 *
 * This is the shade-aware version that should be used when obstacle data
 * exists. It classifies based on effective hours (what plants receive after
 * accounting for shade) rather than theoretical maximum. A garden spot with
 * 8 theoretical hours but 5 effective hours is classified as part-sun since
 * that's what actually reaches the plants.
 */
export function getEffectiveCategoryInfo(input: SunHoursForCategory): CategoryInfo {
	const hoursForClassification =
		input.effectiveHours !== undefined ? input.effectiveHours : input.theoreticalHours;
	return getCategoryInfo(hoursForClassification);
}

/**
 * Determines if shade has caused a category downgrade.
 *
 * Returns true when the effective category is lower than what the theoretical
 * hours would suggest. This is important for user messaging since it indicates
 * their planting options are more limited than the raw location would suggest.
 */
export function hasShadeDowngrade(input: SunHoursForCategory): boolean {
	if (input.effectiveHours === undefined) return false;

	const theoreticalCategory = classifySunHours(input.theoreticalHours);
	const effectiveCategory = classifySunHours(input.effectiveHours);

	const categoryOrder: LightCategory[] = ['full-sun', 'part-sun', 'part-shade', 'full-shade'];
	const theoreticalIndex = categoryOrder.indexOf(theoreticalCategory);
	const effectiveIndex = categoryOrder.indexOf(effectiveCategory);

	return effectiveIndex > theoreticalIndex;
}

/**
 * Gets both theoretical and effective categories for comparison display.
 *
 * Returns an object with both category infos plus a flag indicating whether
 * shade caused a downgrade. Useful for UI that wants to show "was full sun,
 * now part sun due to shade" messaging.
 */
export function getComparativeCategoryInfo(input: SunHoursForCategory): {
	theoretical: CategoryInfo;
	effective: CategoryInfo;
	hasDowngrade: boolean;
} {
	const theoretical = getCategoryInfo(input.theoreticalHours);
	const effective = getEffectiveCategoryInfo(input);
	const hasDowngrade = hasShadeDowngrade(input);

	return { theoretical, effective, hasDowngrade };
}
