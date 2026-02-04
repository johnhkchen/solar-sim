# 3D Rendering Approach Evaluation

This research evaluates whether Solar-Sim should continue with its current SVG-based pseudo-3D approach or pivot to a dedicated 3D engine like Bevy (Rust/WASM), Three.js, or Babylon.js.

## Executive Summary

**Recommendation: Stay the current course with SVG-based rendering.**

The current implementation is well-architected and appropriate for Solar-Sim's actual use case. The perceived "limitation" is actually a scope creep concern rather than a technical inadequacy. Solar-Sim's value proposition is accurate shadow calculations for gardening decisions, not photorealistic 3D visualization. The existing SVG approach delivers this effectively.

## What We Actually Built

The codebase contains sophisticated solar engineering math that would be required regardless of rendering technology. The shadow-projection.ts module implements proper ray-tracing physics with 3D silhouette projection, slope-adjusted ground plane intersection, and per-obstacle-type shadow geometry (trees, buildings, fences). The IsometricView.svelte component at 912 lines provides isometric projection, view rotation, zoom/pan, and visual depth through layering.

The shadow calculations are physics-accurate: they trace rays from obstacle silhouette points through 3D space to compute ground intersection. This is the same mathematical approach a 3D engine would use internally, we just render the results as 2D polygons rather than as GPU-lit meshes.

## The Real Question

The question isn't "can SVG handle 3D rendering" but rather "does Solar-Sim need photorealistic real-time lighting?" The answer depends on the core user story.

From happy_path.md, the user Maria wants to know: "does my backyard get 6+ hours of sun for tomatoes?" She doesn't need to see realistic tree bark textures or dynamic ambient occlusion. She needs to understand where shadows fall during the growing season.

The current isometric view with shadow polygons communicates this effectively. Users can see which areas are shaded at different times, animate through a day, and understand spatial relationships. That's the functional requirement.

## Bevy/WASM Evaluation

Bevy is a Rust-based game engine with WASM support. Switching to Bevy would mean:

**Costs:**
- Complete rewrite of visualization layer (the 912-line IsometricView plus PlotEditor)
- Learning curve for Rust/ECS architecture
- Bundle size increases from ~200KB to 15-30MB (after optimization)
- Loss of SvelteKit integration benefits (SSR, hydration, existing component ecosystem)
- Multithreading not supported in WASM (Bevy's main performance advantage lost)
- Development velocity drops significantly (Rust compile times, debugging complexity)

**Gains:**
- GPU-accelerated rendering (not needed for our polygon counts)
- Built-in lighting/shadow system (we already have accurate shadow math)
- Potentially more "impressive" visuals (not aligned with product goals)

The math for shadow calculation would stay the same regardless of renderer. Bevy's shadow maps don't compute agricultural sun-hours, they just make polygons look prettier. We'd still need all of slope.ts, shadow-projection.ts, and the solar engine.

## Three.js / Babylon.js Evaluation

These JavaScript 3D libraries are more practical than Bevy for web apps. There's even an existing [threejs-sunlight](https://github.com/antarktikali/threejs-sunlight) module that positions a directional light based on real sun position.

**Costs:**
- Significant rewrite of visualization components
- WebGL context management complexity
- Mobile GPU power consumption
- Debugging 3D scenes is harder than SVG inspection

**Gains:**
- Real-time shadows via shadow maps
- Could render imported 3D house models
- More "game-like" appearance

The key insight is that Three.js/Babylon shadows are for visual effect, not measurement. Shadow maps approximate shadows for visual appeal but don't give you the precise "is this point shaded at 2:47 PM?" answer that our ray-tracing approach provides. We'd need to keep our calculation engine anyway and just use the 3D library for display.

## Why "Looking Outside" Isn't the Competition

The concern about "reinventing what you can do by looking outside" misframes the value proposition. Looking outside tells you about right now. Solar-Sim tells you about:

- How shadows change across the day (time scrubber)
- How shadows change across seasons (growing season integration)
- The cumulative effect on sun hours (what actually matters for plants)
- Quantified light categories (full sun vs part shade)

A person standing in their yard at 2 PM in January can't see what that spot looks like at 10 AM in July. That's the value Solar-Sim provides, and it doesn't require photorealistic rendering.

## Where We Actually Are

Looking at the roadmap, we're in Phase 11 (Full App Integration). The isometric view exists and works. Shadow animation exists and works. The remaining work is integration: connecting PlotViewer to the results page, persisting data, and mobile optimization. These are all achievable with the current architecture.

The perceived "slowdown" isn't from SVG limitations. It's from the inherent complexity of building a complete application. Switching renderers would reset progress significantly while providing no measurable improvement to user outcomes.

## If We Really Wanted 3D

If future scope truly required 3D (e.g., importing actual house models, VR garden planning), the pragmatic path would be:

1. Use Three.js (not Bevy) for JavaScript ecosystem compatibility
2. Keep existing solar/shadow calculation engine unchanged
3. Render shadow polygons as 3D meshes on a ground plane
4. Use Three.js only for visualization, not calculation

But this should be a separate story/phase with clear user value justification, not a mid-integration pivot.

## Technical Observations

The current codebase demonstrates solid engineering:

- **shadow-projection.ts** uses ray-ground intersection with sloped terrain support
- **IsometricView.svelte** properly handles depth sorting, view rotation, and coordinate transforms
- **127 tests** validate the solar calculation engine
- **Clean separation** between calculation (lib/solar/) and display (components/)

This architecture would survive a renderer change. The math is in TypeScript libraries, not coupled to SVG.

## Recommendation

Continue with current approach:

1. Complete S-019 (Full App Integration) with existing components
2. Ship the integrated product and gather user feedback
3. If users specifically request "better 3D visualization," evaluate Three.js integration as a future phase
4. Don't preemptively optimize for a problem users haven't reported

The SVG isometric view may not be "a 3D engine" but it communicates shadow positions effectively, loads instantly, works on all devices, and lets users accomplish their actual goal: understanding where to plant things.

## Competitive Landscape

A search for existing solutions reveals several products in this space, but none occupy Solar-Sim's intended niche.

**[Shadowmap](https://shadowmap.org/)** is the most feature-rich competitor with 3D real-time shadow simulation, 365-day sunlight analysis, and solar irradiance metrics. However, it has no free tier (requires in-app purchases for useful features), lacks gardening-specific guidance, and only has detailed tree data for three European cities (Vienna, Madrid, Paris). It's oriented toward architects and real estate rather than home gardeners.

**[ShadeMap](https://shademap.app/)** pulls building footprints and heights from OpenStreetMap to generate shadow simulations. This is clever, and we could adopt the same approach for obstacle auto-population. But ShadeMap is a visualization tool without horticultural interpretation—it shows shadows, not planting guidance.

**[Sunio](https://apps.apple.com/us/app/sunio-sun-tracker-3d-shadow/id6753144445)** offers AR sun path visualization and time scrubbing, but it's a generic sun tracking tool. No growing season analysis, no plant recommendations, no answers to gardener questions like "when should I start seeds?" or "when is transplanting safe?"

**[ShadowCalculator](https://shadowcalculator.eu/)** appears to be a dead/unmaintained project.

### Solar-Sim's Differentiation

Solar-Sim's value lies in the layers these tools don't provide:

1. **Horticultural translation**: Converting sun-hours to plant categories (full sun, part shade) with specific crop recommendations
2. **Growing season focus**: Analyzing the months that matter for gardening, not just arbitrary dates
3. **Seasonal patterns**: Showing how light changes across the year, identifying optimal planting windows
4. **Zero friction**: Free, runs on user's device, no account required, instant results
5. **Gardener's questions answered**: "What can I grow here?" not just "where do shadows fall?"

The competitors visualize shadows. Solar-Sim answers gardening questions. The isometric view and shadow projection are means to that end, not the product itself.

### Potential Enhancement: OSM Building Data

ShadeMap's approach of pulling building footprints from OpenStreetMap is worth adopting. Rather than requiring users to manually place every obstacle, we could auto-populate known structures and let users refine. This is a feature enhancement, not a renderer change.

### Revised Strategy: ShadeMap Integration

After further analysis, we identified that [ShadeMap](https://shademap.app/) offers a free Educational tier for academic/hobby projects. The [leaflet-shadow-simulator](https://github.com/ted-piotrowski/leaflet-shadow-simulator) library provides terrain + building shadows using real DEM and OSM data.

The integration approach (see S-020):
1. Use ShadeMap API for terrain and building shadows (free Educational tier)
2. Keep our tree/obstacle placement system (ShadeMap doesn't handle trees)
3. Keep our horticultural layer (the differentiation)
4. Keep isometric view as optional visualization

Path dependence is low. If we outgrow the free tier, we either pay $40/month (commercial) or self-host using AWS Terrarium DEM tiles and OSM Overpass—both freely available data sources. The ShadeMap layer is a swappable component, not a lock-in.

## References

- [Bevy WASM Documentation](https://bevy-cheatbook.github.io/platforms/wasm.html)
- [Three.js vs Babylon.js Comparison](https://blog.logrocket.com/three-js-vs-babylon-js/)
- [threejs-sunlight module](https://github.com/antarktikali/threejs-sunlight)
- [Bevy in 2025](https://medium.com/solo-devs/bevy-in-2025-rusts-game-engine-taking-over-indie-dev-caec2ae50c09)
- [Bevy Solari - Raytraced Lighting](https://jms55.github.io/posts/2025-09-20-solari-bevy-0-17/)
- [Shadowmap](https://shadowmap.org/)
- [ShadeMap](https://shademap.app/)
- [Sunio App](https://apps.apple.com/us/app/sunio-sun-tracker-3d-shadow/id6753144445)
