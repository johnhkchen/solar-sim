---
id: T-023-02
story: S-023
title: Zone Marking UI
status: ready
priority: 1
complexity: M
dependencies:
  - T-023-01
  - T-022-01
---

# T-023-02: Zone Marking UI

## Objective

Enable users to define rectangular planting zones on the map. Each zone captures the sun exposure for that area and becomes a container for plant selection.

## Requirements

### Zone Drawing Interaction

When in Plants phase with zone-marking mode active:
1. User taps a corner of the intended zone
2. Drags to opposite corner
3. Rectangle appears showing zone bounds
4. On release, zone is created with auto-generated name ("Bed A", "Bed B", etc.)

### Zone Properties

Each zone calculates and displays:
- **Name**: editable, defaults to "Bed A", "Bed B", etc.
- **Bounds**: lat/lng rectangle
- **Average sun hours**: calculated from heatmap grid points within bounds
- **Light category**: derived from average sun hours (full-sun/part-sun/part-shade/full-shade)
- **Area**: square meters or square feet

### Zone Display

On the map:
- Zones render as semi-transparent filled rectangles
- Border color indicates light category (orange=full-sun, yellow=part-sun, green=part-shade, blue=shade)
- Label in center shows zone name
- Selected zone has thicker border or glow

### Zone Management

- **Select**: tap zone to select it
- **Move**: drag selected zone to reposition
- **Resize**: drag corner handles to resize
- **Delete**: delete button or long-press menu
- **Rename**: tap label or edit in zone list

### Zone List (in Phase Panel)

When in Plants phase, panel shows:
- List of all zones with name, light category, area
- Tap zone in list to select it on map and scroll to it
- "Add Zone" button to enter zone-drawing mode
- Delete button per zone

## Data Model

```typescript
interface Zone {
  id: string; // uuid
  name: string;
  bounds: {
    north: number; // latitude of north edge
    south: number; // latitude of south edge
    east: number;  // longitude of east edge
    west: number;  // longitude of west edge
  };
  avgSunHours: number;
  lightCategory: 'full-sun' | 'part-sun' | 'part-shade' | 'full-shade';
  plants: PlacedPlant[]; // populated in later ticket
}
```

### Sun Hours Calculation

When zone is created or resized:
1. Get all heatmap grid points within zone bounds
2. Calculate average sun hours across those points
3. Classify into light category using standard thresholds
4. Update zone display with new values

This depends on T-022-01 (grid-based exposure calculation) providing the data.

## Implementation Notes

1. Create `ZoneEditor.svelte` component that overlays on MapPicker
2. Use Leaflet's Rectangle class for zone rendering
3. Handle touch events for drawing (distinguish from map pan)
4. Store zones in parent state, persist to localStorage
5. Recalculate sun hours when heatmap data changes (trees moved, period changed)

## Acceptance Criteria

- [ ] Can draw rectangular zones by tap-drag on map
- [ ] Zones display with light-category-colored borders
- [ ] Zone name label visible in center of zone
- [ ] Can select, move, and resize existing zones
- [ ] Can delete zones
- [ ] Zone list in panel shows all zones with properties
- [ ] Selecting zone in list highlights it on map
- [ ] Zone sun hours update when heatmap changes
- [ ] Zones persist to localStorage

## Files to Create/Modify

- New: `src/lib/components/ZoneEditor.svelte` — zone drawing and editing
- New: `src/lib/components/ZoneList.svelte` — panel list of zones
- Modify: `src/routes/results/+page.svelte` — integrate zone state
- Modify: `src/lib/storage/` — extend persistence schema for zones
