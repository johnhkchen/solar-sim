---
id: T-016-04
title: Implement recommendation engine
story: S-016
status: pending
priority: 1
complexity: M
depends_on:
  - T-016-03
output: src/lib/plants/recommendations.ts
---

# T-016-04: Implement Recommendation Engine

Create the core logic that combines shade and climate data to recommend suitable plants.

## Task

Create `src/lib/plants/recommendations.ts` with a function that takes effective sun hours (from shade analysis) and climate data (from S-015) and returns plant recommendations.

## Algorithm

The engine should filter plants by light requirements (effective hours meet minimum), filter by growing season (days to maturity fit within frost-free period), and optionally filter by hardiness zone for perennials.

Recommendations should be grouped by category (vegetables, herbs, flowers) and sorted by suitability. Include contextual notes like "afternoon shade benefits this crop in summer."

## Acceptance Criteria

Engine correctly filters plants by light and season requirements. Recommendations include suitability information. Engine handles edge cases like very short growing seasons or deep shade. Unit tests verify filtering logic.
