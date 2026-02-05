---
id: T-023-06
story: S-023
title: Mobile/iPad Optimization
status: ready
priority: 2
complexity: M
dependencies:
  - T-023-01
---

# T-023-06: Mobile/iPad Optimization

## Objective

Optimize the plan generation flow for iPad usage in on-site consultations. Lisa needs to walk a client's property with her iPad, mark zones, select plants, and generate a PDF—all with a touch-first interface that works in bright sunlight.

## Requirements

### Bottom Sheet Pattern

On mobile/tablet (<768px width or touch device):
- Phase panel renders as a bottom sheet
- Default height: ~40% of viewport
- Expandable to ~80% by drag or tap
- Collapsible to ~10% (just header showing)
- Swipe down to collapse, swipe up to expand
- Sheet shows current phase title and quick stats

### Touch Targets

All interactive elements must meet 44×44pt minimum:
- Buttons
- Phase indicator steps
- Zone selection areas
- Plant card tap areas
- Quantity controls (+/-)
- Filter chips

Audit and fix any undersized targets from current implementation.

### Gesture Support

- **Swipe left/right** on bottom sheet: navigate phases
- **Swipe down** on bottom sheet: collapse
- **Swipe up** on bottom sheet: expand
- **Long press** on zone: show context menu (rename, delete)
- **Long press** on plant in plan: show context menu (remove, edit quantity)
- **Pinch** on map/plan: zoom
- **Two-finger pan**: pan map while sheet is open

Prevent gesture conflicts:
- Single-finger drag on map = pan map (not drag sheet)
- Drag on sheet header = resize sheet
- Drag inside sheet content = scroll content

### Portrait Orientation

Design for portrait-first:
- Phase indicator: compact horizontal strip
- Map: top 55-60% of screen
- Bottom sheet: bottom 40-45%
- Plant cards: 2-column grid
- Plan canvas: fits in viewport with zoom-to-fit

Landscape should also work but isn't primary.

### High Contrast for Outdoors

- Increase contrast on:
  - Zone labels (dark text on light background)
  - Heatmap legend
  - Plant card text
  - Buttons and controls
- Avoid light gray on white
- Consider auto-switching to high-contrast mode based on ambient light (future/optional)

### Offline Capability

Verify these work without network:
- Solar calculations (already client-side)
- Heatmap rendering (depends on cached grid data)
- Plant database queries (embed data, don't fetch)
- PDF generation (client-side with jsPDF)
- localStorage persistence

Map tiles require network, but plan view (schematic) doesn't.

### Performance

- Phase transitions: <100ms
- Bottom sheet animation: 60fps
- Plant grid scroll: smooth
- PDF generation: <5s
- Test on actual iPad (not just browser dev tools)

## Implementation Notes

### Bottom Sheet Component

Create reusable `BottomSheet.svelte`:
```svelte
<BottomSheet
  title="Plants"
  height={sheetHeight}
  onHeightChange={(h) => sheetHeight = h}
  collapsible={true}
  expandable={true}
>
  <slot />
</BottomSheet>
```

Use CSS `touch-action` to manage gesture handling.
Consider using a library like `svelte-bottom-sheet` or build custom.

### Responsive Breakpoints

```css
/* Mobile/tablet: bottom sheet */
@media (max-width: 767px) { ... }

/* Desktop: sidebar */
@media (min-width: 768px) { ... }

/* Large desktop: wider sidebar */
@media (min-width: 1200px) { ... }
```

### Touch Target Audit

Check all components for:
- Button heights
- Link tap areas
- Form inputs
- Custom controls

Add padding or min-height as needed.

## Acceptance Criteria

- [ ] Bottom sheet renders on mobile/tablet widths
- [ ] Sheet expands/collapses via drag gesture
- [ ] Swipe left/right navigates phases
- [ ] All touch targets are ≥44×44pt
- [ ] Long-press context menus work on zones and plants
- [ ] Portrait orientation works well on iPad
- [ ] Text is readable in bright light (high contrast)
- [ ] Core flow works offline (except map tiles)
- [ ] Animations are smooth (60fps)
- [ ] Tested on actual iPad device

## Files to Create/Modify

- New: `src/lib/components/BottomSheet.svelte` — mobile panel component
- Modify: `src/lib/components/PhasePanel.svelte` — use BottomSheet on mobile
- Modify: `src/routes/results/+page.svelte` — responsive layout switching
- Modify: various components — touch target sizing
- New: `src/lib/styles/high-contrast.css` — contrast improvements (or inline)
