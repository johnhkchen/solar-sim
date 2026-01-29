---
id: T-018-07
title: Update LocationInput to use map picker
story: S-018
status: pending
priority: 1
complexity: M
depends_on:
  - T-018-02
output: src/lib/components/LocationInput.svelte
---

# T-018-07: Update LocationInput to Use Map Picker

Integrate the new MapPicker component as the primary location selection method.

## Task

Update `src/lib/components/LocationInput.svelte` to use MapPicker as the default input method, while keeping the existing search and coordinates modes as alternatives.

## Updated Modes

1. **Map mode (new default)**: Full MapPicker component with click-to-select, search, and GPS
2. **Search mode**: Existing text search (kept as compact alternative)
3. **Coordinates mode**: Existing manual coordinate entry

## Layout Changes

- Map picker takes prominent position on the home page
- Mode toggle allows switching to compact search or coordinate entry
- Mobile: Map is collapsible to save screen space

## Props Updates

The component interface stays the same:
```typescript
interface LocationInputProps {
  onselect: (location: Location) => void;
  initialMode?: 'map' | 'search' | 'coordinates';
}
```

## UX Flow

1. User arrives at home page, sees map centered on their approximate location (via IP geolocation or default)
2. User can immediately click to select, or use search bar on map
3. Selected location shows marker and displays coordinates
4. "Continue" button navigates to results with selected location

## Acceptance Criteria

Map picker is the default view on home page. Users can switch between map, search, and coordinates modes. Selected location passes correctly to results page. Mobile experience is smooth with collapsible map option.
