---
id: T-023-01
story: S-023
title: Phase Navigation UI
status: complete
priority: 1
complexity: M
dependencies: []
completed_at: 2026-01-31
---

# T-023-01: Phase Navigation UI

## Objective

Transform the results page from a dashboard into a stepped four-phase flow with persistent map canvas and dynamic phase panels.

## Requirements

### Phase State

Add phase management to the results page:
- `currentPhase`: `'site' | 'analysis' | 'plants' | 'plan'`
- Phase transitions: next/previous buttons, direct navigation via progress indicator
- Validation before advancing (e.g., can't go to Plants without at least one zone)

### Progress Indicator

Horizontal stepper at top of page showing:
- Four phase labels: Site → Analysis → Plants → Plan
- Current phase highlighted
- Completed phases have checkmark or filled style
- Clickable to navigate (with validation)

### Layout Structure

**Desktop (>768px)**:
- Map canvas: left 60% of viewport
- Phase panel: right 40%, scrollable
- Progress indicator: full width above both

**Mobile/iPad (<768px)**:
- Map canvas: full width, ~60% height
- Phase panel: bottom sheet, ~40% height, expandable
- Progress indicator: compact, above map

### Phase Panel Content

Each phase renders different content in the panel area:
- **Site**: Tree list (confirm/delete), observation point status, "Trees look correct" button
- **Analysis**: Period selector, sun hours summary, spot inspector results
- **Plants**: Zone list, zone selector, plant grid (to be built in later tickets)
- **Plan**: Plan summary, export button, share options (to be built in later tickets)

For this ticket, implement the skeleton—phase switching works, but Plants and Plan phases show placeholder content.

### Transitions

- "Next" button at bottom of each phase panel
- "Back" link or button to return to previous phase
- Keyboard: arrow keys for phase navigation (desktop)
- Touch: swipe left/right on phase panel for navigation (mobile)

## Implementation Notes

1. Keep existing results page components; wrap them in phase-conditional rendering
2. Use Svelte 5 `$state` for phase management
3. Persist `currentPhase` to localStorage with rest of plan state
4. Add URL hash for deep-linking: `#site`, `#analysis`, `#plants`, `#plan`

## Acceptance Criteria

- [ ] Progress indicator visible on results page with four phases
- [ ] Clicking phase label navigates to that phase
- [ ] Next/Back buttons work to advance/retreat
- [ ] Map canvas stays visible during all phases
- [ ] Phase panel content changes based on current phase
- [ ] Mobile layout uses bottom sheet pattern
- [ ] Current phase persists across page refresh
- [ ] URL hash updates with phase changes

## Files to Modify

- `src/routes/results/+page.svelte` — add phase state and conditional rendering
- New: `src/lib/components/PhaseIndicator.svelte` — progress indicator component
- New: `src/lib/components/PhasePanel.svelte` — container for phase content
- Possibly: `src/lib/components/BottomSheet.svelte` — mobile panel component
