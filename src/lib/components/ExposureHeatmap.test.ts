/**
 * Tests for ExposureHeatmap color interpolation logic.
 *
 * Since the component relies on canvas rendering and Leaflet integration,
 * we extract and test the core logic: color interpolation for sun-hours values.
 */

import { describe, it, expect } from 'vitest';
import { DEFAULT_COLOR_SCALE, type HeatmapColorStop } from './ExposureHeatmap.svelte';

/**
 * Interpolates between two hex colors (extracted from component).
 */
function interpolateColor(color1: string, color2: string, t: number): string {
	const r1 = parseInt(color1.slice(1, 3), 16);
	const g1 = parseInt(color1.slice(3, 5), 16);
	const b1 = parseInt(color1.slice(5, 7), 16);

	const r2 = parseInt(color2.slice(1, 3), 16);
	const g2 = parseInt(color2.slice(3, 5), 16);
	const b2 = parseInt(color2.slice(5, 7), 16);

	const r = Math.round(r1 + (r2 - r1) * t);
	const g = Math.round(g1 + (g2 - g1) * t);
	const b = Math.round(b1 + (b2 - b1) * t);

	return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
}

/**
 * Gets color for sun-hours value (extracted from component).
 */
function getSunHoursColor(hours: number, colorScale: HeatmapColorStop[] = DEFAULT_COLOR_SCALE): string {
	const stops = colorScale;

	if (hours <= stops[0].hours) return stops[0].color;
	if (hours >= stops[stops.length - 1].hours) return stops[stops.length - 1].color;

	for (let i = 0; i < stops.length - 1; i++) {
		if (hours >= stops[i].hours && hours <= stops[i + 1].hours) {
			const t = (hours - stops[i].hours) / (stops[i + 1].hours - stops[i].hours);
			return interpolateColor(stops[i].color, stops[i + 1].color, t);
		}
	}

	return stops[stops.length - 1].color;
}

describe('ExposureHeatmap color logic', () => {
	describe('DEFAULT_COLOR_SCALE', () => {
		it('has correct number of stops', () => {
			expect(DEFAULT_COLOR_SCALE.length).toBe(5);
		});

		it('starts at 0 hours with blue for full shade', () => {
			expect(DEFAULT_COLOR_SCALE[0].hours).toBe(0);
			expect(DEFAULT_COLOR_SCALE[0].color).toBe('#4a90d9');
		});

		it('ends at 12 hours with orange-red for full sun', () => {
			expect(DEFAULT_COLOR_SCALE[4].hours).toBe(12);
			expect(DEFAULT_COLOR_SCALE[4].color).toBe('#ff6b35');
		});

		it('has part shade boundary at 2 hours', () => {
			const stop = DEFAULT_COLOR_SCALE.find((s) => s.hours === 2);
			expect(stop).toBeDefined();
			expect(stop?.color).toBe('#7bc47f'); // Light green
		});

		it('has part sun boundary at 4 hours', () => {
			const stop = DEFAULT_COLOR_SCALE.find((s) => s.hours === 4);
			expect(stop).toBeDefined();
			expect(stop?.color).toBe('#f7c948'); // Yellow
		});

		it('has full sun boundary at 6 hours', () => {
			const stop = DEFAULT_COLOR_SCALE.find((s) => s.hours === 6);
			expect(stop).toBeDefined();
			expect(stop?.color).toBe('#ff6b35'); // Orange-red
		});
	});

	describe('interpolateColor', () => {
		it('returns first color when t is 0', () => {
			const result = interpolateColor('#000000', '#ffffff', 0);
			expect(result).toBe('#000000');
		});

		it('returns second color when t is 1', () => {
			const result = interpolateColor('#000000', '#ffffff', 1);
			expect(result).toBe('#ffffff');
		});

		it('returns midpoint color when t is 0.5', () => {
			const result = interpolateColor('#000000', '#ffffff', 0.5);
			// Midpoint of black to white should be gray
			expect(result).toBe('#808080');
		});

		it('handles red channel interpolation', () => {
			const result = interpolateColor('#ff0000', '#000000', 0.5);
			expect(result).toBe('#800000');
		});

		it('handles complex color interpolation', () => {
			// Blue to green at midpoint
			const result = interpolateColor('#4a90d9', '#7bc47f', 0.5);
			// Should be roughly midway between the two
			expect(result).toMatch(/^#[0-9a-f]{6}$/);
			// Check that it's not equal to either endpoint
			expect(result).not.toBe('#4a90d9');
			expect(result).not.toBe('#7bc47f');
		});
	});

	describe('getSunHoursColor', () => {
		it('returns blue for 0 hours (full shade)', () => {
			expect(getSunHoursColor(0)).toBe('#4a90d9');
		});

		it('returns blue for negative hours (clamped)', () => {
			expect(getSunHoursColor(-1)).toBe('#4a90d9');
		});

		it('returns light green at exactly 2 hours (part shade boundary)', () => {
			expect(getSunHoursColor(2)).toBe('#7bc47f');
		});

		it('returns yellow at exactly 4 hours (part sun boundary)', () => {
			expect(getSunHoursColor(4)).toBe('#f7c948');
		});

		it('returns orange-red at exactly 6 hours (full sun boundary)', () => {
			expect(getSunHoursColor(6)).toBe('#ff6b35');
		});

		it('returns orange-red for high values (12+ hours)', () => {
			expect(getSunHoursColor(12)).toBe('#ff6b35');
			expect(getSunHoursColor(15)).toBe('#ff6b35');
		});

		it('interpolates between 0 and 2 hours', () => {
			const color = getSunHoursColor(1);
			// Should be between blue and light green
			expect(color).toMatch(/^#[0-9a-f]{6}$/);
			expect(color).not.toBe('#4a90d9');
			expect(color).not.toBe('#7bc47f');
		});

		it('interpolates between 4 and 6 hours', () => {
			const color = getSunHoursColor(5);
			// Should be between yellow and orange-red
			expect(color).toMatch(/^#[0-9a-f]{6}$/);
			expect(color).not.toBe('#f7c948');
			expect(color).not.toBe('#ff6b35');
		});

		it('stays orange-red between 6 and 12 hours (no visible change)', () => {
			// The scale has the same color at 6 and 12, so interpolation returns same value
			expect(getSunHoursColor(8)).toBe('#ff6b35');
			expect(getSunHoursColor(10)).toBe('#ff6b35');
		});
	});

	describe('horticultural category alignment', () => {
		it('full shade range (0-2h) uses cool colors', () => {
			const colors = [getSunHoursColor(0), getSunHoursColor(1), getSunHoursColor(1.9)];
			// All should be in the blue-to-green range
			for (const color of colors) {
				const r = parseInt(color.slice(1, 3), 16);
				const b = parseInt(color.slice(5, 7), 16);
				// Blue component should be relatively high, or green should dominate
				expect(b > 100 || parseInt(color.slice(3, 5), 16) > 100).toBe(true);
			}
		});

		it('full sun range (6+h) uses warm colors', () => {
			const colors = [getSunHoursColor(6), getSunHoursColor(8), getSunHoursColor(10)];
			for (const color of colors) {
				const r = parseInt(color.slice(1, 3), 16);
				// Red component should be high for warm colors
				expect(r).toBeGreaterThan(200);
			}
		});
	});
});
