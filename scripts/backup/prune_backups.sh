#!/bin/bash
# Prune old backups according to retention policy
# Keeps daily backups for 7 days, weekly backups for 1 month
# Usage: ./prune_backups.sh

set -euo pipefail

REPO_ROOT="/opt/repos/var/www/Mikoshi"
BACKUP_ROOT="$REPO_ROOT/backups"
DAILY_KEEP=7
WEEKLY_KEEP=4  # 4 weeks

# Prune daily backups (older than 7 days)
find "$BACKUP_ROOT" -type f -name 'daily_backup_*.sql.gz' -mtime +$((DAILY_KEEP-1)) -print -delete

# Prune weekly backups (older than 28 days)
find "$BACKUP_ROOT" -type f -name 'weekly_backup_*.sql.gz' -mtime +27 -print -delete

# Log result
DATE=$(date)
echo "[$DATE] Pruned old backups in $BACKUP_ROOT (daily>$DAILY_KEEP days, weekly>4 weeks)"