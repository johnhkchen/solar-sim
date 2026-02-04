---
id: T-020-03
title: Tree shadow compositing
status: complete
priority: 3
complexity: L
depends_on: [T-020-02]
story: S-020
---

# T-020-03: Tree Shadow Compositing

## Objective

Render tree shadow polygons on the map that update with the time scrubber, layered on top of ShadeMap's terrain/building shadows.

## Acceptance Criteria

1. Tree shadows render as semi-transparent polygons on the map
2. Shadows update when time/date changes
3. Shadows update when trees are moved or reconfigured
4. Shadow direction and length are astronomically accurate
5. Shadows visually composite with ShadeMap layer (don't obscure it)

## Technical Approach

Adapt `shadow-projection.ts` to output lat/lng polygon coordinates instead of meters. Use Leaflet polygon layers for tree shadows. Subscribe to time changes and recalculate shadows on update.

Key conversion: tree position (lat/lng) + shadow offset (meters) → shadow polygon (lat/lng vertices). Use simple meter-to-degree approximation based on latitude.

## Files to Modify

- `src/lib/solar/shadow-projection.ts` - add lat/lng output variant
- Map component - add shadow polygon layer
- New utility for meters↔degrees conversion at given latitude

## Notes

Performance consideration: throttle shadow recalculation during rapid time scrubbing.
