/**
 * Test suite for ShadeMap sun exposure integration.
 *
 * This tests the flow of enabling sun exposure mode and querying hours of sun.
 * Run with: npx vitest run src/lib/components/ShadeMapSunExposure.test.ts
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock the ShadeMap layer behavior based on observed library internals
interface MockShadeMapLayer {
	options: {
		sunExposure: {
			enabled: boolean;
			startDate?: Date;
			endDate?: Date;
			iterations?: number;
		};
		date: Date;
	};
	_gl: WebGLRenderingContext | null;
	_canvas: HTMLCanvasElement | null;
	_map: object | null;
	_compiledKernel: object | null;
	_heightMap: object | null;
	_outputSunExposure: object | null;
	_sunExposureTexture: object | null;
	events: Record<string, Array<() => void>>;

	on(event: string, handler: () => void): void;
	emit(event: string): void;
	setSunExposure(enabled: boolean, options: object): Promise<boolean>;
	getHoursOfSun(x: number, y: number): number;
	readPixel(x: number, y: number): Uint8Array;
}

function createMockShadeMapLayer(options: {
	hasHeightMap?: boolean;
	heightMapDirty?: boolean;
	sunExposureWorks?: boolean;
	pixelValues?: [number, number, number, number];
} = {}): MockShadeMapLayer {
	const { hasHeightMap = true, heightMapDirty = false, sunExposureWorks = true, pixelValues = [128, 64, 32, 255] } = options;

	const layer: MockShadeMapLayer = {
		options: {
			sunExposure: {
				enabled: false
			},
			date: new Date()
		},
		_gl: {} as WebGLRenderingContext,
		_canvas: { width: 1024, height: 768 } as HTMLCanvasElement,
		_map: {},
		_compiledKernel: {},
		_heightMap: hasHeightMap ? { dirty: heightMapDirty, width: 2304, height: 768 } : null,
		_outputSunExposure: null,
		_sunExposureTexture: null,
		events: {},

		on(event: string, handler: () => void) {
			if (!this.events[event]) {
				this.events[event] = [];
			}
			this.events[event].push(handler);
		},

		emit(event: string) {
			const handlers = this.events[event] || [];
			handlers.forEach(h => h());
		},

		async setSunExposure(enabled: boolean, opts: { startDate?: Date; endDate?: Date; iterations?: number }) {
			this.options.sunExposure = {
				enabled,
				...opts
			};

			// Simulate the internal check: requires _map, _compiledKernel, and _heightMap (not dirty)
			const heightMap = this._heightMap as { dirty?: boolean } | null;
			if (this._map && this._compiledKernel && this._heightMap && !heightMap?.dirty) {
				if (enabled && sunExposureWorks) {
					// Simulate sun exposure calculation
					this._outputSunExposure = {};
					this._sunExposureTexture = {};
				} else {
					this._outputSunExposure = null;
					this._sunExposureTexture = null;
				}

				// Emit idle after a tick
				setTimeout(() => this.emit('idle'), 10);
				return true;
			}

			// If prerequisites not met (including dirty heightMap), sun exposure is not calculated
			// The library still returns the layer but doesn't create textures
			setTimeout(() => this.emit('idle'), 10);
			return false;
		},

		getHoursOfSun(x: number, y: number) {
			if (!this.options.sunExposure.enabled) {
				return 0;
			}

			const pixel = this.readPixel(x, y);
			const { startDate, endDate } = this.options.sunExposure;

			if (!startDate || !endDate) {
				return 0;
			}

			// Simulate the V() function from ShadeMap source
			// The actual formula decodes hours from pixel RGBA values
			const timeInterval = endDate.getTime() - startDate.getTime();

			// If no sun exposure texture, pixels are all zeros
			if (!this._sunExposureTexture) {
				return 0;
			}

			// Simplified calculation - in reality it uses the pixel values
			// to determine the fraction of time in sun
			const r = pixel[0];
			const hoursMs = (r / 255) * timeInterval;
			return Math.abs(hoursMs / 1000 / 3600);
		},

		readPixel(x: number, y: number) {
			// Return zeros if sun exposure not properly initialized
			if (!this._sunExposureTexture) {
				return new Uint8Array([0, 0, 0, 0]);
			}
			return new Uint8Array(pixelValues);
		}
	};

	return layer;
}

describe('ShadeMap Sun Exposure Integration', () => {
	describe('Prerequisites', () => {
		it('should require _heightMap for sun exposure to work', async () => {
			const layer = createMockShadeMapLayer({ hasHeightMap: false });

			const result = await layer.setSunExposure(true, {
				startDate: new Date('2026-01-31T00:00:00'),
				endDate: new Date('2026-01-31T23:59:59'),
				iterations: 24
			});

			// Should return false when heightMap is missing
			expect(result).toBe(false);
			expect(layer._sunExposureTexture).toBeNull();
		});

		it('should create sun exposure texture when all prerequisites met', async () => {
			const layer = createMockShadeMapLayer({ hasHeightMap: true });

			const result = await layer.setSunExposure(true, {
				startDate: new Date('2026-01-31T00:00:00'),
				endDate: new Date('2026-01-31T23:59:59'),
				iterations: 24
			});

			expect(result).toBe(true);
			expect(layer._sunExposureTexture).not.toBeNull();
			expect(layer._outputSunExposure).not.toBeNull();
		});

		it('should fail when heightMap is dirty (not yet rendered)', async () => {
			const layer = createMockShadeMapLayer({ hasHeightMap: true, heightMapDirty: true });

			const result = await layer.setSunExposure(true, {
				startDate: new Date('2026-01-31T00:00:00'),
				endDate: new Date('2026-01-31T23:59:59'),
				iterations: 24
			});

			// Should return false when heightMap is dirty
			expect(result).toBe(false);
			expect(layer._sunExposureTexture).toBeNull();
		});

		it('should succeed when heightMap becomes clean', async () => {
			const layer = createMockShadeMapLayer({ hasHeightMap: true, heightMapDirty: true });

			// Initially fails because dirty
			let result = await layer.setSunExposure(true, {
				startDate: new Date('2026-01-31T00:00:00'),
				endDate: new Date('2026-01-31T23:59:59'),
				iterations: 24
			});
			expect(result).toBe(false);

			// Simulate heightMap becoming clean after render
			(layer._heightMap as { dirty: boolean }).dirty = false;

			// Now should succeed
			result = await layer.setSunExposure(true, {
				startDate: new Date('2026-01-31T00:00:00'),
				endDate: new Date('2026-01-31T23:59:59'),
				iterations: 24
			});
			expect(result).toBe(true);
			expect(layer._sunExposureTexture).not.toBeNull();
		});

		it('should emit idle event after sun exposure calculation', async () => {
			const layer = createMockShadeMapLayer({ hasHeightMap: true });

			let idleReceived = false;
			layer.on('idle', () => {
				idleReceived = true;
			});

			await layer.setSunExposure(true, {
				startDate: new Date('2026-01-31T00:00:00'),
				endDate: new Date('2026-01-31T23:59:59'),
				iterations: 24
			});

			// Wait for idle event
			await new Promise(resolve => setTimeout(resolve, 50));

			expect(idleReceived).toBe(true);
		});
	});

	describe('getHoursOfSun', () => {
		it('should return 0 when sun exposure not enabled', () => {
			const layer = createMockShadeMapLayer();

			const hours = layer.getHoursOfSun(100, 100);

			expect(hours).toBe(0);
		});

		it('should return 0 when sun exposure texture not created', async () => {
			const layer = createMockShadeMapLayer({ hasHeightMap: false });

			// Enable sun exposure but it won't create texture due to missing heightMap
			await layer.setSunExposure(true, {
				startDate: new Date('2026-01-31T00:00:00'),
				endDate: new Date('2026-01-31T23:59:59'),
				iterations: 24
			});

			// Force enabled flag even though calculation failed
			layer.options.sunExposure.enabled = true;

			const hours = layer.getHoursOfSun(100, 100);

			expect(hours).toBe(0);
		});

		it('should return calculated hours when properly initialized', async () => {
			const layer = createMockShadeMapLayer({
				hasHeightMap: true,
				pixelValues: [128, 64, 32, 255] // R=128 means ~50% of day in sun
			});

			await layer.setSunExposure(true, {
				startDate: new Date('2026-01-31T00:00:00'),
				endDate: new Date('2026-01-31T23:59:59'),
				iterations: 24
			});

			const hours = layer.getHoursOfSun(100, 100);

			// With R=128 (50% of 255), and a 24-hour period, expect ~12 hours
			expect(hours).toBeGreaterThan(0);
			expect(hours).toBeCloseTo(12, 0); // Within 1 hour
		});

		it('should return 0 when pixel values are all zeros', async () => {
			const layer = createMockShadeMapLayer({
				hasHeightMap: true,
				sunExposureWorks: false // Simulates failed sun exposure
			});

			await layer.setSunExposure(true, {
				startDate: new Date('2026-01-31T00:00:00'),
				endDate: new Date('2026-01-31T23:59:59'),
				iterations: 24
			});

			const hours = layer.getHoursOfSun(100, 100);

			expect(hours).toBe(0);
		});
	});

	describe('Timing Issues', () => {
		it('should wait for idle before querying hours', async () => {
			const layer = createMockShadeMapLayer({ hasHeightMap: true });

			// Start sun exposure
			const sunExposurePromise = layer.setSunExposure(true, {
				startDate: new Date('2026-01-31T00:00:00'),
				endDate: new Date('2026-01-31T23:59:59'),
				iterations: 24
			});

			// Query immediately - might not have texture yet
			// In real implementation, we need to wait

			// Wait for promise
			await sunExposurePromise;

			// Wait for idle
			await new Promise<void>(resolve => {
				layer.on('idle', resolve);
				setTimeout(resolve, 100); // Timeout fallback
			});

			// Now query should work
			const hours = layer.getHoursOfSun(100, 100);
			expect(hours).toBeGreaterThan(0);
		});
	});

	describe('HeightMap Loading', () => {
		it('should track when heightMap becomes available', async () => {
			const layer = createMockShadeMapLayer({ hasHeightMap: false });

			// Initially no heightMap
			expect(layer._heightMap).toBeNull();

			// Simulate heightMap loading (happens when terrain tiles load)
			layer._heightMap = {};

			// Now sun exposure should work
			const result = await layer.setSunExposure(true, {
				startDate: new Date('2026-01-31T00:00:00'),
				endDate: new Date('2026-01-31T23:59:59'),
				iterations: 24
			});

			expect(result).toBe(true);
			expect(layer._sunExposureTexture).not.toBeNull();
		});

		it('should wait for heightMap before enabling sun exposure', async () => {
			const layer = createMockShadeMapLayer({ hasHeightMap: false });

			// Helper to wait for heightMap
			const waitForHeightMap = (layer: MockShadeMapLayer, timeout = 5000): Promise<boolean> => {
				return new Promise(resolve => {
					if (layer._heightMap) {
						resolve(true);
						return;
					}

					const interval = setInterval(() => {
						if (layer._heightMap) {
							clearInterval(interval);
							resolve(true);
						}
					}, 100);

					setTimeout(() => {
						clearInterval(interval);
						resolve(false);
					}, timeout);
				});
			};

			// Start waiting for heightMap
			const waitPromise = waitForHeightMap(layer, 500);

			// Simulate heightMap loading after 200ms
			setTimeout(() => {
				layer._heightMap = {};
			}, 200);

			const hasHeightMap = await waitPromise;
			expect(hasHeightMap).toBe(true);

			// Now sun exposure should work
			const result = await layer.setSunExposure(true, {
				startDate: new Date('2026-01-31T00:00:00'),
				endDate: new Date('2026-01-31T23:59:59'),
				iterations: 24
			});

			expect(result).toBe(true);
		});
	});
});

describe('Integration Flow', () => {
	it('should follow correct sequence: wait for heightMap -> enable sun exposure -> wait for idle -> query', async () => {
		const layer = createMockShadeMapLayer({ hasHeightMap: false });
		const events: string[] = [];

		// Step 1: Wait for heightMap
		events.push('waiting for heightMap');

		// Simulate terrain loading
		setTimeout(() => {
			events.push('heightMap loaded');
			layer._heightMap = {};
		}, 50);

		await new Promise<void>(resolve => {
			const check = () => {
				if (layer._heightMap) {
					resolve();
				} else {
					setTimeout(check, 10);
				}
			};
			check();
		});

		expect(layer._heightMap).not.toBeNull();

		// Step 2: Enable sun exposure
		events.push('enabling sun exposure');

		await layer.setSunExposure(true, {
			startDate: new Date('2026-01-31T00:00:00'),
			endDate: new Date('2026-01-31T23:59:59'),
			iterations: 24
		});

		events.push('sun exposure enabled');

		// Step 3: Wait for idle
		await new Promise<void>(resolve => {
			let done = false;
			layer.on('idle', () => {
				if (!done) {
					done = true;
					events.push('idle received');
					resolve();
				}
			});
			setTimeout(() => {
				if (!done) {
					done = true;
					events.push('idle timeout');
					resolve();
				}
			}, 200);
		});

		// Step 4: Query hours
		events.push('querying hours');
		const hours = layer.getHoursOfSun(100, 100);
		events.push(`hours: ${hours}`);

		expect(hours).toBeGreaterThan(0);
		expect(events).toEqual([
			'waiting for heightMap',
			'heightMap loaded',
			'enabling sun exposure',
			'sun exposure enabled',
			'idle received',
			'querying hours',
			expect.stringMatching(/^hours: \d+/)
		]);
	});
});
