---
id: T-022-03
title: Analysis period selector
status: pending
priority: 2
complexity: S
depends_on: [T-022-01]
story: S-022
---

# T-022-03: Analysis Period Selector

## Objective

UI component for selecting the date range used in heatmap calculation.

## Acceptance Criteria

1. Dropdown with preset options: Growing Season, Full Year, Custom
2. Growing Season auto-detects based on location (frost dates)
3. Custom allows picking start/end dates
4. Shows selected range as human-readable text
5. Changing period triggers heatmap recalculation
6. Monthly breakdown option (tabs or carousel)

## Preset Periods

- **Growing Season**: From last frost to first frost (use existing frost date data)
- **Full Year**: Jan 1 - Dec 31
- **Spring**: Mar 1 - May 31
- **Summer**: Jun 1 - Aug 31
- **Fall**: Sep 1 - Nov 30
- **Custom**: Date pickers

## Technical Approach

```svelte
<PeriodSelector
  location={coords}
  bind:period={selectedPeriod}
  on:change={recalculateHeatmap}
/>
```

Reuse frost date lookup from existing climate module to determine growing season bounds.

## Files to Create/Modify

- `src/lib/components/PeriodSelector.svelte` - new component
- Integration with climate/frost-dates module
