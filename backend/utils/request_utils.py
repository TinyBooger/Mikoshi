"""
Request utility functions for extracting client information
"""
from fastapi import Request
from typing import Optional, Dict, Any


def get_client_ip(request: Request) -> Optional[str]:
    """
    Extract client IP address from request.
    Handles X-Forwarded-For header for proxied requests.
    
    Args:
        request: FastAPI Request object
    
    Returns:
        Client IP address as string, or None if unavailable
    """
    # Check X-Forwarded-For header (for proxied requests)
    forwarded_for = request.headers.get("X-Forwarded-For")
    if forwarded_for:
        # X-Forwarded-For can contain multiple IPs, first one is the client
        return forwarded_for.split(",")[0].strip()
    
    # Check X-Real-IP header (used by some proxies)
    real_ip = request.headers.get("X-Real-IP")
    if real_ip:
        return real_ip.strip()
    
    # Fall back to direct client host
    if request.client:
        return request.client.host
    
    return None


def get_user_agent(request: Request) -> Optional[str]:
    """
    Extract User-Agent string from request headers
    
    Args:
        request: FastAPI Request object
    
    Returns:
        User-Agent string, or None if unavailable
    """
    return request.headers.get("User-Agent") or request.headers.get("user-agent")


def get_request_metadata(request: Request, additional_data: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    """
    Build a metadata dictionary with common request information
    
    Args:
        request: FastAPI Request object
        additional_data: Optional dictionary of additional metadata to include
    
    Returns:
        Dictionary containing request metadata
    """
    metadata = {
        "endpoint": str(request.url.path),
        "method": request.method,
    }
    
    # Add query parameters if any
    if request.query_params:
        metadata["query_params"] = dict(request.query_params)
    
    # Add referer if present
    referer = request.headers.get("Referer") or request.headers.get("referer")
    if referer:
        metadata["referer"] = referer
    
    # Merge with additional data
    if additional_data:
        metadata.update(additional_data)
    
    return metadata
