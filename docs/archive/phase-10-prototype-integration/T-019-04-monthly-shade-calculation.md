---
id: T-019-04
title: Calculate monthly shade data for seasonal chart
story: S-019
status: pending
priority: 1
complexity: M
depends_on:
  - T-019-03
output: src/routes/results/+page.svelte
---

# T-019-04: Calculate Monthly Shade Data for Seasonal Chart

Update the SeasonalLightChart to show both theoretical and effective (shade-adjusted) sun hours by month.

## Context

Research at `docs/knowledge/research/app-integration.md` section R3 documents `getSeasonalSummaryWithShade()` at `sun-hours-shade.ts:261-332` for calculating shade impact across date ranges.

## Task

Calculate monthly effective hours and pass both theoretical and effective values to SeasonalLightChart.

## Implementation Steps

1. Import seasonal shade function:
```typescript
import { getSeasonalSummaryWithShade } from '$lib/solar';
```

2. Update monthly data calculation to include effective hours:
```typescript
const monthlyData: MonthlySunData[] = $derived.by(() => {
  const year = new Date().getFullYear();
  const yearSummaries = getYearlySummary(coords, year);

  // Calculate shade impact if obstacles exist
  const shadeData = obstacles.length > 0
    ? getSeasonalSummaryWithShade(
        coords,
        new Date(year, 0, 1),
        new Date(year, 11, 31),
        obstacles
      )
    : null;

  return yearSummaries.map((summary, index) => ({
    month: index + 1,
    theoreticalHours: summary.averageSunHours,
    effectiveHours: shadeData?.dailyAnalysis
      ? calculateMonthlyEffective(shadeData.dailyAnalysis, index + 1)
      : summary.averageSunHours
  }));
});
```

3. Update SeasonalLightChart props:
```svelte
<SeasonalLightChart
  {monthlyData}
  hasShadeData={obstacles.length > 0}
/>
```

## Performance Note

The seasonal calculation covers 365 days × 288 samples = 105,120 operations. This runs in ~100ms but should be debounced and possibly cached. Consider calculating only for the growing season (April-October) initially.

## Greppable References

- `getSeasonalSummaryWithShade` - Function at `src/lib/solar/sun-hours-shade.ts:261`
- `SeasonalLightChart` - Component at `src/lib/components/SeasonalLightChart.svelte`
- `MonthlySunData` - Type in components

## Acceptance Criteria

SeasonalLightChart shows both theoretical and effective bars when obstacles exist. Chart updates when obstacles change. Performance is acceptable (no UI freeze during recalculation).
