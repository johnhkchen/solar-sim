---
id: S-020
title: ShadeMap Integration - Plan View with Tree Shadows
status: draft
priority: high
dependencies: []
---

# S-020: ShadeMap Integration - Plan View with Tree Shadows

## The Gap in the Market

Every existing shadow simulation tool has the same blind spot: **trees**.

- **ShadeMap** renders terrain + OSM buildings beautifully, but no trees
- **Shadowmap** has tree data for only 3 European cities
- **Sunio** tracks sun position, doesn't model obstacles at all
- **ShadowCalculator** is dead

For gardeners, trees are often the primary source of shade. A neighbor's oak, the maple in the corner, the hedge along the fence—these dominate the light conditions in most residential gardens. No existing tool lets users place trees and see their shadow impact on a real map with real terrain.

**Solar-Sim's core differentiator: Plan view with accurate tree-impacted shade maps.**

We composite ShadeMap's terrain + building shadows with our tree shadow calculations to produce the first complete shadow simulation for garden planning.

## Future: Auto-Populated Trees (S-021)

Meta's Data for Good program provides global canopy height maps at individual-tree resolution, freely available on AWS S3. S-021 will explore using this dataset to auto-populate trees, reducing manual placement to just refinements (new plantings, removals, adjustments). See `docs/active/stories/S-021-tree-canopy-data.md` for details.

## Relationship to S-019

S-019 (Full App Integration) was designed around our custom isometric view with manual obstacle placement. S-020 represents a strategic pivot: instead of wiring together our existing prototype components, we integrate with ShadeMap to get real-world terrain and building data, then layer our tree shadows on top.

**S-020 supersedes parts of S-019**, specifically:
- PlotEditor's building placement → replaced by auto-populated OSM buildings
- Custom slope modeling → replaced by real DEM terrain
- Isometric view → becomes optional secondary visualization

**S-020 preserves and elevates**:
- Tree/hedge placement (our unique feature)
- Shadow projection math (adapted for map overlay)
- Horticultural engine (recommendations, growing seasons)
- Time scrubber (animating through the day)

## Context

Research into 3D rendering approaches (see `docs/knowledge/research/3d-rendering-evaluation.md`) revealed that ShadeMap offers a free Educational tier for academic/hobby projects. Rather than building terrain and building shadow simulation from scratch, we leverage their API for the hard stuff (DEM terrain, OSM buildings) and focus on what they don't do: trees.

This is a low-risk integration with clear exit paths. If the prototype validates, we go commercial ($40/month) when there's revenue. If volume makes that expensive, we self-host using AWS Terrarium DEM + OSM Overpass.

## Value Proposition

**What ShadeMap provides:**
- Real terrain shadows from DEM elevation data
- Auto-populated building shadows from OpenStreetMap
- Annual sun exposure calculations
- Proven, working infrastructure

**What we provide (that nobody else does):**
- Tree and hedge placement with accurate shadow projection
- Composited view: terrain + buildings + trees in one map
- Horticultural translation (sun-hours → plant categories → recommendations)
- Growing season focus with planting calendars
- Zero-friction free tool for gardeners

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     Solar-Sim UI                            │
├─────────────────────────────────────────────────────────────┤
│  Location Picker  │  Tree Placement  │  Results/Recs       │
├───────────────────┴──────────────────┴──────────────────────┤
│                    Leaflet Map Container                     │
│  ┌─────────────────────────────────────────────────────┐    │
│  │  Base: Satellite/Street tiles                       │    │
│  │  ───────────────────────────────────────────────    │    │
│  │  ShadeMap Layer (terrain + OSM buildings)           │    │
│  │  ───────────────────────────────────────────────    │    │
│  │  Tree Markers (user-placed, draggable)              │    │
│  │  ───────────────────────────────────────────────    │    │
│  │  Tree Shadow Polygons (our calculation)             │    │
│  └─────────────────────────────────────────────────────┘    │
├─────────────────────────────────────────────────────────────┤
│  Time Scrubber (animates all shadows together)              │
├─────────────────────────────────────────────────────────────┤
│  Observation Point Selector (where to measure sun hours)    │
├─────────────────────────────────────────────────────────────┤
│  Sun Hours Display (ShadeMap base + tree shadow reduction)  │
├─────────────────────────────────────────────────────────────┤
│  Horticultural Engine (categories, recommendations, calendar)│
└─────────────────────────────────────────────────────────────┘
```

Optional: Isometric view toggle for users who want the 3D visualization.

## Acceptance Criteria

1. User can navigate to any location and see terrain + building shadows on the map
2. User can place trees with configurable type (deciduous/evergreen), height, and canopy width
3. Tree shadows render as polygons on the map, updating with time scrubber
4. User can set an observation point ("my garden bed is here")
5. System calculates total sun hours at observation point, accounting for all shadow sources
6. Recommendations update based on effective sun hours
7. Works on Educational API tier (localhost + one staging domain)

## Technical Approach

### Phase 1: ShadeMap Integration

Install `leaflet-shadow-simulator`, configure Educational API key, verify shadows render on our existing Leaflet map picker.

### Phase 2: Tree Placement on Map

Convert tree placement from PlotEditor's coordinate system to Leaflet markers. User clicks to place, drags to reposition, clicks to configure (height, width, type).

### Phase 3: Tree Shadow Compositing

Adapt `shadow-projection.ts` to output Leaflet polygon coordinates. Render tree shadows as semi-transparent overlays. Ensure they update when time changes.

### Phase 4: Combined Sun Hours Calculation

Query ShadeMap for base sun hours at observation point. Subtract time blocked by tree shadows using our existing shade-window math. Display effective sun hours.

### Phase 5: Horticultural Integration

Feed effective sun hours to recommendation engine. Show plant suggestions, growing season calendar, planting dates—all the differentiating features.

### Phase 6 (Optional): Isometric View

Keep isometric view as toggle for users who want it. Shares obstacle data with map view.

## Risks and Mitigations

| Risk | Mitigation |
|------|------------|
| API rate limits on Educational tier | Cache responses, throttle updates during scrubbing |
| ShadeMap API changes | Thin adapter layer, can swap to self-hosted |
| Tree shadows look wrong on map projection | Test various polygon rendering approaches |
| Compositing sun-hours is complex | Start with visual-only, add calculation incrementally |

## Exit Paths

1. **Stay on Educational** — Open-source hobby project, free forever
2. **Go Commercial** — $40/month when revenue justifies it
3. **Self-host** — AWS Terrarium DEM + OSM Overpass, same architecture

All three paths preserve tree placement and horticultural engine unchanged.

## What This Replaces from S-019

| S-019 Component | S-020 Approach |
|-----------------|----------------|
| PlotEditor building placement | Auto from OSM via ShadeMap |
| Custom slope input | Real terrain from DEM |
| IsometricView as primary | Map view as primary, isometric optional |
| Manual coordinate system | Real-world lat/lng on map |
| PlotViewer integration | New map-based viewer |

## What We Keep

- `shadow-projection.ts` core math (adapted for lat/lng)
- `sun-hours.ts` integration methodology
- `plants/recommendations.ts` horticultural logic
- Time scrubber component (adapted for Leaflet)
- All climate integration (frost dates, hardiness zones, etc.)

## Open Questions

- [ ] How does ShadeMap's sun exposure number combine with our tree shadow calculations?
- [ ] What's the right UX for placing trees on a map vs. the abstract PlotEditor grid?
- [ ] Should we deprecate isometric view entirely or keep it as an option?

## References

- [leaflet-shadow-simulator](https://github.com/ted-piotrowski/leaflet-shadow-simulator)
- [ShadeMap examples](https://github.com/ted-piotrowski/shademap-examples)
- [ShadeMap demo](https://ted-piotrowski.github.io/leaflet-shadow-simulator/examples/map.html)
- [3D Rendering Evaluation](../../../docs/knowledge/research/3d-rendering-evaluation.md)
