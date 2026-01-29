/**
 * Tests for the NOAA CPC seasonal outlook module.
 *
 * These tests verify the guidance generation, formatting functions, and
 * data parsing logic. API calls are not tested directly since they require
 * network access to NOAA services.
 */

import { describe, it, expect } from 'vitest';
import {
	getOutlookGuidance,
	formatOutlookCategory,
	formatDroughtStatus,
	type SeasonalOutlook,
	type DroughtOutlook,
	type OutlookCategory
} from './outlook.js';

describe('getOutlookGuidance', () => {
	describe('temperature guidance', () => {
		it('generates strong above-normal guidance for high probability', () => {
			const seasonal: SeasonalOutlook = {
				validPeriod: 'FMA 2026',
				temperature: { type: 'Above', probability: 70 },
				precipitation: null,
				fetchedAt: new Date()
			};

			const guidance = getOutlookGuidance(seasonal, null);

			expect(guidance).toContain('Above-normal temperatures');
			expect(guidance).toContain('likely');
			expect(guidance).toContain('FMA 2026');
			expect(guidance).toContain('planting dates');
		});

		it('generates moderate above-normal guidance for medium probability', () => {
			const seasonal: SeasonalOutlook = {
				validPeriod: 'MAM 2026',
				temperature: { type: 'Above', probability: 45 },
				precipitation: null,
				fetchedAt: new Date()
			};

			const guidance = getOutlookGuidance(seasonal, null);

			expect(guidance).toContain('Above-normal temperatures');
			expect(guidance).toContain('somewhat likely');
			expect(guidance).toContain('late frost');
		});

		it('generates below-normal guidance with frost warnings', () => {
			const seasonal: SeasonalOutlook = {
				validPeriod: 'MJJ 2026',
				temperature: { type: 'Below', probability: 60 },
				precipitation: null,
				fetchedAt: new Date()
			};

			const guidance = getOutlookGuidance(seasonal, null);

			expect(guidance).toContain('Below-normal temperatures');
			expect(guidance).toContain('likely');
			expect(guidance).toContain('Delay planting');
		});

		it('generates near-normal guidance without strong recommendations', () => {
			const seasonal: SeasonalOutlook = {
				validPeriod: 'JJA 2026',
				temperature: { type: 'Normal', probability: 40 },
				precipitation: null,
				fetchedAt: new Date()
			};

			const guidance = getOutlookGuidance(seasonal, null);

			expect(guidance).toContain('Near-normal temperatures');
			expect(guidance).toContain('frost dates');
		});

		it('generates equal chances guidance when no signal', () => {
			const seasonal: SeasonalOutlook = {
				validPeriod: 'ASO 2026',
				temperature: { type: 'EC', probability: 33 },
				precipitation: null,
				fetchedAt: new Date()
			};

			const guidance = getOutlookGuidance(seasonal, null);

			expect(guidance).toContain('No strong temperature signal');
			expect(guidance).toContain('historical averages');
		});
	});

	describe('precipitation guidance', () => {
		it('includes wet weather guidance when precipitation is above normal', () => {
			const seasonal: SeasonalOutlook = {
				validPeriod: 'NDJ 2026',
				temperature: { type: 'Normal', probability: 40 },
				precipitation: { type: 'Above', probability: 60 },
				fetchedAt: new Date()
			};

			const guidance = getOutlookGuidance(seasonal, null);

			expect(guidance).toContain('Wetter conditions');
			expect(guidance).toContain('fungal issues');
		});

		it('includes dry weather guidance when precipitation is below normal', () => {
			const seasonal: SeasonalOutlook = {
				validPeriod: 'DJF 2026',
				temperature: { type: 'Normal', probability: 40 },
				precipitation: { type: 'Below', probability: 65 },
				fetchedAt: new Date()
			};

			const guidance = getOutlookGuidance(seasonal, null);

			expect(guidance).toContain('Drier conditions');
			expect(guidance).toContain('irrigation');
		});
	});

	describe('drought guidance', () => {
		it('includes developing drought guidance', () => {
			const drought: DroughtOutlook = {
				validPeriod: 'Next 3 months',
				status: 'developing',
				fetchedAt: new Date()
			};

			const guidance = getOutlookGuidance(null, drought);

			expect(guidance).toContain('Drought conditions may develop');
			expect(guidance).toContain('water-efficient');
		});

		it('includes persisting drought guidance', () => {
			const drought: DroughtOutlook = {
				validPeriod: 'Current',
				status: 'persisting',
				fetchedAt: new Date()
			};

			const guidance = getOutlookGuidance(null, drought);

			expect(guidance).toContain('persist');
			expect(guidance).toContain('Water restrictions');
		});

		it('includes improving drought guidance', () => {
			const drought: DroughtOutlook = {
				validPeriod: 'Current',
				status: 'improving',
				fetchedAt: new Date()
			};

			const guidance = getOutlookGuidance(null, drought);

			expect(guidance).toContain('improve');
			expect(guidance).toContain('relief');
		});

		it('includes ending drought guidance', () => {
			const drought: DroughtOutlook = {
				validPeriod: 'Current',
				status: 'removing',
				fetchedAt: new Date()
			};

			const guidance = getOutlookGuidance(null, drought);

			expect(guidance).toContain('end');
			expect(guidance).toContain('recover');
		});

		it('does not include guidance for no drought status', () => {
			const drought: DroughtOutlook = {
				validPeriod: 'Current',
				status: 'none',
				fetchedAt: new Date()
			};

			const guidance = getOutlookGuidance(null, drought);

			expect(guidance).toContain('No significant weather anomalies');
		});
	});

	describe('combined guidance', () => {
		it('combines temperature, precipitation, and drought guidance', () => {
			const seasonal: SeasonalOutlook = {
				validPeriod: 'FMA 2026',
				temperature: { type: 'Above', probability: 60 },
				precipitation: { type: 'Below', probability: 50 },
				fetchedAt: new Date()
			};

			const drought: DroughtOutlook = {
				validPeriod: 'Current',
				status: 'developing',
				fetchedAt: new Date()
			};

			const guidance = getOutlookGuidance(seasonal, drought);

			expect(guidance).toContain('Above-normal temperatures');
			expect(guidance).toContain('drier conditions'); // lowercase matches "Slightly drier"
			expect(guidance).toContain('Drought');
		});

		it('returns default message when no data available', () => {
			const guidance = getOutlookGuidance(null, null);

			expect(guidance).toContain('No significant weather anomalies');
			expect(guidance).toContain('historical averages');
		});
	});
});

describe('formatOutlookCategory', () => {
	it('formats above-normal category with probability', () => {
		const category: OutlookCategory = { type: 'Above', probability: 60 };
		const formatted = formatOutlookCategory(category, 'temperatures');

		expect(formatted).toBe('Above-normal temperatures (60% probability)');
	});

	it('formats below-normal category with probability', () => {
		const category: OutlookCategory = { type: 'Below', probability: 45 };
		const formatted = formatOutlookCategory(category, 'precipitation');

		expect(formatted).toBe('Below-normal precipitation (45% probability)');
	});

	it('formats near-normal category correctly', () => {
		const category: OutlookCategory = { type: 'Normal', probability: 40 };
		const formatted = formatOutlookCategory(category, 'temperatures');

		expect(formatted).toBe('Near-normal temperatures (40% probability)');
	});

	it('formats equal chances without probability', () => {
		const category: OutlookCategory = { type: 'EC', probability: 33 };
		const formatted = formatOutlookCategory(category, 'temperatures');

		expect(formatted).toBe('Equal chances for temperatures');
	});
});

describe('formatDroughtStatus', () => {
	it('formats none status', () => {
		expect(formatDroughtStatus('none')).toBe('No drought expected');
	});

	it('formats developing status', () => {
		expect(formatDroughtStatus('developing')).toBe('Drought may develop');
	});

	it('formats persisting status', () => {
		expect(formatDroughtStatus('persisting')).toBe('Drought conditions persisting');
	});

	it('formats improving status', () => {
		expect(formatDroughtStatus('improving')).toBe('Drought conditions improving');
	});

	it('formats removing status', () => {
		expect(formatDroughtStatus('removing')).toBe('Drought ending');
	});
});
