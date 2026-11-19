#!/bin/bash
# Daily Postgres dump to the data disk, keeping the last 14 days.
set -euo pipefail

DEST=/home/lighthouse/lhcos-data/backups
OUT="$DEST/db_$(date +%F).sql.gz"

mkdir -p "$DEST"
docker exec -e PGPASSWORD=password mikoshi-postgres-1 \
    pg_dump -U user mydb | gzip > "$OUT.tmp"
mv "$OUT.tmp" "$OUT"

find "$DEST" -name 'db_*.sql.gz' -mtime +13 -delete
