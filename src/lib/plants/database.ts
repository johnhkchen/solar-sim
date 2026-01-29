/**
 * Plant database for Solar-Sim recommendations.
 *
 * This module exports a curated array of common vegetables, herbs, and flowers
 * with their light requirements, temperature tolerance, and timing data. The
 * database is designed to be small and accurate rather than comprehensive,
 * covering the plants most gardeners care about while ensuring data quality.
 *
 * Data sources include university extension guides, seed catalogs, and established
 * gardening references to ensure accuracy for typical garden conditions.
 */

import type { Plant } from './types.js';

/**
 * Curated database of common garden plants with complete requirement data.
 * Plants span full-sun through part-shade categories and include both warm-season
 * and cool-season options for comprehensive coverage.
 */
export const PLANTS: Plant[] = [
	// ============================================================================
	// Vegetables - Warm Season (Tender)
	// ============================================================================
	{
		id: 'tomato',
		name: 'Tomato',
		category: 'vegetable',
		description:
			'The quintessential garden vegetable, tomatoes thrive in warm weather with full sun and produce fruit from midsummer through frost.',
		light: {
			minSunHours: 6,
			idealMinHours: 8,
			idealMaxHours: 10,
			toleratesAfternoonShade: false,
			benefitsFromAfternoonShade: false
		},
		temperature: {
			frostTolerance: 'tender',
			minGrowingTempF: 50,
			maxGrowingTempF: 95,
			optimalMinTempF: 65,
			optimalMaxTempF: 85
		},
		timing: {
			daysToMaturityMin: 60,
			daysToMaturityMax: 85,
			canStartIndoors: true,
			weeksToStartIndoors: 6,
			successionPlantingWeeks: undefined
		}
	},
	{
		id: 'pepper-bell',
		name: 'Bell Pepper',
		category: 'vegetable',
		description:
			'Sweet bell peppers need consistent warmth and full sun to develop their characteristic blocky shape and sweet flavor.',
		light: {
			minSunHours: 6,
			idealMinHours: 8,
			idealMaxHours: 10,
			toleratesAfternoonShade: false,
			benefitsFromAfternoonShade: false
		},
		temperature: {
			frostTolerance: 'tender',
			minGrowingTempF: 55,
			maxGrowingTempF: 95,
			optimalMinTempF: 70,
			optimalMaxTempF: 85
		},
		timing: {
			daysToMaturityMin: 60,
			daysToMaturityMax: 90,
			canStartIndoors: true,
			weeksToStartIndoors: 8
		}
	},
	{
		id: 'cucumber',
		name: 'Cucumber',
		category: 'vegetable',
		description:
			'Fast-growing vines that produce prolifically in warm weather, cucumbers need consistent moisture and full sun for best production.',
		light: {
			minSunHours: 6,
			idealMinHours: 8,
			idealMaxHours: 10,
			toleratesAfternoonShade: false,
			benefitsFromAfternoonShade: false
		},
		temperature: {
			frostTolerance: 'tender',
			minGrowingTempF: 60,
			maxGrowingTempF: 95,
			optimalMinTempF: 70,
			optimalMaxTempF: 85
		},
		timing: {
			daysToMaturityMin: 50,
			daysToMaturityMax: 70,
			canStartIndoors: true,
			weeksToStartIndoors: 3,
			successionPlantingWeeks: 3
		}
	},
	{
		id: 'zucchini',
		name: 'Zucchini',
		category: 'vegetable',
		description:
			'Prolific summer squash that produces abundantly with minimal care, zucchini plants need room to spread and full sun for best yields.',
		light: {
			minSunHours: 6,
			idealMinHours: 8,
			idealMaxHours: 10,
			toleratesAfternoonShade: false,
			benefitsFromAfternoonShade: false
		},
		temperature: {
			frostTolerance: 'tender',
			minGrowingTempF: 60,
			maxGrowingTempF: 100,
			optimalMinTempF: 70,
			optimalMaxTempF: 90
		},
		timing: {
			daysToMaturityMin: 45,
			daysToMaturityMax: 60,
			canStartIndoors: true,
			weeksToStartIndoors: 3
		}
	},
	{
		id: 'eggplant',
		name: 'Eggplant',
		category: 'vegetable',
		description:
			'Heat-loving plants that produce glossy purple fruit, eggplants need consistently warm conditions and patience since they mature slowly.',
		light: {
			minSunHours: 6,
			idealMinHours: 8,
			idealMaxHours: 10,
			toleratesAfternoonShade: false,
			benefitsFromAfternoonShade: false
		},
		temperature: {
			frostTolerance: 'tender',
			minGrowingTempF: 60,
			maxGrowingTempF: 95,
			optimalMinTempF: 70,
			optimalMaxTempF: 85
		},
		timing: {
			daysToMaturityMin: 70,
			daysToMaturityMax: 85,
			canStartIndoors: true,
			weeksToStartIndoors: 8
		}
	},
	{
		id: 'beans-bush',
		name: 'Bush Beans',
		category: 'vegetable',
		description:
			'Easy-to-grow legumes that fix nitrogen in the soil, bush beans produce quickly and work well for succession planting throughout summer.',
		light: {
			minSunHours: 6,
			idealMinHours: 6,
			idealMaxHours: 8,
			toleratesAfternoonShade: true,
			benefitsFromAfternoonShade: false
		},
		temperature: {
			frostTolerance: 'tender',
			minGrowingTempF: 60,
			maxGrowingTempF: 85,
			optimalMinTempF: 65,
			optimalMaxTempF: 80
		},
		timing: {
			daysToMaturityMin: 50,
			daysToMaturityMax: 60,
			canStartIndoors: false,
			successionPlantingWeeks: 2
		}
	},

	// ============================================================================
	// Vegetables - Cool Season (Hardy to Semi-Hardy)
	// ============================================================================
	{
		id: 'lettuce',
		name: 'Lettuce',
		category: 'vegetable',
		description:
			'Fast-growing salad green that actually prefers cooler conditions and some shade, lettuce bolts quickly in hot weather and full sun.',
		light: {
			minSunHours: 3,
			maxSunHours: 6,
			idealMinHours: 4,
			idealMaxHours: 5,
			toleratesAfternoonShade: true,
			benefitsFromAfternoonShade: true
		},
		temperature: {
			frostTolerance: 'semi-hardy',
			minGrowingTempF: 40,
			maxGrowingTempF: 75,
			optimalMinTempF: 55,
			optimalMaxTempF: 65
		},
		timing: {
			daysToMaturityMin: 30,
			daysToMaturityMax: 60,
			canStartIndoors: true,
			weeksToStartIndoors: 4,
			successionPlantingWeeks: 2
		}
	},
	{
		id: 'spinach',
		name: 'Spinach',
		category: 'vegetable',
		description:
			'Nutrient-dense green that thrives in cool weather and tolerates light frost, spinach bolts rapidly once temperatures rise in summer.',
		light: {
			minSunHours: 3,
			maxSunHours: 6,
			idealMinHours: 4,
			idealMaxHours: 5,
			toleratesAfternoonShade: true,
			benefitsFromAfternoonShade: true
		},
		temperature: {
			frostTolerance: 'hardy',
			minGrowingTempF: 35,
			maxGrowingTempF: 75,
			optimalMinTempF: 50,
			optimalMaxTempF: 60
		},
		timing: {
			daysToMaturityMin: 40,
			daysToMaturityMax: 50,
			canStartIndoors: true,
			weeksToStartIndoors: 4,
			successionPlantingWeeks: 2
		}
	},
	{
		id: 'kale',
		name: 'Kale',
		category: 'vegetable',
		description:
			'Hardy leafy green that sweetens after frost, kale tolerates a wide range of conditions and can be harvested leaf by leaf over a long season.',
		light: {
			minSunHours: 4,
			idealMinHours: 6,
			idealMaxHours: 8,
			toleratesAfternoonShade: true,
			benefitsFromAfternoonShade: false
		},
		temperature: {
			frostTolerance: 'hardy',
			minGrowingTempF: 20,
			maxGrowingTempF: 80,
			optimalMinTempF: 55,
			optimalMaxTempF: 75
		},
		timing: {
			daysToMaturityMin: 55,
			daysToMaturityMax: 75,
			canStartIndoors: true,
			weeksToStartIndoors: 4
		}
	},
	{
		id: 'broccoli',
		name: 'Broccoli',
		category: 'vegetable',
		description:
			'Cool-season brassica that forms a large central head followed by smaller side shoots, broccoli needs consistent moisture and cool temperatures.',
		light: {
			minSunHours: 4,
			idealMinHours: 6,
			idealMaxHours: 8,
			toleratesAfternoonShade: true,
			benefitsFromAfternoonShade: false
		},
		temperature: {
			frostTolerance: 'semi-hardy',
			minGrowingTempF: 40,
			maxGrowingTempF: 75,
			optimalMinTempF: 60,
			optimalMaxTempF: 70
		},
		timing: {
			daysToMaturityMin: 70,
			daysToMaturityMax: 100,
			canStartIndoors: true,
			weeksToStartIndoors: 6
		}
	},
	{
		id: 'carrots',
		name: 'Carrots',
		category: 'vegetable',
		description:
			'Root vegetables that develop best in loose, sandy soil, carrots need consistent moisture and patience as they mature underground.',
		light: {
			minSunHours: 4,
			idealMinHours: 6,
			idealMaxHours: 8,
			toleratesAfternoonShade: true,
			benefitsFromAfternoonShade: false
		},
		temperature: {
			frostTolerance: 'semi-hardy',
			minGrowingTempF: 40,
			maxGrowingTempF: 85,
			optimalMinTempF: 55,
			optimalMaxTempF: 75
		},
		timing: {
			daysToMaturityMin: 60,
			daysToMaturityMax: 80,
			canStartIndoors: false,
			successionPlantingWeeks: 3
		}
	},
	{
		id: 'peas',
		name: 'Peas',
		category: 'vegetable',
		description:
			'Cool-season legumes that climb trellises and produce sweet pods, peas must be planted early as they stop producing once temperatures rise.',
		light: {
			minSunHours: 4,
			idealMinHours: 6,
			idealMaxHours: 8,
			toleratesAfternoonShade: true,
			benefitsFromAfternoonShade: false
		},
		temperature: {
			frostTolerance: 'hardy',
			minGrowingTempF: 40,
			maxGrowingTempF: 75,
			optimalMinTempF: 55,
			optimalMaxTempF: 70
		},
		timing: {
			daysToMaturityMin: 60,
			daysToMaturityMax: 70,
			canStartIndoors: false,
			successionPlantingWeeks: 2
		}
	},
	{
		id: 'radishes',
		name: 'Radishes',
		category: 'vegetable',
		description:
			'The fastest vegetable from seed to harvest, radishes mature in under a month and can fill gaps between slower-growing crops.',
		light: {
			minSunHours: 3,
			maxSunHours: 6,
			idealMinHours: 4,
			idealMaxHours: 6,
			toleratesAfternoonShade: true,
			benefitsFromAfternoonShade: true
		},
		temperature: {
			frostTolerance: 'hardy',
			minGrowingTempF: 40,
			maxGrowingTempF: 75,
			optimalMinTempF: 50,
			optimalMaxTempF: 65
		},
		timing: {
			daysToMaturityMin: 22,
			daysToMaturityMax: 30,
			canStartIndoors: false,
			successionPlantingWeeks: 1
		}
	},
	{
		id: 'swiss-chard',
		name: 'Swiss Chard',
		category: 'vegetable',
		description:
			'Colorful leafy green that tolerates both heat and light frost, chard can be harvested continuously by cutting outer leaves.',
		light: {
			minSunHours: 3,
			idealMinHours: 5,
			idealMaxHours: 6,
			toleratesAfternoonShade: true,
			benefitsFromAfternoonShade: true
		},
		temperature: {
			frostTolerance: 'semi-hardy',
			minGrowingTempF: 40,
			maxGrowingTempF: 85,
			optimalMinTempF: 50,
			optimalMaxTempF: 75
		},
		timing: {
			daysToMaturityMin: 55,
			daysToMaturityMax: 65,
			canStartIndoors: true,
			weeksToStartIndoors: 4
		}
	},
	{
		id: 'beets',
		name: 'Beets',
		category: 'vegetable',
		description:
			'Dual-purpose vegetable where both the roots and greens are edible, beets tolerate light frost and store well after harvest.',
		light: {
			minSunHours: 4,
			idealMinHours: 5,
			idealMaxHours: 6,
			toleratesAfternoonShade: true,
			benefitsFromAfternoonShade: false
		},
		temperature: {
			frostTolerance: 'semi-hardy',
			minGrowingTempF: 40,
			maxGrowingTempF: 85,
			optimalMinTempF: 50,
			optimalMaxTempF: 70
		},
		timing: {
			daysToMaturityMin: 50,
			daysToMaturityMax: 70,
			canStartIndoors: false,
			successionPlantingWeeks: 3
		}
	},
	{
		id: 'cabbage',
		name: 'Cabbage',
		category: 'vegetable',
		description:
			'Classic cole crop that forms dense heads, cabbage is hardy and can be grown for spring or fall harvest in most climates.',
		light: {
			minSunHours: 4,
			idealMinHours: 6,
			idealMaxHours: 8,
			toleratesAfternoonShade: true,
			benefitsFromAfternoonShade: false
		},
		temperature: {
			frostTolerance: 'hardy',
			minGrowingTempF: 32,
			maxGrowingTempF: 75,
			optimalMinTempF: 55,
			optimalMaxTempF: 70
		},
		timing: {
			daysToMaturityMin: 70,
			daysToMaturityMax: 100,
			canStartIndoors: true,
			weeksToStartIndoors: 6
		}
	},
	{
		id: 'onions',
		name: 'Onions',
		category: 'vegetable',
		description:
			'Long-season crop that bulbs based on day length, onions need full sun and consistent moisture to develop large bulbs.',
		light: {
			minSunHours: 6,
			idealMinHours: 6,
			idealMaxHours: 8,
			toleratesAfternoonShade: false,
			benefitsFromAfternoonShade: false
		},
		temperature: {
			frostTolerance: 'hardy',
			minGrowingTempF: 35,
			maxGrowingTempF: 85,
			optimalMinTempF: 55,
			optimalMaxTempF: 75
		},
		timing: {
			daysToMaturityMin: 90,
			daysToMaturityMax: 120,
			canStartIndoors: true,
			weeksToStartIndoors: 10
		}
	},

	// ============================================================================
	// Herbs
	// ============================================================================
	{
		id: 'basil',
		name: 'Basil',
		category: 'herb',
		description:
			'Aromatic herb essential for Italian and Thai cuisine, basil thrives in heat and needs pinching to prevent flowering and extend harvest.',
		light: {
			minSunHours: 6,
			idealMinHours: 6,
			idealMaxHours: 8,
			toleratesAfternoonShade: false,
			benefitsFromAfternoonShade: false
		},
		temperature: {
			frostTolerance: 'tender',
			minGrowingTempF: 50,
			maxGrowingTempF: 95,
			optimalMinTempF: 70,
			optimalMaxTempF: 85
		},
		timing: {
			daysToMaturityMin: 60,
			daysToMaturityMax: 90,
			canStartIndoors: true,
			weeksToStartIndoors: 6
		}
	},
	{
		id: 'parsley',
		name: 'Parsley',
		category: 'herb',
		description:
			'Biennial herb that produces abundantly in its first year, parsley tolerates partial shade and cool temperatures better than most herbs.',
		light: {
			minSunHours: 3,
			idealMinHours: 4,
			idealMaxHours: 6,
			toleratesAfternoonShade: true,
			benefitsFromAfternoonShade: false
		},
		temperature: {
			frostTolerance: 'semi-hardy',
			minGrowingTempF: 40,
			maxGrowingTempF: 85,
			optimalMinTempF: 50,
			optimalMaxTempF: 75
		},
		timing: {
			daysToMaturityMin: 70,
			daysToMaturityMax: 90,
			canStartIndoors: true,
			weeksToStartIndoors: 8
		}
	},
	{
		id: 'cilantro',
		name: 'Cilantro',
		category: 'herb',
		description:
			'Cool-season herb that bolts rapidly in heat, cilantro benefits from afternoon shade and succession planting for continuous harvest.',
		light: {
			minSunHours: 3,
			maxSunHours: 6,
			idealMinHours: 4,
			idealMaxHours: 5,
			toleratesAfternoonShade: true,
			benefitsFromAfternoonShade: true
		},
		temperature: {
			frostTolerance: 'semi-hardy',
			minGrowingTempF: 40,
			maxGrowingTempF: 75,
			optimalMinTempF: 50,
			optimalMaxTempF: 70
		},
		timing: {
			daysToMaturityMin: 45,
			daysToMaturityMax: 70,
			canStartIndoors: false,
			successionPlantingWeeks: 2
		}
	},
	{
		id: 'mint',
		name: 'Mint',
		category: 'herb',
		description:
			'Vigorous spreading herb that tolerates shade and moist conditions, mint should be contained to prevent it from taking over the garden.',
		light: {
			minSunHours: 3,
			idealMinHours: 4,
			idealMaxHours: 6,
			toleratesAfternoonShade: true,
			benefitsFromAfternoonShade: true
		},
		temperature: {
			frostTolerance: 'hardy',
			minGrowingTempF: 30,
			maxGrowingTempF: 90,
			optimalMinTempF: 55,
			optimalMaxTempF: 75
		},
		timing: {
			daysToMaturityMin: 45,
			daysToMaturityMax: 60,
			canStartIndoors: true,
			weeksToStartIndoors: 8
		}
	},
	{
		id: 'rosemary',
		name: 'Rosemary',
		category: 'herb',
		description:
			'Woody Mediterranean herb that thrives in hot, dry conditions, rosemary needs excellent drainage and full sun to perform well.',
		light: {
			minSunHours: 6,
			idealMinHours: 6,
			idealMaxHours: 8,
			toleratesAfternoonShade: false,
			benefitsFromAfternoonShade: false
		},
		temperature: {
			frostTolerance: 'semi-hardy',
			minGrowingTempF: 30,
			maxGrowingTempF: 95,
			optimalMinTempF: 60,
			optimalMaxTempF: 80
		},
		timing: {
			daysToMaturityMin: 90,
			daysToMaturityMax: 180,
			canStartIndoors: true,
			weeksToStartIndoors: 10
		}
	},
	{
		id: 'thyme',
		name: 'Thyme',
		category: 'herb',
		description:
			'Low-growing perennial herb with tiny fragrant leaves, thyme tolerates drought and poor soil but needs good drainage and full sun.',
		light: {
			minSunHours: 6,
			idealMinHours: 6,
			idealMaxHours: 8,
			toleratesAfternoonShade: false,
			benefitsFromAfternoonShade: false
		},
		temperature: {
			frostTolerance: 'semi-hardy',
			minGrowingTempF: 30,
			maxGrowingTempF: 90,
			optimalMinTempF: 60,
			optimalMaxTempF: 75
		},
		timing: {
			daysToMaturityMin: 70,
			daysToMaturityMax: 90,
			canStartIndoors: true,
			weeksToStartIndoors: 8
		}
	},
	{
		id: 'oregano',
		name: 'Oregano',
		category: 'herb',
		description:
			'Hardy Mediterranean herb with robust flavor, oregano spreads readily and becomes more flavorful when grown in lean, sunny conditions.',
		light: {
			minSunHours: 6,
			idealMinHours: 6,
			idealMaxHours: 8,
			toleratesAfternoonShade: false,
			benefitsFromAfternoonShade: false
		},
		temperature: {
			frostTolerance: 'hardy',
			minGrowingTempF: 30,
			maxGrowingTempF: 95,
			optimalMinTempF: 60,
			optimalMaxTempF: 80
		},
		timing: {
			daysToMaturityMin: 45,
			daysToMaturityMax: 60,
			canStartIndoors: true,
			weeksToStartIndoors: 8
		}
	},
	{
		id: 'chives',
		name: 'Chives',
		category: 'herb',
		description:
			'Easy perennial herb with mild onion flavor, chives produce edible flowers and tolerate a range of conditions from part shade to full sun.',
		light: {
			minSunHours: 4,
			idealMinHours: 5,
			idealMaxHours: 6,
			toleratesAfternoonShade: true,
			benefitsFromAfternoonShade: false
		},
		temperature: {
			frostTolerance: 'hardy',
			minGrowingTempF: 35,
			maxGrowingTempF: 85,
			optimalMinTempF: 55,
			optimalMaxTempF: 75
		},
		timing: {
			daysToMaturityMin: 60,
			daysToMaturityMax: 90,
			canStartIndoors: true,
			weeksToStartIndoors: 8
		}
	},

	// ============================================================================
	// Flowers
	// ============================================================================
	{
		id: 'marigold',
		name: 'Marigold',
		category: 'flower',
		description:
			'Cheerful annual that deters pests and attracts pollinators, marigolds bloom continuously in full sun and tolerate heat and drought.',
		light: {
			minSunHours: 6,
			idealMinHours: 6,
			idealMaxHours: 8,
			toleratesAfternoonShade: false,
			benefitsFromAfternoonShade: false
		},
		temperature: {
			frostTolerance: 'tender',
			minGrowingTempF: 50,
			maxGrowingTempF: 100,
			optimalMinTempF: 70,
			optimalMaxTempF: 85
		},
		timing: {
			daysToMaturityMin: 50,
			daysToMaturityMax: 60,
			canStartIndoors: true,
			weeksToStartIndoors: 4
		}
	},
	{
		id: 'zinnia',
		name: 'Zinnia',
		category: 'flower',
		description:
			'Bold cut flowers that thrive in summer heat, zinnias come in every color and bloom more abundantly when regularly harvested.',
		light: {
			minSunHours: 6,
			idealMinHours: 8,
			idealMaxHours: 10,
			toleratesAfternoonShade: false,
			benefitsFromAfternoonShade: false
		},
		temperature: {
			frostTolerance: 'tender',
			minGrowingTempF: 60,
			maxGrowingTempF: 100,
			optimalMinTempF: 75,
			optimalMaxTempF: 90
		},
		timing: {
			daysToMaturityMin: 60,
			daysToMaturityMax: 70,
			canStartIndoors: true,
			weeksToStartIndoors: 4
		}
	},
	{
		id: 'impatiens',
		name: 'Impatiens',
		category: 'flower',
		description:
			'Shade-loving annual that provides continuous color in low-light areas, impatiens need consistent moisture and protection from hot afternoon sun.',
		light: {
			minSunHours: 2,
			maxSunHours: 4,
			idealMinHours: 2,
			idealMaxHours: 3,
			toleratesAfternoonShade: true,
			benefitsFromAfternoonShade: true
		},
		temperature: {
			frostTolerance: 'tender',
			minGrowingTempF: 45,
			maxGrowingTempF: 85,
			optimalMinTempF: 60,
			optimalMaxTempF: 75
		},
		timing: {
			daysToMaturityMin: 60,
			daysToMaturityMax: 75,
			canStartIndoors: true,
			weeksToStartIndoors: 10
		}
	},
	{
		id: 'pansy',
		name: 'Pansy',
		category: 'flower',
		description:
			'Cool-season flower with distinctive face-like markings, pansies thrive in spring and fall but fade in summer heat.',
		light: {
			minSunHours: 4,
			maxSunHours: 6,
			idealMinHours: 5,
			idealMaxHours: 6,
			toleratesAfternoonShade: true,
			benefitsFromAfternoonShade: true
		},
		temperature: {
			frostTolerance: 'hardy',
			minGrowingTempF: 25,
			maxGrowingTempF: 75,
			optimalMinTempF: 45,
			optimalMaxTempF: 65
		},
		timing: {
			daysToMaturityMin: 60,
			daysToMaturityMax: 70,
			canStartIndoors: true,
			weeksToStartIndoors: 8
		}
	},
	{
		id: 'sunflower',
		name: 'Sunflower',
		category: 'flower',
		description:
			'Iconic summer flower that tracks the sun, sunflowers are easy to grow from direct sowing and attract birds with their seed heads.',
		light: {
			minSunHours: 6,
			idealMinHours: 8,
			idealMaxHours: 10,
			toleratesAfternoonShade: false,
			benefitsFromAfternoonShade: false
		},
		temperature: {
			frostTolerance: 'tender',
			minGrowingTempF: 55,
			maxGrowingTempF: 100,
			optimalMinTempF: 70,
			optimalMaxTempF: 85
		},
		timing: {
			daysToMaturityMin: 70,
			daysToMaturityMax: 100,
			canStartIndoors: false,
			successionPlantingWeeks: 2
		}
	},
	{
		id: 'petunia',
		name: 'Petunia',
		category: 'flower',
		description:
			'Popular annual for containers and borders, petunias bloom prolifically in full sun and come in a wide range of colors and patterns.',
		light: {
			minSunHours: 5,
			idealMinHours: 6,
			idealMaxHours: 8,
			toleratesAfternoonShade: true,
			benefitsFromAfternoonShade: false
		},
		temperature: {
			frostTolerance: 'tender',
			minGrowingTempF: 45,
			maxGrowingTempF: 90,
			optimalMinTempF: 60,
			optimalMaxTempF: 80
		},
		timing: {
			daysToMaturityMin: 75,
			daysToMaturityMax: 90,
			canStartIndoors: true,
			weeksToStartIndoors: 10
		}
	},
	{
		id: 'hosta',
		name: 'Hosta',
		category: 'flower',
		description:
			'Shade garden perennial prized for its foliage in blue, green, and variegated patterns, hostas thrive where other plants struggle.',
		light: {
			minSunHours: 1,
			maxSunHours: 4,
			idealMinHours: 2,
			idealMaxHours: 3,
			toleratesAfternoonShade: true,
			benefitsFromAfternoonShade: true
		},
		temperature: {
			frostTolerance: 'hardy',
			minGrowingTempF: 30,
			maxGrowingTempF: 85,
			optimalMinTempF: 55,
			optimalMaxTempF: 75
		},
		timing: {
			daysToMaturityMin: 90,
			daysToMaturityMax: 120,
			canStartIndoors: false
		}
	}
];

/**
 * Look up a plant by its ID.
 */
export function getPlantById(id: string): Plant | undefined {
	return PLANTS.find((plant) => plant.id === id);
}

/**
 * Get all plants in a specific category.
 */
export function getPlantsByCategory(category: Plant['category']): Plant[] {
	return PLANTS.filter((plant) => plant.category === category);
}

/**
 * Get all plants that can tolerate the given minimum sun hours.
 */
export function getPlantsForSunHours(effectiveSunHours: number): Plant[] {
	return PLANTS.filter((plant) => effectiveSunHours >= plant.light.minSunHours);
}
