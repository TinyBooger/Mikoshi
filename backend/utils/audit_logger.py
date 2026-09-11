"""
Audit Log System for tracking user operations
"""
from sqlalchemy import Column, String, Integer, DateTime, Text
from sqlalchemy.dialects.postgresql import JSONB
from database import Base, SessionLocal
from datetime import datetime, UTC
from typing import Optional, Dict, Any
import logging

logger = logging.getLogger(__name__)


class AuditLog(Base):
    """Audit log model for tracking user operations"""
    __tablename__ = "audit_logs"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(String, index=True, nullable=True)  # nullable for anonymous actions
    action = Column(String(255), nullable=False, index=True)  # e.g., "login", "create_character", "delete_user"
    timestamp = Column(DateTime(timezone=True), default=lambda: datetime.now(UTC), nullable=False, index=True)
    
    # Network information
    ip_address = Column(String(45), nullable=True)  # IPv4 (15) or IPv6 (45)
    user_agent = Column(Text, nullable=True)
    
    # Additional metadata (flexible JSON field)
    meta = Column("metadata", JSONB, nullable=True)  # Store additional context: endpoint, resource_id, old_value, new_value, etc.
    
    # Optional fields
    status = Column(String(20), default="success")  # success, failure, error
    error_message = Column(Text, nullable=True)


def record_audit(
    user_id: Optional[str],
    action: str,
    ip_address: Optional[str] = None,
    metadata: Optional[Dict[str, Any]] = None,
    user_agent: Optional[str] = None,
    status: str = "success",
    error_message: Optional[str] = None
) -> bool:
    """
    Record an audit log entry
    
    Args:
        user_id: The ID of the user performing the action (None for anonymous)
        action: Description of the action (e.g., "login", "create_character")
        ip_address: IP address of the request
        metadata: Additional context as a dictionary (e.g., {"resource_id": 123, "endpoint": "/api/users"})
        user_agent: Browser/client user agent string
        status: Status of the operation ("success", "failure", "error")
        error_message: Error message if status is not success
    
    Returns:
        bool: True if logged successfully, False otherwise
    
    Example:
        record_audit(
            user_id="user123",
            action="login",
            ip_address="192.168.1.1",
            metadata={"method": "password", "endpoint": "/api/auth/login"}
        )
    """
    db = SessionLocal()
    try:
        audit_entry = AuditLog(
            user_id=user_id,
            action=action,
            ip_address=ip_address,
            user_agent=user_agent,
            meta=metadata or {},
            status=status,
            error_message=error_message
        )
        db.add(audit_entry)
        db.commit()
        return True
    except Exception as e:
        logger.error(f"Failed to record audit log: {e}")
        db.rollback()
        return False
    finally:
        db.close()


def audit_request(
    request: Any,
    action: str,
    user_id: Optional[str] = None,
    metadata: Optional[Dict[str, Any]] = None,
    status: str = "success",
    error_message: Optional[str] = None
) -> bool:
    """
    Convenience wrapper around record_audit() for FastAPI route handlers.

    Pulls the client IP, user agent and request context (endpoint, method,
    query params, referer) straight off the incoming Request, so route code
    only needs to supply the action and any action-specific metadata.

    Args:
        request: The FastAPI Request for the current call
        action: Stable action name (e.g. "register", "change_email", "admin_delete_user")
        user_id: The user the action applies to (None for anonymous actions)
        metadata: Action-specific context (e.g. {"old_email": ..., "new_email": ...})
        status: Status of the operation ("success", "failure", "error")
        error_message: Error message if status is not success

    Returns:
        bool: True if logged successfully, False otherwise
    """
    from utils.request_utils import get_client_ip, get_user_agent, get_request_metadata

    return record_audit(
        user_id=user_id,
        action=action,
        ip_address=get_client_ip(request),
        user_agent=get_user_agent(request),
        metadata=get_request_metadata(request, metadata),
        status=status,
        error_message=error_message,
    )


def get_audit_logs(
    user_id: Optional[str] = None,
    action: Optional[str] = None,
    limit: int = 100,
    offset: int = 0
):
    """
    Retrieve audit logs with optional filtering
    
    Args:
        user_id: Filter by user ID
        action: Filter by action type
        limit: Maximum number of records to return
        offset: Number of records to skip
    
    Returns:
        List of audit log entries
    """
    db = SessionLocal()
    try:
        query = db.query(AuditLog)
        
        if user_id:
            query = query.filter(AuditLog.user_id == user_id)
        if action:
            query = query.filter(AuditLog.action == action)
        
        logs = query.order_by(AuditLog.timestamp.desc()).offset(offset).limit(limit).all()
        return logs
    except Exception as e:
        logger.error(f"Failed to retrieve audit logs: {e}")
        return []
    finally:
        db.close()
