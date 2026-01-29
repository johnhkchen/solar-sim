/**
 * Köppen climate classification for Solar-Sim.
 *
 * This module implements the Köppen-Geiger climate classification system, which divides
 * Earth's climates into five main groups based on temperature and precipitation patterns.
 * Each classification includes gardening-relevant descriptions to help users understand
 * what their climate means for growing plants.
 *
 * The algorithm evaluates conditions in a specific order: polar climates first, then arid,
 * then the remaining types. This order matters because a location might satisfy criteria
 * for multiple types, and the first match wins.
 */

/**
 * Monthly climate data needed for Köppen classification.
 * All temperatures in Celsius, precipitation in millimeters.
 */
export interface MonthlyClimateData {
	/** Latitude of the location (needed for hemisphere-based seasonality) */
	latitude: number;
	/** Average temperature for each month (12 values, index 0 = January) */
	temps: number[];
	/** Total precipitation for each month in mm (12 values, index 0 = January) */
	precip: number[];
}

/**
 * Köppen climate classification result with gardening-relevant descriptions.
 */
export interface KoppenClassification {
	/** Climate code like "Csb" or "Dfa" */
	code: string;
	/** Primary climate type: A (Tropical), B (Arid), C (Temperate), D (Continental), E (Polar) */
	primaryType: 'A' | 'B' | 'C' | 'D' | 'E';
	/** Human-readable name of the climate type */
	description: string;
	/** Practical gardening advice for this climate */
	gardeningNotes: string;
}

/**
 * Primary Köppen types with their characteristics.
 */
const PRIMARY_TYPES: Record<string, string> = {
	A: 'Tropical',
	B: 'Arid',
	C: 'Temperate',
	D: 'Continental',
	E: 'Polar'
};

/**
 * Descriptions for each Köppen code mapped to gardening-relevant language. The descriptions
 * explain what the climate means in practical terms rather than using technical jargon.
 */
const KOPPEN_DESCRIPTIONS: Record<string, { description: string; gardeningNotes: string }> = {
	// Tropical climates (A)
	Af: {
		description: 'Tropical rainforest',
		gardeningNotes:
			'Year-round warmth and rainfall support continuous growth. Tropical fruits, palms, and rainforest plants thrive. No frost concerns, but excessive moisture can cause fungal issues. Raised beds improve drainage.'
	},
	Am: {
		description: 'Tropical monsoon',
		gardeningNotes:
			'Warm year-round with a brief dry season. Similar to rainforest conditions but the dry period allows for seasonal crops. Mulching helps retain moisture during dry spells.'
	},
	Aw: {
		description: 'Tropical savanna (dry winter)',
		gardeningNotes:
			'Warm with distinct wet and dry seasons. The dry season is ideal for harvesting and seed saving. Drought-tolerant plants perform well during the dry months while rain-loving crops flourish in the wet season.'
	},
	As: {
		description: 'Tropical savanna (dry summer)',
		gardeningNotes:
			'Warm with a dry summer period. Plan water-intensive crops for the rainy season and drought-tolerant varieties for summer. Irrigation is essential during the dry months.'
	},

	// Arid climates (B)
	BWh: {
		description: 'Hot desert',
		gardeningNotes:
			'Extreme heat and minimal rainfall define this challenging climate. Focus on xeriscaping with cacti, succulents, and native desert plants. Drip irrigation is essential, and shade structures protect plants from afternoon sun.'
	},
	BWk: {
		description: 'Cold desert',
		gardeningNotes:
			'Low rainfall with cold winters and hot summers. The wide temperature swings stress plants, so choose hardy varieties. Water deeply but infrequently, and protect tender plants from winter cold.'
	},
	BSh: {
		description: 'Hot semi-arid (steppe)',
		gardeningNotes:
			'Hot with slightly more rainfall than true desert. Mediterranean and drought-tolerant plants adapt well. Morning watering reduces evaporation, and mulch conserves soil moisture.'
	},
	BSk: {
		description: 'Cold semi-arid (steppe)',
		gardeningNotes:
			'Cool to cold with limited precipitation. Short growing season but many cold-hardy crops succeed. Timing planting to take advantage of spring moisture is key.'
	},

	// Temperate climates (C)
	Cfa: {
		description: 'Humid subtropical',
		gardeningNotes:
			'Hot, humid summers and mild winters support a long growing season. Many vegetables thrive, though humidity increases disease pressure. Good air circulation and spacing help prevent fungal problems.'
	},
	Cfb: {
		description: 'Marine west coast (oceanic)',
		gardeningNotes:
			'Mild year-round temperatures with regular rainfall create excellent growing conditions. Cool-season crops perform exceptionally well, and berries, brassicas, and salad greens flourish. Some warm-season crops may struggle to ripen.'
	},
	Cfc: {
		description: 'Subpolar oceanic',
		gardeningNotes:
			'Cool summers and mild winters with persistent cloudiness. Focus on cold-hardy vegetables and leafy greens. Season extension with cold frames and row covers significantly expands possibilities.'
	},
	Csa: {
		description: 'Mediterranean (hot summer)',
		gardeningNotes:
			'Dry, hot summers and mild, wet winters. Traditional Mediterranean crops like tomatoes, peppers, olives, and grapes excel. Water-wise gardening is essential in summer, while winter rains support cool-season crops without irrigation.'
	},
	Csb: {
		description: 'Mediterranean (warm summer)',
		gardeningNotes:
			'Mild, dry summers and cool, wet winters. Excellent for year-round gardening with proper water management. Summer irrigation is necessary, but fog in coastal areas provides natural moisture. Cool-season crops thrive in winter.'
	},
	Csc: {
		description: 'Mediterranean (cold summer)',
		gardeningNotes:
			'Cool summers with dry conditions. Focus on quick-maturing crops and cool-season vegetables. The short warm period limits heat-loving plants, but leafy greens and root vegetables do well.'
	},
	Cwa: {
		description: 'Humid subtropical (dry winter)',
		gardeningNotes:
			'Hot, wet summers and mild, dry winters. Monsoon rains support summer crops while winter is ideal for drought-tolerant and cool-season plants. Drainage is important during the rainy season.'
	},
	Cwb: {
		description: 'Subtropical highland (dry winter)',
		gardeningNotes:
			'Mild year-round at elevation with dry winters. The moderate temperatures suit many crops, though summer rains require attention to drainage. Coffee, tea, and temperate fruits grow well.'
	},
	Cwc: {
		description: 'Subpolar highland (dry winter)',
		gardeningNotes:
			'Cool with dry winters at high elevation. Short growing season requires quick-maturing varieties. Root vegetables and hardy greens are reliable choices.'
	},

	// Continental climates (D)
	Dfa: {
		description: 'Hot summer continental',
		gardeningNotes:
			'Cold winters and hot, humid summers provide a moderate growing season. Classic vegetable garden crops thrive: tomatoes, corn, beans, and squash. Winter protection for perennials is essential, and mulching helps moderate soil temperature swings.'
	},
	Dfb: {
		description: 'Warm summer continental',
		gardeningNotes:
			'Cold winters with warm but shorter summers. Cool-season crops extend the harvest, while warm-season crops need early starts indoors. Apple trees, berries, and cold-hardy perennials flourish.'
	},
	Dfc: {
		description: 'Subarctic',
		gardeningNotes:
			'Long, cold winters and short, cool summers present significant challenges. Focus on quick-maturing vegetables, cold frames, and season extension techniques. Root vegetables store well for winter.'
	},
	Dfd: {
		description: 'Extremely cold subarctic',
		gardeningNotes:
			'Extreme winter cold with brief summers. Only the hardiest plants survive winters outdoors. Greenhouses and indoor growing extend the very short outdoor season.'
	},
	Dsa: {
		description: 'Hot summer continental (dry summer)',
		gardeningNotes:
			'Hot, dry summers with cold winters. Irrigation is essential in summer while snow provides winter moisture. Drought-tolerant crops and efficient watering practices are key.'
	},
	Dsb: {
		description: 'Warm summer continental (dry summer)',
		gardeningNotes:
			'Dry summers with cold winters. Similar to Mediterranean patterns but with harsher winters. Plan summer irrigation and choose cold-hardy perennials.'
	},
	Dsc: {
		description: 'Subarctic (dry summer)',
		gardeningNotes:
			'Cool, dry summers and very cold winters. The combination of drought and cold limits options, but hardy native plants and quick-maturing vegetables can succeed.'
	},
	Dsd: {
		description: 'Extremely cold subarctic (dry summer)',
		gardeningNotes:
			'Extreme conditions require indoor growing or highly protected environments. Focus on the brief summer window with fast-maturing crops.'
	},
	Dwa: {
		description: 'Hot summer continental (dry winter)',
		gardeningNotes:
			'Monsoon-influenced with hot, wet summers and cold, dry winters. The summer growing season is productive with good drainage. Winter mulching protects perennials from cold.'
	},
	Dwb: {
		description: 'Warm summer continental (dry winter)',
		gardeningNotes:
			'Moderate summers with monsoon rainfall and cold, dry winters. Summer moisture supports most vegetables, while winter dryness reduces disease pressure on dormant plants.'
	},
	Dwc: {
		description: 'Subarctic (dry winter)',
		gardeningNotes:
			'Cold with dry winters and brief summers. Snow cover protects plants less than in wetter climates, so choose extremely cold-hardy varieties and provide winter protection.'
	},
	Dwd: {
		description: 'Extremely cold subarctic (dry winter)',
		gardeningNotes:
			'Among the harshest climates for gardening. Protected growing environments are essential, and outdoor gardening is limited to the brief summer months.'
	},

	// Polar climates (E)
	ET: {
		description: 'Tundra',
		gardeningNotes:
			'Permafrost and brief summers allow only specialized gardening. Hardy root vegetables in raised beds, cold frames, and greenhouses enable limited production during the short growing window.'
	},
	EF: {
		description: 'Ice cap',
		gardeningNotes:
			'Permanent ice cover prevents traditional gardening. Indoor hydroponic or controlled environment systems are the only options for food production.'
	}
};

/**
 * Classifies a location's climate using the Köppen-Geiger system. The algorithm
 * evaluates temperature and precipitation patterns to determine the climate type,
 * then returns both the technical classification and practical gardening guidance.
 *
 * The classification follows the standard Köppen decision tree: polar climates are
 * identified first by checking if the warmest month averages below 10°C. Arid climates
 * are next, determined by comparing annual precipitation to a threshold based on
 * temperature and precipitation seasonality. The remaining climates are classified
 * as tropical (A), temperate (C), or continental (D) based on coldest month temperature.
 *
 * @param monthly - Monthly climate data including temperatures, precipitation, and latitude
 * @returns Classification with code, description, and gardening notes
 *
 * @example
 * ```typescript
 * const sanFrancisco = {
 *   latitude: 37.7749,
 *   temps: [10.6, 12.0, 13.3, 14.4, 15.6, 17.2, 17.8, 18.3, 18.3, 16.7, 13.3, 10.6],
 *   precip: [119, 113, 79, 39, 18, 5, 1, 2, 6, 27, 75, 112]
 * };
 * const result = classifyKoppen(sanFrancisco);
 * console.log(result.code); // "Csb"
 * console.log(result.description); // "Mediterranean (warm summer)"
 * ```
 */
export function classifyKoppen(monthly: MonthlyClimateData): KoppenClassification {
	const { temps, precip, latitude } = monthly;

	// Validate input
	if (temps.length !== 12 || precip.length !== 12) {
		throw new Error('Monthly climate data must contain exactly 12 values for each parameter');
	}

	// Calculate key statistics
	const tHot = Math.max(...temps);
	const tCold = Math.min(...temps);
	const tAnn = temps.reduce((a, b) => a + b, 0) / 12;
	const pAnn = precip.reduce((a, b) => a + b, 0);

	// Determine warm and cold half-year months based on hemisphere
	// Northern hemisphere: warm = Apr-Sep (indices 3-8), cold = Oct-Mar (indices 9-11, 0-2)
	// Southern hemisphere: warm = Oct-Mar, cold = Apr-Sep
	const isNorthern = latitude >= 0;
	const warmMonths = isNorthern ? [3, 4, 5, 6, 7, 8] : [9, 10, 11, 0, 1, 2];
	const coldMonths = isNorthern ? [9, 10, 11, 0, 1, 2] : [3, 4, 5, 6, 7, 8];

	const warmPrecip = warmMonths.reduce((sum, m) => sum + precip[m], 0);
	const warmFraction = pAnn > 0 ? warmPrecip / pAnn : 0.5;

	// E: Polar climates - warmest month below 10°C
	if (tHot < 10) {
		const code = tHot < 0 ? 'EF' : 'ET';
		return buildClassification(code, 'E');
	}

	// B: Arid climates - precipitation below threshold
	// The threshold formula adjusts for precipitation seasonality
	let pTh: number;
	if (warmFraction >= 0.7) {
		pTh = 20 * tAnn + 280;
	} else if (warmFraction < 0.3) {
		pTh = 20 * tAnn;
	} else {
		pTh = 20 * tAnn + 140;
	}

	if (pAnn < pTh) {
		const bType = pAnn < pTh / 2 ? 'W' : 'S';
		const bTemp = tAnn >= 18 ? 'h' : 'k';
		const code = `B${bType}${bTemp}`;
		return buildClassification(code, 'B');
	}

	// A: Tropical climates - coldest month above 18°C
	if (tCold >= 18) {
		const pDriest = Math.min(...precip);
		if (pDriest >= 60) {
			return buildClassification('Af', 'A');
		}

		// Check monsoon threshold: driest month >= 100 - (annual precip / 25)
		const monsoonThreshold = 100 - pAnn / 25;
		if (pDriest >= monsoonThreshold) {
			return buildClassification('Am', 'A');
		}

		// Savanna with dry summer or dry winter
		const summerMonths = warmMonths;
		const winterMonths = coldMonths;
		const summerPrecip = summerMonths.reduce((sum, m) => sum + precip[m], 0);
		const winterPrecip = winterMonths.reduce((sum, m) => sum + precip[m], 0);

		const code = summerPrecip < winterPrecip ? 'As' : 'Aw';
		return buildClassification(code, 'A');
	}

	// C vs D: Temperate vs Continental - distinguished by coldest month temperature
	// C: coldest month between -3°C and 18°C
	// D: coldest month below -3°C
	const primaryType: 'C' | 'D' = tCold >= -3 ? 'C' : 'D';

	// Second letter: precipitation pattern
	const secondLetter = getPrecipitationPattern(precip, warmMonths, coldMonths);

	// Third letter: temperature pattern
	const thirdLetter = getTemperaturePattern(temps, tHot, tCold);

	const code = `${primaryType}${secondLetter}${thirdLetter}`;
	return buildClassification(code, primaryType);
}

/**
 * Determines the precipitation pattern letter (f, s, or w) for temperate and continental climates.
 */
function getPrecipitationPattern(
	precip: number[],
	warmMonths: number[],
	coldMonths: number[]
): string {
	const summerPrecip = warmMonths.map((m) => precip[m]);
	const winterPrecip = coldMonths.map((m) => precip[m]);

	const drySummer = Math.min(...summerPrecip);
	const dryWinter = Math.min(...winterPrecip);
	const wetSummer = Math.max(...summerPrecip);
	const wetWinter = Math.max(...winterPrecip);

	// s: dry summer - driest summer month < 30mm AND < 1/3 of wettest winter month
	if (drySummer < 30 && drySummer < wetWinter / 3) {
		return 's';
	}

	// w: dry winter - driest winter month < 1/10 of wettest summer month
	if (dryWinter < wetSummer / 10) {
		return 'w';
	}

	// f: no dry season
	return 'f';
}

/**
 * Determines the temperature pattern letter (a, b, c, or d) for temperate and continental climates.
 */
function getTemperaturePattern(temps: number[], tHot: number, tCold: number): string {
	// Count months with average temp >= 10°C
	const warmMonthCount = temps.filter((t) => t >= 10).length;

	// a: hot summer - warmest month >= 22°C
	if (tHot >= 22) {
		return 'a';
	}

	// b: warm summer - at least 4 months >= 10°C, warmest < 22°C
	if (warmMonthCount >= 4) {
		return 'b';
	}

	// d: extremely cold winter - coldest month < -38°C (only for D climates)
	if (tCold < -38) {
		return 'd';
	}

	// c: cold summer - 1-3 months >= 10°C
	return 'c';
}

/**
 * Builds a complete KoppenClassification object from a code and primary type.
 */
function buildClassification(
	code: string,
	primaryType: 'A' | 'B' | 'C' | 'D' | 'E'
): KoppenClassification {
	const info = KOPPEN_DESCRIPTIONS[code];

	if (info) {
		return {
			code,
			primaryType,
			description: info.description,
			gardeningNotes: info.gardeningNotes
		};
	}

	// Fallback for any unrecognized codes (shouldn't happen with valid algorithm)
	return {
		code,
		primaryType,
		description: PRIMARY_TYPES[primaryType],
		gardeningNotes: `This ${PRIMARY_TYPES[primaryType].toLowerCase()} climate requires attention to local conditions for successful gardening.`
	};
}

/**
 * Returns the human-readable description for a Köppen code. This function is useful
 * when you have a code stored as a string and need to display its meaning.
 *
 * @param code - Köppen climate code like "Csb" or "Dfa"
 * @returns Human-readable description, or "Unknown climate type" if the code isn't recognized
 *
 * @example
 * ```typescript
 * getKoppenDescription("Csb"); // "Mediterranean (warm summer)"
 * getKoppenDescription("Dfa"); // "Hot summer continental"
 * ```
 */
export function getKoppenDescription(code: string): string {
	const info = KOPPEN_DESCRIPTIONS[code];
	return info?.description ?? 'Unknown climate type';
}

/**
 * Returns gardening notes for a Köppen code. This function provides practical
 * gardening advice specific to the climate type.
 *
 * @param code - Köppen climate code like "Csb" or "Dfa"
 * @returns Gardening advice, or generic message if the code isn't recognized
 *
 * @example
 * ```typescript
 * getKoppenGardeningNotes("Cfb");
 * // "Mild year-round temperatures with regular rainfall create excellent growing conditions..."
 * ```
 */
export function getKoppenGardeningNotes(code: string): string {
	const info = KOPPEN_DESCRIPTIONS[code];
	return info?.gardeningNotes ?? 'Research local conditions for the best gardening approach.';
}

/**
 * Returns the full name of a Köppen primary type letter.
 *
 * @param type - Primary type letter (A, B, C, D, or E)
 * @returns Full name like "Tropical" or "Continental"
 */
export function getKoppenPrimaryTypeName(type: string): string {
	return PRIMARY_TYPES[type] ?? 'Unknown';
}
