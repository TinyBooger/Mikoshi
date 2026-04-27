from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session
from sqlalchemy import func, desc, or_, and_
from datetime import datetime, timedelta, UTC
from database import get_db
from models import User, Character, Tag, SearchTerm, ChatHistory, UserTokenUsageLedger, ContentReviewQueue, ProblemReport, SystemSettings
from utils.session import get_current_admin_user
from utils.security_middleware import get_rate_limit_status
from utils.user_utils import enrich_user_with_character_count, build_user_response
from typing import List, Optional, Dict
from pydantic import BaseModel
from schemas import UserOut, UserMessageOut
from utils.audit_logger import AuditLog
from utils.chat_history_utils import count_chat_history_messages
from utils.token_wallet import get_token_topup_packages, set_token_topup_packages

router = APIRouter(prefix="/api/admin", tags=["admin"])


# Pydantic models for request bodies
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
    all_chat_payloads = db.query(ChatHistory.messages).all()
    if all_chat_payloads:
        total_message_count = sum(count_chat_history_messages(messages) for (messages,) in all_chat_payloads)
        avg_chat_length = total_message_count / len(all_chat_payloads)

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


@router.get("/users", response_model=List[UserOut])
def get_all_users(
    db: Session = Depends(get_db),
    current_admin: User = Depends(get_current_admin_user)
):
    """Get all users - Admin only"""
    users = db.query(User).all()
    return [enrich_user_with_character_count(user, db) for user in users]


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
    
    db.delete(character)
    db.commit()
    return {"message": "Character deleted successfully"}


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
        user.pro_expire_date = now + timedelta(days=30)
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