---
id: S-016
title: Combined Recommendations
status: draft
priority: 1
depends_on:
  - S-015
---

# S-016: Combined Recommendations

This story merges shade and climate data into unified plant recommendations, completing the core user experience described in the happy path document.

## Context

After S-015 completes, the app will have effective sun hours (accounting for obstacles) and climate data (frost dates, hardiness zones, growing season). Users can see how much light a spot gets and when their growing season runs, but they still need the final step: knowing what to plant where and when.

The happy path document shows the target experience in minute 3-4 where users see suitable plants, contextual notes about shade benefits, and actionable planting guidance.

## Goals

This story delivers three interconnected features.

The first is a **recommendations engine** that combines effective sun hours with climate data to suggest appropriate plants. A spot with 5 effective hours in zone 7b during a 180-day growing season should recommend part-sun vegetables that mature within that window.

The second is a **planting calendar** that shows when to start seeds indoors, transplant outdoors, and harvest based on frost dates. The calendar uses the climate data from S-015 to position planting windows.

The third is a **seasonal light view** that shows how light conditions vary month-by-month, highlighting when shade impact is highest. This helps users understand seasonal patterns like "afternoon shade helps in July but hurts in April."

## Implementation Approach

Start with a research ticket to define the plant data model and recommendation algorithm. Keep the initial plant list small (20-30 common vegetables and herbs) with the option to expand later. Focus on the most actionable advice rather than comprehensive coverage.

The recommendation engine should be a pure function that takes shade analysis and climate data as inputs, returning a structured recommendation object. This keeps the logic testable and separate from UI concerns.

UI components should be built independently then integrated into the results page. The planting calendar and seasonal chart can share styling patterns with the existing growing season timeline from S-015.

## Acceptance Criteria

Users see plant recommendations on the results page that account for both their effective sun hours and their frost dates. The recommendations include a "suitable plants" list categorized by type (vegetables, herbs, flowers) and contextual notes about shade timing.

A planting calendar shows key dates for the growing season with color-coded periods for starting seeds, transplanting, and harvest windows.

A seasonal chart shows month-by-month light conditions with shade impact visualized, helping users understand when their garden gets the most or least usable light.

All new components work on mobile viewports and follow existing design patterns.

## Related Documents

The happy path document at docs/happy_path.md describes the target user experience in minute 3-4.

The shade research at docs/knowledge/research/phase-6-shade-climate.md discusses how shade and climate interact for plant recommendations.

The climate research at docs/knowledge/research/climate-data.md covers frost dates and growing season visualization.
