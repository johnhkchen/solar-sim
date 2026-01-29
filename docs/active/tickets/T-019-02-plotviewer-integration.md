---
id: T-019-02
title: Integrate PlotViewer into results page
story: S-019
status: pending
priority: 1
complexity: M
depends_on:
  - T-019-01
output: src/routes/results/+page.svelte
---

# T-019-02: Integrate PlotViewer into Results Page

Add PlotViewer component to the results page so users can model their garden layout with obstacles and slope.

## Context

Research at `docs/knowledge/research/app-integration.md` identified the integration point and data flow. PlotViewer should appear between the sun data card (line 124) and climate data section (line 126) in `src/routes/results/+page.svelte`.

## Task

Import and render PlotViewer in the results page with reactive state for obstacles and slope.

## Implementation Steps

1. Import PlotViewer and related types:
```typescript
import { PlotViewer, type PlotObstacle } from '$lib/components';
import type { PlotSlope } from '$lib/solar/slope';
```

2. Add reactive state for obstacles and slope:
```typescript
let obstacles = $state<PlotObstacle[]>([]);
let slope = $state<PlotSlope>({ angle: 0, aspect: 180 });
```

3. Insert PlotViewer section between sun data and climate:
```svelte
<section class="garden-plot">
  <h2>Your Garden Plot</h2>
  <PlotViewer
    {latitude}
    {longitude}
    date={new Date()}
    bind:obstacles
    bind:slope
  />
</section>
```

4. Add basic CSS for the new section matching existing styles.

## Greppable References

- `PlotViewer` - Component at `src/lib/components/PlotViewer.svelte`
- `PlotObstacle` - Type exported from `src/lib/components/PlotEditor.svelte:12`
- `PlotSlope` - Type at `src/lib/solar/slope.ts:21`

## Acceptance Criteria

PlotViewer renders on results page without errors. User can add, move, and delete obstacles. User can toggle between plan and isometric views. User can adjust slope settings. Component receives correct latitude/longitude from page data.
