---
id: S-005
title: Solar Calculation Engine
status: pending
priority: 1
milestone: null
---

# S-005: Solar Calculation Engine

This story covers the core astronomical calculations that power Solar-Sim. The engine computes sun position, sun hours, and light categories for any location and date.

## Context

The happy path shows users receiving accurate sun data within seconds of entering a location. Behind the scenes, this requires computing solar altitude and azimuth throughout the day, integrating over daylight hours to get total sun exposure, and classifying results into horticultural categories.

The specification lists open questions about algorithm selection, time resolution for integration, and accuracy requirements. Research will answer these before implementation begins.

## Scope

The solar engine includes four components. First, a sun position calculator that takes latitude, longitude, date, and time as inputs and returns altitude and azimuth. Second, a sun hours integrator that samples altitude throughout a day and sums the hours where altitude exceeds zero. Third, a seasonal aggregator that computes sun hours across a date range and produces averages and patterns. Fourth, a category classifier that maps sun hours to full sun, part sun, part shade, and full shade designations.

The engine lives in `src/lib/solar/` and exports clean TypeScript interfaces. It has no UI dependencies and can be tested in isolation.

## Research Questions

Before implementation, research should answer the following. Which algorithm provides the best accuracy-to-complexity ratio for our use case? What time interval balances accuracy and performance for sun-hour integration? Should we include atmospheric refraction correction? What edge cases exist around polar latitudes and extreme dates?

## Acceptance Criteria

The engine is complete when it passes unit tests covering standard cases like Portland in summer and winter, edge cases like Arctic Circle during solstices, and performance benchmarks showing sub-100ms calculation for a full year of daily sun hours.
