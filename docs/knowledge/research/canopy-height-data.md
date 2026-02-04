# Canopy Height Data: Meta/WRI Global Forests Dataset

This document presents findings from researching the Meta/World Resources Institute High Resolution Canopy Height Maps dataset. The goal is to understand the data format, access patterns, and processing requirements so we can auto-populate trees on the map from satellite-derived height measurements rather than requiring users to manually place every tree.

## Executive Summary

The Meta/WRI dataset provides global canopy height at 1-meter resolution via Cloud Optimized GeoTIFFs on AWS S3 with free, anonymous access. Files use QuadKey-based naming at zoom level 9, where each tile covers roughly 0.7° longitude by 0.5° latitude and weighs about 20MB. The data encodes height as Float32 meters with accompanying boolean mask files indicating valid pixels. For our use case, we need to fetch tiles via HTTP range requests using GeoTIFF.js, extract the portion covering the user's view, and run local maxima detection to convert the continuous height raster into discrete tree positions. The dataset's 2.8m mean absolute error for height predictions is acceptable for shadow calculations since a 3m error on a 15m tree changes shadow length by only about 20%.

## Dataset Overview

Meta and the World Resources Institute released this dataset in 2024 as part of Meta's Data for Good program. The underlying model uses a self-supervised vision transformer (DiNOv2 backbone) trained on 18 million satellite images, paired with a convolutional decoder that predicts canopy height from Maxar's 0.5m Vivid2 satellite imagery. The model was trained against airborne LiDAR ground truth from the NEON network, achieving a mean absolute error of 2.8 meters on validation data.

The dataset covers all global land area with imagery primarily from 2018-2020, though some regions have older source data dating back to 2009. Each tile includes metadata files indicating the acquisition date for the underlying imagery, so users can know how current the tree data is for their specific area.

## File Structure and Access

The data lives in the public S3 bucket `dataforgood-fb-data` under the path `forests/v1/alsgedi_global_v6_float/`. The bucket allows anonymous access via standard HTTPS requests without any AWS credentials. The primary directory structure contains `chm/` for canopy height GeoTIFFs, `msk/` for validity mask files, and `metadata/` for acquisition date GeoJSONs, along with a `tiles.geojson` index that maps QuadKeys to geographic bounding boxes.

Tiles use the Bing Maps QuadKey naming convention at zoom level 9. A QuadKey encodes tile position as a base-4 string where each digit subdivides the map into quadrants: 0 for top-left, 1 for top-right, 2 for bottom-left, and 3 for bottom-right. The 9-digit QuadKeys in this dataset mean each tile covers 1/262,144th of the map area, which works out to roughly 80km × 80km at the equator and smaller at higher latitudes due to Mercator projection. File sizes run approximately 20MB for height tiles and 6MB for mask files.

The files use BigTIFF format (necessary because individual tiles exceed 4GB uncompressed at 1m resolution) with Cloud Optimized GeoTIFF (COG) internal organization. This means clients can fetch arbitrary rectangular subregions via HTTP range requests without downloading the entire file. For a typical residential property covering a 200m × 200m area, we'd need to fetch only about 0.2% of the tile data.

## Data Encoding

Height values are stored as Float32 numbers representing meters above ground. Valid measurements range from approximately 1m (the minimum detectable vegetation height) up to about 70m for the tallest trees. The mask files (`*.tif.msk`) contain boolean values where true indicates valid data and false indicates NoData, typically caused by cloud cover in the source satellite imagery.

The downsampled EPSG:4326 version of the dataset uses UInt16 encoding with heights in centimeters and 65535 as the NoData value. This variant provides aggregated statistics like average, median, P95 height, and cover percentage at approximately 25m resolution. While useful for regional analysis, the full-resolution Float32 tiles are necessary for our tree detection use case.

## QuadKey Conversion Algorithm

Converting a latitude/longitude coordinate to a QuadKey requires three steps. First, project the coordinate to Web Mercator pixel space using the formulas `x = (longitude + 180) / 360` and `y = 0.5 - log((1 + sin(lat)) / (1 - sin(lat))) / (4 * pi)`, then scale to the pixel dimensions at the target zoom level. Second, convert pixel coordinates to tile coordinates by integer division by 256 (the standard tile size). Third, interleave the binary bits of the tile X and Y coordinates and interpret the result as a base-4 number to get the QuadKey string.

For example, a location at 37.7749° N, 122.4194° W (San Francisco) at zoom level 9 produces tile coordinates (81, 197), which interleave to QuadKey "021203020". The `tiles.geojson` file provides a reverse lookup from QuadKey to geographic bounds, which is useful for verifying our calculations and for spatial queries.

## Integration Approach

The GeoTIFF.js library handles COG format and HTTP range requests in both browser and Node.js environments. Our implementation should fetch the `tiles.geojson` index on first load and cache it locally, then when the user navigates to a location, identify the relevant QuadKey(s) for their viewport, request only the pixel region covering their view using COG's internal tiling, and process the height raster to extract tree positions.

For tree extraction, we'll run a local maxima detection algorithm on the height data. A simple approach finds pixels that are higher than all their neighbors within some radius, which identifies tree crowns as distinct peaks in the height surface. Each detected maximum becomes a tree marker with position from the pixel coordinates, height from the pixel value, and estimated canopy radius from the half-width of the height peak. More sophisticated approaches could use watershed segmentation or machine learning, but local maxima detection should suffice for our shadow calculation needs.

Performance considerations favor client-side processing for typical residential use cases. A 200m × 200m area contains 40,000 pixels at 1m resolution, which is easily processed in JavaScript. For larger areas or denser forests, we might need to downsample or implement progressive loading. The COG format's internal tiling (typically 256×256 or 512×512 blocks) aligns well with efficient partial fetches.

## Data Quality and Limitations

The 2.8m mean absolute error in height predictions represents the primary quality limitation. For shadow calculations, this translates to roughly ±20% error in shadow length for typical residential trees. A 15m tree casting a noon shadow might show as anywhere from 12m to 18m in the data, producing shadows that differ by a few meters. This accuracy is acceptable for gardening guidance since the difference between "full shade" and "partial shade" categories is much larger than these measurement errors.

Temporal staleness varies by region. The metadata GeoJSONs contain `acq_date` fields indicating when the source imagery was captured, with most areas showing 2018-2020 dates. Trees planted since then won't appear in the data, and trees removed won't reflect current conditions. Our UI should show the acquisition date so users understand when to add or remove trees manually.

The minimum detectable height of approximately 1m means shrubs and small newly-planted trees won't appear. This is fine for shadow calculations since vegetation under 2-3m rarely casts significant shadows on a garden bed. Edge effects occur at tile boundaries where processing artifacts can cause discontinuities, though these are relatively rare and shouldn't significantly affect residential-scale analysis.

## Alternative Data Sources

The Global Ecosystem Dynamics Investigation (GEDI) LiDAR mission provides complementary canopy height data from the International Space Station, but at 25m resolution it's too coarse for individual tree detection. Sentinel-2 multispectral imagery enables vegetation detection but not height measurement without additional modeling. Commercial providers like Planet Labs offer higher-frequency imagery but require paid subscriptions and don't directly provide height measurements.

For our purposes, the Meta/WRI dataset uniquely combines global coverage, individual-tree resolution, free access, and direct height measurements. No alternative matches all four criteria.

## Recommendations for Implementation

The tile fetching service (T-021-03) should implement a local cache for tiles since users will likely return to the same location multiple times. Cache keys should include the QuadKey, and cache invalidation can be time-based since the underlying data updates infrequently. The service should handle tile boundaries gracefully by fetching adjacent tiles when the viewport spans a QuadKey boundary.

The tree extraction algorithm (T-021-02) should start with simple local maxima detection using a configurable search radius of approximately 3-5m, which works well for typical suburban tree spacing. The algorithm should expose detected trees as the same data structure used by manually-placed trees so they integrate seamlessly with our existing shadow calculation code. A flag distinguishing auto-detected from user-added trees enables the refinement UX where users can delete incorrect detections or adjust properties.

For testing during development, QuadKey "023013213" covers part of Southern California including suburban areas with clear tree signatures. This tile is available at the URL `https://dataforgood-fb-data.s3.amazonaws.com/forests/v1/alsgedi_global_v6_float/chm/023013213.tif` and provides a good test case with mixed vegetation densities.

## References

The dataset is documented at the AWS Open Data Registry at https://registry.opendata.aws/dataforgood-fb-forests/. The underlying model architecture is described in the paper "Very high resolution canopy height maps from RGB imagery using self-supervised vision transformer and convolutional decoder trained on aerial lidar" published in Remote Sensing of Environment. The model code is available at https://github.com/facebookresearch/HighResCanopyHeight. The Bing Maps tile system documentation at https://learn.microsoft.com/en-us/bingmaps/articles/bing-maps-tile-system provides the authoritative reference for QuadKey encoding and conversion algorithms.
