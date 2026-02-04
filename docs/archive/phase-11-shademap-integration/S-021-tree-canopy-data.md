---
id: S-021
title: Auto-Populated Trees from Canopy Height Data
status: backlog
priority: medium
dependencies: [S-020]
---

# S-021: Auto-Populated Trees from Canopy Height Data

## Opportunity

Meta's Data for Good program provides **global canopy height maps at individual-tree resolution**, derived from machine learning on Maxar satellite imagery. This dataset is freely available on AWS S3 with no account required.

If we integrate this data, users wouldn't need to manually place most trees—we'd auto-populate from satellite-derived heights and let them refine (add recent plantings, remove cut trees, adjust canopy sizes).

## The Dataset

**Source**: [High Resolution Canopy Height Maps](https://registry.opendata.aws/dataforgood-fb-forests/)

**Contents**:
- Global canopy height maps (GeoTIFF format)
- Individual-tree resolution
- Regional high-res datasets for California, São Paulo, Sub-Saharan Africa

**Access**:
```bash
aws s3 ls --no-sign-request s3://dataforgood-fb-data/forests/v1/alsgedi_global_v6_float/
```

**Cost**: Free, public S3 bucket, no AWS account needed

## Value Proposition

**Before (S-020)**: User manually places all trees on map
**After (S-021)**: Trees auto-populate from satellite data, user only refines

This dramatically reduces friction for the core use case. A gardener zooms to their property and immediately sees existing tree shadows without manual input.

## Technical Approach

### Phase 1: Research & Spike

- Understand GeoTIFF format and resolution
- Determine how to extract individual tree positions from height raster
- Estimate data volume for a typical property query
- Evaluate client-side vs server-side processing

### Phase 2: Integration

- Fetch canopy height tile for user's location
- Convert height raster to tree markers (peak detection or clustering)
- Estimate canopy radius from height (species-agnostic heuristic)
- Render as editable tree markers on map

### Phase 3: User Refinement

- Let users delete auto-detected trees (tree was cut)
- Let users add trees (new planting, missed by satellite)
- Let users adjust height/canopy (correct estimation errors)
- Distinguish "satellite-detected" vs "user-added" trees visually

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│  User navigates to location                                 │
├─────────────────────────────────────────────────────────────┤
│  Fetch canopy height GeoTIFF tile from AWS S3               │
├─────────────────────────────────────────────────────────────┤
│  Process raster → extract tree positions + heights          │
├─────────────────────────────────────────────────────────────┤
│  Render as editable markers (same as S-020 manual trees)    │
├─────────────────────────────────────────────────────────────┤
│  User refines → merged with auto-detected                   │
├─────────────────────────────────────────────────────────────┤
│  Calculate shadows using combined tree set                  │
└─────────────────────────────────────────────────────────────┘
```

## Open Questions

- What's the resolution of the global dataset? Sufficient for residential properties?
- How to convert height raster to discrete tree positions?
- Client-side GeoTIFF processing feasible, or need a backend?
- How stale is the data? (Satellite capture dates vary)
- Can we estimate tree type (deciduous vs evergreen) from height/shape?

## Risks

| Risk | Mitigation |
|------|------------|
| Data resolution too coarse for residential | Fall back to manual placement (S-020 baseline) |
| GeoTIFF processing too heavy for browser | Add lightweight backend tile service |
| Tree detection misses small trees | User can add manually |
| Dataset discontinued | We've already built manual placement |

## Success Criteria

1. Trees auto-populate when user navigates to a location with forest cover
2. Auto-detected trees are reasonably accurate (>70% match reality)
3. Users can refine without confusion about what's auto vs manual
4. Performance acceptable (<3s to load trees for a property)

## References

- [Meta Data for Good - Forests](https://registry.opendata.aws/dataforgood-fb-forests/)
- [GeoTIFF.js](https://geotiffjs.github.io/) - browser-side GeoTIFF parsing
- Ted Piotrowski (ShadeMap developer) pointed us to this dataset
