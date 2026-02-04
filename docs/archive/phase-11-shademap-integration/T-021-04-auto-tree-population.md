---
id: T-021-04
title: Auto-populate trees on map load
status: pending
priority: 3
complexity: M
depends_on: [T-021-02, T-021-03]
story: S-021
---

# T-021-04: Auto-Populate Trees on Map Load

## Objective

When user navigates to a location, automatically detect and display trees from canopy height data.

## Acceptance Criteria

1. Trees auto-populate when map settles on a location
2. Loading indicator while fetching/processing canopy data
3. Auto-detected trees render as markers (same style as manual trees)
4. Trees update when user pans to new area
5. Reasonable debounce to avoid excessive API calls during pan
6. Graceful fallback if no canopy data available for area

## Technical Approach

On map `moveend` event:
1. Check if current bounds have cached tree data
2. If not, fetch canopy tile(s) for visible area
3. Run tree extraction algorithm
4. Render detected trees as markers
5. Cache results keyed by tile

## Integration with S-020

Auto-detected trees should use the same marker/shadow system as manually-placed trees from S-020. They feed into the same shadow calculation pipeline.

## UX Considerations

- Show "Detecting trees..." indicator during load
- Don't overwhelm the map with markers in dense forests (limit or cluster)
- Consider zoom-level threshold (don't auto-detect when zoomed out too far)
