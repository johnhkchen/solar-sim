/**
 * Tests for timezone detection.
 *
 * These tests verify that getTimezone returns correct IANA timezone
 * identifiers for major cities around the world and handles edge cases
 * like international waters and polar regions appropriately.
 */

import { describe, it, expect } from 'vitest';
import { getTimezone, getTimezoneString } from './timezone.js';

describe('getTimezone', () => {
	describe('major cities', () => {
		it('returns America/Los_Angeles for Portland, OR', () => {
			const result = getTimezone({ latitude: 45.5152, longitude: -122.6784 });
			expect(result.timezone).toBe('America/Los_Angeles');
			expect(result.isEstimate).toBe(false);
		});

		it('returns America/New_York for New York City', () => {
			const result = getTimezone({ latitude: 40.7128, longitude: -74.006 });
			expect(result.timezone).toBe('America/New_York');
			expect(result.isEstimate).toBe(false);
		});

		it('returns Europe/London for London', () => {
			const result = getTimezone({ latitude: 51.5074, longitude: -0.1278 });
			expect(result.timezone).toBe('Europe/London');
			expect(result.isEstimate).toBe(false);
		});

		it('returns Europe/Paris for Paris', () => {
			const result = getTimezone({ latitude: 48.8566, longitude: 2.3522 });
			expect(result.timezone).toBe('Europe/Paris');
			expect(result.isEstimate).toBe(false);
		});

		it('returns Asia/Tokyo for Tokyo', () => {
			const result = getTimezone({ latitude: 35.6762, longitude: 139.6503 });
			expect(result.timezone).toBe('Asia/Tokyo');
			expect(result.isEstimate).toBe(false);
		});

		it('returns Australia/Sydney for Sydney', () => {
			const result = getTimezone({ latitude: -33.8688, longitude: 151.2093 });
			expect(result.timezone).toBe('Australia/Sydney');
			expect(result.isEstimate).toBe(false);
		});

		it('returns Asia/Singapore for Singapore', () => {
			const result = getTimezone({ latitude: 1.3521, longitude: 103.8198 });
			expect(result.timezone).toBe('Asia/Singapore');
			expect(result.isEstimate).toBe(false);
		});

		it('returns Africa/Johannesburg for Johannesburg', () => {
			const result = getTimezone({ latitude: -26.2041, longitude: 28.0473 });
			expect(result.timezone).toBe('Africa/Johannesburg');
			expect(result.isEstimate).toBe(false);
		});

		it('returns America/Sao_Paulo for São Paulo', () => {
			const result = getTimezone({ latitude: -23.5505, longitude: -46.6333 });
			expect(result.timezone).toBe('America/Sao_Paulo');
			expect(result.isEstimate).toBe(false);
		});
	});

	describe('arctic and polar regions', () => {
		it('returns Europe/Oslo for Tromsø, Norway (Arctic)', () => {
			const result = getTimezone({ latitude: 69.6496, longitude: 18.956 });
			expect(result.timezone).toBe('Europe/Oslo');
			expect(result.isEstimate).toBe(false);
		});

		it('returns America/Anchorage for Fairbanks, Alaska', () => {
			const result = getTimezone({ latitude: 64.8378, longitude: -147.7164 });
			expect(result.timezone).toBe('America/Anchorage');
			expect(result.isEstimate).toBe(false);
		});

		it('returns Pacific/Auckland for Christchurch, New Zealand (near Antarctic)', () => {
			const result = getTimezone({ latitude: -43.532, longitude: 172.6306 });
			expect(result.timezone).toBe('Pacific/Auckland');
			expect(result.isEstimate).toBe(false);
		});
	});

	describe('islands and remote locations', () => {
		it('returns Pacific/Honolulu for Honolulu, Hawaii', () => {
			const result = getTimezone({ latitude: 21.3069, longitude: -157.8583 });
			expect(result.timezone).toBe('Pacific/Honolulu');
			expect(result.isEstimate).toBe(false);
		});

		it('returns Atlantic/Reykjavik for Reykjavik, Iceland', () => {
			const result = getTimezone({ latitude: 64.1466, longitude: -21.9426 });
			expect(result.timezone).toBe('Atlantic/Reykjavik');
			expect(result.isEstimate).toBe(false);
		});
	});

	describe('timezone boundary regions', () => {
		it('returns America/Denver for Denver (Mountain Time)', () => {
			const result = getTimezone({ latitude: 39.7392, longitude: -104.9903 });
			expect(result.timezone).toBe('America/Denver');
			expect(result.isEstimate).toBe(false);
		});

		it('returns America/Chicago for Chicago (Central Time)', () => {
			const result = getTimezone({ latitude: 41.8781, longitude: -87.6298 });
			expect(result.timezone).toBe('America/Chicago');
			expect(result.isEstimate).toBe(false);
		});

		it('returns Europe/Berlin for Berlin (Central European Time)', () => {
			const result = getTimezone({ latitude: 52.52, longitude: 13.405 });
			expect(result.timezone).toBe('Europe/Berlin');
			expect(result.isEstimate).toBe(false);
		});
	});

	describe('edge cases', () => {
		it('handles coordinates at the prime meridian', () => {
			const result = getTimezone({ latitude: 51.4769, longitude: 0.0005 });
			expect(result.isEstimate).toBe(false);
			expect(result.timezone).toBeTruthy();
		});

		it('handles coordinates at the date line (Fiji)', () => {
			const result = getTimezone({ latitude: -17.7134, longitude: 178.065 });
			expect(result.timezone).toBe('Pacific/Fiji');
			expect(result.isEstimate).toBe(false);
		});

		it('handles coordinates at the equator (Quito, Ecuador)', () => {
			const result = getTimezone({ latitude: -0.1807, longitude: -78.4678 });
			expect(result.timezone).toBe('America/Guayaquil');
			expect(result.isEstimate).toBe(false);
		});

		it('returns Etc/GMT offset for mid-Atlantic Ocean', () => {
			const result = getTimezone({ latitude: 35.0, longitude: -40.0 });
			expect(result.timezone).toBe('Etc/GMT+3');
			expect(result.isEstimate).toBe(false);
		});

		it('returns timezone for mid-Pacific Ocean', () => {
			const result = getTimezone({ latitude: 0.0, longitude: -160.0 });
			expect(result.timezone).toBe('Pacific/Kiritimati');
			expect(result.isEstimate).toBe(false);
		});
	});
});

describe('getTimezoneString', () => {
	it('returns just the timezone string for valid coordinates', () => {
		const result = getTimezoneString({ latitude: 45.5152, longitude: -122.6784 });
		expect(result).toBe('America/Los_Angeles');
	});

	it('returns Etc/GMT offset for ocean coordinates', () => {
		const result = getTimezoneString({ latitude: 35.0, longitude: -40.0 });
		expect(result).toBe('Etc/GMT+3');
	});
});
