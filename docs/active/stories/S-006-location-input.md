---
id: S-006
title: Location Input System
status: pending
priority: 1
milestone: null
---

# S-006: Location Input System

This story covers how users specify their location, from address entry through coordinate resolution and timezone detection.

## Context

The happy path begins with Maria typing "Portland, OR" and receiving validated coordinates with timezone. This seemingly simple interaction requires geocoding, coordinate validation, timezone inference, and clear UI feedback. The experience must feel instant and forgiving of typos or ambiguous input.

## Scope

The location system includes four capabilities. First, address geocoding that converts place names to coordinates using an external API. Second, coordinate validation that ensures inputs fall within valid ranges and handles various formats like decimal degrees versus degrees-minutes-seconds. Third, timezone detection that infers the correct timezone from coordinates since this affects all time-based calculations. Fourth, a location input component that provides autocomplete, validation feedback, and geolocation permission handling.

The geocoding API integration lives in `src/lib/geo/` while the UI components live in `src/lib/components/`. The system should degrade gracefully when geocoding fails, allowing manual coordinate entry as a fallback.

## Research Questions

Before implementation, research should answer the following. Which geocoding API works within Cloudflare Workers constraints? Should we proxy geocoding through our edge function or call the API client-side? What's the best approach for timezone inference from coordinates? How should we handle geolocation permission UX on mobile versus desktop?

## Acceptance Criteria

The location system is complete when users can enter addresses and receive coordinates, manually enter coordinates in multiple formats, use browser geolocation when permitted, see immediate feedback for valid and invalid inputs, and the system works offline with manual coordinate entry even if geocoding is unavailable.
