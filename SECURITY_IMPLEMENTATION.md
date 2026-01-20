# Security Implementation Guide

This document describes the security measures implemented in the Mikoshi application.

## Overview

The following security measures have been implemented:
1. **IP-based Rate Limiting** - Prevents abuse and DDoS attacks
2. **Security Headers** - Protects against common web vulnerabilities
3. **Request Size Limiting** - Prevents memory exhaustion attacks
4. **IP Blocking** - Automatic blocking of malicious IPs

## 1. IP-Based Rate Limiting

### Features
- **Per-minute rate limit**: 100 requests per minute per IP (configurable)
- **Per-hour rate limit**: 1000 requests per hour per IP (configurable)
- **Automatic IP blocking**: IPs that exceed 2x the rate limit are blocked for 1 hour
- **Memory cleanup**: Old request records are automatically cleaned to prevent memory bloat

### Configuration

To adjust rate limits, modify the middleware initialization in `backend/server.py`:

```python
app.add_middleware(
    RateLimitMiddleware,
    requests_per_minute=100,  # Change this value
    requests_per_hour=1000     # Change this value
)
```

### Response Headers

When rate limiting is active, the following headers are included in responses:
- `X-RateLimit-Limit-Minute`: Maximum requests per minute
- `X-RateLimit-Limit-Hour`: Maximum requests per hour
- `X-RateLimit-Remaining-Minute`: Remaining requests in current minute
- `X-RateLimit-Remaining-Hour`: Remaining requests in current hour

When rate limit is exceeded, you'll receive:
- **Status Code**: `429 Too Many Requests`
- **Retry-After**: Time in seconds until the limit resets

### IP Detection

The rate limiter respects proxy headers to detect the true client IP:
1. `X-Forwarded-For` (first IP in the chain)
2. `X-Real-IP`
3. Direct client IP (fallback)

## 2. Security Headers

The following security headers are automatically added to all responses:

### X-Content-Type-Options
```
X-Content-Type-Options: nosniff
```
Prevents MIME type sniffing attacks.

### X-Frame-Options
```
X-Frame-Options: DENY
```
Prevents clickjacking attacks by denying iframe embedding.

### X-XSS-Protection
```
X-XSS-Protection: 1; mode=block
```
Enables browser XSS filtering.

### Strict-Transport-Security
```
Strict-Transport-Security: max-age=31536000; includeSubDomains
```
Forces HTTPS connections for one year.

### Referrer-Policy
```
Referrer-Policy: strict-origin-when-cross-origin
```
Controls referrer information sent with requests.

### Content-Security-Policy
```
Content-Security-Policy: default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; ...
```
Controls which resources can be loaded. **Note**: This may need customization based on your frontend requirements.

## 3. Request Size Limiting

### Default Configuration
- **Maximum request size**: 10 MB
- **Response on exceeded**: `413 Request Entity Too Large`

### Configuration

To adjust the maximum request size, modify in `backend/server.py`:

```python
app.add_middleware(
    RequestSizeLimitMiddleware, 
    max_size=10 * 1024 * 1024  # Change this value (in bytes)
)
```

## 4. Admin Monitoring Endpoints

### Check Current IP Status
```http
GET /api/admin/security/rate-limit
Authorization: Bearer {admin_token}
```

Returns:
```json
{
  "ip": "192.168.1.1",
  "blocked": false,
  "requests_last_minute": 5,
  "requests_last_hour": 42
}
```

### Check Specific IP Status
```http
GET /api/admin/security/rate-limit/{ip}
Authorization: Bearer {admin_token}
```

Returns blocked IP info:
```json
{
  "ip": "192.168.1.1",
  "blocked": true,
  "block_expires_at": 1705432800.0,
  "remaining_time": 3420
}
```

## 5. Installation & Setup

### Install Dependencies

The security implementation requires the `slowapi` package (already added to requirements.txt):

```bash
pip install -r backend/requirements.txt
```

### Restart the Server

After installation, restart your backend server:

```bash
cd backend
python server.py
```

## 6. Production Considerations

### For High-Traffic Applications

The current implementation uses in-memory storage for rate limiting. For production deployments with multiple servers, consider:

1. **Use Redis for distributed rate limiting**:
   ```python
   # Example with Redis
   import redis
   redis_client = redis.Redis(host='localhost', port=6379, db=0)
   ```

2. **Configure reverse proxy rate limiting** (nginx, Cloudflare, etc.)

3. **Implement IP whitelisting** for trusted services

### Monitoring Recommendations

1. **Log rate limit violations** - Already implemented with logging
2. **Set up alerts** for unusual patterns
3. **Monitor blocked IPs** via admin endpoints
4. **Review rate limits** based on actual traffic patterns

## 7. Customization

### Adjusting Block Duration

Edit `backend/utils/security_middleware.py`:

```python
def block_ip(self, ip: str, duration: int = 3600):  # Change duration here
```

### Custom Rate Limits for Specific Endpoints

You can implement per-endpoint rate limits by checking the request path:

```python
async def dispatch(self, request: Request, call_next):
    if request.url.path.startswith("/api/chat"):
        # Apply stricter limits for chat endpoints
        requests_per_minute = 20
    else:
        requests_per_minute = self.requests_per_minute
    # ... rest of the logic
```

### IP Whitelist

Add trusted IPs that should bypass rate limiting:

```python
WHITELISTED_IPS = ["127.0.0.1", "10.0.0.1"]

async def dispatch(self, request: Request, call_next):
    client_ip = self.get_client_ip(request)
    
    if client_ip in WHITELISTED_IPS:
        return await call_next(request)
    
    # Continue with rate limiting
```

## 8. Testing Rate Limiting

### Manual Testing

Use curl or any HTTP client to test rate limiting:

```bash
# Test rate limiting by making rapid requests
for i in {1..150}; do
  curl http://localhost:8000/api/characters
  echo "Request $i"
done
```

You should see `429 Too Many Requests` after exceeding the limit.

### Check Headers

```bash
curl -I http://localhost:8000/api/characters
```

Look for rate limit headers in the response.

## 9. Troubleshooting

### Rate Limiting Not Working

1. **Check middleware order** in `server.py` - Rate limiting should be added early
2. **Verify IP detection** - Check if proxy headers are configured correctly
3. **Check logs** - Look for rate limit warnings

### False Positives (Legitimate Users Blocked)

1. **Increase rate limits** if too restrictive
2. **Add IP whitelist** for known good actors
3. **Review proxy configuration** - Ensure correct IP detection

### Memory Usage

The in-memory tracker automatically cleans old entries. If memory is still a concern:
1. Reduce `cleanup_interval` in `IPTracker.__init__`
2. Implement Redis-based storage
3. Reduce the time window for request tracking

## 10. Security Best Practices

In addition to the implemented measures, consider:

1. **Use HTTPS** in production (already configured in nginx)
2. **Implement authentication** for sensitive endpoints (already in place)
3. **Validate input** on all endpoints
4. **Keep dependencies updated** regularly
5. **Monitor logs** for suspicious activity
6. **Use environment variables** for sensitive configuration
7. **Implement CORS** properly (already configured)
8. **Regular security audits**

## Summary

The implemented security measures provide:
- ✅ Protection against DDoS and brute force attacks
- ✅ Protection against common web vulnerabilities
- ✅ Request size validation to prevent memory attacks
- ✅ Automatic blocking of malicious IPs
- ✅ Admin monitoring capabilities
- ✅ Easy configuration and customization

For questions or issues, refer to the code in:
- `backend/utils/security_middleware.py`
- `backend/server.py`
- `backend/routes/admin.py`
