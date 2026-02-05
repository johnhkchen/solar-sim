# ShadeMap Replacement Feasibility Study

This document assesses whether Solar-Sim can replace ShadeMap's functionality in-house, eliminating the $40/month commercial license fee while maintaining equivalent shadow simulation quality.

## Executive Summary

Replacing ShadeMap is **feasible but non-trivial**. We already have the hardest piece (tree shadows with proper silhouette projection), and the remaining components use freely available data. The primary challenge is building the terrain shadow raycasting, which requires GPU shader work. A phased approach allows us to progressively replace ShadeMap functionality while keeping the demo working.

**Estimated effort**: 3-4 weeks of focused development for basic terrain + building shadows, another 2-3 weeks for polish and optimization.

**Estimated data requirements**: ~5 GB for Bay Area coverage (already fits in our self-hosting budget).

**Recommendation**: Start Phase 1 (terrain shadows) while continuing to use ShadeMap for demos. Evaluate quality after terrain shadows work before committing to full replacement.

## What ShadeMap Provides

ShadeMap's core value is rendering shadows from three sources combined:

1. **Terrain shadows** - Hills and mountains blocking the sun, computed from Digital Elevation Model (DEM) tiles
2. **Building shadows** - 3D extruded OSM building footprints casting shadows
3. **Annual sun exposure** - Aggregated shadow accumulation over time ranges

The library uses WebGL shaders to raytrace shadows from DEM data in real-time, running entirely client-side after fetching tiles. The shadow calculation samples the terrain heightmap along the sun ray direction to detect occlusion.

### ShadeMap Limitations (Our Opportunity)

ShadeMap has notable gaps we already fill:

- **No tree shadows** - Their biggest weakness; trees dominate residential shade
- **OSM building height coverage is sparse** - Only 3% of OSM buildings globally have height data
- **No horticultural context** - Raw sun-hours without plant recommendations
- **No climate integration** - No frost dates, growing seasons, hardiness zones

## Our Existing Capabilities

We've already built significant shadow infrastructure:

### Tree Shadow Projection (`shadow-projection.ts`)
- Ray-traced silhouette projection for realistic tree shapes
- Handles deciduous/evergreen with different canopy profiles
- Slope-adjusted shadows on tilted terrain
- Geographic coordinate output for map overlay

### Sun Position Calculation (`position.ts`)
- Accurate solar position for any date/time/location
- Sunrise/sunset times, polar day/night handling
- Used throughout our existing shadow calculations

### Grid-Based Exposure (`exposure-grid.ts`)
- Samples sun hours across a geographic grid
- Async calculation with progress callbacks
- Already designed to integrate with external shadow sources

### Combined Sun Hours (`combined-sun-hours.ts`)
- Framework for compositing multiple shadow sources
- Breakdown showing terrain vs. tree contributions
- Already has ShadeMap integration hooks (currently async)

### Canopy Height Data (`canopy/tile-service.ts`)
- Fetches Meta/WRI 1m resolution tree height data
- Cloud Optimized GeoTIFF with efficient windowed reads
- Bay Area tiles already in our self-hosting plan

## Gap Analysis: What We Need to Build

### Gap 1: Terrain Shadow Raycasting (HIGH complexity)

**The Problem**: Determining if a point is shadowed by terrain requires tracing a ray from that point toward the sun and checking if it intersects higher terrain along the way.

**ShadeMap's Approach**: WebGL fragment shader samples the DEM texture along the sun ray direction, checking each sample against the terrain height. This runs on GPU for performance.

**Our Options**:

**Option A: WebGL Shader (matches ShadeMap)**
- Write a custom WebGL shader that samples Terrarium DEM tiles
- Pro: Fast, runs in real-time, matches ShadeMap quality
- Con: Shader development is specialized, debugging is harder
- Effort: 2-3 weeks

**Option B: CPU Raycasting with Web Workers**
- Decode DEM tiles to JavaScript, raycast in workers
- Pro: Easier to write and debug, no WebGL expertise needed
- Con: Slower, may need aggressive caching/precomputation
- Effort: 1-2 weeks for basic, +1 week for optimization

**Option C: Precomputed Horizon Angles**
- Pre-calculate horizon elevation angles for the Bay Area
- At runtime, just compare sun altitude to stored horizon
- Pro: Very fast runtime, simple lookup
- Con: Large storage (~10-50GB for high resolution), inflexible
- Effort: 1 week compute, complex storage

**Recommendation**: Start with Option B (CPU raycasting) to validate the approach, then migrate to Option A (WebGL) if performance demands it.

### Gap 2: DEM Tile Fetching and Decoding (MEDIUM complexity)

**The Data**: AWS Terrain Tiles (Terrarium format) provide global elevation at up to zoom 15 (~10m resolution in populated areas). Free, public, no authentication.

**Format**: PNG tiles where RGB encodes elevation as `(R * 256 + G + B/256) - 32768` meters.

**Implementation**:
- Tile URL pattern: `https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png`
- Decode PNG to elevation grid using Canvas getImageData
- Cache tiles in IndexedDB (same pattern as canopy tiles)
- Handle tile boundaries and stitching

**Effort**: 1 week, mostly adapting our existing tile-service pattern

### Gap 3: Building Shadow Extrusion (MEDIUM complexity)

**The Data**: OSM building footprints with optional `height` or `building:levels` tags. Available via Overpass API (already in our self-hosting plan).

**Challenge**: Only ~3% of buildings have height data globally. For others, we need heuristics:
- Default 3m per floor, assume 2 floors if no data
- Use building type hints (`building=apartments` suggests taller)
- Eventually: correlate with Meta canopy height data (DSM includes buildings)

**Implementation**:
- Query Overpass for building polygons with height data
- Extrude to 3D and project shadows like our existing building shadow code
- Shadow projection math already exists in `calculateBuildingShadow()`

**Effort**: 1-2 weeks, building on existing code

### Gap 4: Shadow Compositing Layer (LOW complexity)

**The Problem**: Combining terrain, building, and tree shadows into a unified visualization and sun-hours calculation.

**We Already Have**: The `combined-sun-hours.ts` framework with breakdown by source. The `exposure-grid.ts` grid calculation. The rendering infrastructure in Leaflet.

**Remaining Work**:
- Wire terrain shadow results into the compositing flow
- Add building shadows to the mix
- Update heatmap rendering to show combined results

**Effort**: 1 week

## Data Requirements for Self-Hosting

### Terrain DEM Tiles

For Bay Area coverage at zoom 12 (adequate for horizon calculations):
- ~64 tiles at 256x256 pixels each
- ~50KB per PNG tile (typical)
- **Total: ~3 MB**

For higher resolution (zoom 14) for detailed local shadows:
- ~1024 tiles
- **Total: ~50 MB**

### Building Footprints

Already covered by our Overpass self-hosting plan:
- NorCal extract: **1.5-2 GB** (includes buildings)
- No additional storage needed

### Combined Total

Adding terrain DEM to our existing self-hosting plan:

| Dataset | Storage |
|---------|---------|
| Canopy tiles | 320 MB |
| OSM/Overpass (includes buildings) | 2 GB |
| Climate cache | 50 MB |
| Terrain DEM tiles | 50 MB |
| **Total** | **~2.5 GB** |

Comfortably within our mini PC budget.

## Implementation Roadmap

### Phase 1: Terrain Shadow Proof-of-Concept (2 weeks)

Build CPU-based terrain shadow detection:
1. Add DEM tile fetcher mirroring canopy tile pattern
2. Implement horizon raycast for a single point
3. Validate against ShadeMap output for known locations
4. Integrate into sun-hours calculation

**Exit Criteria**: Can calculate terrain-blocked sun hours for a point without ShadeMap, results within 10% of ShadeMap values.

### Phase 2: Building Shadow Integration (1-2 weeks)

Add OSM building shadows:
1. Query Overpass for buildings in viewport
2. Apply height estimation heuristics
3. Project building shadows using existing math
4. Composite with terrain shadows

**Exit Criteria**: Buildings cast shadows on the map, visible in time scrubber animation.

### Phase 3: Grid Exposure Without ShadeMap (1 week)

Update exposure grid to use our shadow sources:
1. Replace ShadeMap queries with local terrain + building checks
2. Verify heatmap quality matches ShadeMap-based version
3. Add terrain/building breakdown to UI

**Exit Criteria**: Full heatmap renders without any ShadeMap API calls.

### Phase 4: Performance Optimization (1-2 weeks, optional)

If CPU raycasting is too slow:
1. Port terrain raycast to WebGL shader
2. Add GPU-accelerated exposure grid calculation
3. Consider Web Workers for parallel processing

**Exit Criteria**: Exposure grid calculates in under 5 seconds for typical residential lot.

### Phase 5: ShadeMap Removal (0.5 week)

Once confident in replacement:
1. Remove ShadeMap dependency from package.json
2. Delete ShadeMap-specific code and tests
3. Update documentation
4. Cancel commercial license

## Risk Assessment

### Risk: Terrain shadow quality doesn't match ShadeMap
**Likelihood**: Medium
**Impact**: High (visible quality regression)
**Mitigation**: Extensive A/B testing before switching. Keep ShadeMap as fallback option.

### Risk: Performance is inadequate without WebGL
**Likelihood**: Medium
**Impact**: Medium (poor UX but functional)
**Mitigation**: Phase 4 optimization is explicitly planned. Can limit grid resolution as stopgap.

### Risk: Building height estimation produces poor results
**Likelihood**: High (OSM data is sparse)
**Impact**: Low (buildings are secondary to trees for our users)
**Mitigation**: Start with height=0 (ignore buildings) as baseline, add progressively.

### Risk: Development takes longer than estimated
**Likelihood**: Medium
**Impact**: Low (can continue using ShadeMap meanwhile)
**Mitigation**: Phased approach allows stopping at any point with partial value.

## Cost-Benefit Analysis

### Costs

**Development Time**: 3-6 weeks depending on optimization needs
**Opportunity Cost**: Not building other features during this time
**Risk**: Quality regression during transition

### Benefits

**Immediate**: $40/month savings = $480/year
**Independence**: No external API dependency, works offline
**Performance**: Local calculation potentially faster than network round-trips
**Flexibility**: Can customize shadow algorithms (e.g., seasonal tree transparency)

### Break-Even Analysis

At a very rough $50/hour development cost:
- 4 weeks = ~$8,000 equivalent effort
- ShadeMap savings: $480/year
- Break-even: ~17 years (just on license savings)

**However**, the real value is:
1. **Self-hosting viability**: Can't self-host with external API dependency
2. **Offline operation**: Users with poor connectivity
3. **No rate limits**: Scale without API quotas
4. **Customization**: Seasonal deciduous transparency, local tree detection

These benefits compound with user growth. At 1000 monthly users making 10 calculations each, ShadeMap's rate limits become constraining regardless of cost.

## Recommendation

**Proceed with Phase 1 as an experiment.** The terrain shadow proof-of-concept is valuable learning regardless of outcome:

- If it works well: Continue to full replacement
- If quality is poor: Keep ShadeMap, at least we learned
- If performance is bad: Invest in WebGL or accept the constraint

The $40/month isn't urgent enough to rush. The self-hosting story and independence from external APIs is the real driver. Start the experiment, evaluate results, then decide on full commitment.

## Appendix: Technical References

### Terrain Tile Sources
- [AWS Terrain Tiles](https://registry.opendata.aws/terrain-tiles/) - Free global DEM
- [Mapbox Terrain-DEM](https://docs.mapbox.com/data/tilesets/reference/mapbox-terrain-dem-v1/) - Alternative source

### Shadow Algorithm Resources
- [ShadeMap's mapbox-gl-shadow-simulator](https://github.com/ted-piotrowski/mapbox-gl-shadow-simulator) - Reference implementation
- [Terrain Shadow WebGL](https://tedpiotrowski.svbtle.com/sun-and-shadow-maps-models-vs-reality) - Author's blog post on approach
- [OSM Building Shadows](https://wiki.openstreetmap.org/wiki/Shadows) - Community approaches

### Our Existing Code
- `src/lib/solar/shadow-projection.ts` - Tree and building shadow math
- `src/lib/solar/exposure-grid.ts` - Grid-based sun hours calculation
- `src/lib/canopy/tile-service.ts` - Pattern for tile fetching/caching
