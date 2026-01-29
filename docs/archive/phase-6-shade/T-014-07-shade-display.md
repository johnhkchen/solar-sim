---
id: T-014-07
title: Add shade impact display to results
story: S-014
status: pending
priority: 1
complexity: S
depends_on: [T-014-04]
output: src/lib/components/ShadeResults.svelte
---

# T-014-07: Add Shade Impact Display to Results

Show users how obstacles affect their sun hours with a clear numbers comparison.

## Research

The research document recommends a simple comparison as the primary output:

```
Theoretical maximum:  10.5 hours
With your obstacles:   6.2 hours (59%)
Sun hours blocked:     4.3 hours
```

This immediately communicates the magnitude of shade impact. For MVP, we use this numbers comparison rather than timeline or donut visualizations.

## Plan

Create `src/lib/components/ShadeResults.svelte` displaying:

1. **Theoretical hours**: Maximum sun hours without any obstacles
2. **Effective hours**: Actual sun hours after shade blocking
3. **Percentage**: What fraction of sun gets through (effective / theoretical)
4. **Hours blocked**: The difference (theoretical - effective)
5. **Updated category**: Light category based on effective hours (full sun, part sun, etc.)

The component accepts props: `theoreticalHours: number`, `effectiveHours: number`, and optionally `obstacles: Obstacle[]` for showing which obstacles contribute most.

**Visual Design**: Use large, readable numbers. Color-code the comparison (green for sun, gray for blocked). Show the light category prominently since that's what determines plant suitability.

**Conditional Rendering**: If no obstacles exist, show a simplified view with just theoretical hours and a prompt to add obstacles for more accurate results.

## Implementation

Build as a presentational component with no internal state. Parent components pass in calculated values from the shade analysis.

Style using Tailwind or component-scoped CSS consistent with existing components. Ensure good mobile display with stacked layout for small screens.

## Context Files

- `docs/knowledge/research/phase-6-shade-climate.md` (visualization recommendations)
- `src/lib/components/SunDataCard.svelte` (existing results display pattern)
- `src/routes/results/` (results page that will use this component)
