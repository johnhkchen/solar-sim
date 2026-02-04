---
id: T-020-04
title: Observation point selector
status: complete
priority: 2
complexity: S
depends_on: [T-020-01]
story: S-020
---

# T-020-04: Observation Point Selector

## Objective

Allow users to place an observation point marker ("my garden bed is here") that becomes the reference point for sun-hours calculations.

## Acceptance Criteria

1. User can place/move an observation point marker on the map
2. Observation point is visually distinct from tree markers
3. Point defaults to map center on initial load
4. Sun-hours display updates when observation point moves
5. Clear visual feedback showing "calculations are for this spot"

## Technical Approach

Single draggable marker with distinctive styling (e.g., red pin or crosshairs). Position stored in component state. When position changes, trigger recalculation of sun exposure at that point.

## Files to Create/Modify

- Map component - add observation point marker
- State management for observation point position
- Wire position changes to sun-hours calculation

## Notes

This is the point where we'll query "how many sun hours does this spot get?" combining ShadeMap's terrain/building data with our tree shadow calculations.
