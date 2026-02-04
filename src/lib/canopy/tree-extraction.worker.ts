/**
 * Web worker for tree extraction algorithm.
 *
 * This worker offloads the CPU-intensive tree extraction computation from the main
 * thread, ensuring the UI remains responsive even when processing large raster areas.
 * Communication uses the standard postMessage/onmessage pattern with typed messages.
 */

import { extractTrees, type TreeExtractionOptions, type DetectedTree, type LatLngBounds } from './tree-extraction.js';

/**
 * Message format for tree extraction requests.
 */
export interface ExtractTreesRequest {
	type: 'extract-trees';
	requestId: string;
	heights: Float32Array;
	width: number;
	height: number;
	bounds: LatLngBounds;
	options?: TreeExtractionOptions;
}

/**
 * Message format for extraction results.
 */
export interface ExtractTreesResponse {
	type: 'extract-trees-result';
	requestId: string;
	trees: DetectedTree[];
	elapsedMs: number;
	error?: string;
}

/**
 * Union type for all worker messages.
 */
export type WorkerMessage = ExtractTreesRequest;
export type WorkerResponse = ExtractTreesResponse;

// Handle incoming messages
self.onmessage = (event: MessageEvent<WorkerMessage>) => {
	const message = event.data;

	if (message.type === 'extract-trees') {
		const startTime = performance.now();
		try {
			const trees = extractTrees(
				message.heights,
				message.width,
				message.height,
				message.bounds,
				message.options
			);

			const elapsedMs = performance.now() - startTime;

			const response: ExtractTreesResponse = {
				type: 'extract-trees-result',
				requestId: message.requestId,
				trees,
				elapsedMs
			};

			self.postMessage(response);
		} catch (error) {
			const elapsedMs = performance.now() - startTime;
			const response: ExtractTreesResponse = {
				type: 'extract-trees-result',
				requestId: message.requestId,
				trees: [],
				elapsedMs,
				error: error instanceof Error ? error.message : 'Unknown error'
			};
			self.postMessage(response);
		}
	}
};

// Export empty object to satisfy TypeScript module requirements
export {};
