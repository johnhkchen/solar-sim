---
id: T-019-03
title: Connect shade calculations to recommendations
story: S-019
status: pending
priority: 1
complexity: M
depends_on:
  - T-019-02
output: src/routes/results/+page.svelte
---

# T-019-03: Connect Shade Calculations to Recommendations

Update the results page to use shade-adjusted effective sun hours when generating plant recommendations.

## Context

Research at `docs/knowledge/research/app-integration.md` section R3 documents the shade calculation API. The key function is `getDailySunHoursWithShade()` at `sun-hours-shade.ts:54-108`.

## Task

Replace theoretical sun hours with effective (shade-adjusted) hours in the recommendation engine input.

## Implementation Steps

1. Import shade calculation function:
```typescript
import { getDailySunHoursWithShade, type DailySunDataWithShade } from '$lib/solar';
```

2. Create derived state that recalculates when obstacles change:
```typescript
const sunDataWithShade = $derived.by<DailySunDataWithShade>(() => {
  if (obstacles.length === 0) {
    return { ...sunData, effectiveHours: sunData.sunHours, percentBlocked: 0 };
  }
  return getDailySunHoursWithShade(coords, new Date(), obstacles);
});
```

3. Update recommendation input to use effective hours:
```typescript
const recommendations = $derived.by(() => {
  const input = createRecommendationInput(
    sunDataWithShade.effectiveHours,  // Changed from sunData.sunHours
    climateData,
    sunData.sunHours  // Pass theoretical as second param for comparison
  );
  return getRecommendations(input);
});
```

4. Add debouncing (150ms) to prevent excessive recalculation during drag operations.

## Greppable References

- `getDailySunHoursWithShade` - Function at `src/lib/solar/sun-hours-shade.ts:54`
- `createRecommendationInput` - Function at `src/lib/plants/recommendations.ts`
- `getRecommendations` - Function at `src/lib/plants/recommendations.ts`

## Acceptance Criteria

Adding obstacles reduces displayed effective sun hours. Plant recommendations update based on effective hours. With no obstacles, effective equals theoretical. Performance remains responsive during obstacle drag operations.
