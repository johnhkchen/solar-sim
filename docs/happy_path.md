# Solar-Sim Happy Path

> **Status**: Draft
> **Last Updated**: 2026-01-31

This document describes the core user experience we're building toward. The goal is a 15-minute flow from address to exportable planting plan—the experience that saves a designer 3 hours per project or gives a homeowner professional-grade analysis they couldn't otherwise access.

---

## 1. The Core Insight

Solar-Sim is a sales enablement tool for saying "yes" to a planting plan. Every user—homeowner, designer, landscaper—is trying to reach the same endpoint: confidence that their plan will actually work. The UI optimizes for speed to confidence and shareable proof.

---

## 2. Primary Personas

### 2.1 Lisa: Landscaper Admin

**Profile**: Lisa runs the business side of a landscaping company with her husband Mike. He has 20 years of plant knowledge and runs the crew. She handles scheduling, invoicing, and client communication. The bottleneck is that initial consultations require Mike's expertise, which takes him off job sites.

**Pain point**: Lisa could grow the business by doing more consultations, but she can't confidently answer "what should I plant here?" without Mike present.

**With Solar-Sim**: Lisa meets a homeowner, pulls up their address on her iPad, walks the property marking planting beds, and generates a plant palette on-site. She prints a take-home plan that evening. Mike reviews, approves, and schedules the install. Lisa just became a demand generation engine.

### 2.2 Maria: DIY Homeowner

**Profile**: Home gardener in Portland planning a vegetable garden. She knows tomatoes need "full sun" but doesn't know if her backyard actually gets 6+ hours of direct sunlight.

**Pain point**: The research required to validate a planting plan is overwhelming. She could hire a designer, but wants to know what she needs before spending money.

**With Solar-Sim**: Maria gets the analysis a good designer would do. She sees exactly which beds are full sun vs part shade, gets validated plant suggestions, and exports a plan she can execute herself or hand to a landscaper with confidence.

### 2.3 David: Landscape Designer

**Profile**: Runs a small design practice, 20 projects per year. Good aesthetic sense but plant validation is tedious—cross-referencing Sunset zones, sun exposure, water needs, and spacing for each bed takes hours.

**Pain point**: He tends to plant what he knows works rather than optimizing for each site, because proper validation takes too long.

**With Solar-Sim**: David starts with validated candidates instead of a blank canvas. The tedious research is done. He focuses on aesthetics, knowing every plant suggestion actually works for that specific site. Saves 3 hours per project, which adds up to 60 hours per year—enough capacity for 2-3 more projects.

### 2.4 The Permaculture Practitioner

**Profile**: Designing food forests and polyculture systems. Needs detailed microclimate understanding for guild planting—which spots get morning sun vs afternoon sun, where frost pockets form, how shadows shift seasonally.

**Pain point**: Has been doing this manually with shadow stakes and notebooks for years. Software tools are either too simplistic or designed for conventional landscaping.

**With Solar-Sim**: Gets the spatial sun analysis they've always wanted, with the seasonal heatmap revealing patterns that would take a full year of observation to discover manually.

---

## 3. The 15-Minute Experience

This is the core flow that saves hours of manual research. Using Lisa (landscaper admin) as the example since she represents the highest-frequency use case.

### Phase 1: Site Setup (Minutes 1-3)

Lisa opens Solar-Sim on her iPad while standing in the client's front yard. She enters the address—autocomplete confirms the location and timezone. The map loads showing the property with ShadeMap's terrain shadows already visible. She can see the neighbor's two-story house casts afternoon shade on the west bed.

She taps to place an observation point near the front door, then adjusts the property boundary. The app auto-detects two large trees from satellite canopy data and asks if she wants to include them. She confirms, then adds a third tree the satellite missed by tapping the map.

### Phase 2: Sun Analysis (Minutes 3-6)

Lisa selects "Growing Season" from the period dropdown—the app knows Portland's frost dates and sets April through October automatically. The heatmap renders across the property: orange-red for the full-sun south-facing beds, yellow for the part-sun areas along the fence, and blue-green for the shaded north corner.

She taps on different spots to see the numbers. The south bed gets 7.2 hours average. The side yard gets 4.8 hours. The north corner gets 2.1 hours. The client says "I always wondered why my tomatoes struggled over there"—pointing at the north corner. Lisa shows them the heatmap. That's the credibility moment.

### Phase 3: Plant Selection (Minutes 6-12)

Lisa moves to the plan builder. The property is divided into the zones she marked. For each zone, the app shows validated candidates based on: Sunset zone 6 (Portland), the zone's sun exposure, and the client's stated preferences (low water, deer resistant, some edibles).

For the full-sun south bed: lavender, rosemary, tomatoes, peppers, salvia, echinacea—all confirmed to work. For the part-sun side yard: lettuce, kale, ferns, bleeding heart, coral bells. For the shady north corner: hostas, Japanese forest grass, wild ginger, sword fern.

Lisa and the client scroll through options together, tapping to add plants to the plan. The app shows mature size and spacing, flagging if things are too crowded. The client gets excited about the possibilities—"I didn't know we could grow this here."

### Phase 4: Plan Export (Minutes 12-15)

Lisa taps "Generate Plan." The app produces an overhead view with plants placed, a schedule listing each plant with quantities and sizes, and growing notes. She emails the PDF to the client on the spot.

"We'll review this with Mike and follow up with a formal quote by Thursday." The client has something tangible to show their spouse. Lisa has a warm lead with specifics. Mike has clear specs when it's time to install.

Total time: 15 minutes. Value: the research that would take 3+ hours is done, the client is excited, and the close rate just went up.

---

## 4. Key Moments

### 4.1 The Credibility Moment

When Lisa shows the client the heatmap and explains why their tomatoes struggled in the north corner, she establishes trust. The tool knows something the client suspected but couldn't prove. This is the moment that earns the right to make recommendations.

### 4.2 The "Aha" Moment

The seasonal heatmap reveals patterns that would take a year of observation to discover. "I didn't realize the oak tree shades half my yard by August." This is the insight that makes the tool feel valuable, not just convenient.

### 4.3 The Excitement Moment

When the client sees validated options for each zone and realizes what's possible—"I didn't know we could grow this here"—that's when they mentally commit to the project. The tool created demand, not just captured it.

### 4.4 The Handoff Moment

The exported PDF is tangible proof of a productive meeting. The client can show their spouse. Lisa can send a follow-up quote with specifics. Mike has clear specs for installation. The plan coordinates everyone without Lisa having to remember or retype anything.

---

## 5. What Makes This Work

### 5.1 Data Layers

Three data sources combine to produce accurate, actionable results:

**Solar geometry** calculates sun position for any location and time using NOAA algorithms. This drives the theoretical maximum sun hours for each spot.

**Shadow modeling** combines ShadeMap (precomputed terrain and building shadows from LiDAR data) with real-time tree shadow calculations. This reduces theoretical hours to actual hours accounting for obstructions.

**Plant knowledge** from Sunset Western Garden provides regional authority on what grows where. Sunset zones are more granular than USDA hardiness zones, accounting for coastal influence, elevation, and microclimates.

### 5.2 Horticultural Categories

Standard light categories translate sun hours into planting decisions:

| Category | Hours | What It Means |
|----------|-------|---------------|
| Full Sun | 6+ hours | Most vegetables, sun-loving perennials |
| Part Sun | 4-6 hours | Leafy greens, many herbs, woodland edge plants |
| Part Shade | 2-4 hours | Shade-tolerant perennials, ferns |
| Full Shade | <2 hours | Hostas, mosses, deep woodland plants |

These thresholds are well-established in horticultural literature and form the bridge between astronomical calculation and practical gardening advice.

---

## 6. Success Criteria

The happy path succeeds when:

1. **Speed to confidence**: User goes from address to exportable plan in under 15 minutes
2. **Credibility**: Sun analysis matches what users observe on their property
3. **Actionable output**: The plan is specific enough to hand to a landscaper or execute DIY
4. **Data ownership**: Everything exports, no lock-in, no required account
5. **Mobile-ready**: Works on iPad for on-site consultations

---

## 7. What's NOT in V1

To keep scope focused on the core value proposition:

| Feature | Why Deferred |
|---------|--------------|
| User accounts | Unnecessary for core value, adds friction |
| Nursery integration | Complex data problem, future layer |
| Landscaper marketplace | Requires critical mass of users first |
| Historical weather data | Different problem domain |
| Real-time cloud cover | Adds complexity without proportional value |

---

## 8. Differentiation

The competitive landscape has gaps at both ends: generic sun calculators are too simple (no spatial resolution, no plant intelligence) while professional landscape CAD is too complex (requires training, expensive). The residential gardening niche with site-specific validated plant suggestions is underserved.

Solar-Sim focuses on the **business outcome**: saying yes to a planting plan. We don't expose unnecessary complexity. We don't require expertise to operate. We give answers in plant terms, not degrees and radians. The output is a professional artifact that coordinates homeowner, designer, and landscaper without anyone being locked into our platform.

---

## Changelog

| Date | Change | Author |
|------|--------|--------|
| 2026-01-31 | Major revision: reframed around sales enablement, updated personas, rewrote flow for plan generation | Agent |
| 2026-01-27 | Initial draft | Agent |
