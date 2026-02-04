---
id: S-023
title: Plan Generation Flow
status: ready
priority: high
dependencies:
  - S-022
---

# S-023: Plan Generation Flow

## Context

Solar-Sim has powerful capabilities—sun calculations, shadow modeling, tree placement, heatmaps, plant recommendations—but they're organized as a dashboard rather than a guided experience. Users land on a results page with everything visible at once, which works for exploration but doesn't guide them toward the outcome they need: a planting plan they can act on.

The strategic direction is clear: Solar-Sim is a sales enablement tool for saying "yes" to a planting plan. The UI should optimize for speed to confidence and shareable proof. The target is a 15-minute flow from address to exportable PDF.

## User Need

Lisa (landscaper admin) stands in a client's yard with her iPad. She needs to:
1. Pull up the address and see the property
2. Confirm/adjust trees detected from satellite
3. See the sun exposure heatmap for growing season
4. Mark planting beds on the map
5. Get validated plant suggestions for each bed
6. Add plants to a plan with quantities and positions
7. Export a professional PDF to email the client

Today's UI can do steps 1-3 partially, but steps 4-7 don't exist. And even steps 1-3 aren't organized as a clear progression—they're scattered across an expandable "Garden Planner" section and require knowing what to click.

## Deliverables

### D1: Phased Navigation UI

Transform the results page into a stepped flow with four phases:

1. **Site** — Location, tree confirmation, observation point
2. **Analysis** — Heatmap, period selector, spot inspection
3. **Plants** — Zone marking, plant selection per zone
4. **Plan** — Review, export PDF

Visual: Horizontal progress indicator at top. Map canvas persists. Phase panel changes based on current step (bottom sheet on mobile, sidebar on desktop).

### D2: Zone Marking

Users define planting beds on the map as rectangular zones. Each zone:
- Gets a name (auto: "Bed A", "Bed B", or user-editable)
- Calculates average sun hours from heatmap grid
- Displays light category as colored border
- Persists to localStorage with rest of plan state

### D3: Zone-Aware Plant Selection

When entering Plants phase, each zone becomes a section showing validated candidates:
- Zone tabs/selector: "Bed A (Full Sun, 7.2 hrs)" | "Bed B (Part Shade, 3.1 hrs)"
- Filter chips: Native | Edible | Low Water | Deer Resistant
- Plant cards in grid: photo, common name, botanical name, size, "Add" button
- Adding a plant records it in the zone's plant list with quantity

### D4: Plan Builder Canvas

A "Plan" view mode showing the overhead layout:
- Zones as filled regions with light category colors
- Placed plants as circles sized to mature spread
- Labels with plant codes
- Spacing validation (warnings for overlaps)
- Toggle between Map view (satellite + heatmap) and Plan view (schematic)

### D5: PDF Export

Client-side PDF generation with professional format:
- Cover: address, date, summary stats
- Overhead plan: zones, plants, scale bar, north arrow, legend
- Plant schedule table: code, common name, botanical name, qty, size, spacing
- Growing notes per zone

### D6: Mobile/iPad Optimization

- Bottom sheet pattern for phase panels on mobile
- 44pt minimum touch targets
- Portrait-first layout
- High contrast for outdoor visibility
- Swipe gestures between phases

## Technical Approach

### Phase Navigation

Add a `currentPhase` state to results page: `'site' | 'analysis' | 'plants' | 'plan'`. Render phase-specific panel content based on this state. Progress indicator shows all phases with current highlighted.

### Zone Data Model

```typescript
interface Zone {
  id: string;
  name: string;
  bounds: { north: number; south: number; east: number; west: number };
  avgSunHours: number;
  lightCategory: 'full-sun' | 'part-sun' | 'part-shade' | 'full-shade';
  plants: PlacedPlant[];
}

interface PlacedPlant {
  plantId: string;
  quantity: number;
  positions: { lat: number; lng: number }[];
}
```

### Zone-Aware Plant Filtering

Extend existing `getRecommendations()` to accept a light category and return filtered candidates. Add preference filters (native, edible, etc.) as additional constraints.

### PDF Generation

Use jsPDF with custom layout. Render plan canvas to image via html2canvas or canvas export. Format plant schedule as PDF table.

### State Persistence

Extend localStorage schema to include:
```typescript
interface PlanState {
  location: { lat: number; lng: number; name: string };
  trees: Tree[];
  observationPoint: { lat: number; lng: number } | null;
  zones: Zone[];
  currentPhase: Phase;
  preferences: { native: boolean; edible: boolean; ... };
}
```

## Acceptance Criteria

1. Progress indicator shows four phases; clicking advances/retreats
2. Site phase shows tree confirmation and observation point placement
3. Analysis phase shows heatmap with period selector and spot inspection
4. Plants phase allows zone marking with rectangles
5. Plants phase shows zone-aware plant candidates with filters
6. Adding plants records them in zone's plant list
7. Plan view shows overhead schematic with zones and placed plants
8. PDF export generates downloadable document with standard format
9. All state persists to localStorage and survives page refresh
10. Flow works on iPad in portrait orientation with touch gestures

## Relationship to Other Stories

- **S-022**: Provides heatmap and spot inspection—this story wraps them in the flow
- **S-020/S-021**: Tree placement and canopy detection feed into site setup phase
- **Future**: Plant database expansion (richer Sunset data) enhances plant selection

## References

- [UI/UX Research](../../../knowledge/research/ui-ux-plan-generation-flow.md) — detailed research and recommendations
- [Happy Path](../../happy_path.md) — 15-minute flow description
- [Specification](../../specification.md) — value stack and product thesis
