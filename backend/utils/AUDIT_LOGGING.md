# Audit Log System

Unified, append-only trail of security- and business-relevant actions. It is the
data source for the admin **Audit Logs** page and for registration analytics
(`users.created_at` backfill, daily user increment).

## Database Table: `audit_logs`

Defined in `utils/audit_logger.py` (not `models.py`).

| Column | Type | Description |
|--------|------|-------------|
| `id` | Integer | Primary key |
| `user_id` | String | Actor. **No FK** — rows survive user deletion. Nullable for anonymous actions. |
| `action` | String(255) | Stable action name (see taxonomy below), indexed |
| `timestamp` | DateTime(tz) | Auto-generated (UTC), indexed |
| `ip_address` | String(45) | Client IP (IPv4/IPv6) |
| `user_agent` | Text | Browser/client user agent |
| `metadata` | JSONB | Free-form context; always includes `endpoint` + `method` when written via `audit_request` |
| `status` | String(20) | `success`, `failure`, or `error` |
| `error_message` | Text | Error detail when status is not `success` |

## How to write an audit row

Two entry points:

```python
# 1) Route-level (preferred). Captures IP, user agent and request metadata.
from utils.audit_logger import audit_request

audit_request(
    request,                       # fastapi.Request
    action="delete_chat",
    user_id=current_user.id,
    metadata={"chat_id": chat_id},
)
```

```python
# 2) Standalone / inside an existing transaction.
from utils.audit_logger import record_audit      # opens its own SessionLocal()
from utils.audit_logger import AuditLog          # db.add(AuditLog(...)) in the caller's transaction

record_audit(user_id=..., action=..., ip_address=..., user_agent=..., metadata=..., status=..., error_message=...)
```

> **Naming caveat:** `get_request_metadata()` merges your `metadata` **over** the
> base dict, so a key named `method` will clobber the HTTP method. Use qualified
> keys (`login_method`, `signup_method`, `reset_method`) as `auth.py` does.

`AuditLog.user_id` has no foreign key, so when auditing a deletion you must
snapshot the identifying fields **before** `db.delete(...)`.

## Action taxonomy

### Authentication & account security
| Action | Source |
|--------|--------|
| `register` | `auth.py` (email), `phone.py` (phone), `admin/users.py` (admin-created) |
| `login` / `login_failed` | `auth.py` |
| `reset_password` / `reset_password_failed` | `password.py` (code flow and token flow) |
| `reset_code_requested` / `reset_code_verified` / `reset_code_verify_failed` | `password.py` (OTP send/verify, phone + email; failed attempts are the abuse signal) |
| `change_password` / `change_password_failed` | `password.py` |
| `change_email` | `user.py` |
| `change_phone` | `user.py` (stores last-4 hints only) |
| `update_profile` | `user.py` |
| `delete_account` | `user.py` (identity snapshot captured pre-delete) |

### Payments
| Action | Source |
|--------|--------|
| `alipay_credit_topup`, `alipay_pro_upgrade` | `alipay.py::_record_order_result` (written in the order-settlement transaction) |
| `wechat_credit_topup`, `wechat_pro_upgrade` | `wechat_pay.py::_record_order_result` |
| `payment_refund` | `alipay.py` / `wechat_pay.py` `refund_order` (`success`/`failure`/`error` + `refund_status` in metadata) |

### Admin — user management (`routes/admin/users.py`)
`admin_grant_pro`, `admin_revoke_pro`, `admin_delete_user`, `admin_toggle_admin`,
`admin_moderate_user`, `admin_update_user` (metadata carries `before`/`after` diff).

### Admin — moderation & appeals
`admin_resolve_review_queue`, `admin_moderate_report`,
`admin_batch_moderate_reports`, `admin_moderate_content`
(`admin/moderation.py`); `admin_resolve_ban_appeal`,
`admin_resolve_content_appeal` (`admin/appeals.py`).

These run **in addition to** the domain tables `user_moderation_logs` /
`content_moderation_logs`, which hold the detailed per-action record. The audit
row is the unified cross-feature timeline.

### Admin — content & system
`admin_delete_character`, `admin_delete_scene`, `admin_delete_persona`,
`admin_delete_tag`, `admin_update_tag`, `admin_create_tag`,
`admin_delete_search_term` (`admin/content.py`);
`admin_toggle_dev_sms_bypass` (`admin/system.py`);
`admin_create_notification`, `admin_update_notification`,
`admin_delete_notification` (`notification.py`).

### Admin — reports & messaging
`admin_update_problem_report`, `admin_delete_problem_report`
(`problem_report.py`); `admin_send_message` (`user_messages.py`).

### User activity
`create_problem_report` (`problem_report.py`);
`submit_ban_appeal` (`user_messages.py`);
`rename_chat`, `delete_chat`, `delete_chats_by_character`,
`delete_unavailable_chats` (`chat.py`);
`delete_character`, `delete_scene`, `delete_persona` (user-owned content).

Ordinary, non-destructive content creation/editing (creating a character, scene
or persona, sending a chat message) is intentionally **not** audited: those
tables already carry `creator_id` + timestamps, and logging them would drown the
signal. Only irreversible content deletions are recorded.

## Setup

```bash
cd backend
python migrations/add_audit_logs.py
```

## Admin Access

Read API: `GET /api/audit-logs` (`routes/audit_log.py`) — filters `user_id`,
`action`, `status`, `start_date`, `end_date`, `limit` (1–500), `offset`.
UI: `/admin/audit-logs`.
