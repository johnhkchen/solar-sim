---
id: T-020-01
title: Integrate ShadeMap layer with Leaflet
status: complete
priority: 1
complexity: M
depends_on: []
story: S-020
completed_at: 2026-01-31
---

# T-020-01: Integrate ShadeMap Layer with Leaflet

## Objective

Add the leaflet-shadow-simulator library to our existing Leaflet map and configure it with the Educational API key to render terrain and building shadows.

## Acceptance Criteria

1. `leaflet-shadow-simulator` package installed and configured
2. ShadeMap layer renders on the existing location picker map
3. Shadows update when date/time changes
4. Educational API key works for localhost development
5. Basic time control allows scrubbing through a day

## Technical Approach

Install the package, obtain an Educational API key from shademap.app, and add the shadow layer to our existing Leaflet map component. Start with the basic example from the library docs and verify it works before customizing.

## Files to Modify

- `package.json` - add dependency
- `src/lib/components/MapPicker.svelte` - add shadow layer
- `.env` or config - store API key

## References

- [leaflet-shadow-simulator](https://github.com/ted-piotrowski/leaflet-shadow-simulator)
- [Demo](https://ted-piotrowski.github.io/leaflet-shadow-simulator/examples/map.html)
