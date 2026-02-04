---
id: T-023-07
story: S-023
title: Extended State Persistence
status: ready
priority: 3
complexity: S
dependencies:
  - T-023-02
  - T-023-03
---

# T-023-07: Extended State Persistence

## Objective

Extend the localStorage persistence to save the complete plan state—zones, selected plants, current phase, and user preferences—so users can return to their work in progress.

## Requirements

### Full Plan State

Persist to localStorage:
```typescript
interface PlanState {
  version: number; // schema version for migrations
  location: {
    lat: number;
    lng: number;
    name: string;
  };
  trees: Tree[]; // already implemented
  observationPoint: { lat: number; lng: number } | null; // already implemented
  zones: Zone[];
  currentPhase: 'site' | 'analysis' | 'plants' | 'plan';
  analysisPeriod: {
    type: 'growing-season' | 'full-year' | 'custom';
    startDate?: string; // ISO date
    endDate?: string;
  };
  preferences: {
    native: boolean;
    edible: boolean;
    lowWater: boolean;
    deerResistant: boolean;
    evergreen: boolean;
  };
  lastModified: string; // ISO timestamp
}
```

### Storage Key

Key format: `solar-sim:plan:{roundedLat}:{roundedLng}`

Round to 4 decimal places (~11m precision) to match existing tree storage.

### Save Triggers

Auto-save (debounced 500ms) when:
- Zone added, modified, or deleted
- Plant added, removed, or quantity changed
- Phase changes
- Period selection changes
- Preference filters change

### Load Behavior

On results page load:
1. Check for existing plan state at location
2. If found and recent (<30 days old), show prompt: "Continue previous plan?"
   - "Continue" → restore full state
   - "Start fresh" → clear and begin new
3. If found but old (>30 days), show similar prompt with date
4. If not found, start fresh

### Migration Strategy

Include `version` field in state. When loading:
- If version < current, run migration function
- Migrations should be additive (new fields with defaults)
- Don't break on missing fields

### Clear Plan

Add "Clear plan" option in settings/menu:
- Confirms before clearing
- Removes plan state from localStorage
- Resets to initial state

## Implementation Notes

### Existing Storage

Current implementation in `src/lib/storage/tree-storage.ts` handles trees and observation point. Options:

**Option A: Extend tree-storage**
- Add zones and plan state to same module
- Single source of truth for location-based storage

**Option B: Separate plan-storage module**
- New `src/lib/storage/plan-storage.ts`
- Cleaner separation of concerns
- Can reference tree-storage for tree data

**Recommended**: Option B for cleaner architecture.

### Debouncing

Use a single debounced save function that captures current state:
```typescript
const debouncedSave = debounce(() => {
  savePlanState(currentState);
}, 500);
```

Call `debouncedSave()` from reactive effects when state changes.

### Prompt Component

Create simple dialog for "Continue previous plan?":
```svelte
<ContinuePlanDialog
  lastModified={planState.lastModified}
  onContinue={() => restoreState(planState)}
  onStartFresh={() => clearState()}
/>
```

## Acceptance Criteria

- [ ] Zones persist to localStorage
- [ ] Selected plants per zone persist
- [ ] Current phase persists
- [ ] Analysis period persists
- [ ] Filter preferences persist
- [ ] Auto-save triggers on state changes (debounced)
- [ ] "Continue previous plan?" prompt shows on return
- [ ] Can choose to start fresh
- [ ] "Clear plan" option available and works
- [ ] Old plans (>30 days) show age warning
- [ ] Schema migration handles version changes

## Files to Create/Modify

- New: `src/lib/storage/plan-storage.ts` — plan state persistence
- New: `src/lib/components/ContinuePlanDialog.svelte` — restore prompt
- Modify: `src/routes/results/+page.svelte` — integrate load/save
- Modify: `src/lib/storage/index.ts` — export new module
