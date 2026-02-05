"""
Cached proxy views for external APIs.

These endpoints cache responses from external services (Overpass, Open-Meteo, canopy tiles)
to reduce API calls during development and improve production performance.
"""

import hashlib
import logging

import httpx
from django.conf import settings
from django.core.cache import cache
from django.http import FileResponse, JsonResponse
from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import APIView

logger = logging.getLogger(__name__)


def health_check(request):
    """Simple health check endpoint."""
    return JsonResponse({"status": "ok", "service": "solar-sim-api"})


class OverpassProxyView(APIView):
    """
    Proxy for Overpass API queries.

    Caches building footprint queries by bounding box. In production with self-hosted
    Overpass, this becomes a simple pass-through. In development, it reduces hits to
    the public Overpass API.
    """

    permission_classes = []  # Public endpoint
    throttle_classes = []  # We handle our own rate limiting via cache

    def post(self, request):
        query = request.data.get("query", "")
        if not query:
            return Response(
                {"error": "Missing 'query' parameter"}, status=status.HTTP_400_BAD_REQUEST
            )

        # Cache key based on query hash
        cache_key = f"overpass:{hashlib.sha256(query.encode()).hexdigest()[:16]}"
        cached = cache.get(cache_key)
        if cached:
            logger.debug(f"Overpass cache hit: {cache_key}")
            return Response(cached)

        # Fetch from upstream
        try:
            with httpx.Client(timeout=60.0) as client:
                response = client.post(
                    settings.OVERPASS_URL,
                    data={"data": query},
                    headers={"Content-Type": "application/x-www-form-urlencoded"},
                )
                response.raise_for_status()
                data = response.json()
        except httpx.TimeoutException:
            logger.warning(f"Overpass timeout for query: {query[:100]}...")
            return Response(
                {"error": "Overpass API timeout"}, status=status.HTTP_504_GATEWAY_TIMEOUT
            )
        except httpx.HTTPStatusError as e:
            logger.error(f"Overpass error: {e.response.status_code}")
            return Response(
                {"error": f"Overpass API error: {e.response.status_code}"},
                status=status.HTTP_502_BAD_GATEWAY,
            )
        except Exception as e:
            logger.exception("Overpass proxy error")
            return Response(
                {"error": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

        # Cache and return
        cache.set(cache_key, data, settings.CACHE_TTL_OVERPASS)
        logger.info(f"Overpass cache miss, stored: {cache_key}")
        return Response(data)


class ClimateProxyView(APIView):
    """
    Proxy for Open-Meteo historical climate API.

    Caches 30-year temperature history by location. Climate data is historical and
    doesn't change, so long cache TTLs are safe.
    """

    permission_classes = []
    throttle_classes = []

    def get(self, request):
        lat = request.query_params.get("lat")
        lng = request.query_params.get("lng")

        if not lat or not lng:
            return Response(
                {"error": "Missing 'lat' and 'lng' parameters"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            lat_f = float(lat)
            lng_f = float(lng)
        except ValueError:
            return Response(
                {"error": "Invalid lat/lng values"}, status=status.HTTP_400_BAD_REQUEST
            )

        # Round to 2 decimal places for cache efficiency (~1km precision)
        lat_r = round(lat_f, 2)
        lng_r = round(lng_f, 2)
        cache_key = f"climate:{lat_r}:{lng_r}"

        cached = cache.get(cache_key)
        if cached:
            logger.debug(f"Climate cache hit: {cache_key}")
            return Response(cached)

        # Fetch 30 years of daily min/max temperatures
        try:
            with httpx.Client(timeout=30.0) as client:
                response = client.get(
                    settings.OPEN_METEO_URL,
                    params={
                        "latitude": lat_r,
                        "longitude": lng_r,
                        "start_date": "1994-01-01",
                        "end_date": "2024-12-31",
                        "daily": "temperature_2m_max,temperature_2m_min",
                        "timezone": "auto",
                    },
                )
                response.raise_for_status()
                data = response.json()
        except httpx.TimeoutException:
            return Response(
                {"error": "Climate API timeout"}, status=status.HTTP_504_GATEWAY_TIMEOUT
            )
        except httpx.HTTPStatusError as e:
            return Response(
                {"error": f"Climate API error: {e.response.status_code}"},
                status=status.HTTP_502_BAD_GATEWAY,
            )
        except Exception as e:
            logger.exception("Climate proxy error")
            return Response(
                {"error": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

        cache.set(cache_key, data, settings.CACHE_TTL_CLIMATE)
        logger.info(f"Climate cache miss, stored: {cache_key}")
        return Response(data)


class CanopyTileView(APIView):
    """
    Proxy for Meta/WRI canopy height GeoTIFF tiles.

    In production, tiles are served from local storage. This proxy handles cache
    misses by fetching from AWS S3 and storing locally.
    """

    permission_classes = []
    throttle_classes = []

    def get(self, request, quadkey: str):
        # Validate quadkey format (should be digits 0-3 only)
        if not quadkey or not all(c in "0123" for c in quadkey):
            return Response(
                {"error": "Invalid quadkey format"}, status=status.HTTP_400_BAD_REQUEST
            )

        # Check local file cache first
        import os
        local_path = os.path.join(settings.BASE_DIR, "data", "canopy", f"{quadkey}.tif")
        if os.path.exists(local_path):
            logger.debug(f"Canopy tile from disk: {quadkey}")
            return FileResponse(open(local_path, "rb"), content_type="image/tiff")

        # Check Valkey cache for tile bytes
        cache_key = f"canopy:{quadkey}"
        cached = cache.get(cache_key)
        if cached:
            logger.debug(f"Canopy tile from cache: {quadkey}")
            from django.http import HttpResponse
            return HttpResponse(cached, content_type="image/tiff")

        # Fetch from S3
        tile_url = f"{settings.CANOPY_TILE_URL}/{quadkey}.tif"
        try:
            with httpx.Client(timeout=60.0) as client:
                response = client.get(tile_url)
                response.raise_for_status()
                tile_bytes = response.content
        except httpx.HTTPStatusError as e:
            if e.response.status_code == 404:
                return Response(
                    {"error": "Tile not found"}, status=status.HTTP_404_NOT_FOUND
                )
            return Response(
                {"error": f"Tile fetch error: {e.response.status_code}"},
                status=status.HTTP_502_BAD_GATEWAY,
            )
        except Exception as e:
            logger.exception(f"Canopy tile fetch error: {quadkey}")
            return Response(
                {"error": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

        # Cache in Valkey (tiles are ~20MB, so be mindful of memory)
        # Only cache if under 25MB to avoid memory issues
        if len(tile_bytes) < 25 * 1024 * 1024:
            cache.set(cache_key, tile_bytes, settings.CACHE_TTL_CANOPY)
            logger.info(f"Canopy tile cached: {quadkey} ({len(tile_bytes)} bytes)")

        from django.http import HttpResponse
        return HttpResponse(tile_bytes, content_type="image/tiff")
