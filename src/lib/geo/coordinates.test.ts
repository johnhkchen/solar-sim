/**
 * Tests for coordinate parsing and validation.
 *
 * These tests verify that parseCoordinates handles various input formats
 * correctly and that validation catches out-of-range values.
 */

import { describe, it, expect } from 'vitest';
import {
	parseCoordinates,
	validateCoordinates,
	validateCoordinatesWithError,
	tryParseCoordinates,
	formatCoordinates,
	formatCoordinatesDMS,
	getParseErrorMessage
} from './coordinates.js';

describe('validateCoordinates', () => {
	it('accepts valid coordinates', () => {
		expect(validateCoordinates(0, 0)).toBe(true);
		expect(validateCoordinates(45.5231, -122.6765)).toBe(true);
		expect(validateCoordinates(-33.8688, 151.2093)).toBe(true);
	});

	it('accepts boundary values', () => {
		expect(validateCoordinates(90, 180)).toBe(true);
		expect(validateCoordinates(-90, -180)).toBe(true);
		expect(validateCoordinates(90, -180)).toBe(true);
		expect(validateCoordinates(-90, 180)).toBe(true);
	});

	it('rejects latitude out of range', () => {
		expect(validateCoordinates(90.1, 0)).toBe(false);
		expect(validateCoordinates(-90.1, 0)).toBe(false);
		expect(validateCoordinates(100, 0)).toBe(false);
		expect(validateCoordinates(-100, 0)).toBe(false);
	});

	it('rejects longitude out of range', () => {
		expect(validateCoordinates(0, 180.1)).toBe(false);
		expect(validateCoordinates(0, -180.1)).toBe(false);
		expect(validateCoordinates(0, 200)).toBe(false);
		expect(validateCoordinates(0, -200)).toBe(false);
	});
});

describe('validateCoordinatesWithError', () => {
	it('returns success for valid coordinates', () => {
		const result = validateCoordinatesWithError({ latitude: 45.5, longitude: -122.6 });
		expect(result.success).toBe(true);
		if (result.success) {
			expect(result.coordinates.latitude).toBe(45.5);
			expect(result.coordinates.longitude).toBe(-122.6);
		}
	});

	it('returns latitude error for out-of-range latitude', () => {
		const result = validateCoordinatesWithError({ latitude: 95, longitude: 0 });
		expect(result.success).toBe(false);
		if (!result.success && result.error.type === 'out-of-range') {
			expect(result.error.field).toBe('latitude');
			expect(result.error.value).toBe(95);
		}
	});

	it('returns longitude error for out-of-range longitude', () => {
		const result = validateCoordinatesWithError({ latitude: 0, longitude: 185 });
		expect(result.success).toBe(false);
		if (!result.success && result.error.type === 'out-of-range') {
			expect(result.error.field).toBe('longitude');
			expect(result.error.value).toBe(185);
		}
	});
});

describe('parseCoordinates', () => {
	describe('decimal degrees format', () => {
		it('parses comma-separated decimal coordinates', () => {
			const result = parseCoordinates('45.5231, -122.6765');
			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.coordinates.latitude).toBeCloseTo(45.5231, 4);
				expect(result.coordinates.longitude).toBeCloseTo(-122.6765, 4);
				expect(result.coordinates.format).toBe('decimal');
			}
		});

		it('parses space-separated decimal coordinates', () => {
			const result = parseCoordinates('45.5231 -122.6765');
			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.coordinates.latitude).toBeCloseTo(45.5231, 4);
				expect(result.coordinates.longitude).toBeCloseTo(-122.6765, 4);
			}
		});

		it('parses coordinates without negative sign (implied hemisphere)', () => {
			const result = parseCoordinates('45.5231N 122.6765W');
			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.coordinates.latitude).toBeCloseTo(45.5231, 4);
				expect(result.coordinates.longitude).toBeCloseTo(-122.6765, 4);
			}
		});

		it('parses southern hemisphere coordinates', () => {
			const result = parseCoordinates('-33.8688, 151.2093');
			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.coordinates.latitude).toBeCloseTo(-33.8688, 4);
				expect(result.coordinates.longitude).toBeCloseTo(151.2093, 4);
			}
		});
	});

	describe('degrees-minutes-seconds format', () => {
		it('parses DMS with symbols', () => {
			const result = parseCoordinates("45° 31' 23\" N, 122° 40' 35\" W");
			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.coordinates.latitude).toBeCloseTo(45.5231, 3);
				expect(result.coordinates.longitude).toBeCloseTo(-122.6764, 3);
				expect(result.coordinates.format).toBe('dms');
			}
		});

		it('parses DMS with direction letters', () => {
			const result = parseCoordinates('45 31 23 N 122 40 35 W');
			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.coordinates.latitude).toBeCloseTo(45.5231, 3);
				expect(result.coordinates.longitude).toBeCloseTo(-122.6764, 3);
			}
		});
	});

	describe('degrees-decimal-minutes format', () => {
		it('parses DDM format', () => {
			const result = parseCoordinates("45° 31.386' N, 122° 40.590' W");
			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.coordinates.latitude).toBeCloseTo(45.5231, 3);
				expect(result.coordinates.longitude).toBeCloseTo(-122.6765, 3);
				expect(result.coordinates.format).toBe('ddm');
			}
		});
	});

	describe('boundary conditions', () => {
		it('parses North Pole coordinates', () => {
			const result = parseCoordinates('90, 0');
			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.coordinates.latitude).toBe(90);
				expect(result.coordinates.longitude).toBe(0);
			}
		});

		it('parses South Pole coordinates', () => {
			const result = parseCoordinates('-90, 0');
			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.coordinates.latitude).toBe(-90);
				expect(result.coordinates.longitude).toBe(0);
			}
		});

		it('parses date line coordinates (positive)', () => {
			const result = parseCoordinates('0, 180');
			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.coordinates.latitude).toBe(0);
				expect(result.coordinates.longitude).toBe(180);
			}
		});

		it('parses date line coordinates (negative)', () => {
			const result = parseCoordinates('0, -180');
			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.coordinates.latitude).toBe(0);
				expect(result.coordinates.longitude).toBe(-180);
			}
		});

		it('parses origin (0, 0)', () => {
			const result = parseCoordinates('0, 0');
			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.coordinates.latitude).toBe(0);
				expect(result.coordinates.longitude).toBe(0);
			}
		});
	});

	describe('error cases', () => {
		it('rejects empty input', () => {
			const result = parseCoordinates('');
			expect(result.success).toBe(false);
			if (!result.success) {
				expect(result.error.type).toBe('invalid-format');
			}
		});

		it('rejects whitespace-only input', () => {
			const result = parseCoordinates('   ');
			expect(result.success).toBe(false);
			if (!result.success) {
				expect(result.error.type).toBe('invalid-format');
			}
		});

		it('rejects nonsense input', () => {
			const result = parseCoordinates('not coordinates at all');
			expect(result.success).toBe(false);
			if (!result.success) {
				expect(result.error.type).toBe('invalid-format');
			}
		});

		it('rejects latitude out of range', () => {
			const result = parseCoordinates('95, 0');
			expect(result.success).toBe(false);
			if (!result.success && result.error.type === 'out-of-range') {
				expect(result.error.field).toBe('latitude');
			}
		});

		it('rejects longitude out of range', () => {
			const result = parseCoordinates('0, 185');
			expect(result.success).toBe(false);
			if (!result.success && result.error.type === 'out-of-range') {
				expect(result.error.field).toBe('longitude');
			}
		});
	});

	describe('real-world locations', () => {
		it('parses Portland, OR coordinates', () => {
			const result = parseCoordinates('45.5152, -122.6784');
			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.coordinates.latitude).toBeCloseTo(45.5152, 4);
				expect(result.coordinates.longitude).toBeCloseTo(-122.6784, 4);
			}
		});

		it('parses Sydney, Australia coordinates', () => {
			const result = parseCoordinates('-33.8688, 151.2093');
			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.coordinates.latitude).toBeCloseTo(-33.8688, 4);
				expect(result.coordinates.longitude).toBeCloseTo(151.2093, 4);
			}
		});

		it('parses Tromsø, Norway (Arctic) coordinates', () => {
			const result = parseCoordinates('69.6496, 18.9560');
			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.coordinates.latitude).toBeCloseTo(69.6496, 4);
				expect(result.coordinates.longitude).toBeCloseTo(18.956, 4);
			}
		});

		it('parses Singapore coordinates', () => {
			const result = parseCoordinates('1.3521, 103.8198');
			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.coordinates.latitude).toBeCloseTo(1.3521, 4);
				expect(result.coordinates.longitude).toBeCloseTo(103.8198, 4);
			}
		});
	});
});

describe('tryParseCoordinates', () => {
	it('returns coordinates for valid input', () => {
		const result = tryParseCoordinates('45.5, -122.6');
		expect(result).not.toBeNull();
		expect(result?.latitude).toBeCloseTo(45.5, 1);
		expect(result?.longitude).toBeCloseTo(-122.6, 1);
	});

	it('returns null for invalid input', () => {
		expect(tryParseCoordinates('invalid')).toBeNull();
		expect(tryParseCoordinates('')).toBeNull();
	});
});

describe('formatCoordinates', () => {
	it('formats coordinates with default precision', () => {
		const result = formatCoordinates({ latitude: 45.523123456, longitude: -122.676543210 });
		expect(result).toBe('45.523123, -122.676543');
	});

	it('formats coordinates with custom precision', () => {
		const result = formatCoordinates({ latitude: 45.523123, longitude: -122.676543 }, 2);
		expect(result).toBe('45.52, -122.68');
	});

	it('formats negative coordinates correctly', () => {
		const result = formatCoordinates({ latitude: -33.8688, longitude: 151.2093 }, 4);
		expect(result).toBe('-33.8688, 151.2093');
	});
});

describe('formatCoordinatesDMS', () => {
	it('formats coordinates in DMS notation', () => {
		const result = formatCoordinatesDMS({ latitude: 45.5231, longitude: -122.6765 });
		expect(result).toContain('45°');
		expect(result).toContain('N');
		expect(result).toContain('122°');
		expect(result).toContain('W');
	});

	it('formats southern hemisphere correctly', () => {
		const result = formatCoordinatesDMS({ latitude: -33.8688, longitude: 151.2093 });
		expect(result).toContain('S');
		expect(result).toContain('E');
	});
});

describe('getParseErrorMessage', () => {
	it('returns helpful message for invalid format', () => {
		const message = getParseErrorMessage({ type: 'invalid-format', input: 'bad input' });
		expect(message).toContain('bad input');
		expect(message).toContain('45.5');
	});

	it('returns helpful message for latitude out of range', () => {
		const message = getParseErrorMessage({ type: 'out-of-range', field: 'latitude', value: 95 });
		expect(message).toContain('95');
		expect(message).toContain('-90');
		expect(message).toContain('90');
	});

	it('returns helpful message for longitude out of range', () => {
		const message = getParseErrorMessage({ type: 'out-of-range', field: 'longitude', value: 185 });
		expect(message).toContain('185');
		expect(message).toContain('-180');
		expect(message).toContain('180');
	});
});
