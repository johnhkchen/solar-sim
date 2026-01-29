# T-019-01: Full App Integration Research

This document captures research findings for integrating PlotViewer, shade calculations, and recommendations into a cohesive results page experience. The goal is to wire together existing components so that obstacles placed in the PlotViewer affect effective sun hours and update plant recommendations in real time.

## Component Inventory

The following components and modules are relevant to this integration:

**PlotViewer** (`src/lib/components/PlotViewer.svelte:1-248`) wraps PlotEditor, IsometricView, and TimeScrubber into a unified obstacle placement interface. It manages obstacles and slope state, then calculates shadow polygons from sun position. The component accepts latitude, longitude, date, obstacles array, and slope configuration as props, with optional callbacks for `onObstaclesChange` and `onSlopeChange`.

**PlotEditor** (`src/lib/components/PlotEditor.svelte:1-1077`) provides the plan-view obstacle placement canvas. It exports the `PlotObstacle` interface at line 12, which extends the base `Obstacle` type with x and y coordinates for 2D positioning. The component converts these positions to direction and distance automatically.

**Results page** (`src/routes/results/+page.svelte:1-363`) currently displays sun data, climate information, and plant recommendations. It uses theoretical sun hours exclusively and does not integrate obstacle data. The page already imports `getRecommendations` and `createRecommendationInput` from the plants module.

**Shade calculation module** (`src/lib/solar/sun-hours-shade.ts:1-333`) provides three key functions: `getDailySunHoursWithShade` for simple calculations, `calculateDailyShadeAnalysis` for detailed shade window tracking, and `getSeasonalSummaryWithShade` for date range aggregations.

**Recommendations engine** (`src/lib/plants/recommendations.ts:1-474`) accepts `effectiveSunHours` via `RecommendationInput` and produces scored recommendations with contextual notes based on shade patterns.

## R1: Component Integration Architecture

### Current Results Page Layout

The results page at `src/routes/results/+page.svelte` organizes content in this order:

1. Location info section (lines 111-120)
2. Sun data card section (lines 122-124)
3. Climate data section with hardiness zone, frost dates, and growing timeline (lines 126-163)
4. Recommendations section with PlantRecommendations, SeasonalLightChart, and PlantingCalendar (lines 165-181)
5. Navigation back to home (lines 183-185)

### Recommended Integration Point

PlotViewer should be inserted as a new section between the sun data card and climate data, appearing at approximately line 125. This placement makes sense because the plot configuration directly affects sun hours, so users should define obstacles before seeing climate and recommendation data. The section should be titled "Your Garden Plot" to emphasize that this is where users model their specific situation.

The component hierarchy would look like this: the results page imports PlotViewer from components, passes latitude, longitude, and current date from page data, binds obstacles and slope to local reactive state, and listens for changes via the callback props.

### State Management Approach

When obstacles or slope change, the page recalculates effective sun hours using the shade module, then regenerates recommendations with the new values. This creates a reactive chain: `obstacles` -> `getDailySunHoursWithShade()` -> `createRecommendationInput()` -> `getRecommendations()` -> UI update.

The page should track both theoretical and effective hours separately so the SeasonalLightChart can display the comparison. Currently the chart receives `hasShadeData={false}` at line 174, but once integration is complete this becomes `hasShadeData={obstacles.length > 0}`.

### Collapsibility Consideration

PlotViewer has a minimum height of 600px (defined at `PlotViewer.svelte:171`), which occupies significant vertical space. On initial load with no obstacles, the component should still be visible but could show a condensed state. Rather than making it collapsible, the recommendation is to show a simplified "Add obstacles" prompt when the obstacles array is empty, then expand to full editing once the user adds their first obstacle.

## R2: Data Flow and State Management

### PlotViewer Props Interface

The PlotViewer props are defined at `PlotViewer.svelte:24-32`:

```typescript
interface PlotViewerProps {
  latitude: number;
  longitude: number;
  date?: Date;
  obstacles?: PlotObstacle[];
  onObstaclesChange?: (obstacles: PlotObstacle[]) => void;
  slope?: PlotSlope;
  onSlopeChange?: (slope: PlotSlope) => void;
}
```

The component uses `$bindable()` for obstacles and slope at lines 38-41, so the parent can use two-way binding with `bind:obstacles` instead of the callback pattern if preferred.

### PlotObstacle Type

Defined at `PlotEditor.svelte:12-15`:

```typescript
export interface PlotObstacle extends Obstacle {
  x: number;  // meters east of observation point
  y: number;  // meters north of observation point
}
```

The base `Obstacle` type from `shade-types.ts:27-35` includes id, type, label, direction, distance, height, and width. PlotEditor converts x/y to direction/distance at line 95-101.

### PlotSlope Type

Defined at `slope.ts:21-24`:

```typescript
export interface PlotSlope {
  angle: number;   // degrees from horizontal, 0-45 typical range
  aspect: number;  // compass bearing the slope faces, 0-360
}
```

### Data Flow Diagram

```
User places obstacle in PlotViewer
         │
         ▼
PlotEditor updates obstacles array (x, y, direction, distance, height, width)
         │
         ▼
PlotViewer emits onObstaclesChange(obstacles)
         │
         ▼
Results page receives new obstacles
         │
         ├──────────────────────────────────────────┐
         ▼                                          ▼
getDailySunHoursWithShade(coords, date, obstacles)  getSeasonalSummaryWithShade(coords, start, end, obstacles)
         │                                          │
         ▼                                          ▼
DailySunDataWithShade                              ShadeAnalysis
  .effectiveHours                                    .averageEffectiveHours
  .percentBlocked                                    .dailyAnalysis[]
         │                                          │
         └──────────────┬───────────────────────────┘
                        │
                        ▼
createRecommendationInput(effectiveHours, climate, theoreticalHours)
                        │
                        ▼
getRecommendations(input)
                        │
                        ▼
PlantRecommendations component receives updated recommendations
SeasonalLightChart receives monthlyData with effective vs theoretical
```

### Type Conversion Notes

PlotObstacle and Obstacle are compatible. The shade calculation functions accept `Obstacle[]`, and since PlotObstacle extends Obstacle, arrays of PlotObstacle can be passed directly without conversion. The x and y fields are simply ignored by the shade math.

## R3: Shade Calculation Integration

### Primary Function: getDailySunHoursWithShade

Defined at `sun-hours-shade.ts:54-108`:

```typescript
function getDailySunHoursWithShade(
  coords: Coordinates,
  date: Date,
  obstacles: Obstacle[]
): DailySunDataWithShade
```

Returns an object extending DailySunData with `effectiveHours` (shade-adjusted), `percentBlocked`, plus the base fields `sunHours` (theoretical), `sunTimes`, and `polarCondition`.

### Seasonal Analysis: getSeasonalSummaryWithShade

Defined at `sun-hours-shade.ts:261-332`:

```typescript
function getSeasonalSummaryWithShade(
  coords: Coordinates,
  startDate: Date,
  endDate: Date,
  obstacles: Obstacle[]
): ShadeAnalysis
```

Returns averages across the date range plus per-day breakdown in `dailyAnalysis[]` array. The `dominantBlocker` field identifies which obstacle causes the most shade.

### Slope Integration

The slope module at `slope.ts:152-186` provides `getDailySunHoursWithSlope()` for calculating how terrain slope affects irradiance. However, the current shade calculations do not combine slope and obstacles. For full integration, we need a combined function that applies both slope adjustment and obstacle shading.

The recommended approach is to calculate the slope boost factor via `calculateSlopeBoostFactor()` at line 113, then apply it as a multiplier to the effective hours after shade calculation. This is simpler than modifying the shade module internals.

### Performance Considerations

The shade calculation samples 288 time points per day (every 5 minutes, per `types.ts` constants). For a single day, this runs quickly. For the seasonal summary covering April through October (214 days), the calculation performs 214 * 288 = 61,632 sun position lookups. This runs in under 100ms on modern hardware.

Debouncing obstacle changes is still recommended since drag operations can fire dozens of change events per second. A 150ms debounce on recalculation is appropriate.

## R4: LocalStorage Persistence

### Key Format

The recommended localStorage key format is `solar-sim:plot:{lat}:{lon}` where lat and lon are rounded to 2 decimal places (approximately 1km precision). This provides location-specific storage while avoiding excessive key proliferation.

Example: `solar-sim:plot:45.52:-122.68` for Portland.

### Data Structure

The stored value should be a JSON object containing obstacles and slope:

```typescript
interface PlotStorageData {
  obstacles: PlotObstacle[];
  slope: PlotSlope;
  savedAt: string;  // ISO timestamp
}
```

### Precision for Coordinate Rounding

Two decimal places (0.01°) equals approximately 1.1km at the equator and 0.8km at 45° latitude. This is appropriate because: users querying nearby locations should see the same saved plot, and rounding avoids floating point representation issues creating spurious keys.

### Load/Save Lifecycle in Svelte 5

The pattern uses `$effect` for watching changes and saving:

```typescript
let obstacles = $state<PlotObstacle[]>([]);
let slope = $state<PlotSlope>({ angle: 0, aspect: 180 });
let isLoaded = $state(false);

// Load on mount
$effect(() => {
  if (typeof window === 'undefined') return;
  const key = `solar-sim:plot:${lat.toFixed(2)}:${lon.toFixed(2)}`;
  const stored = localStorage.getItem(key);
  if (stored) {
    const data = JSON.parse(stored) as PlotStorageData;
    obstacles = data.obstacles;
    slope = data.slope;
  }
  isLoaded = true;
});

// Save on changes (debounced)
let saveTimeout: ReturnType<typeof setTimeout> | null = null;
$effect(() => {
  if (!isLoaded) return;  // Don't save during initial load
  const toSave = { obstacles, slope, savedAt: new Date().toISOString() };

  if (saveTimeout) clearTimeout(saveTimeout);
  saveTimeout = setTimeout(() => {
    const key = `solar-sim:plot:${lat.toFixed(2)}:${lon.toFixed(2)}`;
    localStorage.setItem(key, JSON.stringify(toSave));
  }, 500);  // 500ms debounce for saves
});
```

The `isLoaded` flag prevents the save effect from triggering during initial load, which would overwrite localStorage with empty data before the load completes.

### Debouncing Strategy

Save operations should use a 500ms debounce to batch rapid changes during drag operations. Shade recalculations should use a shorter 150ms debounce since they don't hit disk and users want responsive feedback.

## R5: Mobile Layout Considerations

### Current Mobile Breakpoint

The results page uses `@media (max-width: 600px)` at line 353-361 to stack the two-column grid into single column. PlotEditor does not define mobile breakpoints in its CSS.

### PlotViewer Minimum Size

PlotViewer specifies `min-height: 600px` at line 171 and the inner view container specifies `min-height: 400px` at line 235. These dimensions work on tablets but consume the entire viewport on phones.

### Recommended Mobile Strategy

For screens under 600px, PlotViewer should show a collapsed state by default with just a summary line like "No obstacles defined" or "3 obstacles, 15° south-facing slope". Tapping the summary expands to the full editor in a modal or fullscreen overlay.

The expansion button could read "Edit garden layout" and the editor would include a close button to return to the summary. This preserves the full editing experience without forcing users to scroll past a large component on every page load.

### TimeScrubber Touch Support

TimeScrubber at `TimeScrubber.svelte` uses a range input for time selection. HTML5 range inputs work on touch devices natively. The drag interaction in PlotEditor uses pointer events (`onpointerdown`, `onpointermove`, `onpointerup`) which also work on touch devices. No additional touch handling is needed.

### IsometricView on Mobile

The isometric view supports drag-to-rotate and scroll-to-zoom. On mobile, these would conflict with page scrolling. When in mobile mode, the isometric view should be constrained to a fixed viewport without scroll zoom, and rotation should be disabled or triggered by a button instead of drag.

## R6: Existing Test Coverage

### Shade Calculation Tests

`sun-hours-shade.test.ts:1-244` provides comprehensive coverage for the shade calculation functions. Key test cases include: no obstacles returning baseline hours, opaque obstacles reducing hours, obstacles in opposite directions having no effect, tree transparency allowing more light than buildings, and seasonal summary identifying dominant blockers.

### Integration Tests

`happy-path.test.ts:1-235` tests the complete flow from location input through sun calculation and category classification, but does not include shade calculations or recommendations. This is a gap that should be addressed.

### Plant Recommendations Tests

`recommendations.test.ts` tests the scoring algorithms and note generation but with mocked sun hours input. It does not test integration with actual shade calculations.

### Component Tests

No existing Svelte component tests were found in the codebase. The components are tested implicitly through the integration tests and manual verification.

### Tests to Maintain

When implementing integration, these existing tests must continue to pass:
- `sun-hours-shade.test.ts` - all shade calculation behavior
- `recommendations.test.ts` - scoring and rating algorithms
- `happy-path.test.ts` - basic flow without obstacles

### New Tests Needed

The integration should add tests verifying:
- Results page renders PlotViewer without errors
- Obstacle changes trigger recommendation updates
- LocalStorage persistence saves and loads correctly
- Empty obstacles array shows theoretical hours as effective
- Mobile collapsed state renders correctly

## Implementation Sequence

Based on this research, the recommended implementation order for remaining S-019 tickets is:

**T-019-02: PlotViewer results page integration** (highest priority)
- Import PlotViewer into results page
- Add reactive state for obstacles and slope
- Wire up change handlers
- Position between sun data and climate sections

**T-019-03: Shade-adjusted recommendations**
- Replace `sunData.sunHours` with shade-calculated effective hours
- Pass both theoretical and effective hours to recommendations
- Update SeasonalLightChart with `hasShadeData={true}` when obstacles exist

**T-019-04: Monthly shade calculation**
- Calculate monthly effective hours using getSeasonalSummaryWithShade
- Build MonthlySunData array with both theoretical and effective values
- Pass to SeasonalLightChart component

**T-019-05: LocalStorage persistence**
- Implement plot data storage keyed by rounded coordinates
- Add load effect on page mount
- Add debounced save effect on state changes

**T-019-06: Mobile layout optimization**
- Add collapsed summary state for PlotViewer under 600px
- Implement expand/collapse interaction
- Test touch interactions work correctly

**T-019-07: Integration testing**
- Add Playwright or Vitest tests for the complete flow
- Verify reactivity chain from obstacle changes to recommendation updates
- Test persistence across page reloads

This sequence prioritizes getting the core integration working first, then adding polish and robustness incrementally.
