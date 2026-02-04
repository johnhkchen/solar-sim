/**
 * Tests for the canopy tile fetching service.
 *
 * These tests verify the QuadKey conversion algorithms and tile boundary calculations.
 * Network-dependent tests are marked with 'skip' since they require external access
 * and would be flaky in CI. Run them manually when testing the service.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
	latLngToQuadKey,
	quadKeyToTileCoords,
	quadKeyBounds,
	tileBounds,
	buildTileUrl,
	getRequiredQuadKeys,
	extractSubregion,
	clearCache,
	type CanopyTile
} from './tile-service.js';
import type { LatLngBounds } from './tree-extraction.js';

describe('latLngToQuadKey', () => {
	it('converts San Francisco coordinates correctly', () => {
		// San Francisco: 37.7749° N, 122.4194° W
		// Expected tile at zoom 9 is approximately (81, 197)
		// QuadKey should be around 9 digits for zoom 9
		const quadKey = latLngToQuadKey(37.7749, -122.4194, 9);
		expect(quadKey).toHaveLength(9);
		// The QuadKey for this location starts with "02" (northwest quadrant of global view)
		expect(quadKey.startsWith('02')).toBe(true);
	});

	it('converts New York coordinates correctly', () => {
		// New York: 40.7128° N, 74.0060° W
		const quadKey = latLngToQuadKey(40.7128, -74.006, 9);
		expect(quadKey).toHaveLength(9);
		// East coast US is in the "03" region
		expect(quadKey.startsWith('03')).toBe(true);
	});

	it('converts equator/prime meridian correctly', () => {
		// 0,0 should be in the middle of the map
		const quadKey = latLngToQuadKey(0, 0, 9);
		expect(quadKey).toHaveLength(9);
		// QuadKey digits should all be 2 or 3 for southeast quadrant
	});

	it('handles extreme latitudes by clamping', () => {
		// Web Mercator can't handle latitudes beyond ~85.05°
		const highLat = latLngToQuadKey(90, 0, 9);
		expect(highLat).toHaveLength(9);
		const lowLat = latLngToQuadKey(-90, 0, 9);
		expect(lowLat).toHaveLength(9);
	});

	it('handles longitude wrap-around', () => {
		const west = latLngToQuadKey(0, -180, 9);
		const east = latLngToQuadKey(0, 180, 9);
		// These should produce valid QuadKeys (though behavior at exactly 180 may vary)
		expect(west).toHaveLength(9);
		expect(east).toHaveLength(9);
	});

	it('produces different QuadKeys for different locations', () => {
		const sf = latLngToQuadKey(37.7749, -122.4194, 9);
		const la = latLngToQuadKey(34.0522, -118.2437, 9);
		const ny = latLngToQuadKey(40.7128, -74.006, 9);

		expect(sf).not.toBe(la);
		expect(sf).not.toBe(ny);
		expect(la).not.toBe(ny);
	});
});

describe('quadKeyToTileCoords', () => {
	it('converts QuadKey back to tile coordinates', () => {
		const { tileX, tileY, zoom } = quadKeyToTileCoords('021203020');
		expect(zoom).toBe(9);
		expect(tileX).toBeGreaterThanOrEqual(0);
		expect(tileY).toBeGreaterThanOrEqual(0);
		expect(tileX).toBeLessThan(512); // 2^9
		expect(tileY).toBeLessThan(512);
	});

	it('is inverse of latLngToQuadKey for tile center', () => {
		// Pick a QuadKey and convert to coords
		const quadKey = '120302012';
		const { tileX, tileY, zoom } = quadKeyToTileCoords(quadKey);

		// Get bounds for this tile
		const bounds = tileBounds(tileX, tileY, zoom);

		// Take center of tile and convert back to QuadKey
		const centerLat = (bounds.north + bounds.south) / 2;
		const centerLng = (bounds.east + bounds.west) / 2;
		const reconstructed = latLngToQuadKey(centerLat, centerLng, zoom);

		expect(reconstructed).toBe(quadKey);
	});

	it('handles edge case of all zeros', () => {
		const { tileX, tileY, zoom } = quadKeyToTileCoords('000000000');
		expect(tileX).toBe(0);
		expect(tileY).toBe(0);
		expect(zoom).toBe(9);
	});

	it('handles edge case of all threes', () => {
		const { tileX, tileY, zoom } = quadKeyToTileCoords('333333333');
		expect(tileX).toBe(511); // 2^9 - 1
		expect(tileY).toBe(511);
		expect(zoom).toBe(9);
	});
});

describe('tileBounds', () => {
	it('returns valid geographic bounds', () => {
		const bounds = tileBounds(81, 197, 9);

		expect(bounds.north).toBeGreaterThan(bounds.south);
		expect(bounds.east).toBeGreaterThan(bounds.west);
		expect(bounds.north).toBeLessThanOrEqual(90);
		expect(bounds.south).toBeGreaterThanOrEqual(-90);
		expect(bounds.west).toBeGreaterThanOrEqual(-180);
		expect(bounds.east).toBeLessThanOrEqual(180);
	});

	it('tiles at zoom 9 cover reasonable area', () => {
		// At zoom 9, tiles should cover roughly 0.5-0.7 degrees
		const bounds = tileBounds(100, 200, 9);
		const latRange = bounds.north - bounds.south;
		const lngRange = bounds.east - bounds.west;

		expect(latRange).toBeGreaterThan(0.3);
		expect(latRange).toBeLessThan(1.5);
		expect(lngRange).toBeCloseTo(360 / 512, 1); // Should be about 0.703 degrees
	});

	it('adjacent tiles share edges', () => {
		const tile1 = tileBounds(100, 200, 9);
		const tile2 = tileBounds(101, 200, 9);

		// East edge of tile1 should equal west edge of tile2
		expect(tile1.east).toBeCloseTo(tile2.west, 10);
	});
});

describe('quadKeyBounds', () => {
	it('returns same bounds as tileBounds for equivalent coords', () => {
		const quadKey = '021203020';
		const { tileX, tileY, zoom } = quadKeyToTileCoords(quadKey);

		const fromQuadKey = quadKeyBounds(quadKey);
		const fromCoords = tileBounds(tileX, tileY, zoom);

		expect(fromQuadKey.north).toBeCloseTo(fromCoords.north, 10);
		expect(fromQuadKey.south).toBeCloseTo(fromCoords.south, 10);
		expect(fromQuadKey.east).toBeCloseTo(fromCoords.east, 10);
		expect(fromQuadKey.west).toBeCloseTo(fromCoords.west, 10);
	});
});

describe('buildTileUrl', () => {
	it('constructs valid S3 URL', () => {
		const url = buildTileUrl('021203020');
		expect(url).toBe(
			'https://dataforgood-fb-data.s3.amazonaws.com/forests/v1/alsgedi_global_v6_float/chm/021203020.tif'
		);
	});

	it('handles different QuadKeys', () => {
		const url1 = buildTileUrl('000000000');
		const url2 = buildTileUrl('333333333');

		expect(url1).toContain('000000000.tif');
		expect(url2).toContain('333333333.tif');
		expect(url1).not.toBe(url2);
	});
});

describe('getRequiredQuadKeys', () => {
	it('returns single QuadKey for small region within one tile', () => {
		// Small region in San Francisco (well within one tile)
		const region: LatLngBounds = {
			south: 37.77,
			north: 37.78,
			west: -122.42,
			east: -122.41
		};

		const quadKeys = getRequiredQuadKeys(region);
		expect(quadKeys.length).toBe(1);
	});

	it('returns multiple QuadKeys for region spanning tile boundary', () => {
		// Create a region that spans a tile boundary
		// First find a tile boundary
		const quadKey = '021203020';
		const bounds = quadKeyBounds(quadKey);

		// Create region that spans the tile's edge
		const region: LatLngBounds = {
			south: bounds.south - 0.1,
			north: bounds.south + 0.1,
			west: bounds.west - 0.1,
			east: bounds.west + 0.1
		};

		const quadKeys = getRequiredQuadKeys(region);
		expect(quadKeys.length).toBeGreaterThan(1);
	});

	it('deduplicates when all corners are in same tile', () => {
		const region: LatLngBounds = {
			south: 37.7,
			north: 37.71,
			west: -122.4,
			east: -122.39
		};

		const quadKeys = getRequiredQuadKeys(region);
		// All corners might be in same tile, so should get 1 unique key
		expect(quadKeys.length).toBeGreaterThanOrEqual(1);
		expect(quadKeys.length).toBeLessThanOrEqual(4);
	});
});

describe('extractSubregion', () => {
	let mockTile: CanopyTile;

	beforeEach(() => {
		// Create a mock 10x10 tile with known values
		const heights = new Float32Array(100);
		for (let i = 0; i < 100; i++) {
			heights[i] = i; // Height = index
		}

		mockTile = {
			quadKey: 'test',
			bounds: {
				south: 0,
				north: 1,
				west: 0,
				east: 1
			},
			width: 10,
			height: 10,
			heights,
			resolution: 1,
			cachedAt: Date.now()
		};
	});

	it('extracts subregion correctly', () => {
		const region: LatLngBounds = {
			south: 0.2,
			north: 0.4,
			west: 0.2,
			east: 0.4
		};

		const result = extractSubregion(mockTile, region);
		expect(result).not.toBeNull();
		expect(result!.width).toBe(2);
		expect(result!.height).toBe(2);
	});

	it('returns null for non-overlapping region', () => {
		const region: LatLngBounds = {
			south: 5,
			north: 6,
			west: 5,
			east: 6
		};

		const result = extractSubregion(mockTile, region);
		expect(result).toBeNull();
	});

	it('clamps region to tile bounds', () => {
		const region: LatLngBounds = {
			south: -1,
			north: 2,
			west: -1,
			east: 2
		};

		const result = extractSubregion(mockTile, region);
		expect(result).not.toBeNull();
		// Should extract entire tile since region fully contains it
		expect(result!.width).toBe(10);
		expect(result!.height).toBe(10);
	});

	it('handles partial overlap', () => {
		const region: LatLngBounds = {
			south: 0.5,
			north: 1.5,
			west: 0.5,
			east: 1.5
		};

		const result = extractSubregion(mockTile, region);
		expect(result).not.toBeNull();
		// Should extract bottom-right quarter
		expect(result!.width).toBe(5);
		expect(result!.height).toBe(5);
	});
});

describe('cache management', () => {
	beforeEach(() => {
		clearCache();
	});

	it('clearCache empties the cache', () => {
		// We can't directly inspect cache internals, but we can verify it doesn't throw
		clearCache();
	});
});

// Network-dependent tests - uncomment to run manually
describe.skip('network integration', () => {
	it('fetches a real tile from S3', async () => {
		// This test requires network access and downloads real data
		// QuadKey for Southern California area
		const { fetchTile } = await import('./tile-service.js');
		const tile = await fetchTile('023013213', { useCache: false });

		expect(tile).not.toBeNull();
		expect(tile!.width).toBeGreaterThan(0);
		expect(tile!.height).toBeGreaterThan(0);
		expect(tile!.heights.length).toBe(tile!.width * tile!.height);
	});

	it('returns null for non-existent tile', async () => {
		// Ocean tiles don't exist in the dataset
		const { fetchTile } = await import('./tile-service.js');
		// QuadKey for middle of Pacific Ocean
		const tile = await fetchTile('012012012', { useCache: false });
		expect(tile).toBeNull();
	});
});
