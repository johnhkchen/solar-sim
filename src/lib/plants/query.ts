/**
 * Plant query API for zone-aware plant selection.
 *
 * This module provides a queryable interface to the plant database, supporting
 * filtering by light category, plant attributes (native, edible, etc.), and
 * text search. The query interface powers the plant selection UI in the garden
 * planner.
 */

import type { Plant, PlantCategory } from './types.js';
import { PLANTS } from './database.js';
import type { LightCategory } from '$lib/solar/categories.js';

/**
 * Filter options for plant queries. When multiple filters are active, they
 * combine with AND logic: a plant must match ALL active filters to be included.
 */
export interface PlantFilters {
	/** Only include plants native to North America */
	native?: boolean;
	/** Only include edible plants (vegetables and herbs) */
	edible?: boolean;
	/** Only include drought-tolerant plants */
	lowWater?: boolean;
	/** Only include deer-resistant plants */
	deerResistant?: boolean;
	/** Only include evergreen plants */
	evergreen?: boolean;
	/** Filter by plant category */
	category?: PlantCategory;
}

/**
 * Complete query parameters for plant search.
 */
export interface PlantQuery {
	/** Light category to match (full-sun, part-sun, part-shade, full-shade) */
	lightCategory: LightCategory;
	/** Optional attribute filters */
	filters?: PlantFilters;
	/** Optional search term to match against plant names */
	searchTerm?: string;
}

/**
 * Extended plant data with additional attributes for filtering and display.
 * This extends the base Plant type with flags that aren't in the core database
 * but are useful for the plant selection UI.
 */
export interface PlantWithAttributes extends Plant {
	/** True if native to North America */
	isNative: boolean;
	/** True if edible (vegetables and herbs) */
	isEdible: boolean;
	/** True if drought-tolerant / low water needs */
	isLowWater: boolean;
	/** True if deer tend to avoid this plant */
	isDeerResistant: boolean;
	/** True if plant retains foliage year-round */
	isEvergreen: boolean;
}

/**
 * Mapping of plant IDs to their extended attributes. This data would ideally
 * come from a more complete database, but for now we maintain it separately.
 * Plants not listed default to false for all attributes.
 */
const PLANT_ATTRIBUTES: Record<string, Partial<Omit<PlantWithAttributes, keyof Plant>>> = {
	// Native perennials
	hosta: { isNative: false, isEdible: false, isLowWater: false, isDeerResistant: false, isEvergreen: false },

	// Mediterranean herbs (drought-tolerant, deer-resistant)
	rosemary: { isNative: false, isEdible: true, isLowWater: true, isDeerResistant: true, isEvergreen: true },
	thyme: { isNative: false, isEdible: true, isLowWater: true, isDeerResistant: true, isEvergreen: false },
	oregano: { isNative: false, isEdible: true, isLowWater: true, isDeerResistant: true, isEvergreen: false },

	// Other herbs
	basil: { isNative: false, isEdible: true, isLowWater: false, isDeerResistant: false, isEvergreen: false },
	parsley: { isNative: false, isEdible: true, isLowWater: false, isDeerResistant: false, isEvergreen: false },
	cilantro: { isNative: false, isEdible: true, isLowWater: false, isDeerResistant: false, isEvergreen: false },
	mint: { isNative: false, isEdible: true, isLowWater: false, isDeerResistant: true, isEvergreen: false },
	chives: { isNative: false, isEdible: true, isLowWater: false, isDeerResistant: true, isEvergreen: false },

	// Vegetables
	tomato: { isNative: false, isEdible: true, isLowWater: false, isDeerResistant: false, isEvergreen: false },
	'pepper-bell': { isNative: false, isEdible: true, isLowWater: false, isDeerResistant: false, isEvergreen: false },
	cucumber: { isNative: false, isEdible: true, isLowWater: false, isDeerResistant: false, isEvergreen: false },
	zucchini: { isNative: false, isEdible: true, isLowWater: false, isDeerResistant: false, isEvergreen: false },
	eggplant: { isNative: false, isEdible: true, isLowWater: false, isDeerResistant: false, isEvergreen: false },
	'beans-bush': { isNative: false, isEdible: true, isLowWater: false, isDeerResistant: false, isEvergreen: false },
	lettuce: { isNative: false, isEdible: true, isLowWater: false, isDeerResistant: false, isEvergreen: false },
	spinach: { isNative: false, isEdible: true, isLowWater: false, isDeerResistant: false, isEvergreen: false },
	kale: { isNative: false, isEdible: true, isLowWater: false, isDeerResistant: false, isEvergreen: false },
	broccoli: { isNative: false, isEdible: true, isLowWater: false, isDeerResistant: false, isEvergreen: false },
	carrots: { isNative: false, isEdible: true, isLowWater: false, isDeerResistant: false, isEvergreen: false },
	peas: { isNative: false, isEdible: true, isLowWater: false, isDeerResistant: false, isEvergreen: false },
	radishes: { isNative: false, isEdible: true, isLowWater: false, isDeerResistant: false, isEvergreen: false },
	'swiss-chard': { isNative: false, isEdible: true, isLowWater: false, isDeerResistant: false, isEvergreen: false },
	beets: { isNative: false, isEdible: true, isLowWater: false, isDeerResistant: false, isEvergreen: false },
	cabbage: { isNative: false, isEdible: true, isLowWater: false, isDeerResistant: false, isEvergreen: false },
	onions: { isNative: false, isEdible: true, isLowWater: false, isDeerResistant: true, isEvergreen: false },

	// Flowers
	marigold: { isNative: false, isEdible: false, isLowWater: true, isDeerResistant: true, isEvergreen: false },
	zinnia: { isNative: false, isEdible: false, isLowWater: true, isDeerResistant: true, isEvergreen: false },
	impatiens: { isNative: false, isEdible: false, isLowWater: false, isDeerResistant: false, isEvergreen: false },
	pansy: { isNative: false, isEdible: true, isLowWater: false, isDeerResistant: false, isEvergreen: false },
	sunflower: { isNative: true, isEdible: true, isLowWater: true, isDeerResistant: false, isEvergreen: false },
	petunia: { isNative: false, isEdible: false, isLowWater: false, isDeerResistant: false, isEvergreen: false }
};

/**
 * Light category thresholds in sun hours per day. These match the thresholds
 * used in ZoneEditor for consistency.
 */
const LIGHT_THRESHOLDS = {
	FULL_SUN: 6,
	PART_SUN: 4,
	PART_SHADE: 2
};

/**
 * Checks if a plant's light requirements match the given light category.
 * Returns true if the plant can grow in the specified light conditions.
 */
function matchesLightCategory(plant: Plant, category: LightCategory): boolean {
	const minHours = plant.light.minSunHours;
	const maxHours = plant.light.maxSunHours;

	switch (category) {
		case 'full-sun':
			// Full sun: 6+ hours. Plant needs at least some full sun tolerance.
			return minHours <= LIGHT_THRESHOLDS.FULL_SUN;

		case 'part-sun':
			// Part sun: 4-6 hours. Plant should work with moderate light.
			return minHours <= LIGHT_THRESHOLDS.PART_SUN &&
				(maxHours === undefined || maxHours >= LIGHT_THRESHOLDS.PART_SUN);

		case 'part-shade':
			// Part shade: 2-4 hours. Plant needs shade tolerance.
			return minHours <= LIGHT_THRESHOLDS.PART_SHADE &&
				(maxHours === undefined || maxHours >= LIGHT_THRESHOLDS.PART_SHADE);

		case 'full-shade':
			// Full shade: <2 hours. Plant must tolerate very low light.
			return minHours <= 2;

		default:
			return false;
	}
}

/**
 * Enriches a base Plant with extended attributes for filtering.
 */
function enrichPlant(plant: Plant): PlantWithAttributes {
	const attrs = PLANT_ATTRIBUTES[plant.id] ?? {};
	return {
		...plant,
		isNative: attrs.isNative ?? false,
		isEdible: plant.category === 'vegetable' || plant.category === 'herb' || (attrs.isEdible ?? false),
		isLowWater: attrs.isLowWater ?? false,
		isDeerResistant: attrs.isDeerResistant ?? false,
		isEvergreen: attrs.isEvergreen ?? false
	};
}

/**
 * Checks if a plant matches all active filters.
 */
function matchesFilters(plant: PlantWithAttributes, filters: PlantFilters): boolean {
	if (filters.native && !plant.isNative) return false;
	if (filters.edible && !plant.isEdible) return false;
	if (filters.lowWater && !plant.isLowWater) return false;
	if (filters.deerResistant && !plant.isDeerResistant) return false;
	if (filters.evergreen && !plant.isEvergreen) return false;
	if (filters.category && plant.category !== filters.category) return false;
	return true;
}

/**
 * Checks if a plant matches the search term (case-insensitive).
 */
function matchesSearch(plant: Plant, searchTerm: string): boolean {
	const term = searchTerm.toLowerCase();
	return plant.name.toLowerCase().includes(term) ||
		plant.id.toLowerCase().includes(term) ||
		plant.description.toLowerCase().includes(term);
}

/**
 * Queries the plant database with the given parameters.
 * Returns plants that match all criteria, sorted by relevance.
 */
export function queryPlants(query: PlantQuery): PlantWithAttributes[] {
	const { lightCategory, filters = {}, searchTerm } = query;

	// Enrich all plants with extended attributes
	const enrichedPlants = PLANTS.map(enrichPlant);

	// Filter by criteria
	const results = enrichedPlants.filter(plant => {
		// Must match light category
		if (!matchesLightCategory(plant, lightCategory)) return false;

		// Must match all active filters
		if (!matchesFilters(plant, filters)) return false;

		// Must match search term if provided
		if (searchTerm && !matchesSearch(plant, searchTerm)) return false;

		return true;
	});

	// Sort by how well they match the light category (ideal hours closest to typical)
	const typicalHours = getLightCategoryTypicalHours(lightCategory);
	results.sort((a, b) => {
		const aIdeal = a.light.idealMinHours ?? a.light.minSunHours;
		const bIdeal = b.light.idealMinHours ?? b.light.minSunHours;
		const aDiff = Math.abs(aIdeal - typicalHours);
		const bDiff = Math.abs(bIdeal - typicalHours);
		return aDiff - bDiff;
	});

	return results;
}

/**
 * Gets all plants that can grow in the given light category, ignoring filters.
 * Useful for showing plants that don't match current filters but could work.
 */
export function getPlantsForLightCategory(lightCategory: LightCategory): PlantWithAttributes[] {
	return PLANTS
		.filter(plant => matchesLightCategory(plant, lightCategory))
		.map(enrichPlant);
}

/**
 * Gets all plants that match a search term, regardless of light category.
 * Includes a flag indicating whether each plant is recommended for the zone.
 */
export function searchPlantsForZone(
	searchTerm: string,
	zoneLightCategory: LightCategory
): Array<PlantWithAttributes & { isRecommendedForZone: boolean }> {
	if (!searchTerm.trim()) return [];

	return PLANTS
		.filter(plant => matchesSearch(plant, searchTerm))
		.map(plant => ({
			...enrichPlant(plant),
			isRecommendedForZone: matchesLightCategory(plant, zoneLightCategory)
		}))
		.sort((a, b) => {
			// Recommended plants first
			if (a.isRecommendedForZone !== b.isRecommendedForZone) {
				return a.isRecommendedForZone ? -1 : 1;
			}
			return a.name.localeCompare(b.name);
		});
}

/**
 * Returns typical sun hours for a light category.
 */
function getLightCategoryTypicalHours(category: LightCategory): number {
	switch (category) {
		case 'full-sun': return 8;
		case 'part-sun': return 5;
		case 'part-shade': return 3;
		case 'full-shade': return 1.5;
		default: return 6;
	}
}

/**
 * Gets a display label for a light category.
 */
export function formatLightCategoryLabel(category: LightCategory): string {
	switch (category) {
		case 'full-sun': return 'Full Sun';
		case 'part-sun': return 'Part Sun';
		case 'part-shade': return 'Part Shade';
		case 'full-shade': return 'Full Shade';
		default: return category;
	}
}

/**
 * Available filter options for the plant selection UI.
 */
export const FILTER_OPTIONS: Array<{
	key: keyof PlantFilters;
	label: string;
	description: string;
}> = [
	{ key: 'edible', label: 'Edible', description: 'Vegetables, herbs, and edible flowers' },
	{ key: 'lowWater', label: 'Low Water', description: 'Drought-tolerant plants' },
	{ key: 'deerResistant', label: 'Deer Resistant', description: 'Plants deer tend to avoid' },
	{ key: 'native', label: 'Native', description: 'Native to North America' },
	{ key: 'evergreen', label: 'Evergreen', description: 'Keeps foliage year-round' }
];
