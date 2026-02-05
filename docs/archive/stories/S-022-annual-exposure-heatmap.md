---
id: S-022
title: Annual/Seasonal Light Exposure Heatmap
status: ready
priority: high
dependencies:
  - S-020
---

# S-022: Annual/Seasonal Light Exposure Heatmap

## The Gap

S-020 built powerful features into MapPicker:
- ShadeMap layer with real terrain/building shadows
- Tree placement with draggable markers
- Tree shadow compositing that updates with time scrubber
- Observation point for sun-hours calculation
- localStorage persistence

**But these features aren't exposed in the app.** LocationInput uses MapPicker in minimal mode—just for picking a location. The tree placement, shadow controls, and observation point are all hidden because the props aren't passed.

Beyond that integration gap, there's a UX gap: real-time shadows are just a snapshot. Gardeners need **cumulative light exposure** across the growing season - not "where's the shadow at 2pm on March 15th" but "which spots get full sun from April through October?"

## User Need

Maria wants to plant tomatoes (need full sun) and lettuce (tolerate part shade). She doesn't want to scrub through every hour of every day. She wants to see:

1. A heatmap of her garden showing sun exposure zones
2. Color-coded: full sun (6+ hrs) → part sun → part shade → full shade
3. For the **growing season** specifically, not just today
4. Updated when she places/moves trees

Then she can visually identify: "tomatoes go in the red/orange zone, lettuce can go in the yellow zone."

## Deliverables

### Prerequisite: Garden Planner View

Before the heatmap, we need a place to use it. Create a dedicated garden planning interface that exposes MapPicker's full capabilities:

```svelte
<MapPicker
  showShadows={true}
  enableTreePlacement={true}
  enableObservationPoint={true}
  bind:trees={userTrees}
  bind:observationPoint={obsPoint}
  persistTrees={true}
/>
```

This could be:
- A new `/plan` route separate from results
- An expanded section on the results page
- A modal/drawer that opens from results

The key point: users need access to tree placement + shadows before heatmap makes sense.

### Primary: Seasonal Exposure Heatmap

A view mode in the plan/map interface that renders a heatmap overlay showing cumulative sun-hours across a date range (default: growing season for the location).

Visual encoding:
- Full sun (6+ hrs): warm colors (red/orange)
- Part sun (4-6 hrs): yellow
- Part shade (2-4 hrs): light green/cyan
- Full shade (<2 hrs): blue/purple

### Secondary: Time Period Selector

Let users choose the analysis period:
- Growing season (location-aware, Apr-Oct for northern hemisphere)
- Full year
- Custom date range
- Monthly breakdown (carousel or selector)

### Tertiary: Integration with Recommendations

Click a spot on the heatmap → see what that zone can support → get plant recommendations for that specific light level.

## Technical Approach

### Option A: Client-Side Sampling

Sample a grid of points across the visible area. For each point:
1. Query ShadeMap for base exposure (terrain + buildings)
2. Calculate tree shadow interference using our shadow-projection math
3. Integrate across the date range (sample representative days)
4. Render as colored grid cells or interpolated heatmap

**Pros**: Works offline for tree adjustments, no additional API calls per point
**Cons**: Computationally intensive, may be slow for large areas

### Option B: ShadeMap Annual API + Tree Adjustment

If ShadeMap provides annual/accumulated exposure data:
1. Fetch their precomputed exposure layer
2. Subtract tree-shaded hours using our calculation
3. Render adjusted heatmap

**Pros**: Leverages ShadeMap's precomputation
**Cons**: May not support custom date ranges, depends on their API

### Option C: Hybrid

Use ShadeMap for terrain/building base layer (cached), compute tree impact separately, composite the results.

**Recommended**: Start with Option C - it balances accuracy with performance.

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Heatmap View Mode                        │
├─────────────────────────────────────────────────────────────┤
│  ┌─────────────────────────────────────────────────────┐   │
│  │  Base Layer: Map tiles (satellite/street)           │   │
│  │  ─────────────────────────────────────────────────  │   │
│  │  Heatmap Layer: Sun exposure gradient               │   │
│  │  ─────────────────────────────────────────────────  │   │
│  │  Tree Markers: User-placed obstacles                │   │
│  │  ─────────────────────────────────────────────────  │   │
│  │  Observation Point: Click to see details            │   │
│  └─────────────────────────────────────────────────────┘   │
├─────────────────────────────────────────────────────────────┤
│  Period Selector: [Growing Season ▾] Apr 1 - Oct 31        │
├─────────────────────────────────────────────────────────────┤
│  Legend: ████ Full Sun  ████ Part Sun  ████ Part Shade     │
├─────────────────────────────────────────────────────────────┤
│  Click anywhere → "This spot: 5.2 hrs avg (Part Sun)"      │
│                   "Suggested: Peppers, beans, herbs"       │
└─────────────────────────────────────────────────────────────┘
```

## Acceptance Criteria

1. Heatmap view toggle available in plan view interface
2. Heatmap shows sun-hours gradient across visible garden area
3. Period selector defaults to location-appropriate growing season
4. Tree placement updates heatmap in near-real-time (<2s)
5. Clicking a point shows sun-hours value and plant suggestions
6. Legend clearly explains color mapping
7. Works on both map view and isometric view (if feasible)

## Open Questions

- [ ] What grid resolution balances accuracy vs performance? (1m? 2m? 5m?)
- [ ] How many sample days needed for accurate seasonal average?
- [ ] Does ShadeMap API support annual exposure queries?
- [ ] Should heatmap be continuous gradient or discrete zones?
- [ ] How to handle the isometric view - same heatmap projected, or simplified?

## Relationship to Other Stories

- **S-020**: Provides ShadeMap integration and tree placement - this builds on top
- **S-021**: Auto-populated trees feed into this heatmap calculation
- **T-020-06**: Horticultural integration connects heatmap zones to plant recommendations

## References

- ShadeMap examples include "Annual sunlight calculation"
- Our `combined-sun-hours.ts` has point-based calculation, needs grid extension
