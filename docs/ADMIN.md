# Admin Portal & Backup Guide

## Admin Portal
- Full CRUD for users, characters, scenes, and more.
- Audit log viewing and management.
- Error log dashboard for monitoring and resolution.
- **User Messages** lets admins search for a user and send a private inbox message using custom text or the issue-report thank-you template. The template provides selectable Pro gifts (1, 3, 6, or 12 months) and credit gifts (100, 500, 1,000, 2,000, 8,000, or 15,000 credits). Selected rewards are granted when the message is sent; Pro gifts use the same calendar-month extension behavior as the User panel. Problem Reports also links directly to a message for the report submitter.

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
