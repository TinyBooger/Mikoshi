"""
Audit log API routes for viewing operation logs.
Admin-only read access.
"""
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from sqlalchemy import desc
from pydantic import BaseModel, field_validator
from typing import Optional
from datetime import datetime, UTC

from database import get_db
from utils.session import get_current_admin_user
from models import User
from utils.audit_logger import AuditLog

router = APIRouter(prefix="/api/audit-logs", tags=["audit-logs"])


class AuditLogResponse(BaseModel):
    id: int
    user_id: Optional[str]
    action: str
    timestamp: str
    ip_address: Optional[str]
    user_agent: Optional[str]
    meta: Optional[dict]
    status: Optional[str]
    error_message: Optional[str]

    class Config:
        from_attributes = True

    @field_validator('timestamp', mode='before')
    @classmethod
    def convert_timestamp(cls, v):
        if isinstance(v, datetime):
            return v.isoformat()
        return v


@router.get("")
def get_audit_logs(
    user_id: Optional[str] = Query(None),
    action: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    start_date: Optional[str] = Query(None),
    end_date: Optional[str] = Query(None),
    limit: int = Query(100, ge=1, le=500),
    offset: int = Query(0, ge=0),
    current_user: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db),
) -> dict:
    """Get audit logs with optional filters (admin only)."""
    query = db.query(AuditLog)

    if user_id:
        query = query.filter(AuditLog.user_id == user_id)
    if action:
        query = query.filter(AuditLog.action == action)
    if status:
        query = query.filter(AuditLog.status == status)

    if start_date:
        try:
            start_dt = datetime.fromisoformat(start_date)
            if start_dt.tzinfo is None:
                start_dt = start_dt.replace(tzinfo=UTC)
            query = query.filter(AuditLog.timestamp >= start_dt)
        except ValueError:
            pass

    if end_date:
        try:
            end_dt = datetime.fromisoformat(end_date)
            if end_dt.tzinfo is None:
                end_dt = end_dt.replace(tzinfo=UTC)
            query = query.filter(AuditLog.timestamp <= end_dt)
        except ValueError:
            pass

    total = query.count()
    logs = query.order_by(desc(AuditLog.timestamp)).limit(limit).offset(offset).all()

    return {
        "total": total,
        "audit_logs": [AuditLogResponse.from_orm(log).dict() for log in logs],
    }
