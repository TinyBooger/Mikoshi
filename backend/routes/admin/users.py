"""Admin API: user analytics, user management, Pro grants, linked accounts and
direct user moderation.
"""

import re
from datetime import datetime, timedelta, UTC
from typing import Dict, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import func, desc, and_, or_
from sqlalchemy.orm import Session

from database import get_db
from models import (
    User,
    ChatHistory,
    ChatHistoryMessage,
    UserCreditUsageLedger,
    UserModerationLog,
    ContentModerationLog,
)
from schemas import UserMessageOut
from utils.audit_logger import AuditLog
from utils.session import get_current_admin_user
from utils.user_utils import enrich_user_with_character_count, build_user_response
from .common import _pwd_context, _log_user_moderation

router = APIRouter(tags=["admin"])


# Pydantic models for request bodies
class AdminCreateUserRequest(BaseModel):
    email: str
    name: str
    password: str
    bio: Optional[str] = None
    is_admin: bool = False


class UserUpdate(BaseModel):
    name: Optional[str] = None
    phone_number: Optional[str] = None
    bio: Optional[str] = None
    is_admin: Optional[bool] = None
    is_pro: Optional[bool] = None
    pro_start_date: Optional[datetime] = None
    pro_expire_date: Optional[datetime] = None


class AdminProGrantRequest(BaseModel):
    """Grant Pro membership for a preset number of months (1/3/6/12)."""
    months: int


class DirectModerationRequest(BaseModel):
    action: str               # warn | upload_ban | full_ban | shadow_ban | unban
    notes: Optional[str] = None
    ban_until: Optional[datetime] = None
    ban_reason: Optional[str] = None
    ban_note: Optional[str] = None


@router.get("/user-stats")
def get_user_data_stats(
    db: Session = Depends(get_db),
    current_admin: User = Depends(get_current_admin_user)
):
    """Get user-centric platform statistics for admin analytics."""
    now = datetime.now(UTC)
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    yesterday_start = today_start - timedelta(days=1)
    seven_days_ago = today_start - timedelta(days=7)
    thirty_days_ago = today_start - timedelta(days=30)
    eight_days_ago = today_start - timedelta(days=8)

    total_users = db.query(func.count(User.id)).scalar() or 0

    active_pro_users = db.query(func.count(User.id)).filter(
        User.is_pro.is_(True),
        and_(
            or_(User.pro_start_date.is_(None), User.pro_start_date <= now),
            or_(User.pro_expire_date.is_(None), User.pro_expire_date >= now),
        )
    ).scalar() or 0

    registered_today = db.query(func.count(func.distinct(AuditLog.user_id))).filter(
        AuditLog.action == "register",
        AuditLog.user_id.isnot(None),
        AuditLog.timestamp >= today_start
    ).scalar() or 0

    registered_yesterday = db.query(func.count(func.distinct(AuditLog.user_id))).filter(
        AuditLog.action == "register",
        AuditLog.user_id.isnot(None),
        AuditLog.timestamp >= yesterday_start,
        AuditLog.timestamp < today_start,
    ).scalar() or 0

    activity_user_ids = set()

    today_login_users = db.query(AuditLog.user_id).filter(
        AuditLog.action == "login",
        AuditLog.user_id.isnot(None),
        AuditLog.timestamp >= today_start
    ).distinct().all()
    activity_user_ids.update(user_id for (user_id,) in today_login_users)

    today_chat_users = db.query(ChatHistory.user_id).filter(
        ChatHistory.last_updated >= today_start
    ).distinct().all()
    activity_user_ids.update(user_id for (user_id,) in today_chat_users)

    dau = len(activity_user_ids)

    weekly_activity_user_ids = set()
    weekly_login_users = db.query(AuditLog.user_id).filter(
        AuditLog.action == "login",
        AuditLog.user_id.isnot(None),
        AuditLog.timestamp >= seven_days_ago
    ).distinct().all()
    weekly_activity_user_ids.update(user_id for (user_id,) in weekly_login_users)

    weekly_chat_users = db.query(ChatHistory.user_id).filter(
        ChatHistory.last_updated >= seven_days_ago
    ).distinct().all()
    weekly_activity_user_ids.update(user_id for (user_id,) in weekly_chat_users)

    monthly_activity_user_ids = set(weekly_activity_user_ids)
    monthly_login_users = db.query(AuditLog.user_id).filter(
        AuditLog.action == "login",
        AuditLog.user_id.isnot(None),
        AuditLog.timestamp >= thirty_days_ago
    ).distinct().all()
    monthly_activity_user_ids.update(user_id for (user_id,) in monthly_login_users)

    monthly_chat_users = db.query(ChatHistory.user_id).filter(
        ChatHistory.last_updated >= thirty_days_ago
    ).distinct().all()
    monthly_activity_user_ids.update(user_id for (user_id,) in monthly_chat_users)

    wau = len(weekly_activity_user_ids)
    mau = len(monthly_activity_user_ids)

    avg_chat_length = 0
    active_branch_counts = (
        db.query(ChatHistory.chat_id, func.count(ChatHistoryMessage.id).label("message_count"))
        .outerjoin(
            ChatHistoryMessage,
            and_(
                ChatHistoryMessage.chat_id == ChatHistory.chat_id,
                ChatHistoryMessage.branch_id == ChatHistory.active_branch_id,
            ),
        )
        .group_by(ChatHistory.chat_id)
        .all()
    )
    if active_branch_counts:
        total_message_count = sum(int(message_count or 0) for _, message_count in active_branch_counts)
        avg_chat_length = total_message_count / len(active_branch_counts)

    total_chat_sessions = db.query(func.count(ChatHistory.id)).scalar() or 0

    registrations = db.query(
        AuditLog.user_id,
        func.date(AuditLog.timestamp)
    ).filter(
        AuditLog.action == "register",
        AuditLog.user_id.isnot(None),
        AuditLog.timestamp >= eight_days_ago
    ).all()

    activity_dates: Dict[str, set] = {}

    login_activity = db.query(
        AuditLog.user_id,
        func.date(AuditLog.timestamp)
    ).filter(
        AuditLog.action == "login",
        AuditLog.user_id.isnot(None),
        AuditLog.timestamp >= eight_days_ago
    ).all()

    chat_activity = db.query(
        ChatHistory.user_id,
        func.date(ChatHistory.last_updated)
    ).filter(
        ChatHistory.last_updated >= eight_days_ago
    ).all()

    for user_id, activity_date in login_activity + chat_activity:
        if not user_id or activity_date is None:
            continue
        if user_id not in activity_dates:
            activity_dates[user_id] = set()
        activity_dates[user_id].add(activity_date)

    today_date = today_start.date()
    d1_eligible = 0
    d1_retained = 0
    d7_eligible = 0
    d7_retained = 0

    for user_id, register_date in registrations:
        if not user_id or register_date is None:
            continue

        user_activity_dates = activity_dates.get(user_id, set())

        d1_date = register_date + timedelta(days=1)
        if d1_date <= today_date:
            d1_eligible += 1
            if d1_date in user_activity_dates:
                d1_retained += 1

        d7_date = register_date + timedelta(days=7)
        if d7_date <= today_date:
            d7_eligible += 1
            if d7_date in user_activity_dates:
                d7_retained += 1

    d1_retention = (d1_retained / d1_eligible * 100) if d1_eligible else 0
    d7_retention = (d7_retained / d7_eligible * 100) if d7_eligible else 0

    today_token_rows = db.query(
        UserCreditUsageLedger.user_id,
        UserCreditUsageLedger.total_tokens,
        UserCreditUsageLedger.credit_amount,
    ).filter(
        UserCreditUsageLedger.usage_date == today_date
    ).all()

    top_daily_token_users = sorted(
        [(user_id, int(total_tokens or 0), round(float(credit_amount or 0), 4)) for user_id, total_tokens, credit_amount in today_token_rows if user_id],
        key=lambda item: item[1],
        reverse=True,
    )[:10]

    today_token_sum = sum(int(total_tokens or 0) for _, total_tokens, _ in today_token_rows)
    today_credit_sum = round(sum(float(credit_amount or 0) for _, _, credit_amount in today_token_rows), 4)
    today_active_token_users = sum(1 for _, total_tokens, _ in today_token_rows if int(total_tokens or 0) > 0)
    avg_daily_tokens_per_active_user = (
        today_token_sum / today_active_token_users
        if today_active_token_users > 0 else 0
    )

    top_daily_message_users = []

    return {
        "snapshot_at": now.isoformat(),
        "metrics": {
            "user_count": total_users,
            "user_increase_today": registered_today,
            "user_increase_yesterday": registered_yesterday,
            "dau": dau,
            "wau": wau,
            "mau": mau,
            "d1_retention": round(d1_retention, 2),
            "d7_retention": round(d7_retention, 2),
            "avg_chat_length": round(float(avg_chat_length), 2),
            "total_chat_sessions": total_chat_sessions,
            "active_pro_user_rate": round((active_pro_users / total_users * 100), 2) if total_users else 0,
            "active_pro_user_count": active_pro_users,
            "avg_daily_tokens_per_active_user": round(avg_daily_tokens_per_active_user, 2),
            "today_credit_sum": today_credit_sum,
        },
        "single_user_daily_credit_usage": [
            {
                "user_id": user_id,
                "total_tokens": total_tokens,
                "credit_amount": credit_amount,
            }
            for user_id, total_tokens, credit_amount in top_daily_token_users
        ],
        "top_daily_message_users": top_daily_message_users[:10],
        "notes": {
            "credit_usage": "Summed from daily ledger rows written from API response usage.",
            "retention": "D1/D7 are cohort-based using register audit logs and login/chat activity dates.",
        }
    }


@router.get("/user-stats/user/{user_id}")
def get_single_user_credit_usage(
    user_id: str,
    db: Session = Depends(get_db),
    current_admin: User = Depends(get_current_admin_user)
):
    """Get token usage metrics for a single user - Admin only."""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    now = datetime.now(UTC)
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    month_start = today_start.replace(day=1).date()
    thirty_days_ago = (today_start - timedelta(days=30)).date()
    today_date = today_start.date()

    daily_tokens = (
        db.query(func.coalesce(func.sum(UserCreditUsageLedger.total_tokens), 0))
        .filter(
            UserCreditUsageLedger.user_id == user_id,
            UserCreditUsageLedger.usage_date == today_date,
        )
        .scalar()
    ) or 0

    daily_credits = (
        db.query(func.coalesce(func.sum(UserCreditUsageLedger.credit_amount), 0.0))
        .filter(
            UserCreditUsageLedger.user_id == user_id,
            UserCreditUsageLedger.usage_date == today_date,
        )
        .scalar()
    ) or 0.0

    monthly_tokens = (
        db.query(func.coalesce(func.sum(UserCreditUsageLedger.total_tokens), 0))
        .filter(
            UserCreditUsageLedger.user_id == user_id,
            UserCreditUsageLedger.usage_date >= month_start,
        )
        .scalar()
    ) or 0

    monthly_credits = (
        db.query(func.coalesce(func.sum(UserCreditUsageLedger.credit_amount), 0.0))
        .filter(
            UserCreditUsageLedger.user_id == user_id,
            UserCreditUsageLedger.usage_date >= month_start,
        )
        .scalar()
    ) or 0.0

    rolling_30d_tokens = (
        db.query(func.coalesce(func.sum(UserCreditUsageLedger.total_tokens), 0))
        .filter(
            UserCreditUsageLedger.user_id == user_id,
            UserCreditUsageLedger.usage_date >= thirty_days_ago,
        )
        .scalar()
    ) or 0

    rolling_30d_credits = (
        db.query(func.coalesce(func.sum(UserCreditUsageLedger.credit_amount), 0.0))
        .filter(
            UserCreditUsageLedger.user_id == user_id,
            UserCreditUsageLedger.usage_date >= thirty_days_ago,
        )
        .scalar()
    ) or 0.0

    daily_chat_sessions = db.query(func.count(ChatHistory.id)).filter(
        ChatHistory.user_id == user_id,
        ChatHistory.last_updated >= today_start,
    ).scalar() or 0

    return {
        "user_id": user_id,
        "user_name": user.name,
        "snapshot_at": now.isoformat(),
        "daily_tokens": int(daily_tokens),
        "daily_credits": round(float(daily_credits), 4),
        "monthly_tokens": int(monthly_tokens),
        "monthly_credits": round(float(monthly_credits), 4),
        "rolling_30d_tokens": int(rolling_30d_tokens),
        "rolling_30d_credits": round(float(rolling_30d_credits), 4),
        "daily_chat_sessions": daily_chat_sessions,
        "purchased_credit_balance": round(float(user.purchased_credit_balance or 0), 4),
        "notes": {
            "credit_usage": "Summed from daily ledger rows written from API response usage. Credits = (input_tokens * input_price + output_tokens * output_price) / 1000.",
        },
    }


@router.get("/users")
def get_all_users(
    db: Session = Depends(get_db),
    current_admin: User = Depends(get_current_admin_user)
):
    """Get all users - Admin only"""
    users = db.query(User).all()
    return [enrich_user_with_character_count(user, db) for user in users]


@router.get("/users/{user_id}")
def get_admin_user_detail(
    user_id: str,
    db: Session = Depends(get_db),
    current_admin: User = Depends(get_current_admin_user)
):
    """Get a single user's current status - Admin only.

    Unlike the list rows (which reflect the moment the list was loaded), this
    always returns live state: pro dates/status, ban fields (incl. shadow ban),
    credit caps and invite info fetched at request time.
    """
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    from utils.credit_cap import get_credit_cap_info

    detail = enrich_user_with_character_count(user, db)
    detail["invitation_code"] = user.invitation_code
    detail["invited_by"] = user.invited_by
    detail["credit_cap"] = get_credit_cap_info(user, db)
    return detail


@router.post("/users/{user_id}/grant-pro")
def grant_pro_duration(
    user_id: str,
    payload: AdminProGrantRequest,
    db: Session = Depends(get_db),
    current_admin: User = Depends(get_current_admin_user)
):
    """Grant or extend Pro by a preset number of months - Admin only.

    Mirrors the self-serve purchase flow: an active subscription is extended
    from its current expiry date (calendar-month math), otherwise a fresh
    subscription starts from now.
    """
    if payload.months not in (1, 3, 6, 12):
        raise HTTPException(status_code=400, detail="months must be one of 1, 3, 6, or 12")

    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    from utils.user_utils import upgrade_to_pro

    upgrade_to_pro(user, db, duration_months=payload.months)

    return {
        "message": f"Pro granted for {payload.months} month(s)",
        "user": enrich_user_with_character_count(user, db),
    }


@router.post("/users/{user_id}/revoke-pro")
def revoke_pro_membership(
    user_id: str,
    db: Session = Depends(get_db),
    current_admin: User = Depends(get_current_admin_user)
):
    """Immediately end a user's Pro membership - Admin only.

    Sets the expiry date to now so the user actually loses Pro access right
    away (Pro status is derived from pro_expire_date).
    """
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    from utils.user_utils import downgrade_from_pro

    downgrade_from_pro(user, db, end_now=True)

    return {
        "message": "Pro membership revoked",
        "user": enrich_user_with_character_count(user, db),
    }


@router.get("/users/{user_id}/linked-accounts")
def get_linked_accounts(
    user_id: str,
    db: Session = Depends(get_db),
    current_admin: User = Depends(get_current_admin_user)
):
    """Return other users who share an IP or device fingerprint with the given user."""
    target = db.query(User).filter(User.id == user_id).first()
    if not target:
        raise HTTPException(status_code=404, detail="User not found")

    target_ips = list(target.last_known_ips or [])
    target_fps = list(target.device_fingerprints or [])

    if not target_ips and not target_fps:
        return {"user_id": user_id, "linked": []}

    # Find users sharing at least one IP or fingerprint
    from sqlalchemy import cast
    from sqlalchemy.dialects.postgresql import ARRAY as PG_ARRAY
    from sqlalchemy import Text as SAText

    candidates = db.query(User).filter(User.id != user_id).all()

    linked = []
    for u in candidates:
        u_ips = list(u.last_known_ips or [])
        u_fps = list(u.device_fingerprints or [])
        shared_ips = list(set(target_ips) & set(u_ips))
        shared_fps = list(set(target_fps) & set(u_fps))
        if shared_ips or shared_fps:
            linked.append({
                "id": u.id,
                "name": u.name,
                "email": u.email,
                "phone_number": u.phone_number,
                "ban_type": u.ban_type,
                "shared_ips": shared_ips,
                "shared_fingerprints": shared_fps,
            })

    return {"user_id": user_id, "linked": linked}


@router.post("/users", status_code=201)
def admin_create_user(
    payload: AdminCreateUserRequest,
    db: Session = Depends(get_db),
    current_admin: User = Depends(get_current_admin_user),
):
    """Create a user account directly - Admin only. Bypasses phone verification, captcha, and invitation codes."""
    email = payload.email.strip().lower()

    if not re.match(r'^[^@\s]+@[^@\s]+\.[^@\s]+$', email):
        raise HTTPException(status_code=400, detail="Invalid email format")
    if len(email) > 100:
        raise HTTPException(status_code=400, detail="Email too long (max 100 characters)")

    name = payload.name.strip()
    if not name:
        raise HTTPException(status_code=400, detail="Name is required")
    if len(name) > 50:
        raise HTTPException(status_code=400, detail="Name too long (max 50 characters)")

    if len(payload.password) < 6:
        raise HTTPException(status_code=400, detail="Password must be at least 6 characters")
    if len(payload.password) > 128:
        raise HTTPException(status_code=400, detail="Password too long (max 128 characters)")

    if db.query(User).filter(User.email == email).first():
        raise HTTPException(status_code=400, detail="Email already registered")

    hashed_password = _pwd_context.hash(payload.password)

    user = User(
        id=email,
        email=email,
        name=name,
        bio=payload.bio or None,
        hashed_password=hashed_password,
        is_admin=payload.is_admin,
        profile_pic=None,
        last_known_ips=[],
        device_fingerprints=[],
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    return {
        "id": user.id,
        "email": user.email,
        "name": user.name,
        "is_admin": user.is_admin,
        "message": "User created successfully",
    }


@router.delete("/users/{user_id}")
def delete_user(
    user_id: str,
    db: Session = Depends(get_db),
    current_admin: User = Depends(get_current_admin_user)
):
    """Delete a user - Admin only"""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    # Prevent admin from deleting themselves
    if user.id == current_admin.id:
        raise HTTPException(status_code=400, detail="Cannot delete your own account")

    db.delete(user)
    db.commit()
    return {"message": "User deleted successfully"}


@router.patch("/users/{user_id}/toggle-admin")
def toggle_admin_status(
    user_id: str,
    db: Session = Depends(get_db),
    current_admin: User = Depends(get_current_admin_user)
):
    """Toggle admin status for a user - Admin only"""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    # Prevent admin from removing their own admin status
    if user.id == current_admin.id:
        raise HTTPException(status_code=400, detail="Cannot modify your own admin status")

    user.is_admin = not user.is_admin
    db.commit()

    return {
        "message": f"User {'granted' if user.is_admin else 'revoked'} admin privileges",
        "is_admin": user.is_admin
    }


@router.post("/users/{user_id}/moderate")
def moderate_user_directly(
    user_id: str,
    payload: DirectModerationRequest,
    db: Session = Depends(get_db),
    current_admin: User = Depends(get_current_admin_user),
):
    """Apply a moderation action directly to a user (no report required) - Admin only."""
    valid_actions = {"warn", "upload_ban", "full_ban", "shadow_ban", "unban"}
    action = (payload.action or "").strip().lower()
    if action not in valid_actions:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid action. Expected one of: {', '.join(sorted(valid_actions))}",
        )

    target = db.query(User).filter(User.id == user_id).first()
    if not target:
        raise HTTPException(status_code=404, detail="User not found")

    if action in {"upload_ban", "full_ban", "shadow_ban"}:
        target.ban_type = action
        target.ban_until = payload.ban_until
        target.ban_reason = payload.ban_reason
        target.ban_note = payload.ban_note
    elif action == "unban":
        target.ban_type = None
        target.ban_until = None
        target.ban_reason = None
        target.ban_note = None

    # Log this moderation action
    _log_user_moderation(
        db,
        user_id=user_id,
        action=action,
        admin=current_admin,
        ban_reason=payload.ban_reason,
        ban_note=payload.ban_note,
        ban_until=payload.ban_until,
        notes=payload.notes,
        source="direct",
    )

    # Send inbox message to the affected user
    from routes.user_messages import create_moderation_message
    create_moderation_message(
        db=db,
        user_id=user_id,
        action=action,
        notes=payload.notes,
        admin_id=current_admin.id,
        ban_until=payload.ban_until,
        ban_reason=payload.ban_reason,
    )

    db.commit()
    return {
        "message": f"Action '{action}' applied to user {user_id}",
        "ban_type": target.ban_type,
    }


@router.get("/users/{user_id}/violation-history")
def get_user_violation_history(
    user_id: str,
    db: Session = Depends(get_db),
    current_admin: User = Depends(get_current_admin_user),
):
    """Return the full violation/punishment history for a user - Admin only."""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    account_logs = (
        db.query(UserModerationLog)
        .filter(UserModerationLog.user_id == user_id)
        .order_by(desc(UserModerationLog.created_at))
        .all()
    )

    content_logs = (
        db.query(ContentModerationLog)
        .filter(ContentModerationLog.creator_id == user_id)
        .order_by(desc(ContentModerationLog.created_at))
        .all()
    )

    return {
        "user_id": user_id,
        "account_actions": [
            {
                "id": log.id,
                "action": log.action,
                "ban_reason": log.ban_reason,
                "ban_note": log.ban_note,
                "ban_until": log.ban_until.isoformat() if log.ban_until else None,
                "admin_name": log.admin_name,
                "source": log.source,
                "source_report_id": log.source_report_id,
                "notes": log.notes,
                "created_at": log.created_at.isoformat(),
            }
            for log in account_logs
        ],
        "content_actions": [
            {
                "id": log.id,
                "entity_type": log.entity_type,
                "entity_id": log.entity_id,
                "entity_name": log.entity_name,
                "action": log.action,
                "admin_name": log.admin_name,
                "source": log.source,
                "source_report_id": log.source_report_id,
                "notes": log.notes,
                "created_at": log.created_at.isoformat(),
            }
            for log in content_logs
        ],
    }


@router.patch("/users/{user_id}", response_model=UserMessageOut)
def update_user(
    user_id: str,
    update_data: UserUpdate,
    db: Session = Depends(get_db),
    current_admin: User = Depends(get_current_admin_user)
):
    """Update user details - Admin only"""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    provided_fields = update_data.model_fields_set

    # Update only provided fields
    if update_data.name is not None:
        user.name = update_data.name
    if update_data.phone_number is not None:
        user.phone_number = update_data.phone_number
    if update_data.bio is not None:
        user.bio = update_data.bio
    if update_data.is_admin is not None:
        # Prevent admin from removing their own admin status
        if user.id == current_admin.id and not update_data.is_admin:
            raise HTTPException(status_code=400, detail="Cannot remove your own admin status")
        user.is_admin = update_data.is_admin
    if update_data.is_pro is not None:
        user.is_pro = update_data.is_pro
    if "pro_start_date" in provided_fields:
        user.pro_start_date = update_data.pro_start_date
    if "pro_expire_date" in provided_fields:
        user.pro_expire_date = update_data.pro_expire_date

    effective_pro_start_date = update_data.pro_start_date if "pro_start_date" in provided_fields else user.pro_start_date
    effective_pro_expire_date = update_data.pro_expire_date if "pro_expire_date" in provided_fields else user.pro_expire_date

    if update_data.is_pro is True and not effective_pro_start_date and not effective_pro_expire_date:
        now = datetime.now(UTC)
        user.pro_start_date = now
        from utils.user_utils import _add_months
        user.pro_expire_date = _add_months(now, 1)
        effective_pro_start_date = user.pro_start_date
        effective_pro_expire_date = user.pro_expire_date

    if effective_pro_start_date and effective_pro_expire_date and effective_pro_expire_date < effective_pro_start_date:
        raise HTTPException(status_code=400, detail="Pro expire date must be after pro start date")


    db.commit()
    db.refresh(user)

    return {
        "message": "User updated successfully",
        "user": build_user_response(user, db)
    }
