---
id: T-016-01
title: Research plant recommendations approach
story: S-016
status: pending
priority: 1
complexity: M
depends_on: []
output: docs/knowledge/research/plant-recommendations.md
---

# T-016-01: Research Plant Recommendations Approach

Research the data model, algorithm, and UX for combining shade and climate data into plant recommendations.

## Research Questions

### R1: Plant Data Model

What information do we need to store for each plant? At minimum we need light requirements (category thresholds), days to maturity, and temperature tolerance. Should we include planting depth, spacing, or companion planting data for future features?

Consider whether to use existing plant databases (like the Open Food Network plant library) or build a curated list for common garden vegetables.

### R2: Recommendation Algorithm

How do we score plant suitability given effective sun hours, growing season length, and hardiness zone? A simple approach is binary matching (meets requirements or not), but a scoring system could rank "excellent fit" vs "marginal fit."

Should recommendations adapt based on when the user is looking? A March query might emphasize spring planting while September focuses on fall crops.

### R3: Planting Calendar UX

What dates matter for a planting calendar? Key milestones include last frost date, seed starting window (typically 6-8 weeks before last frost for transplants), transplant date, and first frost date.

How should the calendar interact with specific plant recommendations? Options include a generic calendar showing season boundaries, or a per-plant timeline showing that specific crop's schedule.

### R4: Seasonal Light Visualization

What's the most useful way to show monthly light variation? Options include a bar chart of monthly average hours, a heatmap similar to the seasonal overview in the happy path, or a line graph showing effective vs theoretical hours.

Should this visualization be interactive (click a month to see detail) or static (all info visible at once)?

### R5: Shade Timing Insights

Some plants benefit from afternoon shade during hot summers (lettuce, spinach) while others need all-day sun (tomatoes, peppers). How do we incorporate shade timing into recommendations?

The ShadeWindow data from the shade analysis tells us when shade occurs. Can we use this to generate contextual notes like "afternoon shade in July helps heat-sensitive crops"?

## Deliverables

A research document at docs/knowledge/research/plant-recommendations.md containing recommended approaches for each question above, proposed TypeScript interfaces for plant data and recommendations, and a sketched implementation sequence for remaining S-016 tickets.

## Acceptance Criteria

The research document answers all five questions with clear recommendations. Proposed interfaces are concrete enough that T-016-02 can implement them directly. The implementation sequence is realistic given existing code structure.
