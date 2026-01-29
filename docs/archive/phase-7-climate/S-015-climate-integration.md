---
id: S-015
title: Climate Integration
status: pending
priority: 1
milestone: M11
---

# S-015: Climate Integration

This story adds climate data to help users understand their growing season boundaries. Sun hours tell you how much light a spot gets, but frost dates tell you when you can actually grow.

## Context

The app now calculates effective sun hours accounting for shade from obstacles. But a gardener in Portland needs to know more than "you get 8 hours of sun." They need to know their last spring frost is around April 15, their first fall frost is around October 15, and they have roughly 180 frost-free days to work with.

## Goals

Add frost date lookup by location so users see their growing season boundaries. Display USDA hardiness zone for the location. Calculate and show growing season length in days. Provide a timeline visualization showing the frost-free period alongside sun data.

## Acceptance Criteria

Given a location, the app displays estimated last spring frost date, estimated first fall frost date, growing season length in days, and USDA hardiness zone. A timeline or calendar view shows the frost-free growing period. The climate data integrates with existing sun/shade results on the same page.

## Research Questions

Before implementation, research must answer: What data source should we use for frost dates (NOAA, lookup table, API)? How precise do frost dates need to be (county level, zip code, coordinates)? How do we visualize the growing season timeline effectively? Should we show planting windows for different crop types (cool season vs warm season)?

## Tickets

T-015-01 researches climate data sources and visualization approaches.
T-015-02 adds climate data types and interfaces.
T-015-03 implements frost date lookup.
T-015-04 implements USDA hardiness zone lookup.
T-015-05 creates growing season timeline component.
T-015-06 integrates climate data into results page.
