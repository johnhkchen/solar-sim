---
id: T-018-05
title: Add seasonal weather outlook and anomaly display
story: S-018
status: pending
priority: 1
complexity: M
depends_on:
  - T-018-01
output: src/lib/climate/outlook.ts
---

# T-018-05: Add Seasonal Weather Outlook and Anomaly Display

Integrate NOAA Climate Prediction Center outlook data to show current weather patterns and near-term forecasts relevant to garden planning.

## Context

Long-term "zones are shifting" messaging is less actionable than knowing "this winter has been 10°F warmer than normal and the 3-month outlook shows continued above-normal temps." Gardeners establishing new plantings need to know about current anomalies and near-term patterns, not just historical averages.

## Data Sources

NOAA CPC provides GeoJSON APIs for:

- **Seasonal Temperature Outlook** (3-month): `https://mapservices.weather.noaa.gov/vector/rest/services/outlooks/cpc_sea_temp_outlk/MapServer`
- **Monthly Temperature Outlook**: `https://mapservices.weather.noaa.gov/vector/rest/services/outlooks/cpc_mthly_temp_outlk/MapServer`
- **Drought Outlook**: `https://mapservices.weather.noaa.gov/vector/rest/services/outlooks/cpc_drought_outlk/MapServer`

These return probability polygons (above/below/near normal) that we can query by coordinates.

## Task

Create `src/lib/climate/outlook.ts` with functions to fetch and interpret CPC outlook data for a given location.

## Functions

- `fetchSeasonalOutlook(coords: Coordinates): Promise<SeasonalOutlook>` - Get 3-month temp/precip outlook
- `fetchDroughtOutlook(coords: Coordinates): Promise<DroughtOutlook>` - Get drought forecast
- `getOutlookGuidance(outlook: SeasonalOutlook, drought: DroughtOutlook): string` - Generate gardening-relevant advice

## Types

```typescript
interface SeasonalOutlook {
  period: string;           // e.g., "Feb-Mar-Apr 2026"
  temperature: OutlookCategory;
  precipitation: OutlookCategory;
  fetchedAt: Date;
}

type OutlookCategory =
  | { type: 'above-normal'; probability: number }
  | { type: 'below-normal'; probability: number }
  | { type: 'near-normal' }
  | { type: 'equal-chances' };  // no strong signal

interface DroughtOutlook {
  period: string;
  status: 'none' | 'developing' | 'persisting' | 'improving' | 'removing';
  fetchedAt: Date;
}
```

## Guidance Examples

**Interior West, warm winter anomaly:**
> "Current conditions: This region is experiencing an exceptionally warm winter. The seasonal outlook shows above-normal temperatures likely through spring.
>
> For your garden:
> - Earlier planting may be possible, but watch for late frost risk
> - Reduced chill hours may affect fruit tree dormancy
> - Start preparing irrigation earlier than usual"

**Pacific Northwest, wet winter:**
> "Current conditions: Above-normal precipitation expected to continue.
>
> For your garden:
> - Good soil moisture heading into spring
> - Watch for fungal issues in wet conditions
> - Delay planting in waterlogged areas"

## Acceptance Criteria

Successfully queries CPC MapServer APIs for any US location. Correctly interprets probability polygons to determine outlook category. Generates practical, gardening-focused guidance. Handles locations outside coverage area (non-US) gracefully. Caches responses appropriately (outlooks update monthly).
