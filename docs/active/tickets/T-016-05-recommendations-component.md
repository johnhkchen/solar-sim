---
id: T-016-05
title: Create recommendations UI component
story: S-016
status: pending
priority: 1
complexity: M
depends_on:
  - T-016-04
output: src/lib/components/PlantRecommendations.svelte
---

# T-016-05: Create Recommendations UI Component

Build the Svelte component that displays plant recommendations to users.

## Task

Create `src/lib/components/PlantRecommendations.svelte` that takes recommendation data and displays it in a user-friendly format.

## Design

The component should show the effective light category prominently, display suitable plants grouped by type (vegetables, herbs, flowers), include contextual notes about shade timing, and indicate if shade has limited options compared to theoretical sun hours.

Match the style described in the happy path document with checkmarks for suitable plants and a lightbulb icon for contextual tips.

## Acceptance Criteria

Component displays recommendations clearly. Plants are grouped by category. Contextual notes appear when relevant. Component is responsive on mobile. Component follows existing design patterns.
