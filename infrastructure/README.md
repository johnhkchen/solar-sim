# Solar-Sim Infrastructure

This directory contains everything needed to self-host Solar-Sim on a mini PC or home server. The architecture uses Docker Compose to orchestrate the application, data services, and a reverse proxy with automatic HTTPS.

## Quick Start

```bash
# From the repository root
just infra-setup      # Download Bay Area data (~500MB)
just infra-up         # Start all services
just infra-logs       # Tail logs
just infra-down       # Stop services
```

For production deployment on an Intel NUC, the first run takes 15-30 minutes to download canopy tiles and initialize the Overpass database. For local development on Apple Silicon (M1-M5), see the Development section below—you can skip the slow Overpass import entirely.

## Architecture Overview

```
                    Internet
                        │
                        ▼
                  ┌─────────┐
                  │  Caddy  │  ← Automatic HTTPS via Let's Encrypt
                  │  :443   │
                  └────┬────┘
                       │
    ┌──────────────────┼──────────────────┐
    │                  │                  │
    ▼                  ▼                  ▼
┌──────────┐     ┌──────────┐      ┌──────────┐
│ Solar-Sim│     │  Django  │      │ Overpass │
│  :3000   │────▶│   API    │      │  :12345  │
│ (Svelte) │     │  :8000   │      │  (prod)  │
└──────────┘     └────┬─────┘      └──────────┘
                      │
         ┌────────────┼────────────┐
         │            │            │
         ▼            ▼            ▼
   ┌──────────┐ ┌──────────┐ ┌──────────┐
   │ Postgres │ │  Valkey  │ │ External │
   │  :5432   │ │  :6379   │ │   APIs   │
   └──────────┘ └──────────┘ └──────────┘
```

## Services

**solar-sim** - The SvelteKit frontend serving the interactive map UI, shadow visualization, and plan generation flow. Communicates with the Django API for all data operations.

**api** - Django REST backend handling user authentication, plan storage, subscription management, and cached proxying to external APIs. Built with Django 6.0 on Python 3.14.

**valkey** - Redis-compatible cache (Valkey 9.0) storing API responses from Overpass, Open-Meteo, and canopy tile fetches. Eliminates redundant external API calls and enables fast local development without self-hosted Overpass.

**postgres** - PostgreSQL 18 database for user accounts, saved plans, and subscription state.

**overpass** - Self-hosted OpenStreetMap query engine for building footprints. Initialized with the Northern California extract from Geofabrik. In development, this is optional—the Django API proxies to the public Overpass API with Valkey caching instead.

**caddy** - Reverse proxy handling TLS termination, HTTP/2, HTTP/3, and automatic certificate renewal. Routes `/api/*` to Django and everything else to SvelteKit.

## Directory Structure

```
infrastructure/
├── README.md              # This file
├── docker/
│   ├── docker-compose.yml # Main orchestration file
│   ├── docker-compose.dev.yml  # Development overrides
│   ├── Dockerfile         # SvelteKit frontend image
│   ├── Caddyfile          # Reverse proxy configuration
│   └── Caddyfile.dev      # Dev proxy (HTTP only)
├── scripts/
│   ├── download-canopy.sh # Fetch Bay Area canopy tiles
│   ├── seed-climate.js    # Pre-cache climate data grid
│   └── backup.sh          # Automated backup script
└── data/                  # Persistent data (gitignored)
    ├── canopy/            # GeoTIFF tiles
    ├── overpass/          # OSM database (prod only)
    ├── postgres/          # Database files
    ├── valkey/            # Cache persistence
    └── backups/           # Scheduled backups

backend/                   # Django API (separate from infrastructure/)
├── Dockerfile             # Django image
├── pyproject.toml         # Python dependencies
├── manage.py
├── config/                # Django settings
└── apps/
    ├── accounts/          # User model, auth
    ├── plans/             # Plan CRUD, subscriptions
    └── proxy/             # Cached API proxying
```

## Hardware Requirements

The minimum viable setup runs on an Intel N100 mini PC (~$200):

| Resource | Minimum | Recommended |
|----------|---------|-------------|
| CPU | 4 cores | 4+ cores |
| RAM | 8 GB | 16 GB |
| Storage | 32 GB free | 64 GB free |
| Network | 100 Mbps | Gigabit |

Power consumption sits around 10-15W idle, costing roughly $3/month in electricity.

## Data Requirements

For Bay Area coverage only:

| Dataset | Size | Update Frequency |
|---------|------|------------------|
| Canopy tiles | 320 MB | Never (static 2018-2020 data) |
| OSM/Overpass | 2 GB | Weekly diffs (prod only) |
| Climate cache | 50 MB | On-demand |
| Valkey cache | Variable | Auto-evicted by TTL |
| PostgreSQL | 100 MB base | Grows with users |
| **Total** | **~3 GB** | |

## Business Model Integration

The self-hosted infrastructure supports the freemium model:

**Free Tier**
- 4 saved residential plots/plans per account
- Unlimited analysis sessions (not saved)
- Bay Area coverage from local cache

**Pay-per-Plan ($1.50/month per plan)**
- Additional plans beyond the free 4
- Billed monthly based on active plan count
- Plans can be archived to stop billing

**Pro Tier ($25/month)**
- Up to 75 site/plans
- Priority support
- API access for integrations
- Bulk export features

User data and subscription state live in PostgreSQL. Stripe handles payment processing via webhooks. The application checks plan limits on save operations and prompts for upgrade when exceeded.

## Development (Apple Silicon)

Local development on M1/M2/M3/M4/M5 Macs skips the self-hosted Overpass database entirely. Instead, the Django API proxies to the public Overpass API and caches responses in Valkey. This avoids the multi-hour Rosetta-emulated import while still giving you realistic API behavior.

```bash
# Start the dev stack (no Overpass)
just infra-up-dev

# Services available:
# - http://localhost:5173  SvelteKit (Vite HMR)
# - http://localhost:8000  Django API
# - http://localhost:5432  Postgres
# - http://localhost:6379  Valkey
```

The dev compose file sets `OVERPASS_URL` to the public API. First requests to a location hit the external API, subsequent requests are served from Valkey cache with a 7-day TTL.

If you need to test with self-hosted Overpass (slow on ARM, runs via Rosetta):

```bash
docker compose -f docker-compose.yml -f docker-compose.dev.yml --profile overpass up
```

## Environment Variables

Copy `.env.example` to `.env` and configure:

```bash
# Domain and TLS
DOMAIN=solar-sim.example.com
ACME_EMAIL=admin@example.com

# Database
POSTGRES_PASSWORD=<generate-strong-password>

# Django
DJANGO_SECRET_KEY=<generate-secret-key>

# Stripe (for subscriptions)
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...

# Optional: External API keys for fallback
SHADEMAP_API_KEY=<if-using-shademap>
```

## Deployment Checklist

1. **Provision hardware** - Mini PC with Ubuntu Server or similar
2. **Install Docker** - `curl -fsSL https://get.docker.com | sh`
3. **Clone repository** - `git clone ... && cd solar-sim`
4. **Configure environment** - `cp infrastructure/.env.example infrastructure/.env && vim infrastructure/.env`
5. **Download data** - `just infra-setup` (takes 15-30 min)
6. **Start services** - `just infra-up`
7. **Configure DNS** - Point your domain to the server's IP
8. **Verify HTTPS** - Caddy obtains certificates automatically

## Backup and Recovery

The backup script runs nightly via cron and uploads to Backblaze B2:

```bash
# Add to crontab
0 3 * * * /path/to/solar-sim/infrastructure/scripts/backup.sh
```

Backups include:
- PostgreSQL dump (users, plans, subscriptions)
- Climate cache
- Configuration files

Canopy tiles and Overpass data are not backed up since they can be re-downloaded. Recovery involves restoring the Postgres dump and re-running `just infra-setup`.

## Monitoring

Basic health checks are exposed at:
- `/health` - SvelteKit application status
- `/api/v1/health/` - Django API and cache connectivity
- Caddy metrics at `:2019/metrics` (Prometheus format)

For alerting, consider Uptime Kuma (self-hosted) or an external service like Healthchecks.io.

## Scaling Considerations

This architecture handles ~100 concurrent users comfortably on N100 hardware. For higher load:

1. **Vertical scaling** - Upgrade to N305 or i3 with more RAM
2. **Read replicas** - Add Postgres replicas for read-heavy workloads
3. **CDN** - Put Cloudflare in front for static asset caching
4. **Multiple instances** - Run additional app containers behind a load balancer

The canopy tile serving is the main bottleneck since GeoTIFF decoding is CPU-intensive. Pre-generating rasterized tiles at common zoom levels would help if this becomes an issue.

## Troubleshooting

**Overpass initialization fails**
The import process needs 4+ GB of available RAM. Check `docker stats` and increase swap if needed. The NorCal extract takes 4-8 hours on N100 hardware.

**Certificate errors**
Ensure port 80 is open for ACME challenges. Check `docker logs caddy` for details. Caddy retries automatically every few hours.

**Out of disk space**
Overpass creates temporary files during import. Ensure 20+ GB free before initialization. After setup completes, space usage stabilizes around 3-5 GB.

**Slow canopy tile loading**
First access to a tile requires network fetch. Subsequent accesses are cached in Valkey (1-year TTL). For Bay Area locations in production, tiles load from local storage instantly after `infra-setup`.

## Version Reference

| Component | Version | Notes |
|-----------|---------|-------|
| Python | 3.14 | Django backend |
| Django | 6.0 | REST API |
| Node.js | 24 LTS | SvelteKit frontend |
| PostgreSQL | 18 | Database |
| Valkey | 9.0 | Redis-compatible cache |
| Caddy | 2.10 | Reverse proxy |

All images are multi-arch (amd64 + arm64) except `wiktorn/overpass-api`, which is amd64-only and runs via Rosetta on Apple Silicon.
