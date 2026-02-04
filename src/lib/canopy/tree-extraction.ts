/**
 * Tree extraction algorithm for converting canopy height rasters into discrete tree positions.
 *
 * This module processes height raster data from the Meta/WRI Global Forests dataset
 * and identifies individual trees using local maximum detection. Each detected tree
 * includes position (lat/lng), height, and estimated canopy radius.
 *
 * The algorithm uses a simple but effective approach: scan the raster for pixels that
 * are higher than all neighbors within a search radius. These local maxima represent
 * tree crowns. Canopy radius is estimated using an empirical ratio since we don't have
 * species information from the satellite data.
 */

/**
 * Geographic bounding box in lat/lng coordinates.
 * Uses the standard convention where south < north and west < east.
 */
export interface LatLngBounds {
	south: number;
	north: number;
	west: number;
	east: number;
}

/**
 * A tree detected from canopy height raster data.
 * This structure is compatible with the MapTree interface used by MapPicker,
 * with an additional flag to indicate the tree was auto-detected rather than
 * manually placed by the user.
 */
export interface DetectedTree {
	lat: number;
	lng: number;
	height: number;
	canopyRadius: number;
	/** True if auto-detected from satellite data, false if user-placed */
	autoDetected: boolean;
}

/**
 * Configuration options for tree extraction algorithm.
 */
export interface TreeExtractionOptions {
	/**
	 * Minimum height in meters to consider as a tree.
	 * Pixels below this threshold are ignored to filter out shrubs and noise.
	 * Default: 3 meters
	 */
	minTreeHeight?: number;

	/**
	 * Search radius in pixels for local maximum detection.
	 * A pixel is a local maximum if it's higher than all pixels within this radius.
	 * Larger values reduce false positives in dense canopy but may miss closely-spaced trees.
	 * Default: 3 pixels (3 meters at 1m resolution)
	 */
	searchRadiusPixels?: number;

	/**
	 * Ratio used to estimate canopy radius from tree height.
	 * The formula is: canopyRadius = height * canopyRadiusRatio
	 * Typical values are 0.2-0.3 depending on tree species.
	 * Default: 0.25
	 */
	canopyRadiusRatio?: number;

	/**
	 * Maximum number of trees to extract.
	 * Limits output for performance when processing large or densely forested areas.
	 * Trees are sorted by height (tallest first) before applying the limit.
	 * Default: 500
	 */
	maxTrees?: number;
}

const DEFAULT_OPTIONS: Required<TreeExtractionOptions> = {
	minTreeHeight: 3,
	searchRadiusPixels: 3,
	canopyRadiusRatio: 0.25,
	maxTrees: 500
};

/**
 * Extracts discrete tree positions from a canopy height raster.
 *
 * The algorithm scans the raster to find local maxima, which represent tree crowns.
 * Each local maximum becomes a detected tree with position derived from pixel coordinates
 * and height from the pixel value. Canopy radius is estimated using an empirical ratio.
 *
 * The input raster should contain height values in meters where 0 or negative values
 * indicate no vegetation (or NoData). The bounds parameter maps pixel coordinates to
 * geographic coordinates, assuming the raster covers the bounds exactly with no rotation.
 *
 * @param heightRaster - Float32Array of height values in meters, row-major order
 * @param rasterWidth - Width of the raster in pixels
 * @param rasterHeight - Height of the raster in pixels
 * @param bounds - Geographic bounds that the raster covers
 * @param options - Configuration options for the extraction algorithm
 * @returns Array of detected trees sorted by height (tallest first)
 *
 * @example
 * ```typescript
 * // Extract trees from a 200x200 pixel raster
 * const trees = extractTrees(
 *   heightData,
 *   200,
 *   200,
 *   { south: 37.77, north: 37.78, west: -122.42, east: -122.41 },
 *   { minTreeHeight: 5 }
 * );
 * ```
 */
export function extractTrees(
	heightRaster: Float32Array,
	rasterWidth: number,
	rasterHeight: number,
	bounds: LatLngBounds,
	options: TreeExtractionOptions = {}
): DetectedTree[] {
	const opts = { ...DEFAULT_OPTIONS, ...options };

	// Validate inputs
	if (heightRaster.length !== rasterWidth * rasterHeight) {
		throw new Error(
			`Raster size mismatch: expected ${rasterWidth * rasterHeight} pixels, got ${heightRaster.length}`
		);
	}
	if (rasterWidth < 1 || rasterHeight < 1) {
		throw new Error('Raster dimensions must be positive');
	}
	if (bounds.north <= bounds.south || bounds.east <= bounds.west) {
		throw new Error('Invalid bounds: north must be > south and east must be > west');
	}

	// Find all local maxima that meet the height threshold
	const candidates: Array<{ x: number; y: number; height: number }> = [];

	for (let y = 0; y < rasterHeight; y++) {
		for (let x = 0; x < rasterWidth; x++) {
			const height = heightRaster[y * rasterWidth + x];

			// Skip pixels below minimum height or invalid values
			if (height < opts.minTreeHeight || !isFinite(height)) {
				continue;
			}

			// Check if this pixel is a local maximum within the search radius
			if (isLocalMaximum(heightRaster, rasterWidth, rasterHeight, x, y, opts.searchRadiusPixels)) {
				candidates.push({ x, y, height });
			}
		}
	}

	// Sort by height descending (tallest trees first)
	candidates.sort((a, b) => b.height - a.height);

	// Apply maximum tree limit
	const limitedCandidates = candidates.slice(0, opts.maxTrees);

	// Convert pixel coordinates to lat/lng and create DetectedTree objects
	const degreesPerPixelLat = (bounds.north - bounds.south) / rasterHeight;
	const degreesPerPixelLng = (bounds.east - bounds.west) / rasterWidth;

	return limitedCandidates.map((candidate) => ({
		// Pixel (0,0) is top-left, so y increases southward
		// Add 0.5 to center the coordinate within the pixel
		lat: bounds.north - (candidate.y + 0.5) * degreesPerPixelLat,
		lng: bounds.west + (candidate.x + 0.5) * degreesPerPixelLng,
		height: candidate.height,
		canopyRadius: candidate.height * opts.canopyRadiusRatio,
		autoDetected: true
	}));
}

/**
 * Checks if a pixel is a local maximum within the given search radius.
 *
 * A pixel is a local maximum if its value is strictly greater than all other pixels
 * within the circular search region. Ties are broken by position to ensure deterministic
 * results: the pixel with smaller y (then smaller x) wins.
 *
 * @param raster - Height raster data
 * @param width - Raster width
 * @param height - Raster height
 * @param cx - Center x coordinate to check
 * @param cy - Center y coordinate to check
 * @param radius - Search radius in pixels
 * @returns True if the center pixel is a local maximum
 */
function isLocalMaximum(
	raster: Float32Array,
	width: number,
	height: number,
	cx: number,
	cy: number,
	radius: number
): boolean {
	const centerValue = raster[cy * width + cx];

	// Check all pixels within the circular radius
	for (let dy = -radius; dy <= radius; dy++) {
		for (let dx = -radius; dx <= radius; dx++) {
			// Skip the center pixel itself
			if (dx === 0 && dy === 0) continue;

			// Check if this offset is within the circular radius
			if (dx * dx + dy * dy > radius * radius) continue;

			const nx = cx + dx;
			const ny = cy + dy;

			// Skip out-of-bounds pixels
			if (nx < 0 || nx >= width || ny < 0 || ny >= height) continue;

			const neighborValue = raster[ny * width + nx];

			// If any neighbor is higher, this is not a local maximum
			if (neighborValue > centerValue) {
				return false;
			}

			// Handle ties: the pixel with smaller y wins (then smaller x)
			// This ensures deterministic results and avoids detecting the same tree twice
			if (neighborValue === centerValue) {
				if (ny < cy || (ny === cy && nx < cx)) {
					return false;
				}
			}
		}
	}

	return true;
}

/**
 * Estimates canopy radius by analyzing the height falloff around a tree crown.
 *
 * This function provides a more accurate canopy radius estimate than the simple
 * height-based heuristic by measuring where the canopy height drops to a threshold
 * percentage of the peak height. It's more computationally expensive but useful
 * when higher accuracy is needed.
 *
 * @param raster - Height raster data
 * @param width - Raster width
 * @param height - Raster height
 * @param cx - Tree crown x coordinate (local maximum)
 * @param cy - Tree crown y coordinate (local maximum)
 * @param maxSearchRadius - Maximum radius to search in pixels
 * @param heightThreshold - Fraction of peak height that defines canopy edge (default 0.5)
 * @returns Estimated canopy radius in pixels
 */
export function estimateCanopyRadiusFromRaster(
	raster: Float32Array,
	width: number,
	height: number,
	cx: number,
	cy: number,
	maxSearchRadius: number = 15,
	heightThreshold: number = 0.5
): number {
	const peakHeight = raster[cy * width + cx];
	const thresholdHeight = peakHeight * heightThreshold;

	// Sample in 8 cardinal and diagonal directions and find where height drops below threshold
	const directions = [
		[1, 0],
		[1, 1],
		[0, 1],
		[-1, 1],
		[-1, 0],
		[-1, -1],
		[0, -1],
		[1, -1]
	];

	let radiusSum = 0;
	let validDirections = 0;

	for (const [dx, dy] of directions) {
		// Normalize direction vector for diagonal directions
		const length = Math.sqrt(dx * dx + dy * dy);
		const ndx = dx / length;
		const ndy = dy / length;

		// Walk outward from the peak until height drops below threshold
		for (let step = 1; step <= maxSearchRadius; step++) {
			const px = Math.round(cx + ndx * step);
			const py = Math.round(cy + ndy * step);

			// Check bounds
			if (px < 0 || px >= width || py < 0 || py >= height) {
				radiusSum += step - 1;
				validDirections++;
				break;
			}

			const pixelHeight = raster[py * width + px];

			if (pixelHeight < thresholdHeight || step === maxSearchRadius) {
				radiusSum += step;
				validDirections++;
				break;
			}
		}
	}

	// Return average radius across all directions, with minimum of 1
	return validDirections > 0 ? Math.max(1, radiusSum / validDirections) : 1;
}

/**
 * Extracts trees with raster-based canopy radius estimation.
 *
 * This variant of extractTrees uses the height falloff analysis to estimate
 * canopy radius rather than the simple height-based heuristic. It produces
 * more accurate canopy sizes but is more computationally expensive.
 *
 * @param heightRaster - Float32Array of height values in meters
 * @param rasterWidth - Width of the raster in pixels
 * @param rasterHeight - Height of the raster in pixels
 * @param bounds - Geographic bounds that the raster covers
 * @param pixelResolution - Meters per pixel (default 1.0 for Meta dataset)
 * @param options - Configuration options for the extraction algorithm
 * @returns Array of detected trees with raster-derived canopy radii
 */
export function extractTreesWithRasterRadius(
	heightRaster: Float32Array,
	rasterWidth: number,
	rasterHeight: number,
	bounds: LatLngBounds,
	pixelResolution: number = 1.0,
	options: TreeExtractionOptions = {}
): DetectedTree[] {
	const opts = { ...DEFAULT_OPTIONS, ...options };

	// Validate inputs
	if (heightRaster.length !== rasterWidth * rasterHeight) {
		throw new Error(
			`Raster size mismatch: expected ${rasterWidth * rasterHeight} pixels, got ${heightRaster.length}`
		);
	}

	// Find all local maxima that meet the height threshold
	const candidates: Array<{ x: number; y: number; height: number }> = [];

	for (let y = 0; y < rasterHeight; y++) {
		for (let x = 0; x < rasterWidth; x++) {
			const height = heightRaster[y * rasterWidth + x];

			if (height < opts.minTreeHeight || !isFinite(height)) {
				continue;
			}

			if (isLocalMaximum(heightRaster, rasterWidth, rasterHeight, x, y, opts.searchRadiusPixels)) {
				candidates.push({ x, y, height });
			}
		}
	}

	// Sort by height descending and apply limit
	candidates.sort((a, b) => b.height - a.height);
	const limitedCandidates = candidates.slice(0, opts.maxTrees);

	// Convert coordinates and estimate canopy radius from raster
	const degreesPerPixelLat = (bounds.north - bounds.south) / rasterHeight;
	const degreesPerPixelLng = (bounds.east - bounds.west) / rasterWidth;

	return limitedCandidates.map((candidate) => {
		const radiusPixels = estimateCanopyRadiusFromRaster(
			heightRaster,
			rasterWidth,
			rasterHeight,
			candidate.x,
			candidate.y
		);
		const radiusMeters = radiusPixels * pixelResolution;

		return {
			lat: bounds.north - (candidate.y + 0.5) * degreesPerPixelLat,
			lng: bounds.west + (candidate.x + 0.5) * degreesPerPixelLng,
			height: candidate.height,
			// Use raster-derived radius, but fall back to heuristic if it seems unreasonable
			canopyRadius: radiusMeters > 0 && radiusMeters < candidate.height ? radiusMeters : candidate.height * opts.canopyRadiusRatio,
			autoDetected: true
		};
	});
}

/**
 * Converts a DetectedTree to the MapTree format used by MapPicker.
 *
 * This utility function bridges the gap between the output of tree extraction
 * and the input format expected by the map component. It generates a unique ID
 * and determines tree type based on height heuristics since the satellite data
 * doesn't include species information.
 *
 * @param tree - Detected tree from extraction algorithm
 * @param idPrefix - Prefix for generated IDs (default "auto")
 * @param index - Index used for ID generation
 * @returns Tree object compatible with MapTree interface
 */
export function toMapTree(
	tree: DetectedTree,
	idPrefix: string = 'auto',
	index: number = 0
): {
	id: string;
	lat: number;
	lng: number;
	type: 'deciduous-tree' | 'evergreen-tree';
	label: string;
	height: number;
	canopyWidth: number;
	source: 'auto' | 'manual';
} {
	// Heuristic: taller trees with smaller canopy ratio are more likely evergreen
	// This is a rough approximation since we don't have species data
	const canopyRatio = tree.canopyRadius / tree.height;
	const type: 'deciduous-tree' | 'evergreen-tree' =
		tree.height > 15 && canopyRatio < 0.22 ? 'evergreen-tree' : 'deciduous-tree';

	const sizeLabel =
		tree.height < 8 ? 'Small' : tree.height < 15 ? 'Medium' : tree.height < 25 ? 'Large' : 'Tall';
	const typeLabel = type === 'evergreen-tree' ? 'evergreen' : 'tree';

	return {
		id: `${idPrefix}-${index}`,
		lat: tree.lat,
		lng: tree.lng,
		type,
		label: `${sizeLabel} ${typeLabel} (auto-detected)`,
		height: tree.height,
		canopyWidth: tree.canopyRadius * 2, // MapTree uses diameter, DetectedTree uses radius
		source: 'auto'
	};
}

/**
 * Batch converts detected trees to MapTree format.
 *
 * @param trees - Array of detected trees
 * @param idPrefix - Prefix for generated IDs
 * @returns Array of MapTree-compatible objects
 */
export function toMapTrees(
	trees: DetectedTree[],
	idPrefix: string = 'auto'
): Array<{
	id: string;
	lat: number;
	lng: number;
	type: 'deciduous-tree' | 'evergreen-tree';
	label: string;
	height: number;
	canopyWidth: number;
	source: 'auto' | 'manual';
}> {
	return trees.map((tree, i) => toMapTree(tree, idPrefix, i));
}
