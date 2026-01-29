---
id: T-018-02
title: Build Leaflet map picker component
story: S-018
status: pending
priority: 1
complexity: M
depends_on:
  - T-018-01
output: src/lib/components/MapPicker.svelte
---

# T-018-02: Build Leaflet Map Picker Component

Create an interactive map component for location selection using Leaflet and OpenStreetMap.

## Task

Create `src/lib/components/MapPicker.svelte` that renders an interactive map where users can click to select a location, search with autocomplete, or use GPS.

## Features

- **Click to select**: User clicks anywhere on the map to set location marker
- **Search autocomplete**: Text input that searches places and zooms to selection
- **GPS button**: "Use my location" that requests geolocation permission
- **Coordinate display**: Shows current lat/lon of selected point
- **Responsive**: Works on mobile with touch interactions

## Technical Approach

Use dynamic import for Leaflet to handle SSR (Leaflet requires browser APIs). Wrap in onMount or use SvelteKit's browser check. Style the map container to match app aesthetics.

## Props

- `initialLocation?: Coordinates` - Starting center point
- `onSelect: (location: Location) => void` - Callback when location is selected
- `zoom?: number` - Initial zoom level (default 10)

## Dependencies

- leaflet (map rendering)
- leaflet-geosearch (autocomplete search)
- @types/leaflet (TypeScript support)

## Acceptance Criteria

Map renders correctly with OSM tiles. Users can click to place a marker and see coordinates. Search autocomplete finds locations and moves the map. GPS button requests permission and centers on user location. Component works on mobile devices. No SSR errors in SvelteKit.
