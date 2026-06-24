from __future__ import annotations

from typing import Any, Optional
from datetime import datetime, UTC, timedelta

from sqlalchemy.orm import Session
from sqlalchemy import func

from models import Persona, User, Character, Scene, UserLikedCharacter, UserLikedScene, UserLikedPersona
from schemas import PersonaOut
from utils.chat_history_utils import fetch_user_chat_history
from utils.credit_cap import get_credit_cap_info


# ── Ban helpers ────────────────────────────────────────────────────────────────

def get_active_ban_type(user: User) -> Optional[str]:
    """Return the active ban_type ('upload_ban' | 'full_ban' | 'shadow_ban') or None.

    A timed ban is considered expired when ban_until has passed.
    """
    ban_type = getattr(user, "ban_type", None)
    if not ban_type:
        return None
    ban_until = getattr(user, "ban_until", None)
    if ban_until and datetime.now(UTC) > ban_until:
        return None
    return ban_type


def is_upload_banned(user: User) -> bool:
    """True for upload_ban and full_ban (all non-shadow upload restrictions)."""
    return get_active_ban_type(user) in ("upload_ban", "full_ban")


def is_chat_banned(user: User) -> bool:
    """True only for full_ban."""
    return get_active_ban_type(user) == "full_ban"


def get_pro_state(user: User) -> dict[str, Any]:
    """Single source of truth for Pro subscription state.

    Pro activity is derived only from expiration date and current UTC time.
    """
    now = datetime.now(UTC)
    expire_date = getattr(user, "pro_expire_date", None)

    pro_active = bool(expire_date and now < expire_date)
    pro_days_remaining = 0
    if expire_date and now < expire_date:
        pro_days_remaining = max(0, (expire_date - now).days)

    pro_status = "active" if pro_active else ("expired" if expire_date else "free")

    return {
        "active": pro_active,
        "days_remaining": pro_days_remaining,
        "status": pro_status,
    }


def enrich_user_with_character_count(user: User, db: Session, current_user: Optional[User] = None) -> dict:
    """Convert User to dict with characters_created count"""
    pro_state = get_pro_state(user)
    liked_char_ids: set = set()
    liked_scene_ids: set = set()
    liked_persona_ids: set = set()
    if current_user:
        liked_char_ids = {r.character_id for r in db.query(UserLikedCharacter.character_id).filter(UserLikedCharacter.user_id == current_user.id).all()}
        liked_scene_ids = {r.scene_id for r in db.query(UserLikedScene.scene_id).filter(UserLikedScene.user_id == current_user.id).all()}
        liked_persona_ids = {r.persona_id for r in db.query(UserLikedPersona.persona_id).filter(UserLikedPersona.user_id == current_user.id).all()}
    recent_characters = (
        db.query(Character)
        .filter(Character.creator_id == user.id, Character.is_public == True)
        .order_by(Character.created_time.desc())
        .limit(4)
        .all()
    )
    recent_scenes = (
        db.query(Scene)
        .filter(Scene.creator_id == user.id, Scene.is_public == True)
        .order_by(Scene.created_time.desc())
        .limit(3)
        .all()
    )
    recent_personas = (
        db.query(Persona)
        .filter(Persona.creator_id == user.id, Persona.is_public == True)
        .order_by(Persona.created_time.desc())
        .limit(3)
        .all()
    )

    return {
        "id": user.id,
        "email": user.email,
        "phone_number": user.phone_number,
        "name": user.name,
        "profile_pic": user.profile_pic,
        "bio": user.bio,
        "liked_tags": user.liked_tags or [],
        "views": user.views or 0,
        "likes": user.likes or 0,
        "characters_created": db.query(func.count(Character.id)).filter(Character.creator_id == user.id).scalar() or 0,
        "recent_characters": [
            {
                "id": character.id,
                "name": character.name,
                "tagline": character.tagline or "",
                "tags": character.tags or [],
                "picture": character.picture,
                "views": character.views or 0,
                "likes": character.likes or 0,
                "is_public": bool(character.is_public),
                "is_forkable": bool(character.is_forkable),
                "context_label": character.context_label or "standard",
                "creator_id": character.creator_id or user.id,
                "creator_name": character.creator_name or user.name,
                "creator_profile_pic": user.profile_pic,
            }
            for character in recent_characters
        ],
        "recent_content": sorted(
            [
                {
                    "type": "character",
                    "id": c.id,
                    "name": c.name,
                    "tagline": c.tagline or "",
                    "intro": "",
                    "tags": c.tags or [],
                    "picture": c.picture,
                    "views": c.views or 0,
                    "likes": c.likes or 0,
                    "liked": c.id in liked_char_ids,
                    "is_public": bool(c.is_public),
                    "is_forkable": bool(c.is_forkable),
                    "context_label": c.context_label or "standard",
                    "creator_id": c.creator_id or user.id,
                    "creator_name": c.creator_name or user.name,
                    "creator_profile_pic": user.profile_pic,
                    "_sort_key": c.created_time,
                }
                for c in recent_characters
            ] + [
                {
                    "type": "scene",
                    "id": s.id,
                    "name": s.name,
                    "tagline": "",
                    "intro": s.intro or "",
                    "tags": s.tags or [],
                    "picture": s.picture,
                    "views": s.views or 0,
                    "likes": s.likes or 0,
                    "liked": s.id in liked_scene_ids,
                    "is_public": bool(s.is_public),
                    "is_forkable": bool(s.is_forkable),
                    "creator_id": s.creator_id or user.id,
                    "creator_name": s.creator_name or user.name,
                    "creator_profile_pic": user.profile_pic,
                    "_sort_key": s.created_time,
                }
                for s in recent_scenes
            ] + [
                {
                    "type": "persona",
                    "id": p.id,
                    "name": p.name,
                    "tagline": "",
                    "intro": p.intro or "",
                    "tags": p.tags or [],
                    "picture": p.picture,
                    "views": p.views or 0,
                    "likes": p.likes or 0,
                    "liked": p.id in liked_persona_ids,
                    "is_public": bool(p.is_public),
                    "is_forkable": bool(p.is_forkable),
                    "creator_id": p.creator_id or user.id,
                    "creator_name": p.creator_name or user.name,
                    "creator_profile_pic": user.profile_pic,
                    "_sort_key": p.created_time,
                }
                for p in recent_personas
            ],
            key=lambda x: x.pop("_sort_key") or datetime.min.replace(tzinfo=UTC),
            reverse=True,
        )[:8],
        "is_admin": user.is_admin or False,
        "default_persona_id": user.default_persona_id,
        "purchased_credit_balance": float(getattr(user, "purchased_credit_balance", 0) or 0),
        "purchased_credits_bought_total": float(getattr(user, "purchased_credits_bought_total", 0) or 0),
        "purchased_credits_consumed_total": float(getattr(user, "purchased_credits_consumed_total", 0) or 0),
        "is_pro": pro_state["active"],
        "pro_start_date": getattr(user, "pro_start_date", None),
        "pro_expire_date": getattr(user, "pro_expire_date", None),
        "pro_active": pro_state["active"],
        "pro_days_remaining": pro_state["days_remaining"],
        "pro_status": pro_state["status"],
        # Ban status (all fields returned for admin use)
        "ban_type": getattr(user, "ban_type", None),
        "ban_until": getattr(user, "ban_until", None),
        "ban_reason": getattr(user, "ban_reason", None),
        "ban_note": getattr(user, "ban_note", None),
    }


def build_user_response(user: User, db: Session) -> dict[str, Any]:
    """Serialize a User with default persona and chat history included."""
    default_persona: Optional[PersonaOut] = None
    if user.default_persona_id:
        persona = db.query(Persona).filter(Persona.id == user.default_persona_id).first()
        if persona:
            default_persona = PersonaOut.model_validate(persona)

    # Calculate characters_created by counting characters where creator_id matches user.id
    characters_created = db.query(Character).filter(Character.creator_id == user.id).count()
    pro_state = get_pro_state(user)
    credit_limits = get_credit_cap_info(user, db)

    # Expose ban status �?shadow_ban is intentionally hidden from the user
    active_ban = get_active_ban_type(user)
    exposed_ban_type = active_ban if active_ban != "shadow_ban" else None
    exposed_ban_until = getattr(user, "ban_until", None) if exposed_ban_type else None

    return {
        "id": user.id,
        "email": user.email,
        "phone_number": user.phone_number,
        "name": user.name,
        "profile_pic": user.profile_pic,
        "bio": user.bio,
        "liked_tags": user.liked_tags or [],
        "chat_history": fetch_user_chat_history(db, user.id),
        "views": user.views or 0,
        "likes": user.likes or 0,
        "characters_created": characters_created,
        "is_admin": user.is_admin or False,
        "daily_credit_usage": credit_limits["daily_credit_usage"],
        "monthly_credit_usage": credit_limits["monthly_credit_usage"],
        "credit_cap_scope": credit_limits["cap_scope"],
        "credit_cap": credit_limits["credit_cap"],
        "remaining_credits": credit_limits["remaining_credits"],
        "credit_cap_reached": credit_limits["cap_reached"],
        "credit_reset_at": credit_limits["reset_at"],
        "free_daily_credit_cap": credit_limits["free_daily_credit_cap"],
        "pro_monthly_credit_cap": credit_limits["pro_monthly_credit_cap"],
        "purchased_credit_balance": float(getattr(user, "purchased_credit_balance", 0) or 0),
        "purchased_credits_bought_total": float(getattr(user, "purchased_credits_bought_total", 0) or 0),
        "purchased_credits_consumed_total": float(getattr(user, "purchased_credits_consumed_total", 0) or 0),
        "default_persona_id": user.default_persona_id,
        "default_persona": default_persona,
        "is_pro": pro_state["active"],
        "pro_start_date": getattr(user, "pro_start_date", None),
        "pro_expire_date": getattr(user, "pro_expire_date", None),
        "pro_active": pro_state["active"],
        "pro_days_remaining": pro_state["days_remaining"],
        "pro_status": pro_state["status"],
        "invitation_code": getattr(user, "invitation_code", None),
        "ban_type": exposed_ban_type,
        "ban_until": exposed_ban_until,
    }


def is_pro_active(user: User) -> bool:
    """Check if a user's Pro subscription is currently active."""
    return get_pro_state(user)["active"]


def _add_months(dt: datetime, months: int) -> datetime:
    """Advance *dt* by *months* calendar months, anchored to the same day-of-month.
    Days that don't exist in the target month are clamped to the last day."""
    import calendar
    target_month = (dt.month - 1 + months) % 12 + 1
    years_over = (dt.month - 1 + months) // 12
    target_year = dt.year + years_over
    last_day = calendar.monthrange(target_year, target_month)[1]
    return dt.replace(year=target_year, month=target_month, day=min(dt.day, last_day))


def upgrade_to_pro(user: User, db: Session, duration_months: int = 1, duration_days: int | None = None) -> User:
    """
    Upgrade a user to Pro status.

    Args:
        user: User object to upgrade
        db: Database session
        duration_months: Number of calendar months for the subscription (default: 1).
        duration_days: Legacy parameter. If provided and duration_months is default,
                       converts 30-day multiples to months (30�?, 180�?, etc.).

    Returns:
        Updated User object
    """
    # Back-compat: callers still passing duration_days
    if duration_days is not None:
        duration_months = max(1, round(duration_days / 30))

    now = datetime.now(UTC)

    # If already Pro and not expired, extend from current expiration
    if user.is_pro and user.pro_expire_date and user.pro_expire_date > now:
        new_expire = _add_months(user.pro_expire_date, duration_months)
    else:
        # New Pro subscription or expired
        user.pro_start_date = now
        new_expire = _add_months(now, duration_months)
    
    user.is_pro = True
    user.pro_expire_date = new_expire
    
    db.commit()
    db.refresh(user)
    
    return user


def downgrade_from_pro(user: User, db: Session) -> User:
    """Downgrade a user from Pro status.
    
    Args:
        user: User object to downgrade
        db: Database session
    
    Returns:
        Updated User object
    """
    user.is_pro = False
    # Keep the dates for record keeping
    
    db.commit()
    db.refresh(user)
    
    return user


def check_and_expire_pro(user: User, db: Session) -> User:
    """Check if Pro subscription has expired and update status if needed.
    
    Args:
        user: User object to check
        db: Database session
    
    Returns:
        Updated User object if changed, original otherwise
    """
    if user.is_pro and user.pro_expire_date:
        if datetime.now(UTC) >= user.pro_expire_date:
            user.is_pro = False
            db.commit()
            db.refresh(user)
    
    return user


def get_pro_days_remaining(user: User) -> int:
    """Get the number of days remaining in a Pro subscription.
    
    Args:
        user: User object to check
    
    Returns:
        Number of days remaining (0 if not Pro or expired)
    """
    return get_pro_state(user)["days_remaining"]
