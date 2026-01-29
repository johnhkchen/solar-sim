---
id: T-013-03
title: Create SunDataCard component
story: S-013
status: complete
priority: 1
complexity: M
depends_on: []
output: src/lib/components/SunDataCard.svelte
---

# T-013-03: Create SunDataCard Component

Create a reusable component for displaying solar calculation results.

## Task

Create a SunDataCard component that displays sun hours, light category, and sunrise/sunset times in a clean card layout.

## Research

The solar engine exports `calculateDailySunHours` which returns a DailySunData object with sunHours, sunrise, sunset, and other fields. The categories module provides `classifySunlight` to convert hours to category names.

## Plan

Create a component that accepts DailySunData as a prop and renders it with appropriate formatting and styling.

## Implementation

The component should display:
1. Sun hours (e.g., "8.2 hours")
2. Light category with icon (e.g., "Full Sun ☀️")
3. Sunrise and sunset times formatted in local timezone
4. Date being displayed
5. Clean card styling consistent with LocationInput
