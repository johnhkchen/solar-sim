---
id: T-017-06
title: Add time scrubber for shadow animation
story: S-017
status: pending
priority: 1
complexity: M
depends_on:
  - T-017-05
output: src/lib/components/TimeScrubber.svelte
---

# T-017-06: Add Time Scrubber for Shadow Animation

Create a time control that lets users scrub through the day to see shadows animate.

## Task

Create `src/lib/components/TimeScrubber.svelte` that controls the time used for shadow calculations and integrates with the isometric view.

## UI Elements

- Horizontal slider spanning sunrise to sunset for the selected date
- Current time display (e.g., "2:30 PM")
- Optional date picker to choose a different day
- Play/pause button for automatic animation (stretch goal)

## Behavior

- Dragging the slider updates the sun position in real-time
- Shadow polygons recalculate as time changes
- Animation should be smooth (target 30fps during scrubbing)
- Slider snaps to current time on initial load

## Performance Considerations

Shadow recalculation on every frame could be expensive. Consider:
- Throttling updates during rapid scrubbing
- Pre-computing shadow keyframes at 15-minute intervals
- Using requestAnimationFrame for smooth updates

## Props

- `date: Date` - The day to visualize
- `latitude: number` - For calculating sunrise/sunset
- `longitude: number` - For calculating sunrise/sunset
- `onTimeChange: (time: Date) => void` - Callback when time changes

## Acceptance Criteria

Users can drag the slider to change time of day. Shadow visualization updates smoothly during scrubbing. Slider range matches actual sunrise-sunset for the location and date. Current time is displayed clearly.
