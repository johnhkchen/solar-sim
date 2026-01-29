---
id: T-018-08
title: Update results page with enhanced climate display
story: S-018
status: pending
priority: 1
complexity: M
depends_on:
  - T-018-04
  - T-018-05
  - T-018-06
output: src/routes/results/+page.svelte
---

# T-018-08: Update Results Page with Enhanced Climate Display

Integrate all new climate features into the results page.

## Task

Update `src/routes/results/+page.svelte` to display Köppen classification, monthly temperatures, and climate trends alongside existing climate data.

## New Display Elements

**Köppen Classification Card**
- Climate code badge (e.g., "Csb")
- Full name (e.g., "Mediterranean - warm summer")
- Gardening notes specific to this climate type

**Monthly Temperature Chart**
- TemperatureChart component showing annual temperature pattern
- Below or beside the existing frost date display

**Climate Trend Indicator**
- Zone shift summary (e.g., "Warmed ~0.5 zones since 1990")
- Expandable guidance text with practical advice
- Subtle styling - informative but not alarming

## Data Flow

1. Results page fetches enhanced climate data using Open-Meteo client
2. Loading state while API call completes
3. Fallback to embedded tables if API fails
4. Cache results for return visits

## Layout

Organize climate section with clear hierarchy:
1. Hardiness zone (existing, updated with real data)
2. Köppen classification (new)
3. Frost dates (existing, updated with real data)
4. Monthly temperatures (new)
5. Climate trend (new, collapsible)

## Acceptance Criteria

All new climate elements display correctly. Data loads from Open-Meteo API with fallback. Layout is clean and scannable. Mobile responsive. Loading states prevent layout shift. San Francisco, Seattle, LA show correct climate data.
