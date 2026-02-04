# UI/UX Research: Plan Generation Flow

> **Status**: In Progress
> **Created**: 2026-01-31

This document captures research questions and findings for designing the core UI/UX flow that takes users from address to exportable planting plan in 15 minutes.

---

## Research Questions

### Q1: What is the current state of the UI?

What components exist today? What routes/pages are implemented? How do they connect (or fail to connect) to the 15-minute flow we're targeting?

**Answer**: The app has three routes: `/` (location input), `/results` (main dashboard), and `/calculate` (stub). There are 20 components covering location input, map/tree placement, shadow visualization (PlotViewer, IsometricView, PlotEditor), heatmaps (ExposureHeatmap, ReactiveHeatmap, SpotInspector), data display (SunDataCard, SeasonalLightChart, TemperatureChart, GrowingSeasonTimeline), plant recommendations, and utilities (TimeScrubber, PeriodSelector).

The current flow is: enter location → land on results page with everything visible at once. It's exploration-oriented, not outcome-oriented. Users see sun data, can add obstacles/trees, view climate info, and see plant recommendations—but there's no guided path to a plan. The "Garden Planner" section exists but is collapsed by default and disconnected from the plant recommendations below it.

Key gaps relative to the 15-minute flow: no zone marking, no plant selection UI tied to zones, no plan builder canvas, no PDF export.

---

### Q2: What are the discrete steps in the target flow?

Breaking down the 15-minute experience from happy_path.md, what are the atomic user actions and system responses? Where are the decision points vs. linear progression?

**Answer**: The flow breaks into four phases with distinct user actions:

**Phase 1: Site Setup (minutes 1-3)**
1. Enter address → system geocodes, shows map
2. Confirm/adjust property boundary → system calculates area
3. Review auto-detected trees → user confirms, adds missed ones, removes false positives
4. Place observation point → system marks the primary analysis location

**Phase 2: Sun Analysis (minutes 3-6)**
5. Select analysis period (growing season default) → system renders heatmap
6. Tap spots to inspect → system shows sun hours for that point
7. View overall assessment → "your south bed is full sun, north corner is full shade"

**Phase 3: Plant Selection (minutes 6-12)**
8. Mark planting zones/beds → user draws or taps to define areas
9. For each zone, view validated candidates → system filters by zone's sun + user preferences
10. Add plants to plan → user taps/drags to include in plan
11. Adjust quantities/placement → system validates spacing

**Phase 4: Plan Export (minutes 12-15)**
12. Review plan summary → overhead view + plant schedule
13. Generate PDF → system produces exportable document
14. Share/save → email, download, or bookmark URL

Decision points: tree confirmation (step 3), period selection (step 5), zone marking (step 8), plant selection (step 10). Everything else is linear progression.

---

### Q3: What's missing from the current implementation?

Comparing current components to the target flow, what gaps exist? Which gaps are "build from scratch" vs. "wire existing pieces together"?

**Answer**:

**Wire together (components exist, need integration):**
- Location input → already works
- Tree placement and confirmation → MapPicker has this
- Heatmap rendering → ExposureHeatmap, ReactiveHeatmap exist
- Period selection → PeriodSelector exists
- Spot inspection → SpotInspector exists
- Plant recommendations → PlantRecommendations exists (but not zone-aware)

**Build from scratch:**
- Zone/bed marking UI → need polygon or rectangle drawing on map
- Zone-aware plant filtering → connect zones to plant database queries
- Plan builder canvas → overhead view with plant placement, spacing validation
- Plant schedule generation → structured data output
- PDF export → document generation with overhead view + schedule
- Guided flow/wizard UI → progress indicator, phase navigation

**Refactor significantly:**
- Results page → currently a dashboard, needs to become a stepped flow
- PlantRecommendations → needs to work per-zone, not for whole property
- Plant database → needs richer query API for multi-constraint filtering

---

### Q4: How should the UI be structured?

Single page app with panels/modes? Multi-page wizard? Sidebar + main canvas? What structure best supports both the linear first-time flow and repeat-user efficiency?

**Answer**: A **single-page app with modal phases** is the best fit. Reasons:

1. **Map is always primary** — the spatial canvas should remain visible throughout. Hiding it behind page transitions breaks spatial continuity.

2. **Phases as overlays/panels** — each phase (site setup, analysis, plants, export) manifests as UI that appears over or alongside the map, not replacing it.

3. **Progress indicator** — a horizontal stepper or breadcrumb shows where you are: Site → Analysis → Plants → Plan. Users can jump back, but forward requires completing prior steps.

4. **Repeat users skip ahead** — if location is bookmarked with trees already placed, site setup is pre-populated and user can jump to analysis or plants.

5. **iPad-friendly** — modal phases work well with touch. Swipe between phases. The map stays anchored.

Structure: Map canvas (full width on mobile, left 60% on desktop) + Phase panel (bottom sheet on mobile, right sidebar on desktop). Phase panel content changes based on current step; map persists and updates reactively.

This is similar to how apps like Morpholio Trace work: the canvas is persistent, tools/panels appear contextually.

---

### Q5: What are the mobile/iPad constraints?

The primary power user (Lisa) uses an iPad on-site. What does this mean for touch targets, gestures, screen real estate, and offline capability?

**Answer**:

**Touch targets**: Minimum 44x44pt for all interactive elements (Apple HIG). Current MapPicker tree markers are 40px which is close but should be increased. Buttons, list items, and selection targets all need this minimum.

**Gestures**:
- Pinch-to-zoom on map (already supported via Leaflet)
- Pan to move map (already supported)
- Tap to select/place (trees, observation point, zones)
- Long-press for context menu (edit/delete tree, zone options)
- Swipe between phases (bottom sheet pattern)

**Screen real estate**: iPad in landscape gives ~1024x768 usable. Portrait is ~768x1024. Design for portrait-first since that's natural for walking a property. Bottom sheet pattern for phase panels (30-50% of screen height, expandable).

**Offline capability**:
- Map tiles can be cached for recently viewed areas
- Solar calculations are client-side (already works offline)
- Plant database should be embedded, not API-fetched
- State persists to localStorage (already implemented)
- PDF generation must work client-side (no server round-trip)

**On-site conditions**: Bright sunlight means high contrast UI. Large text for readability. Avoid subtle grays. Consider dark-on-light for map overlays.

---

### Q6: How do we handle the "zone marking" interaction?

Users need to define planting beds/zones on the map. Is this freeform polygon drawing? Preset shapes? How does it integrate with the heatmap and plant selection?

**Answer**: Start simple, allow complexity later.

**V1 approach: Rectangle zones**
- Tap-and-drag to draw a rectangle on the map
- Each rectangle is a "planting bed" with a name (auto-generated: "Bed A", "Bed B", or user-editable)
- Rectangles can be resized via corner handles, moved via drag
- Each zone calculates its average sun hours from the heatmap grid points it covers
- Zone gets a light category (full sun, part shade, etc.) displayed as a colored border/fill

**Why rectangles**:
- Most garden beds are roughly rectangular
- Polygon drawing is hard on touch (lots of taps, easy to make mistakes)
- Rectangles are easy to understand and manipulate
- Good enough for 80% of use cases

**Future: Polygon/freeform**
- Could add later for irregular beds, curved borders
- Would need undo, point editing, close-polygon gesture

**Integration with plant selection**:
- When user enters plant selection phase, each zone becomes a section
- "Bed A (Full Sun, 7.2 hrs avg)" → shows candidates for full sun
- User selects plants per zone
- Zones with similar light can share candidate lists

---

### Q7: What does the plant selection UI look like?

Validated candidates per zone—is this a list, a grid of cards, a swipeable carousel? How do users filter, compare, and add plants to their plan?

**Answer**: Card grid with filtering, optimized for browsing with a client.

**Layout**:
- Zone selector at top (tabs or dropdown): "Bed A (Full Sun)" | "Bed B (Part Shade)" | ...
- Filter chips below: Native | Edible | Low Water | Deer Resistant | Evergreen
- Plant cards in a 2-column grid (3-column on larger screens)

**Plant card anatomy**:
- Photo (square, ~120px)
- Common name (primary, larger)
- Botanical name (secondary, smaller, italic)
- Quick stats: mature size (H x W), water needs icon, sun icon
- "Add to plan" button or checkbox

**Interaction**:
- Tap card → expand to full detail (description, bloom time, spacing, growing notes)
- Tap "Add" → plant appears in plan, card shows quantity control (+/-)
- Filter chips are toggles; multiple can be active; plants must match ALL active filters

**Browse vs. search**:
- Primary mode is browse (curated candidates for this zone)
- Search bar available for "I know I want lavender" scenarios
- Search searches within validated candidates first, then shows "not recommended for this zone" results grayed out

**Client-friendly**:
- Photos are essential for on-site conversations
- Cards should be large enough to tap easily and see at a glance
- Swiping through a carousel is less scannable than a grid

---

### Q8: What does the plan builder canvas look like?

Users drag plants onto an overhead view. Is this the same map, or a separate "plan mode"? How do we show spacing, mature size, and validation feedback?

**Answer**: Dual-mode with seamless transition.

**Map mode (analysis)**: Satellite/terrain base with heatmap overlay, trees, zones marked. This is for understanding the site.

**Plan mode (design)**: Simplified overhead with zones as colored regions, placed plants shown as circles sized to mature spread. This is for composing the plan.

**Toggle between modes**: A simple switch "Map / Plan" in the toolbar. State persists—zones, plants, trees all shared between views.

**Plan canvas specifics**:
- White or light gray background with subtle grid (1m or 1ft squares)
- Zones rendered as filled polygons with light category color (orange=full sun, yellow=part sun, green=part shade, blue=shade)
- Plants rendered as circles:
  - Diameter = mature spread at scale
  - Fill color by plant type (green=shrub, brown=tree, pink=flower, etc.) or user preference
  - Label with plant code (e.g., "LV" for Lavender) or abbreviation
- Spacing validation:
  - If plants overlap more than 20%, show red warning ring
  - If plant extends outside zone, show dashed outline
- Drag-to-reposition plants, pinch-to-not-allowed (can't resize; size is mature spread)

**Plant placement workflow**:
- From plant selection, tap "Add to Bed A" → plant appears at center of zone
- User drags to desired position
- Or: tap location in zone first, then select plant → placed at tap location

**Why separate plan mode**:
- Satellite imagery is distracting for design work
- Simpler canvas renders faster
- Professional plans are overhead schematics, not photo overlays

---

### Q9: What does the export look like?

The PDF is the tangible output. What's on it? Overhead view, plant schedule, growing notes—what format do landscapers actually want to receive?

**Answer**: Based on industry standards (University of Florida EDIS, Land F/X, professional landscape design practice), a planting plan PDF should include:

**Page 1: Cover/Summary**
- Property address and coordinates
- Date generated
- Analysis period (e.g., "Growing Season Apr-Oct")
- Total area, number of zones, number of plants
- Light category summary ("3 full sun beds, 1 part shade, 1 full shade")

**Page 2: Overhead Plan**
- Scaled overhead view (1" = 10' or metric equivalent)
- Zones outlined and labeled (Bed A, Bed B, etc.)
- Plants shown as circles at mature size with code labels
- North arrow, scale bar
- Legend: plant codes to names

**Page 3+: Plant Schedule**
Table with columns:
- Code (LV, RS, etc.)
- Common Name (Lavender, Rosemary)
- Botanical Name (Lavandula angustifolia, Salvia rosmarinus)
- Quantity
- Size at Purchase (1 gal, 5 gal, etc.)
- Mature Size (H x W)
- Spacing (center to center)
- Zone(s) where placed

**Page 4+: Zone Details (optional)**
Per zone:
- Zone name and light category
- Sun hours (average, range)
- Plants in this zone with quantities
- Planting notes specific to zone

**Page N: Growing Notes**
- General care instructions
- Watering guidelines by plant type
- Seasonal tasks
- Source/attribution

**Format considerations**:
- Letter size (8.5x11") for US, A4 for international
- Printable in grayscale (don't rely solely on color)
- Clean, professional typography
- Logo/branding optional but space for it

**Client-side generation**: Use a library like jsPDF or pdfmake. Render the plan canvas to image, format tables as PDF tables.

---

### Q10: How do we handle state and persistence?

Users may start a plan, leave, and come back. What's saved locally? What requires an account (if anything)? How do shareable URLs work?

**Answer**:

**localStorage (already partially implemented)**:
Current: Trees and observation point stored per location (rounded coords). Plot obstacles stored similarly.

Extend to include:
- Zones (array of rectangles with names)
- Selected plants per zone (plant IDs + quantities + positions)
- Current phase (so user returns to where they left off)
- User preferences (filter defaults, preferred plant types)

Key structure: `solar-sim:plan:{lat}:{lng}` → JSON blob with full plan state.

**No account required for**:
- Full flow from address to PDF export
- Saving plans locally
- Returning to a saved plan on the same device

**Account enables (future, not V1)**:
- Sync across devices
- Share editable plans with collaborators
- Save multiple plans per property (compare designs)
- Professional features (white-label export, client management)

**Shareable URLs**:
Current: `?lat=X&lon=Y&tz=Z&name=N` encodes location.

Extend: Add `plan` param with compressed plan state, or a plan ID if we add server storage.

For V1, keep it simple: URL shares location, localStorage has the plan. If user shares URL, recipient sees the location but starts fresh on their device. This matches the "you own your data" philosophy—plans live on your device until you explicitly export.

**Conflict handling**: If user returns to a location with existing saved data, show "Continue previous plan?" prompt with options to continue or start fresh.

---

## Findings

### Current State Assessment

The technical foundation is strong: sun calculations, shadow modeling, tree placement, heatmaps, and plant recommendations all exist. But the UI is organized as a dashboard (everything visible at once) rather than a guided flow toward an outcome. The results page tries to serve exploration and plan creation simultaneously, serving neither well.

### The 15-Minute Flow Requires Four Phases

1. **Site Setup**: Location, trees, observation point
2. **Sun Analysis**: Heatmap, period selection, spot inspection
3. **Plant Selection**: Zone marking, candidate browsing, plant adding
4. **Plan Export**: Review, generate PDF, share

Each phase has distinct UI needs. Trying to show all four simultaneously creates overwhelm.

### Key UI Gaps

The biggest missing pieces are:
- Zone marking (how users define planting beds)
- Zone-aware plant selection (candidates per zone, not whole property)
- Plan builder canvas (overhead view with placed plants)
- PDF export (the tangible deliverable)

Secondary gaps:
- Guided flow navigation (progress indicator, phase transitions)
- Mobile-optimized layout (bottom sheet pattern for iPad)

### Professional Plan Format

Landscape professionals expect: overhead view at scale, plant schedule table (common name, botanical name, quantity, size, spacing), zone labels, and north arrow. The PDF should be printable and readable in grayscale.

### iPad is Primary Device

Lisa uses an iPad on-site. This means:
- Touch-first design (44pt minimum tap targets)
- Portrait orientation for walking property
- Bottom sheet pattern for panels
- High contrast for outdoor readability
- Client-side everything (PDF generation, plant database)

---

## Recommendations

### R1: Restructure as Phased Single-Page App

Keep the map as persistent canvas. Phases manifest as panels (bottom sheet on mobile, sidebar on desktop) that change based on current step. Add horizontal progress indicator: Site → Analysis → Plants → Plan.

### R2: Implement Zone Marking with Rectangles

Start simple: tap-drag to draw rectangular zones. Each zone gets an auto-calculated light category from the heatmap. Polygon/freeform zones can come later.

### R3: Build Zone-Aware Plant Selection

When entering plant phase, each zone becomes a section. Show validated candidates per zone based on its sun exposure. Card grid with photos, filter chips for preferences (native, edible, low-water).

### R4: Create Plan Builder Canvas

Separate "Map" and "Plan" modes. Plan mode shows simplified overhead with zones and plants as scaled circles. Validate spacing, show warnings for overlaps.

### R5: Implement PDF Export

Use jsPDF or pdfmake for client-side generation. Cover page, overhead plan, plant schedule table, growing notes. Professional format matching industry standards.

### R6: Optimize for iPad

Bottom sheet pattern for phase panels. Large touch targets. High contrast colors. Portrait-first layout. Test on actual iPad.

### R7: Extend localStorage Persistence

Store zones, selected plants, positions, and current phase. Enable "Continue previous plan?" on return. Keep shareable URLs simple (location only) for V1.

---

## Implementation Priority

1. **Phase navigation UI** — the skeleton that everything else hangs on
2. **Zone marking** — enables zone-aware plant selection
3. **Plant selection refactor** — zone-aware, card grid, filtering
4. **Plan canvas** — visualize the plan being built
5. **PDF export** — the tangible deliverable
6. **Polish** — iPad optimization, persistence, edge cases

This sequence allows incremental delivery: each phase adds user value and can be tested independently.
