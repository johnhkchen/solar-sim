/**
 * localStorage persistence for user-placed trees and observation points.
 *
 * Trees are stored by location key (rounded coordinates to ~100m precision),
 * allowing users to return to a previously visited location and see their
 * previously placed trees.
 */

import type { MapTree, ObservationPoint } from '$lib/components/MapPicker.svelte';

/**
 * The data structure stored in localStorage for a given location.
 */
export interface StoredLocationData {
	version: 1;
	trees: MapTree[];
	observationPoint?: ObservationPoint;
	/** IDs of auto-detected trees that the user has deleted (soft delete) */
	deletedAutoTreeIds?: string[];
	updatedAt: string;
}

const STORAGE_PREFIX = 'solar-sim:location:';
const COORDINATE_PRECISION = 3; // ~100m precision

/**
 * Rounds a coordinate to the configured precision level.
 * At 3 decimal places, this gives roughly 100m precision.
 */
function roundCoordinate(coord: number): number {
	const factor = Math.pow(10, COORDINATE_PRECISION);
	return Math.round(coord * factor) / factor;
}

/**
 * Creates a storage key for the given coordinates.
 * Coordinates are rounded to group nearby locations together.
 */
export function getStorageKey(lat: number, lng: number): string {
	const roundedLat = roundCoordinate(lat);
	const roundedLng = roundCoordinate(lng);
	return `${STORAGE_PREFIX}${roundedLat}:${roundedLng}`;
}

/**
 * Validates that a tree object has all required fields with correct types.
 * Supports optional source and modified fields for tree refinement tracking.
 */
function isValidTree(tree: unknown): tree is MapTree {
	if (typeof tree !== 'object' || tree === null) return false;

	const t = tree as Record<string, unknown>;

	// Check required fields
	const hasRequiredFields =
		typeof t.id === 'string' &&
		typeof t.lat === 'number' &&
		typeof t.lng === 'number' &&
		(t.type === 'deciduous-tree' || t.type === 'evergreen-tree') &&
		typeof t.label === 'string' &&
		typeof t.height === 'number' &&
		typeof t.canopyWidth === 'number' &&
		!isNaN(t.lat) &&
		!isNaN(t.lng) &&
		!isNaN(t.height) &&
		!isNaN(t.canopyWidth) &&
		t.height > 0 &&
		t.canopyWidth > 0;

	if (!hasRequiredFields) return false;

	// Validate optional source field if present
	if (t.source !== undefined && t.source !== 'auto' && t.source !== 'manual') {
		return false;
	}

	// Validate optional modified field if present
	if (t.modified !== undefined && typeof t.modified !== 'boolean') {
		return false;
	}

	return true;
}

/**
 * Validates that an observation point has all required fields.
 */
function isValidObservationPoint(point: unknown): point is ObservationPoint {
	if (typeof point !== 'object' || point === null) return false;

	const p = point as Record<string, unknown>;
	return (
		typeof p.lat === 'number' &&
		typeof p.lng === 'number' &&
		!isNaN(p.lat) &&
		!isNaN(p.lng)
	);
}

/**
 * Validates stored data and filters out any invalid entries.
 * Returns null if the data structure is fundamentally broken or contains no useful data.
 */
function validateStoredData(data: unknown): StoredLocationData | null {
	if (typeof data !== 'object' || data === null) return null;

	const d = data as Record<string, unknown>;
	if (d.version !== 1) return null;
	if (!Array.isArray(d.trees)) return null;

	// Filter to only valid trees, silently dropping corrupt entries
	const validTrees = d.trees.filter(isValidTree);

	// Validate observation point if present
	const observationPoint = d.observationPoint !== undefined && isValidObservationPoint(d.observationPoint)
		? d.observationPoint
		: undefined;

	// Validate deleted auto tree IDs if present
	let deletedAutoTreeIds: string[] | undefined;
	if (Array.isArray(d.deletedAutoTreeIds)) {
		deletedAutoTreeIds = d.deletedAutoTreeIds.filter(
			(id): id is string => typeof id === 'string' && id.length > 0
		);
		if (deletedAutoTreeIds.length === 0) {
			deletedAutoTreeIds = undefined;
		}
	}

	// If there's nothing useful to return, treat as no data
	if (validTrees.length === 0 && !observationPoint && !deletedAutoTreeIds) return null;

	return {
		version: 1,
		trees: validTrees,
		observationPoint,
		deletedAutoTreeIds,
		updatedAt: typeof d.updatedAt === 'string' ? d.updatedAt : new Date().toISOString()
	};
}

/**
 * Loads stored tree data for the given coordinates.
 * Returns null if no data exists or if the stored data is corrupted.
 */
export function loadLocationData(lat: number, lng: number): StoredLocationData | null {
	if (typeof window === 'undefined' || !window.localStorage) return null;

	const key = getStorageKey(lat, lng);

	try {
		const stored = window.localStorage.getItem(key);
		if (!stored) return null;

		const parsed = JSON.parse(stored);
		return validateStoredData(parsed);
	} catch (e) {
		// JSON parse error or other issue - treat as no data
		console.warn(`Failed to load tree data for ${key}:`, e);
		return null;
	}
}

/**
 * Saves tree and observation point data for the given coordinates.
 */
export function saveLocationData(
	lat: number,
	lng: number,
	trees: MapTree[],
	observationPoint?: ObservationPoint,
	deletedAutoTreeIds?: string[]
): void {
	if (typeof window === 'undefined' || !window.localStorage) return;

	const key = getStorageKey(lat, lng);

	// Filter empty deleted IDs array
	const filteredDeletedIds = deletedAutoTreeIds?.length ? deletedAutoTreeIds : undefined;

	// Don't store empty data - remove the key instead
	if (trees.length === 0 && !observationPoint && !filteredDeletedIds) {
		try {
			window.localStorage.removeItem(key);
		} catch (e) {
			console.warn(`Failed to remove tree data for ${key}:`, e);
		}
		return;
	}

	const data: StoredLocationData = {
		version: 1,
		trees,
		observationPoint,
		deletedAutoTreeIds: filteredDeletedIds,
		updatedAt: new Date().toISOString()
	};

	try {
		window.localStorage.setItem(key, JSON.stringify(data));
	} catch (e) {
		// Storage might be full or disabled
		console.warn(`Failed to save tree data for ${key}:`, e);
	}
}

/**
 * Clears stored data for the given coordinates.
 */
export function clearLocationData(lat: number, lng: number): void {
	if (typeof window === 'undefined' || !window.localStorage) return;

	const key = getStorageKey(lat, lng);

	try {
		window.localStorage.removeItem(key);
	} catch (e) {
		console.warn(`Failed to clear tree data for ${key}:`, e);
	}
}

/**
 * Lists all stored location keys (for debugging/admin purposes).
 */
export function listStoredLocations(): string[] {
	if (typeof window === 'undefined' || !window.localStorage) return [];

	const storage = window.localStorage;
	const keys: string[] = [];
	for (let i = 0; i < storage.length; i++) {
		const key = storage.key(i);
		if (key && key.startsWith(STORAGE_PREFIX)) {
			keys.push(key);
		}
	}
	return keys;
}
