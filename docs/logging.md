# Logging & Error Tracking

## Error Logging System
- Centralized error tracking for backend (FastAPI) and frontend (React).
- Automatic capture of exceptions, HTTP errors, and frontend errors.
- Persistent storage in PostgreSQL and file logs.
- Admin dashboard for error review and resolution.
- Bulk management, filtering, and real-time statistics.

## Audit Log System
- Tracks security- and business-relevant user/admin actions in the `audit_logs` table.
- Covers authentication, account security, payments, admin user management, moderation, content deletion and content/system administration.
- Written via `audit_request(request, action, user_id, metadata)` or `record_audit(...)` from `backend/utils/audit_logger.py`.
- Read API: `GET /api/audit-logs`; UI: `/admin/audit-logs`.
- The full action taxonomy lives in [backend/utils/AUDIT_LOGGING.md](../backend/utils/AUDIT_LOGGING.md).
