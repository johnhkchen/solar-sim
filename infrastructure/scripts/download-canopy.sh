#!/usr/bin/env bash
# =============================================================================
# Download Bay Area Canopy Height Tiles
# Fetches the 16 QuadKey tiles covering the SF Bay Area (9 counties)
# =============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DATA_DIR="${SCRIPT_DIR}/../data/canopy"

# Meta/WRI canopy height data on AWS S3 (public, no auth required)
BASE_URL="https://dataforgood-fb-data.s3.amazonaws.com/forests/v1/alsgedi_global_v6_float/chm"

# Bay Area QuadKeys at zoom level 9
# Bounding box: 36.9°N to 38.9°N, 123.5°W to 121.0°W
QUADKEYS=(
    "023010200" "023010201" "023010202" "023010203"
    "023010210" "023010211" "023010212" "023010213"
    "023010220" "023010221" "023010222" "023010223"
    "023010230" "023010231" "023010232" "023010233"
)

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo "========================================"
echo "Solar-Sim Canopy Tile Downloader"
echo "========================================"
echo ""
echo "Downloading ${#QUADKEYS[@]} tiles for Bay Area coverage"
echo "Destination: ${DATA_DIR}"
echo ""

# Create data directory
mkdir -p "${DATA_DIR}"

# Track progress
total=${#QUADKEYS[@]}
downloaded=0
skipped=0
failed=0

for qk in "${QUADKEYS[@]}"; do
    file="${DATA_DIR}/${qk}.tif"
    url="${BASE_URL}/${qk}.tif"

    # Check if file already exists with reasonable size (>1MB)
    if [[ -f "${file}" ]] && [[ $(stat -f%z "${file}" 2>/dev/null || stat -c%s "${file}" 2>/dev/null) -gt 1000000 ]]; then
        echo -e "${YELLOW}[SKIP]${NC} ${qk}.tif already exists"
        ((skipped++))
        continue
    fi

    echo -n "Downloading ${qk}.tif... "

    # Download with curl, showing progress for large files
    if curl -fSL --progress-bar -o "${file}.tmp" "${url}"; then
        mv "${file}.tmp" "${file}"
        size=$(du -h "${file}" | cut -f1)
        echo -e "${GREEN}[OK]${NC} ${size}"
        ((downloaded++))
    else
        echo -e "${RED}[FAILED]${NC}"
        rm -f "${file}.tmp"
        ((failed++))
    fi
done

echo ""
echo "========================================"
echo "Download Complete"
echo "========================================"
echo "  Downloaded: ${downloaded}"
echo "  Skipped:    ${skipped}"
echo "  Failed:     ${failed}"
echo ""

# Calculate total size
total_size=$(du -sh "${DATA_DIR}" 2>/dev/null | cut -f1 || echo "unknown")
echo "Total size: ${total_size}"

# Verify all tiles present
missing=0
for qk in "${QUADKEYS[@]}"; do
    if [[ ! -f "${DATA_DIR}/${qk}.tif" ]]; then
        echo -e "${RED}Missing: ${qk}.tif${NC}"
        ((missing++))
    fi
done

if [[ ${missing} -eq 0 ]]; then
    echo -e "${GREEN}All Bay Area tiles present!${NC}"
    exit 0
else
    echo -e "${RED}${missing} tiles missing. Re-run to retry downloads.${NC}"
    exit 1
fi
