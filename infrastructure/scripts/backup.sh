#!/usr/bin/env bash
# =============================================================================
# Solar-Sim Backup Script
# Creates encrypted backups and uploads to Backblaze B2 (or local storage)
# =============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
INFRA_DIR="${SCRIPT_DIR}/.."
DATA_DIR="${INFRA_DIR}/data"
BACKUP_DIR="${DATA_DIR}/backups"

# Configuration (override via environment)
BACKUP_ENCRYPTION_KEY="${BACKUP_ENCRYPTION_KEY:-}"
B2_BUCKET="${B2_BUCKET:-}"
B2_KEY_ID="${B2_KEY_ID:-}"
B2_APPLICATION_KEY="${B2_APPLICATION_KEY:-}"
RETENTION_DAYS="${RETENTION_DAYS:-30}"

# Timestamp for backup files
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_NAME="solar-sim-backup-${TIMESTAMP}"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

log() { echo -e "${GREEN}[BACKUP]${NC} $1"; }
warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
error() { echo -e "${RED}[ERROR]${NC} $1"; }

# Create backup directory
mkdir -p "${BACKUP_DIR}"

log "Starting backup: ${BACKUP_NAME}"

# =============================================================================
# 1. PostgreSQL Database Dump
# =============================================================================
log "Dumping PostgreSQL database..."

# Check if running in Docker context
if docker ps --filter "name=solar-sim-db" --format "{{.Names}}" | grep -q solar-sim-db; then
    docker exec solar-sim-db pg_dump -U solar solar_sim > "${BACKUP_DIR}/${BACKUP_NAME}-postgres.sql"
    log "Database dump complete"
else
    warn "PostgreSQL container not running, skipping database backup"
fi

# =============================================================================
# 2. Climate Cache
# =============================================================================
if [[ -d "${DATA_DIR}/climate" ]]; then
    log "Backing up climate cache..."
    tar -czf "${BACKUP_DIR}/${BACKUP_NAME}-climate.tar.gz" -C "${DATA_DIR}" climate
    log "Climate cache backup complete"
else
    warn "No climate cache found, skipping"
fi

# =============================================================================
# 3. Environment and Configuration
# =============================================================================
log "Backing up configuration..."
config_files=()

# Collect config files that exist
[[ -f "${INFRA_DIR}/.env" ]] && config_files+=("${INFRA_DIR}/.env")
[[ -f "${INFRA_DIR}/docker/docker-compose.yml" ]] && config_files+=("${INFRA_DIR}/docker/docker-compose.yml")

if [[ ${#config_files[@]} -gt 0 ]]; then
    tar -czf "${BACKUP_DIR}/${BACKUP_NAME}-config.tar.gz" "${config_files[@]}" 2>/dev/null || true
    log "Configuration backup complete"
fi

# =============================================================================
# 4. Create Combined Archive
# =============================================================================
log "Creating combined archive..."

# Find all backup parts
backup_parts=$(find "${BACKUP_DIR}" -name "${BACKUP_NAME}-*" -type f)

if [[ -n "${backup_parts}" ]]; then
    tar -czf "${BACKUP_DIR}/${BACKUP_NAME}.tar.gz" -C "${BACKUP_DIR}" \
        $(echo "${backup_parts}" | xargs -n1 basename)

    # Remove individual parts
    echo "${backup_parts}" | xargs rm -f

    ARCHIVE="${BACKUP_DIR}/${BACKUP_NAME}.tar.gz"
    log "Archive created: ${ARCHIVE}"
else
    error "No backup files created"
    exit 1
fi

# =============================================================================
# 5. Encrypt (Optional)
# =============================================================================
if [[ -n "${BACKUP_ENCRYPTION_KEY}" ]]; then
    log "Encrypting backup..."
    openssl enc -aes-256-cbc -salt -pbkdf2 \
        -in "${ARCHIVE}" \
        -out "${ARCHIVE}.enc" \
        -pass "pass:${BACKUP_ENCRYPTION_KEY}"
    rm -f "${ARCHIVE}"
    ARCHIVE="${ARCHIVE}.enc"
    log "Encryption complete"
fi

# =============================================================================
# 6. Upload to Backblaze B2 (Optional)
# =============================================================================
if [[ -n "${B2_BUCKET}" ]] && [[ -n "${B2_KEY_ID}" ]] && [[ -n "${B2_APPLICATION_KEY}" ]]; then
    log "Uploading to Backblaze B2..."

    # Check for b2 CLI
    if ! command -v b2 &> /dev/null; then
        warn "b2 CLI not installed, skipping cloud upload"
        warn "Install with: pip install b2"
    else
        # Authorize
        b2 authorize-account "${B2_KEY_ID}" "${B2_APPLICATION_KEY}" > /dev/null

        # Upload
        b2 upload-file "${B2_BUCKET}" "${ARCHIVE}" "backups/$(basename "${ARCHIVE}")"
        log "Upload complete"

        # Clean up local file after successful upload
        rm -f "${ARCHIVE}"
        log "Local archive removed after upload"
    fi
else
    log "No B2 credentials configured, keeping local backup"
fi

# =============================================================================
# 7. Cleanup Old Backups
# =============================================================================
log "Cleaning up backups older than ${RETENTION_DAYS} days..."

# Local cleanup
find "${BACKUP_DIR}" -name "solar-sim-backup-*" -type f -mtime "+${RETENTION_DAYS}" -delete 2>/dev/null || true

# B2 cleanup (if configured)
if [[ -n "${B2_BUCKET}" ]] && command -v b2 &> /dev/null; then
    # List and delete old files
    cutoff_date=$(date -d "-${RETENTION_DAYS} days" +%Y%m%d 2>/dev/null || date -v-${RETENTION_DAYS}d +%Y%m%d)
    b2 ls "${B2_BUCKET}" backups/ | while read -r file; do
        file_date=$(echo "${file}" | grep -oE '[0-9]{8}' | head -1)
        if [[ -n "${file_date}" ]] && [[ "${file_date}" < "${cutoff_date}" ]]; then
            log "Deleting old backup: ${file}"
            b2 delete-file-version "${file}" > /dev/null 2>&1 || true
        fi
    done
fi

# =============================================================================
# Summary
# =============================================================================
log "========================================="
log "Backup Complete"
log "========================================="

if [[ -f "${ARCHIVE}" ]]; then
    size=$(du -h "${ARCHIVE}" | cut -f1)
    log "Archive: ${ARCHIVE}"
    log "Size: ${size}"
else
    log "Backup uploaded to B2: ${B2_BUCKET}/backups/$(basename "${ARCHIVE}")"
fi
