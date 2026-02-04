/**
 * Canopy tile fetching service for the Meta/WRI Global Forests dataset.
 *
 * This module fetches canopy height data from the public AWS S3 bucket that hosts
 * the Meta/WRI High Resolution Canopy Height Maps. The data lives in Cloud Optimized
 * GeoTIFF (COG) format, which allows efficient partial reads via HTTP range requests.
 *
 * The dataset uses Bing Maps QuadKey tile naming at zoom level 9, where each tile
 * covers roughly 80km x 80km at the equator. Files contain Float32 height values
 * in meters at 1-meter resolution.
 *
 * For more details on the dataset, see docs/knowledge/research/canopy-height-data.md
 */

import { fromUrl } from 'geotiff';
import type { GeoTIFFImage, Pool } from 'geotiff';
import type { LatLngBounds } from './tree-extraction.js';

/**
 * Base URL for the Meta/WRI canopy height tiles on AWS S3.
 * The bucket allows anonymous access via standard HTTPS requests.
 * Note: Direct S3 access doesn't work from browsers due to CORS restrictions,
 * so we use a proxy endpoint instead.
 */
const S3_BASE_URL = 'https://dataforgood-fb-data.s3.amazonaws.com/forests/v1/alsgedi_global_v6_float/chm';

/**
 * Whether we're running in a browser environment.
 */
const isBrowser = typeof window !== 'undefined';

/**
 * Zoom level for QuadKey tile naming. The Meta dataset uses zoom 9,
 * which produces tiles covering roughly 0.7° longitude by 0.5° latitude.
 */
const TILE_ZOOM = 9;

/**
 * Cache of fetched tiles to avoid redundant network requests.
 * Keys are QuadKey strings, values are the tile data or a pending promise.
 */
const tileCache = new Map<string, CanopyTile | Promise<CanopyTile | null>>();

/**
 * Maximum number of tiles to keep in cache. When exceeded, oldest entries are removed.
 */
const MAX_CACHE_SIZE = 20;

/**
 * GeoTIFF.js thread pool for parallel decoding. Created lazily on first use.
 */
let decodingPool: Pool | null = null;

/**
 * Result of fetching a canopy height tile.
 * Contains the height raster data along with metadata needed to interpret it.
 */
export interface CanopyTile {
	/** QuadKey identifier for this tile */
	quadKey: string;
	/** Geographic bounds of the entire tile */
	bounds: LatLngBounds;
	/** Width of the raster in pixels */
	width: number;
	/** Height of the raster in pixels */
	height: number;
	/** Height values in meters, row-major order starting from top-left */
	heights: Float32Array;
	/** Ground resolution in meters per pixel (approximately 1m for this dataset) */
	resolution: number;
	/** Timestamp when this tile was cached */
	cachedAt: number;
}

/**
 * Options for fetching canopy tiles.
 */
export interface TileFetchOptions {
	/**
	 * Buffer distance in degrees around the requested location.
	 * When fetching data for a location, this buffer determines how much
	 * surrounding area to include. Larger buffers capture more nearby trees
	 * but require reading more data.
	 * Default: 0.002 (~200m at mid-latitudes)
	 */
	bufferDegrees?: number;

	/**
	 * Whether to use the cache. Set to false to force a fresh fetch.
	 * Default: true
	 */
	useCache?: boolean;

	/**
	 * Maximum age in milliseconds for cached tiles.
	 * Tiles older than this are refetched.
	 * Default: 3600000 (1 hour)
	 */
	maxCacheAge?: number;
}

const DEFAULT_OPTIONS: Required<TileFetchOptions> = {
	bufferDegrees: 0.002,
	useCache: true,
	maxCacheAge: 3600000
};

/**
 * Converts latitude/longitude coordinates to a Bing Maps QuadKey at the specified zoom level.
 *
 * The algorithm first projects coordinates to Web Mercator pixel space, then converts to
 * tile coordinates, and finally interleaves the binary digits to produce the QuadKey string.
 *
 * @param lat - Latitude in degrees (-85.05 to 85.05 for Web Mercator)
 * @param lng - Longitude in degrees (-180 to 180)
 * @param zoom - Zoom level (9 for Meta dataset)
 * @returns QuadKey string, e.g. "021203020"
 */
export function latLngToQuadKey(lat: number, lng: number, zoom: number = TILE_ZOOM): string {
	// Clamp latitude to valid Web Mercator range
	const clampedLat = Math.max(-85.05112878, Math.min(85.05112878, lat));

	// Convert to normalized coordinates (0-1 range)
	const x = (lng + 180) / 360;
	const sinLat = Math.sin((clampedLat * Math.PI) / 180);
	const y = 0.5 - Math.log((1 + sinLat) / (1 - sinLat)) / (4 * Math.PI);

	// Scale to tile coordinates at the given zoom level
	const mapSize = 1 << zoom;
	const tileX = Math.floor(x * mapSize);
	const tileY = Math.floor(Math.max(0, Math.min(mapSize - 1, y * mapSize)));

	// Interleave bits to create QuadKey
	let quadKey = '';
	for (let i = zoom; i > 0; i--) {
		let digit = 0;
		const mask = 1 << (i - 1);
		if ((tileX & mask) !== 0) digit += 1;
		if ((tileY & mask) !== 0) digit += 2;
		quadKey += digit.toString();
	}

	return quadKey;
}

/**
 * Converts a QuadKey back to tile coordinates (X, Y) at its zoom level.
 *
 * @param quadKey - QuadKey string
 * @returns Object with tileX, tileY, and zoom level
 */
export function quadKeyToTileCoords(quadKey: string): { tileX: number; tileY: number; zoom: number } {
	let tileX = 0;
	let tileY = 0;
	const zoom = quadKey.length;

	for (let i = zoom; i > 0; i--) {
		const mask = 1 << (i - 1);
		const digit = parseInt(quadKey[zoom - i], 10);
		if ((digit & 1) !== 0) tileX |= mask;
		if ((digit & 2) !== 0) tileY |= mask;
	}

	return { tileX, tileY, zoom };
}

/**
 * Calculates the geographic bounds for a tile given its coordinates.
 *
 * @param tileX - Tile X coordinate
 * @param tileY - Tile Y coordinate
 * @param zoom - Zoom level
 * @returns LatLngBounds for the tile
 */
export function tileBounds(tileX: number, tileY: number, zoom: number): LatLngBounds {
	const mapSize = 1 << zoom;

	// Convert tile coordinates back to normalized coordinates
	const west = (tileX / mapSize) * 360 - 180;
	const east = ((tileX + 1) / mapSize) * 360 - 180;

	// Y coordinate uses Mercator projection
	const n1 = Math.PI - (2 * Math.PI * tileY) / mapSize;
	const north = (180 / Math.PI) * Math.atan(Math.sinh(n1));

	const n2 = Math.PI - (2 * Math.PI * (tileY + 1)) / mapSize;
	const south = (180 / Math.PI) * Math.atan(Math.sinh(n2));

	return { south, north, west, east };
}

/**
 * Gets the geographic bounds for a tile given its QuadKey.
 *
 * @param quadKey - QuadKey string
 * @returns LatLngBounds for the tile
 */
export function quadKeyBounds(quadKey: string): LatLngBounds {
	const { tileX, tileY, zoom } = quadKeyToTileCoords(quadKey);
	return tileBounds(tileX, tileY, zoom);
}

/**
 * Builds the URL for a canopy height tile.
 *
 * In browser environments, this returns a proxy endpoint URL to bypass CORS.
 * In server environments (SSR, tests), it returns the direct S3 URL.
 *
 * @param quadKey - QuadKey for the desired tile
 * @returns URL to fetch the GeoTIFF file
 */
export function buildTileUrl(quadKey: string): string {
	if (isBrowser) {
		// Use our proxy endpoint to bypass S3 CORS restrictions
		// geotiff.fromUrl needs an absolute URL
		return `${window.location.origin}/api/canopy/${quadKey}`;
	}
	// Direct S3 access for server-side usage
	return `${S3_BASE_URL}/${quadKey}.tif`;
}

/**
 * Returns QuadKeys for all tiles needed to cover a geographic region.
 *
 * When the requested area spans tile boundaries, this function returns
 * multiple QuadKeys so all relevant tiles can be fetched.
 *
 * @param bounds - Geographic bounds to cover
 * @returns Array of QuadKey strings
 */
export function getRequiredQuadKeys(bounds: LatLngBounds): string[] {
	// Get QuadKeys for the four corners
	const corners = [
		latLngToQuadKey(bounds.north, bounds.west),
		latLngToQuadKey(bounds.north, bounds.east),
		latLngToQuadKey(bounds.south, bounds.west),
		latLngToQuadKey(bounds.south, bounds.east)
	];

	// Deduplicate
	return [...new Set(corners)];
}

/**
 * Manages the tile cache size by evicting oldest entries when needed.
 */
function evictOldCacheEntries(): void {
	if (tileCache.size <= MAX_CACHE_SIZE) return;

	// Sort entries by cachedAt timestamp and remove oldest
	const entries = Array.from(tileCache.entries())
		.filter((entry): entry is [string, CanopyTile] => {
			const value = entry[1];
			return value !== null && !(value instanceof Promise) && 'cachedAt' in value;
		})
		.sort((a, b) => a[1].cachedAt - b[1].cachedAt);

	const toRemove = entries.slice(0, entries.length - MAX_CACHE_SIZE + 5);
	for (const [key] of toRemove) {
		tileCache.delete(key);
	}
}

/**
 * Fetches a single canopy height tile from S3.
 *
 * The function uses GeoTIFF.js to fetch the Cloud Optimized GeoTIFF via HTTP range
 * requests. This allows reading only the portions of the file that are needed,
 * which is much more efficient than downloading the entire 20MB file.
 *
 * The caching strategy is layered: first check the in-memory cache for fastest
 * access, then IndexedDB for persistent storage, and finally fetch from the network.
 *
 * @param quadKey - QuadKey identifying the tile to fetch
 * @param options - Fetch options
 * @returns CanopyTile data or null if the tile doesn't exist
 */
export async function fetchTile(
	quadKey: string,
	options: TileFetchOptions = {}
): Promise<CanopyTile | null> {
	const opts = { ...DEFAULT_OPTIONS, ...options };

	// Check in-memory cache first (fastest)
	if (opts.useCache) {
		const cached = tileCache.get(quadKey);
		if (cached) {
			if (cached instanceof Promise) {
				// Another fetch is in progress, wait for it
				return cached;
			}
			// Check if cached tile is still fresh
			if (Date.now() - cached.cachedAt < opts.maxCacheAge) {
				return cached;
			}
		}
	}

	// Create the fetch promise and cache it immediately to deduplicate concurrent requests
	const fetchPromise = (async (): Promise<CanopyTile | null> => {
		// Check IndexedDB cache before network request
		if (opts.useCache) {
			try {
				const { getCachedTile, setCachedTile } = await import('./tile-cache-idb.js');
				const idbCached = await getCachedTile(quadKey);
				if (idbCached && Date.now() - idbCached.cachedAt < opts.maxCacheAge) {
					// Update in-memory cache with IDB result
					tileCache.set(quadKey, idbCached);
					return idbCached;
				}
			} catch {
				// IDB not available or failed, continue to network fetch
			}
		}

		try {
			const url = buildTileUrl(quadKey);
			console.log('[TileService] Fetching tile from:', url);

			// Use fromUrl which handles COG format and range requests
			console.log('[TileService] Calling fromUrl...');
			const tiff = await fromUrl(url);
			console.log('[TileService] Got tiff, getting image...');
			const image: GeoTIFFImage = await tiff.getImage();
			console.log('[TileService] Got image');

			// Get raster dimensions
			const width = image.getWidth();
			const height = image.getHeight();
			console.log('[TileService] Image dimensions:', width, 'x', height);

			// Read the entire raster (for full tile)
			// For large tiles, consider using image.readRasters with window parameter
			console.log('[TileService] Reading rasters...');
			const rasters = await image.readRasters({
				pool: decodingPool ?? undefined
			});
			console.log('[TileService] Rasters read complete');

			// The canopy height is in the first (and only) band
			const heightData = rasters[0] as Float32Array;

			// Calculate bounds from QuadKey
			const bounds = quadKeyBounds(quadKey);

			// Calculate resolution in meters per pixel
			// At the equator, 1 degree ≈ 111km. Resolution varies with latitude.
			const centerLat = (bounds.north + bounds.south) / 2;
			const degreesPerPixelLat = (bounds.north - bounds.south) / height;
			const metersPerDegree = 111320 * Math.cos((centerLat * Math.PI) / 180);
			const resolution = degreesPerPixelLat * metersPerDegree;

			const tile: CanopyTile = {
				quadKey,
				bounds,
				width,
				height,
				heights: heightData,
				resolution,
				cachedAt: Date.now()
			};

			// Update in-memory cache with resolved tile
			tileCache.set(quadKey, tile);
			evictOldCacheEntries();

			// Persist to IndexedDB in the background (don't await)
			if (opts.useCache) {
				import('./tile-cache-idb.js')
					.then(({ setCachedTile }) => setCachedTile(tile))
					.catch(() => {
						// Ignore IDB errors, in-memory cache is sufficient
					});
			}

			return tile;
		} catch (error) {
			// Remove failed promise from cache
			tileCache.delete(quadKey);

			// Handle 404 or network errors gracefully
			if (error instanceof Error) {
				// Check for HTTP 404 (tile doesn't exist for this region)
				if (error.message.includes('404') || error.message.includes('Not Found')) {
					return null;
				}
				// Check for network errors
				if (error.message.includes('fetch') || error.message.includes('network')) {
					console.warn(`Failed to fetch canopy tile ${quadKey}: ${error.message}`);
					return null;
				}
			}
			throw error;
		}
	})();

	// Cache the promise to deduplicate concurrent requests
	tileCache.set(quadKey, fetchPromise);

	return fetchPromise;
}

/**
 * Extracts a subregion of height data from a tile.
 *
 * When the user requests data for a small area, this function extracts just
 * the relevant pixels from the full tile rather than returning everything.
 *
 * @param tile - The source tile
 * @param region - Geographic bounds of the desired subregion
 * @returns Object with heights array and dimensions, or null if no overlap
 */
export function extractSubregion(
	tile: CanopyTile,
	region: LatLngBounds
): { heights: Float32Array; width: number; height: number; bounds: LatLngBounds } | null {
	// Calculate pixel coordinates for the region
	const pixelsPerDegreeLng = tile.width / (tile.bounds.east - tile.bounds.west);
	const pixelsPerDegreeLat = tile.height / (tile.bounds.north - tile.bounds.south);

	// Clamp region to tile bounds
	const clampedWest = Math.max(region.west, tile.bounds.west);
	const clampedEast = Math.min(region.east, tile.bounds.east);
	const clampedNorth = Math.min(region.north, tile.bounds.north);
	const clampedSouth = Math.max(region.south, tile.bounds.south);

	// Check for valid overlap
	if (clampedWest >= clampedEast || clampedSouth >= clampedNorth) {
		return null;
	}

	// Convert to pixel coordinates
	// Note: pixel Y starts at top (north), increases southward
	const startX = Math.floor((clampedWest - tile.bounds.west) * pixelsPerDegreeLng);
	const endX = Math.ceil((clampedEast - tile.bounds.west) * pixelsPerDegreeLng);
	const startY = Math.floor((tile.bounds.north - clampedNorth) * pixelsPerDegreeLat);
	const endY = Math.ceil((tile.bounds.north - clampedSouth) * pixelsPerDegreeLat);

	const subWidth = endX - startX;
	const subHeight = endY - startY;

	if (subWidth <= 0 || subHeight <= 0) {
		return null;
	}

	// Extract the pixels
	const heights = new Float32Array(subWidth * subHeight);
	for (let y = 0; y < subHeight; y++) {
		for (let x = 0; x < subWidth; x++) {
			const srcIdx = (startY + y) * tile.width + (startX + x);
			heights[y * subWidth + x] = tile.heights[srcIdx];
		}
	}

	// Calculate actual bounds of extracted region
	const actualBounds: LatLngBounds = {
		west: tile.bounds.west + startX / pixelsPerDegreeLng,
		east: tile.bounds.west + endX / pixelsPerDegreeLng,
		north: tile.bounds.north - startY / pixelsPerDegreeLat,
		south: tile.bounds.north - endY / pixelsPerDegreeLat
	};

	return { heights, width: subWidth, height: subHeight, bounds: actualBounds };
}

/**
 * Fetches canopy height data for a specific location with surrounding buffer.
 *
 * This is the primary entry point for the tile service. Given a location,
 * it uses Cloud Optimized GeoTIFF (COG) windowed reads to fetch only the
 * small region needed, avoiding loading the entire 65536x65536 tile.
 *
 * @param lat - Latitude of the location
 * @param lng - Longitude of the location
 * @param options - Fetch options including buffer size
 * @returns Height raster for the region, or null if no data available
 */
export async function fetchCanopyData(
	lat: number,
	lng: number,
	options: TileFetchOptions = {}
): Promise<{
	heights: Float32Array;
	width: number;
	height: number;
	bounds: LatLngBounds;
	resolution: number;
} | null> {
	const opts = { ...DEFAULT_OPTIONS, ...options };

	// Create bounding box around the location
	const region: LatLngBounds = {
		south: lat - opts.bufferDegrees,
		north: lat + opts.bufferDegrees,
		west: lng - opts.bufferDegrees,
		east: lng + opts.bufferDegrees
	};

	// Get the quadkey for the center location
	const quadKey = latLngToQuadKey(lat, lng);
	const url = buildTileUrl(quadKey);

	console.log('[TileService] fetchCanopyData for region:', region);
	console.log('[TileService] Using quadKey:', quadKey, 'url:', url);

	try {
		// Open the COG file
		const tiff = await fromUrl(url);
		const image: GeoTIFFImage = await tiff.getImage();

		// Get full image dimensions and bounds
		const fullWidth = image.getWidth();
		const fullHeight = image.getHeight();
		const tileBounds = quadKeyBounds(quadKey);

		console.log('[TileService] Full tile:', fullWidth, 'x', fullHeight);
		console.log('[TileService] Tile bounds:', tileBounds);

		// Calculate pixel coordinates for the requested region
		const degreesPerPixelX = (tileBounds.east - tileBounds.west) / fullWidth;
		const degreesPerPixelY = (tileBounds.north - tileBounds.south) / fullHeight;

		// Convert geographic bounds to pixel coordinates
		// Note: Y is inverted (north is at top, row 0)
		const pixelLeft = Math.floor((region.west - tileBounds.west) / degreesPerPixelX);
		const pixelRight = Math.ceil((region.east - tileBounds.west) / degreesPerPixelX);
		const pixelTop = Math.floor((tileBounds.north - region.north) / degreesPerPixelY);
		const pixelBottom = Math.ceil((tileBounds.north - region.south) / degreesPerPixelY);

		// Clamp to valid range
		const x0 = Math.max(0, pixelLeft);
		const x1 = Math.min(fullWidth, pixelRight);
		const y0 = Math.max(0, pixelTop);
		const y1 = Math.min(fullHeight, pixelBottom);

		const windowWidth = x1 - x0;
		const windowHeight = y1 - y0;

		console.log('[TileService] Reading window:', x0, y0, 'to', x1, y1, `(${windowWidth}x${windowHeight})`);

		if (windowWidth <= 0 || windowHeight <= 0) {
			console.log('[TileService] Region outside tile bounds');
			return null;
		}

		// Read only the windowed region using COG's efficient partial read
		const rasters = await image.readRasters({
			window: [x0, y0, x1, y1],
			pool: decodingPool ?? undefined
		});

		const heightData = rasters[0] as Float32Array;
		console.log('[TileService] Read', heightData.length, 'height values');

		// Calculate the actual bounds of the pixels we read
		const actualBounds: LatLngBounds = {
			west: tileBounds.west + x0 * degreesPerPixelX,
			east: tileBounds.west + x1 * degreesPerPixelX,
			north: tileBounds.north - y0 * degreesPerPixelY,
			south: tileBounds.north - y1 * degreesPerPixelY
		};

		// Resolution in meters per pixel
		const centerLat = (actualBounds.north + actualBounds.south) / 2;
		const metersPerDegree = 111320 * Math.cos((centerLat * Math.PI) / 180);
		const resolution = degreesPerPixelX * metersPerDegree;

		return {
			heights: heightData,
			width: windowWidth,
			height: windowHeight,
			bounds: actualBounds,
			resolution
		};
	} catch (error) {
		if (error instanceof Error) {
			if (error.message.includes('404') || error.message.includes('Not Found')) {
				console.log('[TileService] No tile data for this location');
				return null;
			}
		}
		console.error('[TileService] Error fetching canopy data:', error);
		throw error;
	}
}

/**
 * Stitches multiple tiles together to form a single continuous raster.
 *
 * This is needed when the requested region spans tile boundaries. The function
 * creates a new raster covering the full region and copies pixels from each
 * tile into the appropriate positions.
 *
 * @param tiles - Array of tiles to stitch
 * @param region - Target region to cover
 * @returns Combined height raster
 */
function stitchTiles(
	tiles: CanopyTile[],
	region: LatLngBounds
): { heights: Float32Array; width: number; height: number; bounds: LatLngBounds; resolution: number } | null {
	if (tiles.length === 0) return null;

	// Use the resolution from the first tile (they should all be the same)
	const resolution = tiles[0].resolution;

	// Calculate output raster dimensions based on region size and resolution
	// Use degrees to meters conversion at the center latitude
	const centerLat = (region.north + region.south) / 2;
	const metersPerDegreeLat = 111320;
	const metersPerDegreeLng = 111320 * Math.cos((centerLat * Math.PI) / 180);

	const widthMeters = (region.east - region.west) * metersPerDegreeLng;
	const heightMeters = (region.north - region.south) * metersPerDegreeLat;

	const width = Math.ceil(widthMeters / resolution);
	const height = Math.ceil(heightMeters / resolution);

	if (width <= 0 || height <= 0) return null;

	// Create output raster initialized to 0 (no vegetation)
	const heights = new Float32Array(width * height);

	// Copy pixels from each tile
	const pixelsPerDegreeLng = width / (region.east - region.west);
	const pixelsPerDegreeLat = height / (region.north - region.south);

	for (const tile of tiles) {
		// Find overlap between tile and region
		const overlapWest = Math.max(tile.bounds.west, region.west);
		const overlapEast = Math.min(tile.bounds.east, region.east);
		const overlapNorth = Math.min(tile.bounds.north, region.north);
		const overlapSouth = Math.max(tile.bounds.south, region.south);

		if (overlapWest >= overlapEast || overlapSouth >= overlapNorth) continue;

		// Calculate pixel ranges in both source and destination
		const tilePixelsPerDegreeLng = tile.width / (tile.bounds.east - tile.bounds.west);
		const tilePixelsPerDegreeLat = tile.height / (tile.bounds.north - tile.bounds.south);

		// Source pixel range (in tile)
		const srcStartX = Math.floor((overlapWest - tile.bounds.west) * tilePixelsPerDegreeLng);
		const srcEndX = Math.ceil((overlapEast - tile.bounds.west) * tilePixelsPerDegreeLng);
		const srcStartY = Math.floor((tile.bounds.north - overlapNorth) * tilePixelsPerDegreeLat);
		const srcEndY = Math.ceil((tile.bounds.north - overlapSouth) * tilePixelsPerDegreeLat);

		// Destination pixel range (in output)
		const dstStartX = Math.floor((overlapWest - region.west) * pixelsPerDegreeLng);
		const dstStartY = Math.floor((region.north - overlapNorth) * pixelsPerDegreeLat);

		// Copy pixels with resampling if resolutions differ
		const srcWidth = srcEndX - srcStartX;
		const srcHeight = srcEndY - srcStartY;
		const dstWidth = Math.ceil((overlapEast - overlapWest) * pixelsPerDegreeLng);
		const dstHeight = Math.ceil((overlapNorth - overlapSouth) * pixelsPerDegreeLat);

		for (let dy = 0; dy < dstHeight; dy++) {
			for (let dx = 0; dx < dstWidth; dx++) {
				// Map destination pixel to source pixel (nearest neighbor)
				const sx = srcStartX + Math.floor((dx * srcWidth) / dstWidth);
				const sy = srcStartY + Math.floor((dy * srcHeight) / dstHeight);

				if (sx >= 0 && sx < tile.width && sy >= 0 && sy < tile.height) {
					const dstIdx = (dstStartY + dy) * width + (dstStartX + dx);
					const srcIdx = sy * tile.width + sx;

					if (dstIdx >= 0 && dstIdx < heights.length) {
						heights[dstIdx] = tile.heights[srcIdx];
					}
				}
			}
		}
	}

	return { heights, width, height, bounds: region, resolution };
}

/**
 * Clears the tile cache entirely.
 * Useful for testing or when the user wants to force fresh data.
 */
export function clearCache(): void {
	tileCache.clear();
}

/**
 * Returns cache statistics for debugging/monitoring.
 */
export function getCacheStats(): { size: number; maxSize: number; keys: string[] } {
	return {
		size: tileCache.size,
		maxSize: MAX_CACHE_SIZE,
		keys: Array.from(tileCache.keys())
	};
}
