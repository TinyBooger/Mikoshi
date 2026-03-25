# Mikoshi Production Postgres Backup Scripts

## backup_prod_postgres.sh

Creates a compressed logical backup of the production Postgres database running in Docker.

- Usage: `./backup_prod_postgres.sh [daily|weekly]`
- Default class: `daily`
- Output: `backups/daily_backup_YYYYMMDD_HHMMSS.sql.gz` (or `weekly_backup_...`) inside your repo root (`/opt/repos/var/www/Mikoshi/backups` on production)
- Logs: `backups/backup_daily_YYYYMMDD_HHMMSS.log`

### Production Path Note
- On production, the repository root is `/opt/repos/var/www/Mikoshi` (not `Mikoshi_MonoRepo`).
- The backup script is designed to run from the host, referencing this path for any relative lookups.
- Backups are now stored in `backups/` under your repository root on the production server.

### Requirements
- Run from the Docker host (not inside a container)
- Docker must be running
- Adjust `POSTGRES_CONTAINER`, `POSTGRES_DB`, `POSTGRES_USER`, and `POSTGRES_PASSWORD` as needed to match your production setup
- Optionally, set secrets in `secrets/Mikoshi-production.env`

### Example (manual run)
```sh
bash scripts/backup/backup_prod_postgres.sh daily
```

### Scheduling
- Use host cron or systemd timer to automate daily/weekly runs
- Ensure `backups/` under your repo root is writable by the user running the script

### Restore
- To restore, use `gunzip -c backupfile.sql.gz | psql -U user -d mydb` inside the Postgres container

---

For retention and restore helpers, see future scripts in this folder.