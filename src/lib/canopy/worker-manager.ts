/**
 * Worker manager for offloading tree extraction to a web worker.
 *
 * This module provides a promise-based API for extracting trees without blocking the
 * main thread. It handles worker lifecycle, request tracking, and graceful fallback
 * to synchronous execution when web workers aren't available.
 *
 * The manager creates the worker lazily on first use and reuses it for all subsequent
 * requests. Pending requests are tracked so responses can be matched to their callers.
 */

import { browser } from '$app/environment';
import { extractTrees, type TreeExtractionOptions, type DetectedTree, type LatLngBounds } from './tree-extraction.js';
import type { ExtractTreesRequest, ExtractTreesResponse } from './tree-extraction.worker.js';

/**
 * Tracks a pending extraction request.
 */
interface PendingRequest {
	resolve: (result: { trees: DetectedTree[]; elapsedMs: number }) => void;
	reject: (error: Error) => void;
	startTime: number;
}

// Singleton worker instance, created lazily
let worker: Worker | null = null;

// Map of pending requests by ID
const pendingRequests = new Map<string, PendingRequest>();

// Counter for generating unique request IDs
let requestCounter = 0;

// Track whether worker is supported
let workerSupported: boolean | null = null;

/**
 * Checks if web workers are supported in the current environment.
 * Returns false during SSR or in environments without Worker support.
 */
function isWorkerSupported(): boolean {
	if (workerSupported !== null) return workerSupported;

	if (!browser) {
		workerSupported = false;
		return false;
	}

	try {
		workerSupported = typeof Worker !== 'undefined';
	} catch {
		workerSupported = false;
	}

	return workerSupported;
}

/**
 * Creates the web worker instance if not already created.
 * Returns null if workers aren't supported.
 */
function getWorker(): Worker | null {
	if (!isWorkerSupported()) return null;
	if (worker) return worker;

	try {
		// Create worker using Vite's worker import syntax
		worker = new Worker(new URL('./tree-extraction.worker.ts', import.meta.url), {
			type: 'module'
		});

		// Set up message handler
		worker.onmessage = (event: MessageEvent<ExtractTreesResponse>) => {
			const response = event.data;

			if (response.type === 'extract-trees-result') {
				const pending = pendingRequests.get(response.requestId);
				if (pending) {
					pendingRequests.delete(response.requestId);

					if (response.error) {
						pending.reject(new Error(response.error));
					} else {
						pending.resolve({
							trees: response.trees,
							elapsedMs: response.elapsedMs
						});
					}
				}
			}
		};

		// Handle worker errors
		worker.onerror = (event) => {
			console.error('Tree extraction worker error:', event.message);
			// Reject all pending requests
			for (const [requestId, pending] of pendingRequests) {
				pending.reject(new Error(`Worker error: ${event.message}`));
				pendingRequests.delete(requestId);
			}
		};

		return worker;
	} catch (error) {
		console.warn('Failed to create tree extraction worker, falling back to sync:', error);
		workerSupported = false;
		return null;
	}
}

/**
 * Extracts trees from a height raster, using a web worker when available.
 *
 * This function provides the same interface as the synchronous extractTrees function,
 * but returns a promise and offloads the work to a web worker when possible. If workers
 * aren't available, it falls back to synchronous execution on the main thread.
 *
 * @param heights - Float32Array of height values in meters
 * @param width - Width of the raster in pixels
 * @param height - Height of the raster in pixels
 * @param bounds - Geographic bounds of the raster
 * @param options - Extraction options (minTreeHeight, searchRadiusPixels, etc.)
 * @returns Promise resolving to detected trees and elapsed time
 *
 * @example
 * ```typescript
 * const result = await extractTreesAsync(heights, 200, 200, bounds, { maxTrees: 100 });
 * console.log(`Found ${result.trees.length} trees in ${result.elapsedMs}ms`);
 * ```
 */
export async function extractTreesAsync(
	heights: Float32Array,
	width: number,
	height: number,
	bounds: LatLngBounds,
	options?: TreeExtractionOptions
): Promise<{ trees: DetectedTree[]; elapsedMs: number }> {
	const workerInstance = getWorker();

	// Fall back to sync execution if worker not available
	if (!workerInstance) {
		const startTime = performance.now();
		const trees = extractTrees(heights, width, height, bounds, options);
		const elapsedMs = performance.now() - startTime;
		return { trees, elapsedMs };
	}

	// Create a unique request ID
	const requestId = `extract-${++requestCounter}`;

	// Create the request message
	const request: ExtractTreesRequest = {
		type: 'extract-trees',
		requestId,
		heights,
		width,
		height,
		bounds,
		options
	};

	// Return a promise that resolves when the worker responds
	return new Promise((resolve, reject) => {
		pendingRequests.set(requestId, {
			resolve,
			reject,
			startTime: performance.now()
		});

		// Send message to worker (heights is transferable but we'll copy for simplicity)
		workerInstance.postMessage(request);
	});
}

/**
 * Terminates the worker and clears all pending requests.
 * Call this when cleaning up to free resources.
 */
export function terminateWorker(): void {
	if (worker) {
		worker.terminate();
		worker = null;
	}

	// Reject all pending requests
	for (const [, pending] of pendingRequests) {
		pending.reject(new Error('Worker terminated'));
	}
	pendingRequests.clear();
}

/**
 * Returns the number of pending requests.
 * Useful for debugging and monitoring.
 */
export function getPendingRequestCount(): number {
	return pendingRequests.size;
}

/**
 * Returns whether the worker is active.
 */
export function isWorkerActive(): boolean {
	return worker !== null;
}
