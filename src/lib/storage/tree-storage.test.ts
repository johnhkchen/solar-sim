/**
 * Tests for tree localStorage persistence.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { MapTree, ObservationPoint } from '$lib/components/MapPicker.svelte';

// Create a fresh mock storage for each test
function createMockLocalStorage() {
	const store = new Map<string, string>();
	return {
		getItem: vi.fn((key: string) => store.get(key) ?? null),
		setItem: vi.fn((key: string, value: string) => store.set(key, value)),
		removeItem: vi.fn((key: string) => store.delete(key)),
		clear: vi.fn(() => store.clear()),
		get length() {
			return store.size;
		},
		key: vi.fn((index: number) => Array.from(store.keys())[index] ?? null),
		_store: store // For direct manipulation in tests
	};
}

// Set up global window mock before importing the module
const mockLocalStorage = createMockLocalStorage();

vi.stubGlobal('window', {
	localStorage: mockLocalStorage
});

// Import after setting up mocks
import {
	getStorageKey,
	loadLocationData,
	saveLocationData,
	clearLocationData,
	listStoredLocations,
	type StoredLocationData
} from './tree-storage';

describe('tree-storage', () => {
	beforeEach(() => {
		mockLocalStorage._store.clear();
		vi.clearAllMocks();
	});

	describe('getStorageKey', () => {
		it('creates a key with rounded coordinates', () => {
			const key = getStorageKey(37.7749, -122.4194);
			expect(key).toBe('solar-sim:location:37.775:-122.419');
		});

		it('rounds coordinates to 3 decimal places', () => {
			const key1 = getStorageKey(37.77491, -122.41941);
			const key2 = getStorageKey(37.77499, -122.41949);
			expect(key1).toBe(key2);
		});

		it('handles negative coordinates', () => {
			const key = getStorageKey(-33.8688, 151.2093);
			expect(key).toBe('solar-sim:location:-33.869:151.209');
		});

		it('handles zero coordinates', () => {
			const key = getStorageKey(0, 0);
			expect(key).toBe('solar-sim:location:0:0');
		});
	});

	describe('saveLocationData and loadLocationData', () => {
		const sampleTree: MapTree = {
			id: 'tree-1',
			lat: 37.775,
			lng: -122.419,
			type: 'deciduous-tree',
			label: 'Oak',
			height: 15,
			canopyWidth: 10
		};

		const sampleObservationPoint: ObservationPoint = {
			lat: 37.7751,
			lng: -122.4195
		};

		it('saves and loads trees correctly', () => {
			const trees = [sampleTree];
			saveLocationData(37.775, -122.419, trees);

			const loaded = loadLocationData(37.775, -122.419);
			expect(loaded).not.toBeNull();
			expect(loaded!.trees).toHaveLength(1);
			expect(loaded!.trees[0]).toEqual(sampleTree);
		});

		it('saves and loads observation point correctly', () => {
			saveLocationData(37.775, -122.419, [], sampleObservationPoint);

			const loaded = loadLocationData(37.775, -122.419);
			expect(loaded).not.toBeNull();
			expect(loaded!.observationPoint).toEqual(sampleObservationPoint);
		});

		it('saves both trees and observation point together', () => {
			const trees = [sampleTree];
			saveLocationData(37.775, -122.419, trees, sampleObservationPoint);

			const loaded = loadLocationData(37.775, -122.419);
			expect(loaded).not.toBeNull();
			expect(loaded!.trees).toHaveLength(1);
			expect(loaded!.observationPoint).toEqual(sampleObservationPoint);
		});

		it('returns null for non-existent location', () => {
			const loaded = loadLocationData(0, 0);
			expect(loaded).toBeNull();
		});

		it('removes key when saving empty data', () => {
			// First save something
			saveLocationData(37.775, -122.419, [sampleTree]);
			expect(mockLocalStorage.setItem).toHaveBeenCalled();

			vi.clearAllMocks();

			// Then save empty
			saveLocationData(37.775, -122.419, []);
			expect(mockLocalStorage.removeItem).toHaveBeenCalled();
		});

		it('rounds coordinates to find stored data', () => {
			const trees = [sampleTree];
			saveLocationData(37.7749, -122.4194, trees);

			// Should find data with slightly different coordinates
			const loaded = loadLocationData(37.7751, -122.4191);
			expect(loaded).not.toBeNull();
			expect(loaded!.trees).toHaveLength(1);
		});
	});

	describe('data validation', () => {
		it('handles corrupted JSON gracefully', () => {
			mockLocalStorage._store.set('solar-sim:location:37.775:-122.419', 'not valid json');

			const loaded = loadLocationData(37.775, -122.419);
			expect(loaded).toBeNull();
		});

		it('handles invalid data structure gracefully', () => {
			mockLocalStorage._store.set('solar-sim:location:37.775:-122.419', JSON.stringify({ foo: 'bar' }));

			const loaded = loadLocationData(37.775, -122.419);
			expect(loaded).toBeNull();
		});

		it('handles wrong version gracefully', () => {
			mockLocalStorage._store.set(
				'solar-sim:location:37.775:-122.419',
				JSON.stringify({ version: 999, trees: [] })
			);

			const loaded = loadLocationData(37.775, -122.419);
			expect(loaded).toBeNull();
		});

		it('filters out invalid trees while keeping valid ones', () => {
			const dataWithInvalidTree = {
				version: 1,
				trees: [
					{
						id: 'valid-tree',
						lat: 37.775,
						lng: -122.419,
						type: 'deciduous-tree',
						label: 'Oak',
						height: 15,
						canopyWidth: 10
					},
					{
						// Invalid tree - missing required fields
						id: 'invalid-tree',
						lat: 37.775
					}
				],
				updatedAt: new Date().toISOString()
			};

			mockLocalStorage._store.set('solar-sim:location:37.775:-122.419', JSON.stringify(dataWithInvalidTree));

			const loaded = loadLocationData(37.775, -122.419);
			expect(loaded).not.toBeNull();
			expect(loaded!.trees).toHaveLength(1);
			expect(loaded!.trees[0].id).toBe('valid-tree');
		});

		it('rejects trees with invalid type', () => {
			const data = {
				version: 1,
				trees: [
					{
						id: 'bad-type',
						lat: 37.775,
						lng: -122.419,
						type: 'palm-tree', // invalid type
						label: 'Palm',
						height: 15,
						canopyWidth: 10
					}
				],
				updatedAt: new Date().toISOString()
			};

			mockLocalStorage._store.set('solar-sim:location:37.775:-122.419', JSON.stringify(data));

			const loaded = loadLocationData(37.775, -122.419);
			// Returns null because filtering removes the invalid tree, leaving empty
			expect(loaded).toBeNull();
		});

		it('rejects trees with non-positive dimensions', () => {
			const data = {
				version: 1,
				trees: [
					{
						id: 'zero-height',
						lat: 37.775,
						lng: -122.419,
						type: 'deciduous-tree',
						label: 'Bad',
						height: 0,
						canopyWidth: 10
					}
				],
				updatedAt: new Date().toISOString()
			};

			mockLocalStorage._store.set('solar-sim:location:37.775:-122.419', JSON.stringify(data));

			const loaded = loadLocationData(37.775, -122.419);
			// Returns null because filtering removes the invalid tree, leaving empty
			expect(loaded).toBeNull();
		});

		it('ignores invalid observation point', () => {
			const data = {
				version: 1,
				trees: [],
				observationPoint: { lat: 'not a number' },
				updatedAt: new Date().toISOString()
			};

			mockLocalStorage._store.set('solar-sim:location:37.775:-122.419', JSON.stringify(data));

			const loaded = loadLocationData(37.775, -122.419);
			// Returns null because empty trees with no valid observation point
			expect(loaded).toBeNull();
		});

		it('keeps valid observation point even when trees are empty', () => {
			const data = {
				version: 1,
				trees: [],
				observationPoint: { lat: 37.775, lng: -122.419 },
				updatedAt: new Date().toISOString()
			};

			mockLocalStorage._store.set('solar-sim:location:37.775:-122.419', JSON.stringify(data));

			const loaded = loadLocationData(37.775, -122.419);
			expect(loaded).not.toBeNull();
			expect(loaded!.trees).toHaveLength(0);
			expect(loaded!.observationPoint).toEqual({ lat: 37.775, lng: -122.419 });
		});
	});

	describe('clearLocationData', () => {
		it('removes stored data', () => {
			const tree: MapTree = {
				id: 'tree-1',
				lat: 37.775,
				lng: -122.419,
				type: 'deciduous-tree',
				label: 'Oak',
				height: 15,
				canopyWidth: 10
			};

			saveLocationData(37.775, -122.419, [tree]);
			expect(loadLocationData(37.775, -122.419)).not.toBeNull();

			clearLocationData(37.775, -122.419);
			expect(loadLocationData(37.775, -122.419)).toBeNull();
		});
	});

	describe('listStoredLocations', () => {
		it('returns all stored location keys', () => {
			const tree: MapTree = {
				id: 'tree-1',
				lat: 37.775,
				lng: -122.419,
				type: 'deciduous-tree',
				label: 'Oak',
				height: 15,
				canopyWidth: 10
			};

			saveLocationData(37.775, -122.419, [tree]);
			saveLocationData(40.7128, -74.006, [tree]);

			// Add a non-solar-sim key to verify filtering
			mockLocalStorage._store.set('other-app:data', 'something');

			const locations = listStoredLocations();
			expect(locations).toHaveLength(2);
			expect(locations).toContain('solar-sim:location:37.775:-122.419');
			expect(locations).toContain('solar-sim:location:40.713:-74.006');
			expect(locations).not.toContain('other-app:data');
		});

		it('returns empty array when no data stored', () => {
			const locations = listStoredLocations();
			expect(locations).toEqual([]);
		});
	});
});
