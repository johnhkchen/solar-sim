---
id: T-020-08
title: Mobile layout optimization
status: pending
priority: 5
complexity: M
depends_on: [T-020-06]
story: S-020
---

# T-020-08: Mobile Layout Optimization

## Objective

Ensure the map-based shadow viewer works well on mobile devices with touch-friendly controls and responsive layout.

## Acceptance Criteria

1. Map is usable on mobile viewports (pan, zoom, place trees)
2. Tree placement works with touch (tap to place, drag to move)
3. Tree config panel is touch-friendly (large tap targets)
4. Time scrubber works with touch drag
5. Results/recommendations readable on small screens
6. No horizontal scroll on any viewport

## Technical Approach

- Test on actual mobile devices / device emulation
- Ensure touch events work for all interactions
- Responsive breakpoints for panel layouts
- Consider bottom sheet pattern for tree config on mobile

## Files to Modify

- All new S-020 components
- CSS/responsive styles
- Possibly add touch-specific event handlers
