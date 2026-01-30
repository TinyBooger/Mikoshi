# Audit Log System

Simple operation logging system for tracking user actions.

## Database Table: `audit_logs`

| Column | Type | Description |
|--------|------|-------------|
| `id` | Integer | Primary key |
| `user_id` | String | User performing the action (nullable for anonymous) |
| `action` | String | Type of operation (e.g., "login", "register") |
| `timestamp` | DateTime | When the operation occurred (auto-generated) |
| `ip_address` | String | Client IP address |
| `user_agent` | Text | Browser/client user agent string |
| `metadata` | JSONB | Additional context (endpoint, method, resource_id, etc.) |
| `status` | String | Operation status: "success", "failure", or "error" |
| `error_message` | Text | Error details if status is not success |

## Routes Using Audit Logs

### Authentication Routes (`routes/auth.py`)
- `POST /api/users` - register (success)
- `POST /api/login` - login, login_failed (success/failure)
- `POST /api/reset-password` - reset_password, reset_password_failed (success/failure)
- `POST /api/change-password` - change_password, change_password_failed (success/failure)

## Setup

Run the migration to create the audit_logs table:
```bash
cd backend
python migrations/add_audit_logs.py
```

## Admin Access

View audit logs at: `/admin/audit-logs` (admin only)
