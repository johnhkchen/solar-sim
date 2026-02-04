---
id: T-020-07
title: localStorage persistence for trees
status: complete
priority: 4
complexity: S
depends_on: [T-020-02]
story: S-020
---

# T-020-07: localStorage Persistence for Trees

## Objective

Save user-placed trees to localStorage so they persist when returning to the same location.

## Acceptance Criteria

1. Trees save to localStorage when added/modified/deleted
2. Trees restore when user returns to same location
3. Storage key based on location (rounded coordinates)
4. Observation point position also persists
5. Graceful handling of corrupted/invalid stored data

## Technical Approach

Key format: `solar-sim:trees:{lat}:{lng}` with coordinates rounded to ~100m precision. Store array of tree objects with type, height, width, position. Load on map initialization if key exists.

Reuse patterns from S-019's localStorage ticket (T-019-05) adapted for new data structure.

## Files to Modify

- Map component - add save/load logic
- Possibly extract to `src/lib/storage/` utility module
