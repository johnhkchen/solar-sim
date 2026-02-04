---
id: T-021-05
title: Tree refinement UX (edit auto-detected trees)
status: pending
priority: 3
complexity: M
depends_on: [T-021-04]
story: S-021
---

# T-021-05: Tree Refinement UX

## Objective

Allow users to refine auto-detected trees: delete incorrect detections, adjust properties, and add missing trees.

## Acceptance Criteria

1. User can delete an auto-detected tree (marks as "removed", doesn't re-appear)
2. User can adjust height/canopy of auto-detected tree
3. User can add trees manually (same as S-020)
4. Visual distinction between auto-detected vs user-added trees
5. Refinements persist in localStorage
6. "Reset to satellite data" option to undo all refinements

## Technical Approach

Tree state model:
```typescript
interface TreeMarker {
  id: string;
  lat: number;
  lng: number;
  height: number;
  canopyRadius: number;
  type: 'deciduous' | 'evergreen';
  source: 'auto' | 'manual';
  deleted?: boolean;  // soft delete for auto trees
  modified?: boolean; // user edited properties
}
```

Storage structure:
- Auto-detected trees: cached per tile, regenerated on fetch
- User modifications: stored as overlay (deletions + edits + additions)
- On load: merge auto-detected with user modifications

## Visual Design

- Auto-detected trees: slightly transparent or different icon variant
- User-added trees: solid/full opacity
- Modified auto trees: show small indicator (edited badge)
