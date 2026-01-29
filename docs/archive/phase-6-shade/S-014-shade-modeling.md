---
id: S-014
title: Shade Modeling MVP
status: in-progress
priority: 1
milestone: M10
---

# S-014: Shade Modeling MVP

This story implements shade modeling so users can see how obstacles like trees and buildings reduce their actual sun hours compared to the theoretical maximum.

## Context

The app calculates maximum theoretical sun hours assuming no obstructions. Real yards have trees, buildings, and fences that cast shadows throughout the day. Research in `docs/knowledge/research/phase-6-shade-climate.md` established the shadow geometry math, obstacle data models, and performance analysis.

## Key Decisions

**Scope**: Full MVP implementing all six research steps in one sprint.

**Obstacle input**: Blueprint/plan view rather than compass rose. Users see their plot as a landscape plan and click to place SVG-rendered obstacles. This approach supports landscapers doing sun analysis for clients and provides better spatial understanding than abstract direction pickers.

**Visualization**: Numbers comparison showing theoretical vs effective sun hours and percent blocked. The timeline and donut visualizations are deferred to future iterations.

**Seasonality**: Use summer transparency values year-round (40% for deciduous trees). Full seasonal variation adds complexity without much benefit since users primarily care about growing season.

## Acceptance Criteria

Users can add obstacles to a visual plot editor representing their yard. The app calculates effective sun hours accounting for shadow blocking. Results show a clear comparison between theoretical maximum and actual sun hours with shade. Plant recommendations use effective hours rather than theoretical.

## Tickets

T-014-01 conducts deep research (complete).

T-014-02 adds shade calculation type definitions.

T-014-03 implements shadow intersection math.

T-014-04 creates shade-aware sun hours integration.

T-014-05 researches blueprint UI implementation.

T-014-06 builds the blueprint/plan view component.

T-014-07 adds shade impact display to results.

T-014-08 updates recommendations to use effective hours.

## Dependencies

The existing solar engine provides sun position and sun hours calculations that the shade system wraps.
