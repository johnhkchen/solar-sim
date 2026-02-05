---
id: T-023-03
story: S-023
title: Zone-Aware Plant Selection
status: ready
priority: 1
complexity: L
dependencies:
  - T-023-02
---

# T-023-03: Zone-Aware Plant Selection

## Objective

Build the plant selection UI that shows validated candidates for each zone based on the zone's sun exposure and user preferences.

## Requirements

### Zone Selector

At top of Plants phase panel:
- Tabs or dropdown showing all zones: "Bed A (Full Sun)" | "Bed B (Part Shade)"
- Selecting a zone:
  - Highlights zone on map
  - Shows plant candidates for that zone's light category
  - Shows plants already added to that zone

### Filter Chips

Below zone selector, toggleable filters:
- Native
- Edible
- Low Water / Drought Tolerant
- Deer Resistant
- Evergreen
- (future: more based on plant database capabilities)

Filters are AND logic: plant must match ALL active filters plus zone's light category.

### Plant Card Grid

Display matching plants as cards in a 2-column grid (3-column on wider screens):

**Card anatomy**:
- Plant photo (square, ~100-120px)
- Common name (primary, bold)
- Botanical name (secondary, italic, smaller)
- Size badge: "3' × 4'" (H × W)
- Water icon indicating needs
- "Add" button (or quantity control if already added)

**Card interactions**:
- Tap card → expand to detail view (modal or inline expansion)
- Tap "Add" → add 1 to zone, show quantity +/- controls
- Quantity controls: increment, decrement, remove when 0

### Plant Detail View

When card is expanded/tapped:
- Larger photo
- Full description
- Bloom season
- Sun/water/soil requirements
- Spacing recommendations
- Growing notes
- "Add to [Zone Name]" button with quantity input

### Search

Search bar above card grid:
- Searches plant names (common and botanical)
- Results show within validated candidates first
- Non-recommended plants show grayed out with "Not recommended for this zone" note

### Plants Added Summary

In panel, section showing:
- "Plants in Bed A: 3 species, 12 total"
- Collapsible list of added plants with quantities
- Tap to jump to that plant's card

## Data Requirements

This ticket depends on having a queryable plant database. The existing `plants/` module has basic recommendations; this needs to be extended to support:

```typescript
interface PlantQuery {
  lightCategory: LightCategory;
  filters?: {
    native?: boolean;
    edible?: boolean;
    lowWater?: boolean;
    deerResistant?: boolean;
    evergreen?: boolean;
  };
  searchTerm?: string;
}

function queryPlants(query: PlantQuery): Plant[];
```

If the plant database isn't rich enough yet, this ticket can use mock data or the existing plant list with limited filtering.

## State Model

```typescript
interface ZonePlantSelection {
  zoneId: string;
  plants: Array<{
    plantId: string;
    quantity: number;
  }>;
}
```

## Implementation Notes

1. Create `PlantSelector.svelte` as the main component for Plants phase
2. Create `PlantCard.svelte` for individual plant display
3. Create `PlantDetail.svelte` for expanded view
4. Extend plant query API in `src/lib/plants/`
5. Wire filter state to query parameters
6. Persist selected plants per zone to localStorage

## Acceptance Criteria

- [ ] Zone selector shows all marked zones with light category
- [ ] Selecting zone filters plant grid to matching candidates
- [ ] Filter chips toggle and update plant grid
- [ ] Plant cards display with photo, names, size, add button
- [ ] Can add plants to zone with quantity tracking
- [ ] Quantity controls work (increment, decrement, remove)
- [ ] Plant detail view accessible by tapping card
- [ ] Search filters plant grid by name
- [ ] Plants added summary shows counts per zone
- [ ] Selected plants persist to localStorage

## Files to Create/Modify

- New: `src/lib/components/PlantSelector.svelte` — main plant selection UI
- New: `src/lib/components/PlantCard.svelte` — individual plant card
- New: `src/lib/components/PlantDetail.svelte` — expanded plant info
- New: `src/lib/components/FilterChips.svelte` — filter toggle buttons
- Modify: `src/lib/plants/index.ts` — extend query API
- Modify: `src/routes/results/+page.svelte` — integrate into Plants phase
