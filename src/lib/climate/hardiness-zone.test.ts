/**
 * Tests for hardiness zone lookup functionality.
 *
 * These tests verify that the hardiness zone calculation produces reasonable
 * results for known US cities and handles edge cases appropriately. The zone
 * values are approximate since the implementation uses coordinate-based
 * estimation rather than official USDA zone maps, so tests allow for ±1 zone
 * tolerance in most cases.
 */

import { describe, it, expect } from 'vitest';
import {
	getHardinessZone,
	estimateMinWinterTemp,
	formatHardinessZone,
	formatZoneTempRange,
	celsiusToFahrenheit,
	fahrenheitToCelsius
} from './hardiness-zone.js';

describe('getHardinessZone', () => {
	describe('known US city zones', () => {
		// These tests verify approximate zone accuracy. Since we're using
		// coordinate-based estimation, we allow ±1 zone number tolerance.

		it('returns zone 10-11 for Miami, Florida', () => {
			const zone = getHardinessZone({ latitude: 25.76, longitude: -80.19 });
			expect(zone.zoneNumber).toBeGreaterThanOrEqual(9);
			expect(zone.zoneNumber).toBeLessThanOrEqual(11);
			expect(zone.zone).toMatch(/^(9|10|11)[ab]$/);
		});

		it('returns zone 7-9 for Atlanta, Georgia', () => {
			const zone = getHardinessZone({ latitude: 33.75, longitude: -84.39 });
			expect(zone.zoneNumber).toBeGreaterThanOrEqual(7);
			expect(zone.zoneNumber).toBeLessThanOrEqual(9);
		});

		it('returns zone 5-6 for Chicago, Illinois', () => {
			const zone = getHardinessZone({ latitude: 41.88, longitude: -87.63 });
			expect(zone.zoneNumber).toBeGreaterThanOrEqual(5);
			expect(zone.zoneNumber).toBeLessThanOrEqual(7);
		});

		it('returns zone 4-5 for Minneapolis, Minnesota', () => {
			const zone = getHardinessZone({ latitude: 44.98, longitude: -93.27 });
			expect(zone.zoneNumber).toBeGreaterThanOrEqual(3);
			expect(zone.zoneNumber).toBeLessThanOrEqual(5);
		});

		it('returns zone 8-9 for Portland, Oregon (coastal)', () => {
			const zone = getHardinessZone({ latitude: 45.52, longitude: -122.68 });
			// Portland is coastal, should be warmer than its latitude suggests
			expect(zone.zoneNumber).toBeGreaterThanOrEqual(7);
			expect(zone.zoneNumber).toBeLessThanOrEqual(9);
		});

		it('returns zone 9-11 for Phoenix, Arizona', () => {
			// Phoenix is hot desert, zone 9b-10a officially
			const zone = getHardinessZone({ latitude: 33.45, longitude: -112.07 });
			expect(zone.zoneNumber).toBeGreaterThanOrEqual(8);
			expect(zone.zoneNumber).toBeLessThanOrEqual(11);
		});

		it('returns zone 5-7 for Denver, Colorado at elevation', () => {
			// Denver is officially 5b-6a, at 1600m elevation
			const zone = getHardinessZone(
				{ latitude: 39.74, longitude: -104.99 },
				{ elevationMeters: 1600 }
			);
			expect(zone.zoneNumber).toBeGreaterThanOrEqual(4);
			expect(zone.zoneNumber).toBeLessThanOrEqual(7);
		});

		it('returns zone 2-4 for Fairbanks, Alaska', () => {
			const zone = getHardinessZone({ latitude: 64.84, longitude: -147.72 });
			expect(zone.zoneNumber).toBeGreaterThanOrEqual(1);
			expect(zone.zoneNumber).toBeLessThanOrEqual(4);
		});
	});

	describe('zone structure', () => {
		it('returns all required HardinessZone fields', () => {
			const zone = getHardinessZone({ latitude: 40, longitude: -75 });
			expect(zone).toHaveProperty('zone');
			expect(zone).toHaveProperty('zoneNumber');
			expect(zone).toHaveProperty('subzone');
			expect(zone).toHaveProperty('minTempF');
			expect(zone).toHaveProperty('maxTempF');
			expect(zone).toHaveProperty('source');
			expect(zone).toHaveProperty('isApproximate');
		});

		it('returns zone string matching zoneNumber and subzone', () => {
			const zone = getHardinessZone({ latitude: 40, longitude: -75 });
			expect(zone.zone).toBe(`${zone.zoneNumber}${zone.subzone}`);
		});

		it('returns subzone as either a or b', () => {
			const zone = getHardinessZone({ latitude: 40, longitude: -75 });
			expect(['a', 'b']).toContain(zone.subzone);
		});

		it('returns temperature range spanning 5°F (subzone width)', () => {
			const zone = getHardinessZone({ latitude: 40, longitude: -75 });
			expect(zone.maxTempF - zone.minTempF).toBe(5);
		});

		it('marks coordinate-based results as calculated and approximate', () => {
			const zone = getHardinessZone({ latitude: 40, longitude: -75 });
			expect(zone.source).toBe('calculated');
			expect(zone.isApproximate).toBe(true);
		});
	});

	describe('elevation effects', () => {
		it('returns colder zone for high elevation locations', () => {
			const lowElevation = getHardinessZone({ latitude: 40, longitude: -105 });
			const highElevation = getHardinessZone(
				{ latitude: 40, longitude: -105 },
				{ elevationMeters: 3000 }
			);
			expect(highElevation.zoneNumber).toBeLessThanOrEqual(lowElevation.zoneNumber);
		});

		it('shows significant zone change for 3000m elevation gain', () => {
			const seaLevel = getHardinessZone({ latitude: 35, longitude: -100 });
			const mountain = getHardinessZone(
				{ latitude: 35, longitude: -100 },
				{ elevationMeters: 3000 }
			);
			// 3000m should drop temperature significantly, typically 2-4 zones
			expect(seaLevel.zoneNumber - mountain.zoneNumber).toBeGreaterThanOrEqual(2);
		});
	});

	describe('coastal effects', () => {
		it('returns warmer zone for coastal locations', () => {
			// Compare Seattle (coastal) to Spokane (inland) at similar latitudes
			const seattle = getHardinessZone({ latitude: 47.61, longitude: -122.33 });
			const spokane = getHardinessZone({ latitude: 47.66, longitude: -117.43 });
			// Seattle should be same or warmer than Spokane
			expect(seattle.zoneNumber).toBeGreaterThanOrEqual(spokane.zoneNumber);
		});
	});

	describe('international locations', () => {
		it('returns reasonable zone for London, UK', () => {
			// London is approximately zone 9, mild due to Gulf Stream
			const zone = getHardinessZone({ latitude: 51.51, longitude: -0.13 });
			expect(zone.zoneNumber).toBeGreaterThanOrEqual(7);
			expect(zone.zoneNumber).toBeLessThanOrEqual(10);
		});

		it('returns reasonable zone for Sydney, Australia', () => {
			// Sydney is approximately zone 10
			const zone = getHardinessZone({ latitude: -33.87, longitude: 151.21 });
			expect(zone.zoneNumber).toBeGreaterThanOrEqual(9);
			expect(zone.zoneNumber).toBeLessThanOrEqual(11);
		});

		it('returns reasonable zone for Tokyo, Japan', () => {
			// Tokyo is approximately zone 9a
			const zone = getHardinessZone({ latitude: 35.68, longitude: 139.69 });
			expect(zone.zoneNumber).toBeGreaterThanOrEqual(8);
			expect(zone.zoneNumber).toBeLessThanOrEqual(10);
		});

		it('returns tropical zone for Singapore', () => {
			// Singapore is tropical, should be zone 12-13
			const zone = getHardinessZone({ latitude: 1.35, longitude: 103.82 });
			expect(zone.zoneNumber).toBeGreaterThanOrEqual(11);
			expect(zone.zoneNumber).toBeLessThanOrEqual(13);
		});
	});

	describe('edge cases', () => {
		it('handles equator location', () => {
			const zone = getHardinessZone({ latitude: 0, longitude: 0 });
			expect(zone.zoneNumber).toBeGreaterThanOrEqual(11);
		});

		it('handles arctic latitude', () => {
			const zone = getHardinessZone({ latitude: 70, longitude: 25 });
			expect(zone.zoneNumber).toBeLessThanOrEqual(3);
		});

		it('handles antarctic latitude', () => {
			const zone = getHardinessZone({ latitude: -65, longitude: 0 });
			expect(zone.zoneNumber).toBeLessThanOrEqual(4);
		});

		it('clamps zone number to valid range 1-13', () => {
			// Very cold location
			const coldZone = getHardinessZone(
				{ latitude: 70, longitude: 0 },
				{ elevationMeters: 5000 }
			);
			expect(coldZone.zoneNumber).toBeGreaterThanOrEqual(1);

			// Very warm location
			const warmZone = getHardinessZone({ latitude: 5, longitude: 0 });
			expect(warmZone.zoneNumber).toBeLessThanOrEqual(13);
		});
	});
});

describe('estimateMinWinterTemp', () => {
	it('returns warmer temperatures for lower latitudes', () => {
		const tropicalTemp = estimateMinWinterTemp({ latitude: 25, longitude: -80 });
		const temperateTemp = estimateMinWinterTemp({ latitude: 40, longitude: -75 });
		const coldTemp = estimateMinWinterTemp({ latitude: 50, longitude: -100 });

		expect(tropicalTemp).toBeGreaterThan(temperateTemp);
		expect(temperateTemp).toBeGreaterThan(coldTemp);
	});

	it('returns warmer temperatures for coastal locations', () => {
		const coastalTemp = estimateMinWinterTemp(
			{ latitude: 45, longitude: -122 },
			{ isCoastal: true }
		);
		const inlandTemp = estimateMinWinterTemp(
			{ latitude: 45, longitude: -100 },
			{ isCoastal: false }
		);

		expect(coastalTemp).toBeGreaterThan(inlandTemp);
	});

	it('returns colder temperatures for high elevations', () => {
		const seaLevelTemp = estimateMinWinterTemp({ latitude: 40, longitude: -105 });
		const mountainTemp = estimateMinWinterTemp(
			{ latitude: 40, longitude: -105 },
			{ elevationMeters: 2000 }
		);

		expect(seaLevelTemp).toBeGreaterThan(mountainTemp);
	});
});

describe('formatHardinessZone', () => {
	it('formats zone without temperature', () => {
		const zone = getHardinessZone({ latitude: 40, longitude: -75 });
		const formatted = formatHardinessZone(zone);
		expect(formatted).toMatch(/^Zone \d+[ab]$/);
	});

	it('formats zone with temperature when requested', () => {
		const zone = getHardinessZone({ latitude: 40, longitude: -75 });
		const formatted = formatHardinessZone(zone, true);
		expect(formatted).toMatch(/^Zone \d+[ab] \(-?\d+°F to -?\d+°F\)$/);
	});
});

describe('formatZoneTempRange', () => {
	it('includes both Fahrenheit and Celsius', () => {
		const zone = getHardinessZone({ latitude: 40, longitude: -75 });
		const formatted = formatZoneTempRange(zone);
		expect(formatted).toContain('°F');
		expect(formatted).toContain('°C');
	});

	it('formats correctly for a known zone', () => {
		// Create a zone 7a manually to test formatting
		const zone = {
			zone: '7a',
			zoneNumber: 7,
			subzone: 'a' as const,
			minTempF: 0,
			maxTempF: 5,
			source: 'calculated' as const,
			isApproximate: true
		};
		const formatted = formatZoneTempRange(zone);
		expect(formatted).toBe('0°F to 5°F (-18°C to -15°C)');
	});
});

describe('temperature conversion utilities', () => {
	describe('celsiusToFahrenheit', () => {
		it('converts 0°C to 32°F', () => {
			expect(celsiusToFahrenheit(0)).toBe(32);
		});

		it('converts 100°C to 212°F', () => {
			expect(celsiusToFahrenheit(100)).toBe(212);
		});

		it('converts -40°C to -40°F', () => {
			expect(celsiusToFahrenheit(-40)).toBe(-40);
		});
	});

	describe('fahrenheitToCelsius', () => {
		it('converts 32°F to 0°C', () => {
			expect(fahrenheitToCelsius(32)).toBe(0);
		});

		it('converts 212°F to 100°C', () => {
			expect(fahrenheitToCelsius(212)).toBe(100);
		});

		it('converts -40°F to -40°C', () => {
			expect(fahrenheitToCelsius(-40)).toBe(-40);
		});
	});
});
