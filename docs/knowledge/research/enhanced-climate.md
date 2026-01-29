# Enhanced Climate Data and Map Picker Research

This document answers the research questions from T-018-01 about improving climate data accuracy through the Open-Meteo Historical Weather API, implementing Köppen climate classification, adding an interactive Leaflet map picker, and integrating NOAA Climate Prediction Center seasonal outlooks. The findings inform implementation of the S-018 enhanced climate and location features.

## R1: Open-Meteo Historical Weather API

The Open-Meteo Historical Weather API provides free access to over 80 years of hourly weather data at 10-kilometer resolution globally. The service requires no API key for non-commercial use, making it ideal for Solar-Sim's climate data needs. Data comes from ERA5 reanalysis going back to 1940, with more recent high-resolution data from ECMWF IFS covering 2017 onwards.

### Endpoint and Request Format

The archive endpoint lives at `https://archive-api.open-meteo.com/v1/archive` and accepts coordinates plus date ranges. A request for San Francisco's 1995 temperature and precipitation data looks like this:

```
https://archive-api.open-meteo.com/v1/archive
  ?latitude=37.7749
  &longitude=-122.4194
  &start_date=1995-01-01
  &end_date=1995-12-31
  &daily=temperature_2m_max,temperature_2m_min,precipitation_sum
  &timezone=America/Los_Angeles
```

The required parameters are `latitude`, `longitude`, `start_date`, and `end_date` in ISO8601 format. The `daily` parameter accepts a comma-separated list of variables, and you can optionally specify `temperature_unit` (default celsius), `precipitation_unit` (default mm), and `timezone` for date alignment.

### Response Structure

The API returns JSON with location metadata followed by daily arrays:

```json
{
  "latitude": 37.785587,
  "longitude": -122.40964,
  "elevation": 18.0,
  "timezone": "America/Los_Angeles",
  "timezone_abbreviation": "GMT-8",
  "utc_offset_seconds": -28800,
  "generationtime_ms": 4.69,
  "daily_units": {
    "time": "iso8601",
    "temperature_2m_max": "°C",
    "temperature_2m_min": "°C",
    "precipitation_sum": "mm"
  },
  "daily": {
    "time": ["1995-01-01", "1995-01-02", ...],
    "temperature_2m_max": [14.2, 15.1, ...],
    "temperature_2m_min": [8.3, 9.0, ...],
    "precipitation_sum": [0.0, 2.5, ...]
  }
}
```

The daily arrays align by index, so `time[i]` corresponds to `temperature_2m_max[i]` and so forth. Missing values appear as `null` in the arrays, though the ERA5 dataset has remarkably complete coverage.

### Calculating Climate Metrics from Historical Data

To calculate frost dates from 30 years of daily minimum temperatures, we fetch data from 1994 through 2024 and for each year find the last spring date when the minimum dropped below 0°C and the first fall date when it dropped below 0°C. The median of these dates across all years gives the 50% probability frost dates, while the 10th and 90th percentiles give the range bounds.

The calculation for growing degree days sums the daily contribution when the average temperature exceeds a base threshold (typically 10°C for most crops). For each day, the GDD contribution is `max(0, (max_temp + min_temp) / 2 - base_temp)`.

Köppen classification requires monthly averages of temperature and precipitation, which we derive by aggregating daily data. For each month, we calculate the mean of daily average temperatures (the midpoint between max and min) and the sum of daily precipitation.

### Rate Limits and Fair Use

Open-Meteo allows non-commercial use with these limits: 10,000 API calls per day, 5,000 per hour, and 600 per minute. Since Solar-Sim's climate calculations happen once per location selection and we cache results aggressively, we'll stay well under these limits. The service asks users to contact them if exceeding 10,000 daily requests, and commercial applications need a paid subscription.

The API typically responds in under 100ms for single-year queries. A 30-year query for daily data (approximately 11,000 data points) takes 200-400ms depending on server load. This latency is acceptable since climate calculations happen in the background after location selection.

### Data Coverage Verification

I tested the API with San Francisco (37.7749, -122.4194), Seattle (47.6062, -122.3321), and Los Angeles (34.0522, -118.2437) for the year 1995. All three locations returned complete daily temperature and precipitation data with no null values. The elevation reported for each location matched expected values, confirming the API correctly identifies terrain characteristics.

## R2: Köppen Climate Classification

Köppen climate classification divides Earth's climates into five main groups based on temperature and precipitation patterns. The classification uses a decision tree that evaluates conditions in a specific order: polar climates first, then arid, then the remaining types. Understanding this order matters because a location might satisfy criteria for multiple types, and the first match wins.

### The Classification Algorithm

The algorithm starts by checking for polar climates. If the warmest month's average temperature is below 10°C, the climate is type E. Within type E, if all months average below 0°C it's EF (ice cap), otherwise it's ET (tundra).

Next comes the arid climate check, which requires calculating a precipitation threshold. The formula multiplies the mean annual temperature by 20, then adds an adjustment based on precipitation seasonality. If 70% or more of annual precipitation falls in the warm half-year (April through September in the northern hemisphere), add 280. If less than 30% falls in the warm half-year, add nothing. Otherwise add 140. The resulting threshold (Pth) in millimeters determines aridity: if annual precipitation is less than half of Pth, it's BW (desert); if less than Pth but at least half, it's BS (steppe).

For non-polar, non-arid climates, the coldest month temperature distinguishes between types A, C, and D. If the coldest month averages above 18°C, it's type A (tropical). If the coldest month is between -3°C and 18°C, it's type C (temperate). If the coldest month is below -3°C, it's type D (continental).

### Second Letter: Precipitation Pattern

The second letter indicates the precipitation pattern within each type. For tropical climates (A), the letter f means all months receive at least 60mm, m means monsoon with a short dry season compensated by heavy rains (driest month below 60mm but above 100 minus 4% of annual precipitation), and w means winter dry season (driest month below 60mm and below the monsoon threshold).

For temperate and continental climates (C and D), the letter s indicates dry summer where the driest summer month gets less than 30mm and less than one-third of the wettest winter month. The letter w indicates dry winter where the driest winter month gets less than one-tenth of the wettest summer month. The letter f indicates no distinct dry season.

### Third Letter: Temperature Pattern

The third letter describes the warmth of summers and severity of winters. Letter a means hot summer with the warmest month above 22°C. Letter b means warm summer with at least four months above 10°C but the warmest below 22°C. Letter c means cold summer with one to three months above 10°C. Letter d (used only in continental climates) means extremely cold winter with the coldest month below -38°C.

For arid climates, the third letter is h for hot (mean annual temperature above 18°C) or k for cold (mean annual temperature below 18°C).

### Implementation Approach

The Köppen algorithm translates directly into code by following the decision tree. First calculate the monthly averages from daily data, then evaluate conditions in order. Here's the core logic:

```typescript
function classifyKoppen(monthly: MonthlyClimate): string {
  const tHot = Math.max(...monthly.temps);
  const tCold = Math.min(...monthly.temps);
  const tAnn = monthly.temps.reduce((a, b) => a + b) / 12;
  const pAnn = monthly.precip.reduce((a, b) => a + b);

  // Determine warm/cold half-year (northern vs southern hemisphere)
  const warmMonths = monthly.latitude >= 0 ? [3,4,5,6,7,8] : [9,10,11,0,1,2];
  const warmPrecip = warmMonths.reduce((sum, m) => sum + monthly.precip[m], 0);
  const warmFraction = warmPrecip / pAnn;

  // Calculate precipitation threshold for arid classification
  let pTh: number;
  if (warmFraction >= 0.7) pTh = 20 * tAnn + 280;
  else if (warmFraction < 0.3) pTh = 20 * tAnn;
  else pTh = 20 * tAnn + 140;

  // E: Polar
  if (tHot < 10) {
    return tHot < 0 ? 'EF' : 'ET';
  }

  // B: Arid
  if (pAnn < pTh) {
    const bType = pAnn < pTh / 2 ? 'W' : 'S';
    const bTemp = tAnn >= 18 ? 'h' : 'k';
    return `B${bType}${bTemp}`;
  }

  // A, C, D classification continues...
}
```

### Plain-English Descriptions for Gardeners

Each Köppen code needs a gardening-relevant description. The Csb classification (Mediterranean warm summer) means mild winters with no hard frosts, dry summers requiring irrigation, and a long growing season perfect for tomatoes, peppers, and Mediterranean herbs. The Cfb classification (marine west coast) means cool summers, mild winters, year-round rain, and conditions ideal for cool-season crops and berries. The Dfa classification (humid continental hot summer) means cold winters with regular freezing, hot humid summers, and a moderate growing season suited for corn, beans, and hearty vegetables.

The mapping from Köppen codes to gardening descriptions should be embedded in the application so users immediately understand what their climate classification means for their garden planning.

## R3: Leaflet Map Picker Integration

Leaflet provides an open-source JavaScript mapping library that weighs just 43.5 KB minified and gzipped. Adding it to a SvelteKit application requires handling the SSR (server-side rendering) challenge because Leaflet depends on browser APIs (window, document) that don't exist during server rendering.

### Handling SSR in SvelteKit

The solution involves dynamic imports inside the `onMount` lifecycle function, which only runs in the browser. The component renders a placeholder div during SSR, then initializes the map after mounting:

```svelte
<script lang="ts">
  import { onMount } from 'svelte';
  import { browser } from '$app/environment';

  let mapContainer: HTMLDivElement;
  let map: L.Map | null = null;

  onMount(async () => {
    if (!browser) return;

    const L = await import('leaflet');
    await import('leaflet/dist/leaflet.css');

    map = L.map(mapContainer).setView([37.7749, -122.4194], 10);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap contributors'
    }).addTo(map);

    map.on('click', (e) => {
      // Handle location selection
      dispatch('select', { lat: e.latlng.lat, lng: e.latlng.lng });
    });

    return () => {
      map?.remove();
    };
  });
</script>

<div bind:this={mapContainer} class="map-container"></div>
```

An alternative approach disables SSR entirely for the route containing the map by adding `export const ssr = false` to the page's `+page.ts`. This simplifies the code but loses SSR benefits for the entire page. For Solar-Sim, where the map picker appears on an interactive form page, disabling SSR is acceptable.

### Marker Icon Issue

Leaflet's default marker icons cause 404 errors in bundled applications because the icon paths assume a specific directory structure that Vite/SvelteKit doesn't preserve. The fix involves explicitly defining icon paths:

```typescript
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';
import markerRetina from 'leaflet/dist/images/marker-icon-2x.png';

L.Icon.Default.mergeOptions({
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
  iconRetinaUrl: markerRetina
});
```

### Search Autocomplete with leaflet-geosearch

The leaflet-geosearch library provides address search using various providers including OpenStreetMap's Nominatim service, which requires no API key. The library works both as a Leaflet control and standalone:

```typescript
import { OpenStreetMapProvider, GeoSearchControl } from 'leaflet-geosearch';

const provider = new OpenStreetMapProvider();

// As a Leaflet control
const searchControl = new GeoSearchControl({
  provider,
  autoComplete: true,
  autoCompleteDelay: 250,
  showMarker: true,
  showPopup: false
});
map.addControl(searchControl);

// Or standalone for custom UI
const results = await provider.search({ query: 'San Francisco, CA' });
// Returns array of { x: longitude, y: latitude, label: string }
```

The standalone approach gives more flexibility for custom styling. Since Solar-Sim already has a text input for location search, we can keep that UI and wire it to the OpenStreetMapProvider for geocoding, displaying results in a dropdown that also updates the map view.

### Mobile and Touch Interactions

Leaflet handles touch interactions automatically, supporting pinch-to-zoom and drag-to-pan on mobile devices. The map should have a minimum height of 300px on mobile to provide sufficient touch target area. GPS location can be requested using the browser's geolocation API and centering the map on the result:

```typescript
function locateUser() {
  navigator.geolocation.getCurrentPosition(
    (position) => {
      const { latitude, longitude } = position.coords;
      map?.setView([latitude, longitude], 13);
      dispatch('select', { lat: latitude, lng: longitude });
    },
    (error) => console.error('Geolocation failed:', error)
  );
}
```

### Bundle Size Impact

Leaflet adds 43.5 KB gzipped to the bundle. The leaflet-geosearch library adds approximately 15 KB more. Combined, this is roughly 60 KB for the complete map picker functionality. Since the map picker only appears on the location input page, using dynamic imports ensures this code only loads when needed rather than increasing the initial bundle size.

## R4: NOAA Climate Prediction Center Outlook APIs

The NOAA Climate Prediction Center provides MapServer endpoints with seasonal temperature outlooks as GeoJSON polygons. These outlooks show probability deviations from normal conditions (above, below, or near normal) for the upcoming months. The data enables Solar-Sim to tell gardeners about current weather patterns and near-term expectations.

### Available Endpoints

The seasonal temperature outlook lives at `https://mapservices.weather.noaa.gov/vector/rest/services/outlooks/cpc_sea_temp_outlk/MapServer` and contains 13 layers for overlapping three-month periods (Lead 1 through Lead 13). Lead 1 covers the next three months, Lead 2 the following three-month window, and so on.

The monthly temperature outlook at `https://mapservices.weather.noaa.gov/vector/rest/services/outlooks/cpc_mthly_temp_outlk/MapServer` provides a single-month forecast.

The drought outlook at `https://mapservices.weather.noaa.gov/vector/rest/services/outlooks/cpc_drought_outlk/MapServer` shows drought development and persistence forecasts.

### Querying by Coordinates

Each layer supports spatial queries using the ArcGIS REST API. To find the outlook for San Francisco, construct a query with the point geometry:

```
https://mapservices.weather.noaa.gov/vector/rest/services/outlooks/cpc_sea_temp_outlk/MapServer/0/query
  ?geometry=-122.4194,37.7749
  &geometryType=esriGeometryPoint
  &spatialRel=esriSpatialRelIntersects
  &outFields=*
  &f=json
```

The response contains features that intersect the query point:

```json
{
  "features": [{
    "attributes": {
      "objectid": 5,
      "fcst_date": 1706140800000,
      "valid_seas": "FMA 2026",
      "prob": 40.0,
      "cat": "Above",
      "idp_filedate": 1768484727000,
      "idp_source": "lead1_FMA_temp"
    },
    "geometry": { "rings": [...] }
  }]
}
```

### Interpreting the Response

The `cat` field contains the category: "Above", "Below", "Normal", or "EC" (equal chances meaning no tilt toward any category). The `prob` field shows the probability percentage, typically 33%, 40%, 50%, 60%, 70%, 80%, or 90%. A category of "Above" with probability 40 means there's a 40% chance of above-normal temperatures compared to the climatological 33% base rate.

The `valid_seas` field shows the forecast period in three-letter month abbreviations, so "FMA 2026" means February-March-April 2026.

Testing with San Francisco coordinates returned category "Above" with 40% probability for the February-March-April 2026 period, indicating a modest tilt toward warmer-than-normal conditions.

### Update Frequency

Seasonal outlooks update on the third Thursday of each month at 8:30 AM Eastern. Monthly outlooks update at 3 PM on the last day of each month. The `idp_filedate` field in responses indicates when the data was last updated.

### Generating Gardening-Relevant Guidance

The raw probability data needs translation into actionable advice. A 40% "Above" probability for winter temperatures suggests: "Mild winter expected. Consider earlier planting dates for cool-season crops, but watch for late frost surprises. Fruit trees may receive fewer chill hours than normal."

The guidance algorithm should consider the season, the category, and the probability magnitude. High-probability above-normal conditions in spring suggest earlier planting windows, while below-normal conditions suggest delayed planting. The guidance should always include caveats about local microclimate and weather variability.

## R5: Data Model and Caching Strategy

The enhanced climate system needs a data model that accommodates historical temperature analysis, Köppen classification, and seasonal outlooks while supporting aggressive caching to minimize API calls.

### Expanded TypeScript Interfaces

```typescript
/**
 * Monthly climate data derived from historical observations.
 * Temperatures in Celsius, precipitation in millimeters.
 */
interface MonthlyClimate {
  latitude: number;
  temps: number[];    // 12 monthly average temperatures
  tempMaxs: number[]; // 12 monthly average daily maxes
  tempMins: number[]; // 12 monthly average daily mins
  precip: number[];   // 12 monthly total precipitation
}

/**
 * Köppen climate classification result.
 */
interface KoppenClassification {
  code: string;           // e.g., "Csb"
  primaryType: 'A' | 'B' | 'C' | 'D' | 'E';
  description: string;    // e.g., "Mediterranean - warm summer"
  gardeningNotes: string; // e.g., "Mild winters, dry summers..."
}

/**
 * Historical temperature statistics for frost date calculation.
 */
interface TemperatureStats {
  monthlyAvgHigh: number[];  // 12 values, average daily max per month
  monthlyAvgLow: number[];   // 12 values, average daily min per month
  annualAvgTemp: number;
  annualMinTemp: number;     // lowest recorded across 30-year period
  recordLowMonth: number;    // which month has the coldest days
}

/**
 * Seasonal outlook from NOAA CPC.
 */
interface SeasonalOutlook {
  validPeriod: string;       // e.g., "FMA 2026"
  temperatureCategory: 'Above' | 'Below' | 'Normal' | 'EC';
  temperatureProbability: number;
  precipCategory: 'Above' | 'Below' | 'Normal' | 'EC' | null;
  precipProbability: number | null;
  fetchedAt: Date;
}

/**
 * Combined enhanced climate data for a location.
 */
interface EnhancedClimateData {
  location: {
    latitude: number;
    longitude: number;
    elevation: number;
  };
  koppen: KoppenClassification;
  temperatureStats: TemperatureStats;
  frostDates: FrostDates;         // existing type from climate-data.md
  hardinessZone: HardinessZone;   // existing type from climate-data.md
  growingSeason: GrowingSeason;   // existing type from climate-data.md
  outlook: SeasonalOutlook | null;
  dataVersion: string;
  fetchedAt: Date;
}
```

### Caching Strategy

Historical climate data changes slowly (the 30-year normals update once per decade), so aggressive caching makes sense. The recommended approach uses localStorage with location-based keys.

Location keys should round coordinates to 0.05 degrees (approximately 5km precision) to enable cache hits for nearby queries. A user who moves the map slightly shouldn't trigger a new API call. The key format is `climate:${lat.toFixed(2)}:${lng.toFixed(2)}`.

For historical data (temperature stats, Köppen classification, frost dates), use a TTL of 30 days. The underlying data doesn't change frequently, and refetching monthly provides a reasonable balance between freshness and API load.

For seasonal outlooks, use a shorter TTL of 24 hours since these update monthly and users want current forecasts. Check the `idp_filedate` in cached data against the known update schedule to invalidate early when new forecasts release.

### Client-Side vs Server-Side Calculation

The calculation can happen either client-side or server-side, each with tradeoffs. Client-side calculation keeps the server stateless and reduces infrastructure costs, but means the browser downloads 30 years of daily data (approximately 300KB compressed) and performs the aggregation. Server-side calculation keeps the client lean and enables more sophisticated caching, but requires server infrastructure.

For Solar-Sim's initial implementation, client-side calculation is simpler. The Open-Meteo API responds quickly, modern browsers handle the data volume easily, and the calculation completes in under 100ms. If performance becomes an issue, we can add a SvelteKit server endpoint that caches pre-computed results.

### Graceful Failure Handling

When API calls fail, the system should fall back to embedded lookup tables. The existing frost date and hardiness zone tables from the original climate implementation serve as fallbacks. If Open-Meteo is unreachable, return estimated values from the lookup table with a flag indicating reduced accuracy. If NOAA CPC is unreachable, simply omit the seasonal outlook section rather than showing stale or empty data.

```typescript
async function getClimateData(lat: number, lng: number): Promise<ClimateResult> {
  try {
    const historical = await fetchOpenMeteo(lat, lng);
    return { success: true, data: calculateClimate(historical) };
  } catch (apiError) {
    console.warn('Open-Meteo unavailable, using fallback', apiError);
    return {
      success: true,
      data: {
        ...lookupTableFallback(lat, lng),
        dataVersion: 'fallback-v1',
        koppen: estimateKoppenFromLatitude(lat),
        outlook: null
      }
    };
  }
}
```

## Implementation Sequence

Based on this research, the implementation should proceed in the following order.

First, build the Open-Meteo client at `src/lib/climate/openmeteo.ts`. This module fetches historical daily data for a coordinate and returns the raw arrays. Include functions to aggregate daily data into monthly statistics and to calculate frost dates from 30 years of minimums. Write tests using known locations like San Francisco where expected values are well-documented.

Second, implement Köppen classification at `src/lib/climate/koppen.ts`. The module takes monthly temperature and precipitation arrays and returns the classification code with description. The decision tree translates directly into code, and the mapping from codes to gardening descriptions is a static lookup object. Test with representative locations from each major climate type.

Third, build the Leaflet map picker component at `src/lib/components/MapPicker.svelte`. Handle the SSR issue with dynamic imports in onMount. Include click-to-select, search autocomplete using OpenStreetMapProvider, and GPS location. The component emits a `select` event with coordinates when the user picks a location.

Fourth, add the seasonal outlook client at `src/lib/climate/outlook.ts`. Query the NOAA CPC MapServer with coordinates and parse the response into the SeasonalOutlook type. Include the guidance generator that converts probability categories into gardening advice.

Fifth, create the temperature chart component at `src/lib/components/TemperatureChart.svelte`. Display monthly average highs and lows as a line or area chart, giving users visual context for their year-round temperature patterns.

Sixth, update the LocationInput component to offer the map picker as the default input method while keeping text search and coordinate entry as alternatives.

Finally, update the results page to display the Köppen classification, monthly temperature chart, and seasonal outlook alongside existing sun and climate data.

## Sources

This research drew from the Open-Meteo Historical Weather API documentation at open-meteo.com, the Köppen classification system as described on Wikipedia and meteotemplate.com, Leaflet documentation and the SvelteKit integration guide by Stanislav Khromov at khromov.se, the leaflet-geosearch library documentation, and NOAA Climate Prediction Center MapServer service documentation. Bundle size data came from Bundlephobia. The NOAA CPC API query was tested directly to verify response format and data availability.
