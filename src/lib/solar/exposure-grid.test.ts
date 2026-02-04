/**
 * Tests for the grid-based sun exposure calculation module.
 */

import { describe, it, expect } from 'vitest';
import {
	calculateGridDimensions,
	generateSampleDates,
	getCellCenter,
	calculateExposureGrid,
	calculateExposureGridAsync,
	getExposureAt,
	getExposureCellAt,
	findCellAtLatLng,
	getExposureAtLatLng,
	getExposureGridStats,
	forEachExposureCell,
	type LatLngBounds,
	type DateRange,
	type GridConfig,
	type MapTreeConfig
} from './exposure-grid.js';

describe('calculateGridDimensions', () => {
	it('calculates correct dimensions for a small area at 2m resolution', () => {
		// Approximately 50m x 50m area near the equator
		const bounds: LatLngBounds = {
			south: 0,
			west: 0,
			north: 0.00045, // ~50m
			east: 0.00045 // ~50m at equator
		};

		const { width, height } = calculateGridDimensions(bounds, 2);

		expect(width).toBeGreaterThanOrEqual(20);
		expect(width).toBeLessThanOrEqual(30);
		expect(height).toBeGreaterThanOrEqual(20);
		expect(height).toBeLessThanOrEqual(30);
	});

	it('handles higher latitudes where longitude degrees are smaller', () => {
		// Same degree span at 60°N latitude (where 1° lng ≈ 55km instead of 111km)
		const bounds: LatLngBounds = {
			south: 60,
			west: 0,
			north: 60.00045,
			east: 0.00045
		};

		const { width, height } = calculateGridDimensions(bounds, 2);

		// Height should be similar (latitude degrees are constant)
		expect(height).toBeGreaterThanOrEqual(20);
		expect(height).toBeLessThanOrEqual(30);

		// Width should be smaller since longitude degrees shrink at higher latitudes
		expect(width).toBeLessThan(height);
	});

	it('returns at least 1 cell in each dimension', () => {
		const tinyBounds: LatLngBounds = {
			south: 0,
			west: 0,
			north: 0.0000001,
			east: 0.0000001
		};

		const { width, height } = calculateGridDimensions(tinyBounds, 10);

		expect(width).toBeGreaterThanOrEqual(1);
		expect(height).toBeGreaterThanOrEqual(1);
	});
});

describe('generateSampleDates', () => {
	it('generates evenly distributed dates', () => {
		const dateRange: DateRange = {
			start: new Date('2024-04-01'),
			end: new Date('2024-10-01')
		};

		const dates = generateSampleDates(dateRange, 6);

		expect(dates).toHaveLength(6);
		expect(dates[0].getTime()).toBeGreaterThan(dateRange.start.getTime());
		expect(dates[dates.length - 1].getTime()).toBeLessThan(dateRange.end.getTime());
	});

	it('handles single sample', () => {
		const dateRange: DateRange = {
			start: new Date('2024-04-01'),
			end: new Date('2024-10-01')
		};

		const dates = generateSampleDates(dateRange, 1);

		expect(dates).toHaveLength(1);
		// Single sample should be at midpoint
		const midpoint = (dateRange.start.getTime() + dateRange.end.getTime()) / 2;
		expect(dates[0].getTime()).toBeCloseTo(midpoint, -3); // within 1 second
	});

	it('spreads samples across months for a growing season', () => {
		const dateRange: DateRange = {
			start: new Date('2024-04-01'),
			end: new Date('2024-09-30')
		};

		const dates = generateSampleDates(dateRange, 12);

		expect(dates).toHaveLength(12);

		// First sample should be in early April
		expect(dates[0].getMonth()).toBe(3); // April (0-indexed)

		// Last sample should be in late September
		expect(dates[11].getMonth()).toBe(8); // September
	});
});

describe('getCellCenter', () => {
	it('returns center of first cell (southwest corner)', () => {
		const bounds: LatLngBounds = {
			south: 40,
			west: -74,
			north: 41,
			east: -73
		};

		const center = getCellCenter(bounds, 0, 0, 10, 10);

		// Cell (0,0) center should be at 1/20 of the way from south/west
		expect(center.lat).toBeCloseTo(40.05, 2);
		expect(center.lng).toBeCloseTo(-73.95, 2);
	});

	it('returns center of last cell (northeast corner)', () => {
		const bounds: LatLngBounds = {
			south: 40,
			west: -74,
			north: 41,
			east: -73
		};

		const center = getCellCenter(bounds, 9, 9, 10, 10);

		// Cell (9,9) center should be at 19/20 of the way from south/west
		expect(center.lat).toBeCloseTo(40.95, 2);
		expect(center.lng).toBeCloseTo(-73.05, 2);
	});
});

describe('calculateExposureGrid', () => {
	it('calculates exposure for a small grid without trees', () => {
		const bounds: LatLngBounds = {
			south: 40.7,
			west: -74.0,
			north: 40.7005,
			east: -73.9995
		};

		const dateRange: DateRange = {
			start: new Date('2024-06-01'),
			end: new Date('2024-06-30')
		};

		const config: GridConfig = {
			resolution: 10,
			sampleDays: 3,
			timeIntervalMinutes: 60
		};

		const grid = calculateExposureGrid(bounds, [], dateRange, config);

		expect(grid.width).toBeGreaterThanOrEqual(1);
		expect(grid.height).toBeGreaterThanOrEqual(1);
		expect(grid.values.length).toBe(grid.width * grid.height);
		expect(grid.sampleDaysUsed).toBe(3);

		// All cells should have positive sun hours in June at this latitude
		for (let i = 0; i < grid.values.length; i++) {
			expect(grid.values[i]).toBeGreaterThan(0);
		}
	});

	it('shows reduced sun hours in tree shadow areas', () => {
		const bounds: LatLngBounds = {
			south: 40.7,
			west: -74.0,
			north: 40.701,
			east: -73.999
		};

		const trees: MapTreeConfig[] = [
			{
				id: 'tree-1',
				lat: 40.7005,
				lng: -73.9995,
				type: 'deciduous-tree',
				height: 10,
				canopyWidth: 8
			}
		];

		const dateRange: DateRange = {
			start: new Date('2024-06-15'),
			end: new Date('2024-06-15')
		};

		const config: GridConfig = {
			resolution: 5,
			sampleDays: 1,
			timeIntervalMinutes: 30
		};

		const gridNoTrees = calculateExposureGrid(bounds, [], dateRange, config);
		const gridWithTrees = calculateExposureGrid(bounds, trees, dateRange, config);

		// Find the minimum value in each grid (most shaded cell)
		const minNoTrees = Math.min(...Array.from(gridNoTrees.values));
		const minWithTrees = Math.min(...Array.from(gridWithTrees.values));

		// Grid with trees should have some cells with fewer sun hours
		expect(minWithTrees).toBeLessThan(minNoTrees);
	});

	it('reports progress during calculation', () => {
		const bounds: LatLngBounds = {
			south: 40.7,
			west: -74.0,
			north: 40.7002,
			east: -73.9998
		};

		const dateRange: DateRange = {
			start: new Date('2024-06-01'),
			end: new Date('2024-06-01')
		};

		const config: GridConfig = {
			resolution: 5,
			sampleDays: 1,
			timeIntervalMinutes: 60
		};

		const progressValues: number[] = [];
		const onProgress = (p: number) => progressValues.push(p);

		calculateExposureGrid(bounds, [], dateRange, config, onProgress);

		// Progress should end at 1
		expect(progressValues[progressValues.length - 1]).toBe(1);

		// Progress values should be increasing
		for (let i = 1; i < progressValues.length; i++) {
			expect(progressValues[i]).toBeGreaterThanOrEqual(progressValues[i - 1]);
		}
	});

	it('completes within performance target for residential lot at 2m resolution', () => {
		// Typical residential lot: ~30m x 30m
		const bounds: LatLngBounds = {
			south: 40.7,
			west: -74.0,
			north: 40.70027, // ~30m
			east: -73.99964 // ~30m at this latitude
		};

		const dateRange: DateRange = {
			start: new Date('2024-04-01'),
			end: new Date('2024-09-30')
		};

		const config: GridConfig = {
			resolution: 2,
			sampleDays: 12,
			timeIntervalMinutes: 15
		};

		const grid = calculateExposureGrid(bounds, [], dateRange, config);

		// Should complete in under 5 seconds (we use a generous margin for CI variance)
		expect(grid.computeTimeMs).toBeLessThan(5000);
	});
});

describe('calculateExposureGridAsync', () => {
	it('produces same results as sync version', async () => {
		const bounds: LatLngBounds = {
			south: 40.7,
			west: -74.0,
			north: 40.7003,
			east: -73.9997
		};

		const dateRange: DateRange = {
			start: new Date('2024-06-01'),
			end: new Date('2024-06-15')
		};

		const config: GridConfig = {
			resolution: 10,
			sampleDays: 2,
			timeIntervalMinutes: 60
		};

		const syncGrid = calculateExposureGrid(bounds, [], dateRange, config);
		const asyncGrid = await calculateExposureGridAsync(bounds, [], dateRange, config);

		expect(asyncGrid.width).toBe(syncGrid.width);
		expect(asyncGrid.height).toBe(syncGrid.height);
		expect(asyncGrid.values.length).toBe(syncGrid.values.length);

		// Values should match
		for (let i = 0; i < syncGrid.values.length; i++) {
			expect(asyncGrid.values[i]).toBeCloseTo(syncGrid.values[i], 5);
		}
	});
});

describe('getExposureAt', () => {
	it('returns correct value for valid cell', () => {
		const bounds: LatLngBounds = { south: 0, west: 0, north: 0.001, east: 0.001 };
		const dateRange: DateRange = {
			start: new Date('2024-06-15'),
			end: new Date('2024-06-15')
		};
		const config: GridConfig = { resolution: 50, sampleDays: 1, timeIntervalMinutes: 60 };

		const grid = calculateExposureGrid(bounds, [], dateRange, config);

		const value = getExposureAt(grid, 0, 0);
		expect(value).toBeDefined();
		expect(value).toBeGreaterThan(0);
	});

	it('returns undefined for out-of-bounds cell', () => {
		const bounds: LatLngBounds = { south: 0, west: 0, north: 0.001, east: 0.001 };
		const dateRange: DateRange = {
			start: new Date('2024-06-15'),
			end: new Date('2024-06-15')
		};
		const config: GridConfig = { resolution: 50, sampleDays: 1, timeIntervalMinutes: 60 };

		const grid = calculateExposureGrid(bounds, [], dateRange, config);

		expect(getExposureAt(grid, -1, 0)).toBeUndefined();
		expect(getExposureAt(grid, 0, -1)).toBeUndefined();
		expect(getExposureAt(grid, grid.height, 0)).toBeUndefined();
		expect(getExposureAt(grid, 0, grid.width)).toBeUndefined();
	});
});

describe('getExposureCellAt', () => {
	it('returns cell with correct position and value', () => {
		const bounds: LatLngBounds = {
			south: 40.7,
			west: -74.0,
			north: 40.701,
			east: -73.999
		};
		const dateRange: DateRange = {
			start: new Date('2024-06-15'),
			end: new Date('2024-06-15')
		};
		const config: GridConfig = { resolution: 20, sampleDays: 1, timeIntervalMinutes: 60 };

		const grid = calculateExposureGrid(bounds, [], dateRange, config);
		const cell = getExposureCellAt(grid, 0, 0);

		expect(cell).toBeDefined();
		expect(cell?.row).toBe(0);
		expect(cell?.col).toBe(0);
		expect(cell?.lat).toBeGreaterThan(bounds.south);
		expect(cell?.lat).toBeLessThan(bounds.north);
		expect(cell?.lng).toBeGreaterThan(bounds.west);
		expect(cell?.lng).toBeLessThan(bounds.east);
		expect(cell?.sunHours).toBeGreaterThan(0);
	});
});

describe('findCellAtLatLng', () => {
	it('finds correct cell for a point inside the grid', () => {
		const bounds: LatLngBounds = {
			south: 40.7,
			west: -74.0,
			north: 40.71,
			east: -73.99
		};
		const dateRange: DateRange = {
			start: new Date('2024-06-15'),
			end: new Date('2024-06-15')
		};
		const config: GridConfig = { resolution: 100, sampleDays: 1, timeIntervalMinutes: 60 };

		const grid = calculateExposureGrid(bounds, [], dateRange, config);

		// Point near southwest corner should be in row 0, col 0
		const sw = findCellAtLatLng(grid, 40.701, -73.999);
		expect(sw).toBeDefined();
		expect(sw?.row).toBeGreaterThanOrEqual(0);
		expect(sw?.col).toBeGreaterThanOrEqual(0);

		// Point near northeast corner should be in high row/col
		const ne = findCellAtLatLng(grid, 40.709, -73.991);
		expect(ne).toBeDefined();
		expect(ne?.row).toBeLessThan(grid.height);
		expect(ne?.col).toBeLessThan(grid.width);
	});

	it('returns undefined for points outside bounds', () => {
		const bounds: LatLngBounds = {
			south: 40.7,
			west: -74.0,
			north: 40.71,
			east: -73.99
		};
		const dateRange: DateRange = {
			start: new Date('2024-06-15'),
			end: new Date('2024-06-15')
		};
		const config: GridConfig = { resolution: 100, sampleDays: 1, timeIntervalMinutes: 60 };

		const grid = calculateExposureGrid(bounds, [], dateRange, config);

		expect(findCellAtLatLng(grid, 40.69, -74.0)).toBeUndefined(); // south of bounds
		expect(findCellAtLatLng(grid, 40.72, -74.0)).toBeUndefined(); // north of bounds
		expect(findCellAtLatLng(grid, 40.705, -74.01)).toBeUndefined(); // west of bounds
		expect(findCellAtLatLng(grid, 40.705, -73.98)).toBeUndefined(); // east of bounds
	});
});

describe('getExposureAtLatLng', () => {
	it('returns sun hours for a valid coordinate', () => {
		const bounds: LatLngBounds = {
			south: 40.7,
			west: -74.0,
			north: 40.701,
			east: -73.999
		};
		const dateRange: DateRange = {
			start: new Date('2024-06-15'),
			end: new Date('2024-06-15')
		};
		const config: GridConfig = { resolution: 20, sampleDays: 1, timeIntervalMinutes: 60 };

		const grid = calculateExposureGrid(bounds, [], dateRange, config);
		const sunHours = getExposureAtLatLng(grid, 40.7005, -73.9995);

		expect(sunHours).toBeDefined();
		expect(sunHours).toBeGreaterThan(0);
	});
});

describe('getExposureGridStats', () => {
	it('calculates correct statistics', () => {
		const bounds: LatLngBounds = {
			south: 40.7,
			west: -74.0,
			north: 40.701,
			east: -73.999
		};
		const dateRange: DateRange = {
			start: new Date('2024-06-15'),
			end: new Date('2024-06-15')
		};
		const config: GridConfig = { resolution: 20, sampleDays: 1, timeIntervalMinutes: 60 };

		const grid = calculateExposureGrid(bounds, [], dateRange, config);
		const stats = getExposureGridStats(grid);

		expect(stats.min).toBeLessThanOrEqual(stats.max);
		expect(stats.mean).toBeGreaterThanOrEqual(stats.min);
		expect(stats.mean).toBeLessThanOrEqual(stats.max);
		expect(stats.stdDev).toBeGreaterThanOrEqual(0);
	});

	it('returns zeros for empty grid', () => {
		const emptyGrid = {
			bounds: { south: 0, west: 0, north: 0, east: 0 },
			resolution: 1,
			width: 0,
			height: 0,
			values: new Float32Array(0),
			dateRange: { start: new Date(), end: new Date() },
			sampleDaysUsed: 0,
			computeTimeMs: 0
		};

		const stats = getExposureGridStats(emptyGrid);

		expect(stats.min).toBe(0);
		expect(stats.max).toBe(0);
		expect(stats.mean).toBe(0);
		expect(stats.stdDev).toBe(0);
	});
});

describe('forEachExposureCell', () => {
	it('iterates over all cells', () => {
		const bounds: LatLngBounds = {
			south: 40.7,
			west: -74.0,
			north: 40.701,
			east: -73.999
		};
		const dateRange: DateRange = {
			start: new Date('2024-06-15'),
			end: new Date('2024-06-15')
		};
		const config: GridConfig = { resolution: 30, sampleDays: 1, timeIntervalMinutes: 60 };

		const grid = calculateExposureGrid(bounds, [], dateRange, config);
		const cells: Array<{ row: number; col: number }> = [];

		forEachExposureCell(grid, (cell) => {
			cells.push({ row: cell.row, col: cell.col });
		});

		expect(cells.length).toBe(grid.width * grid.height);

		// Verify we got all cells
		const expectedCells = new Set<string>();
		for (let r = 0; r < grid.height; r++) {
			for (let c = 0; c < grid.width; c++) {
				expectedCells.add(`${r},${c}`);
			}
		}

		for (const cell of cells) {
			expectedCells.delete(`${cell.row},${cell.col}`);
		}

		expect(expectedCells.size).toBe(0);
	});
});
