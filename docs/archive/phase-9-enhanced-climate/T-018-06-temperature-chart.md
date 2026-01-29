---
id: T-018-06
title: Create monthly temperature chart component
story: S-018
status: pending
priority: 1
complexity: S
depends_on:
  - T-018-03
output: src/lib/components/TemperatureChart.svelte
---

# T-018-06: Create Monthly Temperature Chart Component

Display monthly average high and low temperatures in a visual chart.

## Task

Create `src/lib/components/TemperatureChart.svelte` that shows a year's worth of temperature patterns.

## Visualization

A simple bar or line chart showing:
- Monthly average high temperatures (warm color)
- Monthly average low temperatures (cool color)
- Temperature scale on Y-axis (°F with °C option)
- Month labels on X-axis

## Design Options

**Option A: Range bars**
Vertical bars showing the range from avg low to avg high for each month. Clear and compact.

**Option B: Dual line chart**
Two lines tracking high and low through the year. Shows trends clearly.

**Option C: Area chart**
Filled area between high and low lines. Visually shows the "comfortable" range.

Research ticket will recommend which approach works best.

## Props

```typescript
interface TemperatureChartProps {
  monthly: MonthlyAverages;
  units?: 'fahrenheit' | 'celsius';
}
```

## Implementation

Use SVG for rendering (consistent with other visualizations in the app). Keep it simple and readable on mobile.

## Acceptance Criteria

Chart clearly shows temperature patterns throughout the year. Users can see which months are coldest/warmest at a glance. Works on mobile viewports. Accessible with appropriate ARIA labels.
