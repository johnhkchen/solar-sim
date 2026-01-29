---
id: T-016-02
title: Add plant data types and interfaces
story: S-016
status: pending
priority: 1
complexity: S
depends_on:
  - T-016-01
output: src/lib/plants/types.ts
---

# T-016-02: Add Plant Data Types and Interfaces

Define TypeScript interfaces for plant requirements and recommendations based on research findings.

## Task

Create `src/lib/plants/types.ts` with interfaces for plant data, light requirements, and recommendation results. Also create `src/lib/plants/index.ts` to export the module.

## Expected Interfaces

Based on research, we likely need:

- `Plant` - Individual plant with name, category, requirements
- `LightRequirement` - Minimum/optimal sun hours
- `PlantRecommendation` - A plant with suitability score and notes
- `RecommendationResult` - Complete recommendation output

The exact shape will be determined by T-016-01 research.

## Acceptance Criteria

Types compile without errors. Types are exported from src/lib/plants/index.ts. Types align with research recommendations. Types include JSDoc comments explaining each field.
