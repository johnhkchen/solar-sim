---
id: T-024-06
title: End-to-end integration testing
story: S-024
status: pending
priority: 2
complexity: S
depends_on: [T-024-03, T-024-04, T-024-05]
---

# T-024-06: End-to-End Integration Testing

## Task

Verify the complete user flow works with the Django backend. All external API calls should now route through Django with Valkey caching.

## Test Scenarios

### 1. Fresh Location Load

Start with empty Valkey cache, load a new location:

1. Clear cache: `docker exec solar-sim-cache valkey-cli flushall`
2. Open app at `http://localhost:5173`
3. Enter a Bay Area address (e.g., "123 Main St, San Francisco, CA")
4. Observe network requests in browser DevTools

**Expected:**
- Climate request to `localhost:8000/api/v1/climate/`
- Overpass request to `localhost:8000/api/v1/overpass/`
- Canopy request to `localhost:8000/api/v1/canopy/{quadkey}/`
- All return 200 with valid data

### 2. Cached Location Reload

Without clearing cache, reload the same location:

1. Refresh the page or re-enter same address
2. Observe network timing

**Expected:**
- Same endpoints called
- Responses significantly faster (< 100ms vs seconds)
- Django logs show "cache hit" or no upstream fetch

### 3. Shadow Visualization

Test building shadows still render:

1. Enable shadow visualization in the UI
2. Adjust time slider
3. Verify building shadows appear and animate

**Expected:**
- Building footprints render correctly
- Shadow casting works
- No JavaScript errors in console

### 4. Climate Data Display

Test frost dates and climate info:

1. View climate panel or frost date information
2. Verify dates are reasonable for the location

**Expected:**
- Frost dates display (or "frost-free" for warm climates)
- No errors fetching climate data

### 5. Tree/Canopy Visualization

Test tree height data:

1. Enable canopy or tree visualization
2. Verify tree heights render

**Expected:**
- Tree canopy data loads
- Height values are reasonable (0-50m typical)
- No GeoTIFF parsing errors

### 6. Error Handling

Test behavior when backend is down:

1. Stop Django: `docker stop solar-sim-api`
2. Try to load a new location in the app

**Expected:**
- Graceful error message to user
- No unhandled exceptions
- App remains usable for cached locations (if implementing offline-first)

3. Restart Django: `docker start solar-sim-api`
4. Retry the action

**Expected:**
- Works normally after backend returns

## Acceptance Criteria

- [ ] All network requests go through Django API (none to external APIs)
- [ ] Cached responses are faster than uncached
- [ ] Shadow visualization works
- [ ] Climate/frost data displays correctly
- [ ] Canopy/tree visualization works
- [ ] Error states handled gracefully
- [ ] No console errors during normal operation

## Regression Checklist

Verify these existing features still work:
- [ ] Location search
- [ ] Map pan/zoom
- [ ] Shadow animation
- [ ] Sun hours calculation
- [ ] Plant recommendations
- [ ] PDF export (if implemented)
- [ ] Zone marking (if implemented)
