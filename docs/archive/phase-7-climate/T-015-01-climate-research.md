---
id: T-015-01
title: Research climate data sources and visualization
story: S-015
status: complete
priority: 1
complexity: L
depends_on: []
output: docs/knowledge/research/climate-data.md
---

# T-015-01: Research Climate Data Sources and Visualization

Conduct deep research on climate data sources, precision requirements, and visualization approaches.

## Task

Create `docs/knowledge/research/climate-data.md` with detailed findings on data sources, data models, and UX recommendations.

## Research Questions

**R1: Frost Date Data Sources**
- What sources provide frost date data? (NOAA Climate Normals, Open-Meteo, lookup tables)
- What's the coverage? (US only, global?)
- What's the precision? (station-based, gridded, interpolated)
- What's the API cost/rate limits?
- Can we embed a lookup table for offline use?

**R2: Precision Requirements**
- How much do frost dates vary within a region?
- Is county-level precision sufficient, or do we need finer granularity?
- How do microclimates affect frost dates?
- Should we show a range (e.g., "April 10-20") rather than a single date?

**R3: USDA Hardiness Zones**
- Where do we get zone data? (USDA GeoJSON, API, lookup table)
- How do zones map to coordinates?
- Are there international equivalents?

**R4: Growing Season Visualization**
- How do we show frost dates on a timeline?
- Should we show cool-season vs warm-season planting windows?
- How do we integrate with existing sun/shade data display?
- What's the single most useful visualization?

**R5: Data Model**
- What interfaces do we need? (FrostDates, HardinessZone, GrowingSeason)
- How do we handle uncertainty in frost dates?
- Should we cache climate data or fetch on demand?

## Deliverable

A research document with:
1. Recommended data source for frost dates with justification
2. Recommended approach for hardiness zones
3. Proposed TypeScript interfaces
4. UX mockup or description for timeline visualization
5. Implementation sequence recommendation

## Context Files

- `docs/knowledge/research/phase-6-shade-climate.md` (initial research on climate)
- `docs/happy_path.md` (target user experience)
- `src/lib/geo/types.ts` (existing Location type)
