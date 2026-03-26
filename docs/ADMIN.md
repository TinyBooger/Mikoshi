# Admin Portal & Backup Guide

## Admin Portal
- Full CRUD for users, characters, scenes, and more.
- Audit log viewing and management.
- Error log dashboard for monitoring and resolution.

## Database Backup & Restore
- Use scripts in scripts/backup/ for daily/weekly backups.
- Backups stored in backups/ under repo root.
- Automate with cron or systemd timers.
- Restore with gunzip and psql.

## Automation
- Example crontab entries for backup and retention.
- Troubleshooting tips for automation and permissions.
