---
id: T-020-06
title: Horticultural integration
status: complete
priority: 4
complexity: M
depends_on: [T-020-05]
story: S-020
---

# T-020-06: Horticultural Integration

## Objective

Connect the combined sun-hours calculation to our existing plant recommendation engine, showing gardening guidance based on actual shade conditions.

## Acceptance Criteria

1. Effective sun hours feed into light category classification
2. Plant recommendations update based on tree-adjusted sun exposure
3. Growing season calendar reflects actual conditions
4. Planting date recommendations account for local climate + shade
5. Results page shows cohesive flow from map → sun hours → recommendations

## Technical Approach

Wire the combined sun-hours output (T-020-05) to existing:
- `src/lib/solar/light-categories.ts` - classify sun exposure
- `src/lib/plants/recommendations.ts` - plant suggestions
- Climate integration (frost dates, hardiness zones)

This is primarily integration work connecting existing modules to the new data source.

## Files to Modify

- Results page component
- Possibly refactor to accept sun-hours from multiple sources
- Ensure recommendations component handles dynamic updates

## Notes

This ticket completes the end-to-end flow: location → map with shadows → tree placement → sun hours → "what can I grow here?"
