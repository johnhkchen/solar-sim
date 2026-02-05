# Self-Hosted Data Infrastructure for Bay Area Coverage

This document analyzes the feasibility of running Solar-Sim's data infrastructure on self-hosted hardware, specifically targeting the greater San Francisco Bay Area (9 counties, ~18,000 km²). The goal is to eliminate ongoing cloud hosting costs (~$30/month) while maintaining the ability to fetch data for locations outside the cached region.

## Executive Summary

Self-hosting the data layer for Bay Area coverage is highly feasible on modest hardware. The total storage requirement is approximately 5-8 GB for the core datasets, well within the capacity of a $200-300 mini PC with a 256GB SSD. The architecture uses a tiered caching approach where frequently-accessed Bay Area data lives locally while requests for other locations fall through to public APIs. This hybrid model eliminates rate limiting issues for local users while maintaining global reach.

## Data Sources and Storage Requirements

### 1. Meta/WRI Canopy Height Data

The canopy height dataset provides 1-meter resolution tree height measurements stored as Cloud Optimized GeoTIFF tiles. Each tile uses QuadKey naming at zoom level 9, covering roughly 80km × 80km and weighing approximately 20MB.

For the Bay Area (bounding box 36.9°N to 38.9°N, 123.5°W to 121.0°W), exactly 16 QuadKeys are needed:

```
023010200  023010201  023010202  023010203
023010210  023010211  023010212  023010213
023010220  023010221  023010222  023010223
023010230  023010231  023010232  023010233
```

**Storage: 320 MB** (16 tiles × 20 MB)

The data is static (imagery from 2018-2020) so a one-time download suffices. No ongoing updates are needed since trees change slowly relative to the data's inherent accuracy (2.8m MAE).

### 2. OpenStreetMap Building Data (Overpass API Alternative)

Building footprints for shadow casting require OSM data. Rather than hitting the public Overpass API repeatedly, we can self-host a regional extract.

The Northern California OSM extract from Geofabrik weighs 603 MB as a compressed PBF file. After processing into an Overpass-compatible format, the database expands to approximately 2-3× the source size.

**Storage: 1.5-2 GB** (processed Overpass database for NorCal)

Alternatively, we could pre-extract just building footprints into a simpler format like GeoJSON or FlatGeobuf, which would be smaller but less flexible. For the Bay Area specifically, building footprints alone would likely be 200-400 MB.

The OSM data updates frequently, so the self-hosted instance should support daily or weekly diff updates. The Overpass Docker image handles this automatically via configured diff URLs from Geofabrik.

### 3. Climate/Weather Data (Open-Meteo)

The current implementation fetches 30 years of daily temperature history from Open-Meteo's archive API. For frost date calculations, we need min/max temperatures for any location the user queries.

Open-Meteo offers two self-hosting options:

**Option A: Full Historical Archive** - The complete ERA5 reanalysis dataset requires 22 TB for 62 years of data, which is impractical for home hosting.

**Option B: Hybrid Caching** - Cache results locally after fetching from the public API. The current implementation already does this with 30-day localStorage TTL. For self-hosting, we'd persist these to disk.

For the Bay Area, pre-caching climate data at 0.1° grid spacing (roughly 10km) would require about 400 grid points. At approximately 50KB per location (30 years of daily data compressed), this totals 20 MB.

**Storage: 20-50 MB** (pre-cached Bay Area climate grid)

The hybrid approach works well here because climate queries are infrequent (once per location per session) and the public API has generous rate limits (several thousand requests per day).

### 4. Geocoding (Nominatim)

The current architecture calls Nominatim directly from the browser. Self-hosting Nominatim requires significant resources (64GB RAM for planet-wide coverage), making it impractical for a mini PC.

**Recommendation: Continue using public Nominatim API.** The rate limit of 1 request per second is ample for our use case where users enter one location per session. No storage needed.

### 5. Timezone Data (tz-lookup)

Already runs entirely client-side using an embedded 72KB shape file. No server component or storage needed.

## Total Storage Summary

| Data Source | Bay Area Storage | Update Frequency |
|-------------|------------------|------------------|
| Canopy height tiles | 320 MB | Never (static) |
| OSM/Overpass buildings | 1.5-2 GB | Weekly |
| Climate cache | 50 MB | On-demand |
| **Total** | **~2-2.5 GB** | |

With headroom for logs, temp files, and growth, a **5 GB** allocation handles Bay Area coverage comfortably. A **10 GB** allocation provides generous margin.

## Hardware Requirements

### Minimum Viable Setup

An Intel N100-based mini PC meets all requirements:

- **CPU**: Intel N100 (4 cores, 3.4GHz boost) - handles concurrent GeoTIFF decoding and Overpass queries
- **RAM**: 8 GB - sufficient for Overpass API serving and OS overhead
- **Storage**: 256 GB SSD - provides ~250 GB usable after OS, leaving 240+ GB for data and growth
- **Network**: Gigabit Ethernet - saturates most home fiber connections
- **Power**: 10-15W idle - costs ~$15/year in electricity

**Estimated hardware cost: $150-250** (Beelink Mini S12 Pro or similar)

### Recommended Setup

For better reliability and performance:

- **CPU**: Intel N100 or N305 (same efficiency, more headroom)
- **RAM**: 16 GB - allows more aggressive caching
- **Storage**: 500 GB NVMe SSD - faster I/O for tile serving
- **UPS**: Small battery backup for graceful shutdown

**Estimated cost: $250-350** including storage upgrade

### Power and Connectivity

The server draws roughly 10-25W depending on load. With residential fiber (typically 100-500 Mbps upload), the system can serve multiple concurrent users comfortably. GeoTIFF tiles for a single location are typically 50-200 KB after windowed extraction, well within residential bandwidth limits.

Monthly electricity cost at $0.15/kWh: ~$2-4
Annual electricity cost: ~$25-50

Compared to $30/month cloud hosting, the break-even point is approximately 6-8 months.

## Architecture Design

The self-hosted architecture uses a caching proxy pattern:

```
User Request
     │
     ▼
┌─────────────────┐
│   Local Cache   │  ← Check if data is cached for this location
└────────┬────────┘
         │
    ┌────┴────┐
    │ Cache   │
    │  Hit?   │
    └────┬────┘
         │
    Yes  │  No
    ▼    │  ▼
┌───────┐│┌────────────────┐
│Return ││ │ Fetch from     │
│Cached │││ │ Public API     │
│Data   │││ │ (if Bay Area:  │
└───────┘││ │  local file)   │
         ││ └───────┬────────┘
         ││         │
         ││         ▼
         ││  ┌─────────────┐
         ││  │ Store in    │
         ││  │ Local Cache │
         ││  └──────┬──────┘
         │└────────►│
         │          ▼
         └──►  Return Data
```

For locations within the Bay Area bounding box, data is served entirely from local files with zero external API calls. For locations outside the Bay Area, the system falls through to public APIs (Open-Meteo, Nominatim, AWS S3 for canopy tiles) and caches results locally for future requests.

This hybrid approach means:
1. Bay Area users get instant, rate-limit-free responses
2. Users elsewhere still work, just with first-request latency
3. Popular out-of-region locations gradually get cached
4. No API quota concerns for the primary use case

## Implementation Plan

### Phase 1: Canopy Tile Pre-caching (Immediate Win)

Download the 16 Bay Area canopy tiles to local storage. Modify `tile-service.ts` to check a local directory before hitting the S3 proxy. This is the simplest change with immediate benefit since canopy data is the largest and slowest fetch.

```bash
# Download script (run once)
for qk in 023010200 023010201 023010202 023010203 \
          023010210 023010211 023010212 023010213 \
          023010220 023010221 023010222 023010223 \
          023010230 023010231 023010232 023010233; do
  curl -o "canopy/${qk}.tif" \
    "https://dataforgood-fb-data.s3.amazonaws.com/forests/v1/alsgedi_global_v6_float/chm/${qk}.tif"
done
```

Total download: ~320 MB

### Phase 2: Self-Hosted Overpass for Buildings

Deploy the wiktorn/overpass-api Docker container with the NorCal extract:

```yaml
# docker-compose.yml
services:
  overpass:
    image: wiktorn/overpass-api
    volumes:
      - ./overpass-db:/db
    environment:
      - OVERPASS_MODE=init
      - OVERPASS_PLANET_URL=https://download.geofabrik.de/north-america/us/california/norcal-latest.osm.pbf
      - OVERPASS_DIFF_URL=https://download.geofabrik.de/north-america/us/california/norcal-updates/
    ports:
      - "12345:80"
```

Initial import takes 4-12 hours depending on hardware. After that, queries are instant and unlimited.

### Phase 3: Climate Data Pre-caching

Pre-populate climate data for a grid of Bay Area points. This can run as a background job:

```javascript
// Pre-cache climate data for Bay Area grid
const GRID_STEP = 0.1; // ~10km
for (let lat = 36.9; lat <= 38.9; lat += GRID_STEP) {
  for (let lng = -123.5; lng <= -121.0; lng += GRID_STEP) {
    await fetchHistoricalTemperatures(lat, lng);
    await sleep(1000); // Respect rate limits
  }
}
```

This one-time script takes a few hours but populates ~400 cache entries.

### Phase 4: Unified Server Deployment

Package everything into a single Docker Compose stack that runs on the mini PC:

```yaml
services:
  solar-sim:
    build: .
    volumes:
      - ./data/canopy:/app/data/canopy
      - ./data/climate:/app/data/climate
    ports:
      - "3000:3000"

  overpass:
    image: wiktorn/overpass-api
    volumes:
      - ./data/overpass:/db

  caddy:
    image: caddy
    ports:
      - "80:80"
      - "443:443"
    # Reverse proxy with automatic HTTPS
```

## Cost Comparison

### Current Cloud Approach
- Cloudflare Workers: Free tier may suffice, or $5/month for additional usage
- API rate limits: Risk of degraded UX under load
- External bandwidth: Dependent on third-party availability
- **Monthly cost: ~$5-30**

### Self-Hosted Approach
- Mini PC (one-time): $200-300
- Electricity: ~$3/month
- Domain/DNS: $12/year (already have)
- Fiber internet: Already have for personal use
- **Monthly cost: ~$3 after initial hardware**

### Break-even Analysis
If cloud hosting costs $20/month and self-hosting costs $3/month:
- Monthly savings: $17
- Hardware cost: $250
- Break-even: ~15 months

If cloud hosting costs $30/month:
- Monthly savings: $27
- Break-even: ~9 months

## Expansion Considerations

### Scaling Beyond Bay Area

To expand coverage to all of California:
- Canopy tiles: ~50 tiles (~1 GB)
- OSM data: Full California extract is 1.2 GB (~3-4 GB processed)
- Climate cache: ~2000 grid points (~100 MB)
- **Total: ~5 GB**

To expand to US West Coast:
- Canopy tiles: ~150-200 tiles (~3-4 GB)
- OSM data: Combined extracts (~15-20 GB processed)
- **Total: ~25 GB**

All scenarios fit comfortably on a 256 GB SSD.

### Fallback Strategy

If the self-hosted server goes down:
1. Application detects failed local requests
2. Falls back to public APIs automatically
3. User experience degrades to API-limited mode but still works
4. No complete outage

## Risks and Mitigations

**Risk: Hardware failure**
Mitigation: Automated daily backups to cloud storage (Backblaze B2 costs ~$0.005/GB/month, so 10 GB = $0.05/month). Recovery involves spinning up a new mini PC and restoring from backup.

**Risk: Network/power outage**
Mitigation: The app gracefully falls back to public APIs. Users outside your network are unaffected. Consider a small UPS for clean shutdown.

**Risk: Data staleness**
Mitigation: Canopy data is inherently static. OSM updates weekly via diff files. Climate data is historical and unchanging. None of these create freshness concerns.

**Risk: Upstream API changes**
Mitigation: Self-hosting reduces dependency on external APIs. Only geocoding requires external calls, and Nominatim is stable open-source infrastructure.

## Conclusion

Self-hosting Solar-Sim's data infrastructure for Bay Area coverage is not only feasible but advantageous. The storage requirements (~5 GB) and compute needs (Intel N100 mini PC) are modest, the cost savings are meaningful ($200-300/year), and the architecture provides better reliability than depending on rate-limited public APIs.

The recommended approach is incremental:
1. Start with canopy tile pre-caching (immediate, zero infrastructure)
2. Add self-hosted Overpass when building footprints are implemented
3. Pre-cache climate data as a background task
4. Deploy unified stack when usage patterns justify dedicated hardware

This validates the original hypothesis: a mini PC on a home fiber connection can serve the entire Bay Area user base while maintaining the ability to fetch data for any location worldwide on-demand.

## References

- [Geofabrik Northern California Extract](https://download.geofabrik.de/north-america/us/california/norcal.html) - 603 MB PBF file
- [Meta/WRI Canopy Height Data on AWS](https://registry.opendata.aws/dataforgood-fb-forests/) - Public S3 bucket with free access
- [Overpass API Docker Image](https://github.com/wiktorn/Overpass-API) - Self-hosting documentation
- [Open-Meteo Historical API](https://open-meteo.com/en/docs/historical-weather-api) - Climate data source
- [Intel N100 Mini PC for Home Servers](https://www.xda-developers.com/built-silent-home-server-using-intel-n100-mini-pc/) - Hardware guidance
- [Bay Area Geography](https://en.wikipedia.org/wiki/San_Francisco_Bay_Area) - 9 counties, ~18,000 km²
