/**
 * Web Worker for exposure grid calculation.
 *
 * This worker performs the computationally intensive sun-hours grid calculation
 * off the main thread, preventing UI blocking during heatmap updates. It receives
 * calculation parameters via postMessage and returns the completed ExposureGrid.
 */

import {
	calculateExposureGrid,
	type LatLngBounds,
	type DateRange,
	type GridConfig,
	type ExposureGrid
} from '../solar/exposure-grid.js';
import type { MapTreeConfig } from '../solar/shadow-projection.js';

/**
 * Message types for worker communication.
 */
export interface ExposureWorkerRequest {
	type: 'calculate';
	id: string;
	bounds: LatLngBounds;
	trees: MapTreeConfig[];
	dateRange: { start: string; end: string }; // ISO strings for serialization
	config: GridConfig;
}

export interface ExposureWorkerResponse {
	type: 'result' | 'progress' | 'error';
	id: string;
	grid?: ExposureGrid;
	progress?: number;
	error?: string;
}

/**
 * Handle incoming messages from the main thread.
 */
self.onmessage = (event: MessageEvent<ExposureWorkerRequest>) => {
	const { type, id, bounds, trees, dateRange, config } = event.data;

	if (type !== 'calculate') {
		const response: ExposureWorkerResponse = {
			type: 'error',
			id,
			error: `Unknown message type: ${type}`
		};
		self.postMessage(response);
		return;
	}

	try {
		// Convert ISO strings back to Date objects
		const dateRangeParsed: DateRange = {
			start: new Date(dateRange.start),
			end: new Date(dateRange.end)
		};

		// Progress callback that posts updates to the main thread
		const onProgress = (progress: number) => {
			const response: ExposureWorkerResponse = {
				type: 'progress',
				id,
				progress
			};
			self.postMessage(response);
		};

		// Perform the calculation
		const grid = calculateExposureGrid(bounds, trees, dateRangeParsed, config, onProgress);

		// Send the result back
		const response: ExposureWorkerResponse = {
			type: 'result',
			id,
			grid
		};
		self.postMessage(response);
	} catch (error) {
		const response: ExposureWorkerResponse = {
			type: 'error',
			id,
			error: error instanceof Error ? error.message : 'Unknown error during calculation'
		};
		self.postMessage(response);
	}
};
