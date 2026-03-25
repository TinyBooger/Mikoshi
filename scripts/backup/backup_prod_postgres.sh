#!/bin/bash
# Production Postgres logical backup script
# Usage: ./backup_prod_postgres.sh [daily|weekly]
# Default: daily

set -euo pipefail


# --- CONFIG ---
# On production, repo root is /opt/repos/var/www/Mikoshi
REPO_ROOT="/opt/repos/var/www/Mikoshi"
BACKUP_CLASS="${1:-daily}"
BACKUP_ROOT="$REPO_ROOT/backups"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_FILE="${BACKUP_ROOT}/${BACKUP_CLASS}_backup_${TIMESTAMP}.sql.gz"
LOG_FILE="${BACKUP_ROOT}/backup_${BACKUP_CLASS}_${TIMESTAMP}.log"

# These should match docker-compose.prod.yml
POSTGRES_CONTAINER="mikoshi-postgres-1"  # Adjust if service name differs
POSTGRES_DB="mydb"
POSTGRES_USER="user"
POSTGRES_PASSWORD="password"

# Load secrets from .env if present
ENV_FILE="$(dirname "$0")/../../secrets/Mikoshi-production.env"
if [ -f "$ENV_FILE" ]; then
    export $(grep -v '^#' "$ENV_FILE" | xargs)
    POSTGRES_DB="${POSTGRES_DB:-$POSTGRES_DB}"
    POSTGRES_USER="${POSTGRES_USER:-$POSTGRES_USER}"
    POSTGRES_PASSWORD="${POSTGRES_PASSWORD:-$POSTGRES_PASSWORD}"
fi

# Ensure backup root exists
mkdir -p "$BACKUP_ROOT"

# Run pg_dump inside the Postgres container
{
    echo "[$(date)] Starting backup: $BACKUP_FILE"
    docker exec -e PGPASSWORD="$POSTGRES_PASSWORD" "$POSTGRES_CONTAINER" \
        pg_dump -U "$POSTGRES_USER" "$POSTGRES_DB" | gzip > "$BACKUP_FILE"
    echo "[$(date)] Backup complete: $BACKUP_FILE"
    ls -lh "$BACKUP_FILE"
} > "$LOG_FILE" 2>&1

EXIT_CODE=$?
if [ $EXIT_CODE -eq 0 ]; then
    echo "Backup succeeded: $BACKUP_FILE"
else
    echo "Backup FAILED. See log: $LOG_FILE" >&2
fi
exit $EXIT_CODE
