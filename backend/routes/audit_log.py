"""
Audit log API routes for viewing operation logs.
Admin-only read access.
"""
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from sqlalchemy import desc, func
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
        query = query.filter(AuditLog.user_id == user_id.strip())
    if action:
        # Partial, case-insensitive so "login" also finds "login_failed" and
        # "admin_delete" finds every admin delete action.
        query = query.filter(AuditLog.action.ilike(f"%{action.strip()}%"))
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

    # `timestamp` alone is NOT a total order. Many audit rows legitimately share
    # a timestamp (same-second logins, bulk writes, backfills), and with ties
    # Postgres may return the SAME rows for different OFFSETs - so page 2 would
    # look identical to page 1. `id` makes the ordering total and stable.
    logs = (
        query.order_by(desc(AuditLog.timestamp), desc(AuditLog.id))
        .limit(limit)
        .offset(offset)
        .all()
    )

    return {
        "total": total,
        "limit": limit,
        "offset": offset,
        "audit_logs": [AuditLogResponse.model_validate(log).model_dump() for log in logs],
    }


@router.get("/actions")
def list_audit_actions(
    current_user: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db),
) -> dict:
    """Distinct action names actually present in the table, for filter UIs."""
    rows = (
        db.query(AuditLog.action, func.count(AuditLog.id).label("count"))
        .group_by(AuditLog.action)
        .order_by(func.count(AuditLog.id).desc())
        .all()
    )
    return {
        "actions": [{"action": a, "count": c} for a, c in rows],
    }
