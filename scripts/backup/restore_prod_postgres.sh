#!/bin/bash
# Restore production Postgres from a backup file
# Usage: ./restore_prod_postgres.sh <backupfile.sql.gz> [target_db]

set -euo pipefail


# On production, repo root is /opt/repos/var/www/Mikoshi
REPO_ROOT="/opt/repos/var/www/Mikoshi"
BACKUP_FILE="$1"
TARGET_DB="${2:-mydb}"
POSTGRES_CONTAINER="mikoshi-postgres-1"  # Adjust if service name differs
POSTGRES_USER="user"
POSTGRES_PASSWORD="password"

if [ ! -f "$BACKUP_FILE" ]; then
    echo "Backup file not found: $BACKUP_FILE" >&2
    exit 1
fi

# Confirm before destructive restore
read -p "Are you sure you want to restore $BACKUP_FILE to database $TARGET_DB in container $POSTGRES_CONTAINER? This will overwrite data. Type YES to continue: " CONFIRM
if [ "$CONFIRM" != "YES" ]; then
    echo "Restore cancelled."
    exit 2
fi

# Load secrets from .env if present
ENV_FILE="$(dirname "$0")/../../secrets/Mikoshi-production.env"
if [ -f "$ENV_FILE" ]; then
    export $(grep -v '^#' "$ENV_FILE" | xargs)
    POSTGRES_USER="${POSTGRES_USER:-$POSTGRES_USER}"
    POSTGRES_PASSWORD="${POSTGRES_PASSWORD:-$POSTGRES_PASSWORD}"
fi

# Run restore inside the Postgres container
cat "$BACKUP_FILE" | gunzip | docker exec -i -e PGPASSWORD="$POSTGRES_PASSWORD" "$POSTGRES_CONTAINER" psql -U "$POSTGRES_USER" "$TARGET_DB"

EXIT_CODE=$?
if [ $EXIT_CODE -eq 0 ]; then
    echo "Restore succeeded."
else
    echo "Restore FAILED." >&2
fi
exit $EXIT_CODE
