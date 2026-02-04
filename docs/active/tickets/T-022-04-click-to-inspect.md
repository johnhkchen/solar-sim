---
id: T-022-04
title: Click-to-inspect sun exposure
status: pending
priority: 3
complexity: S
depends_on: [T-022-02]
story: S-022
---

# T-022-04: Click-to-Inspect Sun Exposure

## Objective

Allow users to click anywhere on the heatmap to see exact sun-hours value and plant suggestions for that spot.

## Acceptance Criteria

1. Click on heatmap shows popup/panel with sun-hours value
2. Shows light category classification (Full Sun, Part Shade, etc.)
3. Shows 2-3 suggested plants for that light level
4. Shows monthly breakdown chart for that point
5. "Set as observation point" action to make it the main reference

## UI Design

On click, show a card/popup:

```
┌────────────────────────────────┐
│ This Spot                      │
│ ──────────────────────────     │
│ 5.2 hours average              │
│ Category: Part Sun             │
│                                │
│ Good for:                      │
│ • Peppers, tomatoes (with care)│
│ • Beans, peas                  │
│ • Most herbs                   │
│                                │
│ [Set as Main Point] [Close]    │
└────────────────────────────────┘
```

## Technical Approach

1. On map click, get lat/lng
2. Look up value in exposure grid (interpolate if between cells)
3. Classify into light category
4. Query plant recommendations for that category
5. Display in Leaflet popup or side panel

## Files to Create/Modify

- `src/lib/components/SpotInspector.svelte` - new component
- Wire into map click handler
