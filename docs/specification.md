# Solar-Sim Specification

> **Status**: Draft
> **Last Updated**: 2026-01-31
> **Phase**: Active Development

This is a living specification document. It will evolve as research findings inform pragmatic solutions. For hardened requirements, see `knowledge/requirements/`.

---

## 1. Overview

### 1.1 Purpose

Solar-Sim is a sales enablement tool for saying "yes" to a planting plan. It generates professional-quality landscape planting plans backed by site-specific sun analysis and validated plant selection, giving users confidence that their plan will actually work.

The sun mapping is the credibility layer. The plant intelligence is the value. The exportable plan you own is the product.

### 1.2 Core Problem

No one has built a sun map for the residential and small property use case. Existing tools are either too simple (hardiness zones with no spatial resolution), too complex (professional landscape architecture software), or aimed at the wrong audience (solar panel installers optimizing roof placement).

The gap in the market is the missing role of someone who audits and validates that a landscape design actually works for a specific lot. Good designers do this implicitly, but it's not systematized, and most skip it because cross-referencing regional plant knowledge with site-specific sun profiles is tedious. The Sunset Western Garden book is 768 pages. Checking climate zones, sun exposure, soil type, water requirements, mature size, and bloom timing for 20 candidate plants across 5 planting areas is a full day of work. Software makes it instant.

### 1.3 Product Thesis

**For homeowners**: Get the plant research a good designer would do, before you hire one—or instead of hiring one.

**For designers**: Skip the validation tedium, start with plants that actually work, focus on aesthetics.

**For landscapers**: Clear specs, no ambiguity, fewer callbacks when plants die.

### 1.4 Target Users

Every user is trying to reach the same endpoint: confidence that a plan will work. They arrive from different directions.

| User Type | Question They're Answering |
|-----------|---------------------------|
| Homeowner / DIY gardener | "Can I do this myself? Will it work?" |
| Landscape designer | "Will this design actually work for this site?" |
| Landscaper admin / sales | "Can I close this lead today with a credible proposal?" |
| Landscaper crew | "Do I have clear specs to execute?" |
| Nursery staff | "What should I recommend for their specific site?" |
| Permaculture practitioner | "How do I design food forests and guilds for this microclimate?" |

### 1.5 The Landscaper Power Couple

A concrete persona that captures the business value: the husband-wife landscaper team where he runs the crew and does installs, while she handles admin, scheduling, and client communication. Currently she can't do initial consultations because she doesn't have 20 years of plant knowledge. With Solar-Sim, she can meet with a homeowner, pull up their address, walk the property with an iPad, generate a plant palette on-site, and print a take-home plan that evening. She becomes a demand generation engine. Initial consults that required the expert can now be handled by the admin, freeing him to stay on job sites. For a designer doing 20 projects a year, 3 hours saved per project is 60 hours recovered—enough to take on 2-3 more projects annually.

### 1.6 Data Ownership

A critical differentiator is that users own their data. Many people avoid planning tools because they don't want to be locked into a platform or subscription. "If you're going to take my data about my property, I own it—I don't want to be stuck when your weird app goes down." Solar-Sim addresses this directly: export everything, we don't hold your garden hostage. The plan is yours to print, share, or hand to any landscaper.

---

## 2. Value Stack

The product delivers value in layers, each building on the one below.

**Layer 1: Sun Mapping (the hook)** — Credible site analysis that earns trust. Free, instant, proves we know what we're talking about.

**Layer 2: Plant Intelligence (the moat)** — Data-driven suggestions validated against regional knowledge (starting with Sunset Western Garden zones). Cross-reference sun requirements, water needs, mature size, bloom timing. This is genuinely hard to replicate, which makes it defensible.

**Layer 3: Plan Generation (the product)** — Professional-quality planting plan you own. Overhead view, plant schedule, spacing notes. Exportable PDF that works for DIY, designers, or landscaper crews.

**Layer 4: Marketplace (future)** — Connect with landscapers, source plants from local nurseries, find rare specimens. The plan becomes a coordination layer between homeowner, landscaper, and supplier.

---

## 3. Technology Stack

### 3.1 Core Stack

| Layer | Technology | Rationale |
|-------|------------|-----------|
| Framework | SvelteKit | Fast, lightweight, good DX |
| Deployment | Cloudflare Workers | Edge deployment, low latency globally |
| Computation | Client-side | Reduces server load, enables offline potential |
| Maps | Leaflet + ShadeMap | Real terrain/building shadows, tree placement |
| Plant Data | Sunset Western Garden | Regional authority, comprehensive coverage |

### 3.2 Constraints

- **Bundle size**: Must remain edge-deployable (Workers have size limits)
- **No heavy backend**: Computation should be client-feasible
- **Offline-friendly**: Core calculations should work without network
- **Mobile-ready**: Must work on iPad for on-site consultations

---

## 4. Core Features

### 4.1 Site Analysis (Layer 1)

The foundation: understand the sun profile for a specific property.

**Location input** supports address search, interactive map selection, coordinate entry, and browser geolocation. The system auto-detects timezone and validates coordinates.

**Sun mapping** calculates sun position (altitude, azimuth) for any time using NOAA-based algorithms. It integrates solar altitude over daylight hours to compute daily sun hours, then aggregates across date ranges for seasonal analysis.

**Shadow modeling** combines multiple sources: ShadeMap API provides precomputed shadows from terrain and buildings, while the app calculates shadows from user-placed trees in real-time. The result is a composite view of actual sun exposure accounting for real-world obstructions.

**Light categories** translate sun hours into horticultural standards: Full Sun (6+ hours), Part Sun (4-6 hours), Part Shade (2-4 hours), and Full Shade (<2 hours).

### 4.2 Plant Intelligence (Layer 2)

The moat: validated plant suggestions based on site conditions.

**Regional plant database** starts with Sunset Western Garden as the authoritative source for western US. Each plant entry includes climate zone compatibility, sun/water/soil requirements, mature size, and bloom timing.

**Candidate generation** inverts the typical design process. Instead of "design first, hope it works," the system generates plants that would actually work for each zone of the property, filtered by user preferences (native, edible, low-maintenance, deer-resistant, etc.).

**Validation engine** cross-references multiple constraints: Sunset climate zone, sun exposure per bed, water requirements, spacing needs, and seasonal interest. What takes a designer hours to research manually becomes instant.

### 4.3 Plan Generation (Layer 3)

The product: a professional planting plan you own.

**Plan builder** presents an overhead view where users drag validated plants onto their property. The system checks spacing and compatibility as they work.

**Output formats** include a visual overhead plan, a plant schedule with quantities and sizes, spacing notes, and a PDF export. The plan works equally well for DIY installation, handing to a designer for refinement, or giving to a landscaper crew for execution.

**Data portability** is non-negotiable. Users can export everything at any time. No account required for basic functionality. The plan is theirs.

### 4.4 Visualization Modes

Multiple views serve different purposes in building confidence:

**Map view** (Leaflet + ShadeMap) shows the property with real terrain shadows and tree placements. This is the primary workspace for site analysis.

**Heatmap overlay** shows cumulative sun exposure across the growing season as a color gradient. This is the "aha moment" that reveals where to plant what.

**Isometric view** provides a 3D preview of how the landscape will look with shadows. This is the "wow factor" for client presentations.

**Plan view** is the standard overhead layout that landscapers expect. This is the deliverable.

---

## 5. Architecture

### 5.1 Data Flow

The core flow moves from site analysis to validated candidates to plan output:

```
Location Input → Sun Analysis → Shadow Modeling → Zone Classification
                                                          ↓
Plant Database → Candidate Generation → User Filtering → Plan Builder
                                                          ↓
                                              Exportable Plan (PDF, data)
```

### 5.2 Module Structure

```
src/lib/
├── solar/        # Sun position, hours calculation, shadow projection
├── geo/          # Coordinates, timezone, geocoding
├── climate/      # Frost dates, hardiness zones, Köppen classification
├── plants/       # Plant database, recommendation engine
├── canopy/       # Tree detection from Meta canopy height data
├── storage/      # localStorage persistence per location
└── components/   # UI components (MapPicker, PlotEditor, etc.)
```

---

## 6. Knowledge Layer

### 6.1 Plant Data Sources

The primary source for plant intelligence is the Sunset Western Garden Book, which provides comprehensive coverage of plants suitable for western US climates organized by Sunset climate zones (more granular than USDA hardiness zones).

Each plant entry in our database should capture: botanical name, common names, Sunset zones, sun requirement (full sun / part sun / part shade / full shade), water needs, mature height and width, bloom season, and growth habit. Additional metadata like native status, deer resistance, and drought tolerance enables filtering by user preferences.

### 6.2 Regional Expansion

The initial release focuses on Sunset Western Garden coverage. Future expansion could incorporate regional authorities for other areas: the Southeastern Gardening books for the US Southeast, native plant databases for ecological landscaping, and local extension service recommendations.

### 6.3 Nursery Integration (Future)

Layer 4 of the value stack involves connecting validated plant candidates with actual availability. This is complex because nursery inventory is fragmented (thousands of local nurseries, no universal database, stock changes weekly) and rare specimens are hidden in specialty growers. The plan-as-coordination-layer vision depends on eventually cracking this problem.

---

## 7. Open Questions

### 7.1 Plant Data

- [ ] What's the most efficient way to encode Sunset Western Garden data?
- [ ] How do we handle plants that span multiple light categories (e.g., "full sun to part shade")?
- [ ] What filtering dimensions matter most to users (native, edible, low-w ater, deer-resistant)?

### 7.2 Plan Output

- [ ] What does the ideal PDF export look like for different audiences (DIY vs. landscaper)?
- [ ] Should plans include plant sourcing suggestions or stay source-agnostic?
- [ ] How do we handle plant substitutions when first-choice isn't available?

### 7.3 Business Model

- [ ] Where does free end and paid begin?
- [ ] Is the primary revenue from consumers, designers, or a marketplace cut?
- [ ] How do we price for the landscaper-admin persona who uses it for sales enablement?

---

## 8. References

### 8.1 Plant Intelligence

- Sunset Western Garden Book (9th edition) - primary plant database source
- Sunset Climate Zones - more granular than USDA, accounts for microclimates

### 8.2 Solar Calculation

- NOAA Solar Calculator algorithms
- SunCalc library for sun position
- ShadeMap API for terrain/building shadows

### 8.3 Related Projects

The competitive landscape includes generic sun calculators (too simple), professional landscape CAD (too complex), and solar panel site analysis (wrong audience). The residential gardening niche with site-specific validated plant suggestions is underserved.

---

## Appendix A: Glossary

| Term | Definition |
|------|------------|
| **Altitude** | Angle of sun above the horizon (0° = horizon, 90° = zenith) |
| **Azimuth** | Compass direction of the sun (0° = North, 90° = East, etc.) |
| **Solar noon** | Time when sun reaches highest point (crosses meridian) |
| **Declination** | Sun's angle relative to Earth's equatorial plane |
| **Sun hours** | Cumulative time with direct sunlight (altitude > 0°) |

---

## Appendix B: Changelog

| Date | Change | Author |
|------|--------|--------|
| 2026-01-31 | Major revision: reframed as sales enablement tool, added value stack, updated target users and personas, restructured features around layers | Agent |
| 2026-01-27 | Initial draft created | Agent |
