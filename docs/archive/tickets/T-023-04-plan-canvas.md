---
id: T-023-04
story: S-023
title: Plan Builder Canvas
status: ready
priority: 2
complexity: L
dependencies:
  - T-023-03
---

# T-023-04: Plan Builder Canvas

## Objective

Create a "Plan" view mode that shows a schematic overhead layout of zones with placed plants, rendered at scale with spacing validation.

## Requirements

### View Toggle

Add Map/Plan toggle to the map toolbar:
- **Map view**: Current satellite/terrain with heatmap overlay (default)
- **Plan view**: Schematic overhead with zones and plants

Toggle persists current phase—both views available in any phase, but Plan view is primary for Plan phase.

### Plan Canvas Rendering

When in Plan view:
- **Background**: White or light gray with subtle grid (1m or configurable scale)
- **Zones**: Filled polygons with light category color (orange/yellow/green/blue at ~30% opacity)
- **Zone labels**: Name centered in each zone
- **Scale bar**: Bottom corner showing distance
- **North arrow**: Top corner
- **Property boundary**: Dashed outline if defined

### Plant Rendering

Plants placed in zones render as:
- **Circle**: Diameter = mature spread at scale (e.g., 3ft plant = 3ft diameter circle)
- **Fill color**: By plant type or category (customizable)
- **Label**: Plant code (first 2-3 letters of name, e.g., "LV" for Lavender)
- **Quantity indicator**: If multiple at same position, show count badge

### Plant Placement

When plants are added to a zone (via plant selection):
- Default position: center of zone, spread to avoid overlap
- User can drag plants to reposition within zone
- Plants snap to grid (optional, can be disabled)

### Spacing Validation

Visual feedback for plant spacing:
- **Valid**: Plants don't overlap more than 20% of their spread
- **Warning**: Yellow ring when plants overlap 20-50%
- **Error**: Red ring when plants overlap >50% or extend outside zone

Show warning count in Plan phase panel: "2 spacing issues"

### Pan and Zoom

Plan canvas supports:
- Pinch-to-zoom on touch
- Scroll wheel zoom on desktop
- Pan by drag
- Fit-to-zones button to auto-frame all zones

## Technical Approach

### Rendering Options

**Option A: SVG overlay on Leaflet**
- Render zones and plants as SVG elements
- Leverage existing Leaflet pan/zoom
- Easier integration with current map setup

**Option B: Separate Canvas element**
- New canvas alongside map (toggle between them)
- More control over rendering
- Better performance for many plants

**Option C: HTML Canvas overlay on Leaflet**
- Use Leaflet.Canvas or custom canvas layer
- Good balance of integration and performance

**Recommended**: Option A (SVG) for initial implementation—simpler, sufficient for reasonable plant counts (<100).

### Coordinate Transformation

Plan canvas needs consistent scale:
- Calculate bounds of all zones
- Add padding
- Compute scale factor to fit viewport
- Transform plant positions from lat/lng to canvas coordinates

## State Model

```typescript
interface PlacedPlant {
  plantId: string;
  quantity: number;
  positions: Array<{ lat: number; lng: number }>;
}

interface Zone {
  // ... existing fields
  plants: PlacedPlant[];
}
```

## Acceptance Criteria

- [ ] Map/Plan toggle visible in toolbar
- [ ] Plan view shows schematic with grid background
- [ ] Zones render as colored regions with labels
- [ ] Plants render as circles at scale with code labels
- [ ] Can drag plants to reposition within zone
- [ ] Spacing validation shows warnings for overlapping plants
- [ ] Scale bar and north arrow present
- [ ] Pan and zoom work smoothly
- [ ] Fit-to-zones button frames all content
- [ ] Toggle persists view preference

## Files to Create/Modify

- New: `src/lib/components/PlanCanvas.svelte` — schematic plan view
- New: `src/lib/components/PlantMarker.svelte` — plant circle rendering
- Modify: `src/lib/components/MapPicker.svelte` — add view toggle
- Modify: `src/routes/results/+page.svelte` — wire view state
