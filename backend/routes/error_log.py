"""
Error logging API routes for managing error logs.
"""
from fastapi import APIRouter, Depends, HTTPException, Query, status, Header
from sqlalchemy.orm import Session
from sqlalchemy import desc, func
from database import get_db
from models import ErrorLogModel, User
from utils.session import get_current_admin_user, get_current_user
from pydantic import BaseModel, field_validator
from typing import List, Optional
from datetime import datetime, timedelta, UTC
import json

router = APIRouter(prefix="/api/error-logs", tags=["error-logs"])


class ErrorLogResponse(BaseModel):
    id: int
    timestamp: str
    message: str
    error_type: str
    severity: str
    source: str
    user_id: Optional[str]
    endpoint: Optional[str]
    method: Optional[str]
    status_code: Optional[int]
    client_ip: Optional[str]
    user_agent: Optional[str]
    request_body: Optional[str]
    stack_trace: Optional[str]
    context: Optional[str]
    resolved: bool
    resolved_at: Optional[str]
    resolved_by: Optional[str]

    class Config:
        from_attributes = True

    @field_validator('timestamp', mode='before')
    @classmethod
    def convert_timestamp(cls, v):
        """Convert datetime objects to ISO format strings"""
        if isinstance(v, datetime):
            return v.isoformat()
        return v

    @field_validator('resolved_at', mode='before')
    @classmethod
    def convert_resolved_at(cls, v):
        """Convert datetime objects to ISO format strings"""
        if isinstance(v, datetime):
            return v.isoformat()
        return v


class ErrorLogFilterRequest(BaseModel):
    severity: Optional[str] = None
    source: Optional[str] = None
    error_type: Optional[str] = None
    user_id: Optional[str] = None
    resolved: Optional[bool] = None
    start_date: Optional[str] = None  # ISO format
    end_date: Optional[str] = None    # ISO format
    limit: int = 100
    offset: int = 0


class ResolveErrorRequest(BaseModel):
    resolved: bool
    notes: Optional[str] = None


class LogFrontendErrorRequest(BaseModel):
    message: str
    error_type: Optional[str] = "Unknown"
    severity: Optional[str] = "error"  # info, warning, error, critical
    url: Optional[str] = None
    user_agent: Optional[str] = None
    stack_trace: Optional[str] = None
    context: Optional[dict] = None
    
    @field_validator('message')
    @classmethod
    def validate_message(cls, v):
        if not v or len(v) > 5000:
            raise ValueError('Message must be between 1 and 5000 characters')
        return v
    
    @field_validator('stack_trace')
    @classmethod
    def validate_stack_trace(cls, v):
        if v and len(v) > 50000:
            raise ValueError('Stack trace must not exceed 50000 characters')
        return v
    
    @field_validator('context')
    @classmethod
    def validate_context(cls, v):
        if v and len(json.dumps(v)) > 10000:
            raise ValueError('Context must not exceed 10000 characters when serialized')
        return v


# Static routes must come before parameterized routes to avoid route conflicts
# /stats must come before /{error_id}
@router.get("/stats")
def get_error_logs_stats(
    hours: int = Query(24, ge=1, le=720),
    current_user: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db),
) -> dict:
    """Get error log statistics for the last N hours. Admin only."""
    cutoff_date = datetime.now(UTC) - timedelta(hours=hours)
    
    logs = db.query(ErrorLogModel).filter(
        ErrorLogModel.timestamp >= cutoff_date
    ).all()
    
    # Calculate statistics
    stats = {
        "total_errors": len(logs),
        "by_severity": {},
        "by_source": {},
        "by_error_type": {},
        "critical_count": 0,
    }
    
    for log in logs:
        # By severity
        severity = log.severity or "unknown"
        stats["by_severity"][severity] = stats["by_severity"].get(severity, 0) + 1
        
        # By source
        source = log.source or "unknown"
        stats["by_source"][source] = stats["by_source"].get(source, 0) + 1
        
        # By error type
        error_type = log.error_type or "unknown"
        stats["by_error_type"][error_type] = stats["by_error_type"].get(error_type, 0) + 1
        
        # Critical count
        if log.severity == "critical":
            stats["critical_count"] += 1
    
    return stats


# /summary must come before /{error_id}
@router.get("/summary")
def get_error_logs_summary(
    current_user: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db),
) -> dict:
    """Get a summary of recent errors. Admin only."""
    # Last 24 hours
    last_24h = datetime.now(UTC) - timedelta(hours=24)
    
    recent_errors = db.query(ErrorLogModel).filter(
        ErrorLogModel.timestamp >= last_24h
    ).all()
    
    # Last 7 days
    last_7d = datetime.now(UTC) - timedelta(days=7)
    week_errors = db.query(ErrorLogModel).filter(
        ErrorLogModel.timestamp >= last_7d
    ).all()
    
    # Unresolved critical errors
    critical_unresolved = db.query(ErrorLogModel).filter(
        ErrorLogModel.severity == "critical",
        ErrorLogModel.resolved == False
    ).count()
    
    return {
        "errors_last_24h": len(recent_errors),
        "errors_last_7d": len(week_errors),
        "critical_unresolved": critical_unresolved,
        "most_common_errors": [
            {
                "error_type": log[0],
                "count": log[1]
            }
            for log in db.query(
                ErrorLogModel.error_type,
                func.count(ErrorLogModel.id)
            ).filter(
                ErrorLogModel.timestamp >= last_24h
            ).group_by(
                ErrorLogModel.error_type
            ).order_by(
                desc(func.count(ErrorLogModel.id))
            ).limit(5).all()
        ]
    }


# /frontend must come before /{error_id}
@router.post("/frontend")
def log_frontend_error(
    request: LogFrontendErrorRequest,
    db: Session = Depends(get_db),
    session_token: Optional[str] = Header(None, alias="Authorization")
) -> dict:
    """Log an error from the frontend. Can be called without authentication."""
    try:
        from utils.error_logger import get_error_logger
        from utils.session import verify_session_token
        
        # Try to get user_id if authenticated, but don't fail if not
        user_id = None
        if session_token:
            user_id = verify_session_token(session_token)
        
        error_logger = get_error_logger()
        
        # Log the error
        error_logger.log_frontend_error(
            message=request.message,
            error_type=request.error_type,
            severity=request.severity,
            url=request.url,
            user_agent=request.user_agent,
            user_id=user_id,
            stack_trace=request.stack_trace,
            context=request.context,
        )
        
        return {"message": "Error logged successfully"}
    except Exception as e:
        # Don't fail the request, just log the exception
        import traceback
        traceback.print_exc()
        return {"message": "Error logged with warnings", "error": str(e)}


# General routes - must come after specific static routes
@router.get("")
def get_error_logs(
    severity: Optional[str] = Query(None),
    source: Optional[str] = Query(None),
    error_type: Optional[str] = Query(None),
    user_id: Optional[str] = Query(None),
    resolved: Optional[bool] = Query(None),
    start_date: Optional[str] = Query(None),
    end_date: Optional[str] = Query(None),
    limit: int = Query(100, ge=1, le=1000),
    offset: int = Query(0, ge=0),
    current_user: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db),
) -> dict:
    """Get error logs with filtering. Admin only."""
    query = db.query(ErrorLogModel)
    
    # Apply filters
    if severity:
        query = query.filter(ErrorLogModel.severity == severity)
    if source:
        query = query.filter(ErrorLogModel.source == source)
    if error_type:
        query = query.filter(ErrorLogModel.error_type == error_type)
    if user_id:
        query = query.filter(ErrorLogModel.user_id == user_id)
    if resolved is not None:
        query = query.filter(ErrorLogModel.resolved == resolved)
    
    # Date filtering
    if start_date:
        try:
            start_datetime = datetime.fromisoformat(start_date)
            query = query.filter(ErrorLogModel.timestamp >= start_datetime)
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid start_date format")
    
    if end_date:
        try:
            end_datetime = datetime.fromisoformat(end_date)
            query = query.filter(ErrorLogModel.timestamp <= end_datetime)
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid end_date format")
    
    # Count total before pagination
    total = query.count()
    
    # Sort by timestamp descending and apply pagination
    error_logs = query.order_by(desc(ErrorLogModel.timestamp)).limit(limit).offset(offset).all()
    
    return {
        "total": total,
        "limit": limit,
        "offset": offset,
        "error_logs": [ErrorLogResponse.from_orm(log).dict() for log in error_logs]
    }


@router.delete("")
def delete_old_error_logs(
    days: int = Query(30, ge=1, le=365),
    current_user: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db),
) -> dict:
    """Delete error logs older than specified days. Admin only."""
    cutoff_date = datetime.now(UTC) - timedelta(days=days)
    
    deleted_count = db.query(ErrorLogModel).filter(
        ErrorLogModel.timestamp < cutoff_date
    ).delete()
    
    db.commit()
    
    return {
        "message": f"Deleted {deleted_count} error logs older than {days} days",
        "deleted_count": deleted_count
    }


# Parameterized routes - must come last
@router.get("/{error_id}")
def get_error_log(
    error_id: int,
    current_user: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db),
) -> ErrorLogResponse:
    """Get a specific error log by ID. Admin only."""
    error_log = db.query(ErrorLogModel).filter(ErrorLogModel.id == error_id).first()
    
    if not error_log:
        raise HTTPException(status_code=404, detail="Error log not found")
    
    return ErrorLogResponse.from_orm(error_log)


@router.put("/{error_id}")
def update_error_log(
    error_id: int,
    request: ResolveErrorRequest,
    current_user: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db),
) -> ErrorLogResponse:
    """Resolve or update an error log. Admin only."""
    error_log = db.query(ErrorLogModel).filter(ErrorLogModel.id == error_id).first()
    
    if not error_log:
        raise HTTPException(status_code=404, detail="Error log not found")
    
    error_log.resolved = request.resolved
    if request.resolved:
        error_log.resolved_at = datetime.now(UTC)
        error_log.resolved_by = current_user.id
    else:
        error_log.resolved_at = None
        error_log.resolved_by = None
    
    db.commit()
    db.refresh(error_log)
    
    return ErrorLogResponse.from_orm(error_log)


@router.delete("/{error_id}")
def delete_error_log(
    error_id: int,
    current_user: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db),
) -> dict:
    """Delete an error log. Admin only."""
    error_log = db.query(ErrorLogModel).filter(ErrorLogModel.id == error_id).first()
    
    if not error_log:
        raise HTTPException(status_code=404, detail="Error log not found")
    
    db.delete(error_log)
    db.commit()
    
    return {"message": "Error log deleted successfully"}
