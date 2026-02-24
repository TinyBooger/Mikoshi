from __future__ import annotations

from typing import Any, Optional
from datetime import datetime, UTC, timedelta

from sqlalchemy.orm import Session
from sqlalchemy import func

from models import Persona, User, Character
from schemas import PersonaOut
from utils.chat_history_utils import fetch_user_chat_history


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


def enrich_user_with_character_count(user: User, db: Session) -> dict:
    """Convert User to dict with characters_created count"""
    pro_state = get_pro_state(user)

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
        "is_admin": user.is_admin or False,
        "default_persona_id": user.default_persona_id,
        "level": getattr(user, "level", 1) or 1,
        "exp": getattr(user, "exp", 0) or 0,
        "daily_exp_gained": getattr(user, "daily_exp_gained", 0) or 0,
        "badges": user.badges or {},
        "active_badge": user.active_badge,
        "is_pro": pro_state["active"],
        "pro_start_date": getattr(user, "pro_start_date", None),
        "pro_expire_date": getattr(user, "pro_expire_date", None),
        "pro_active": pro_state["active"],
        "pro_days_remaining": pro_state["days_remaining"],
        "pro_status": pro_state["status"],
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
        "level": getattr(user, "level", 1) or 1,
        "exp": getattr(user, "exp", 0) or 0,
        "daily_exp_gained": getattr(user, "daily_exp_gained", 0) or 0,
        "default_persona_id": user.default_persona_id,
        "default_persona": default_persona,
        "badges": user.badges or {},
        "active_badge": user.active_badge,
        "is_pro": pro_state["active"],
        "pro_start_date": getattr(user, "pro_start_date", None),
        "pro_expire_date": getattr(user, "pro_expire_date", None),
        "pro_active": pro_state["active"],
        "pro_days_remaining": pro_state["days_remaining"],
        "pro_status": pro_state["status"],
    }


def is_pro_active(user: User) -> bool:
    """Check if a user's Pro subscription is currently active."""
    return get_pro_state(user)["active"]


def upgrade_to_pro(user: User, db: Session, duration_days: int = 30) -> User:
    """Upgrade a user to Pro status.
    
    Args:
        user: User object to upgrade
        db: Database session
        duration_days: Number of days for the Pro subscription (default: 30)
    
    Returns:
        Updated User object
    """
    now = datetime.now(UTC)
    
    # If already Pro and not expired, extend from current expiration
    if user.is_pro and user.pro_expire_date and user.pro_expire_date > now:
        new_expire = user.pro_expire_date + timedelta(days=duration_days)
    else:
        # New Pro subscription or expired
        user.pro_start_date = now
        new_expire = now + timedelta(days=duration_days)
    
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
