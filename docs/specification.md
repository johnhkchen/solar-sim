# Solar-Sim Specification

> **Status**: Draft
> **Last Updated**: 2026-01-27
> **Phase**: Research & Planning

This is a living specification document. It will evolve as research findings inform pragmatic solutions. For hardened requirements, see `knowledge/requirements/`.

---

## 1. Overview

### 1.1 Purpose

Solar-Sim is a webapp that calculates sun hours and light requirement categories for any location on Earth. It serves gardeners, farmers, and land planners who need accurate solar exposure data without engaging in complex astronomical calculations.

### 1.2 Core Problem

Determining where to plant based on light requirements involves:

- Understanding solar geometry (sun position varies by latitude, season, time of day)
- Calculating cumulative daily sun hours for a location
- Accounting for horizon obstructions and terrain (future consideration)
- Translating technical data into horticultural categories (full sun, part sun, part shade, full shade)

This math is well-documented but tedious to implement correctly. Solar-Sim abstracts this complexity.

### 1.3 Target Users

| User Type | Needs |
|-----------|-------|
| Home gardener | Quick sun/shade assessment for planting decisions |
| Market farmer | Seasonal planning for crop placement |
| Landscape designer | Site analysis for client proposals |
| Permaculture planner | Understanding microclimates and sun patterns |

---

## 2. Technology Stack

### 2.1 Core Stack

| Layer | Technology | Rationale |
|-------|------------|-----------|
| Framework | SvelteKit | Fast, lightweight, good DX |
| Deployment | Cloudflare Workers | Edge deployment, low latency globally |
| Computation | Client-side | Reduces server load, enables offline potential |

### 2.2 Key Libraries

> **TODO**: Research phase will identify optimal libraries for:
> - Solar position calculations (SunCalc, solar-calculator, or custom)
> - Date/time handling with timezone support
> - Geolocation and coordinate handling
> - Visualization (Canvas, SVG, or WebGL)

### 2.3 Constraints

- **Bundle size**: Must remain edge-deployable (Workers have size limits)
- **No heavy backend**: Computation should be client-feasible
- **Offline-friendly**: Core calculations should work without network

---

## 3. Core Features

### 3.1 Location Input

**Description**: User provides a location for analysis.

**Input methods**:
- [ ] Manual coordinate entry (lat/lng)
- [ ] Address/place search (geocoding)
- [ ] Interactive map selection
- [ ] Browser geolocation (with permission)

**Output**: Validated coordinates with timezone inference.

### 3.2 Solar Position Calculation

**Description**: Calculate sun position (altitude, azimuth) for any time at the given location.

**Inputs**:
- Latitude, longitude
- Date and time
- Timezone

**Outputs**:
- Solar altitude (degrees above horizon)
- Solar azimuth (compass bearing)
- Sunrise, sunset, solar noon times
- Day length

**Algorithm considerations**:
> **TODO**: Research required on accuracy vs. complexity tradeoffs
> - NOAA solar calculator algorithms
> - Astronomical almanac methods
> - Simplified approximations vs. full ephemeris

### 3.3 Sun Hours Calculation

**Description**: Calculate total hours of direct sunlight for a location on a given date or across a date range.

**Approach**:
- Integrate solar altitude over daylight hours
- Count hours where altitude > 0° (or configurable horizon angle)
- Aggregate across date ranges for seasonal analysis

**Output categories** (horticultural standard):
| Category | Sun Hours/Day | Typical Use |
|----------|---------------|-------------|
| Full Sun | 6+ hours | Tomatoes, peppers, most vegetables |
| Part Sun | 4-6 hours | Lettuce, herbs, some flowers |
| Part Shade | 2-4 hours | Shade-tolerant vegetables, ferns |
| Full Shade | <2 hours | Hostas, mosses, woodland plants |

### 3.4 Visualization

**Description**: Visual representation of sun path and exposure.

**Potential visualizations**:
- [ ] Sun path diagram (altitude vs. azimuth arc)
- [ ] Shadow simulation for a given time
- [ ] Daily/seasonal sun hours chart
- [ ] Calendar heatmap of sun exposure

> **TODO**: Determine MVP visualization scope

### 3.5 Results Summary

**Description**: Actionable output for the user.

**Includes**:
- Light category classification
- Recommended plant types
- Key solar events (solstices, equinoxes)
- Comparison across seasons

---

## 4. Architecture

### 4.1 High-Level Design

```
┌─────────────────────────────────────────────────────────┐
│                      SvelteKit App                      │
├─────────────────────────────────────────────────────────┤
│  Routes                                                 │
│  ├── / (home + location input)                         │
│  ├── /calculate (results display)                      │
│  └── /about                                            │
├─────────────────────────────────────────────────────────┤
│  Lib                                                    │
│  ├── solar/        # Sun position math                 │
│  ├── geo/          # Coordinate & timezone handling    │
│  ├── categories/   # Light category classification     │
│  └── components/   # Reusable UI components            │
├─────────────────────────────────────────────────────────┤
│  Static Assets                                          │
│  └── (minimal - computation is code-based)             │
└─────────────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────────┐
│              Cloudflare Workers (Edge)                  │
│  - SSR for initial page load                           │
│  - API routes if needed (geocoding proxy, etc.)        │
└─────────────────────────────────────────────────────────┘
```

### 4.2 Data Flow

```
User Input (location)
       │
       ▼
┌──────────────┐
│  Geocoding   │ ──► Coordinates + Timezone
└──────────────┘
       │
       ▼
┌──────────────┐
│ Solar Engine │ ──► Sun positions over time
└──────────────┘
       │
       ▼
┌──────────────┐
│  Aggregator  │ ──► Daily/seasonal sun hours
└──────────────┘
       │
       ▼
┌──────────────┐
│ Classifier   │ ──► Light category + recommendations
└──────────────┘
       │
       ▼
┌──────────────┐
│   Display    │ ──► Visualizations + summary
└──────────────┘
```

---

## 5. Multi-Agent Development Workflow

This project uses a structured workflow for concurrent agent development.

### 5.1 Document Hierarchy

```
specification.md (this file)
       │
       ▼
happy_path.md ──► Defines the target user experience
       │
       ▼
knowledge/requirements/ ──► Hardened PRDs (anchors for spec drift)
       │
       ▼
active/stories/ ──► Feature-level work items (S-NNN-title.md)
       │
       ▼
active/tickets/ ──► Atomic tasks decomposed from stories
       │
       ▼
task-graph.yaml ──► DAG defining execution order + dependencies
```

### 5.2 Task Graph Structure

The `task-graph.yaml` file defines:

- **Nodes**: Individual tickets with metadata
  - `id`: Ticket reference (e.g., `T-001`)
  - `story`: Parent story reference
  - `priority`: 1 (highest) to 5 (lowest)
  - `complexity`: estimated effort (S/M/L/XL)
  - `status`: pending | in-progress | blocked | complete

- **Edges**: Dependencies between tickets
  - A ticket cannot start until its dependencies are complete

### 5.3 Agent Coordination

- **Research agents**: Populate `knowledge/research/` with findings
- **Planning agents**: Create stories from specification + research
- **Decomposition agents**: Break stories into tickets
- **Coding agents**: Implement tickets, guided by task graph
- **Review agents**: Validate implementations against requirements

### 5.4 Specification Drift

This specification will evolve. When findings contradict initial plans:

1. Document the finding in `knowledge/research/`
2. Update this specification with rationale
3. If the change is significant, create/update a PRD in `knowledge/requirements/`
4. PRDs serve as the "hardened" anchor when specification becomes ambiguous

---

## 6. Open Questions

> Items requiring research or decisions before implementation.

### 6.1 Technical

- [ ] Which solar calculation library/algorithm provides the best accuracy-to-complexity ratio?
- [ ] How to handle timezone edge cases (locations on timezone borders)?
- [ ] What's the appropriate time resolution for sun-hour integration (1 min? 5 min? 15 min?)?
- [ ] Should we support terrain/horizon masking in v1?

### 6.2 Product

- [ ] What date range should the default analysis cover (single day vs. year)?
- [ ] Should we support saving/sharing locations?
- [ ] Is offline mode a v1 requirement or future enhancement?

### 6.3 Deployment

- [ ] Cloudflare Workers bundle size limits - will solar libraries fit?
- [ ] Do we need a geocoding API, or can we use browser-based solutions?

---

## 7. References

> Technical resources for implementation.

### 7.1 Solar Calculation Resources

- NOAA Solar Calculator: https://gml.noaa.gov/grad/solcalc/
- Astronomical Algorithms (Jean Meeus) - reference text
- SunCalc library: https://github.com/mourner/suncalc

### 7.2 Horticultural Standards

- USDA Plant Hardiness Zones (for context, not direct use)
- Standard light requirement categories (full sun, part shade, etc.)

### 7.3 Related Projects

> **TODO**: Research existing tools for differentiation analysis

---

## Appendix A: Glossary

| Term | Definition |
|------|------------|
| **Altitude** | Angle of sun above the horizon (0° = horizon, 90° = zenith) |
| **Azimuth** | Compass direction of the sun (0° = North, 90° = East, etc.) |
| **Solar noon** | Time when sun reaches highest point (crosses meridian) |
| **Declination** | Sun's angle relative to Earth's equatorial plane |
| **Sun hours** | Cumulative time with direct sunlight (altitude > 0°) |

---

## Appendix B: Changelog

| Date | Change | Author |
|------|--------|--------|
| 2026-01-27 | Initial draft created | Agent |
