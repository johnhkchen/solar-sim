/**
 * Tests for plan state localStorage persistence.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

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
	loadPlanState,
	savePlanState,
	clearPlanState,
	getPlanStorageKey,
	isPlanRecent,
	getPlanAgeDays,
	formatLastModified,
	createDebouncedSave,
	getPlanStats,
	DEFAULT_PREFERENCES,
	type StoredPlanState
} from './plan-storage';

describe('plan-storage', () => {
	beforeEach(() => {
		mockLocalStorage._store.clear();
		vi.clearAllMocks();
	});

	describe('getPlanStorageKey', () => {
		it('creates consistent keys from coordinates', () => {
			const key = getPlanStorageKey(40.7128, -74.006);
			expect(key).toBe('solar-sim:plan:40.7128:-74.006');
		});

		it('rounds coordinates to 4 decimal places', () => {
			const key = getPlanStorageKey(40.71284999, -74.00599999);
			expect(key).toBe('solar-sim:plan:40.7128:-74.006');
		});

		it('handles negative coordinates correctly', () => {
			const key = getPlanStorageKey(-33.8688, 151.2093);
			expect(key).toBe('solar-sim:plan:-33.8688:151.2093');
		});
	});

	describe('savePlanState and loadPlanState', () => {
		const validPlan: StoredPlanState = {
			version: 1,
			location: { lat: 40.7128, lng: -74.006, name: 'New York' },
			zones: [
				{
					id: 'zone-1',
					name: 'Front Yard',
					bounds: {
						north: 40.713,
						south: 40.712,
						east: -74.005,
						west: -74.007
					},
					sunHours: 6.5,
					lightCategory: 'full-sun',
					plants: [{ plantId: 'tomato', quantity: 4 }]
				}
			],
			currentPhase: 'plants',
			completedPhases: ['site', 'analysis'],
			analysisPeriod: {
				type: 'growing-season',
				startDate: '2024-04-01T00:00:00.000Z',
				endDate: '2024-10-31T00:00:00.000Z'
			},
			preferences: {
				native: true,
				edible: true,
				lowWater: false,
				deerResistant: false,
				evergreen: false
			},
			obstacles: [],
			slope: { angle: 0, aspect: 180 },
			lastModified: new Date().toISOString()
		};

		it('saves and loads plan state correctly', () => {
			savePlanState(validPlan);
			const loaded = loadPlanState(40.7128, -74.006);

			expect(loaded).not.toBeNull();
			expect(loaded?.location.name).toBe('New York');
			expect(loaded?.zones).toHaveLength(1);
			expect(loaded?.zones[0].name).toBe('Front Yard');
			expect(loaded?.currentPhase).toBe('plants');
		});

		it('returns null for non-existent plan', () => {
			const loaded = loadPlanState(0, 0);
			expect(loaded).toBeNull();
		});

		it('returns null for corrupted JSON', () => {
			const key = getPlanStorageKey(40.7128, -74.006);
			mockLocalStorage._store.set(key, 'not valid json');

			const loaded = loadPlanState(40.7128, -74.006);
			expect(loaded).toBeNull();
		});

		it('validates version number', () => {
			const key = getPlanStorageKey(40.7128, -74.006);
			mockLocalStorage._store.set(
				key,
				JSON.stringify({ ...validPlan, version: 999 })
			);

			const loaded = loadPlanState(40.7128, -74.006);
			expect(loaded).toBeNull();
		});

		it('filters out invalid zones', () => {
			const planWithBadZone = {
				...validPlan,
				zones: [
					validPlan.zones[0],
					{ id: 'bad-zone' }, // Missing required fields
					null
				]
			};
			savePlanState(planWithBadZone as unknown as StoredPlanState);

			const loaded = loadPlanState(40.7128, -74.006);
			expect(loaded?.zones).toHaveLength(1);
		});

		it('filters out invalid plants within zones', () => {
			const planWithBadPlants = {
				...validPlan,
				zones: [
					{
						...validPlan.zones[0],
						plants: [
							{ plantId: 'tomato', quantity: 4 },
							{ plantId: 'invalid' }, // Missing quantity
							{ plantId: 'zero', quantity: 0 } // Invalid quantity
						]
					}
				]
			};
			savePlanState(planWithBadPlants as unknown as StoredPlanState);

			const loaded = loadPlanState(40.7128, -74.006);
			expect(loaded?.zones[0].plants).toHaveLength(1);
			expect(loaded?.zones[0].plants[0].plantId).toBe('tomato');
		});

		it('defaults invalid phase to site', () => {
			const planWithBadPhase = { ...validPlan, currentPhase: 'invalid' };
			savePlanState(planWithBadPhase as unknown as StoredPlanState);

			const loaded = loadPlanState(40.7128, -74.006);
			expect(loaded?.currentPhase).toBe('site');
		});

		it('defaults invalid preferences to defaults', () => {
			const planWithBadPrefs = { ...validPlan, preferences: { foo: 'bar' } };
			savePlanState(planWithBadPrefs as unknown as StoredPlanState);

			const loaded = loadPlanState(40.7128, -74.006);
			expect(loaded?.preferences).toEqual(DEFAULT_PREFERENCES);
		});
	});

	describe('clearPlanState', () => {
		it('removes plan from localStorage', () => {
			const plan: StoredPlanState = {
				version: 1,
				location: { lat: 40.7128, lng: -74.006, name: 'Test' },
				zones: [],
				currentPhase: 'site',
				completedPhases: [],
				analysisPeriod: {
					type: 'growing-season',
					startDate: new Date().toISOString(),
					endDate: new Date().toISOString()
				},
				preferences: DEFAULT_PREFERENCES,
				obstacles: [],
				slope: { angle: 0, aspect: 180 },
				lastModified: new Date().toISOString()
			};

			savePlanState(plan);
			expect(loadPlanState(40.7128, -74.006)).not.toBeNull();

			clearPlanState(40.7128, -74.006);
			expect(loadPlanState(40.7128, -74.006)).toBeNull();
		});
	});

	describe('isPlanRecent', () => {
		it('returns true for recent plans', () => {
			const plan: StoredPlanState = {
				version: 1,
				location: { lat: 0, lng: 0, name: '' },
				zones: [],
				currentPhase: 'site',
				completedPhases: [],
				analysisPeriod: {
					type: 'growing-season',
					startDate: new Date().toISOString(),
					endDate: new Date().toISOString()
				},
				preferences: DEFAULT_PREFERENCES,
				obstacles: [],
				slope: { angle: 0, aspect: 180 },
				lastModified: new Date().toISOString()
			};

			expect(isPlanRecent(plan)).toBe(true);
		});

		it('returns false for old plans', () => {
			const oldDate = new Date();
			oldDate.setDate(oldDate.getDate() - 35); // 35 days ago

			const plan: StoredPlanState = {
				version: 1,
				location: { lat: 0, lng: 0, name: '' },
				zones: [],
				currentPhase: 'site',
				completedPhases: [],
				analysisPeriod: {
					type: 'growing-season',
					startDate: new Date().toISOString(),
					endDate: new Date().toISOString()
				},
				preferences: DEFAULT_PREFERENCES,
				obstacles: [],
				slope: { angle: 0, aspect: 180 },
				lastModified: oldDate.toISOString()
			};

			expect(isPlanRecent(plan)).toBe(false);
		});
	});

	describe('getPlanAgeDays', () => {
		it('returns 0 for today', () => {
			const plan: StoredPlanState = {
				version: 1,
				location: { lat: 0, lng: 0, name: '' },
				zones: [],
				currentPhase: 'site',
				completedPhases: [],
				analysisPeriod: {
					type: 'growing-season',
					startDate: new Date().toISOString(),
					endDate: new Date().toISOString()
				},
				preferences: DEFAULT_PREFERENCES,
				obstacles: [],
				slope: { angle: 0, aspect: 180 },
				lastModified: new Date().toISOString()
			};

			expect(getPlanAgeDays(plan)).toBe(0);
		});

		it('calculates days correctly', () => {
			const oldDate = new Date();
			oldDate.setDate(oldDate.getDate() - 7);

			const plan: StoredPlanState = {
				version: 1,
				location: { lat: 0, lng: 0, name: '' },
				zones: [],
				currentPhase: 'site',
				completedPhases: [],
				analysisPeriod: {
					type: 'growing-season',
					startDate: new Date().toISOString(),
					endDate: new Date().toISOString()
				},
				preferences: DEFAULT_PREFERENCES,
				obstacles: [],
				slope: { angle: 0, aspect: 180 },
				lastModified: oldDate.toISOString()
			};

			expect(getPlanAgeDays(plan)).toBe(7);
		});
	});

	describe('formatLastModified', () => {
		it('formats date correctly', () => {
			const plan: StoredPlanState = {
				version: 1,
				location: { lat: 0, lng: 0, name: '' },
				zones: [],
				currentPhase: 'site',
				completedPhases: [],
				analysisPeriod: {
					type: 'growing-season',
					startDate: new Date().toISOString(),
					endDate: new Date().toISOString()
				},
				preferences: DEFAULT_PREFERENCES,
				obstacles: [],
				slope: { angle: 0, aspect: 180 },
				lastModified: '2024-06-15T12:00:00.000Z'
			};

			const formatted = formatLastModified(plan);
			expect(formatted).toContain('Jun');
			expect(formatted).toContain('15');
		});
	});

	describe('createDebouncedSave', () => {
		it('debounces save calls', async () => {
			vi.useFakeTimers();

			const { save } = createDebouncedSave(100);
			const plan: StoredPlanState = {
				version: 1,
				location: { lat: 40.7128, lng: -74.006, name: 'Test' },
				zones: [],
				currentPhase: 'site',
				completedPhases: [],
				analysisPeriod: {
					type: 'growing-season',
					startDate: new Date().toISOString(),
					endDate: new Date().toISOString()
				},
				preferences: DEFAULT_PREFERENCES,
				obstacles: [],
				slope: { angle: 0, aspect: 180 },
				lastModified: new Date().toISOString()
			};

			// Call save multiple times rapidly
			save(plan);
			save(plan);
			save(plan);

			// Should not have saved yet
			expect(loadPlanState(40.7128, -74.006)).toBeNull();

			// Fast forward past debounce delay
			vi.advanceTimersByTime(150);

			// Now it should be saved
			expect(loadPlanState(40.7128, -74.006)).not.toBeNull();

			vi.useRealTimers();
		});

		it('can cancel pending saves', async () => {
			vi.useFakeTimers();

			const { save, cancel } = createDebouncedSave(100);
			const plan: StoredPlanState = {
				version: 1,
				location: { lat: 40.7128, lng: -74.006, name: 'Test' },
				zones: [],
				currentPhase: 'site',
				completedPhases: [],
				analysisPeriod: {
					type: 'growing-season',
					startDate: new Date().toISOString(),
					endDate: new Date().toISOString()
				},
				preferences: DEFAULT_PREFERENCES,
				obstacles: [],
				slope: { angle: 0, aspect: 180 },
				lastModified: new Date().toISOString()
			};

			save(plan);
			cancel();

			vi.advanceTimersByTime(150);

			// Should not have saved because we cancelled
			expect(loadPlanState(40.7128, -74.006)).toBeNull();

			vi.useRealTimers();
		});
	});

	describe('getPlanStats', () => {
		it('calculates stats correctly', () => {
			const plan: StoredPlanState = {
				version: 1,
				location: { lat: 0, lng: 0, name: '' },
				zones: [
					{
						id: 'z1',
						name: 'Zone 1',
						bounds: { north: 0, south: 0, east: 0, west: 0 },
						sunHours: 6,
						lightCategory: 'full-sun',
						plants: [
							{ plantId: 'a', quantity: 3 },
							{ plantId: 'b', quantity: 2 }
						]
					},
					{
						id: 'z2',
						name: 'Zone 2',
						bounds: { north: 0, south: 0, east: 0, west: 0 },
						sunHours: 4,
						lightCategory: 'partial-shade',
						plants: [{ plantId: 'c', quantity: 5 }]
					}
				],
				currentPhase: 'plants',
				completedPhases: [],
				analysisPeriod: {
					type: 'growing-season',
					startDate: new Date().toISOString(),
					endDate: new Date().toISOString()
				},
				preferences: DEFAULT_PREFERENCES,
				obstacles: [{ type: 'fence', azimuth: 90, elevationAngle: 30, width: 10 }],
				slope: { angle: 0, aspect: 180 },
				lastModified: new Date().toISOString()
			};

			const stats = getPlanStats(plan);
			expect(stats.zoneCount).toBe(2);
			expect(stats.plantCount).toBe(10); // 3 + 2 + 5
			expect(stats.hasObstacles).toBe(true);
		});

		it('handles empty plan', () => {
			const plan: StoredPlanState = {
				version: 1,
				location: { lat: 0, lng: 0, name: '' },
				zones: [],
				currentPhase: 'site',
				completedPhases: [],
				analysisPeriod: {
					type: 'growing-season',
					startDate: new Date().toISOString(),
					endDate: new Date().toISOString()
				},
				preferences: DEFAULT_PREFERENCES,
				obstacles: [],
				slope: { angle: 0, aspect: 180 },
				lastModified: new Date().toISOString()
			};

			const stats = getPlanStats(plan);
			expect(stats.zoneCount).toBe(0);
			expect(stats.plantCount).toBe(0);
			expect(stats.hasObstacles).toBe(false);
		});
	});
});
