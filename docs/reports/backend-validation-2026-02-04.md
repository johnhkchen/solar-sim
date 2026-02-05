# Solar-Sim Stack Validation Report

## Summary
Stack is partially functional - core services running but Django API has critical cache and migration issues that prevent endpoint functionality.

## Service Status

| Service | Status | Notes |
|---------|--------|-------|
| Postgres | ✅ | Running on postgres:16-alpine (downgraded from 18 due to mount path incompatibility) |
| Valkey | ✅ | Running and responding to PING |
| Django API | ⚠️ | Container healthy, basic health endpoint works, but all proxy endpoints fail |
| SvelteKit | ✅ | Running outside Docker on port 5173 (local dev server, not in container) |

## API Endpoints

| Endpoint | Status | Response |
|----------|--------|----------|
| GET /api/v1/health/ | ✅ | `{"status": "ok", "service": "solar-sim-api"}` |
| GET /api/v1/climate/ | ❌ | 500 Internal Server Error - TypeError in cache backend |
| POST /api/v1/overpass/ | ❌ | 500 Internal Server Error - TypeError in cache backend |
| GET /api/v1/canopy/{quadkey}/ | ❌ | 500 Internal Server Error - TypeError in cache backend |

## Cache Verification
- Valkey storing keys: No (cache connection fails before storing)
- Second request faster: Not tested (cannot reach endpoints)

## Issues Found

### 1. Django-Redis Cache Configuration Error
**Severity: Critical**

All proxy endpoints fail with:
```
TypeError: AbstractConnection.__init__() got an unexpected keyword argument 'CLIENT_CLASS'
```

**Location:** `apps/proxy/views.py:120` when calling `cache.get(cache_key)`

**Root Cause:** Version incompatibility between django-redis (5.4+) and redis client library. The redis client API changed and django-redis is passing deprecated arguments.

**Impact:** All caching functionality broken - climate, overpass, and canopy proxy endpoints return 500 errors.

**Stack Trace:**
```
File "/usr/local/lib/python3.14/site-packages/redis/connection.py", line 1255, in __init__
  super().__init__(**kwargs)
TypeError: AbstractConnection.__init__() got an unexpected keyword argument 'CLIENT_CLASS'
```

### 2. Database Migration Failure
**Severity: Critical**

Cannot run `python manage.py migrate`:
```
django.db.utils.ProgrammingError: foreign key constraint "django_admin_log_user_id_c564eba6_fk_users_id" cannot be implemented
DETAIL: Key columns "user_id" and "id" are of incompatible types: bigint and uuid.
```

**Root Cause:** Custom User model uses UUID primary key but Django's built-in admin app expects bigint for foreign key references.

**Impact:**
- Cannot create database schema
- Cannot create superuser
- Cannot access Django admin interface
- Database is initialized but no application tables exist

### 3. PostgreSQL 18 Mount Path Incompatibility
**Severity: Medium (workaround applied)**

PostgreSQL 18 changed volume mount expectations from `/var/lib/postgresql/data` to `/var/lib/postgresql` (with versioned subdirectories).

**Workaround:** Downgraded to postgres:16-alpine in dev mode (see docker-compose.dev.yml override).

**Impact:** Production config (docker-compose.yml) still uses postgres:18-alpine and will fail with same mount error.

### 4. Docker Compose Dependency Issue
**Severity: Low (workaround applied)**

Base docker-compose.yml has `solar-sim` service depending on `overpass` service, but dev override puts overpass in a profile (disabled by default). This causes validation errors on startup.

**Workaround:** Put both `solar-sim` and `caddy` services in the `svelte` profile for dev mode.

**Impact:** Cannot start full stack in dev mode without profile workarounds.

## Missing Pieces for Frontend Integration

### Configuration
- Frontend needs `PUBLIC_API_URL=http://localhost:8000/api/v1` environment variable (already present in local dev server)
- CORS origins are configured for `http://localhost:5173` (correct for local dev)

### API Functionality
1. **All proxy endpoints must be fixed** before frontend can use them
   - Climate data fetching broken
   - Overpass OSM queries broken
   - Canopy tile fetching broken

2. **Cache must work** for acceptable performance
   - External API calls will be slow without caching
   - May hit rate limits without cache deduplication

3. **Database migrations must succeed** if backend needs to store user data
   - User authentication will fail
   - Cannot create admin accounts for testing
   - No database schema for application models

### SvelteKit Integration
- SvelteKit is currently running **outside** Docker as a local dev process
- Should be integrated into docker-compose for consistent dev environment
- Current docker-compose.dev.yml has SvelteKit service configured but disabled via profile

## Recommendations

### Immediate Fixes (Required for Functionality)
1. **Fix django-redis compatibility**
   - Option A: Pin `redis<5.1.0` (older client compatible with django-redis 5.4)
   - Option B: Upgrade to `django-redis>=6.0` (if available, supports redis 5.x API)
   - Option C: Switch to different cache backend (django-valkey or direct redis configuration)
   - Test after fix: All three proxy endpoints should return data

2. **Fix User model primary key conflict**
   - Option A: Use AutoField (bigint) instead of UUIDField for User.id
   - Option B: Customize Django admin to handle UUID foreign keys
   - Option C: Create custom admin models that don't use django.contrib.admin.LogEntry
   - Test after fix: `python manage.py migrate` should complete successfully

3. **Fix PostgreSQL 18 production config**
   - Update docker-compose.yml volume mount from `../data/postgres:/var/lib/postgresql/data` to `../data/postgres:/var/lib/postgresql`
   - Remove existing postgres data directory before deploying
   - Test with postgres:18-alpine to ensure initialization works

### Nice-to-Have Improvements
1. Integrate SvelteKit into docker-compose workflow (currently runs outside Docker)
2. Remove or properly configure Overpass dependency in dev mode (currently in conflicting profile)
3. Add docker-compose healthcheck for Django API that tests cache connectivity (not just HTTP response)
4. Document .env file creation in setup instructions (had to create from .env.example)
5. Consider using named volumes instead of bind mounts for databases in dev

### Testing Workflow
After fixes are implemented:
1. Clean start: `docker compose -f docker-compose.yml -f docker-compose.dev.yml down -v`
2. Remove data: `rm -rf infrastructure/data/postgres/*`
3. Start stack: `docker compose -f docker-compose.yml -f docker-compose.dev.yml up --build`
4. Run migrations: `docker exec solar-sim-api python manage.py migrate`
5. Create superuser: `docker exec -it solar-sim-api python manage.py createsuperuser`
6. Test endpoints:
   - GET `/api/v1/health/` - should return 200 OK
   - GET `/api/v1/climate/?lat=37.7749&lng=-122.4194` - should return climate data JSON
   - POST `/api/v1/overpass/` with valid query - should return OSM data
   - Check Valkey keys: `docker exec solar-sim-cache valkey-cli keys "*"` - should show cached entries
7. Test caching: Run same climate request twice, verify second is faster or returns instantly

## Stack Architecture Notes

### What Works
- Docker networking between services (postgres, valkey, api)
- Environment variable configuration via .env file
- Container health checks (all services report healthy)
- Basic Django request handling
- CORS configuration for local development

### What Doesn't Work
- Cache layer integration (critical for all proxy endpoints)
- Database schema initialization (blocks user management)
- Full docker-compose stack startup (requires manual service selection)

### Production vs Dev Differences
- Dev uses postgres:16, production uses postgres:18
- Dev disables local Overpass (uses public API), production expects local instance
- Dev exposes ports for debugging (8000, 5432, 6379), production uses Caddy reverse proxy
- SvelteKit in dev is external process, production would containerize it

## Infrastructure Context

This validation was performed during implementation of the Django backend + Valkey cache proxy layer as described in the infrastructure setup. The backend is meant to proxy external data APIs (climate, OpenStreetMap via Overpass, canopy tiles) with Valkey caching to reduce latency and API costs.

The core architecture is sound - services communicate correctly and the container orchestration works. The blockers are code-level integration issues (cache client compatibility, database schema design) rather than infrastructure problems.
