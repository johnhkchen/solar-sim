---
id: T-019-06
title: Optimize PlotViewer for mobile layout
story: S-019
status: pending
priority: 1
complexity: M
depends_on:
  - T-019-02
output: src/lib/components/PlotViewer.svelte
---

# T-019-06: Optimize PlotViewer for Mobile Layout

Add a collapsed summary state for PlotViewer on mobile screens to avoid the 600px component dominating the viewport.

## Context

Research at `docs/knowledge/research/app-integration.md` section R5 documents that PlotViewer has a 600px minimum height which consumes the entire viewport on phones. The recommended approach is a collapsed state that expands on tap.

## Task

Add responsive behavior that shows a compact summary on screens under 600px, expanding to full editor on demand.

## Implementation Steps

1. Add collapsed state tracking:
```typescript
let isExpanded = $state(false);
let isMobile = $state(false);

$effect(() => {
  if (typeof window === 'undefined') return;
  const mediaQuery = window.matchMedia('(max-width: 600px)');
  isMobile = mediaQuery.matches;
  const handler = (e: MediaQueryListEvent) => { isMobile = e.matches; };
  mediaQuery.addEventListener('change', handler);
  return () => mediaQuery.removeEventListener('change', handler);
});
```

2. Create summary component for collapsed state:
```svelte
{#if isMobile && !isExpanded}
  <div class="plot-summary" onclick={() => isExpanded = true}>
    <span class="summary-icon">🏡</span>
    <span class="summary-text">
      {#if obstacles.length === 0}
        No obstacles defined
      {:else}
        {obstacles.length} obstacle{obstacles.length !== 1 ? 's' : ''}
        {#if slope.angle > 0}
          , {slope.angle}° {getAspectLabel(slope.aspect)}-facing slope
        {/if}
      {/if}
    </span>
    <span class="expand-hint">Tap to edit</span>
  </div>
{:else}
  <!-- Full PlotViewer content -->
  {#if isMobile}
    <button class="collapse-btn" onclick={() => isExpanded = false}>
      Done editing
    </button>
  {/if}
  <!-- existing view toggle, time scrubber, editor/isometric views -->
{/if}
```

3. Add CSS for collapsed state and mobile adjustments.

## Touch Interaction Notes

PlotEditor uses pointer events which work on touch. TimeScrubber uses HTML5 range input which works natively on touch. IsometricView drag-to-rotate should be disabled on mobile to avoid scroll conflicts.

## Greppable References

- `PlotViewer` - Component at `src/lib/components/PlotViewer.svelte`
- `@media (max-width: 600px)` - Existing breakpoint in results page

## Acceptance Criteria

On mobile (<600px), PlotViewer shows compact summary by default. Tapping summary expands to full editor. "Done editing" button collapses back to summary. Touch interactions work for obstacle placement. Isometric view is accessible but rotation is constrained.
