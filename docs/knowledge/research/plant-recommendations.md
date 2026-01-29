# Plant Recommendations Research

This document presents findings on the data model, algorithm, and UX for combining shade and climate data into actionable plant recommendations. The goal is to complete the core user experience described in the happy path document where users see suitable plants, contextual notes about shade benefits, and actionable planting guidance.

## Executive Summary

For the plant data model, store light requirements as a minimum sun hours threshold with optional ideal range, temperature tolerance as minimum and maximum growing temperatures, and days to maturity with a range for planning against the growing season. Keep the initial database small (25-30 plants) and curated for accuracy rather than comprehensive.

The recommendation algorithm should use a scoring system rather than binary matching, producing ratings of "excellent," "good," and "marginal" based on how well the location matches each plant's requirements. The algorithm considers effective sun hours from shade analysis, growing season length from climate data, and generates contextual notes when shade timing benefits specific plant types.

For visualization, use a horizontal bar chart showing monthly effective sun hours since this aligns with existing timeline components and works well on mobile. The planting calendar should be per-plant rather than generic, showing seed starting, transplant, and harvest windows based on frost dates and days to maturity.

## R1: Plant Data Model

The core question is what information we need to store for each plant to make useful recommendations. After reviewing existing gardening databases and the data we have available from shade and climate analysis, the recommended approach is a focused model that captures light requirements, temperature tolerance, and timing.

### Light Requirements

Each plant needs minimum sun hours to thrive, expressed as a single threshold value that maps to our existing light categories. A tomato needs 6+ hours (full sun), lettuce needs 3-6 hours (part sun to part shade), and hostas tolerate under 2 hours (full shade). Storing this as a numeric threshold rather than a category allows more nuanced matching since a location with 5.5 effective hours is a marginal fit for a 6-hour plant but a great fit for a 4-hour plant.

Some plants have an optimal range where they perform best versus a minimum where they survive. Lettuce grows in 4-6 hours but bolts (goes to seed prematurely) with more than 6 hours of hot sun, so its ideal range is narrower than its tolerance range. The model should capture both minimum requirement and optional ideal maximum.

### Temperature Tolerance

The climate data provides hardiness zone and growing season length, so plants need corresponding data to match against. For annual vegetables, the key factors are minimum germination temperature (soil must be warm enough to plant), frost tolerance (can it survive light frost or does it die at 32°F), and heat tolerance (does it bolt or fail in hot weather).

For MVP, expressing this as "frost sensitive" versus "frost tolerant" plus an optimal temperature range is sufficient. A tomato is frost sensitive and grows best between 60-85°F, while spinach tolerates light frost and prefers 50-70°F.

### Days to Maturity

This number tells users whether a plant can complete its lifecycle in their growing season. A 180-day growing season can support a 75-day cucumber but not a 100-day watermelon unless the user starts seeds indoors early. The data should include the typical days-to-maturity range since it varies by variety, along with whether the plant benefits from indoor seed starting.

### Additional Fields

For future features like companion planting or detailed spacing guidance, the model could include planting depth, spacing between plants, and companion/antagonist relationships. However, these add complexity without improving the core recommendation feature, so they should be deferred to a future phase.

### Database Strategy

Building a curated list of 25-30 common garden plants is preferable to importing a large external database. External databases like the Open Food Network plant library contain thousands of entries with inconsistent data quality, and filtering them to usable entries requires substantial effort. A hand-curated list can include accurate light requirements verified against multiple sources, representative day-to-maturity values for common varieties, and clear frost tolerance classifications.

The initial list should focus on vegetables (tomatoes, peppers, lettuce, beans, cucumbers, squash, carrots, onions, peas, spinach, kale, broccoli), herbs (basil, parsley, cilantro, mint, rosemary, thyme), and flowers (marigolds, zinnias, sunflowers, impatiens, hostas). This covers the plants most users care about while keeping the database manageable.

### Proposed TypeScript Interfaces

The plant data model needs three main interfaces. The first is PlantLightRequirements which captures the sun hours needed:

```typescript
interface PlantLightRequirements {
  minSunHours: number;
  maxSunHours?: number;
  idealMinHours?: number;
  idealMaxHours?: number;
  toleratesAfternoonShade: boolean;
  benefitsFromAfternoonShade: boolean;
}
```

The minSunHours field is required and represents the absolute minimum for the plant to survive. The optional maxSunHours captures cases like lettuce where too much sun causes problems. The toleratesAfternoonShade flag helps match plants to locations with afternoon shade, while benefitsFromAfternoonShade identifies heat-sensitive plants that actively prefer afternoon shade in summer.

The second interface captures temperature needs:

```typescript
type FrostTolerance = 'tender' | 'semi-hardy' | 'hardy';

interface PlantTemperatureRequirements {
  frostTolerance: FrostTolerance;
  minGrowingTempF: number;
  maxGrowingTempF: number;
  optimalMinTempF: number;
  optimalMaxTempF: number;
}
```

The frostTolerance field determines when the plant can be transplanted relative to frost dates. Tender plants like tomatoes must wait until after last frost, semi-hardy plants like lettuce can go out 2-3 weeks before last frost, and hardy plants like kale can tolerate hard freezes.

The third interface covers timing:

```typescript
interface PlantTiming {
  daysToMaturityMin: number;
  daysToMaturityMax: number;
  canStartIndoors: boolean;
  weeksToStartIndoors?: number;
  successionPlantingWeeks?: number;
}
```

The daysToMaturity range accounts for variety variation. The canStartIndoors flag indicates whether indoor seed starting is practical (yes for tomatoes, no for carrots with taproots). The optional weeksToStartIndoors tells users how early to start seeds, and successionPlantingWeeks suggests how often to plant for continuous harvest.

The main plant interface combines these:

```typescript
type PlantCategory = 'vegetable' | 'herb' | 'flower';

interface Plant {
  id: string;
  name: string;
  category: PlantCategory;
  description: string;
  light: PlantLightRequirements;
  temperature: PlantTemperatureRequirements;
  timing: PlantTiming;
}
```

## R2: Recommendation Algorithm

The recommendation engine takes effective sun hours from shade analysis and climate data from the climate module, then returns plant suggestions with suitability ratings and contextual notes. A scoring system produces more useful results than simple binary matching.

### Scoring Approach

Binary matching (plant fits or doesn't) produces frustrating results when a location is close to thresholds. A spot with 5.8 effective hours would exclude all "full sun" plants if we use strict matching, even though it's only marginally below the 6-hour threshold. A scoring system can express "tomatoes are a marginal fit here" which is more useful than excluding them entirely.

The score should consider three factors. First is light match, comparing effective sun hours against the plant's requirements. A perfect match gives full points, being slightly below minimum gives partial points, and being far below gives no points. Second is season match, comparing growing season length against days to maturity. A season of 180 days comfortably fits a 75-day plant but only marginally fits a 90-day plant when accounting for transplant establishment time. Third is climate match, checking whether the plant's temperature preferences align with the location's typical temperatures.

### Scoring Formula

The light score uses a stepped approach rather than linear interpolation since the relationship between sun hours and plant health isn't linear. When effective hours are at or above the ideal minimum, the score is 1.0 (excellent). When hours are between minimum and ideal, the score is 0.7 (good). When hours are within 1 hour below minimum, the score is 0.4 (marginal). Below that, the score is 0 (not recommended).

```typescript
function calculateLightScore(
  effectiveHours: number,
  requirements: PlantLightRequirements
): number {
  const idealMin = requirements.idealMinHours ?? requirements.minSunHours;

  if (effectiveHours >= idealMin) return 1.0;
  if (effectiveHours >= requirements.minSunHours) return 0.7;
  if (effectiveHours >= requirements.minSunHours - 1) return 0.4;
  return 0;
}
```

The season score checks whether the growing season is long enough for the plant to mature:

```typescript
function calculateSeasonScore(
  growingSeasonDays: number,
  timing: PlantTiming
): number {
  const bufferDays = 14;
  const requiredDays = timing.daysToMaturityMin + bufferDays;

  if (growingSeasonDays >= requiredDays + 30) return 1.0;
  if (growingSeasonDays >= requiredDays) return 0.7;
  if (growingSeasonDays >= timing.daysToMaturityMin) return 0.4;
  return 0;
}
```

The combined score weights light at 50%, season at 30%, and climate at 20%, producing a final suitability rating:

```typescript
type SuitabilityRating = 'excellent' | 'good' | 'marginal' | 'not-recommended';

function getSuitabilityRating(score: number): SuitabilityRating {
  if (score >= 0.8) return 'excellent';
  if (score >= 0.6) return 'good';
  if (score >= 0.4) return 'marginal';
  return 'not-recommended';
}
```

### Seasonal Adaptation

The algorithm should consider when the user is viewing the app. A query in March naturally suggests spring planting, while September focuses on fall crops. This doesn't change the core algorithm but influences which plants to highlight.

For MVP, the simplest approach is to include a "plantingWindow" field in the recommendation result indicating whether the plant is appropriate for spring, fall, or both. The UI can then filter or sort based on current season. A more sophisticated approach would calculate specific planting dates for each recommended plant, but that adds complexity better suited to T-016-06 (planting calendar component).

### Recommendation Result Interface

The recommendation engine returns structured results that the UI can display:

```typescript
interface PlantRecommendation {
  plant: Plant;
  overallScore: number;
  suitability: SuitabilityRating;
  lightScore: number;
  seasonScore: number;
  climateScore: number;
  notes: ContextualNote[];
  plantingWindow: PlantingWindow;
}

interface ContextualNote {
  type: 'benefit' | 'caution' | 'tip';
  text: string;
}

interface PlantingWindow {
  canPlantSpring: boolean;
  canPlantFall: boolean;
  springStartDoy?: number;
  springEndDoy?: number;
  fallStartDoy?: number;
  fallEndDoy?: number;
}
```

The notes array holds contextual insights like "afternoon shade benefits this plant in summer" or "start seeds indoors 6 weeks before last frost." The plantingWindow helps users understand timing without requiring them to navigate to a separate calendar view.

### Full Recommendation Engine Interface

The main function signature:

```typescript
interface RecommendationInput {
  effectiveSunHours: number;
  theoreticalSunHours: number;
  shadeAnalysis?: ShadeAnalysis;
  climate: ClimateData;
  currentDate?: Date;
}

interface RecommendationResult {
  excellent: PlantRecommendation[];
  good: PlantRecommendation[];
  marginal: PlantRecommendation[];
  summaryNote: string;
}

function getPlantRecommendations(
  input: RecommendationInput
): RecommendationResult;
```

The result groups plants by suitability rating for easy UI rendering. The summaryNote provides a human-readable overview like "Your location receives part sun with afternoon shade, which suits 12 vegetables and herbs."

## R3: Planting Calendar UX

The planting calendar answers the question "when should I plant?" by translating frost dates and days-to-maturity into actionable dates for each recommended plant.

### Key Dates

Four dates matter for most plants. The seed starting date is when to start seeds indoors, typically 6-8 weeks before the transplant date. The transplant date is when to move seedlings outdoors, calculated from last frost date adjusted by frost tolerance (tender plants wait until after last frost, hardy plants can go 2-3 weeks earlier). The direct sow date applies to plants that don't transplant well like carrots and beans, calculated similarly to transplant date. The harvest date is the expected harvest window, calculated from transplant or sow date plus days to maturity.

### Generic vs Per-Plant Calendar

The question is whether to show a single calendar with general season boundaries or individual timelines for each recommended plant. The per-plant approach is more useful because planting dates vary significantly by plant type. Tomatoes in zone 7 might transplant May 1st while lettuce transplants March 15th, and showing both on a generic calendar would confuse rather than clarify.

However, the full per-plant calendar is complex to render when showing 15+ recommended plants. The recommended approach is a hybrid where the main display shows a generic growing season timeline (last frost, first frost, growing season length) and the per-plant calendar appears when the user taps or clicks a specific recommendation. This keeps the main view clean while providing detailed guidance on demand.

### Calendar Component Design

The growing season timeline (already exists as GrowingSeasonTimeline from climate work) shows the overall frost-free period. The per-plant calendar overlay shows:

```typescript
interface PlantCalendar {
  plantId: string;
  plantName: string;
  seedStartDate: Date | null;
  transplantDate: Date;
  harvestStartDate: Date;
  harvestEndDate: Date;
  notes: string[];
}
```

The UI renders this as a horizontal bar spanning the relevant months, with markers for each milestone. Color coding distinguishes seed starting (purple), outdoor planting (green), and harvest (orange) periods.

## R4: Seasonal Light Visualization

Users need to understand how light conditions vary month-by-month to make informed planting decisions. A spot that averages 6 hours across the growing season might drop to 4 hours in April due to lower sun angles, affecting early-season crops.

### Visualization Options

A bar chart of monthly average effective hours is the clearest approach for most users. Each month gets a vertical bar, colored by light category (full sun = gold, part sun = light green, part shade = olive, full shade = gray). This immediately shows patterns like "you have full sun June through August but only part sun in April and October."

An alternative is a line graph showing effective versus theoretical hours. This emphasizes the shade impact but may confuse users who don't understand the distinction. The shade impact is better communicated through the existing shade analysis display than duplicated in the seasonal chart.

A heatmap similar to the happy path seasonal overview could show daily values across the year, with color intensity indicating sun hours. This provides the most detail but may overwhelm users with information. It's better suited to power users who want to identify optimal planting windows for specific crops.

### Recommendation

Implement a horizontal bar chart showing average effective sun hours for each month of the growing season. The chart should show March through October (or the relevant growing season for the location) with one bar per month. Bars are colored by the light category that month's average falls into. A dashed horizontal line at 6 hours marks the full sun threshold for reference.

The component should be static rather than interactive for MVP. Adding click-to-expand functionality that shows daily variation within a month would be useful but adds complexity better deferred to a future enhancement.

### Chart Interface

```typescript
interface MonthlyLightData {
  month: number;
  averageEffectiveHours: number;
  averageTheoreticalHours: number;
  lightCategory: LightCategory;
}

interface SeasonalLightChartProps {
  monthlyData: MonthlyLightData[];
  growingSeasonStart: number;
  growingSeasonEnd: number;
}
```

The component receives pre-calculated monthly averages from the shade analysis module rather than performing calculations itself. This keeps the component focused on visualization.

## R5: Shade Timing Insights

The ShadeWindow data from shade analysis tells us not just how much shade occurs but when it occurs. This temporal information enables nuanced recommendations that binary sun-hour matching cannot provide.

### Afternoon Shade Benefits

Some plants benefit from afternoon shade during hot summers. Lettuce, spinach, and cilantro bolt (go to seed) when they get too hot, so afternoon shade extending their productive period. The app should recognize this pattern and generate contextual notes when the data supports it.

The detection logic looks for shade windows that start after solar noon and extend into the afternoon. If such windows exist during peak summer months (June-August for northern hemisphere), and the recommended plant has benefitsFromAfternoonShade set to true, generate a note: "Afternoon shade from [obstacle name] helps prevent bolting in summer."

### Morning Shade Concerns

Morning shade is generally less desirable because it delays the warming of soil and foliage after cool nights. For heat-loving plants like tomatoes and peppers, morning shade can slow growth and delay ripening. The app should note when significant morning shade exists and suggest that heat-loving plants may underperform.

### Seasonal Shade Variation

Shade impact varies across the year because the sun's angle changes. An obstacle to the south blocks more light in winter (low sun angle) than summer (high sun angle). The ShadeAnalysis.dailyAnalysis array provides this data, and the algorithm should calculate per-month averages to identify seasonal patterns.

When shade impact is substantially higher in early spring (March-April), the app should note that early-season crops may have less light than summer crops. Conversely, if shade impact is consistent year-round, the effective sun hours can be stated simply without seasonal caveats.

### Contextual Note Generation

The recommendation engine should generate notes by analyzing shade windows:

```typescript
function generateShadeNotes(
  shadeAnalysis: ShadeAnalysis,
  plant: Plant
): ContextualNote[] {
  const notes: ContextualNote[] = [];

  const afternoonShadeMonths = findAfternoonShadeMonths(shadeAnalysis);
  const morningShadeMonths = findMorningShadeMonths(shadeAnalysis);

  if (afternoonShadeMonths.length > 0 && plant.light.benefitsFromAfternoonShade) {
    notes.push({
      type: 'benefit',
      text: `Afternoon shade in ${formatMonths(afternoonShadeMonths)} helps prevent bolting.`
    });
  }

  if (morningShadeMonths.length > 0 && plant.temperature.frostTolerance === 'tender') {
    notes.push({
      type: 'caution',
      text: `Morning shade may slow early growth. Consider starting seeds indoors.`
    });
  }

  return notes;
}
```

This makes the recommendations feel personalized to the user's specific shade situation rather than generic gardening advice.

## Implementation Sequence

The remaining S-016 tickets should proceed in the order established by the task graph dependencies, with the research findings informing each implementation.

T-016-02 creates the plant type definitions in src/lib/plants/types.ts. The interfaces should match those proposed in R1, with PlantLightRequirements, PlantTemperatureRequirements, PlantTiming, and Plant as the core types. Also create PlantRecommendation, RecommendationResult, and related types from R2.

T-016-03 creates the plant database in src/lib/plants/database.ts. Start with 25-30 plants covering vegetables, herbs, and flowers as listed in R1. Each entry needs accurate light requirements, temperature tolerance, and days to maturity. Verify data against multiple sources like seed catalogs and university extension guides.

T-016-04 implements the recommendation engine in src/lib/plants/recommendations.ts. The main function getPlantRecommendations takes effective sun hours and climate data, scores each plant using the formulas from R2, generates contextual notes using the logic from R5, and returns grouped results.

T-016-05 creates the recommendations UI component PlantRecommendations.svelte. It displays plants grouped by suitability rating, shows contextual notes, and provides a tap-to-expand pattern for detailed plant information. Follow existing component patterns and ensure mobile responsiveness.

T-016-06 creates the planting calendar component PlantingCalendar.svelte. It takes climate data and optional selected plant to show planting windows. The generic view shows frost-free period, while selecting a plant shows that plant's specific seed start, transplant, and harvest dates.

T-016-07 creates the seasonal light chart SeasonalLightChart.svelte. It renders a horizontal bar chart showing monthly effective sun hours with light category coloring. The component should match the visual style of GrowingSeasonTimeline.

T-016-08 integrates all components into the results page. Add PlantRecommendations below existing sun data, include PlantingCalendar in a collapsible section, and add SeasonalLightChart alongside the existing seasonal overview.

## Open Questions Resolved

This research resolves the open questions from the happy path document regarding plant databases and locale-specific recommendations.

For the plant database question, a curated list of 25-30 common plants is the right starting point. External databases introduce data quality issues and unnecessary complexity. The curated list can expand over time based on user feedback.

For locale-specific recommendations, the combination of effective sun hours from shade analysis and growing season from climate data provides location-specific results without requiring separate plant databases per region. A tomato recommendation in Portland differs from one in Phoenix because the effective hours and season length differ, not because we maintain separate databases.

## Conclusion

The plant recommendations feature can deliver meaningful value with a focused implementation. The key insights are to use scoring rather than binary matching for nuanced recommendations, to generate contextual notes from shade timing data for personalized advice, and to keep the plant database small and curated for accuracy. Following the proposed interfaces and implementation sequence will complete the S-016 story and deliver the core user experience described in the happy path.
