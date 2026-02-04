/**
 * Shadow polygon calculation for visualization using ray-tracing approach.
 *
 * This module computes shadow shapes by projecting obstacle silhouettes onto
 * the ground plane using sun ray intersection. Each point on an obstacle's
 * outline is traced along the sun ray direction until it hits the ground,
 * producing realistic shadow shapes that respect terrain slope.
 *
 * Trees project their actual silhouette (trunk + cone-shaped canopy) rather
 * than simple ellipses. Buildings and fences project their 3D outlines.
 * When terrain is sloped, shadows correctly distort as rays intersect the
 * tilted ground plane at different distances.
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
 * A 3D point in world coordinates.
 * X is positive east, Y is positive north, Z is up.
 */
interface Point3D {
	x: number;
	y: number;
	z: number;
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
 * Calculates the sun ray direction vector (unit vector pointing toward the sun).
 * This is the direction light travels FROM, so shadows project in the opposite direction.
 */
function getSunRayDirection(sun: SolarPosition): Point3D {
	const altRad = toRadians(sun.altitude);
	const azRad = toRadians(sun.azimuth);

	// Azimuth is compass bearing: 0=N, 90=E
	// Horizontal components point toward the sun
	const horizontal = Math.cos(altRad);
	return {
		x: horizontal * Math.sin(azRad), // East component
		y: horizontal * Math.cos(azRad), // North component
		z: Math.sin(altRad) // Up component
	};
}

/**
 * Projects a 3D point onto the ground plane by tracing a ray from the point
 * in the direction opposite to the sun (shadow direction).
 *
 * For flat terrain (z=0), this is straightforward geometry.
 * For sloped terrain, the ground plane is z = -tan(slope) * (x*sin(aspect) + y*cos(aspect)),
 * and we solve for the intersection point.
 *
 * Returns the 2D ground intersection point, or null if the ray doesn't hit
 * the ground (e.g., sun below horizon or point already below ground).
 */
function projectPointToGround(
	point: Point3D,
	sun: SolarPosition,
	slope?: PlotSlope
): Point | null {
	if (sun.altitude <= 0) return null;

	// Points at or below ground level project to themselves
	if (point.z <= 0) {
		return { x: point.x, y: point.y };
	}

	const sunDir = getSunRayDirection(sun);

	// Shadow ray direction is opposite to sun direction
	const rayDx = -sunDir.x;
	const rayDy = -sunDir.y;
	const rayDz = -sunDir.z;

	// For flat ground (z = 0):
	// point.z + t * rayDz = 0
	// t = -point.z / rayDz
	if (!slope || slope.angle < 0.5) {
		if (rayDz >= 0) return null; // Ray going up, won't hit ground
		const t = -point.z / rayDz;
		if (t < 0) return null;
		// Clamp shadow length to avoid extreme values near sunrise/sunset
		const clampedT = Math.min(t, 100 / Math.abs(rayDz));
		return {
			x: point.x + clampedT * rayDx,
			y: point.y + clampedT * rayDy
		};
	}

	// For sloped ground: aspect is the direction the slope FACES (uphill direction)
	// Ground is higher in the aspect direction, so: z = tan(slopeAngle) * (x*sin(aspect) + y*cos(aspect))
	// Let's call this: z = a*x + b*y where:
	//   a = tan(slopeAngle) * sin(aspect)
	//   b = tan(slopeAngle) * cos(aspect)
	//
	// Ray: P(t) = point + t * ray
	// Ground: z = a*x + b*y
	//
	// Substituting:
	// point.z + t*rayDz = a*(point.x + t*rayDx) + b*(point.y + t*rayDy)
	// point.z + t*rayDz = a*point.x + a*t*rayDx + b*point.y + b*t*rayDy
	// point.z - a*point.x - b*point.y = t*(a*rayDx + b*rayDy - rayDz)
	// t = (point.z - a*point.x - b*point.y) / (a*rayDx + b*rayDy - rayDz)

	const slopeRad = toRadians(slope.angle);
	const aspectRad = toRadians(slope.aspect);
	const tanSlope = Math.tan(slopeRad);

	const a = tanSlope * Math.sin(aspectRad);
	const b = tanSlope * Math.cos(aspectRad);

	const denominator = a * rayDx + b * rayDy - rayDz;
	if (Math.abs(denominator) < 0.0001) {
		// Ray nearly parallel to ground plane
		return null;
	}

	const numerator = point.z - a * point.x - b * point.y;
	const t = numerator / denominator;

	if (t < 0) return null; // Intersection behind the point

	// Clamp to reasonable distance
	const clampedT = Math.min(t, 150);

	return {
		x: point.x + clampedT * rayDx,
		y: point.y + clampedT * rayDy
	};
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
 * plane z = tan(slope) * (x*sin(aspect) + y*cos(aspect)).
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

	// Downhill direction is OPPOSITE to aspect (aspect is the facing/uphill direction)
	const downhillDx = -Math.sin(aspectRad);
	const downhillDy = -Math.cos(aspectRad);

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
 * Generates the 3D silhouette points of a tree as seen from the sun's direction.
 *
 * The tree silhouette consists of:
 * - Trunk: a vertical rectangle from ground to canopy base
 * - Canopy: a cone/lollipop shape tapering toward the top
 *
 * We generate points along the left and right edges of this silhouette,
 * which will be projected onto the ground to form the shadow.
 */
function getTreeSilhouettePoints(obstacle: PlotObstacle, sun: SolarPosition): Point3D[] {
	const canopyRadius = obstacle.width / 2;
	const treeHeight = obstacle.height;
	const trunkHeight = Math.max(0, treeHeight - canopyRadius * 2);
	const trunkRadius = canopyRadius * 0.15; // Trunk is about 15% of canopy width

	// Sun direction determines which side of the tree is the "left" and "right" silhouette
	const azRad = toRadians(sun.azimuth);
	// Perpendicular to sun direction (left side when facing sun)
	const perpX = -Math.cos(azRad);
	const perpY = Math.sin(azRad);

	const points: Point3D[] = [];

	// Start at ground level, left side of trunk
	points.push({
		x: obstacle.x + perpX * trunkRadius,
		y: obstacle.y + perpY * trunkRadius,
		z: 0
	});

	// Up the left side of trunk to canopy base
	points.push({
		x: obstacle.x + perpX * trunkRadius,
		y: obstacle.y + perpY * trunkRadius,
		z: trunkHeight
	});

	// Left side of canopy (cone shape - widest at bottom, narrow at top)
	const canopySegments = 6;
	for (let i = 0; i <= canopySegments; i++) {
		const t = i / canopySegments; // 0 at bottom of canopy, 1 at top
		const z = trunkHeight + t * (treeHeight - trunkHeight);
		// Cone profile: radius decreases linearly from canopyRadius to ~10% at top
		const radius = canopyRadius * (1 - t * 0.9);
		points.push({
			x: obstacle.x + perpX * radius,
			y: obstacle.y + perpY * radius,
			z
		});
	}

	// Top of tree (apex)
	points.push({
		x: obstacle.x,
		y: obstacle.y,
		z: treeHeight
	});

	// Right side of canopy (going back down)
	for (let i = canopySegments; i >= 0; i--) {
		const t = i / canopySegments;
		const z = trunkHeight + t * (treeHeight - trunkHeight);
		const radius = canopyRadius * (1 - t * 0.9);
		points.push({
			x: obstacle.x - perpX * radius,
			y: obstacle.y - perpY * radius,
			z
		});
	}

	// Right side of trunk down to ground
	points.push({
		x: obstacle.x - perpX * trunkRadius,
		y: obstacle.y - perpY * trunkRadius,
		z: trunkHeight
	});

	points.push({
		x: obstacle.x - perpX * trunkRadius,
		y: obstacle.y - perpY * trunkRadius,
		z: 0
	});

	return points;
}

/**
 * Calculates the shadow polygon for a tree using ray-traced silhouette projection.
 *
 * The tree's silhouette (as seen from the sun's direction) is projected onto
 * the ground plane by tracing rays from each silhouette point. This produces
 * realistic tree-shaped shadows rather than simple ellipses.
 */
function calculateTreeShadow(
	obstacle: PlotObstacle,
	sun: SolarPosition,
	slope?: PlotSlope
): ShadowPolygon | null {
	if (sun.altitude <= 0) return null;

	// Get 3D silhouette points
	const silhouettePoints = getTreeSilhouettePoints(obstacle, sun);

	// Project each point onto the ground
	const vertices: Point[] = [];
	for (const point3d of silhouettePoints) {
		const groundPoint = projectPointToGround(point3d, sun, slope);
		if (groundPoint) {
			vertices.push(groundPoint);
		}
	}

	// Need at least 3 points to form a polygon
	if (vertices.length < 3) return null;

	// Remove duplicate/very close points that can occur at ground level
	const filteredVertices = removeDuplicatePoints(vertices);

	if (filteredVertices.length < 3) return null;

	const transparency = getTransparency(obstacle.type);
	return {
		obstacleId: obstacle.id,
		obstacleType: obstacle.type,
		vertices: filteredVertices,
		shadeIntensity: 1 - transparency
	};
}

/**
 * Removes duplicate or very close points from a vertex array.
 */
function removeDuplicatePoints(points: Point[], threshold = 0.01): Point[] {
	if (points.length === 0) return [];

	const result: Point[] = [points[0]];
	for (let i = 1; i < points.length; i++) {
		const prev = result[result.length - 1];
		const curr = points[i];
		const dist = Math.hypot(curr.x - prev.x, curr.y - prev.y);
		if (dist > threshold) {
			result.push(curr);
		}
	}
	return result;
}

/**
 * Calculates the shadow polygon for a rectangular building using ray tracing.
 *
 * Buildings are treated as extruded rectangles. We trace the outline of the
 * building (base corners and top corners) to create a shadow polygon that
 * properly intersects the ground plane.
 */
function calculateBuildingShadow(
	obstacle: PlotObstacle,
	sun: SolarPosition,
	slope?: PlotSlope
): ShadowPolygon | null {
	if (sun.altitude <= 0) return null;

	const h = obstacle.height;
	const halfWidth = obstacle.width / 2;
	const depth = 3; // Buildings have some depth

	// Building orientation: width runs perpendicular to the direction from origin
	const perpAngle = toRadians(obstacle.direction + 90);
	const perpX = Math.sin(perpAngle);
	const perpY = Math.cos(perpAngle);

	// Direction toward origin (for depth)
	const dirAngle = toRadians(obstacle.direction);
	const dirX = Math.sin(dirAngle);
	const dirY = Math.cos(dirAngle);

	// Four corners of the building footprint
	const corners = [
		{ x: obstacle.x - halfWidth * perpX - depth / 2 * dirX, y: obstacle.y - halfWidth * perpY - depth / 2 * dirY },
		{ x: obstacle.x + halfWidth * perpX - depth / 2 * dirX, y: obstacle.y + halfWidth * perpY - depth / 2 * dirY },
		{ x: obstacle.x + halfWidth * perpX + depth / 2 * dirX, y: obstacle.y + halfWidth * perpY + depth / 2 * dirY },
		{ x: obstacle.x - halfWidth * perpX + depth / 2 * dirX, y: obstacle.y - halfWidth * perpY + depth / 2 * dirY }
	];

	// Create 3D points for all corners at ground level and rooftop
	const points3D: Point3D[] = [];

	// Ground level corners (the base of the shadow)
	for (const c of corners) {
		points3D.push({ x: c.x, y: c.y, z: 0 });
	}

	// Rooftop corners (these project to form the far edge of shadow)
	for (const c of corners) {
		points3D.push({ x: c.x, y: c.y, z: h });
	}

	// Project all points to ground
	const projectedPoints: Array<Point & { z: number }> = [];
	for (const p of points3D) {
		const ground = projectPointToGround(p, sun, slope);
		if (ground) {
			projectedPoints.push({ ...ground, z: p.z });
		}
	}

	// Build shadow polygon: start with base corners, then add roof projections
	// The shadow shape depends on which edges are lit by the sun
	const vertices: Point[] = [];

	// Find which corners cast the longest shadows (determine shadow outline)
	// Simple approach: use the convex hull of all projected points
	const allPoints = projectedPoints.map(p => ({ x: p.x, y: p.y }));
	const hull = convexHull(allPoints);

	if (hull.length < 3) return null;

	return {
		obstacleId: obstacle.id,
		obstacleType: obstacle.type,
		vertices: hull,
		shadeIntensity: 1.0 // Buildings are fully opaque
	};
}

/**
 * Computes the convex hull of a set of 2D points using Graham scan.
 */
function convexHull(points: Point[]): Point[] {
	if (points.length < 3) return points;

	// Find the bottom-most point (and leftmost if tie)
	let start = 0;
	for (let i = 1; i < points.length; i++) {
		if (points[i].y < points[start].y ||
		    (points[i].y === points[start].y && points[i].x < points[start].x)) {
			start = i;
		}
	}

	// Sort points by polar angle with respect to start point
	const startPoint = points[start];
	const sorted = points
		.filter((_, i) => i !== start)
		.map(p => ({
			point: p,
			angle: Math.atan2(p.y - startPoint.y, p.x - startPoint.x),
			dist: Math.hypot(p.x - startPoint.x, p.y - startPoint.y)
		}))
		.sort((a, b) => a.angle - b.angle || a.dist - b.dist)
		.map(p => p.point);

	// Build hull
	const hull: Point[] = [startPoint];

	for (const p of sorted) {
		// Remove points that make clockwise turns
		while (hull.length > 1 && crossProduct(hull[hull.length - 2], hull[hull.length - 1], p) <= 0) {
			hull.pop();
		}
		hull.push(p);
	}

	return hull;
}

/**
 * Cross product of vectors (o->a) and (o->b).
 * Positive = counter-clockwise, negative = clockwise, zero = collinear.
 */
function crossProduct(o: Point, a: Point, b: Point): number {
	return (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
}

/**
 * Calculates the shadow polygon for a fence or hedge using ray tracing.
 *
 * Fences are treated as thin vertical walls. We trace rays from the top
 * edge corners to the ground to form the shadow polygon.
 */
function calculateFenceShadow(
	obstacle: PlotObstacle,
	sun: SolarPosition,
	slope?: PlotSlope
): ShadowPolygon | null {
	if (sun.altitude <= 0) return null;

	const h = obstacle.height;
	const halfWidth = obstacle.width / 2;

	// Fence orientation: runs perpendicular to the direction from origin
	const perpAngle = toRadians(obstacle.direction + 90);
	const perpX = Math.sin(perpAngle);
	const perpY = Math.cos(perpAngle);

	// Fence endpoints at ground level
	const end1: Point = {
		x: obstacle.x + halfWidth * perpX,
		y: obstacle.y + halfWidth * perpY
	};
	const end2: Point = {
		x: obstacle.x - halfWidth * perpX,
		y: obstacle.y - halfWidth * perpY
	};

	// Top of fence endpoints
	const top1: Point3D = { x: end1.x, y: end1.y, z: h };
	const top2: Point3D = { x: end2.x, y: end2.y, z: h };

	// Project top corners onto ground
	const shadow1 = projectPointToGround(top1, sun, slope);
	const shadow2 = projectPointToGround(top2, sun, slope);

	if (!shadow1 || !shadow2) return null;

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

// ============================================================================
// Geographic coordinate shadow projection
//
// These functions project shadows onto a map using lat/lng coordinates rather
// than meters. This is used by the MapPicker component to render tree shadows
// on top of the ShadeMap terrain/building shadows.
// ============================================================================

/**
 * A point in geographic coordinates.
 */
export interface LatLng {
	lat: number;
	lng: number;
}

/**
 * A shadow polygon using geographic coordinates.
 * Used for rendering shadows on Leaflet maps.
 */
export interface LatLngShadowPolygon {
	obstacleId: string;
	obstacleType: ObstacleType;
	vertices: LatLng[];
	shadeIntensity: number;
}

/**
 * Meters per degree of latitude (approximately constant).
 * Earth's circumference / 360 degrees.
 */
const METERS_PER_DEGREE_LAT = 111320;

/**
 * Converts a meter offset to a latitude offset.
 * Latitude degrees change at a nearly constant rate regardless of position.
 */
function metersToLatOffset(meters: number): number {
	return meters / METERS_PER_DEGREE_LAT;
}

/**
 * Converts a meter offset to a longitude offset at a given latitude.
 * Longitude degrees shrink as you move toward the poles because meridians
 * converge. At the equator, 1 degree ≈ 111km; at 60° latitude, 1 degree ≈ 55km.
 */
function metersToLngOffset(meters: number, latitude: number): number {
	const latRad = toRadians(latitude);
	const metersPerDegreeLng = METERS_PER_DEGREE_LAT * Math.cos(latRad);
	return meters / metersPerDegreeLng;
}

/**
 * Converts a point in meters (relative to origin) to a lat/lng coordinate.
 * The x axis is east (+x = east), y axis is north (+y = north).
 */
function metersToLatLng(point: Point, origin: LatLng): LatLng {
	return {
		lat: origin.lat + metersToLatOffset(point.y),
		lng: origin.lng + metersToLngOffset(point.x, origin.lat)
	};
}

/**
 * Tree configuration for map-based shadow calculation.
 * This mirrors the MapTree interface from MapPicker.
 */
export interface MapTreeConfig {
	id: string;
	lat: number;
	lng: number;
	type: 'deciduous-tree' | 'evergreen-tree';
	height: number;
	canopyWidth: number;
}

/**
 * Calculates a tree shadow polygon in geographic coordinates.
 *
 * This function projects a tree's shadow onto the map using lat/lng coordinates.
 * It works by first calculating the shadow in meters (using the existing shadow
 * projection math) then converting to geographic coordinates.
 *
 * @param tree - Tree configuration with lat/lng position and dimensions
 * @param sun - Current sun position (altitude and azimuth)
 * @returns Shadow polygon in lat/lng coordinates, or null if sun is below horizon
 */
export function calculateTreeShadowLatLng(
	tree: MapTreeConfig,
	sun: SolarPosition
): LatLngShadowPolygon | null {
	if (sun.altitude <= 0) return null;

	// Create a PlotObstacle at origin (0,0) for the shadow calculation
	const obstacleAtOrigin: PlotObstacle = {
		id: tree.id,
		type: tree.type,
		label: tree.type === 'evergreen-tree' ? 'Evergreen tree' : 'Deciduous tree',
		height: tree.height,
		width: tree.canopyWidth,
		distance: 0,
		direction: 0,
		x: 0,
		y: 0
	};

	// Calculate shadow in meters relative to (0,0)
	const shadowInMeters = calculateTreeShadow(obstacleAtOrigin, sun, undefined);
	if (!shadowInMeters) return null;

	// Convert shadow vertices from meters to lat/lng
	const treeOrigin: LatLng = { lat: tree.lat, lng: tree.lng };
	const vertices: LatLng[] = shadowInMeters.vertices.map((v) => metersToLatLng(v, treeOrigin));

	return {
		obstacleId: shadowInMeters.obstacleId,
		obstacleType: shadowInMeters.obstacleType,
		vertices,
		shadeIntensity: shadowInMeters.shadeIntensity
	};
}

/**
 * Calculates shadow polygons for all trees in geographic coordinates.
 *
 * @param trees - Array of trees with lat/lng positions
 * @param sun - Current sun position
 * @returns Array of shadow polygons in lat/lng coordinates
 */
export function calculateAllTreeShadowsLatLng(
	trees: MapTreeConfig[],
	sun: SolarPosition
): LatLngShadowPolygon[] {
	if (sun.altitude <= 0) return [];

	const shadows: LatLngShadowPolygon[] = [];
	for (const tree of trees) {
		const shadow = calculateTreeShadowLatLng(tree, sun);
		if (shadow) {
			shadows.push(shadow);
		}
	}
	return shadows;
}
