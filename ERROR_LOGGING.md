# Error Logging System Documentation

## Overview

The Mikoshi application features a comprehensive, production-ready error logging system that provides centralized error tracking, monitoring, and management across both backend (Python/FastAPI) and frontend (React) components. This system automatically captures errors, stores them persistently, and provides powerful admin tools for analysis and resolution.

**Last Updated:** January 28, 2026

## Key Features

✅ **Automatic Error Capture**: Captures unhandled exceptions, promise rejections, HTTP 5xx errors, and console errors  
✅ **Comprehensive Context**: Logs stack traces, HTTP metadata, client IPs, user agents, request bodies, and custom context  
✅ **Persistent Storage**: PostgreSQL database storage with automatic table creation  
✅ **Admin Dashboard**: Feature-rich admin interface with filtering, pagination, and detailed error views  
✅ **Real-time Statistics**: Summary metrics including 24h/7d trends and critical error counts  
✅ **Flexible Filtering**: Filter by severity, source, error type, resolution status, date ranges, and text search  
✅ **Error Resolution Tracking**: Mark errors as resolved with timestamp and admin attribution  
✅ **Bulk Management**: Delete old logs in bulk with configurable retention periods  
✅ **Dual Logging**: Database storage + file logging (`backend/logs/error.log`) for redundancy  
✅ **Data Protection**: Field truncation to prevent database bloat (configurable limits)  
✅ **Zero Configuration**: Auto-initializes on startup with sensible defaults

## System Architecture

### Backend Stack

#### 1. Error Logger Service (`backend/utils/error_logger.py`)

**Core Module** - 366 lines  
The central error logging service implementing a singleton pattern with database persistence.

**Classes:**
- **`ErrorLog`**: Data class representing a single error entry
  - Timestamp (UTC), message, error_type, severity, source
  - User context (user_id, client_ip, user_agent)
  - Request metadata (endpoint, method, status_code, request_body)
  - Debug info (stack_trace, context dict)
  - Resolution tracking (resolved, resolved_at, resolved_by)

- **`ErrorLogger`**: Main service class with configurable size limits
  - `MAX_STACK_TRACE = 50,000` characters
  - `MAX_CONTEXT = 10,000` characters  
  - `MAX_MESSAGE = 5,000` characters
  - `MAX_ENDPOINT = 255` characters
  - `MAX_USER_AGENT = 1,000` characters

**Public API:**
```python
# Initialize with database
set_db_factory(SessionLocal)
logger = get_error_logger()

# Log HTTP errors with request context
logger.log_http_error(request, exception, status_code, message, user_id)

# Log frontend errors from client
logger.log_frontend_error(message, error_type, severity, url, user_agent, user_id, stack_trace, context)

# General error capture
logger.capture_error(message, error_type, severity, source, user_id, endpoint, method, 
                     status_code, client_ip, user_agent, request_body, context, exception)
```

**Features:**
- Automatic stack trace extraction from exceptions
- Intelligent field truncation with length annotations
- Client IP extraction with X-Forwarded-For support
- Query params captured in context
- File logging (console + file handlers)
- Database persistence with rollback safety
- Graceful degradation if DB unavailable

#### 2. Database Model (`backend/models.py`)

**`ErrorLogModel`** - SQLAlchemy ORM mapping  
Table: `error_logs`

| Column | Type | Description | Indexed |
|--------|------|-------------|---------|
| `id` | Integer | Primary key | ✓ |
| `timestamp` | DateTime(TZ) | Error occurrence time (UTC) | ✓ |
| `message` | Text | Error message | |
| `error_type` | String(100) | Exception class name | ✓ |
| `severity` | String(20) | info/warning/error/critical | ✓ |
| `source` | String(20) | backend/frontend | ✓ |
| `user_id` | String (FK) | User ID (nullable) | ✓ |
| `endpoint` | String(255) | API route or page URL | ✓ |
| `method` | String(10) | HTTP method | |
| `status_code` | Integer | HTTP status code | ✓ |
| `client_ip` | String(45) | IPv4/IPv6 address | ✓ |
| `user_agent` | Text | Browser/client UA | |
| `request_body` | Text | JSON request payload | |
| `stack_trace` | Text | Full error stack trace | |
| `context` | Text | Additional JSON context | |
| `resolved` | Boolean | Resolution status | ✓ |
| `resolved_at` | DateTime(TZ) | Resolution timestamp | |
| `resolved_by` | String (FK) | Admin who resolved | |

**Relationships:**
- Foreign key to `users.id` for user_id
- Foreign key to `users.id` for resolved_by
- Both set to `SET NULL` on delete

#### 3. API Routes (`backend/routes/error_log.py`)

**Router:** `/api/error-logs` - 377 lines  
Complete RESTful API with admin authentication and validation.

**Request/Response Models:**
- `ErrorLogResponse`: Pydantic model with timestamp validators
- `ErrorLogFilterRequest`: Query parameter validation
- `ResolveErrorRequest`: Resolution payload validation
- `LogFrontendErrorRequest`: Frontend logging with size limits

**Endpoints:**

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/error-logs/stats` | Admin | Statistics for last N hours (1-720) |
| GET | `/api/error-logs/summary` | Admin | Summary: 24h/7d counts, critical unresolved, top errors |
| GET | `/api/error-logs/frontend` | Public | Frontend error submission (extracts user from token) |
| GET | `/api/error-logs` | Admin | Paginated list with filters |
| GET | `/api/error-logs/{id}` | Admin | Single error detail |
| PUT | `/api/error-logs/{id}` | Admin | Resolve/unresolve error |
| DELETE | `/api/error-logs/{id}` | Admin | Delete single error |
| DELETE | `/api/error-logs` | Admin | Bulk delete by age (1-365 days) |

**Filter Parameters:**
- `severity`: info, warning, error, critical
- `source`: backend, frontend
- `error_type`: Exact error type match
- `user_id`: Filter by user
- `resolved`: true/false/null
- `start_date`, `end_date`: ISO 8601 format
- `limit`: 1-1000 (default 100)
- `offset`: Pagination offset

**Validation:**
- Message: 1-5000 characters
- Stack trace: Max 50,000 characters
- Context: Max 10,000 serialized JSON

**Special Handling:**
- Frontend endpoint accepts unauthenticated requests
- Session token extracted from Authorization header if present
- Errors in error logging don't fail the request
- Route ordering prevents parameter conflicts (stats/summary before /{id})

#### 4. Error Logging Middleware (`backend/utils/security_middleware.py`)

**`ErrorLoggingMiddleware`** - ASGI middleware  
Automatically logs unhandled exceptions and 5xx errors.

**Behavior:**
1. Wraps all HTTP requests
2. Logs 5xx responses with request context
3. Catches unhandled exceptions and logs before re-raising
4. Extracts full request metadata (IP, UA, endpoint, method)
5. Added early in middleware stack (before rate limiting)

**Integration** (`backend/server.py`):
```python
from utils.error_logger import set_db_factory
set_db_factory(SessionLocal)  # Initialize at startup

app.add_middleware(ErrorLoggingMiddleware)  # First middleware
```

### Frontend Stack

#### 1. Error Logger Class (`frontend/src/utils/errorLogger.js`)

**Singleton Utility** - 336 lines  
Comprehensive client-side error capture and reporting.

**Initialization** (`frontend/src/main.jsx`):
```javascript
import { errorLogger } from './utils/errorLogger';
errorLogger.init();  // Setup global handlers
```

**Global Handlers:**
1. **`window.addEventListener('error')`**: Captures unhandled exceptions
   - Extracts filename, line number, column number
   - Captures full stack trace
   - Includes URL context

2. **`window.addEventListener('unhandledrejection')`**: Promise rejections
   - Captures rejection reason
   - Handles both Error objects and primitives
   - Logs as `UnhandledPromiseRejection` type

3. **`console.error` override**: Intercepts console errors
   - Filters to actual errors (not debug logs)
   - Logs as `ConsoleError` type with warning severity
   - Preserves original console behavior

**Public API:**
```javascript
// Initialization
errorLogger.init();

// Manual logging
await errorLogger.captureError({ message, error_type, severity, stack_trace, url, context });
await errorLogger.logError(error, customMessage, severity);
await errorLogger.logCustomError(message, severity, context);

// Admin functions
const logs = await errorLogger.getLogs({ severity, source, error_type, resolved, limit, offset });
const stats = await errorLogger.getStats(hours);
const summary = await errorLogger.getSummary();
await errorLogger.resolveError(errorId, resolved);
const success = await errorLogger.deleteError(errorId);
const result = await errorLogger.deleteOldLogs(days);
```

**Features:**
- API base URL from `window.API_BASE_URL`
- Session token from `localStorage.sessionToken`
- Silent failure (doesn't break app if endpoint unavailable)
- Development mode console logging
- Automatic user agent and URL capture
- Fire-and-forget async logging

#### 2. Admin Dashboard (`frontend/src/admin/pages/ErrorLogsPage.jsx`)

**React Component** - 533 lines  
Full-featured admin interface for error management.

**Features:**

**Summary Cards** (4 metrics):
- Errors in last 24 hours
- Errors in last 7 days
- Critical unresolved count (highlighted in red)
- Total errors count

**Filter Panel:**
- Status: All / Unresolved / Resolved
- Severity: All / Info / Warning / Error / Critical
- Source: All / Backend / Frontend
- Search: Text search across message, error_type, endpoint
- Reset pagination on filter change

**Error Table** (Sortable columns):
- Timestamp (localized format)
- Severity (color-coded badges)
- Error Type (monospace code style)
- Message (truncated with ellipsis)
- Endpoint (truncated)
- Source (info/secondary badges)
- Status (success/warning badges)
- Actions (view/resolve/delete buttons)

**Pagination Controls:**
- First / Previous / Current Page / Next / Last
- 50 errors per page
- Total count display
- Disabled state for boundary pages

**Error Details Modal:**
- Full message (monospace, wrapped)
- Error type and severity badges
- Source and timestamp
- Endpoint with HTTP method
- Client IP and status code
- User agent (word-wrapped)
- Stack trace (scrollable, max 300px)
- Context JSON (pretty-printed, scrollable)
- Close button

**Bulk Actions:**
- "Delete Old Logs" button
- Prompts for retention days (default 30)
- Shows deleted count
- Refreshes logs and summary

**Inline Actions:**
- Eye icon: View details in modal
- Check/Undo icon: Toggle resolved status
- Trash icon: Delete with confirmation
- Bootstrap icon library

**Integration** (`frontend/src/admin/components/AdminSidebar.jsx`):
```jsx
<Link to="/admin/error-logs">Error Logs</Link>
```

## Usage Guide

### Automatic Capture (Zero Code)

The system automatically captures these without any developer action:

1. **Backend:**
   - HTTP 5xx status codes
   - Unhandled Python exceptions
   - FastAPI exception handlers

2. **Frontend:**
   - Uncaught JavaScript errors
   - Unhandled promise rejections
   - `console.error()` calls (filtered)

### Manual Logging - Frontend

```javascript
import { errorLogger } from './utils/errorLogger';

// In try-catch blocks
try {
  await fetchCharacter(id);
} catch (error) {
  await errorLogger.logError(error, 'Failed to load character', 'error');
  throw error;  // Re-throw if needed
}

// Custom error events
await errorLogger.logCustomError(
  'User exceeded rate limit',
  'warning',
  { 
    userId: user.id,
    action: 'createCharacter',
    rateLimitRemaining: 0
  }
);

// Direct capture with full control
await errorLogger.captureError({
  message: 'Validation failed',
  error_type: 'ValidationError',
  severity: 'warning',
  url: window.location.href,
  context: { 
    field: 'bio',
    validationRule: 'maxLength',
    provided: 5000,
    allowed: 4000
  }
});
```

### Manual Logging - Backend

```python
from utils.error_logger import get_error_logger

error_logger = get_error_logger()

# HTTP errors with request context
@router.post("/api/characters")
async def create_character(request: Request, data: CharacterCreate):
    try:
        character = await service.create(data)
        return character
    except ValidationError as e:
        error_logger.log_http_error(
            request=request,
            exception=e,
            status_code=400,
            message=f"Character validation failed: {str(e)}"
        )
        raise HTTPException(status_code=400, detail=str(e))

# Frontend errors forwarded from client
error_logger.log_frontend_error(
    message="WebSocket connection failed",
    error_type="ConnectionError",
    severity="error",
    url="/chat/12345",
    user_agent=request.headers.get("user-agent"),
    user_id=current_user.id,
    stack_trace="Error: Connection timeout...",
    context={"chatId": 12345, "retries": 3}
)

# General error capture
error_logger.capture_error(
    message="Database connection pool exhausted",
    error_type="DatabaseError",
    severity="critical",
    source="backend",
    endpoint="/api/characters",
    method="GET",
    status_code=503,
    client_ip="192.168.1.1",
    context={
        "pool_size": 10,
        "active_connections": 10,
        "waiting_requests": 15
    }
)
```

### Admin Dashboard Access

1. **Navigate:** `/admin/error-logs` (requires admin role)
2. **View Summary:** Check 24h/7d trends and critical count
3. **Filter Errors:** Select severity, source, status
4. **Search:** Type keywords to filter message/type/endpoint
5. **View Details:** Click any error row to see full context
6. **Resolve:** Click check icon to mark resolved (or undo icon to reopen)
7. **Delete Single:** Click trash icon with confirmation
8. **Bulk Cleanup:** Click "Delete Old Logs", enter days (e.g., 30)

## Configuration

### Backend Setup

**Database Initialization** (`backend/server.py`):
```python
from utils.error_logger import set_db_factory
from database import SessionLocal

# Set factory before first error can occur
set_db_factory(SessionLocal)

# Table auto-created via
Base.metadata.create_all(bind=engine)
```

**Middleware Registration** (order matters):
```python
app.add_middleware(ErrorLoggingMiddleware)  # First
app.add_middleware(RequestSizeLimitMiddleware)
app.add_middleware(SecurityHeadersMiddleware)
app.add_middleware(RateLimitMiddleware)  # Last
```

**Route Registration**:
```python
from routes import error_log
app.include_router(error_log.router)  # Adds /api/error-logs
```

### Frontend Setup

**Global Initialization** (`frontend/src/main.jsx`):
```javascript
import { errorLogger } from './utils/errorLogger';

// Initialize before rendering
errorLogger.init();

// Then render app
ReactDOM.createRoot(document.getElementById('root')).render(<App />);
```

**Environment Variables**:
- `window.API_BASE_URL`: Set by Vite config (e.g., `http://localhost:8000`)
- Used for API endpoint construction

**Admin Route** (`frontend/src/admin/AdminApp.jsx`):
```jsx
<Route path="error-logs" element={<ErrorLogsPage />} />
```

**Sidebar Link** (`frontend/src/admin/components/AdminSidebar.jsx`):
```jsx
<Link to="/admin/error-logs">Error Logs</Link>
```

## API Reference

### Response Examples

**GET /api/error-logs/summary**
```json
{
  "errors_last_24h": 42,
  "errors_last_7d": 318,
  "critical_unresolved": 3,
  "most_common_errors": [
    { "error_type": "ConnectionError", "count": 15 },
    { "error_type": "ValidationError", "count": 12 },
    { "error_type": "TypeError", "count": 8 },
    { "error_type": "HTTPException", "count": 7 },
    { "error_type": "FetchError", "count": 5 }
  ]
}
```

**GET /api/error-logs/stats?hours=24**
```json
{
  "total_errors": 42,
  "by_severity": {
    "critical": 3,
    "error": 25,
    "warning": 12,
    "info": 2
  },
  "by_source": {
    "backend": 28,
    "frontend": 14
  },
  "by_error_type": {
    "ConnectionError": 15,
    "ValidationError": 12,
    "TypeError": 8,
    "HTTPException": 7
  },
  "critical_count": 3
}
```

**GET /api/error-logs?severity=critical&resolved=false&limit=5**
```json
{
  "total": 3,
  "limit": 5,
  "offset": 0,
  "error_logs": [
    {
      "id": 1523,
      "timestamp": "2026-01-28T14:32:18.445Z",
      "message": "Database connection pool exhausted",
      "error_type": "DatabaseError",
      "severity": "critical",
      "source": "backend",
      "user_id": null,
      "endpoint": "/api/characters",
      "method": "GET",
      "status_code": 503,
      "client_ip": "203.0.113.42",
      "user_agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)...",
      "request_body": null,
      "stack_trace": "Traceback (most recent call last):\n  File...",
      "context": "{\"pool_size\": 10, \"active_connections\": 10}",
      "resolved": false,
      "resolved_at": null,
      "resolved_by": null
    }
  ]
}
```

**PUT /api/error-logs/1523 (Resolve)**
```json
{
  "resolved": true
}
```
Response:
```json
{
  "id": 1523,
  "resolved": true,
  "resolved_at": "2026-01-28T15:00:00.123Z",
  "resolved_by": "admin_user_id",
  ...
}
```

**DELETE /api/error-logs?days=30**
Response:
```json
{
  "message": "Deleted 245 error logs older than 30 days",
  "deleted_count": 245
}
```

## File Structure

```
backend/
├── utils/
│   ├── error_logger.py          ← Core error logging service (366 lines)
│   └── security_middleware.py   ← ErrorLoggingMiddleware class
├── routes/
│   └── error_log.py              ← RESTful API endpoints (377 lines)
├── models.py                      ← ErrorLogModel ORM definition
├── server.py                      ← App initialization, middleware setup
└── logs/
    └── error.log                  ← File-based error logs (auto-created)

frontend/
├── src/
│   ├── utils/
│   │   └── errorLogger.js         ← Client-side error capture (336 lines)
│   ├── admin/
│   │   ├── components/
│   │   │   └── AdminSidebar.jsx   ← Navigation with error logs link
│   │   └── pages/
│   │       └── ErrorLogsPage.jsx  ← Admin dashboard (533 lines)
│   └── main.jsx                   ← Error logger initialization
```

## Security & Privacy

### Authentication & Authorization
- ✅ Admin-only endpoints protected by `get_current_admin_user`
- ✅ Frontend logging endpoint public (allows error reporting before auth)
- ✅ Session token optional for frontend logging (user_id extracted if present)
- ✅ All admin operations audit-logged (resolved_by tracking)

### Sensitive Data Handling
- ⚠️ **Request bodies stored**: May contain passwords/tokens - sanitize before logging
- ⚠️ **Client IPs logged**: GDPR consideration - implement retention policy
- ⚠️ **Stack traces visible**: May expose code structure - admin-only access
- ⚠️ **User agents stored**: Device fingerprinting concern - anonymize if needed
- ✅ **Context field**: Use for structured data, avoid PII
- ✅ **Size limits**: Prevent malicious payload injection

### Best Practices
1. Sanitize request bodies before calling error logger
2. Implement automatic log cleanup (30-90 day retention)
3. Restrict admin dashboard access to internal networks
4. Review critical errors for security implications
5. Use context field for structured debugging data (not sensitive info)

## Performance Optimization

### Database Indexes
```sql
CREATE INDEX idx_error_logs_timestamp ON error_logs(timestamp);
CREATE INDEX idx_error_logs_severity ON error_logs(severity);
CREATE INDEX idx_error_logs_source ON error_logs(source);
CREATE INDEX idx_error_logs_error_type ON error_logs(error_type);
CREATE INDEX idx_error_logs_resolved ON error_logs(resolved);
CREATE INDEX idx_error_logs_user_id ON error_logs(user_id);
CREATE INDEX idx_error_logs_endpoint ON error_logs(endpoint);
CREATE INDEX idx_error_logs_status_code ON error_logs(status_code);
CREATE INDEX idx_error_logs_client_ip ON error_logs(client_ip);
```

### Scalability Considerations
- **Pagination**: Default 100, max 1000 per page
- **Field truncation**: Prevents multi-MB error logs
- **Async frontend logging**: Non-blocking error capture
- **Database session cleanup**: Proper rollback/close in finally blocks
- **Bulk deletion**: Query-based cleanup (not one-by-one)

### Recommended Maintenance
```python
# Weekly cron job
DELETE FROM error_logs WHERE timestamp < NOW() - INTERVAL '90 days';

# Or via API
DELETE /api/error-logs?days=90
```

## Troubleshooting

### Problem: Errors not appearing in database

**Diagnosis:**
```python
# Check database factory
from utils.error_logger import get_error_logger
logger = get_error_logger()
print(logger.db_session_factory)  # Should not be None
```

```sql
-- Check table exists
SELECT * FROM error_logs LIMIT 1;
```

**Solutions:**
1. Verify `set_db_factory(SessionLocal)` called before first request
2. Check `Base.metadata.create_all(bind=engine)` executed
3. Review `backend/logs/error.log` for database connection errors
4. Confirm SQLAlchemy models imported before `create_all`

### Problem: Frontend errors not reaching backend

**Diagnosis:**
```javascript
// Browser console
console.log(window.API_BASE_URL);  // Should be 'http://localhost:8000'
console.log(errorLogger.isInitialized);  // Should be true
```

**Solutions:**
1. Check `errorLogger.init()` called in `main.jsx`
2. Verify CORS allows `POST /api/error-logs/frontend`
3. Check backend logs for 401/403/500 responses
4. Test endpoint manually: `POST /api/error-logs/frontend` with curl

### Problem: Admin dashboard blank or not loading

**Diagnosis:**
```javascript
// Browser console (F12)
// Check for network errors, 401/403 responses
```

**Solutions:**
1. Verify user has `is_admin = true` in database
2. Check route registered: `app.include_router(error_log.router)`
3. Verify admin route exists in React Router
4. Check session token in localStorage is valid
5. Review browser console for JavaScript errors

### Problem: "Failed to store error log in database"

**Cause:** Database connection issue or constraint violation

**Solutions:**
1. Check PostgreSQL connection string
2. Verify user_id/resolved_by foreign keys exist
3. Check for field length violations (should auto-truncate)
4. Review database logs for constraint errors

## Maintenance & Monitoring

### Recommended Retention Policy
- **Critical errors**: Keep indefinitely or until resolved + 1 year
- **Error severity**: Keep 6-12 months
- **Warning severity**: Keep 3-6 months
- **Info severity**: Keep 1-3 months
- **Resolved errors**: Keep 30 days after resolution

### Health Checks
```python
# Weekly script
from database import SessionLocal
from models import ErrorLogModel
from datetime import datetime, timedelta

db = SessionLocal()

# Check for critical unresolved errors
critical = db.query(ErrorLogModel).filter(
    ErrorLogModel.severity == "critical",
    ErrorLogModel.resolved == False
).count()

# Check for increasing error rates
last_24h = db.query(ErrorLogModel).filter(
    ErrorLogModel.timestamp >= datetime.now() - timedelta(hours=24)
).count()

# Alert if thresholds exceeded
if critical > 5:
    send_alert(f"{critical} unresolved critical errors")
if last_24h > 500:
    send_alert(f"{last_24h} errors in last 24 hours")
```

### Backup Considerations
- Error logs table can grow large (plan for 10-50MB/month)
- Include in regular database backups
- Consider archiving old logs to cold storage

## Future Enhancements

**Planned:**
- [ ] Error grouping by signature/hash
- [ ] Email/Slack notifications for critical errors
- [ ] Trend graphs and analytics dashboard
- [ ] Error rate alerting (threshold-based)
- [ ] Export to CSV/JSON for analysis

**Under Consideration:**
- [ ] Integration with Sentry/Rollbar
- [ ] User-facing error feedback forms
- [ ] Session replay integration
- [ ] Machine learning anomaly detection
- [ ] Automatic issue creation (GitHub/Jira)

## Support & Contributing

**Questions:** Create an issue in the project repository  
**Bug Reports:** Include error log ID and reproduction steps  
**Feature Requests:** Describe use case and expected behavior

**Maintainer:** Mikoshi Development Team  
**Documentation Version:** 2.0 (January 28, 2026)
