/**
 * Tests for slope data types and calculations.
 *
 * These tests verify the geometric calculations for terrain-adjusted sun
 * analysis. The core formula computes the dot product between the sun vector
 * and the surface normal, which determines how much sunlight a sloped surface
 * receives compared to flat ground.
 */

import { describe, it, expect } from 'vitest';
import {
	calculateSlopeIrradiance,
	calculateEffectiveAltitude,
	calculateSlopeBoostFactor,
	getDailySunHoursWithSlope,
	normalizeSlope,
	describeSlopeDirection,
	SLOPE_PRESETS,
	type PlotSlope
} from './slope.js';
import type { SolarPosition, Coordinates } from './types.js';

describe('calculateSlopeIrradiance', () => {
	const createSun = (altitude: number, azimuth: number): SolarPosition => ({
		altitude,
		azimuth,
		timestamp: new Date()
	});

	describe('basic behavior', () => {
		it('returns 0 when sun is below horizon', () => {
			const sun = createSun(-10, 180);
			const slope: PlotSlope = { angle: 15, aspect: 180 };
			expect(calculateSlopeIrradiance(sun, slope)).toBe(0);
		});

		it('returns 0 when sun is exactly at horizon', () => {
			const sun = createSun(0, 180);
			const slope: PlotSlope = { angle: 15, aspect: 180 };
			expect(calculateSlopeIrradiance(sun, slope)).toBe(0);
		});

		it('matches sin(altitude) for flat surface', () => {
			const sun = createSun(30, 180);
			const flat: PlotSlope = { angle: 0, aspect: 180 };
			const expected = Math.sin(30 * Math.PI / 180);
			expect(calculateSlopeIrradiance(sun, flat)).toBeCloseTo(expected, 5);
		});

		it('returns higher irradiance for south-facing slope when sun is south', () => {
			const sun = createSun(30, 180); // sun due south at 30 degrees
			const flat: PlotSlope = { angle: 0, aspect: 180 };
			const southSlope: PlotSlope = { angle: 15, aspect: 180 };

			const flatIrr = calculateSlopeIrradiance(sun, flat);
			const slopeIrr = calculateSlopeIrradiance(sun, southSlope);

			expect(slopeIrr).toBeGreaterThan(flatIrr);
		});

		it('returns lower irradiance for north-facing slope when sun is south', () => {
			const sun = createSun(30, 180); // sun due south
			const flat: PlotSlope = { angle: 0, aspect: 180 };
			const northSlope: PlotSlope = { angle: 15, aspect: 0 }; // faces north

			const flatIrr = calculateSlopeIrradiance(sun, flat);
			const slopeIrr = calculateSlopeIrradiance(sun, northSlope);

			expect(slopeIrr).toBeLessThan(flatIrr);
		});
	});

	describe('San Francisco winter solstice example from research', () => {
		// At solar noon on winter solstice in San Francisco (37.7°N),
		// the sun reaches approximately 29° altitude, due south (180° azimuth).
		// A 15° south-facing slope should yield an effective altitude of ~44°.
		it('produces expected irradiance factor of ~0.695', () => {
			const sun = createSun(29, 180);
			const slope: PlotSlope = { angle: 15, aspect: 180 };

			const irradiance = calculateSlopeIrradiance(sun, slope);

			// From research: sin(effective) = 0.469 + 0.226 = 0.695
			expect(irradiance).toBeCloseTo(0.695, 2);
		});

		it('produces effective altitude of ~44 degrees', () => {
			const sun = createSun(29, 180);
			const slope: PlotSlope = { angle: 15, aspect: 180 };

			const effectiveAlt = calculateEffectiveAltitude(sun, slope);

			// arcsin(0.695) ≈ 44°
			expect(effectiveAlt).toBeCloseTo(44, 0);
		});

		it('shows ~43% more irradiance than flat ground', () => {
			const sun = createSun(29, 180);
			const slope: PlotSlope = { angle: 15, aspect: 180 };

			const boostFactor = calculateSlopeBoostFactor(sun, slope);

			// Flat: sin(29°) ≈ 0.485, Sloped: ~0.695
			// Ratio: 0.695 / 0.485 ≈ 1.43 (43% more)
			expect(boostFactor).toBeCloseTo(1.43, 1);
		});
	});

	describe('slope orientation effects', () => {
		const sun = createSun(45, 180); // sun due south at 45 degrees

		it('east-facing slope has reduced irradiance at solar noon', () => {
			const flat: PlotSlope = { angle: 0, aspect: 180 };
			const eastSlope: PlotSlope = { angle: 15, aspect: 90 };

			const flatIrr = calculateSlopeIrradiance(sun, flat);
			const slopeIrr = calculateSlopeIrradiance(sun, eastSlope);

			expect(slopeIrr).toBeLessThan(flatIrr);
		});

		it('west-facing slope has reduced irradiance at solar noon', () => {
			const flat: PlotSlope = { angle: 0, aspect: 180 };
			const westSlope: PlotSlope = { angle: 15, aspect: 270 };

			const flatIrr = calculateSlopeIrradiance(sun, flat);
			const slopeIrr = calculateSlopeIrradiance(sun, westSlope);

			expect(slopeIrr).toBeLessThan(flatIrr);
		});

		it('steeper south slope provides more boost', () => {
			const gentle: PlotSlope = { angle: 5, aspect: 180 };
			const moderate: PlotSlope = { angle: 15, aspect: 180 };
			const steep: PlotSlope = { angle: 25, aspect: 180 };

			const gentleIrr = calculateSlopeIrradiance(sun, gentle);
			const moderateIrr = calculateSlopeIrradiance(sun, moderate);
			const steepIrr = calculateSlopeIrradiance(sun, steep);

			expect(moderateIrr).toBeGreaterThan(gentleIrr);
			expect(steepIrr).toBeGreaterThan(moderateIrr);
		});
	});

	describe('self-shadowing', () => {
		it('returns 0 when slope faces away from sun completely', () => {
			// Sun in the south (180°) at low angle (15°)
			// Steep north-facing slope that tilts away from sun
			const sun = createSun(15, 180);
			const slope: PlotSlope = { angle: 30, aspect: 0 }; // faces north

			const irradiance = calculateSlopeIrradiance(sun, slope);

			// The surface normal points largely away from the sun
			// At 30° tilt facing north with sun at 15° from south, should be in shadow
			expect(irradiance).toBe(0);
		});
	});
});

describe('calculateEffectiveAltitude', () => {
	const createSun = (altitude: number, azimuth: number): SolarPosition => ({
		altitude,
		azimuth,
		timestamp: new Date()
	});

	it('equals actual altitude for flat surface', () => {
		const sun = createSun(45, 180);
		const flat: PlotSlope = { angle: 0, aspect: 180 };

		const effectiveAlt = calculateEffectiveAltitude(sun, flat);

		expect(effectiveAlt).toBeCloseTo(45, 1);
	});

	it('returns 0 when sun is below horizon', () => {
		const sun = createSun(-10, 180);
		const slope: PlotSlope = { angle: 15, aspect: 180 };

		expect(calculateEffectiveAltitude(sun, slope)).toBe(0);
	});

	it('can exceed 90 degrees conceptually (capped at 90)', () => {
		// High sun with perfectly aligned steep slope
		const sun = createSun(80, 180);
		const slope: PlotSlope = { angle: 15, aspect: 180 };

		const effectiveAlt = calculateEffectiveAltitude(sun, slope);

		// Should be capped since irradiance factor maxes at 1
		expect(effectiveAlt).toBeLessThanOrEqual(90);
	});
});

describe('calculateSlopeBoostFactor', () => {
	const createSun = (altitude: number, azimuth: number): SolarPosition => ({
		altitude,
		azimuth,
		timestamp: new Date()
	});

	it('returns 1 for flat surface', () => {
		const sun = createSun(45, 180);
		const flat: PlotSlope = { angle: 0, aspect: 180 };

		expect(calculateSlopeBoostFactor(sun, flat)).toBeCloseTo(1, 5);
	});

	it('returns 1 when sun is below horizon', () => {
		const sun = createSun(-10, 180);
		const slope: PlotSlope = { angle: 15, aspect: 180 };

		expect(calculateSlopeBoostFactor(sun, slope)).toBe(1);
	});

	it('returns value > 1 for favorable slope', () => {
		const sun = createSun(30, 180);
		const slope: PlotSlope = { angle: 15, aspect: 180 };

		expect(calculateSlopeBoostFactor(sun, slope)).toBeGreaterThan(1);
	});

	it('returns value < 1 for unfavorable slope', () => {
		const sun = createSun(30, 180);
		const slope: PlotSlope = { angle: 15, aspect: 0 }; // north-facing

		expect(calculateSlopeBoostFactor(sun, slope)).toBeLessThan(1);
	});
});

describe('getDailySunHoursWithSlope', () => {
	const sanFrancisco: Coordinates = { latitude: 37.7749, longitude: -122.4194 };

	it('produces positive sun hours for valid coordinates', () => {
		const date = new Date('2024-06-21'); // summer solstice
		const slope: PlotSlope = { angle: 15, aspect: 180 };

		const result = getDailySunHoursWithSlope(sanFrancisco, date, slope);

		expect(result.sunHours).toBeGreaterThan(0);
		expect(result.sunHours).toBeLessThanOrEqual(24);
	});

	it('south-facing slope accumulates more sun hours than flat in winter', () => {
		const winterSolstice = new Date('2024-12-21');
		const flat: PlotSlope = { angle: 0, aspect: 180 };
		const southSlope: PlotSlope = { angle: 15, aspect: 180 };

		const flatResult = getDailySunHoursWithSlope(sanFrancisco, winterSolstice, flat);
		const slopeResult = getDailySunHoursWithSlope(sanFrancisco, winterSolstice, southSlope);

		expect(slopeResult.sunHours).toBeGreaterThan(flatResult.sunHours);
	});

	it('north-facing slope accumulates fewer sun hours than flat', () => {
		const summerDate = new Date('2024-06-21');
		const flat: PlotSlope = { angle: 0, aspect: 180 };
		const northSlope: PlotSlope = { angle: 15, aspect: 0 };

		const flatResult = getDailySunHoursWithSlope(sanFrancisco, summerDate, flat);
		const slopeResult = getDailySunHoursWithSlope(sanFrancisco, summerDate, northSlope);

		expect(slopeResult.sunHours).toBeLessThan(flatResult.sunHours);
	});

	it('returns consistent sun times regardless of slope', () => {
		const date = new Date('2024-03-20'); // equinox
		const flat: PlotSlope = { angle: 0, aspect: 180 };
		const slope: PlotSlope = { angle: 20, aspect: 180 };

		const flatResult = getDailySunHoursWithSlope(sanFrancisco, date, flat);
		const slopeResult = getDailySunHoursWithSlope(sanFrancisco, date, slope);

		// Sun times (sunrise/sunset) don't change with slope
		expect(slopeResult.sunTimes.dayLength).toBe(flatResult.sunTimes.dayLength);
	});
});

describe('normalizeSlope', () => {
	it('clamps angle to 0-45 range', () => {
		expect(normalizeSlope({ angle: -5, aspect: 180 }).angle).toBe(0);
		expect(normalizeSlope({ angle: 60, aspect: 180 }).angle).toBe(45);
		expect(normalizeSlope({ angle: 20, aspect: 180 }).angle).toBe(20);
	});

	it('normalizes aspect to 0-360 range', () => {
		expect(normalizeSlope({ angle: 10, aspect: -90 }).aspect).toBe(270);
		expect(normalizeSlope({ angle: 10, aspect: 450 }).aspect).toBe(90);
		expect(normalizeSlope({ angle: 10, aspect: 180 }).aspect).toBe(180);
	});

	it('returns flat preset for very small angles', () => {
		const result = normalizeSlope({ angle: 0.3, aspect: 90 });
		expect(result).toEqual(SLOPE_PRESETS.flat);
	});
});

describe('describeSlopeDirection', () => {
	it('returns "Flat" for zero angle', () => {
		expect(describeSlopeDirection({ angle: 0, aspect: 180 })).toBe('Flat');
	});

	it('describes gentle slopes correctly', () => {
		expect(describeSlopeDirection({ angle: 5, aspect: 180 })).toContain('Gentle');
		expect(describeSlopeDirection({ angle: 5, aspect: 180 })).toContain('south');
	});

	it('describes moderate slopes correctly', () => {
		expect(describeSlopeDirection({ angle: 15, aspect: 90 })).toContain('Moderate');
		expect(describeSlopeDirection({ angle: 15, aspect: 90 })).toContain('east');
	});

	it('describes steep slopes correctly', () => {
		expect(describeSlopeDirection({ angle: 25, aspect: 0 })).toContain('Steep');
		expect(describeSlopeDirection({ angle: 25, aspect: 0 })).toContain('north');
	});

	it('includes angle in description', () => {
		const desc = describeSlopeDirection({ angle: 12, aspect: 180 });
		expect(desc).toContain('12°');
	});

	it('handles intercardinal directions', () => {
		expect(describeSlopeDirection({ angle: 10, aspect: 45 })).toContain('northeast');
		expect(describeSlopeDirection({ angle: 10, aspect: 135 })).toContain('southeast');
		expect(describeSlopeDirection({ angle: 10, aspect: 225 })).toContain('southwest');
		expect(describeSlopeDirection({ angle: 10, aspect: 315 })).toContain('northwest');
	});
});

describe('SLOPE_PRESETS', () => {
	it('has flat preset with zero angle', () => {
		expect(SLOPE_PRESETS.flat.angle).toBe(0);
	});

	it('has south-facing presets', () => {
		expect(SLOPE_PRESETS['gentle-south'].aspect).toBe(180);
		expect(SLOPE_PRESETS['moderate-south'].aspect).toBe(180);
	});

	it('all presets have valid ranges', () => {
		for (const preset of Object.values(SLOPE_PRESETS)) {
			expect(preset.angle).toBeGreaterThanOrEqual(0);
			expect(preset.angle).toBeLessThanOrEqual(45);
			expect(preset.aspect).toBeGreaterThanOrEqual(0);
			expect(preset.aspect).toBeLessThan(360);
		}
	});
});
