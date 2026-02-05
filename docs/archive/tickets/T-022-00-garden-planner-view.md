---
id: T-022-00
title: Create garden planner view exposing MapPicker features
status: complete
priority: 1
complexity: M
depends_on: []
story: S-022
completed_at: 2026-02-01
---

# T-022-00: Create Garden Planner View

## Problem

S-020 built powerful features into MapPicker:
- ShadeMap layer with real terrain/building shadows
- Tree placement with draggable markers
- Tree shadow compositing
- Observation point selector
- Time scrubber for shadow animation
- localStorage persistence

**None of these are visible to users.** LocationInput uses MapPicker with default props, which hides all the planning features. The component works, but there's no UI path to use it.

## Objective

Create a dedicated garden planning interface that exposes MapPicker's full feature set.

## Acceptance Criteria

1. User can access a garden planner view (route, tab, or expandable section)
2. Tree placement mode is available and functional
3. Observation point can be set and moved
4. Shadow time controls are visible and work
5. Trees persist when user returns to same location
6. Clear UX flow: pick location → plan garden → see results

## Options

### Option A: New /plan route

Separate page at `/plan?lat=X&lng=Y` that loads after location selection.

**Pros**: Clean separation, room for complex UI
**Cons**: Extra navigation step, context switch

### Option B: Expanded results page section

"Plan Your Garden" section on results page that reveals full MapPicker.

**Pros**: Everything in one place, no navigation
**Cons**: Page gets long, may overwhelm

### Option C: Modal/drawer

"Open Garden Planner" button that opens full-screen overlay.

**Pros**: Focused experience, easy to close
**Cons**: Modal fatigue, mobile challenges

**Recommendation**: Start with Option B (expanded section on results). It keeps the flow simple and we can always extract to separate route later.

## Implementation

```svelte
<!-- In results page -->
<section class="garden-planner">
  <h2>Plan Your Garden</h2>
  <p>Place trees and obstacles to see how they affect sun exposure.</p>

  <MapPicker
    initialLocation={{ latitude: location.latitude, longitude: location.longitude }}
    showShadows={true}
    enableTreePlacement={true}
    enableObservationPoint={true}
    bind:trees={userTrees}
    bind:observationPoint={obsPoint}
    persistTrees={true}
    zoom={18}
  />
</section>
```

## Files to Modify

- `src/routes/results/+page.svelte` - add garden planner section
- May need to lift tree/observation state to page level
- Connect observation point sun-hours to recommendations display

## Implementation Notes

The implementation followed Option B, adding an expandable "Garden Planner" section to the results page. The section starts collapsed and expands when the user clicks the "Expand Planner" button.

Key features exposed through the new section:

1. **MapPicker with full features** - The component is rendered with `showShadows`, `enableTreePlacement`, `enableObservationPoint`, `persistTrees`, and `enableAutoTreeDetection` all enabled. The map defaults to zoom level 18 to show property-level detail.

2. **SunHoursDisplay integration** - When an observation point is set, the SunHoursDisplay component shows the calculated sun hours at that spot, including breakdown of theoretical hours, tree shadow impact, and effective hours.

3. **GardeningGuidance integration** - The GardeningGuidance component provides plant recommendations based on the calculated effective sun hours at the observation point, taking into account the placed trees.

4. **State management** - Tree positions and observation point are managed at the page level and passed down to child components. The `plannerTreeConfigs` derived value converts MapTree objects to MapTreeConfig for calculation functions. The `plannerSunHours` derived value computes combined sun hours using `calculateCombinedSunHoursSync`.

5. **Responsive design** - The section adapts for mobile with full-width expand button and single-column layout for the results cards.
