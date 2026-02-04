---
id: T-019-01
title: Research full app integration approach
story: S-019
status: complete
priority: 1
complexity: M
depends_on: []
output: docs/knowledge/research/app-integration.md
---

# T-019-01: Research Full App Integration Approach

Research how to integrate PlotViewer, shade calculations, and recommendations into a cohesive results page experience.

## Context

The following components exist but are not wired together:

| Component | Location | Purpose |
|-----------|----------|---------|
| PlotViewer | `src/lib/components/PlotViewer.svelte` | Wraps PlotEditor + IsometricView + TimeScrubber |
| PlotEditor | `src/lib/components/PlotEditor.svelte` | Obstacle placement UI |
| IsometricView | `src/lib/components/IsometricView.svelte` | 3D shadow visualization |
| TimeScrubber | `src/lib/components/TimeScrubber.svelte` | Time control for shadow animation |
| Results page | `src/routes/results/+page.svelte` | Shows sun data, climate, recommendations |
| Shade calc | `src/lib/solar/sun-hours-shade.ts` | Calculates effective sun hours with obstacles |
| Recommendations | `src/lib/plants/recommendations.ts` | Generates plant suggestions |

The results page currently shows theoretical sun hours. It needs to incorporate obstacle/slope data and show effective sun hours instead.

## Research Questions

### R1: Component Integration Architecture

How should PlotViewer integrate into the results page layout?

- Where in the page hierarchy does it belong? (Before sun data? After? Separate tab?)
- Should it be collapsible/expandable to save vertical space?
- How do we handle the transition from "no obstacles" to "has obstacles" states?
- What's the right visual treatment - card, section, full-width panel?

Read `src/routes/results/+page.svelte` to understand the current layout and identify the best insertion point.

### R2: Data Flow and State Management

How does obstacle data flow through the system?

- What's the current signature of `PlotViewer` props? (Read the component)
- How does `PlotViewer` emit obstacle changes back to the parent?
- What functions in `sun-hours-shade.ts` calculate effective sun hours?
- How does the recommendations engine currently receive sun hours?

Map the complete data flow: `obstacles` → `effective sun hours` → `recommendations`

### R3: Shade Calculation Integration

How do we calculate effective sun hours for the recommendations?

- What's the API of `calculateDailySunHoursWithShade()` or equivalent?
- Does it need obstacles in `PlotObstacle` format or `Obstacle` format?
- How do we handle slope adjustment in the calculation?
- What's the performance cost of recalculating on every obstacle change?

Read `src/lib/solar/sun-hours-shade.ts` and `src/lib/solar/shade.ts` to understand the calculation API.

### R4: LocalStorage Persistence

How should we persist obstacle and slope data?

- What key format works for location-based storage? (e.g., `solar-sim:plot:37.8:-122.4`)
- What precision for coordinate rounding? (0.1° = ~11km, 0.01° = ~1km)
- How do we handle the load/save lifecycle in Svelte 5 runes?
- Should we debounce saves to avoid excessive writes during drag operations?

### R5: Mobile Layout Considerations

How does the integration work on mobile?

- What's the current mobile breakpoint in the results page CSS?
- How large is PlotViewer at minimum? Can it fit in mobile viewport?
- Should PlotViewer be hidden by default on mobile with a "Show garden editor" button?
- How does TimeScrubber work on touch devices?

Read the existing responsive CSS in the results page and PlotViewer component.

### R6: Existing Test Coverage

What tests exist that we need to maintain or extend?

- Are there integration tests for the results page?
- What tests exist for PlotViewer, shade calculations?
- Do we need new tests for the integrated flow?

Check `src/lib/solar/*.test.ts` and any route tests.

## Deliverables

A research document at `docs/knowledge/research/app-integration.md` containing:

- Recommended page layout with PlotViewer integration point
- Complete data flow diagram from obstacles → effective hours → recommendations
- Code examples for state management and persistence
- Mobile layout strategy
- Implementation sequence for remaining S-019 tickets

## Acceptance Criteria

Research answers all six questions with specific file references and code examples. Data flow is fully mapped with function signatures. Layout recommendation includes a sketch or description. Mobile strategy is concrete and testable. Implementation sequence is realistic given the codebase structure.

## Greppable References

To find relevant code, search for:

- `PlotViewer` - The wrapper component to integrate
- `PlotObstacle` - The obstacle data type
- `calculateDailySunHoursWithShade` or `calculateEffectiveSunlight` - Shade calculation functions
- `getRecommendations` - The recommendation engine entry point
- `effectiveHours` or `effective` - Where effective vs theoretical hours are used
- `localStorage` - Existing persistence patterns in the codebase
