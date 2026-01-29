/**
 * Shadow polygon calculation for visualization.
 *
 * This module computes the 2D shadow shapes cast by obstacles onto the ground
 * plane given the sun's position. Each obstacle type produces a characteristic
 * shadow shape: trees cast elliptical shadows, buildings cast quadrilateral
 * shadows, and fences cast narrow parallelograms.
 *
 * The shadow length depends on the sun's altitude: lower sun angles produce
 * longer shadows. The shadow direction is opposite the sun's azimuth. When
 * terrain slope is provided, shadows are distorted according to the tilted
 * ground plane intersection.
 */

import type { SolarPosition } from './types.js';
import type { ObstacleType, Obstacle } from './shade-types.js';
import { getTransparency } from './shade-types.js';
import type { PlotSlope } from './slope.js';

/**
 * A 2D point in world coordinates (meters from observation point).
 * X is positive east, Y is positive north.
 */
export interface Point {
	x: number;
	y: number;
}

/**
 * A shadow polygon cast by an obstacle.
 * The vertices form a closed polygon in counter-clockwise order.
 * Shade intensity accounts for obstacle transparency.
 */
export interface ShadowPolygon {
	obstacleId: string;
	obstacleType: ObstacleType;
	vertices: Point[];
	shadeIntensity: number; // 0-1, where 1 is fully opaque shadow
}

/**
 * Extended obstacle type with x,y coordinates for shadow calculation.
 * This matches the PlotObstacle interface from PlotEditor.
 */
export interface PlotObstacle extends Obstacle {
	x: number;
	y: number;
}

/**
 * Converts degrees to radians.
 */
function toRadians(degrees: number): number {
	return degrees * (Math.PI / 180);
}

/**
 * Calculates the shadow length for an object of given height at a given sun altitude.
 * This is the horizontal distance the shadow extends from the base of the object.
 *
 * The formula is: shadowLength = height / tan(altitude)
 *
 * At low sun angles the shadow grows very long, so we clamp to a reasonable
 * maximum (100m) to avoid rendering issues with extremely long shadows near
 * sunrise/sunset.
 */
export function calculateShadowLength(height: number, sunAltitude: number): number {
	if (sunAltitude <= 0) return 0;
	const altRad = toRadians(sunAltitude);
	const length = height / Math.tan(altRad);
	return Math.min(length, 100); // Cap at 100m for rendering sanity
}

/**
 * Calculates the unit direction vector for shadow projection.
 * Shadows extend in the direction opposite the sun's azimuth.
 * Returns {dx, dy} where dx is eastward and dy is northward components.
 */
export function getShadowDirection(sunAzimuth: number): { dx: number; dy: number } {
	const azRad = toRadians(sunAzimuth);
	// Sun azimuth is compass bearing (0=N, 90=E), so:
	// sin(az) gives eastward component, cos(az) gives northward component
	// Negate both to get shadow direction (opposite the sun)
	return {
		dx: -Math.sin(azRad),
		dy: -Math.cos(azRad)
	};
}

/**
 * Adjusts shadow length when projected onto sloped terrain.
 *
 * When shadows fall on sloped ground, they appear longer or shorter depending
 * on whether the shadow extends uphill or downhill. A shadow falling downhill
 * (away from the sun on a sunward-facing slope) appears longer because it
 * intersects the tilted ground plane at a greater distance.
 *
 * For small slopes (under 15°), this adjustment is minor and mostly cosmetic.
 * The math involves finding where the shadow ray intersects the tilted ground
 * plane z = -tan(slope) * (x*sin(aspect) + y*cos(aspect)).
 */
export function adjustShadowLengthForSlope(
	baseLength: number,
	sunAzimuth: number,
	slope?: PlotSlope
): number {
	if (!slope || slope.angle < 0.5) return baseLength;

	const slopeRad = toRadians(slope.angle);
	const aspectRad = toRadians(slope.aspect);
	const azRad = toRadians(sunAzimuth);

	// Shadow direction components (opposite sun direction)
	const shadowDx = -Math.sin(azRad);
	const shadowDy = -Math.cos(azRad);

	// Downhill direction is toward the aspect bearing
	const downhillDx = Math.sin(aspectRad);
	const downhillDy = Math.cos(aspectRad);

	// Dot product: positive when shadow goes downhill, negative when uphill
	const downhillAlignment = shadowDx * downhillDx + shadowDy * downhillDy;

	// Slope factor: how much the ground drops per unit distance in shadow direction
	// Positive when shadow goes downhill (ground drops), negative when uphill
	const slopeFactor = Math.tan(slopeRad) * downhillAlignment;

	// Adjustment factor: shadow appears longer when going downhill (slopeFactor > 0)
	// Using 1/(1-f) because when going downhill, the shadow ray travels farther
	// before hitting the descending ground
	const adjustmentFactor = 1 / Math.max(0.5, 1 - slopeFactor);

	// Clamp to reasonable range (0.5x to 2x original length)
	return baseLength * Math.max(0.5, Math.min(2.0, adjustmentFactor));
}

/**
 * Calculates the shadow polygon for a tree-like circular obstacle.
 *
 * Trees cast elliptical shadows because the circular canopy projects at an
 * angle onto the ground. The ellipse's major axis aligns with the shadow
 * direction, and its length depends on the sun altitude. We approximate
 * the ellipse with a 16-sided polygon.
 *
 * The shadow calculation assumes the canopy is a sphere centered at a height
 * equal to the tree height minus the canopy radius. The trunk is ignored since
 * its shadow is typically hidden within the canopy's shadow.
 */
function calculateTreeShadow(
	obstacle: PlotObstacle,
	sun: SolarPosition,
	slope?: PlotSlope
): ShadowPolygon | null {
	if (sun.altitude <= 0) return null;

	const canopyRadius = obstacle.width / 2;
	// Canopy center is at the top of the tree minus the radius
	const canopyHeight = Math.max(canopyRadius, obstacle.height - canopyRadius);

	const baseShadowLength = calculateShadowLength(canopyHeight, sun.altitude);
	const shadowLength = adjustShadowLengthForSlope(baseShadowLength, sun.azimuth, slope);
	const { dx, dy } = getShadowDirection(sun.azimuth);

	// Generate ellipse vertices (16 segments for smooth curve)
	const vertices: Point[] = [];
	const segments = 16;

	for (let i = 0; i < segments; i++) {
		const angle = (i / segments) * 2 * Math.PI;

		// Local coordinates on the canopy circle
		const localX = canopyRadius * Math.cos(angle);
		const localY = canopyRadius * Math.sin(angle);

		// The shadow of each canopy edge point extends different amounts
		// Points "higher" in the sun's view have longer shadows
		// We approximate this by adding a fraction of the radius to the shadow length
		// for points on the sun-facing side
		const sunwardOffset = localX * dx + localY * dy;
		const pointShadowLength = shadowLength + sunwardOffset * 0.5;

		// Transform to world coordinates: rotate local coords to align with shadow direction
		// and offset by the shadow projection
		const perpDx = -dy; // Perpendicular to shadow direction
		const perpDy = dx;

		vertices.push({
			x: obstacle.x + localX * perpDx + localY * dx + pointShadowLength * dx,
			y: obstacle.y + localX * perpDy + localY * dy + pointShadowLength * dy
		});
	}

	const transparency = getTransparency(obstacle.type);
	return {
		obstacleId: obstacle.id,
		obstacleType: obstacle.type,
		vertices,
		shadeIntensity: 1 - transparency
	};
}

/**
 * Calculates the shadow polygon for a rectangular building.
 *
 * Buildings cast quadrilateral shadows. The shadow extends from the building's
 * footprint along the shadow direction for a distance determined by the building
 * height and sun altitude.
 *
 * The building is treated as a rectangle with its long axis perpendicular to
 * the direction from the observation point. The shadow polygon connects the
 * two far corners of the building base to their shadow projections.
 */
function calculateBuildingShadow(
	obstacle: PlotObstacle,
	sun: SolarPosition,
	slope?: PlotSlope
): ShadowPolygon | null {
	if (sun.altitude <= 0) return null;

	const baseShadowLength = calculateShadowLength(obstacle.height, sun.altitude);
	const shadowLength = adjustShadowLengthForSlope(baseShadowLength, sun.azimuth, slope);
	const { dx, dy } = getShadowDirection(sun.azimuth);

	// Building orientation: width runs perpendicular to the direction from origin
	// The obstacle.direction gives the compass bearing from origin to obstacle center
	const perpAngle = toRadians(obstacle.direction + 90);
	const halfWidth = obstacle.width / 2;

	// The two corners of the building base facing the shadow direction
	const corner1: Point = {
		x: obstacle.x + halfWidth * Math.sin(perpAngle),
		y: obstacle.y + halfWidth * Math.cos(perpAngle)
	};
	const corner2: Point = {
		x: obstacle.x - halfWidth * Math.sin(perpAngle),
		y: obstacle.y - halfWidth * Math.cos(perpAngle)
	};

	// Shadow tips extend from corners
	const shadow1: Point = {
		x: corner1.x + shadowLength * dx,
		y: corner1.y + shadowLength * dy
	};
	const shadow2: Point = {
		x: corner2.x + shadowLength * dx,
		y: corner2.y + shadowLength * dy
	};

	// Quadrilateral: base corners and their shadow projections
	return {
		obstacleId: obstacle.id,
		obstacleType: obstacle.type,
		vertices: [corner1, corner2, shadow2, shadow1],
		shadeIntensity: 1.0 // Buildings are fully opaque
	};
}

/**
 * Calculates the shadow polygon for a fence or hedge (linear obstacle).
 *
 * Fences cast narrow parallelogram shadows. The fence is treated as a line
 * segment of specified width, and the shadow extends from both ends along
 * the shadow direction.
 *
 * Hedges are similar but may have some transparency, which affects the
 * shade intensity.
 */
function calculateFenceShadow(
	obstacle: PlotObstacle,
	sun: SolarPosition,
	slope?: PlotSlope
): ShadowPolygon | null {
	if (sun.altitude <= 0) return null;

	const baseShadowLength = calculateShadowLength(obstacle.height, sun.altitude);
	const shadowLength = adjustShadowLengthForSlope(baseShadowLength, sun.azimuth, slope);
	const { dx, dy } = getShadowDirection(sun.azimuth);

	// Fence orientation: runs perpendicular to the direction from origin
	const perpAngle = toRadians(obstacle.direction + 90);
	const halfWidth = obstacle.width / 2;

	// Fence endpoints
	const end1: Point = {
		x: obstacle.x + halfWidth * Math.sin(perpAngle),
		y: obstacle.y + halfWidth * Math.cos(perpAngle)
	};
	const end2: Point = {
		x: obstacle.x - halfWidth * Math.sin(perpAngle),
		y: obstacle.y - halfWidth * Math.cos(perpAngle)
	};

	// Shadow extends from each endpoint
	const shadow1: Point = {
		x: end1.x + shadowLength * dx,
		y: end1.y + shadowLength * dy
	};
	const shadow2: Point = {
		x: end2.x + shadowLength * dx,
		y: end2.y + shadowLength * dy
	};

	const transparency = getTransparency(obstacle.type);
	return {
		obstacleId: obstacle.id,
		obstacleType: obstacle.type,
		vertices: [end1, end2, shadow2, shadow1],
		shadeIntensity: 1 - transparency
	};
}

/**
 * Calculates the shadow polygon for any obstacle type.
 *
 * Dispatches to the appropriate shape-specific calculation based on obstacle type.
 * Returns null if the sun is below the horizon (no shadows when dark).
 *
 * @param obstacle - The obstacle with x,y position and dimensions
 * @param sun - Current sun position (altitude and azimuth)
 * @param slope - Optional terrain slope for shadow distortion
 * @returns Shadow polygon or null if no shadow (sun below horizon)
 */
export function calculateShadowPolygon(
	obstacle: PlotObstacle,
	sun: SolarPosition,
	slope?: PlotSlope
): ShadowPolygon | null {
	if (sun.altitude <= 0) return null;

	switch (obstacle.type) {
		case 'deciduous-tree':
		case 'evergreen-tree':
			return calculateTreeShadow(obstacle, sun, slope);

		case 'building':
			return calculateBuildingShadow(obstacle, sun, slope);

		case 'fence':
		case 'hedge':
			return calculateFenceShadow(obstacle, sun, slope);

		default:
			// Unknown type, treat as building-like rectangle
			return calculateBuildingShadow(obstacle, sun, slope);
	}
}

/**
 * Calculates shadow polygons for all obstacles in a scene.
 *
 * Filters out null results (obstacles that don't cast shadows at the current
 * sun position). The returned array maintains obstacle order, which is useful
 * for consistent rendering.
 *
 * @param obstacles - Array of obstacles with x,y positions
 * @param sun - Current sun position
 * @param slope - Optional terrain slope
 * @returns Array of shadow polygons, excluding obstacles without shadows
 */
export function calculateAllShadows(
	obstacles: PlotObstacle[],
	sun: SolarPosition,
	slope?: PlotSlope
): ShadowPolygon[] {
	if (sun.altitude <= 0) return [];

	const shadows: ShadowPolygon[] = [];
	for (const obstacle of obstacles) {
		const shadow = calculateShadowPolygon(obstacle, sun, slope);
		if (shadow) {
			shadows.push(shadow);
		}
	}
	return shadows;
}

/**
 * Calculates the bounding box of a shadow polygon.
 * Useful for hit testing and rendering optimizations.
 */
export function getShadowBounds(shadow: ShadowPolygon): {
	minX: number;
	maxX: number;
	minY: number;
	maxY: number;
} {
	if (shadow.vertices.length === 0) {
		return { minX: 0, maxX: 0, minY: 0, maxY: 0 };
	}

	let minX = shadow.vertices[0].x;
	let maxX = shadow.vertices[0].x;
	let minY = shadow.vertices[0].y;
	let maxY = shadow.vertices[0].y;

	for (let i = 1; i < shadow.vertices.length; i++) {
		const v = shadow.vertices[i];
		if (v.x < minX) minX = v.x;
		if (v.x > maxX) maxX = v.x;
		if (v.y < minY) minY = v.y;
		if (v.y > maxY) maxY = v.y;
	}

	return { minX, maxX, minY, maxY };
}

/**
 * Checks if a point is inside a shadow polygon using the ray casting algorithm.
 * Useful for determining if a specific location is shaded.
 */
export function isPointInShadow(point: Point, shadow: ShadowPolygon): boolean {
	const { vertices } = shadow;
	const n = vertices.length;
	if (n < 3) return false;

	let inside = false;
	for (let i = 0, j = n - 1; i < n; j = i++) {
		const xi = vertices[i].x;
		const yi = vertices[i].y;
		const xj = vertices[j].x;
		const yj = vertices[j].y;

		if (yi > point.y !== yj > point.y && point.x < ((xj - xi) * (point.y - yi)) / (yj - yi) + xi) {
			inside = !inside;
		}
	}

	return inside;
}
