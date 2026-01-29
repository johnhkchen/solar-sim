# Climate Data Sources and Visualization Research

This document presents findings on climate data sources, precision requirements, and visualization approaches for Solar-Sim's climate integration feature. The goal is to show users their growing season boundaries alongside sun data so they know both how much light a spot gets and when they can actually plant.

## Executive Summary

For frost dates, a lookup table embedded in the app provides the best balance of simplicity, offline capability, and global coverage, with an optional API enhancement for US users who want station-level precision. For hardiness zones, the frostline project offers a simple JSON-based lookup by ZIP code that we can embed directly, and we can approximate zones for international users using minimum winter temperature formulas. The most useful visualization is a horizontal timeline showing the frost-free growing season with planting windows highlighted.

## Research Question 1: Frost Date Data Sources

Frost dates tell gardeners when to plant. The last spring frost marks when it's safe to transplant warm-season crops like tomatoes, while the first fall frost signals the end of the growing season. These dates vary significantly by location, typically ranging from late February in the Deep South to early June in northern regions.

### Option A: NOAA Climate Normals (US Only)

NOAA's National Centers for Environmental Information publishes 30-year climate normals that include frost probability data for thousands of weather stations across the United States. The data is available as CSV downloads organized by station, with fields for the probability of reaching specific temperature thresholds on various dates. You can access this data through the Climate Data Online web interface or download the full dataset from NOAA's HTTPS area.

The advantage of NOAA data is precision since it's based on actual station observations rather than interpolation. The disadvantages are that coverage is US-only, the data is station-based which means users must find the nearest station rather than querying by coordinates, and the download is substantial at roughly 2,500 stations with multiple data files each.

### Option B: Open-Meteo Historical Weather API (Global)

Open-Meteo provides a free historical weather API with data dating back to 1940 at 10km resolution globally. The `/v1/archive` endpoint accepts coordinates and date ranges, returning daily minimum and maximum temperatures. To calculate frost dates, we would query 30 years of historical data and find the median dates when minimum temperatures first drop below and last rise above 0°C (32°F).

The advantage is true global coverage with coordinate-based queries. The disadvantages are that calculating frost dates requires fetching substantial historical data (about 11,000 data points for 30 years of daily minimums) and doing the statistical analysis ourselves, which adds latency and complexity. The API is free for non-commercial use with no key required, but commercial use requires a subscription.

### Option C: Embedded Lookup Table

We can create a lookup table that approximates frost dates based on latitude, longitude, and elevation. Frost dates correlate strongly with latitude (higher latitudes have later spring frosts and earlier fall frosts) and elevation (higher elevations are colder). A table with entries for every half-degree of latitude, combined with elevation adjustment factors, would cover the globe with reasonable accuracy.

The advantage is complete offline capability with zero API dependencies and instant lookups. The disadvantage is reduced precision compared to station-based data since we're interpolating from general climate patterns rather than actual observations.

### Recommendation: Hybrid Approach

Start with an embedded lookup table for instant global coverage, then optionally enhance with NOAA station data for US users who want higher precision. The lookup table provides the core functionality, while the API enhancement is a progressive improvement that doesn't block the basic feature.

The lookup table should use latitude bands as the primary key, with adjustments for elevation (approximately 3-4 days later per 300m/1000ft elevation gain) and coastal versus continental position (coastal areas have milder, later frosts). This approach lets us show frost dates immediately without network requests while still providing reasonable accuracy for gardening purposes.

For precision, frost dates inherently have high year-to-year variance. Even station-based historical averages can be off by 2-4 weeks in any given year due to weather patterns. Showing a range like "April 10-25" rather than a single date "April 15" honestly represents this uncertainty and is more useful for planning.

## Research Question 2: Precision Requirements

Frost dates vary within a region due to elevation, proximity to water bodies, urban heat island effects, and local terrain that creates frost pockets or sheltered microclimates. A gardener's actual microclimate can differ from regional averages by 2-3 weeks.

County-level precision is sufficient for the majority of use cases because the inherent variability in frost dates exceeds the precision of any data source. A gardener in Portland, Oregon doesn't need to know whether their specific address has a 0.3-day earlier frost than the next neighborhood since that difference is noise compared to year-to-year weather variation.

The recommendation is to show frost dates as ranges with approximately 2-week windows for the 50% probability dates. For example, "Last spring frost: April 10-25 (50% probability)" communicates both the expected date and the inherent uncertainty. This approach is more honest and more useful than false precision.

## Research Question 3: USDA Hardiness Zones

The USDA Plant Hardiness Zone system divides North America into 13 zones based on average annual minimum winter temperatures, with each zone spanning a 10°F band. Zone 1 covers the coldest areas with minimums below -60°F, while zone 13 covers tropical areas that never drop below 60°F. The zones help gardeners know which perennial plants will survive winter in their area.

### Data Source Options

The official USDA Plant Hardiness Zone Map updated in 2023 is available through planthardiness.ars.usda.gov, but historically the data has only been accessible by ZIP code lookup with CAPTCHA protection. The USDA ArcGIS Hub now offers the data in multiple formats including GeoJSON, CSV, and GeoTIFF, though the API requires familiarity with ArcGIS services.

The frostline project on GitHub provides a simpler alternative. It publishes individual JSON files for each US ZIP code at phzmapi.org, so looking up zone 20001 (Washington DC) is a simple fetch to `https://phzmapi.org/20001.json`. The project is MIT licensed and uses data from the PRISM Climate Group at Oregon State University combined with ZIP code coordinates.

### International Coverage

The USDA hardiness zone system is designed for North America, but equivalent systems exist in other countries. Canada uses a similar system with some extensions for extremely cold regions. The UK has its own hardiness rating system based on the Royal Horticultural Society standards. Australia uses a different zone system based on maximum temperatures since heat tolerance matters more than cold tolerance there.

For international users, we can calculate an approximate USDA-equivalent zone from the location's minimum winter temperature using the formula: `zone = floor((min_temp_f + 60) / 10) + 1`. This gives a rough equivalent that's useful for interpreting plant labels that reference USDA zones.

### Recommendation

Embed the frostline JSON data directly in the app for US ZIP codes, which covers the primary use case with zero API calls. For coordinate-based lookups (when the user enters coordinates rather than a ZIP code), fall back to calculating the zone from estimated minimum winter temperature using the Open-Meteo historical API. For international users, show the calculated approximate zone with a note that it's an estimate.

## Research Question 4: Growing Season Visualization

The growing season visualization needs to answer several questions at a glance: when does the frost-free period start, when does it end, how long is the growing season in days, and how does this relate to planting different crop types.

### Timeline Design

A horizontal timeline spanning January through December works better than a calendar grid because it emphasizes the continuous flow of the growing season. The timeline should highlight three key periods: the frost-risk zones in early spring and late fall shown in blue or gray, the warm-season growing window between last and first frost shown in green, and optional shoulder seasons for cool-season crops shown in yellow.

The most useful single visualization is a segmented bar showing the year divided into frost risk (winter), cool-season planting window (early spring and fall), and warm-season growing period (summer). Hovering or tapping a segment reveals the specific dates.

### Integration with Sun Data

The existing app shows sun hours and light categories. Climate data should appear on the same results page below the sun information, forming a natural flow: first the user sees how much light the location gets, then they see when they can actually grow. The growing season timeline could mirror the seasonal sun chart, showing both factors on aligned horizontal axes so users can correlate light availability with growing periods.

### Existing Patterns in Garden Apps

Popular garden planning apps like VegPlotter and GrowVeg use month-by-month planting calendars that show sowing, transplanting, and harvest windows for specific crops. While Solar-Sim doesn't (yet) provide crop-specific calendars, the timeline component should be designed to eventually support overlaying crop timing on the frost date display.

The Seedtime app shows a horizontal timeline view that allows users to see their whole year at a glance and compare planting schedules, which validates that horizontal timeline approaches work well for this domain.

### Recommendation

Create a horizontal growing season timeline showing the frost-free period as the primary visualization. Display the specific dates (last spring frost, first fall frost) as labels, show the growing season length in days prominently, and use color coding to distinguish frost-risk periods from growing periods. Make the component reusable so it can later accept overlay data for crop-specific timing.

## Research Question 5: Data Model

The data model needs to represent frost dates, hardiness zones, growing season calculations, and the uncertainty inherent in climate data.

### Proposed TypeScript Interfaces

```typescript
/**
 * Frost date information for a location. Dates are represented as day-of-year
 * (1-366) rather than full Date objects since they represent typical annual
 * patterns rather than specific calendar dates.
 */
interface FrostDates {
  lastSpringFrost: DayOfYearRange;
  firstFallFrost: DayOfYearRange;
  source: 'lookup-table' | 'noaa-station' | 'calculated';
  confidence: 'high' | 'medium' | 'low';
}

/**
 * A range of days representing the uncertainty window for a frost date.
 * The median is the 50% probability date; the range spans roughly 80% probability.
 */
interface DayOfYearRange {
  early: number;   // day of year for early bound (10% probability)
  median: number;  // day of year for median (50% probability)
  late: number;    // day of year for late bound (90% probability)
}

/**
 * USDA Plant Hardiness Zone information.
 */
interface HardinessZone {
  zone: string;             // e.g., "7b"
  zoneNumber: number;       // e.g., 7
  subzone: 'a' | 'b';       // temperature subzone
  minTempF: number;         // lower bound of zone range in Fahrenheit
  maxTempF: number;         // upper bound of zone range in Fahrenheit
  source: 'usda' | 'calculated';
  isApproximate: boolean;   // true for international/calculated zones
}

/**
 * Growing season calculation results.
 */
interface GrowingSeason {
  lengthDays: GrowingSeasonRange;
  frostFreePeriod: {
    start: DayOfYearRange;
    end: DayOfYearRange;
  };
  coolSeasonWindows: {
    spring: DateRange | null;
    fall: DateRange | null;
  };
}

/**
 * Range representing uncertainty in growing season length.
 */
interface GrowingSeasonRange {
  short: number;   // days in a short season year
  typical: number; // days in a typical year
  long: number;    // days in a long season year
}

/**
 * Combined climate data for a location.
 */
interface ClimateData {
  frostDates: FrostDates;
  hardinessZone: HardinessZone;
  growingSeason: GrowingSeason;
  fetchedAt: Date;
}

/**
 * Result type for climate data lookup operations.
 */
type ClimateResult =
  | { success: true; data: ClimateData }
  | { success: false; error: ClimateError };

type ClimateError =
  | { type: 'location-not-supported'; message: string }
  | { type: 'api-error'; message: string }
  | { type: 'calculation-failed'; message: string };
```

### Caching Strategy

Climate data changes slowly (updated every 10 years for NOAA normals), so aggressive caching makes sense. The recommended approach is to cache climate data in localStorage keyed by a location hash (rounded to 0.1 degree precision), with a TTL of 30 days. For the embedded lookup table, no caching is needed since the data is already local.

### Day-of-Year Representation

Representing frost dates as day-of-year integers (1-366) rather than Date objects simplifies calculations and avoids timezone complications. Converting to display format happens in the UI layer based on the user's preference for date formatting. The conversion is straightforward: day 100 is April 10 in a non-leap year or April 9 in a leap year.

## Implementation Sequence Recommendation

The recommended order for implementing climate integration builds from foundational data types through lookup functions to UI components.

First, create the climate types module at `src/lib/climate/types.ts` with the interfaces defined above. This establishes the contract that all other climate code will use and can be done without external dependencies.

Second, implement the frost date lookup at `src/lib/climate/frost-dates.ts`. Start with the embedded lookup table approach using latitude bands with elevation adjustment. The lookup function takes coordinates and returns FrostDates. Include unit tests with known locations to verify accuracy against NOAA data.

Third, implement hardiness zone lookup at `src/lib/climate/hardiness-zone.ts`. Embed the frostline ZIP code data for US coverage and implement the temperature-based calculation for coordinates that don't map to a ZIP code. The function takes either a ZIP code or coordinates and returns HardinessZone.

Fourth, create the growing season timeline component at `src/lib/components/GrowingSeasonTimeline.svelte`. This component takes GrowingSeason data and renders the horizontal timeline visualization. It should be responsive, work on mobile, and support both light and dark color schemes.

Fifth and finally, integrate climate data into the results page. Fetch climate data alongside sun data when a location is entered, display the growing season timeline below the sun information, and show frost dates and hardiness zone in a compact summary format.

Each step can be shipped independently and provides value on its own. The data layer (steps 1-3) can be tested without any UI, and the UI component (step 4) can be developed with mock data before the real lookup functions are complete.

## Lookup Table Structure

The embedded frost date lookup table should use a compact format that balances file size against lookup precision. A reasonable structure uses latitude bands of 0.5 degrees with longitude modifiers for coastal versus continental positions.

```typescript
interface FrostLookupEntry {
  latMin: number;
  latMax: number;
  coastalModifier: number;  // days to add for coastal locations
  lastSpringDoy: number;    // day of year for median last spring frost
  firstFallDoy: number;     // day of year for median first fall frost
  varianceDays: number;     // typical +/- variance for range calculation
}
```

For the continental US, approximately 100 entries would cover latitudes 25°N to 50°N at half-degree resolution. Adding entries for Europe, Australia, and other populated regions would expand the table but keep total size under 50KB compressed.

## Sources

Research for this document drew from NOAA Climate Normals documentation, the Open-Meteo API documentation, the frostline GitHub project for USDA hardiness zone data, and UX patterns from garden planning apps including VegPlotter, Seedtime, and GrowVeg.
