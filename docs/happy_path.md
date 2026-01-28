# Solar-Sim Happy Path

> **Status**: Draft
> **Last Updated**: 2026-01-27

This document describes the core user experience we're building toward—a 5-minute "happy demo" that demonstrates Solar-Sim's value proposition.

---

## 1. The Demo Scenario

### 1.1 Sample User: Maria

**Profile**:
- Home gardener in Portland, Oregon (45.5°N latitude)
- Planning a vegetable garden in her backyard
- Wants to know where to plant tomatoes (full sun) vs. lettuce (part shade)
- Has no background in astronomy or solar calculations

**Pain point**: Maria knows tomatoes need "full sun" but doesn't know if her backyard actually gets 6+ hours of direct sunlight, or how that changes across the growing season.

### 1.2 The 5-Minute Experience

#### Minute 0-1: Arrival & Location

1. Maria opens Solar-Sim in her browser
2. She sees a clean interface with a prominent location input
3. She types "Portland, OR" and selects from autocomplete
4. The app confirms: **"Portland, Oregon (45.5152° N, 122.6784° W)"**
5. A timezone is auto-detected: **Pacific Time**

**What's happening technically**:
- Geocoding service converts address to coordinates
- Timezone inference from coordinates
- UI provides immediate feedback on location recognition

#### Minute 1-2: Understanding the View

1. The main display loads showing today's sun data
2. Maria sees:
   - **Sun hours today**: 8.2 hours
   - **Category**: Full Sun ☀️
   - **Sunrise/Sunset**: 6:45 AM / 8:12 PM
3. A simple sun path arc shows the sun's trajectory across the sky
4. Current sun position is highlighted on the arc

**What's happening technically**:
- Solar position calculations for current date/location
- Integration of sun altitude over daylight hours
- Classification against horticultural categories

#### Minute 2-3: Exploring the Season

1. Maria notices a date selector and calendar view
2. She clicks to expand a **seasonal overview**
3. A heatmap shows sun hours across the year:
   - Summer: 14+ hours
   - Winter: 8-9 hours
   - Growing season (Apr-Oct) highlighted
4. She sees the **growing season average**: 11.3 hours/day

**What's happening technically**:
- Batch calculation of sun hours across date range
- Aggregation and visualization of seasonal patterns
- Identification of relevant growing season window

#### Minute 3-4: Getting Actionable Advice

1. Maria scrolls to the **recommendations section**
2. She sees:
   ```
   Your location receives FULL SUN during the growing season.

   Suitable for:
   ✓ Tomatoes, peppers, squash
   ✓ Most vegetables and herbs
   ✓ Sun-loving flowers (marigolds, zinnias)

   Note: In summer, afternoon shade may benefit heat-sensitive
   crops like lettuce. Consider east-facing areas for these.
   ```
3. A comparison table shows sun hours by season with plant suggestions

**What's happening technically**:
- Category classification based on growing season average
- Rule-based recommendation engine matching categories to plants
- Contextual notes based on latitude and seasonal extremes

#### Minute 4-5: Saving & Sharing

1. Maria clicks **"Save this analysis"**
2. She gets a shareable URL with her location encoded
3. She bookmarks it for reference when planting season arrives
4. Optionally, she exports a simple PDF summary

**What's happening technically**:
- URL state encoding (location in query params or hash)
- Client-side PDF generation (optional, may be v2)
- No account required - stateless sharing

---

## 2. Key Moments of Delight

### 2.1 Instant Gratification
The user gets meaningful data within seconds of entering a location. No configuration, no sign-up, no waiting.

### 2.2 The "Aha" Moment
Seeing the seasonal heatmap reveals patterns the user never consciously knew—how dramatically sun exposure changes through the year at their latitude.

### 2.3 Actionable, Not Academic
Instead of raw numbers, the user gets planting guidance. We translate astronomy into gardening decisions.

---

## 3. What Makes This Work

### 3.1 Solar System Simulation

The app includes accurate solar position calculations that capture:

| Factor | Implementation |
|--------|----------------|
| Earth's axial tilt (23.4°) | Drives seasonal variation |
| Earth's orbital position | Affects sun-Earth distance, day length |
| Latitude effects | Higher latitudes = more extreme seasons |
| Time of day | Sun altitude throughout the day |

The simulation doesn't need to model the full solar system—just Earth's orientation relative to the sun, which follows well-established astronomical formulas.

### 3.2 Algorithms Behind the Scenes

**Solar position** (for any location + time):
- Calculate solar declination (sun's latitude)
- Calculate hour angle (sun's position in daily arc)
- Derive altitude and azimuth from spherical trigonometry

**Sun hours integration**:
- Sample sun altitude at regular intervals through the day
- Count intervals where altitude > threshold (default 0°)
- Sum to get total sun hours

**Seasonal aggregation**:
- Repeat daily calculation across date range
- Compute averages, min, max for the period
- Identify patterns (solstices, equinoxes)

### 3.3 Horticultural Translation

Standard light categories are well-defined in gardening literature:

| Category | Hours | Our Threshold |
|----------|-------|---------------|
| Full Sun | 6+ hours direct sun | ≥6 hours |
| Part Sun | 4-6 hours | 4-5.99 hours |
| Part Shade | 2-4 hours | 2-3.99 hours |
| Full Shade | <2 hours | <2 hours |

We apply these thresholds to calculated sun hours to produce actionable categories.

---

## 4. Deployment Environment

### 4.1 Target Platform

| Aspect | Choice | Rationale |
|--------|--------|-----------|
| **Hosting** | Cloudflare Workers | Global edge deployment, fast cold starts |
| **Framework** | SvelteKit | Small bundles, good Workers support |
| **Rendering** | Hybrid SSR + CSR | Fast initial load, interactive calculations |

### 4.2 Performance Targets

| Metric | Target |
|--------|--------|
| Time to first meaningful paint | <1.5s |
| Time to interactive | <2.5s |
| Calculation latency | <100ms for single day |
| Bundle size | <200KB gzipped |

### 4.3 Browser Support

- Modern evergreen browsers (Chrome, Firefox, Safari, Edge)
- Mobile-responsive design
- No IE11 support

---

## 5. What's NOT in the Happy Path (v1)

To keep scope manageable, these are explicitly deferred:

| Feature | Reason for Deferral |
|---------|---------------------|
| Terrain/obstacle shadows | Requires elevation data or user input |
| Multi-location comparison | Adds complexity to UI |
| User accounts | Unnecessary for core value |
| Historical weather data | Different problem domain |
| Real-time cloud cover | Requires external API, changes scope |

---

## 6. Success Criteria

The happy path is successful when:

1. **Functional**: User can input location and receive accurate sun data
2. **Fast**: Results appear within 2 seconds of location input
3. **Understandable**: Non-technical users can interpret results
4. **Actionable**: User leaves knowing what to plant where
5. **Shareable**: Results can be bookmarked or shared

---

## 7. Background: Why This Matters

### 7.1 The Problem We're Solving

Calculating sun exposure requires:

1. **Astronomical knowledge**: Solar declination, hour angles, spherical trigonometry
2. **Geographic awareness**: Latitude effects, timezone handling
3. **Temporal integration**: Summing exposure over hours, days, seasons
4. **Domain translation**: Converting hours to gardening categories

Each of these is individually approachable but combining them correctly is error-prone. Existing tools are often:
- Too technical (raw astronomical data)
- Too simple (just sunrise/sunset)
- Paywalled or ad-heavy
- Desktop-only or poorly designed

### 7.2 Our Differentiation

Solar-Sim focuses on the **gardener's question**: "What can I grow here?"

We don't expose unnecessary complexity. We don't require accounts. We work on any device. We give answers in plant terms, not degrees and radians.

---

## 8. Open Questions for Research

> These need answers before implementation completes the happy path.

### 8.1 Location Input
- [ ] Which geocoding API fits Cloudflare Workers constraints?
- [ ] Should we support "use my location" GPS on mobile?

### 8.2 Calculation Accuracy
- [ ] What time interval for sun-hour integration balances accuracy and performance?
- [ ] Do we need atmospheric refraction correction for accuracy users expect?

### 8.3 Visualization
- [ ] What's the simplest effective visualization for sun path?
- [ ] Canvas vs SVG for the seasonal heatmap?

### 8.4 Recommendations
- [ ] What plant database/list should we include?
- [ ] How locale-specific should recommendations be?

---

## Appendix: User Flow Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                         LANDING PAGE                            │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │     🌻 Solar-Sim                                        │   │
│  │     Find out how much sun your garden gets              │   │
│  │                                                         │   │
│  │     [Enter location...........................] [Go]    │   │
│  │                                                         │   │
│  │     or [📍 Use my location]                             │   │
│  └─────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                        RESULTS PAGE                             │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  Portland, Oregon                          [Change]     │   │
│  │  45.52°N, 122.68°W · Pacific Time                       │   │
│  ├─────────────────────────────────────────────────────────┤   │
│  │                                                         │   │
│  │  TODAY (Jan 27)           GROWING SEASON (Apr-Oct)      │   │
│  │  ┌─────────────┐          ┌─────────────┐              │   │
│  │  │   8.2 hrs   │          │  11.3 hrs   │              │   │
│  │  │  Full Sun   │          │  Full Sun   │              │   │
│  │  └─────────────┘          └─────────────┘              │   │
│  │                                                         │   │
│  │  [Sun Path Diagram]                                     │   │
│  │       ╭─────────╮                                       │   │
│  │      ╱     ●     ╲    ← Sun position now                │   │
│  │     ╱             ╲                                     │   │
│  │  ──────────────────── Horizon                           │   │
│  │   E      S       W                                      │   │
│  │                                                         │   │
│  ├─────────────────────────────────────────────────────────┤   │
│  │  SEASONAL OVERVIEW                    [▼ Show calendar] │   │
│  │  ░░░░░▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓░░░░░                  │   │
│  │  Jan Feb Mar Apr May Jun Jul Aug Sep Oct Nov Dec        │   │
│  │                                                         │   │
│  ├─────────────────────────────────────────────────────────┤   │
│  │  RECOMMENDATIONS                                        │   │
│  │                                                         │   │
│  │  ✓ Tomatoes, peppers, squash                           │   │
│  │  ✓ Most vegetables and herbs                           │   │
│  │  ✓ Sun-loving flowers                                  │   │
│  │                                                         │   │
│  │  💡 In summer, afternoon shade benefits lettuce        │   │
│  │                                                         │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  [📤 Share] [📥 Export PDF]                                    │
└─────────────────────────────────────────────────────────────────┘
```

---

## Changelog

| Date | Change | Author |
|------|--------|--------|
| 2026-01-27 | Initial draft | Agent |
