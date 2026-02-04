/**
 * IndexedDB-based tile cache for persistent storage of canopy height tiles.
 *
 * This module provides longer-term caching of GeoTIFF tiles beyond the in-memory cache.
 * Tiles are stored in IndexedDB with their height data compressed to reduce storage use.
 * The cache automatically evicts old entries when the size limit is exceeded.
 *
 * The cache works alongside the in-memory cache: check memory first for fastest access,
 * then IDB, then finally fetch from the network.
 */

import { browser } from '$app/environment';
import type { CanopyTile } from './tile-service.js';
import type { LatLngBounds } from './tree-extraction.js';

/**
 * Name of the IndexedDB database.
 */
const DB_NAME = 'solar-sim-canopy-cache';

/**
 * Database version. Increment when changing the schema.
 */
const DB_VERSION = 1;

/**
 * Object store name for tiles.
 */
const TILES_STORE = 'tiles';

/**
 * Maximum number of tiles to store. When exceeded, oldest tiles are evicted.
 */
const MAX_TILES = 50;

/**
 * Maximum age for cached tiles in milliseconds (7 days).
 * Tiles older than this are evicted on next access.
 */
const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Stored tile format (without the heights array, which is stored separately).
 */
interface StoredTileMetadata {
	quadKey: string;
	bounds: LatLngBounds;
	width: number;
	height: number;
	resolution: number;
	cachedAt: number;
}

/**
 * Full stored tile with heights as ArrayBuffer for IndexedDB storage.
 */
interface StoredTile extends StoredTileMetadata {
	heights: ArrayBuffer;
}

// Database instance, created lazily
let dbPromise: Promise<IDBDatabase> | null = null;

/**
 * Opens or creates the IndexedDB database.
 * Returns null if IndexedDB isn't available.
 */
function openDatabase(): Promise<IDBDatabase> | null {
	if (!browser) return null;

	if (dbPromise) return dbPromise;

	try {
		dbPromise = new Promise((resolve, reject) => {
			const request = indexedDB.open(DB_NAME, DB_VERSION);

			request.onerror = () => {
				console.warn('Failed to open IndexedDB for tile cache:', request.error);
				reject(request.error);
			};

			request.onsuccess = () => {
				resolve(request.result);
			};

			request.onupgradeneeded = (event) => {
				const db = (event.target as IDBOpenDBRequest).result;

				// Create tiles store with quadKey as key and cachedAt index for eviction
				if (!db.objectStoreNames.contains(TILES_STORE)) {
					const store = db.createObjectStore(TILES_STORE, { keyPath: 'quadKey' });
					store.createIndex('cachedAt', 'cachedAt', { unique: false });
				}
			};
		});

		return dbPromise;
	} catch (error) {
		console.warn('IndexedDB not available for tile cache:', error);
		return null;
	}
}

/**
 * Retrieves a tile from IndexedDB cache.
 *
 * @param quadKey - QuadKey of the tile to retrieve
 * @returns The cached tile or null if not found/expired
 */
export async function getCachedTile(quadKey: string): Promise<CanopyTile | null> {
	const db = openDatabase();
	if (!db) return null;

	try {
		const database = await db;
		const transaction = database.transaction(TILES_STORE, 'readonly');
		const store = transaction.objectStore(TILES_STORE);

		return new Promise((resolve) => {
			const request = store.get(quadKey);

			request.onerror = () => {
				console.warn('Failed to get cached tile:', request.error);
				resolve(null);
			};

			request.onsuccess = () => {
				const stored = request.result as StoredTile | undefined;

				if (!stored) {
					resolve(null);
					return;
				}

				// Check if tile has expired
				if (Date.now() - stored.cachedAt > MAX_AGE_MS) {
					// Delete expired tile asynchronously
					deleteCachedTile(quadKey).catch(() => {});
					resolve(null);
					return;
				}

				// Convert ArrayBuffer back to Float32Array
				const heights = new Float32Array(stored.heights);

				const tile: CanopyTile = {
					quadKey: stored.quadKey,
					bounds: stored.bounds,
					width: stored.width,
					height: stored.height,
					heights,
					resolution: stored.resolution,
					cachedAt: stored.cachedAt
				};

				resolve(tile);
			};
		});
	} catch (error) {
		console.warn('Error reading from tile cache:', error);
		return null;
	}
}

/**
 * Stores a tile in IndexedDB cache.
 *
 * @param tile - The tile to cache
 */
export async function setCachedTile(tile: CanopyTile): Promise<void> {
	const db = openDatabase();
	if (!db) return;

	try {
		const database = await db;

		// First, check if we need to evict old tiles
		await evictOldTiles(database);

		const transaction = database.transaction(TILES_STORE, 'readwrite');
		const store = transaction.objectStore(TILES_STORE);

		// Convert Float32Array to ArrayBuffer for storage
		const stored: StoredTile = {
			quadKey: tile.quadKey,
			bounds: tile.bounds,
			width: tile.width,
			height: tile.height,
			heights: tile.heights.buffer.slice(0),
			resolution: tile.resolution,
			cachedAt: tile.cachedAt
		};

		return new Promise((resolve, reject) => {
			const request = store.put(stored);

			request.onerror = () => {
				console.warn('Failed to cache tile:', request.error);
				reject(request.error);
			};

			request.onsuccess = () => {
				resolve();
			};
		});
	} catch (error) {
		console.warn('Error writing to tile cache:', error);
	}
}

/**
 * Deletes a tile from the cache.
 *
 * @param quadKey - QuadKey of the tile to delete
 */
export async function deleteCachedTile(quadKey: string): Promise<void> {
	const db = openDatabase();
	if (!db) return;

	try {
		const database = await db;
		const transaction = database.transaction(TILES_STORE, 'readwrite');
		const store = transaction.objectStore(TILES_STORE);

		return new Promise((resolve) => {
			const request = store.delete(quadKey);
			request.onerror = () => resolve();
			request.onsuccess = () => resolve();
		});
	} catch {
		// Ignore errors when deleting
	}
}

/**
 * Evicts old tiles when the cache exceeds its size limit.
 * Removes the oldest tiles first based on cachedAt timestamp.
 */
async function evictOldTiles(database: IDBDatabase): Promise<void> {
	return new Promise((resolve) => {
		const transaction = database.transaction(TILES_STORE, 'readwrite');
		const store = transaction.objectStore(TILES_STORE);
		const index = store.index('cachedAt');

		// Count current tiles
		const countRequest = store.count();

		countRequest.onsuccess = () => {
			const count = countRequest.result;

			if (count < MAX_TILES) {
				resolve();
				return;
			}

			// Delete oldest tiles to get under the limit
			const toDelete = count - MAX_TILES + 10; // Delete 10 extra for headroom
			const keysToDelete: string[] = [];

			const cursorRequest = index.openCursor();
			let deleted = 0;

			cursorRequest.onsuccess = (event) => {
				const cursor = (event.target as IDBRequest<IDBCursorWithValue>).result;

				if (cursor && deleted < toDelete) {
					keysToDelete.push(cursor.value.quadKey);
					deleted++;
					cursor.continue();
				} else {
					// Delete the collected keys
					for (const key of keysToDelete) {
						store.delete(key);
					}
					resolve();
				}
			};

			cursorRequest.onerror = () => resolve();
		};

		countRequest.onerror = () => resolve();
	});
}

/**
 * Clears the entire tile cache.
 */
export async function clearTileCache(): Promise<void> {
	const db = openDatabase();
	if (!db) return;

	try {
		const database = await db;
		const transaction = database.transaction(TILES_STORE, 'readwrite');
		const store = transaction.objectStore(TILES_STORE);

		return new Promise((resolve) => {
			const request = store.clear();
			request.onerror = () => resolve();
			request.onsuccess = () => resolve();
		});
	} catch {
		// Ignore errors when clearing
	}
}

/**
 * Returns statistics about the tile cache.
 */
export async function getTileCacheStats(): Promise<{
	count: number;
	oldestTimestamp: number | null;
	newestTimestamp: number | null;
} | null> {
	const db = openDatabase();
	if (!db) return null;

	try {
		const database = await db;
		const transaction = database.transaction(TILES_STORE, 'readonly');
		const store = transaction.objectStore(TILES_STORE);
		const index = store.index('cachedAt');

		return new Promise((resolve) => {
			const stats = {
				count: 0,
				oldestTimestamp: null as number | null,
				newestTimestamp: null as number | null
			};

			const countRequest = store.count();
			countRequest.onsuccess = () => {
				stats.count = countRequest.result;
			};

			// Get oldest
			const oldestRequest = index.openCursor();
			oldestRequest.onsuccess = (event) => {
				const cursor = (event.target as IDBRequest<IDBCursorWithValue>).result;
				if (cursor) {
					stats.oldestTimestamp = cursor.value.cachedAt;
				}
			};

			// Get newest
			const newestRequest = index.openCursor(null, 'prev');
			newestRequest.onsuccess = (event) => {
				const cursor = (event.target as IDBRequest<IDBCursorWithValue>).result;
				if (cursor) {
					stats.newestTimestamp = cursor.value.cachedAt;
				}
			};

			transaction.oncomplete = () => resolve(stats);
			transaction.onerror = () => resolve(stats);
		});
	} catch {
		return null;
	}
}
