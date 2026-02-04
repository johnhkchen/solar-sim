---
id: T-021-01
title: Research canopy height data format and access
status: complete
priority: 1
complexity: M
depends_on: [T-020-03]
story: S-021
completed_at: 2026-02-01
---

# T-021-01: Research Canopy Height Data Format and Access

## Objective

Understand the Meta/Facebook forests dataset structure, access patterns, and how to extract usable tree data from it.

## Completion Summary

Research completed and documented in `docs/knowledge/research/canopy-height-data.md`. All acceptance criteria met:

1. **Tile structure**: QuadKey-based naming at zoom level 9, with `tiles.geojson` index mapping keys to geographic bounds
2. **Resolution**: 1 meter per pixel globally, using Float32 encoding for heights in meters
3. **Access pattern**: HTTP range requests to S3 bucket `dataforgood-fb-data` without authentication, using Cloud Optimized GeoTIFF format for partial fetches
4. **GeoTIFF format**: BigTIFF files (~20MB per tile) with COG internal structure, parseable via GeoTIFF.js in browser or Node
5. **Data freshness**: Metadata GeoJSONs contain `acq_date` per polygon, mostly 2018-2020 with some older regions
6. **Documentation**: Full findings in research document including QuadKey conversion algorithm, data encoding, and implementation recommendations

## Key Findings

The dataset provides global 1m-resolution canopy height via free anonymous S3 access. Each tile covers roughly 80km × 80km (varies with latitude) and includes accompanying mask files for NoData regions. The 2.8m mean absolute error in height predictions is acceptable for shadow calculations. GeoTIFF.js can fetch partial tiles via HTTP range requests, making client-side processing feasible for residential-scale areas.

## References

- [Dataset registry](https://registry.opendata.aws/dataforgood-fb-forests/)
- [GeoTIFF.js](https://geotiffjs.github.io/)
- [Research document](../../knowledge/research/canopy-height-data.md)
