---
id: T-024-01
title: Verify Django backend stack works end-to-end
story: S-024
status: complete
priority: 1
complexity: S
completed_at: "2026-02-05T08:17:36.832Z"
---

# T-024-01: Verify Django Backend Stack

## Task

Clean rebuild and validate the Django backend before frontend integration begins. The fixes for cache config and dev environment have been applied; this ticket confirms they work.

## Steps

1. **Clean slate**
   ```bash
   cd infrastructure/docker
   docker compose -f docker-compose.yml -f docker-compose.dev.yml down -v
   rm -rf ../data/postgres ../data/valkey
   ```

2. **Rebuild and start**
   ```bash
   docker compose -f docker-compose.yml -f docker-compose.dev.yml up --build
   ```

3. **Run migrations**
   ```bash
   docker exec solar-sim-api python manage.py migrate
   ```
   Expected: All migrations apply successfully, no UUID/bigint errors.

4. **Test health endpoint**
   ```bash
   curl http://localhost:8000/api/v1/health/
   ```
   Expected: `{"status": "ok", "service": "solar-sim-api"}`

5. **Test climate proxy**
   ```bash
   curl "http://localhost:8000/api/v1/climate/?lat=37.7749&lng=-122.4194"
   ```
   Expected: JSON with `daily` temperature data, no 500 error.

6. **Test overpass proxy**
   ```bash
   curl -X POST http://localhost:8000/api/v1/overpass/ \
     -H "Content-Type: application/json" \
     -d '{"query": "[out:json];node(37.77,-122.42,37.78,-122.41);out 1;"}'
   ```
   Expected: JSON with OSM elements, no 500 error.

7. **Verify caching**
   ```bash
   docker exec solar-sim-cache valkey-cli keys "*"
   ```
   Expected: Keys like `climate:37.77:-122.42` and `overpass:...` present.

8. **Test cache hit**
   Run the climate request again, verify it returns faster (or check Django logs for "cache hit" message).

## Acceptance Criteria

- [ ] Migrations complete without errors
- [ ] Health endpoint returns 200
- [ ] Climate endpoint returns valid JSON
- [ ] Overpass endpoint returns valid JSON
- [ ] Valkey contains cached keys
- [ ] Second request served from cache

## Notes

If migrations fail with UUID errors, the postgres volume wasn't properly cleared. Run `docker volume ls` and remove any lingering volumes.

If cache errors persist, check that the container was rebuilt (`--build` flag) to pick up the updated `settings.py` without `django-redis`.
