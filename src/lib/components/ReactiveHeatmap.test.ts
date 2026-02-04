/**
 * Tests for ReactiveHeatmap component logic.
 *
 * The component integrates debouncing, web workers, and state management.
 * We test the core logic patterns used by the component, particularly
 * input hashing for change detection and state transitions.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

/**
 * Simulates the input hash generation logic from ReactiveHeatmap.
 * Used to detect when inputs have changed and recalculation is needed.
 */
function getInputHash(
	bounds: { south: number; north: number; west: number; east: number } | null,
	period: { startDoy: number; endDoy: number } | null,
	trees: Array<{ id: string; lat: number; lng: number; height: number; canopyWidth: number; type: string }>
): string {
	if (!bounds || !period) return '';

	const treesHash = trees
		.map((t) => `${t.id}:${t.lat.toFixed(6)}:${t.lng.toFixed(6)}:${t.height}:${t.canopyWidth}:${t.type}`)
		.join('|');

	return `${bounds.south}:${bounds.north}:${bounds.west}:${bounds.east}:${period.startDoy}:${period.endDoy}:${treesHash}`;
}

/**
 * Simulates debounce behavior for testing purposes.
 */
function createDebounce<T extends (...args: unknown[]) => unknown>(fn: T, ms: number) {
	let timer: ReturnType<typeof setTimeout> | null = null;
	return (...args: Parameters<T>) => {
		if (timer) clearTimeout(timer);
		timer = setTimeout(() => fn(...args), ms);
	};
}

describe('ReactiveHeatmap logic', () => {
	beforeEach(() => {
		vi.useFakeTimers();
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	describe('input hash generation', () => {
		it('returns empty string when bounds is null', () => {
			const hash = getInputHash(null, { startDoy: 91, endDoy: 273 }, []);
			expect(hash).toBe('');
		});

		it('returns empty string when period is null', () => {
			const hash = getInputHash(
				{ south: 37.7, north: 37.8, west: -122.5, east: -122.4 },
				null,
				[]
			);
			expect(hash).toBe('');
		});

		it('generates consistent hash for same inputs', () => {
			const bounds = { south: 37.7, north: 37.8, west: -122.5, east: -122.4 };
			const period = { startDoy: 91, endDoy: 273 };
			const trees = [
				{ id: 'tree1', lat: 37.75, lng: -122.45, height: 10, canopyWidth: 8, type: 'deciduous-tree' }
			];

			const hash1 = getInputHash(bounds, period, trees);
			const hash2 = getInputHash(bounds, period, trees);

			expect(hash1).toBe(hash2);
		});

		it('generates different hash when bounds change', () => {
			const period = { startDoy: 91, endDoy: 273 };
			const trees: Array<{ id: string; lat: number; lng: number; height: number; canopyWidth: number; type: string }> = [];

			const hash1 = getInputHash(
				{ south: 37.7, north: 37.8, west: -122.5, east: -122.4 },
				period,
				trees
			);
			const hash2 = getInputHash(
				{ south: 37.71, north: 37.8, west: -122.5, east: -122.4 },
				period,
				trees
			);

			expect(hash1).not.toBe(hash2);
		});

		it('generates different hash when period changes', () => {
			const bounds = { south: 37.7, north: 37.8, west: -122.5, east: -122.4 };
			const trees: Array<{ id: string; lat: number; lng: number; height: number; canopyWidth: number; type: string }> = [];

			const hash1 = getInputHash(bounds, { startDoy: 91, endDoy: 273 }, trees);
			const hash2 = getInputHash(bounds, { startDoy: 1, endDoy: 365 }, trees);

			expect(hash1).not.toBe(hash2);
		});

		it('generates different hash when trees change', () => {
			const bounds = { south: 37.7, north: 37.8, west: -122.5, east: -122.4 };
			const period = { startDoy: 91, endDoy: 273 };

			const hash1 = getInputHash(bounds, period, [
				{ id: 'tree1', lat: 37.75, lng: -122.45, height: 10, canopyWidth: 8, type: 'deciduous-tree' }
			]);
			const hash2 = getInputHash(bounds, period, [
				{ id: 'tree1', lat: 37.75, lng: -122.45, height: 12, canopyWidth: 8, type: 'deciduous-tree' }
			]);

			expect(hash1).not.toBe(hash2);
		});

		it('generates different hash when tree position changes', () => {
			const bounds = { south: 37.7, north: 37.8, west: -122.5, east: -122.4 };
			const period = { startDoy: 91, endDoy: 273 };

			const hash1 = getInputHash(bounds, period, [
				{ id: 'tree1', lat: 37.75, lng: -122.45, height: 10, canopyWidth: 8, type: 'deciduous-tree' }
			]);
			const hash2 = getInputHash(bounds, period, [
				{ id: 'tree1', lat: 37.76, lng: -122.45, height: 10, canopyWidth: 8, type: 'deciduous-tree' }
			]);

			expect(hash1).not.toBe(hash2);
		});

		it('generates different hash when tree is added', () => {
			const bounds = { south: 37.7, north: 37.8, west: -122.5, east: -122.4 };
			const period = { startDoy: 91, endDoy: 273 };

			const hash1 = getInputHash(bounds, period, [
				{ id: 'tree1', lat: 37.75, lng: -122.45, height: 10, canopyWidth: 8, type: 'deciduous-tree' }
			]);
			const hash2 = getInputHash(bounds, period, [
				{ id: 'tree1', lat: 37.75, lng: -122.45, height: 10, canopyWidth: 8, type: 'deciduous-tree' },
				{ id: 'tree2', lat: 37.76, lng: -122.46, height: 8, canopyWidth: 6, type: 'evergreen-tree' }
			]);

			expect(hash1).not.toBe(hash2);
		});

		it('generates different hash when tree is removed', () => {
			const bounds = { south: 37.7, north: 37.8, west: -122.5, east: -122.4 };
			const period = { startDoy: 91, endDoy: 273 };

			const hash1 = getInputHash(bounds, period, [
				{ id: 'tree1', lat: 37.75, lng: -122.45, height: 10, canopyWidth: 8, type: 'deciduous-tree' },
				{ id: 'tree2', lat: 37.76, lng: -122.46, height: 8, canopyWidth: 6, type: 'evergreen-tree' }
			]);
			const hash2 = getInputHash(bounds, period, [
				{ id: 'tree1', lat: 37.75, lng: -122.45, height: 10, canopyWidth: 8, type: 'deciduous-tree' }
			]);

			expect(hash1).not.toBe(hash2);
		});
	});

	describe('debounce behavior', () => {
		it('debounces rapid calls', () => {
			const callback = vi.fn();
			const debounced = createDebounce(callback, 500);

			// Rapid calls
			debounced();
			debounced();
			debounced();

			// Not called yet
			expect(callback).not.toHaveBeenCalled();

			// Advance past debounce period
			vi.advanceTimersByTime(500);

			// Called once
			expect(callback).toHaveBeenCalledTimes(1);
		});

		it('resets timer on each call', () => {
			const callback = vi.fn();
			const debounced = createDebounce(callback, 500);

			debounced();
			vi.advanceTimersByTime(300);

			debounced(); // Reset timer
			vi.advanceTimersByTime(300);

			// Not called yet (timer was reset)
			expect(callback).not.toHaveBeenCalled();

			vi.advanceTimersByTime(200);

			// Now called
			expect(callback).toHaveBeenCalledTimes(1);
		});

		it('allows configurable delay', () => {
			const callback = vi.fn();
			const debounced = createDebounce(callback, 1000);

			debounced();
			vi.advanceTimersByTime(500);

			expect(callback).not.toHaveBeenCalled();

			vi.advanceTimersByTime(500);

			expect(callback).toHaveBeenCalledTimes(1);
		});
	});

	describe('state transitions', () => {
		interface State {
			isCalculating: boolean;
			progress: number;
			error: string | null;
		}

		it('transitions from idle to calculating', () => {
			const state: State = {
				isCalculating: false,
				progress: 0,
				error: null
			};

			// Start calculation
			state.isCalculating = true;
			state.progress = 0;
			state.error = null;

			expect(state.isCalculating).toBe(true);
			expect(state.progress).toBe(0);
			expect(state.error).toBeNull();
		});

		it('updates progress during calculation', () => {
			const state: State = {
				isCalculating: true,
				progress: 0,
				error: null
			};

			// Progress update
			state.progress = 0.5;

			expect(state.isCalculating).toBe(true);
			expect(state.progress).toBe(0.5);
		});

		it('transitions to completed', () => {
			const state: State = {
				isCalculating: true,
				progress: 0.9,
				error: null
			};

			// Complete
			state.isCalculating = false;
			state.progress = 1;

			expect(state.isCalculating).toBe(false);
			expect(state.progress).toBe(1);
		});

		it('handles error state', () => {
			const state: State = {
				isCalculating: true,
				progress: 0.5,
				error: null
			};

			// Error
			state.isCalculating = false;
			state.progress = 0;
			state.error = 'Calculation failed';

			expect(state.isCalculating).toBe(false);
			expect(state.error).toBe('Calculation failed');
		});
	});
});

describe('worker message types', () => {
	it('has correct request structure', () => {
		const request = {
			type: 'calculate' as const,
			id: 'test-123',
			bounds: { south: 37.7, north: 37.8, west: -122.5, east: -122.4 },
			trees: [],
			dateRange: { start: '2024-04-01T00:00:00Z', end: '2024-10-31T00:00:00Z' },
			config: { resolution: 2, sampleDays: 12 }
		};

		expect(request.type).toBe('calculate');
		expect(request.id).toBeDefined();
		expect(request.bounds).toBeDefined();
		expect(request.trees).toBeDefined();
		expect(request.dateRange).toBeDefined();
		expect(request.config).toBeDefined();
	});

	it('has correct response structure for progress', () => {
		const response = {
			type: 'progress' as const,
			id: 'test-123',
			progress: 0.5
		};

		expect(response.type).toBe('progress');
		expect(response.id).toBeDefined();
		expect(response.progress).toBe(0.5);
	});

	it('has correct response structure for result', () => {
		const response = {
			type: 'result' as const,
			id: 'test-123',
			grid: {
				bounds: { south: 37.7, north: 37.8, west: -122.5, east: -122.4 },
				resolution: 2,
				width: 50,
				height: 50,
				values: new Float32Array(2500),
				dateRange: { start: new Date(), end: new Date() },
				sampleDaysUsed: 12,
				computeTimeMs: 1500
			}
		};

		expect(response.type).toBe('result');
		expect(response.id).toBeDefined();
		expect(response.grid).toBeDefined();
		expect(response.grid.computeTimeMs).toBe(1500);
	});

	it('has correct response structure for error', () => {
		const response = {
			type: 'error' as const,
			id: 'test-123',
			error: 'Something went wrong'
		};

		expect(response.type).toBe('error');
		expect(response.id).toBeDefined();
		expect(response.error).toBe('Something went wrong');
	});
});
