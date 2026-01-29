# Blueprint UI Research: Interactive Plot Editor

This document investigates how to build an interactive blueprint/plan view for obstacle placement. The existing compass rose concept works well for quick obstacle entry, but a spatial blueprint view provides better understanding for users who want to see how obstacles relate to each other in physical space. This is especially valuable for landscapers and serious gardeners who think in terms of landscape plans rather than compass directions.

## The Problem with Compass Rose

The compass rose approach treats obstacles as directional entities defined by direction and distance from the observation point. This works mathematically because the shade calculation only needs to know where the sun is relative to each obstacle, but it doesn't match how people think about their yards. A homeowner knows their neighbor's house is to the south and the oak tree is in the back corner, but they think of these as positions on a mental map, not as bearings like "210 degrees at 15 meters."

The blueprint view lets users place obstacles on a visual map of their property where the observation point sits at the center. They drag a tree to "that corner" rather than calculating that the corner is at 225 degrees and 20 meters. The system derives direction and distance from the obstacle's position automatically.

## Coordinate System Design

The plot editor needs a coordinate system that maps from screen pixels to real-world meters. The observation point sits at the origin (0, 0), and positions are measured in meters relative to that point. Positive X points east and positive Y points north, matching compass conventions.

The transformation between screen coordinates and world coordinates involves three values: the scale factor (pixels per meter), the pan offset (how far the view has been dragged), and the canvas center (where origin appears on screen). Converting from world to screen coordinates works like this:

```typescript
interface ViewState {
  scale: number;      // pixels per meter
  panX: number;       // screen offset from default position
  panY: number;
  centerX: number;    // canvas center in pixels
  centerY: number;
}

function worldToScreen(worldX: number, worldY: number, view: ViewState): { x: number; y: number } {
  // Y is inverted because screen Y increases downward but world Y increases northward
  const screenX = view.centerX + (worldX * view.scale) + view.panX;
  const screenY = view.centerY - (worldY * view.scale) + view.panY;
  return { x: screenX, y: screenY };
}

function screenToWorld(screenX: number, screenY: number, view: ViewState): { x: number; y: number } {
  const worldX = (screenX - view.centerX - view.panX) / view.scale;
  const worldY = -(screenY - view.centerY - view.panY) / view.scale;
  return { x: worldX, y: worldY };
}
```

The obstacle's direction and distance for shade calculations derive from its position:

```typescript
function positionToShade(x: number, y: number): { direction: number; distance: number } {
  const distance = Math.sqrt(x * x + y * y);
  // atan2 gives angle from positive X axis, but we want angle from positive Y (north)
  // Also convert from radians to degrees
  let direction = (90 - Math.atan2(y, x) * 180 / Math.PI);
  if (direction < 0) direction += 360;
  return { direction, distance };
}
```

This means the Obstacle type from shade-types.ts works unchanged. The UI stores positions, converts them to direction and distance on the fly, and passes the familiar Obstacle interface to the calculation engine.

## SVG Canvas Architecture

SVG is the right choice for the plot editor because it scales cleanly at any zoom level, handles hit-testing natively for interactions, and supports both declarative rendering via Svelte and imperative manipulation when needed. The canvas structure uses nested groups to separate layers:

```svelte
<svg
  viewBox="0 0 {width} {height}"
  on:wheel={handleZoom}
  on:pointerdown={handlePanStart}
  on:pointermove={handlePanMove}
  on:pointerup={handlePanEnd}
>
  <!-- Background and grid at base layer -->
  <g class="grid-layer" transform={gridTransform}>
    <GridPattern {scale} />
  </g>

  <!-- Obstacles in world coordinates -->
  <g class="obstacle-layer" transform={worldTransform}>
    {#each obstacles as obstacle}
      <ObstacleShape
        {obstacle}
        selected={selectedId === obstacle.id}
        on:select={() => selectObstacle(obstacle.id)}
        on:move={handleObstacleMove}
      />
    {/each}
  </g>

  <!-- Observation point always at center -->
  <g class="center-marker" transform={worldTransform}>
    <circle cx="0" cy="0" r={4 / scale} fill="#e11d48" />
    <text x={8 / scale} y={4 / scale} font-size={12 / scale}>You are here</text>
  </g>

  <!-- UI elements in screen coordinates (not affected by pan/zoom) -->
  <g class="ui-layer">
    <CompassRose x={width - 60} y={60} />
    <ScaleBar x={20} y={height - 30} {scale} />
  </g>
</svg>
```

The worldTransform string combines pan and zoom into a single SVG transform that applies to all world-coordinate elements:

```typescript
$: worldTransform = `translate(${centerX + panX}, ${centerY + panY}) scale(${scale}, ${-scale})`;
```

The negative Y scale flips the coordinate system so north points up. Elements rendered in world coordinates automatically get the right position and size, while the UI layer (compass rose, scale bar, zoom controls) stays fixed to screen corners.

## Rendering Obstacles at Different Scales

Obstacles need different visual treatments depending on zoom level. At high zoom (viewing a small area in detail), a tree should show its canopy radius and perhaps indicate species. At low zoom (viewing a large property), the same tree becomes a simple dot with a label. The rendering logic checks scale and switches representations:

```typescript
type DetailLevel = 'minimal' | 'standard' | 'detailed';

function getDetailLevel(scale: number): DetailLevel {
  if (scale < 5) return 'minimal';    // Less than 5 px/m, just show dots
  if (scale < 20) return 'standard';  // 5-20 px/m, show shapes with labels
  return 'detailed';                   // >20 px/m, show full detail
}
```

For trees, the minimal representation is a small circle, the standard representation shows the canopy radius with a trunk dot at center, and the detailed representation adds canopy texture and species-specific coloring. Buildings follow a similar pattern with rectangles that gain more detail at closer zoom.

The key insight is that obstacle width (canopy diameter for trees, footprint for buildings) matters for rendering but not for the shade calculation, which treats obstacles as angular spans from the observation point. So a 12-meter-wide building at 50 meters away appears the same as a 6-meter-wide building at 25 meters for shade purposes. The blueprint view reveals this subtlety by showing actual sizes, helping users understand why distance matters so much.

```svelte
<!-- Tree obstacle component -->
{#if detailLevel === 'minimal'}
  <circle
    cx={x} cy={y}
    r={Math.max(2, width * 0.3)}
    fill="#22c55e"
    fill-opacity="0.8"
  />
{:else if detailLevel === 'standard'}
  <circle cx={x} cy={y} r={width / 2} fill="#22c55e" fill-opacity="0.4" />
  <circle cx={x} cy={y} r={0.5} fill="#854d0e" />
  <text x={x} y={y - width/2 - 1} text-anchor="middle" font-size="0.8">{label}</text>
{:else}
  <g class="tree-detailed">
    <circle cx={x} cy={y} r={width / 2} fill="url(#canopyGradient)" />
    <circle cx={x} cy={y} r={0.5} fill="#854d0e" />
    <text x={x} y={y - width/2 - 1} text-anchor="middle" font-size="0.8">{label}</text>
    <text x={x} y={y - width/2 - 2} text-anchor="middle" font-size="0.6" fill="#666">
      {height}m tall
    </text>
  </g>
{/if}
```

## Interaction Patterns

The plot editor needs three core interactions: adding obstacles, moving them, and resizing them. Each requires careful attention to touch and mouse input.

### Adding Obstacles

The recommended pattern is mode-based placement. The user clicks a toolbar button to select an obstacle type (like "Add tree"), which puts the editor into placement mode. The cursor changes to indicate placement is active, and clicking anywhere on the canvas creates a new obstacle at that position. Pressing Escape or clicking the toolbar button again exits placement mode.

This approach is better than drag-from-palette because it works equally well on touch devices where dragging a small toolbar element is awkward. It also allows the user to click multiple times to add several obstacles of the same type quickly.

```typescript
let placementMode: ObstacleType | null = $state(null);

function handleCanvasClick(event: PointerEvent) {
  if (placementMode) {
    const worldPos = screenToWorld(event.offsetX, event.offsetY, viewState);
    const newObstacle = createObstacleFromPreset(placementMode, worldPos.x, worldPos.y);
    obstacles = [...obstacles, newObstacle];
    // Stay in placement mode for rapid placement, or exit:
    // placementMode = null;
  }
}

function createObstacleFromPreset(type: ObstacleType, x: number, y: number): PlotObstacle {
  const preset = getDefaultPreset(type);
  const { direction, distance } = positionToShade(x, y);
  return {
    id: crypto.randomUUID(),
    type,
    label: preset.label,
    x,
    y,
    direction,
    distance,
    height: preset.height,
    width: preset.width
  };
}
```

### Moving Obstacles

Drag-to-move is the natural interaction for repositioning. The challenge is distinguishing between dragging an obstacle versus panning the view. The solution is that obstacles capture pointer events and call stopPropagation, so drags starting on an obstacle move the obstacle while drags starting on empty canvas pan the view.

```svelte
<g
  class="obstacle"
  on:pointerdown|stopPropagation={startDrag}
  style="cursor: move"
>
  <!-- obstacle graphics -->
</g>
```

```typescript
let dragging: { id: string; startX: number; startY: number; offsetX: number; offsetY: number } | null = null;

function startDrag(event: PointerEvent, obstacle: PlotObstacle) {
  event.target.setPointerCapture(event.pointerId);
  const worldPos = screenToWorld(event.offsetX, event.offsetY, viewState);
  dragging = {
    id: obstacle.id,
    startX: obstacle.x,
    startY: obstacle.y,
    offsetX: worldPos.x - obstacle.x,
    offsetY: worldPos.y - obstacle.y
  };
}

function moveDrag(event: PointerEvent) {
  if (!dragging) return;
  const worldPos = screenToWorld(event.offsetX, event.offsetY, viewState);
  const newX = worldPos.x - dragging.offsetX;
  const newY = worldPos.y - dragging.offsetY;
  updateObstaclePosition(dragging.id, newX, newY);
}

function endDrag(event: PointerEvent) {
  if (dragging) {
    event.target.releasePointerCapture(event.pointerId);
    dragging = null;
  }
}
```

### Resizing Obstacles

Resize handles appear when an obstacle is selected. For trees, a single circular handle controls the canopy radius. For buildings and fences, corner handles control width while edge handles could control depth (though for shade purposes only width matters). Dragging a handle updates the obstacle's dimensions in real-time.

```svelte
{#if selected && obstacle.type === 'deciduous-tree'}
  <circle
    cx={x + width/2} cy={y}
    r={handleSize}
    fill="white"
    stroke="#0066cc"
    stroke-width={1/scale}
    on:pointerdown|stopPropagation={startResize}
    style="cursor: ew-resize"
  />
{/if}
```

The resize logic is similar to drag but modifies width instead of position:

```typescript
function handleResize(event: PointerEvent) {
  if (!resizing) return;
  const worldPos = screenToWorld(event.offsetX, event.offsetY, viewState);
  const obstacle = obstacles.find(o => o.id === resizing.id);
  if (!obstacle) return;
  const dx = worldPos.x - obstacle.x;
  const dy = worldPos.y - obstacle.y;
  const newRadius = Math.sqrt(dx * dx + dy * dy);
  updateObstacleWidth(resizing.id, newRadius * 2);
}
```

### Deleting Obstacles

A delete button appears in the selection UI, or the user can press the Delete key when an obstacle is selected. Touch devices need the button since they don't have keyboards.

## Pan and Zoom

Panning uses pointer capture to track the pointer across the entire window even if it leaves the SVG bounds. Zooming centers on the pointer position so users can zoom into a specific area.

```typescript
function handleZoom(event: WheelEvent) {
  event.preventDefault();
  const zoomFactor = event.deltaY > 0 ? 0.9 : 1.1;
  const newScale = Math.max(1, Math.min(100, scale * zoomFactor));

  // Zoom toward pointer position
  const rect = svg.getBoundingClientRect();
  const pointerX = event.clientX - rect.left;
  const pointerY = event.clientY - rect.top;

  // Adjust pan so the world point under the pointer stays fixed
  const worldBefore = screenToWorld(pointerX, pointerY, viewState);
  scale = newScale;
  const screenAfter = worldToScreen(worldBefore.x, worldBefore.y, { ...viewState, scale: newScale });
  panX += pointerX - screenAfter.x;
  panY += pointerY - screenAfter.y;
}
```

Pinch-to-zoom on touch devices requires tracking two touch points and calculating their distance change. The Web Pointer Events API handles this well with careful use of pointerId to track individual fingers.

## Isometric View Consideration

An isometric (pseudo-3D) view would let users visualize obstacle heights, which matter significantly for shade. A 30-meter tree casts a much longer shadow than a 6-meter tree, but both might render as similar-sized circles in the plan view.

Implementing isometric projection is straightforward mathematically. The transformation skews the coordinate system so vertical lines remain vertical while horizontal lines angle at 30 degrees:

```typescript
function worldToIsometric(x: number, y: number, z: number): { x: number; y: number } {
  // Standard isometric projection angles
  const isoX = (x - y) * Math.cos(Math.PI / 6);
  const isoY = (x + y) * Math.sin(Math.PI / 6) - z;
  return { x: isoX, y: isoY };
}
```

However, isometric view complicates interactions significantly. Clicking on a position in isometric space requires inverse-projecting back to world coordinates, and the mapping isn't unique without knowing the height. Dragging obstacles becomes confusing because movement in screen space doesn't correspond to intuitive real-world movement.

The recommended approach for MVP is to stay with the top-down plan view but communicate heights through visual cues and labels. Trees can show their height in the label, and a selected obstacle can display a side-view inset showing its profile with height marked. This gives users the height information without the interaction complexity of full 3D.

If isometric view becomes a priority later, it should be a read-only visualization mode that lets users see the spatial relationships but switches back to plan view for editing.

## North Orientation

The default orientation puts north at the top of the screen, which matches most maps and satellite imagery. However, users might find it helpful to rotate the view to match their mental model of their yard. If they typically enter their yard from the south, having south at the top might feel more natural.

Rotation can be implemented by adding an angle to the world transform:

```typescript
$: worldTransform = `translate(${centerX + panX}, ${centerY + panY}) rotate(${-rotation}) scale(${scale}, ${-scale})`;
```

The rotation is negative because we want clockwise rotation in world coordinates but SVG rotates counter-clockwise. The compass rose in the UI layer should rotate correspondingly to always show where north actually is.

For MVP, fixed north-up is sufficient. Users can mentally rotate their mental model more easily than the interface can handle rotated interactions (since resize handles and axis-aligned buildings become complicated when rotated).

## Mobile Touch Considerations

Touch targets must be large enough to tap accurately. The minimum recommended size is 44x44 CSS pixels for tap targets. At high zoom levels where obstacles are large on screen this isn't an issue, but at low zoom levels obstacles might render smaller than 44 pixels. The solution is to expand the hit area beyond the visual bounds:

```svelte
<g class="obstacle-hit-area">
  <!-- Invisible expanded hit target -->
  <circle
    cx={x} cy={y}
    r={Math.max(width/2, 22/scale)}
    fill="transparent"
    on:pointerdown={...}
  />
  <!-- Visible obstacle -->
  <circle cx={x} cy={y} r={width/2} fill="#22c55e" />
</g>
```

Preventing accidental placement is important on touch. When the user taps to select an obstacle that's near where a tap would place a new one, the tap should select rather than create. The logic checks for existing obstacles within a threshold before creating:

```typescript
function handleCanvasClick(event: PointerEvent) {
  const worldPos = screenToWorld(event.offsetX, event.offsetY, viewState);
  const hitObstacle = obstacles.find(o => distance(o, worldPos) < hitThreshold);

  if (hitObstacle) {
    selectObstacle(hitObstacle.id);
  } else if (placementMode) {
    createObstacle(placementMode, worldPos);
  } else {
    deselectAll();
  }
}
```

## Component Structure Recommendation

The plot editor should decompose into several focused components:

The PlotEditor.svelte component owns the SVG element and coordinates view state (pan, zoom, scale). It handles pointer events for panning and dispatches selection and editing events. It renders the grid, center marker, and compass rose.

The ObstacleLayer.svelte component receives the obstacles array and renders each one via ObstacleShape components. It handles the coordinate transformation from world to SVG space.

Individual obstacle type components (TreeObstacle.svelte, BuildingObstacle.svelte, FenceObstacle.svelte) handle their specific rendering at different detail levels. They're pure presentation components that receive obstacle data and emit interaction events.

The ObstaclePalette.svelte component renders the toolbar for selecting obstacle types to place. It manages placement mode state and shows presets grouped by category.

The SelectionPanel.svelte component appears when an obstacle is selected. It shows editable properties (height, width, label) and a delete button. It could also show the computed shade impact of this single obstacle.

## Integration with Existing Types

The shade calculation engine expects Obstacle objects with direction, distance, height, and width. The plot editor works with position (x, y) instead of direction and distance. The recommended approach is to extend the type:

```typescript
interface PlotObstacle extends Obstacle {
  x: number;  // meters east of observation point
  y: number;  // meters north of observation point
}
```

The x,y values are the source of truth and direction/distance derive from them. When creating an obstacle the editor sets x,y and computes direction/distance. When loading existing obstacles (perhaps from a saved configuration that only has direction/distance), the loader computes x,y from the polar coordinates.

This keeps the shade calculation API unchanged while giving the UI the coordinate system it needs.

## Recommended Implementation Sequence

The implementation should proceed in phases that each deliver value. Start with static rendering that can display obstacles at fixed positions without interaction. This validates the SVG structure and coordinate transformations. Then add pan and zoom so users can navigate a large plot. Next implement obstacle selection and property editing via the panel (not drag/resize yet). This gives a functional editor even before direct manipulation works. Then add placement mode for creating new obstacles. Finally add drag-to-move and resize handles for direct manipulation.

Each phase can ship independently. A user could use the panel-based editor productively even without drag support, and drag support is a refinement that makes the experience smoother rather than unlocking new capability.
