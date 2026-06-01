import re
from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session
from sqlalchemy import func, desc, or_, and_
from datetime import datetime, timedelta, UTC
from passlib.context import CryptContext
from database import get_db
from models import User, Character, Tag, SearchTerm, ChatHistory, ChatHistoryMessage, UserTokenUsageLedger, ContentReviewQueue, ProblemReport, SystemSettings, Scene, Persona, BanAppeal, ContentBanAppeal, UserModerationLog, ContentModerationLog
from utils.session import get_current_admin_user
from utils.security_middleware import get_rate_limit_status
from utils.user_utils import enrich_user_with_character_count, build_user_response
from typing import List, Optional, Dict
from pydantic import BaseModel
from schemas import UserOut, UserMessageOut
from utils.audit_logger import AuditLog
from utils.local_storage_utils import delete_stored_image
from utils.token_wallet import get_token_topup_packages, set_token_topup_packages
from routes.user_messages import create_moderation_message, create_content_moderation_message

router = APIRouter(prefix="/api/admin", tags=["admin"])
_pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


# ---------------------------------------------------------------------------
# Moderation log helpers
# ---------------------------------------------------------------------------

def _log_user_moderation(
    db: Session,
    *,
    user_id: str,
    action: str,
    admin: User,
    ban_reason: Optional[str] = None,
    ban_note: Optional[str] = None,
    ban_until=None,
    notes: Optional[str] = None,
    source: str = "direct",
    source_report_id: Optional[int] = None,
):
    """Insert a UserModerationLog row (does not commit)."""
    db.add(UserModerationLog(
        user_id=user_id,
        action=action,
        ban_reason=ban_reason,
        ban_note=ban_note,
        ban_until=ban_until,
        admin_id=admin.id,
        admin_name=admin.name,
        source=source,
        source_report_id=source_report_id,
        notes=notes,
    ))


def _log_content_moderation(
    db: Session,
    *,
    creator_id: str,
    entity_type: str,
    entity_id: int,
    entity_name: Optional[str],
    action: str,
    admin: User,
    notes: Optional[str] = None,
    source: str = "direct",
    source_report_id: Optional[int] = None,
):
    """Insert a ContentModerationLog row (does not commit)."""
    db.add(ContentModerationLog(
        creator_id=creator_id,
        entity_type=entity_type,
        entity_id=entity_id,
        entity_name=entity_name,
        action=action,
        admin_id=admin.id,
        admin_name=admin.name,
        source=source,
        source_report_id=source_report_id,
        notes=notes,
    ))


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


class CharacterUpdate(BaseModel):
    name: Optional[str] = None
    persona: Optional[str] = None
    tagline: Optional[str] = None
    greeting: Optional[str] = None
    example_messages: Optional[str] = None
    tags: Optional[List[str]] = None
    is_public: Optional[bool] = None
    is_forkable: Optional[bool] = None


class SceneUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    intro: Optional[str] = None
    greeting: Optional[str] = None
    tags: Optional[List[str]] = None
    is_public: Optional[bool] = None
    is_forkable: Optional[bool] = None


class PersonaUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    intro: Optional[str] = None
    tags: Optional[List[str]] = None
    is_public: Optional[bool] = None
    is_forkable: Optional[bool] = None


class ContentModerationRequest(BaseModel):
    action: str               # restrict | takedown | unban | delete
    notes: Optional[str] = None


class TagUpdate(BaseModel):
    name: Optional[str] = None


class ContentReviewResolveRequest(BaseModel):
    action: str
    notes: Optional[str] = None


class TokenTopupPackageItem(BaseModel):
    id: str
    tokens: int
    price_cny: float
    label: Optional[str] = None


class TokenTopupPackagesUpdateRequest(BaseModel):
    packages: List[TokenTopupPackageItem]


class UserModerationActionRequest(BaseModel):
    action: str  # warn | upload_ban | full_ban | shadow_ban | unban | ignore | keep | hide | delete
    notes: Optional[str] = None          # saved as admin_notes on the report
    ban_until: Optional[datetime] = None  # optional expiry for any ban type
    ban_reason: Optional[str] = None      # categorical tag: harassment/spam/abuse/underage/other
    ban_note: Optional[str] = None        # moderator-visible free text note on the ban


class BatchModerationActionRequest(BaseModel):
    report_ids: List[int]
    action: str
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
        UserTokenUsageLedger.user_id,
        UserTokenUsageLedger.total_tokens,
    ).filter(
        UserTokenUsageLedger.usage_date == today_date
    ).all()

    top_daily_token_users = sorted(
        [(user_id, int(total_tokens or 0)) for user_id, total_tokens in today_token_rows if user_id],
        key=lambda item: item[1],
        reverse=True,
    )[:10]

    today_token_sum = sum(int(total_tokens or 0) for _, total_tokens in today_token_rows)
    today_active_token_users = sum(1 for _, total_tokens in today_token_rows if int(total_tokens or 0) > 0)
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
        },
        "single_user_daily_token_usage": [
            {
                "user_id": user_id,
                "total_tokens": total_tokens,
            }
            for user_id, total_tokens in top_daily_token_users
        ],
        "top_daily_message_users": top_daily_message_users[:10],
        "notes": {
            "token_usage": "Summed from daily ledger rows written from API response usage.",
            "retention": "D1/D7 are cohort-based using register audit logs and login/chat activity dates.",
        }
    }


@router.get("/user-stats/user/{user_id}")
def get_single_user_token_usage(
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
        db.query(func.coalesce(func.sum(UserTokenUsageLedger.total_tokens), 0))
        .filter(
            UserTokenUsageLedger.user_id == user_id,
            UserTokenUsageLedger.usage_date == today_date,
        )
        .scalar()
    ) or 0

    monthly_tokens = (
        db.query(func.coalesce(func.sum(UserTokenUsageLedger.total_tokens), 0))
        .filter(
            UserTokenUsageLedger.user_id == user_id,
            UserTokenUsageLedger.usage_date >= month_start,
        )
        .scalar()
    ) or 0

    rolling_30d_tokens = (
        db.query(func.coalesce(func.sum(UserTokenUsageLedger.total_tokens), 0))
        .filter(
            UserTokenUsageLedger.user_id == user_id,
            UserTokenUsageLedger.usage_date >= thirty_days_ago,
        )
        .scalar()
    ) or 0

    daily_chat_sessions = db.query(func.count(ChatHistory.id)).filter(
        ChatHistory.user_id == user_id,
        ChatHistory.last_updated >= today_start,
    ).scalar() or 0

    return {
        "user_id": user_id,
        "user_name": user.name,
        "snapshot_at": now.isoformat(),
        "daily_tokens": int(daily_tokens),
        "monthly_tokens": int(monthly_tokens),
        "rolling_30d_tokens": int(rolling_30d_tokens),
        "daily_chat_sessions": daily_chat_sessions,
        "notes": {
            "token_usage": "Summed from daily ledger rows written from API response usage.",
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


@router.get("/characters")
def get_all_characters(
    db: Session = Depends(get_db),
    current_admin: User = Depends(get_current_admin_user)
):
    """Get all characters - Admin only"""
    characters = db.query(Character).all()
    return [
        {
            "id": char.id,
            "name": char.name,
            "tagline": char.tagline,
            "creator_name": char.creator_name,
            "is_public": char.is_public,
            "is_forkable": char.is_forkable,
            "views": char.views,
            "likes": char.likes,
            "created_time": char.created_time,
            "tags": char.tags
        }
        for char in characters
    ]


@router.get("/scenes")
def get_all_scenes(
    db: Session = Depends(get_db),
    current_admin: User = Depends(get_current_admin_user)
):
    """Get all scenes - Admin only"""
    scenes = db.query(Scene).all()
    return [
        {
            "id": s.id,
            "name": s.name,
            "intro": s.intro,
            "creator_name": s.creator_name,
            "is_public": s.is_public,
            "is_forkable": s.is_forkable,
            "views": s.views,
            "likes": s.likes,
            "moderation_status": s.moderation_status,
            "created_time": s.created_time,
            "tags": s.tags,
        }
        for s in scenes
    ]


@router.get("/personas")
def get_all_personas(
    db: Session = Depends(get_db),
    current_admin: User = Depends(get_current_admin_user)
):
    """Get all personas - Admin only"""
    personas = db.query(Persona).all()
    return [
        {
            "id": p.id,
            "name": p.name,
            "intro": p.intro,
            "creator_name": p.creator_name,
            "is_public": p.is_public,
            "is_forkable": p.is_forkable,
            "views": p.views,
            "likes": p.likes,
            "moderation_status": p.moderation_status,
            "created_time": p.created_time,
            "tags": p.tags,
        }
        for p in personas
    ]


@router.get("/review-queue")
def get_content_review_queue(
    status: str = "pending",
    db: Session = Depends(get_db),
    current_admin: User = Depends(get_current_admin_user)
):
    """Get content review queue entries - Admin only"""
    query = db.query(ContentReviewQueue)
    if status and status != "all":
        query = query.filter(ContentReviewQueue.status == status)

    items = query.order_by(desc(ContentReviewQueue.created_time)).all()
    result = []

    for item in items:
        character = None
        if item.character_id:
            character = db.query(Character).filter(Character.id == item.character_id).first()

        linked_report = None
        if item.triggered_by_report_id:
            linked_report = db.query(ProblemReport).filter(ProblemReport.id == item.triggered_by_report_id).first()

        result.append({
            "id": item.id,
            "character_id": item.character_id,
            "character_name": (character.name if character else item.character_name),
            "character_exists": bool(character),
            "character_is_public": character.is_public if character else None,
            "character_creator_name": character.creator_name if character else None,
            "source": item.source,
            "reason": item.reason,
            "status": item.status,
            "triggered_by_report_id": item.triggered_by_report_id,
            "report_description": linked_report.description if linked_report else None,
            "created_time": item.created_time,
            "updated_time": item.updated_time,
            "resolved_time": item.resolved_time,
            "resolved_by": item.resolved_by,
            "resolution_notes": item.resolution_notes,
        })

    return result


@router.patch("/review-queue/{queue_id}")
def resolve_content_review_queue_item(
    queue_id: int,
    payload: ContentReviewResolveRequest,
    db: Session = Depends(get_db),
    current_admin: User = Depends(get_current_admin_user)
):
    """Resolve review queue entries with an explicit admin action - Admin only"""
    item = db.query(ContentReviewQueue).filter(ContentReviewQueue.id == queue_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Review queue item not found")

    action = (payload.action or "").strip().lower()
    if action not in {"keep", "hide", "delete"}:
        raise HTTPException(status_code=400, detail="Invalid action. Expected keep, hide, or delete")

    character = None
    if item.character_id:
        character = db.query(Character).filter(Character.id == item.character_id).first()

    now = datetime.now(UTC)

    if action == "hide" and character:
        character.is_public = False
    elif action == "delete" and character:
        db.delete(character)

    # Log the action if it affects the content
    if action in {"hide", "delete"} and character:
        _log_content_moderation(
            db,
            creator_id=character.creator_id,
            entity_type="character",
            entity_id=item.character_id,
            entity_name=item.character_name,
            action=action,
            admin=current_admin,
            notes=payload.notes,
            source="content_review",
        )

    item.status = f"resolved_{action}"
    item.resolved_time = now
    item.resolved_by = current_admin.id
    item.resolution_notes = payload.notes
    item.updated_time = now

    db.commit()
    db.refresh(item)

    return {
        "message": f"Review queue item resolved with action: {action}",
        "item": {
            "id": item.id,
            "status": item.status,
            "resolved_time": item.resolved_time,
            "resolution_notes": item.resolution_notes,
        }
    }


@router.get("/moderation/reports")
def get_moderation_reports(
    status: str = "pending",
    db: Session = Depends(get_db),
    current_admin: User = Depends(get_current_admin_user)
):
    """Get entity reports (character/scene/persona/user) for moderation - Admin only"""
    query = db.query(ProblemReport).filter(ProblemReport.target_type.isnot(None))
    if status and status != "all":
        query = query.filter(ProblemReport.status == status)

    reports = query.order_by(desc(ProblemReport.created_time)).all()
    result = []

    def _violation_snapshot(user_id: str) -> dict:
        """Return lightweight violation counts + last action for a given user."""
        acct_count = db.query(func.count(UserModerationLog.id)).filter(
            UserModerationLog.user_id == user_id,
            UserModerationLog.action.in_(["warn", "upload_ban", "full_ban", "shadow_ban"]),
        ).scalar() or 0
        content_count = db.query(func.count(ContentModerationLog.id)).filter(
            ContentModerationLog.creator_id == user_id,
            ContentModerationLog.action.in_(["restrict", "takedown", "delete", "hide"]),
        ).scalar() or 0
        last_log = (
            db.query(UserModerationLog)
            .filter(UserModerationLog.user_id == user_id)
            .order_by(desc(UserModerationLog.created_at))
            .first()
        )
        return {
            "account_action_count": acct_count,
            "content_action_count": content_count,
            "last_action": last_log.action if last_log else None,
            "last_action_at": last_log.created_at.isoformat() if last_log else None,
        }

    for report in reports:
        reporter = None
        if report.user_id:
            reporter = db.query(User).filter(User.id == report.user_id).first()

        target_info = {}
        if report.target_type == "user":
            target_user = None
            if report.target_string_id:
                target_user = db.query(User).filter(User.id == report.target_string_id).first()
            if target_user:
                target_info = {
                    "exists": True,
                    "name": target_user.name,
                    "email": target_user.email,
                    "ban_type": target_user.ban_type,
                    "ban_until": target_user.ban_until.isoformat() if target_user.ban_until else None,
                    "ban_reason": target_user.ban_reason,
                    "ban_note": target_user.ban_note,
                    "violation_snapshot": _violation_snapshot(target_user.id),
                }
            else:
                target_info = {"exists": False, "name": report.target_name}
        elif report.target_type == "character" and report.target_id:
            character = db.query(Character).filter(Character.id == report.target_id).first()
            if character:
                target_info = {
                    "exists": True,
                    "name": character.name,
                    "is_public": character.is_public,
                    "creator_name": character.creator_name,
                    "creator_id": character.creator_id,
                    "moderation_status": character.moderation_status,
                    "violation_snapshot": _violation_snapshot(character.creator_id) if character.creator_id else None,
                }
            else:
                target_info = {"exists": False, "name": report.target_name}
        elif report.target_type in ("scene", "persona") and report.target_id:
            model_cls = Scene if report.target_type == "scene" else Persona
            entity = db.query(model_cls).filter(model_cls.id == report.target_id).first()
            if entity:
                target_info = {
                    "exists": True,
                    "name": entity.name,
                    "is_public": entity.is_public,
                    "creator_name": entity.creator_name,
                    "creator_id": entity.creator_id,
                    "moderation_status": entity.moderation_status,
                    "violation_snapshot": _violation_snapshot(entity.creator_id) if entity.creator_id else None,
                }
            else:
                target_info = {"exists": False, "name": report.target_name}

        resolver = None
        if report.resolved_by:
            resolver = db.query(User).filter(User.id == report.resolved_by).first()

        result.append({
            "id": report.id,
            "reporter_id": report.user_id,
            "reporter_name": reporter.name if reporter else None,
            "reporter_email": report.user_email,
            "target_type": report.target_type,
            "target_id": report.target_id,
            "target_string_id": report.target_string_id,
            "target_name": report.target_name,
            "target_info": target_info,
            "reason": report.reason,
            "description": report.description,
            "status": report.status,
            "action_taken": report.action_taken,
            "created_time": report.created_time,
            "resolved_time": report.resolved_time,
            "resolved_by_name": resolver.name if resolver else None,
            "admin_notes": report.admin_notes,
        })

    return result


@router.post("/moderation/reports/{report_id}/action")
def take_moderation_action(
    report_id: int,
    payload: UserModerationActionRequest,
    db: Session = Depends(get_db),
    current_admin: User = Depends(get_current_admin_user)
):
    """Take a moderation action on an entity report - Admin only"""
    report = db.query(ProblemReport).filter(ProblemReport.id == report_id).first()
    if not report:
        raise HTTPException(status_code=404, detail="Report not found")

    if report.target_type is None:
        raise HTTPException(status_code=400, detail="This report is a bug report, not an entity report")

    action = (payload.action or "").strip().lower()
    now = datetime.now(UTC)

    if report.target_type == "user":
        valid_actions = {"warn", "upload_ban", "full_ban", "shadow_ban", "unban", "ignore"}
        if action not in valid_actions:
            raise HTTPException(status_code=400, detail=f"Invalid action for user report. Expected one of: {', '.join(sorted(valid_actions))}")

        target_user = None
        if report.target_string_id:
            target_user = db.query(User).filter(User.id == report.target_string_id).first()

        if action in {"upload_ban", "full_ban", "shadow_ban"}:
            if target_user:
                target_user.ban_type = action
                target_user.ban_until = payload.ban_until
                target_user.ban_reason = payload.ban_reason
                target_user.ban_note = payload.ban_note
        elif action == "unban":
            if target_user:
                target_user.ban_type = None
                target_user.ban_until = None
                target_user.ban_reason = None
                target_user.ban_note = None
        # warn/ignore: no user model changes — report is resolved with notes only

        # Log this user moderation action
        if report.target_string_id and action != "ignore":
            _log_user_moderation(
                db,
                user_id=report.target_string_id,
                action=action,
                admin=current_admin,
                ban_reason=payload.ban_reason,
                ban_note=payload.ban_note,
                ban_until=payload.ban_until,
                notes=payload.notes,
                source="report",
                source_report_id=report_id,
            )

    else:
        valid_actions = {"keep", "restrict", "takedown", "delete", "unban", "ignore"}
        if action not in valid_actions:
            raise HTTPException(status_code=400, detail=f"Invalid action for content report. Expected one of: {', '.join(sorted(valid_actions))}")

        model_map = {
            "character": Character,
            "scene": Scene,
            "persona": Persona,
        }

        if report.target_type in model_map and report.target_id:
            model_cls = model_map[report.target_type]
            entity = db.query(model_cls).filter(model_cls.id == report.target_id).first()
            if entity:
                if action == "restrict":
                    entity.moderation_status = "restricted"
                    entity.is_public = False
                elif action == "takedown":
                    entity.moderation_status = "takedown"
                    entity.is_public = False
                elif action == "unban":
                    entity.moderation_status = None
                    entity.is_public = True  # restore visibility after ban is lifted
                elif action == "delete":
                    creator_id = entity.creator_id
                    entity_name = entity.name
                    db.delete(entity)
                    db.flush()
                    if creator_id:
                        create_content_moderation_message(
                            db=db,
                            user_id=creator_id,
                            action="delete",
                            entity_type=report.target_type,
                            entity_name=entity_name,
                            entity_id=report.target_id,
                            notes=payload.notes,
                            admin_id=current_admin.id,
                        )
                        _log_content_moderation(
                            db,
                            creator_id=creator_id,
                            entity_type=report.target_type,
                            entity_id=report.target_id,
                            entity_name=entity_name,
                            action="delete",
                            admin=current_admin,
                            notes=payload.notes,
                            source="report",
                            source_report_id=report_id,
                        )
                    report.status = "resolved"
                    report.action_taken = action
                    report.resolved_time = now
                    report.resolved_by = current_admin.id
                    report.admin_notes = payload.notes
                    db.commit()
                    return {"message": f"Action '{action}' applied to report #{report_id}"}

                # Send message for restrict / takedown / unban
                if action in {"restrict", "takedown"} and entity.creator_id:
                    create_content_moderation_message(
                        db=db,
                        user_id=entity.creator_id,
                        action=action,
                        entity_type=report.target_type,
                        entity_name=entity.name,
                        entity_id=report.target_id,
                        notes=payload.notes,
                        admin_id=current_admin.id,
                    )

                # Log the content moderation action
                if action != "keep" and action != "ignore" and entity.creator_id:
                    _log_content_moderation(
                        db,
                        creator_id=entity.creator_id,
                        entity_type=report.target_type,
                        entity_id=report.target_id,
                        entity_name=entity.name,
                        action=action,
                        admin=current_admin,
                        notes=payload.notes,
                        source="report",
                        source_report_id=report_id,
                    )

    report.status = "resolved"
    report.action_taken = action
    report.resolved_time = now
    report.resolved_by = current_admin.id
    report.admin_notes = payload.notes

    # Send an inbox message to the affected user for user-targeted moderation actions
    if report.target_type == "user" and report.target_string_id:
        create_moderation_message(
            db=db,
            user_id=report.target_string_id,
            action=action,
            notes=payload.notes,
            admin_id=current_admin.id,
            ban_until=payload.ban_until,
            ban_reason=payload.ban_reason,
        )

    db.commit()

    return {"message": f"Action '{action}' applied to report #{report_id}"}


@router.post("/moderation/batch-action")
def take_batch_moderation_action(
    payload: BatchModerationActionRequest,
    db: Session = Depends(get_db),
    current_admin: User = Depends(get_current_admin_user)
):
    """Apply a moderation action to multiple pending entity reports - Admin only"""
    reports = db.query(ProblemReport).filter(
        ProblemReport.id.in_(payload.report_ids),
        ProblemReport.target_type.isnot(None),
        ProblemReport.status == "pending",
    ).all()

    if not reports:
        raise HTTPException(status_code=404, detail="No matching pending reports found")

    action = (payload.action or "").strip().lower()
    now = datetime.now(UTC)
    model_map = {"character": Character, "scene": Scene, "persona": Persona}
    applied = 0

    for report in reports:
        if report.target_type == "user":
            if action not in {"warn", "upload_ban", "full_ban", "shadow_ban", "unban", "ignore"}:
                continue
            target_user = None
            if report.target_string_id:
                target_user = db.query(User).filter(User.id == report.target_string_id).first()
            if action in {"upload_ban", "full_ban", "shadow_ban"} and target_user:
                target_user.ban_type = action
                target_user.ban_until = payload.ban_until
                target_user.ban_reason = payload.ban_reason
                target_user.ban_note = payload.ban_note
            elif action == "unban" and target_user:
                target_user.ban_type = None
                target_user.ban_until = None
                target_user.ban_reason = None
                target_user.ban_note = None
            if report.target_string_id and action != "ignore":
                _log_user_moderation(
                    db,
                    user_id=report.target_string_id,
                    action=action,
                    admin=current_admin,
                    ban_reason=payload.ban_reason,
                    ban_note=payload.ban_note,
                    ban_until=payload.ban_until,
                    notes=payload.notes,
                    source="report",
                    source_report_id=report.id,
                )
        else:
            if action not in {"keep", "restrict", "takedown", "delete", "unban", "ignore"}:
                continue
            if report.target_type in model_map and report.target_id:
                model_cls = model_map[report.target_type]
                entity = db.query(model_cls).filter(model_cls.id == report.target_id).first()
                if entity:
                    if action == "restrict":
                        entity.moderation_status = "restricted"
                        entity.is_public = False
                    elif action == "takedown":
                        entity.moderation_status = "takedown"
                        entity.is_public = False
                    elif action == "unban":
                        entity.moderation_status = None
                        entity.is_public = True  # restore visibility after ban is lifted
                    elif action == "delete":
                        _creator_id = entity.creator_id
                        _entity_name = entity.name
                        db.delete(entity)
                        if _creator_id:
                            create_content_moderation_message(
                                db=db,
                                user_id=_creator_id,
                                action="delete",
                                entity_type=report.target_type,
                                entity_name=_entity_name,
                                entity_id=report.target_id,
                                notes=payload.notes,
                                admin_id=current_admin.id,
                            )
                    if action in {"restrict", "takedown"} and entity.creator_id:
                        create_content_moderation_message(
                            db=db,
                            user_id=entity.creator_id,
                            action=action,
                            entity_type=report.target_type,
                            entity_name=entity.name,
                            entity_id=report.target_id,
                            notes=payload.notes,
                            admin_id=current_admin.id,
                        )
                    # Log content action
                    if action not in {"keep", "ignore"}:
                        _creator_id_for_log = entity.creator_id if action != "delete" else _creator_id
                        _name_for_log = entity.name if action != "delete" else _entity_name
                        if _creator_id_for_log:
                            _log_content_moderation(
                                db,
                                creator_id=_creator_id_for_log,
                                entity_type=report.target_type,
                                entity_id=report.target_id,
                                entity_name=_name_for_log,
                                action=action,
                                admin=current_admin,
                                notes=payload.notes,
                                source="report",
                                source_report_id=report.id,
                            )

        report.status = "resolved"
        report.action_taken = action
        report.resolved_time = now
        report.resolved_by = current_admin.id
        report.admin_notes = payload.notes
        applied += 1

    db.commit()
    return {"message": f"Action '{action}' applied to {applied} reports", "count": applied}


@router.get("/tags")
def get_all_tags(
    db: Session = Depends(get_db),
    current_admin: User = Depends(get_current_admin_user)
):
    """Get all tags with usage statistics - Admin only"""
    tags = db.query(Tag).order_by(desc(Tag.count)).all()
    return [
        {
            "id": tag.id,
            "name": tag.name,
            "count": tag.count,
            "likes": tag.likes
        }
        for tag in tags
    ]


@router.get("/search-terms")
def get_search_terms(
    db: Session = Depends(get_db),
    current_admin: User = Depends(get_current_admin_user)
):
    """Get all search terms with statistics - Admin only"""
    terms = db.query(SearchTerm).order_by(desc(SearchTerm.search_count)).all()
    return [
        {
            "keyword": term.keyword,
            "search_count": term.search_count,
            "last_searched": term.last_searched
        }
        for term in terms
    ]


@router.post("/users", status_code=201)
def admin_create_user(
    payload: AdminCreateUserRequest,
    db: Session = Depends(get_db),
    current_admin: User = Depends(get_current_admin_user),
):
    """Create a user account directly — Admin only. Bypasses phone verification, captcha, and invitation codes."""
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


@router.delete("/characters/{character_id}")
def delete_character(
    character_id: int,
    db: Session = Depends(get_db),
    current_admin: User = Depends(get_current_admin_user)
):
    """Delete a character - Admin only"""
    character = db.query(Character).filter(Character.id == character_id).first()
    if not character:
        raise HTTPException(status_code=404, detail="Character not found")
    
    picture_path = character.picture
    avatar_path = character.avatar_picture
    db.delete(character)
    db.commit()
    delete_stored_image(picture_path)
    delete_stored_image(avatar_path)
    return {"message": "角色已删除"}


@router.delete("/scenes/{scene_id}")
def delete_scene(
    scene_id: int,
    db: Session = Depends(get_db),
    current_admin: User = Depends(get_current_admin_user)
):
    """Delete a scene - Admin only"""
    scene = db.query(Scene).filter(Scene.id == scene_id).first()
    if not scene:
        raise HTTPException(status_code=404, detail="Scene not found")
    picture_path = scene.picture
    db.delete(scene)
    db.commit()
    delete_stored_image(picture_path)
    return {"message": "Scene deleted successfully"}


@router.delete("/personas/{persona_id}")
def delete_persona(
    persona_id: int,
    db: Session = Depends(get_db),
    current_admin: User = Depends(get_current_admin_user)
):
    """Delete a persona - Admin only"""
    persona = db.query(Persona).filter(Persona.id == persona_id).first()
    if not persona:
        raise HTTPException(status_code=404, detail="Persona not found")
    picture_path = persona.picture
    avatar_path = persona.avatar_picture
    db.delete(persona)
    db.commit()
    delete_stored_image(picture_path)
    delete_stored_image(avatar_path)
    return {"message": "Persona deleted successfully"}


@router.post("/content/{content_type}/{item_id}/moderate")
def moderate_content_item(
    content_type: str,
    item_id: int,
    payload: ContentModerationRequest,
    db: Session = Depends(get_db),
    current_admin: User = Depends(get_current_admin_user)
):
    """Apply a direct moderation action to a character, scene, or persona - Admin only"""
    model_map = {"character": Character, "scene": Scene, "persona": Persona}
    if content_type not in model_map:
        raise HTTPException(status_code=400, detail="Invalid content type. Expected character, scene, or persona")

    valid_actions = {"restrict", "takedown", "unban", "delete"}
    action = (payload.action or "").strip().lower()
    if action not in valid_actions:
        raise HTTPException(status_code=400, detail=f"Invalid action. Expected one of: {', '.join(sorted(valid_actions))}")

    model_cls = model_map[content_type]
    entity = db.query(model_cls).filter(model_cls.id == item_id).first()
    if not entity:
        raise HTTPException(status_code=404, detail=f"{content_type.capitalize()} not found")

    if action == "restrict":
        entity.moderation_status = "restricted"
        entity.is_public = False
    elif action == "takedown":
        entity.moderation_status = "takedown"
        entity.is_public = False
    elif action == "unban":
        entity.moderation_status = None
        entity.is_public = True
    elif action == "delete":
        picture_path = getattr(entity, 'picture', None)
        avatar_path = getattr(entity, 'avatar_picture', None)
        creator_id = entity.creator_id
        entity_name = entity.name
        db.delete(entity)
        db.flush()
        if creator_id:
            create_content_moderation_message(
                db=db,
                user_id=creator_id,
                action="delete",
                entity_type=content_type,
                entity_name=entity_name,
                entity_id=item_id,
                notes=payload.notes,
                admin_id=current_admin.id,
            )
        db.commit()
        # Clean up stored images after the DB commit
        delete_stored_image(picture_path)
        delete_stored_image(avatar_path)
        return {"message": f"{content_type.capitalize()} deleted successfully"}

    if action in {"restrict", "takedown"} and entity.creator_id:
        create_content_moderation_message(
            db=db,
            user_id=entity.creator_id,
            action=action,
            entity_type=content_type,
            entity_name=entity.name,
            entity_id=item_id,
            notes=payload.notes,
            admin_id=current_admin.id,
        )

    db.commit()
    return {"message": f"Action '{action}' applied to {content_type} #{item_id}"}


@router.delete("/tags/{tag_id}")
def delete_tag(
    tag_id: int,
    db: Session = Depends(get_db),
    current_admin: User = Depends(get_current_admin_user)
):
    """Delete a tag - Admin only"""
    tag = db.query(Tag).filter(Tag.id == tag_id).first()
    if not tag:
        raise HTTPException(status_code=404, detail="Tag not found")
    
    db.delete(tag)
    db.commit()
    return {"message": "Tag deleted successfully"}


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


class DirectModerationRequest(BaseModel):
    action: str               # warn | upload_ban | full_ban | shadow_ban | unban
    notes: Optional[str] = None
    ban_until: Optional[datetime] = None
    ban_reason: Optional[str] = None
    ban_note: Optional[str] = None


@router.post("/users/{user_id}/moderate")
def moderate_user_directly(
    user_id: str,
    payload: DirectModerationRequest,
    db: Session = Depends(get_db),
    current_admin: User = Depends(get_current_admin_user),
):
    """Apply a moderation action directly to a user (no report required) — Admin only."""
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
    """Return the full violation/punishment history for a user — Admin only."""
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


@router.patch("/characters/{character_id}")
def update_character(
    character_id: int,
    update_data: CharacterUpdate,
    db: Session = Depends(get_db),
    current_admin: User = Depends(get_current_admin_user)
):
    """Update character details - Admin only"""
    character = db.query(Character).filter(Character.id == character_id).first()
    if not character:
        raise HTTPException(status_code=404, detail="Character not found")
    
    # Update only provided fields
    if update_data.name is not None:
        # Check if name already exists (for another character)
        existing = db.query(Character).filter(
            Character.name == update_data.name,
            Character.id != character_id
        ).first()
        if existing:
            raise HTTPException(status_code=400, detail="Character name already exists")
        character.name = update_data.name
    
    if update_data.persona is not None:
        character.persona = update_data.persona
    if update_data.tagline is not None:
        character.tagline = update_data.tagline
    if update_data.greeting is not None:
        character.greeting = update_data.greeting
    if update_data.example_messages is not None:
        character.example_messages = update_data.example_messages
    if update_data.tags is not None:
        character.tags = update_data.tags
    if update_data.is_public is not None:
        character.is_public = update_data.is_public
    if update_data.is_forkable is not None:
        character.is_forkable = update_data.is_forkable
    
    db.commit()
    db.refresh(character)
    
    return {
        "message": "Character updated successfully",
        "character": {
            "id": character.id,
            "name": character.name,
            "tagline": character.tagline,
            "persona": character.persona,
            "greeting": character.greeting,
            "tags": character.tags,
            "is_public": character.is_public,
            "is_forkable": character.is_forkable,
        }
    }


@router.patch("/scenes/{scene_id}")
def update_scene(
    scene_id: int,
    update_data: SceneUpdate,
    db: Session = Depends(get_db),
    current_admin: User = Depends(get_current_admin_user)
):
    """Update scene details - Admin only"""
    scene = db.query(Scene).filter(Scene.id == scene_id).first()
    if not scene:
        raise HTTPException(status_code=404, detail="Scene not found")

    if update_data.name is not None:
        scene.name = update_data.name
    if update_data.description is not None:
        scene.description = update_data.description
    if update_data.intro is not None:
        scene.intro = update_data.intro
    if update_data.greeting is not None:
        scene.greeting = update_data.greeting
    if update_data.tags is not None:
        scene.tags = update_data.tags
    if update_data.is_public is not None:
        scene.is_public = update_data.is_public
    if update_data.is_forkable is not None:
        scene.is_forkable = update_data.is_forkable

    db.commit()
    db.refresh(scene)
    return {
        "message": "Scene updated successfully",
        "scene": {
            "id": scene.id,
            "name": scene.name,
            "intro": scene.intro,
            "tags": scene.tags,
            "is_public": scene.is_public,
            "is_forkable": scene.is_forkable,
        }
    }


@router.patch("/personas/{persona_id}")
def update_persona(
    persona_id: int,
    update_data: PersonaUpdate,
    db: Session = Depends(get_db),
    current_admin: User = Depends(get_current_admin_user)
):
    """Update persona details - Admin only"""
    persona = db.query(Persona).filter(Persona.id == persona_id).first()
    if not persona:
        raise HTTPException(status_code=404, detail="Persona not found")

    if update_data.name is not None:
        persona.name = update_data.name
    if update_data.description is not None:
        persona.description = update_data.description
    if update_data.intro is not None:
        persona.intro = update_data.intro
    if update_data.tags is not None:
        persona.tags = update_data.tags
    if update_data.is_public is not None:
        persona.is_public = update_data.is_public
    if update_data.is_forkable is not None:
        persona.is_forkable = update_data.is_forkable

    db.commit()
    db.refresh(persona)
    return {
        "message": "Persona updated successfully",
        "persona": {
            "id": persona.id,
            "name": persona.name,
            "intro": persona.intro,
            "tags": persona.tags,
            "is_public": persona.is_public,
            "is_forkable": persona.is_forkable,
        }
    }


@router.patch("/tags/{tag_id}")
def update_tag(
    tag_id: int,
    update_data: TagUpdate,
    db: Session = Depends(get_db),
    current_admin: User = Depends(get_current_admin_user)
):
    """Update tag - Admin only"""
    tag = db.query(Tag).filter(Tag.id == tag_id).first()
    if not tag:
        raise HTTPException(status_code=404, detail="Tag not found")
    
    if update_data.name is not None:
        # Check if name already exists
        existing = db.query(Tag).filter(
            Tag.name == update_data.name,
            Tag.id != tag_id
        ).first()
        if existing:
            raise HTTPException(status_code=400, detail="Tag name already exists")
        tag.name = update_data.name
    
    db.commit()
    db.refresh(tag)
    
    return {
        "message": "Tag updated successfully",
        "tag": {
            "id": tag.id,
            "name": tag.name,
            "count": tag.count,
            "likes": tag.likes
        }
    }


@router.post("/tags")
def create_tag(
    update_data: TagUpdate,
    db: Session = Depends(get_db),
    current_admin: User = Depends(get_current_admin_user)
):
    """Create a new tag - Admin only"""
    if not update_data.name:
        raise HTTPException(status_code=400, detail="Tag name is required")
    
    # Check if tag already exists
    existing = db.query(Tag).filter(Tag.name == update_data.name).first()
    if existing:
        raise HTTPException(status_code=400, detail="Tag already exists")
    
    new_tag = Tag(name=update_data.name, count=0, likes=0)
    db.add(new_tag)
    db.commit()
    db.refresh(new_tag)
    
    return {
        "message": "Tag created successfully",
        "tag": {
            "id": new_tag.id,
            "name": new_tag.name,
            "count": new_tag.count,
            "likes": new_tag.likes
        }
    }


@router.delete("/search-terms/{keyword}")
def delete_search_term(
    keyword: str,
    db: Session = Depends(get_db),
    current_admin: User = Depends(get_current_admin_user)
):
    """Delete a search term - Admin only"""
    term = db.query(SearchTerm).filter(SearchTerm.keyword == keyword).first()
    if not term:
        raise HTTPException(status_code=404, detail="Search term not found")
    
    db.delete(term)
    db.commit()
    return {"message": "Search term deleted successfully"}


@router.get("/security/rate-limit/{ip}")
def get_ip_rate_limit_status(
    ip: str,
    current_admin: User = Depends(get_current_admin_user)
):
    """Get rate limit status for a specific IP - Admin only"""
    status = get_rate_limit_status(ip)
    return status


@router.get("/security/rate-limit")
def get_current_rate_limit_status(
    request: Request,
    current_admin: User = Depends(get_current_admin_user)
):
    """Get rate limit status for the current IP - Admin only"""
    # Extract IP from request
    forwarded_for = request.headers.get("X-Forwarded-For")
    if forwarded_for:
        ip = forwarded_for.split(",")[0].strip()
    else:
        ip = request.headers.get("X-Real-IP") or request.client.host
    
    status = get_rate_limit_status(ip)
    return status


@router.get("/token-topup-packages")
def get_token_topup_packages_admin(
    db: Session = Depends(get_db),
    current_admin: User = Depends(get_current_admin_user),
):
    packages = get_token_topup_packages(db)
    return {
        "packages": packages,
    }


@router.put("/token-topup-packages")
def update_token_topup_packages_admin(
    payload: TokenTopupPackagesUpdateRequest,
    db: Session = Depends(get_db),
    current_admin: User = Depends(get_current_admin_user),
):
    if not payload.packages:
        raise HTTPException(status_code=400, detail="At least one package is required")

    raw_packages = [
        {
            "id": item.id,
            "tokens": item.tokens,
            "price_cny": item.price_cny,
            "label": item.label,
        }
        for item in payload.packages
    ]

    try:
        packages = set_token_topup_packages(
            db,
            packages=raw_packages,
            updated_by=current_admin.id,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    return {
        "message": "Token top-up packages updated successfully",
        "packages": packages,
    }


# --- System Settings Admin API ---
class SystemSettingOut(BaseModel):
    key: str
    value: str
    updated_at: Optional[datetime] = None
    updated_by: Optional[str] = None

class SystemSettingUpdateRequest(BaseModel):
    value: str

@router.get("/system-settings", response_model=List[SystemSettingOut])
def list_system_settings(
    db: Session = Depends(get_db),
    current_admin: User = Depends(get_current_admin_user),
    key: Optional[str] = None
):
    """List all system settings or filter by key."""
    query = db.query(SystemSettings)
    if key:
        query = query.filter(SystemSettings.key == key)
    settings = query.all()
    return [SystemSettingOut(
        key=s.key,
        value=s.value,
        updated_at=s.updated_at,
        updated_by=s.updated_by
    ) for s in settings]

@router.put("/system-settings/{key}", response_model=SystemSettingOut)
def update_system_setting(
    key: str,
    req: SystemSettingUpdateRequest,
    db: Session = Depends(get_db),
    current_admin: User = Depends(get_current_admin_user)
):
    """Update a system setting by key."""
    setting = db.query(SystemSettings).filter(SystemSettings.key == key).first()
    if not setting:
        setting = SystemSettings(key=key, value=req.value, updated_by=current_admin.id)
        db.add(setting)
    else:
        setting.value = req.value
        setting.updated_by = current_admin.id
    setting.updated_at = datetime.now(UTC)
    db.commit()
    db.refresh(setting)
    return SystemSettingOut(
        key=setting.key,
        value=setting.value,
        updated_at=setting.updated_at,
        updated_by=setting.updated_by
    )
# --- End System Settings Admin API ---


# ──────────────────────────────────────────────
# Appeal Queue Admin API
# ──────────────────────────────────────────────

class AppealActionRequest(BaseModel):
    action: str           # "approve" | "reject"
    reply: str            # required reply message sent to user


@router.get("/moderation/appeals")
def get_appeals(
    status: str = "pending",
    db: Session = Depends(get_db),
    current_admin: User = Depends(get_current_admin_user),
):
    """List ban appeals. status=pending|approved|rejected|all — Admin only."""
    query = db.query(BanAppeal)
    if status and status != "all":
        query = query.filter(BanAppeal.status == status)

    appeals = query.order_by(desc(BanAppeal.created_at)).all()
    result = []
    for appeal in appeals:
        appellant = db.query(User).filter(User.id == appeal.user_id).first()
        resolver = None
        if appeal.resolved_by:
            resolver = db.query(User).filter(User.id == appeal.resolved_by).first()
        result.append({
            "id": appeal.id,
            "user_id": appeal.user_id,
            "user_name": appellant.name if appellant else None,
            "user_email": appellant.email if appellant else None,
            "ban_type": appeal.ban_type,
            "ban_reason": appellant.ban_reason if appellant else None,
            "ban_note": appellant.ban_note if appellant else None,
            "ban_until": appellant.ban_until.isoformat() if appellant and appellant.ban_until else None,
            "current_ban_type": appellant.ban_type if appellant else None,
            "reason": appeal.reason,
            "status": appeal.status,
            "admin_reply": appeal.admin_reply,
            "created_at": appeal.created_at.isoformat(),
            "resolved_at": appeal.resolved_at.isoformat() if appeal.resolved_at else None,
            "resolved_by_name": resolver.name if resolver else None,
        })
    return result


@router.post("/moderation/appeals/{appeal_id}/action")
def resolve_appeal(
    appeal_id: int,
    payload: AppealActionRequest,
    db: Session = Depends(get_db),
    current_admin: User = Depends(get_current_admin_user),
):
    """Approve or reject a ban appeal with a required reply message — Admin only."""
    appeal = db.query(BanAppeal).filter(BanAppeal.id == appeal_id).first()
    if not appeal:
        raise HTTPException(status_code=404, detail="Appeal not found")
    if appeal.status != "pending":
        raise HTTPException(status_code=400, detail="Appeal has already been resolved")

    action = (payload.action or "").strip().lower()
    if action not in {"approve", "reject"}:
        raise HTTPException(status_code=400, detail="action must be 'approve' or 'reject'")

    reply = (payload.reply or "").strip()
    if not reply:
        raise HTTPException(status_code=422, detail="A reply message is required")

    now = datetime.now(UTC)
    appeal.status = "approved" if action == "approve" else "rejected"
    appeal.admin_reply = reply
    appeal.resolved_at = now
    appeal.resolved_by = current_admin.id

    if action == "approve":
        user = db.query(User).filter(User.id == appeal.user_id).first()
        if user:
            user.ban_type = None
            user.ban_until = None
            user.ban_reason = None
            user.ban_note = None

    # Send inbox message to the user
    from routes.user_messages import _send_appeal_result_message
    _send_appeal_result_message(
        db=db,
        user_id=appeal.user_id,
        action=action,
        reply=reply,
        admin_id=current_admin.id,
    )

    db.commit()
    return {"message": f"Appeal #{appeal_id} {appeal.status}", "ok": True}


# ──────────────────────────────────────────────
# Content Appeal Queue Admin API
# ──────────────────────────────────────────────

def _get_entity_for_appeal(entity_type: str, entity_id: int, db: Session):
    if entity_type == "character":
        return db.query(Character).filter(Character.id == entity_id).first()
    if entity_type == "scene":
        return db.query(Scene).filter(Scene.id == entity_id).first()
    if entity_type == "persona":
        return db.query(Persona).filter(Persona.id == entity_id).first()
    return None


@router.get("/moderation/content-appeals")
def get_content_appeals(
    status: str = "pending",
    db: Session = Depends(get_db),
    current_admin: User = Depends(get_current_admin_user),
):
    """List content ban appeals. status=pending|approved|rejected|all — Admin only."""
    query = db.query(ContentBanAppeal)
    if status and status != "all":
        query = query.filter(ContentBanAppeal.status == status)

    appeals = query.order_by(desc(ContentBanAppeal.created_at)).all()
    result = []
    for appeal in appeals:
        creator = db.query(User).filter(User.id == appeal.creator_id).first()
        resolver = None
        if appeal.resolved_by:
            resolver = db.query(User).filter(User.id == appeal.resolved_by).first()
        entity = _get_entity_for_appeal(appeal.entity_type, appeal.entity_id, db)
        result.append({
            "id": appeal.id,
            "entity_type": appeal.entity_type,
            "entity_id": appeal.entity_id,
            "entity_name": entity.name if entity else None,
            "entity_moderation_status": entity.moderation_status if entity else None,
            "creator_id": appeal.creator_id,
            "creator_name": creator.name if creator else None,
            "creator_email": creator.email if creator else None,
            "appeal_reason": appeal.appeal_reason,
            "status": appeal.status,
            "snapshot": appeal.snapshot,
            "admin_reply": appeal.admin_reply,
            "created_at": appeal.created_at.isoformat(),
            "resolved_at": appeal.resolved_at.isoformat() if appeal.resolved_at else None,
            "resolved_by_name": resolver.name if resolver else None,
        })
    return result


@router.post("/moderation/content-appeals/{appeal_id}/action")
def resolve_content_appeal(
    appeal_id: int,
    payload: AppealActionRequest,
    db: Session = Depends(get_db),
    current_admin: User = Depends(get_current_admin_user),
):
    """Approve or reject a content ban appeal with a required reply message — Admin only."""
    appeal = db.query(ContentBanAppeal).filter(ContentBanAppeal.id == appeal_id).first()
    if not appeal:
        raise HTTPException(status_code=404, detail="Content appeal not found")
    if appeal.status != "pending":
        raise HTTPException(status_code=400, detail="Appeal has already been resolved")

    action = (payload.action or "").strip().lower()
    if action not in {"approve", "reject"}:
        raise HTTPException(status_code=400, detail="action must be 'approve' or 'reject'")

    reply = (payload.reply or "").strip()
    if not reply:
        raise HTTPException(status_code=422, detail="A reply message is required")

    now = datetime.now(UTC)
    appeal.status = "approved" if action == "approve" else "rejected"
    appeal.admin_reply = reply
    appeal.resolved_at = now
    appeal.resolved_by = current_admin.id

    entity = _get_entity_for_appeal(appeal.entity_type, appeal.entity_id, db)
    entity_name = entity.name if entity else f"{appeal.entity_type} #{appeal.entity_id}"

    if entity:
        entity.appeal_under_review = False

    if action == "approve" and entity:
        entity.moderation_status = None
        entity.is_public = True  # snapshot is taken after ban so is_public=False there; always restore on approval

    from routes.user_messages import _send_content_appeal_result_message
    _send_content_appeal_result_message(
        db=db,
        user_id=appeal.creator_id,
        action=action,
        reply=reply,
        entity_type=appeal.entity_type,
        entity_name=entity_name,
        entity_id=appeal.entity_id,
        admin_id=current_admin.id,
    )

    db.commit()
    return {"message": f"Content appeal #{appeal_id} {appeal.status}", "ok": True}
