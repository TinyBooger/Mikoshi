# Backup Scripts

## Production Postgres Backup
- Use scripts/backup/backup_prod_postgres.sh for daily/weekly backups.
- Store backups in backups/ under repo root.
- Run from Docker host, not inside container.
- Automate with cron or systemd.
- Restore with gunzip and psql.
