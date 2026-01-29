# Phase 6 Research: Shade Modeling and Climate Data

This document captures research questions for the next development phase. The current app calculates maximum theoretical sun hours, but real-world gardening requires understanding actual light conditions including shade from obstacles and climate factors like frost dates and growing seasons.

## Problem Statement

The current solar engine calculates an upper bound: how much sunlight a location could receive if nothing blocked it. But a south-facing yard with a large tree will have dramatically different light conditions than the raw calculation suggests. Similarly, knowing sun hours alone doesn't tell a gardener when their growing season starts and ends.

Two major feature areas emerge: shade modeling (what blocks the sun) and climate integration (temperature-based growing conditions).

## Research Questions

### R1: How Do We Model Shade from Obstacles?

Real yards have trees, buildings, fences, and terrain that cast shadows. The shadow position changes throughout the day as the sun moves, and throughout the year as the sun's arc shifts.

Sub-questions:
- What data do we need to represent an obstacle? (height, width, position, shape)
- How do we calculate when an obstacle blocks the sun at a given point?
- Should obstacles be 2D profiles or 3D volumes?
- How do we handle trees (partial shade, seasonal leaf cover)?
- What's the minimum viable obstacle model that provides useful results?

The sun position calculation we already have provides azimuth and altitude. An obstacle blocks the sun when it intersects the line from the observation point to the sun. The math is ray-obstacle intersection testing.

### R2: How Should Users Input Obstacle Data?

Getting obstacle information from users is a UX challenge. Asking for precise measurements is burdensome. Options include:

- Manual entry: user provides height, distance, direction for each obstacle
- Drawing tool: user sketches obstacles on a map or grid
- Photo analysis: user uploads photos and we estimate obstacle positions
- Satellite/aerial: use existing imagery to detect buildings and trees

For MVP, manual entry with simple presets (6ft fence, 30ft tree, 2-story house) may be sufficient. The interface could show a compass rose where users place obstacles by direction and estimate height/distance.

### R3: What Climate Data Do We Need?

Beyond sunlight, plants care about temperature. Key factors include:

- **First/last frost dates**: defines the frost-free growing season
- **USDA Hardiness Zone**: based on average annual minimum temperature
- **Heat zones**: based on days above 86°F (30°C)
- **Growing degree days**: accumulated heat units for crop maturity

For a gardening app, frost dates are most actionable. They tell users when to plant warm-season crops and when to expect the first fall frost.

### R4: Where Do We Get Climate Data?

Several data sources exist:

- **NOAA Climate Normals**: 30-year averages for US weather stations, includes frost dates
- **PRISM Climate Data**: gridded climate data interpolated between stations
- **Open-Meteo Historical Weather API**: free tier available, global coverage
- **Hardiness zone maps**: USDA publishes GeoJSON, also available via API

For MVP, we could use a lookup table of frost dates by latitude/region, or integrate with an API for more precision. The USDA zone can be approximated from minimum winter temperature.

### R5: How Do We Visualize Growing Seasons?

The current app shows a single sun-hours number. Users need to understand timing:

- When does the growing season start (after last frost)?
- When does it end (before first frost)?
- How long is the season in days?
- For cool-season crops, when are the shoulder seasons?

A timeline visualization could show:
- Frost risk periods (winter)
- Cool-season planting windows (early spring, fall)
- Warm-season growing period (frost-free summer)
- Sun hours overlaid on the timeline

### R6: How Do Shade and Climate Interact?

A spot with afternoon shade might be perfect for lettuce in summer (cool-season crop that bolts in heat) but terrible for tomatoes (need full sun and heat). The recommendation engine needs both factors:

- Sun hours (reduced by shade)
- Temperature regime (from climate data)
- Frost-free season length

This suggests the UI should show: "This spot gets 5 hours of sun with afternoon shade. Your growing season is 180 days. Good for: lettuce, spinach, herbs. Not ideal for: tomatoes, peppers."

## Technical Considerations

### Shade Calculation Performance

Checking sun-obstacle intersection for every minute of the day across 365 days is expensive. Optimizations:
- Sample at larger intervals (every 15 or 30 minutes)
- Cache obstacle shadow boundaries
- Pre-compute "shade windows" per obstacle

### Climate Data Storage

Options for storing climate data:
- Embed lookup tables in the app (simple, works offline, less precise)
- Fetch from API at runtime (precise, requires network, rate limits)
- Hybrid: coarse local data with API refinement

### Data Model Changes

The Location type may need extension:
```typescript
interface GardenSpot extends Location {
  obstacles: Obstacle[];
  climate?: ClimateData;
}

interface Obstacle {
  type: 'tree' | 'building' | 'fence' | 'terrain';
  direction: number; // degrees from north
  distance: number; // meters from observation point
  height: number; // meters
  width?: number; // meters, for buildings/fences
  seasonal?: boolean; // true for deciduous trees
}

interface ClimateData {
  lastFrostSpring: Date;
  firstFrostFall: Date;
  hardinessZone: string;
  growingSeasonDays: number;
}
```

## Recommended Approach

### Phase 6a: Shade Modeling MVP

Start with simple obstacle input and shadow calculation:

1. Add obstacle data model (direction, distance, height)
2. Implement sun-obstacle intersection math
3. Calculate "effective sun hours" accounting for shade
4. Show comparison: theoretical max vs actual with shade
5. Simple UI for adding obstacles by compass direction

### Phase 6b: Climate Integration

Add frost dates and growing season:

1. Integrate frost date data (lookup table or API)
2. Calculate growing season length
3. Add USDA zone lookup
4. Visualize growing season timeline
5. Update recommendations to consider season length

### Phase 6c: Combined Recommendations

Merge shade and climate into unified advice:

1. Factor both shade and climate into plant recommendations
2. Show planting calendar based on frost dates
3. Indicate which spots are best for which crop types
4. Seasonal view showing light conditions month by month

## Open Questions

- Do we need terrain slope modeling, or is that too complex for MVP?
- Should we support multiple observation points (different garden beds)?
- How do we handle the UX of "your results changed" when obstacles are added?
- Is photo-based obstacle detection worth the complexity?

## Next Steps

After this research is reviewed, create stories and tickets for Phase 6a (Shade Modeling MVP) as the next sprint. Climate integration can follow once shade works.

---

## Deep Dive: Shade Modeling

This section provides implementation-ready details for the shade calculation system, including the core math, data structures, performance analysis, and UX recommendations.

### Shadow Geometry Math

The fundamental question is: does obstacle X block the sun from point P at time T? We already have `getSunPosition()` returning altitude and azimuth, so the remaining math is ray-obstacle intersection.

#### Angular Height Test

An obstacle of height h at distance d from the observation point subtends an angular height as seen from ground level:

```
obstacle_angular_height = atan(h / d)
```

The sun is blocked when its altitude falls below this angle AND its azimuth falls within the obstacle's angular span. For a wide obstacle (like a building), we also compute the angular width:

```
obstacle_angular_width = 2 * atan((w / 2) / d)
```

where w is the obstacle's physical width. The obstacle spans azimuths from `(direction - angular_width/2)` to `(direction + angular_width/2)`.

#### Shadow Length (informational)

While not strictly needed for the intersection test, shadow length helps users visualize impact. When the sun is at altitude α, an obstacle of height h casts a shadow of length:

```
shadow_length = h / tan(α)
```

At low sun angles the shadow extends dramatically. A 10m tree casts a 57m shadow when the sun is 10° above the horizon, but only a 5.8m shadow when the sun is 60° up.

#### Core Intersection Function

The following TypeScript implements the blocking test. It integrates with our existing `SolarPosition` type and a new `Obstacle` interface:

```typescript
import type { SolarPosition } from './types.js';

interface Obstacle {
  direction: number;      // degrees from north (0-360)
  distance: number;       // meters from observation point
  height: number;         // meters
  width: number;          // meters (angular span calculation)
  transparency: number;   // 0 = opaque, 1 = fully transparent
}

interface BlockingResult {
  blocked: boolean;
  shadeIntensity: number; // 0 = full sun, 1 = full shade
}

function normalizeAngle(angle: number): number {
  while (angle < 0) angle += 360;
  while (angle >= 360) angle -= 360;
  return angle;
}

function angularDifference(a: number, b: number): number {
  const diff = Math.abs(normalizeAngle(a) - normalizeAngle(b));
  return diff > 180 ? 360 - diff : diff;
}

function isBlocked(sun: SolarPosition, obstacle: Obstacle): BlockingResult {
  // Sun below horizon is irrelevant
  if (sun.altitude <= 0) {
    return { blocked: false, shadeIntensity: 0 };
  }

  // Calculate obstacle's angular height from observation point
  const obstacleAngularHeight = Math.atan(obstacle.height / obstacle.distance)
    * (180 / Math.PI);

  // If sun is higher than obstacle appears, no blocking
  if (sun.altitude > obstacleAngularHeight) {
    return { blocked: false, shadeIntensity: 0 };
  }

  // Calculate obstacle's angular width
  const halfAngularWidth = Math.atan((obstacle.width / 2) / obstacle.distance)
    * (180 / Math.PI);

  // Check if sun's azimuth falls within obstacle's span
  const azimuthDiff = angularDifference(sun.azimuth, obstacle.direction);

  if (azimuthDiff <= halfAngularWidth) {
    // Sun is behind the obstacle
    const shadeIntensity = 1 - obstacle.transparency;
    return { blocked: shadeIntensity > 0, shadeIntensity };
  }

  return { blocked: false, shadeIntensity: 0 };
}

function calculateEffectiveSunlight(
  sun: SolarPosition,
  obstacles: Obstacle[]
): number {
  // Returns a value 0-1 representing how much sunlight gets through
  // 1 = full sun, 0 = completely blocked

  if (sun.altitude <= 0) return 0;

  let maxShade = 0;
  for (const obstacle of obstacles) {
    const result = isBlocked(sun, obstacle);
    maxShade = Math.max(maxShade, result.shadeIntensity);
  }

  return 1 - maxShade;
}
```

The `calculateEffectiveSunlight` function returns a multiplier that can be applied to each time sample during sun-hours integration. A return value of 0.7 means 70% of the sunlight gets through (for example, due to a semi-transparent tree canopy).

### Obstacle Data Model

The obstacle model must balance expressiveness against input burden. Users shouldn't need surveying equipment, but the model needs enough detail to produce useful results.

#### Proposed Interfaces

```typescript
/** Obstacle type affects default transparency and seasonal behavior */
type ObstacleType =
  | 'building'        // Opaque, year-round
  | 'fence'           // Opaque, year-round
  | 'evergreen-tree'  // ~40% transparent, year-round
  | 'deciduous-tree'  // ~40% transparent summer, ~80% transparent winter
  | 'hedge';          // ~30% transparent, year-round

/** User-friendly presets for common obstacles */
interface ObstaclePreset {
  label: string;
  type: ObstacleType;
  height: number;     // meters
  width: number;      // meters
}

const OBSTACLE_PRESETS: ObstaclePreset[] = [
  { label: '6ft fence',       type: 'fence',          height: 1.8, width: 10 },
  { label: '1-story house',   type: 'building',       height: 4,   width: 12 },
  { label: '2-story house',   type: 'building',       height: 8,   width: 12 },
  { label: 'Small tree',      type: 'deciduous-tree', height: 6,   width: 5  },
  { label: 'Medium tree',     type: 'deciduous-tree', height: 12,  width: 8  },
  { label: 'Large tree',      type: 'deciduous-tree', height: 20,  width: 12 },
  { label: 'Tall tree (30m)', type: 'deciduous-tree', height: 30,  width: 15 },
  { label: 'Evergreen tree',  type: 'evergreen-tree', height: 15,  width: 6  },
  { label: 'Tall hedge',      type: 'hedge',          height: 2.5, width: 8  },
];

/** Default transparency values by obstacle type and season */
function getTransparency(type: ObstacleType, isWinter: boolean): number {
  switch (type) {
    case 'building':
    case 'fence':
      return 0;  // Fully opaque
    case 'evergreen-tree':
      return 0.4;  // Some light filters through
    case 'deciduous-tree':
      return isWinter ? 0.8 : 0.4;  // More transparent without leaves
    case 'hedge':
      return 0.3;
    default:
      return 0;
  }
}

/** Full obstacle definition as stored */
interface Obstacle {
  id: string;
  type: ObstacleType;
  label: string;          // User-provided or from preset
  direction: number;      // degrees from north, 0-360
  distance: number;       // meters
  height: number;         // meters
  width: number;          // meters
}

/** Analysis results for a single day */
interface DailyShadeAnalysis {
  date: Date;
  theoreticalSunHours: number;
  effectiveSunHours: number;
  percentBlocked: number;
  shadeWindows: ShadeWindow[];
}

/** Time period when an obstacle blocks the sun */
interface ShadeWindow {
  obstacleId: string;
  startTime: Date;
  endTime: Date;
  shadeIntensity: number;  // 0-1
}

/** Aggregated analysis for a date range */
interface ShadeAnalysis {
  obstacles: Obstacle[];
  startDate: Date;
  endDate: Date;
  averageTheoreticalHours: number;
  averageEffectiveHours: number;
  averagePercentBlocked: number;
  dailyAnalysis: DailyShadeAnalysis[];
  dominantBlocker: string | null;  // obstacle id that causes most blocking
}
```

The `ShadeWindow` concept is important for visualization. Instead of just reporting "you lose 3 hours," we can show "the oak tree blocks the sun from 2pm to 5pm."

### Performance Analysis

The question is whether we can run shade calculations fast enough for responsive in-browser use. The existing solar engine uses 5-minute sampling intervals (288 samples per day), which was validated as providing accuracy within 2-3 minutes while keeping computation under 100ms for a full year.

#### Compute Cost Estimate

For shade calculation over one year with N obstacles:

| Scenario | Samples/day | Days | Obstacles | Total intersection tests |
|----------|-------------|------|-----------|--------------------------|
| Single day | 288 | 1 | 10 | 2,880 |
| Growing season | 288 | 180 | 10 | 518,400 |
| Full year | 288 | 365 | 10 | 1,051,200 |

Each intersection test is simple arithmetic (one atan, a few comparisons, normalization). Benchmarking on a modern laptop shows approximately 10 million simple trig operations per second in JavaScript, so 1 million tests should complete in well under 100ms.

#### Recommended Sample Rate

The 5-minute interval from the existing engine works well for shade too. Shade boundaries move slowly across the day because the sun's apparent motion is gradual, so 5-minute resolution captures transitions accurately.

For real-time preview during obstacle placement, we could use 15-minute intervals (96 samples/day) to provide instant feedback, then recalculate at full resolution when the user saves.

#### Optimization Strategies

If performance becomes an issue with many obstacles, several optimizations are available:

The first approach is spatial indexing. Group obstacles by compass octant (N, NE, E, etc.) and only test obstacles in the octant the sun is currently in. This reduces average tests by 8x.

Second, we can pre-compute shade windows. For each obstacle, calculate the time ranges when it blocks the sun for representative days (solstices and equinoxes). These boundaries shift slowly, so interpolation between reference days works well.

Third, early termination helps. Once we find an opaque obstacle blocking the sun, skip remaining obstacle tests for that time sample.

For MVP, the straightforward approach (test all obstacles at each sample) should suffice. Optimization can wait until profiling shows actual bottlenecks.

### UX Recommendation: Obstacle Input

Users need to describe obstacles without precise measurements. The interface should feel intuitive while capturing enough data for useful calculations.

#### Compass Rose Interface

The primary input is a compass rose showing the view from the user's observation point. The user taps or clicks a direction to place an obstacle, then selects from presets and adjusts distance.

```
                    N
                    |
          NW   _____|_____   NE
              /           \
             /             \
        W --|       ●       |-- E    ← You are here (center)
             \             /
              \_____._____/
          SW       |        SE
                   |
                   S
```

When the user taps a direction (say, southwest), a panel slides up offering:

1. **Obstacle type** dropdown with presets (2-story house, large tree, fence)
2. **Distance** selector with intuitive options: "close" (5m), "medium" (15m), "far" (30m), or custom
3. **Confirm** button to add the obstacle

Added obstacles appear as icons on the compass rose at their approximate position, with a label. Users can tap an existing obstacle to edit or delete it.

#### Minimal Viable Flow

The simplest possible flow for adding one obstacle involves three steps. First the user taps a direction on the compass rose. Then they select a preset like "Large deciduous tree." Finally they choose "medium distance" and tap "Add." This takes under 10 seconds and requires no measurements.

#### Advanced Options (hidden by default)

Power users can expand an "Advanced" section to set exact height (in feet or meters), exact distance, custom width, and specific obstacle type. Most users will never need these controls.

#### Presets for 80% Coverage

The following presets cover the most common suburban scenarios:

For buildings we offer 1-story house at 4m/13ft, 2-story house at 8m/26ft, and 3-story building at 12m/39ft. Fences come as short fence at 1.2m/4ft and tall fence at 1.8m/6ft. Trees include small tree at 6m/20ft, medium tree at 12m/40ft, large tree at 20m/65ft, and very tall tree at 30m/100ft. Finally a tall hedge at 2.5m/8ft rounds out the options.

Each preset includes a default width appropriate for the type. Houses default to 12m wide, trees to diameter proportional to height.

### Visualization Recommendation

Users need to understand the impact of shade in actionable terms. The visualization should answer "how much sun do I actually get?" and "when is it blocked?"

#### Primary Metric: Effective Sun Hours

The single most useful output is a comparison:

```
Theoretical maximum:  10.5 hours
With your obstacles:   6.2 hours (59%)
Sun hours blocked:     4.3 hours
```

This immediately communicates the magnitude of impact. The category classification should use effective hours, so a location that theoretically gets "full sun" but actually gets 5.8 hours due to shade should show as "part sun."

#### Timeline Visualization

A horizontal timeline for the day shows when the sun is blocked:

```
Sunrise                 Solar Noon                  Sunset
  |▓▓▓▓▓▓▓░░░░░░░░░░░░░░░▓▓▓▓▓▓▓▓▓▓▓▓▓░░░░░░░░░░░▓▓|
  6am     8am    10am    12pm    2pm    4pm    6pm    8pm
           │                      │
           └── Oak tree blocks ───┘

█ = Full shade   ▓ = Partial shade   ░ = Full sun
```

Hovering or tapping a shaded region reveals which obstacle causes it: "Oak tree to the SW blocks afternoon sun from 2pm to 5pm."

#### Seasonal Summary

For the growing season view, show a table or chart of effective sun hours by month:

```
Month     Theoretical    With Shade    Blocked
April        11.2           7.8          30%
May          13.5           9.1          33%
June         14.8           9.5          36%
July         14.2           9.3          35%
August       12.6           8.8          30%
```

This reveals how shade impact varies seasonally. Morning shade from an eastern obstacle hurts less in summer (sun rises in the northeast) than in spring/fall.

#### Most Useful Single Visual

If we could only show one thing, it should be a "shade donut" chart showing the breakdown:

```
      ╭─────────────────╮
     ╱   ╱╱╱╱╱╱╱╱╱╱╱    ╲
    │  ╱╱╱ 59% SUN ╱╱╱   │
    │  ╱╱╱╱╱╱╱╱╱╱╱╱╱╱    │
    │                     │
    │      41% SHADE      │
     ╲                   ╱
      ╰─────────────────╯

      6.2 of 10.5 hours
        Part Sun ⛅
```

The percentage instantly communicates impact, while the hours give precise values. The category (Part Sun) tells users what they can grow.

### Implementation Sequence

Based on this research, the recommended implementation order for shade modeling MVP is:

1. Add `Obstacle` and `ShadeAnalysis` interfaces to types.ts
2. Implement `isBlocked()` and `calculateEffectiveSunlight()` functions
3. Create `calculateDailySunHoursWithShade()` that wraps existing integration
4. Build compass rose component for obstacle input
5. Add shade timeline visualization to results page
6. Update recommendations to use effective (not theoretical) sun hours

Each step builds on the previous and can be shipped incrementally. The math layer (steps 1-3) can be tested independently before the UI exists.
