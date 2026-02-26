"""
Security middleware for rate limiting and other security measures.
"""
from fastapi import Request, HTTPException
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import Response
from starlette.requests import ClientDisconnect
import time
from typing import Dict, Tuple
import logging

logger = logging.getLogger(__name__)


class RequestSizeLimitMiddleware(BaseHTTPMiddleware):
    """
    Middleware to limit the size of incoming requests to prevent DoS attacks.
    """
    def __init__(self, app, max_size: int = 10 * 1024 * 1024):  # 10MB default
        super().__init__(app)
        self.max_size = max_size

    async def dispatch(self, request: Request, call_next):
        # Check Content-Length header
        content_length = request.headers.get("content-length")
        if content_length:
            content_length = int(content_length)
            if content_length > self.max_size:
                return Response(
                    content=f"Request body too large. Maximum size is {self.max_size} bytes.",
                    status_code=413
                )
        
        response = await call_next(request)
        return response


class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    """
    Middleware to add security headers to all responses.
    """
    async def dispatch(self, request: Request, call_next):
        response = await call_next(request)
        
        # Add security headers
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["X-XSS-Protection"] = "1; mode=block"
        response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        
        # Content Security Policy - adjust based on your needs
        # This is a basic policy, you may need to customize it
        response.headers["Content-Security-Policy"] = (
            "default-src 'self'; "
            "script-src 'self' 'unsafe-inline' 'unsafe-eval'; "
            "style-src 'self' 'unsafe-inline'; "
            "img-src 'self' data: https:; "
            "font-src 'self' data:; "
            "connect-src 'self' https:; "
            "frame-ancestors 'none';"
        )
        
        return response


class IPTracker:
    """
    Simple in-memory IP tracker for rate limiting.
    For production, consider using Redis or similar.
    """
    def __init__(self):
        self.requests: Dict[str, list] = {}
        self.blocked_ips: Dict[str, float] = {}
        self.cleanup_interval = 300  # Clean old entries every 5 minutes
        self.last_cleanup = time.time()

    def cleanup(self):
        """Remove old entries to prevent memory bloat"""
        current_time = time.time()
        if current_time - self.last_cleanup > self.cleanup_interval:
            # Clean up requests older than 1 hour
            cutoff_time = current_time - 3600
            for ip in list(self.requests.keys()):
                self.requests[ip] = [
                    timestamp for timestamp in self.requests[ip] 
                    if timestamp > cutoff_time
                ]
                if not self.requests[ip]:
                    del self.requests[ip]
            
            # Clean up expired blocks
            for ip in list(self.blocked_ips.keys()):
                if self.blocked_ips[ip] < current_time:
                    del self.blocked_ips[ip]
            
            self.last_cleanup = current_time

    def is_blocked(self, ip: str) -> Tuple[bool, float]:
        """Check if an IP is currently blocked"""
        if ip in self.blocked_ips:
            if self.blocked_ips[ip] > time.time():
                return True, self.blocked_ips[ip]
            else:
                del self.blocked_ips[ip]
        return False, 0

    def block_ip(self, ip: str, duration: int = 3600):
        """Block an IP for a specified duration (default 1 hour)"""
        self.blocked_ips[ip] = time.time() + duration
        logger.warning(f"IP {ip} has been blocked for {duration} seconds")

    def check_rate_limit(
        self, 
        ip: str, 
        limit: int = 100, 
        window: int = 60
    ) -> Tuple[bool, int]:
        """
        Check if an IP has exceeded rate limit.
        Returns (is_allowed, remaining_requests)
        """
        self.cleanup()
        
        # Check if IP is blocked
        is_blocked, block_time = self.is_blocked(ip)
        if is_blocked:
            return False, 0
        
        current_time = time.time()
        
        # Initialize if new IP
        if ip not in self.requests:
            self.requests[ip] = []
        
        # Remove requests outside the time window
        cutoff_time = current_time - window
        self.requests[ip] = [
            timestamp for timestamp in self.requests[ip] 
            if timestamp > cutoff_time
        ]
        
        # Check if limit exceeded
        request_count = len(self.requests[ip])
        if request_count >= limit:
            # Block IP for repeated violations
            if request_count >= limit * 2:
                self.block_ip(ip, duration=3600)  # Block for 1 hour
            return False, 0
        
        # Add current request
        self.requests[ip].append(current_time)
        
        remaining = limit - (request_count + 1)
        return True, remaining


# Global IP tracker instance
ip_tracker = IPTracker()


class RateLimitMiddleware(BaseHTTPMiddleware):
    """
    Middleware for IP-based rate limiting.
    """
    def __init__(
        self, 
        app, 
        requests_per_minute: int = 100,
        requests_per_hour: int = 1000,
        exempt_paths: list = None
    ):
        super().__init__(app)
        self.requests_per_minute = requests_per_minute
        self.requests_per_hour = requests_per_hour
        self.exempt_paths = exempt_paths or []

    def get_client_ip(self, request: Request) -> str:
        """Extract client IP from request, considering proxy headers"""
        # Check for proxy headers
        forwarded_for = request.headers.get("X-Forwarded-For")
        if forwarded_for:
            # X-Forwarded-For can contain multiple IPs, take the first one
            ip = forwarded_for.split(",")[0].strip()
            return ip
        
        real_ip = request.headers.get("X-Real-IP")
        if real_ip:
            return real_ip
        
        # Fallback to direct client
        if request.client:
            return request.client.host
        
        return "unknown"

    async def dispatch(self, request: Request, call_next):
        # Check if path is exempt from rate limiting
        request_path = request.url.path
        for exempt_path in self.exempt_paths:
            if request_path.startswith(exempt_path):
                # Skip rate limiting for exempt paths
                response = await call_next(request)
                return response
        
        client_ip = self.get_client_ip(request)
        
        # Check if IP is blocked
        is_blocked, block_time = ip_tracker.is_blocked(client_ip)
        if is_blocked:
            remaining_time = int(block_time - time.time())
            return Response(
                content=f"Too many requests. IP blocked for {remaining_time} more seconds.",
                status_code=429,
                headers={"Retry-After": str(remaining_time)}
            )
        
        # Check per-minute rate limit
        allowed_minute, remaining_minute = ip_tracker.check_rate_limit(
            client_ip, 
            limit=self.requests_per_minute, 
            window=60
        )
        
        # Check per-hour rate limit
        allowed_hour, remaining_hour = ip_tracker.check_rate_limit(
            client_ip, 
            limit=self.requests_per_hour, 
            window=3600
        )
        
        if not allowed_minute or not allowed_hour:
            logger.warning(f"Rate limit exceeded for IP: {client_ip}")
            return Response(
                content="Rate limit exceeded. Please try again later.",
                status_code=429,
                headers={
                    "Retry-After": "60",
                    "X-RateLimit-Limit-Minute": str(self.requests_per_minute),
                    "X-RateLimit-Limit-Hour": str(self.requests_per_hour),
                    "X-RateLimit-Remaining-Minute": str(remaining_minute),
                    "X-RateLimit-Remaining-Hour": str(remaining_hour)
                }
            )
        
        # Add rate limit info to response headers
        response = await call_next(request)
        response.headers["X-RateLimit-Limit-Minute"] = str(self.requests_per_minute)
        response.headers["X-RateLimit-Limit-Hour"] = str(self.requests_per_hour)
        response.headers["X-RateLimit-Remaining-Minute"] = str(remaining_minute)
        response.headers["X-RateLimit-Remaining-Hour"] = str(remaining_hour)
        
        return response


def get_rate_limit_status(ip: str) -> dict:
    """
    Get current rate limit status for an IP address.
    Useful for monitoring and debugging.
    """
    is_blocked, block_time = ip_tracker.is_blocked(ip)
    
    if is_blocked:
        return {
            "ip": ip,
            "blocked": True,
            "block_expires_at": block_time,
            "remaining_time": int(block_time - time.time())
        }
    
    # Get request counts
    current_time = time.time()
    requests = ip_tracker.requests.get(ip, [])
    
    minute_ago = current_time - 60
    hour_ago = current_time - 3600
    
    requests_last_minute = len([t for t in requests if t > minute_ago])
    requests_last_hour = len([t for t in requests if t > hour_ago])
    
    return {
        "ip": ip,
        "blocked": False,
        "requests_last_minute": requests_last_minute,
        "requests_last_hour": requests_last_hour
    }


class ErrorLoggingMiddleware(BaseHTTPMiddleware):
    """Middleware to log unhandled exceptions and HTTP errors"""
    
    async def dispatch(self, request: Request, call_next):
        try:
            response = await call_next(request)
            
            # Log errors with 5xx status codes
            if response.status_code >= 500:
                from utils.error_logger import get_error_logger
                error_logger = get_error_logger()
                error_logger.log_http_error(
                    request=request,
                    status_code=response.status_code,
                    message=f"HTTP {response.status_code} error"
                )
            
            return response
        except Exception as e:
            if isinstance(e, ClientDisconnect):
                logger.info("Client disconnected before request completed: %s %s", request.method, request.url.path)
                return Response(status_code=499)

            # Log the unhandled exception
            from utils.error_logger import get_error_logger
            error_logger = get_error_logger()
            error_logger.log_http_error(
                request=request,
                exception=e,
                status_code=500,
                message=f"Unhandled exception: {str(e)}"
            )
            
            # Re-raise the exception to be handled by FastAPI
            raise
