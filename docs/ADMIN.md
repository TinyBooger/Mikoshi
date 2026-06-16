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

### Crontab (production — as root)
```
# Daily backup at 2 AM
0 2 * * * cd /opt/repos/var/www/Mikoshi && bash scripts/backup/backup_prod_postgres.sh daily

# Weekly backup every Sunday at 3 AM
0 3 * * 0 cd /opt/repos/var/www/Mikoshi && bash scripts/backup/backup_prod_postgres.sh weekly

# Prune old backups at 4 AM daily (dailies > 7 days, weeklies > 4 weeks)
0 4 * * * cd /opt/repos/var/www/Mikoshi && bash scripts/backup/prune_backups.sh
```

### Retention Policy
| Class   | Kept For     |
|---------|--------------|
| Daily   | 7 days       |
| Weekly  | 4 weeks      |

### Troubleshooting
- Check cron output: `cat /var/mail/root`
- Verify crontab is active: `crontab -l`
- Check cron daemon is running: `systemctl status cron`
- If backups aren't appearing, check the script's exit code by running it manually: `bash -x scripts/backup/backup_prod_postgres.sh daily`
- Make sure `backups/` directory exists and is writable
