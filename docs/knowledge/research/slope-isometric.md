# Slope Modeling and Isometric Rendering Research

This document answers the research questions from T-017-01 about terrain slope, shadow projection, and isometric visualization. The findings inform implementation of the S-017 slope and isometric view features.

## R1: Slope-Adjusted Sun Calculations

Terrain slope dramatically affects how much solar energy a surface receives. A south-facing slope effectively increases the sun's altitude relative to the surface, which means more direct illumination during winter months when the sun is low. Conversely, a north-facing slope decreases the effective altitude and receives less energy. The math involves computing the angle between the sun vector and the surface normal vector.

### The Effective Sun Angle Formula

When sunlight hits a flat horizontal surface, the irradiance depends on the sine of the sun's altitude. A sun at 30° altitude delivers half the energy per unit area compared to a sun directly overhead at 90°. This is the standard cosine correction in solar engineering (using sine because we measure from horizontal, not from vertical).

For a sloped surface, we replace the sun's actual altitude with an "effective altitude" that accounts for the tilt. The surface normal of a sloped plot points away from vertical at an angle equal to the slope. If the slope faces toward the sun, the effective altitude increases; if the slope faces away, it decreases.

The formula for effective sun altitude on a sloped surface is:

```
sin(effective_altitude) = cos(slope) * sin(sun_altitude)
                        + sin(slope) * cos(sun_altitude) * cos(sun_azimuth - slope_aspect)
```

where `slope` is the tilt angle in degrees from horizontal (0° is flat, 90° is vertical), `slope_aspect` is the compass direction the slope faces (180° for south-facing in the northern hemisphere), `sun_altitude` is the actual sun altitude above the horizon, and `sun_azimuth` is the compass bearing of the sun.

This can also be expressed as a dot product between the sun vector and the surface normal vector. The sun vector in Cartesian coordinates is:

```
sun_x = cos(sun_altitude) * sin(sun_azimuth)
sun_y = cos(sun_altitude) * cos(sun_azimuth)
sun_z = sin(sun_altitude)
```

The surface normal for a slope tilted at angle θ toward aspect φ is:

```
normal_x = sin(slope) * sin(slope_aspect)
normal_y = sin(slope) * cos(slope_aspect)
normal_z = cos(slope)
```

The effective sunlight factor is simply `dot(sun, normal)`, which equals `sin(effective_altitude)`. When this value is positive, the surface is illuminated; when negative or zero, the surface is in self-shadow because it faces away from the sun.

### Worked Example: San Francisco South-Facing Hill

Consider a garden plot on a 15° south-facing slope at latitude 37.7°N (San Francisco) on the winter solstice. At solar noon, the sun reaches an altitude of approximately 29° in San Francisco (calculated as 90° minus latitude plus 23.5° winter tilt, so 90° - 37.7° - 23.5° ≈ 28.8°, rounded to 29°).

For a flat surface, the irradiance factor is sin(29°) ≈ 0.485, meaning the surface receives 48.5% of the energy it would receive with the sun directly overhead.

For the 15° south-facing slope, we apply the formula. The sun azimuth at solar noon is 180° (due south), and the slope aspect is also 180°, so the azimuth difference is 0°. This gives:

```
sin(effective) = cos(15°) * sin(29°) + sin(15°) * cos(29°) * cos(0°)
               = 0.966 * 0.485 + 0.259 * 0.874 * 1.0
               = 0.469 + 0.226
               = 0.695
```

The effective altitude is arcsin(0.695) ≈ 44°. The irradiance factor is 0.695, which is 43% more energy per unit area than the flat surface receives. This south-facing slope essentially "adds" 15° to the sun's altitude at noon, making San Francisco's winter sun feel more like mid-spring.

In terms of sun hours, the slope doesn't change when the sun rises and sets, but it does change how much energy accumulates during daylight. For horticultural purposes, we're primarily interested in whether plants receive "full sun" conditions, so we need to decide how to account for this intensity boost.

### How Slope Affects Sun Hours Integration

There are two approaches to handling slope in sun-hours calculations. The first approach adjusts the "sun above horizon" threshold: instead of counting time when sun_altitude > 0, we count time when effective_altitude > 0. This changes when daylight "starts" and "ends" for the surface. A severe north-facing slope might not receive direct sun even at midday in winter.

The second approach keeps the sunrise/sunset timing but weights each time sample by the effective irradiance factor. A south-facing slope would accumulate more effective sun-hours than the flat surface, reflecting the intensity benefit.

For Solar-Sim, the second approach is more useful because gardeners care about both timing and intensity. A tomato plant on a south-facing slope truly does receive more growth energy than one on flat ground. The implementation should calculate effective sun-hours as:

```typescript
let effectiveSunHours = 0;
for (const sample of daySamples) {
  const sun = getSunPosition(coords, sample.time);
  if (sun.altitude > 0) {
    const effectiveFactor = calculateEffectiveFactor(sun, slope);
    if (effectiveFactor > 0) {
      effectiveSunHours += sampleIntervalHours * effectiveFactor;
    }
  }
}
```

A flat surface has effectiveFactor equal to sin(sun_altitude), so a day with 10 hours of daylight might yield only 6-7 "effective sun hours" of accumulated energy. This is actually more accurate than the current sun-hours count, which treats all daylight as equal regardless of sun angle.

### Does Slope Affect Shadow Length?

Shadow length calculations for obstacles depend on the sun's actual altitude, not the effective altitude. A 10-meter tree casts the same length shadow on flat ground whether or not the adjacent garden plot is sloped. However, the shadow's shape changes when projected onto sloped terrain because the shadow boundary intersects the tilted surface at a different distance.

For the shadow intersection calculations, we need to project the shadow onto the sloped ground plane rather than a horizontal plane. This affects where the shadow boundary falls relative to the observation point, potentially increasing or decreasing shade coverage depending on slope orientation.

## R2: Shadow Projection onto Sloped Terrain

The current shade calculation uses angular intersection: an obstacle blocks the sun when the sun's azimuth falls within the obstacle's angular span and its altitude falls below the obstacle's angular height. This works well for determining whether shade occurs at a point, but doesn't produce the shadow polygon needed for visualization.

### Shadow Polygon Calculation

To visualize shadows, we need to project each obstacle's silhouette onto the ground plane. The projection depends on the sun's position and the obstacle's geometry. For a rectangular obstacle like a building, the shadow is a quadrilateral (or more complex polygon if partially visible). For a circular obstacle like a tree canopy, the shadow is an ellipse.

The shadow of a point P at height h above the ground extends from P along the direction opposite the sun's rays until it hits the ground plane. In vector terms, the ground intersection point is:

```
shadow_point = P + t * sun_direction
```

where t is chosen so that the z-coordinate of shadow_point equals zero. If P = (px, py, h) and the sun direction vector (pointing toward the sun) is:

```
sun_dir = (cos(altitude) * sin(azimuth), cos(altitude) * cos(azimuth), sin(altitude))
```

then the shadow direction is the negation of this, and the shadow extends from the obstacle base at (px, py, 0) to the ground intersection point:

```
t = h / sin(altitude)
shadow_x = px - t * cos(altitude) * sin(azimuth)
shadow_y = py - t * cos(altitude) * cos(azimuth)
```

This simplifies to the familiar shadow length formula, shadow_length = h / tan(altitude), with the shadow extending in the direction opposite the sun's azimuth.

### Rectangular Obstacle Shadow

For a rectangular building of width w, depth d, and height h at position (x, y), the shadow polygon has vertices corresponding to the four roof corners projected to ground level. The shadow extends from each base corner along the shadow direction, creating a hexagonal or quadrilateral shape depending on sun position.

The simplest case is a building represented as a flat rectangle perpendicular to the view direction. In the PlotEditor's top-down view, buildings are shown as rectangles with width spanning across the obstacle's azimuth direction. The shadow polygon connects the two front base corners to their shadow projections and continues along the shadow boundary.

```typescript
interface ShadowPolygon {
  obstacleId: string;
  vertices: { x: number; y: number }[];
  shadeIntensity: number;
}

function calculateBuildingShadow(
  obstacle: PlotObstacle,
  sun: SolarPosition
): ShadowPolygon | null {
  if (sun.altitude <= 0) return null;

  const shadowLength = obstacle.height / Math.tan(sun.altitude * Math.PI / 180);
  const shadowDirX = -Math.sin(sun.azimuth * Math.PI / 180);
  const shadowDirY = -Math.cos(sun.azimuth * Math.PI / 180);

  // Building corners perpendicular to direction (simplified as width only)
  const perpAngle = (obstacle.direction + 90) * Math.PI / 180;
  const halfWidth = obstacle.width / 2;

  const corner1 = {
    x: obstacle.x + halfWidth * Math.sin(perpAngle),
    y: obstacle.y + halfWidth * Math.cos(perpAngle)
  };
  const corner2 = {
    x: obstacle.x - halfWidth * Math.sin(perpAngle),
    y: obstacle.y - halfWidth * Math.cos(perpAngle)
  };

  // Shadow tips extend from corners in shadow direction
  const shadow1 = {
    x: corner1.x + shadowLength * shadowDirX,
    y: corner1.y + shadowLength * shadowDirY
  };
  const shadow2 = {
    x: corner2.x + shadowLength * shadowDirX,
    y: corner2.y + shadowLength * shadowDirY
  };

  return {
    obstacleId: obstacle.id,
    vertices: [corner1, corner2, shadow2, shadow1],
    shadeIntensity: 1.0
  };
}
```

### Circular Obstacle Shadow (Trees)

Tree canopies produce elliptical shadows because the circular canopy projects onto the ground at an angle. The ellipse's major axis aligns with the shadow direction, and its size depends on the canopy radius and the sun's altitude.

For a tree with canopy radius r centered at position (x, y) with canopy bottom at height h, the shadow ellipse has:

```
semi_major = shadowLength + r
semi_minor = r
center_x = x + (shadowLength / 2) * shadowDirX
center_y = y + (shadowLength / 2) * shadowDirY
rotation = sun.azimuth
```

For SVG rendering, we can approximate the ellipse with a polygon or use the native ellipse element with rotation.

```typescript
function calculateTreeShadow(
  obstacle: PlotObstacle,
  sun: SolarPosition
): ShadowPolygon | null {
  if (sun.altitude <= 0) return null;

  const canopyRadius = obstacle.width / 2;
  const canopyHeight = obstacle.height - canopyRadius; // assume canopy starts partway up
  const shadowLength = canopyHeight / Math.tan(sun.altitude * Math.PI / 180);

  const shadowDirX = -Math.sin(sun.azimuth * Math.PI / 180);
  const shadowDirY = -Math.cos(sun.azimuth * Math.PI / 180);

  // Approximate ellipse with polygon (16 vertices)
  const vertices: { x: number; y: number }[] = [];
  const segments = 16;

  for (let i = 0; i < segments; i++) {
    const angle = (i / segments) * 2 * Math.PI;
    const localX = canopyRadius * Math.cos(angle);
    const localY = canopyRadius * Math.sin(angle);

    // Project point on canopy edge to ground
    const canopyPointShadowLength =
      (canopyHeight + localY * Math.sin(sun.altitude * Math.PI / 180))
      / Math.tan(sun.altitude * Math.PI / 180);

    vertices.push({
      x: obstacle.x + localX + canopyPointShadowLength * shadowDirX,
      y: obstacle.y + localY + canopyPointShadowLength * shadowDirY
    });
  }

  return {
    obstacleId: obstacle.id,
    vertices,
    shadeIntensity: 1 - getTransparency(obstacle.type)
  };
}
```

### Shadow on Sloped Ground

When the ground is sloped, the shadow polygon changes shape because the intersection plane is tilted. The shadow becomes longer when it falls "downhill" (away from the sun on a sunward-facing slope) and shorter when it falls "uphill."

The ground plane equation for a slope at angle θ facing aspect φ is:

```
z = -sin(θ) * (x * sin(φ) + y * cos(φ))
```

To find where a shadow ray intersects this plane, we substitute the ray equation and solve for t. This is more complex than the flat-ground case but follows the same ray-plane intersection math.

For MVP, approximating shadows on sloped terrain as if the ground were flat is reasonable. The visual difference is minor for slopes under 15°, and the shade calculation itself already accounts for slope through the effective altitude adjustment. We can add accurate sloped shadow rendering later if users find it important.

## R3: Isometric Projection with SVG

The current PlotEditor uses an orthographic top-down view with SVG coordinate transforms. Adding an isometric view requires projecting 3D world coordinates into 2D screen space using an oblique projection that creates the classic "pseudo-3D" appearance.

### Isometric Transform Matrix

Standard isometric projection uses a 30° angle from horizontal, which corresponds to the viewing angle where a cube's three visible faces appear equal-sized. The transform converts (x, y, z) world coordinates to (screenX, screenY) as:

```
screenX = (x - y) * cos(30°)
screenY = (x + y) * sin(30°) - z
```

With cos(30°) ≈ 0.866 and sin(30°) = 0.5, this becomes:

```
screenX = 0.866 * (x - y)
screenY = 0.5 * (x + y) - z
```

In SVG, we can apply this either by using a matrix transform on a group element or by manually transforming coordinates in the rendering code. The matrix approach is cleaner for static content but makes text labels difficult because they rotate with the scene. The coordinate approach keeps text upright but requires more JavaScript.

### Integration with Existing PlotEditor

The PlotEditor already maintains obstacles with (x, y) coordinates in world space, plus height and width properties. The isometric view needs the same data but renders it differently. The recommended architecture is to create a separate `IsometricView.svelte` component that:

1. Accepts the same `PlotObstacle[]` data as PlotEditor
2. Uses a shared Svelte store for the obstacle list so both views stay synchronized
3. Implements its own pan/zoom but shares scale with PlotEditor
4. Renders obstacles as extruded shapes with shadows

The two components can coexist with a toggle, so users switch between "Plan View" (current PlotEditor) and "3D View" (isometric).

### Rendering Obstacles in Isometric

Each obstacle type needs a distinct 3D representation:

Trees render as cylinders (trunk) topped with spheres or cones (canopy). In isometric projection, a sphere becomes an ellipse, and we use stacked ellipses to suggest volume. The canopy's shadow projects onto the ground as an ellipse stretched along the sun direction.

Buildings render as rectangular prisms. The top face is a parallelogram in isometric view, and the two visible side faces complete the box shape. Buildings cast sharp rectangular shadows.

Fences render as thin extruded rectangles, like walls. Their shadows are simple parallelograms.

For each obstacle, the rendering order matters: objects closer to the "camera" (higher screenY) should render last to appear in front. In isometric view with x increasing right and y increasing "up" in screen space, sorting by (x + y) handles occlusion correctly for most cases.

### SVG Implementation Sketch

```svelte
<script lang="ts">
  import type { PlotObstacle } from '$lib/components/PlotEditor.svelte';
  import type { SolarPosition } from '$lib/solar/types';

  interface IsometricViewProps {
    obstacles: PlotObstacle[];
    sunPosition: SolarPosition | null;
    groundSlope: { angle: number; aspect: number };
  }

  let { obstacles, sunPosition, groundSlope }: IsometricViewProps = $props();

  // Isometric projection constants
  const COS30 = Math.cos(Math.PI / 6);
  const SIN30 = 0.5;

  // Convert world coords to isometric screen coords
  function toIso(x: number, y: number, z: number = 0): { x: number; y: number } {
    return {
      x: COS30 * (x - y),
      y: SIN30 * (x + y) - z
    };
  }

  // Sort obstacles back-to-front for correct overlap
  const sortedObstacles = $derived(
    [...obstacles].sort((a, b) => (a.x + a.y) - (b.x + b.y))
  );
</script>

<svg viewBox="-100 -100 200 200">
  <!-- Ground plane with slope visualization -->
  <polygon
    points={groundPolygonPoints}
    fill="#c7d2c7"
    stroke="#94a3a0"
  />

  <!-- Shadows (render before obstacles) -->
  {#each sortedObstacles as obstacle}
    {#if sunPosition && sunPosition.altitude > 0}
      {@const shadow = calculateShadowPolygon(obstacle, sunPosition)}
      {#if shadow}
        <polygon
          points={shadow.vertices.map(v => {
            const iso = toIso(v.x, v.y);
            return `${iso.x},${iso.y}`;
          }).join(' ')}
          fill="rgba(0,0,0,0.3)"
        />
      {/if}
    {/if}
  {/each}

  <!-- Obstacles -->
  {#each sortedObstacles as obstacle}
    <g class="obstacle">
      <!-- Render based on type -->
    </g>
  {/each}
</svg>
```

### Text Labels in Isometric View

Text labels in the current PlotEditor use a counter-transform to stay upright despite the coordinate system flip. In isometric view, the same approach works: apply the inverse of the isometric rotation to text elements so they remain horizontal.

Alternatively, labels can be placed in a separate SVG layer that isn't transformed, using JavaScript to calculate absolute positions. This is cleaner but requires more careful coordinate management.

For MVP, placing labels above obstacles (in screen space) with a slight offset works well. The label position is calculated by converting the obstacle's top center to screen coordinates and adding a fixed pixel offset.

## R4: Performance for Shadow Animation

Shadow animation requires recalculating shadow polygons as the time changes. The time scrubber lets users drag through a day and see shadows move in real-time, which imposes strict performance requirements.

### Computational Analysis

Each shadow polygon calculation involves:
- One atan for shadow length
- Two sin/cos calls for shadow direction
- Four to sixteen vertex calculations depending on obstacle shape

Modern JavaScript engines handle trigonometric functions in nanoseconds, so even with 10 obstacles and 16 vertices each, a single frame's shadow calculations complete in under 1 millisecond.

The bottleneck is more likely to be SVG rendering than calculation. SVG redraws when polygon points change, and complex scenes can cause jank. For smooth animation at 60fps, each frame has a 16ms budget.

### Pre-computation Strategies

If frame-by-frame calculation proves too slow, we can pre-compute shadow keyframes at regular intervals (every 15 minutes of simulated time) and interpolate between them during playback. Shadow polygons can be linearly interpolated by moving vertices from their positions at time T1 toward their positions at time T2.

However, this pre-computation trades memory for speed. With 10 obstacles and 96 keyframes per day (15-minute intervals), we'd store approximately 10 × 96 × 4 vertices × 2 coordinates × 8 bytes ≈ 61KB per day. This is modest but grows if we support multi-day views.

The recommended approach is to start with direct calculation and add pre-computation only if profiling shows a need. Modern browsers handle this workload easily.

### Time Scrubber UX

Two interaction styles are common for time scrubbers. Continuous scrubbing updates the display on every mouse move, providing smooth visual feedback but requiring fast updates. Stepped scrubbing quantizes time to fixed intervals (every 15 or 30 minutes) and only updates at those points, reducing computation but feeling less responsive.

For Solar-Sim, continuous scrubbing is preferable because users want to see exactly when shadows shift. The display should show the current time and update shadow positions smoothly as the user drags the scrubber.

The scrubber should support:
- A time range for a single day (sunrise to sunset, with twilight margins)
- A date picker to choose which day to visualize
- Playback buttons for automatic animation (play/pause at 1 simulated minute per real-time frame)
- Keyboard navigation (arrow keys for fine adjustment)

The implementation can use Svelte's reactive system to automatically recalculate shadows whenever the time value changes, keeping the code simple and letting the framework handle efficient updates.

## R5: Slope Input UX

Users need to specify both the slope angle (how steep) and the slope aspect (which direction it faces). These two values fully determine the ground plane orientation.

### Input Options Evaluated

The most intuitive approach is a dual control: a slider or numeric input for slope angle, and a compass rose or dropdown for aspect. The angle control ranges from 0° (flat) to 45° (very steep for gardening purposes), with common values being 5°, 10°, 15°, and 20°. The aspect control selects from eight compass directions (N, NE, E, SE, S, SW, W, NW) or allows a precise bearing.

An alternative is a visual 3D tilt indicator showing a miniature plane that the user can drag to adjust. This is more intuitive but harder to implement precisely and may frustrate users who want exact values.

A third option is to infer slope from satellite imagery, but this requires elevation data APIs and adds significant complexity. This could be a future enhancement but isn't necessary for MVP.

### Recommended UI Implementation

The slope input should appear as a collapsible section in the PlotEditor, since most users work with relatively flat ground and don't need slope controls prominently displayed. When expanded, it shows:

1. A slope angle input with a slider (0° to 30°) and numeric display. The slider has tick marks at 5° intervals.

2. An aspect compass showing the eight directions as clickable segments. The currently selected direction highlights, and clicking a segment sets the aspect. A "Flat" button in the center resets slope to 0°.

3. A preview showing how the slope affects sun exposure, such as "South-facing 15° slope: +14% winter sun."

```svelte
<div class="slope-input">
  <label>
    Slope angle: {slopeAngle}°
    <input
      type="range"
      min="0"
      max="30"
      step="1"
      bind:value={slopeAngle}
    />
  </label>

  <div class="aspect-compass">
    {#each aspects as aspect}
      <button
        class:selected={slopeAspect === aspect.value}
        onclick={() => slopeAspect = aspect.value}
      >
        {aspect.label}
      </button>
    {/each}
  </div>
</div>
```

### Slope Visualization in Plan View

The plan view should indicate slope through visual cues. Options include:

1. A gradient background shading from "uphill" to "downhill" sides
2. Contour lines at regular elevation intervals
3. An arrow pointing in the downhill direction

The gradient approach is simplest and most intuitive. A light-to-dark gradient across the plot, with the light side being "uphill," gives immediate visual feedback about slope direction.

In the isometric view, the slope renders naturally as a tilted ground plane.

### Reasonable Slope Ranges

For gardening applications, slopes steeper than 30° are rarely cultivated without terracing. Most garden beds are on slopes between 0° and 15°. The input should allow values up to 45° for completeness (steep hillside gardens do exist) but emphasize the common range through the slider's visual design.

Aspect matters most for slopes above 5°. A 2° slope has minimal directional effect, so the aspect selector could disable or gray out when the angle is very low.

## Implementation Recommendations

Based on this research, the implementation should proceed in the following order.

### First: Slope Data Types

Create `src/lib/solar/slope.ts` with types for `GroundSlope { angle: number; aspect: number }` and a function `calculateEffectiveSunlight(sun: SolarPosition, slope: GroundSlope): number` that returns the effective irradiance factor. This builds on the existing shade module and integrates with sun-hours calculations.

### Second: Shadow Polygon Calculation

Create `src/lib/solar/shadow-projection.ts` with functions to compute shadow polygons for each obstacle type given sun position and optionally terrain slope. Start with flat-ground shadows and add slope adjustment later.

### Third: Slope Input UI

Extend PlotEditor.svelte to include slope angle and aspect inputs in a collapsible panel. Store slope in the same data structure as obstacles so it persists with the plot configuration.

### Fourth: Isometric View Component

Create `src/lib/components/IsometricView.svelte` as a new visualization that renders the same obstacle data in isometric projection with shadows. This is the largest implementation task.

### Fifth: Time Scrubber

Create `src/lib/components/TimeScrubber.svelte` for controlling the simulated time used in shadow calculations. It should integrate with both the plan view (for shade window visualization) and the isometric view (for animated shadows).

### Sixth: View Toggle Integration

Create a wrapper component that provides toggle buttons between plan and isometric views, with shared state for obstacles, slope, and time.

## TypeScript Code Examples

The following sketches show core functions that will be implemented.

### Effective Irradiance on Sloped Surface

```typescript
import type { SolarPosition } from './types.js';

export interface GroundSlope {
  angle: number;  // degrees, 0 = flat, positive = tilted
  aspect: number; // degrees from north, 180 = south-facing
}

export function calculateEffectiveIrradiance(
  sun: SolarPosition,
  slope: GroundSlope
): number {
  if (sun.altitude <= 0) return 0;

  const sunAlt = sun.altitude * Math.PI / 180;
  const sunAz = sun.azimuth * Math.PI / 180;
  const slopeAngle = slope.angle * Math.PI / 180;
  const slopeAspect = slope.aspect * Math.PI / 180;

  // Dot product of sun vector and surface normal
  const effective =
    Math.cos(slopeAngle) * Math.sin(sunAlt) +
    Math.sin(slopeAngle) * Math.cos(sunAlt) * Math.cos(sunAz - slopeAspect);

  return Math.max(0, effective);
}
```

### Shadow Polygon for Building

```typescript
import type { SolarPosition } from './types.js';
import type { PlotObstacle } from '$lib/components/PlotEditor.svelte';

export interface ShadowPolygon {
  obstacleId: string;
  vertices: Array<{ x: number; y: number }>;
  shadeIntensity: number;
}

export function calculateBuildingShadow(
  obstacle: PlotObstacle,
  sun: SolarPosition
): ShadowPolygon | null {
  if (sun.altitude <= 0) return null;

  const alt = sun.altitude * Math.PI / 180;
  const az = sun.azimuth * Math.PI / 180;

  const shadowLength = obstacle.height / Math.tan(alt);
  const shadowDirX = -Math.sin(az);
  const shadowDirY = -Math.cos(az);

  // Perpendicular direction for building width
  const perpAngle = (obstacle.direction + 90) * Math.PI / 180;
  const halfWidth = obstacle.width / 2;

  const base1 = {
    x: obstacle.x + halfWidth * Math.sin(perpAngle),
    y: obstacle.y + halfWidth * Math.cos(perpAngle)
  };
  const base2 = {
    x: obstacle.x - halfWidth * Math.sin(perpAngle),
    y: obstacle.y - halfWidth * Math.cos(perpAngle)
  };
  const shadow1 = {
    x: base1.x + shadowLength * shadowDirX,
    y: base1.y + shadowLength * shadowDirY
  };
  const shadow2 = {
    x: base2.x + shadowLength * shadowDirX,
    y: base2.y + shadowLength * shadowDirY
  };

  return {
    obstacleId: obstacle.id,
    vertices: [base1, base2, shadow2, shadow1],
    shadeIntensity: 1.0
  };
}
```

### Isometric Projection Utility

```typescript
const COS30 = Math.cos(Math.PI / 6); // ≈ 0.866
const SIN30 = 0.5;

export interface IsoPoint {
  x: number;
  y: number;
}

export function toIsometric(
  worldX: number,
  worldY: number,
  worldZ: number = 0
): IsoPoint {
  return {
    x: COS30 * (worldX - worldY),
    y: SIN30 * (worldX + worldY) - worldZ
  };
}

export function fromIsometric(
  screenX: number,
  screenY: number,
  worldZ: number = 0
): { worldX: number; worldY: number } {
  // Inverse transform assuming known Z
  const adjustedY = screenY + worldZ;
  const sum = adjustedY / SIN30;        // worldX + worldY
  const diff = screenX / COS30;         // worldX - worldY
  return {
    worldX: (sum + diff) / 2,
    worldY: (sum - diff) / 2
  };
}
```

## References

The following sources informed this research:

PVEducation provides the irradiance-on-tilted-surface formulas at https://www.pveducation.org/pvcdrom/properties-of-sunlight/arbitrary-orientation-and-tilt, which derive from standard solar engineering texts.

The isometric projection math follows game development conventions documented across multiple sources, with the 30° angle being the standard for "true" isometric views that preserve equal-length axes.

The existing Solar-Sim codebase in `src/lib/solar/` provides the foundation for sun position and shade calculations that this research builds upon.
