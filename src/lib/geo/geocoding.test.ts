/**
 * Tests for geocoding integration.
 *
 * These tests mock the fetch API to verify correct behavior without
 * hitting live Nominatim endpoints. They cover successful lookups,
 * rate limiting, network errors, and empty results.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
	geocodeAddress,
	getGeocodingErrorMessage,
	resetRateLimiter
} from './geocoding.js';

const mockFetch = vi.fn();

beforeEach(() => {
	vi.stubGlobal('fetch', mockFetch);
	resetRateLimiter();
});

afterEach(() => {
	vi.unstubAllGlobals();
	vi.clearAllMocks();
});

/**
 * Creates a mock Nominatim response for a single place.
 */
function createNominatimResponse(places: Array<{
	lat: string;
	lon: string;
	display_name: string;
}>) {
	return places.map((place, index) => ({
		place_id: index + 1,
		licence: 'Data © OpenStreetMap contributors',
		osm_type: 'node',
		osm_id: 12345 + index,
		lat: place.lat,
		lon: place.lon,
		display_name: place.display_name,
		class: 'place',
		type: 'city',
		importance: 0.8 - index * 0.1,
		boundingbox: ['45.0', '46.0', '-123.0', '-122.0']
	}));
}

describe('geocodeAddress', () => {
	describe('successful lookups', () => {
		it('returns location results for valid query', async () => {
			const mockResponse = createNominatimResponse([
				{
					lat: '45.5152',
					lon: '-122.6784',
					display_name: 'Portland, Multnomah County, Oregon, USA'
				}
			]);

			mockFetch.mockResolvedValueOnce({
				ok: true,
				status: 200,
				json: () => Promise.resolve(mockResponse)
			});

			const result = await geocodeAddress('Portland, OR');

			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.results).toHaveLength(1);
				expect(result.results[0].location.latitude).toBeCloseTo(45.5152, 4);
				expect(result.results[0].location.longitude).toBeCloseTo(-122.6784, 4);
				expect(result.results[0].location.name).toBe('Portland, Multnomah County, Oregon, USA');
				expect(result.results[0].location.timezone).toBe('America/Los_Angeles');
				expect(result.results[0].attribution).toContain('OpenStreetMap');
			}
		});

		it('returns multiple results when available', async () => {
			const mockResponse = createNominatimResponse([
				{
					lat: '45.5152',
					lon: '-122.6784',
					display_name: 'Portland, Oregon, USA'
				},
				{
					lat: '43.6591',
					lon: '-70.2568',
					display_name: 'Portland, Maine, USA'
				}
			]);

			mockFetch.mockResolvedValueOnce({
				ok: true,
				status: 200,
				json: () => Promise.resolve(mockResponse)
			});

			const result = await geocodeAddress('Portland');

			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.results).toHaveLength(2);
				expect(result.results[0].location.name).toContain('Oregon');
				expect(result.results[1].location.name).toContain('Maine');
			}
		});

		it('respects limit option', async () => {
			mockFetch.mockResolvedValueOnce({
				ok: true,
				status: 200,
				json: () => Promise.resolve([])
			});

			await geocodeAddress('Test', { limit: 3 });

			expect(mockFetch).toHaveBeenCalledTimes(1);
			const url = mockFetch.mock.calls[0][0] as string;
			expect(url).toContain('limit=3');
		});

		it('includes proper User-Agent header', async () => {
			mockFetch.mockResolvedValueOnce({
				ok: true,
				status: 200,
				json: () => Promise.resolve([])
			});

			await geocodeAddress('Test');

			expect(mockFetch).toHaveBeenCalledTimes(1);
			const options = mockFetch.mock.calls[0][1] as RequestInit;
			expect(options.headers).toBeDefined();
			const headers = options.headers as Record<string, string>;
			expect(headers['User-Agent']).toContain('SolarSim');
		});

		it('includes timezone detection for results', async () => {
			const mockResponse = createNominatimResponse([
				{
					lat: '35.6762',
					lon: '139.6503',
					display_name: 'Tokyo, Japan'
				}
			]);

			mockFetch.mockResolvedValueOnce({
				ok: true,
				status: 200,
				json: () => Promise.resolve(mockResponse)
			});

			const result = await geocodeAddress('Tokyo');

			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.results[0].location.timezone).toBe('Asia/Tokyo');
			}
		});
	});

	describe('error handling', () => {
		it('returns no-results error for empty query', async () => {
			const result = await geocodeAddress('   ');

			expect(result.success).toBe(false);
			if (!result.success) {
				expect(result.error.type).toBe('no-results');
			}
		});

		it('returns no-results error when API returns empty array', async () => {
			mockFetch.mockResolvedValueOnce({
				ok: true,
				status: 200,
				json: () => Promise.resolve([])
			});

			const result = await geocodeAddress('NonexistentPlace12345');

			expect(result.success).toBe(false);
			if (!result.success) {
				expect(result.error.type).toBe('no-results');
				if (result.error.type === 'no-results') {
					expect(result.error.query).toBe('NonexistentPlace12345');
				}
			}
		});

		it('returns network-error for fetch failures', async () => {
			mockFetch.mockRejectedValueOnce(new Error('Network request failed'));

			const result = await geocodeAddress('Portland');

			expect(result.success).toBe(false);
			if (!result.success) {
				expect(result.error.type).toBe('network-error');
				if (result.error.type === 'network-error') {
					expect(result.error.message).toContain('Network request failed');
				}
			}
		});

		it('returns rate-limited error for 429 response', async () => {
			mockFetch.mockResolvedValueOnce({
				ok: false,
				status: 429,
				statusText: 'Too Many Requests',
				headers: {
					get: (name: string) => name === 'Retry-After' ? '5' : null
				}
			});

			const result = await geocodeAddress('Portland');

			expect(result.success).toBe(false);
			if (!result.success) {
				expect(result.error.type).toBe('rate-limited');
				if (result.error.type === 'rate-limited') {
					expect(result.error.retryAfter).toBe(5000);
				}
			}
		});

		it('returns network-error for non-OK HTTP responses', async () => {
			mockFetch.mockResolvedValueOnce({
				ok: false,
				status: 500,
				statusText: 'Internal Server Error'
			});

			const result = await geocodeAddress('Portland');

			expect(result.success).toBe(false);
			if (!result.success) {
				expect(result.error.type).toBe('network-error');
				if (result.error.type === 'network-error') {
					expect(result.error.message).toContain('500');
				}
			}
		});

		it('returns invalid-response error for non-JSON response', async () => {
			mockFetch.mockResolvedValueOnce({
				ok: true,
				status: 200,
				json: () => Promise.reject(new Error('Invalid JSON'))
			});

			const result = await geocodeAddress('Portland');

			expect(result.success).toBe(false);
			if (!result.success) {
				expect(result.error.type).toBe('invalid-response');
			}
		});

		it('returns invalid-response error for non-array response', async () => {
			mockFetch.mockResolvedValueOnce({
				ok: true,
				status: 200,
				json: () => Promise.resolve({ error: 'unexpected format' })
			});

			const result = await geocodeAddress('Portland');

			expect(result.success).toBe(false);
			if (!result.success) {
				expect(result.error.type).toBe('invalid-response');
			}
		});
	});

	describe('rate limiting', () => {
		it('enforces rate limit between requests', async () => {
			const mockResponse = createNominatimResponse([
				{ lat: '45.5', lon: '-122.6', display_name: 'Test' }
			]);

			mockFetch.mockResolvedValue({
				ok: true,
				status: 200,
				json: () => Promise.resolve(mockResponse)
			});

			const startTime = Date.now();

			await geocodeAddress('First');
			await geocodeAddress('Second');

			const elapsed = Date.now() - startTime;

			expect(elapsed).toBeGreaterThanOrEqual(900);
			expect(mockFetch).toHaveBeenCalledTimes(2);
		});
	});
});

describe('getGeocodingErrorMessage', () => {
	it('returns friendly message for rate-limited error', () => {
		const message = getGeocodingErrorMessage({ type: 'rate-limited', retryAfter: 1000 });
		expect(message).toContain('wait');
	});

	it('returns friendly message for network-error', () => {
		const message = getGeocodingErrorMessage({ type: 'network-error', message: 'Connection failed' });
		expect(message).toContain('Unable to reach');
		expect(message).toContain('Connection failed');
	});

	it('returns friendly message for no-results error', () => {
		const message = getGeocodingErrorMessage({ type: 'no-results', query: 'Atlantis' });
		expect(message).toContain('No locations found');
		expect(message).toContain('Atlantis');
	});

	it('returns friendly message for invalid-response error', () => {
		const message = getGeocodingErrorMessage({ type: 'invalid-response', message: 'Bad data' });
		expect(message).toContain('invalid response');
	});
});
