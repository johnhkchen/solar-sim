// Light category classification module
// Translates sun hours into horticultural categories

export type LightCategory = 'full-sun' | 'part-sun' | 'part-shade' | 'full-shade';

export interface CategoryInfo {
	category: LightCategory;
	label: string;
	description: string;
	sunHoursRange: string;
}

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

// Classify sun hours into a light category
export function classifySunHours(sunHours: number): LightCategory {
	if (sunHours >= 6) return 'full-sun';
	if (sunHours >= 4) return 'part-sun';
	if (sunHours >= 2) return 'part-shade';
	return 'full-shade';
}

// Get detailed category information
export function getCategoryInfo(sunHours: number): CategoryInfo {
	const category = classifySunHours(sunHours);
	return CATEGORIES[category];
}
