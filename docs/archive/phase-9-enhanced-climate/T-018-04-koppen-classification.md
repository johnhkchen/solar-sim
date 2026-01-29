---
id: T-018-04
title: Implement Köppen climate classification
story: S-018
status: pending
priority: 1
complexity: M
depends_on:
  - T-018-03
output: src/lib/climate/koppen.ts
---

# T-018-04: Implement Köppen Climate Classification

Calculate Köppen climate classification from temperature and precipitation data.

## Task

Create `src/lib/climate/koppen.ts` with functions to determine Köppen climate type from monthly climate data.

## Köppen Classification Overview

The system uses temperature and precipitation thresholds:

- **A (Tropical)**: Coldest month >18°C
- **B (Arid)**: Evaporation exceeds precipitation
- **C (Temperate)**: Coldest month -3°C to 18°C, warmest >10°C
- **D (Continental)**: Coldest month <-3°C, warmest >10°C
- **E (Polar)**: Warmest month <10°C

Each has subtypes based on precipitation patterns and temperature ranges.

## Functions

- `classifyKoppen(monthly: MonthlyClimateData): KoppenClassification` - Returns code and description
- `getKoppenDescription(code: string): string` - Human-readable description for gardeners

## Types

```typescript
interface KoppenClassification {
  code: string;           // e.g., "Csb"
  primaryType: string;    // e.g., "Temperate"
  description: string;    // e.g., "Mediterranean - warm summer, dry"
  gardeningNotes: string; // e.g., "Mild winters, dry summers. Water-wise plants thrive."
}
```

## Gardening-Relevant Descriptions

Map each climate type to practical gardening context:
- Csb (SF): "Mediterranean with cool summers. Fog provides natural irrigation. Year-round growing possible for cool-season crops."
- Cfb (Seattle): "Marine west coast. Mild temperatures, reliable rain. Excellent for perennials and cool-season vegetables."

## Data Requirements

Köppen classification needs monthly precipitation in addition to temperature. Research ticket will determine if Open-Meteo provides this or if we need another source.

## Acceptance Criteria

Correctly classifies San Francisco as Csb, Seattle as Cfb, Los Angeles as Csb/BSk, Phoenix as BWh. Descriptions are useful for gardening planning. Algorithm handles edge cases near classification boundaries.
