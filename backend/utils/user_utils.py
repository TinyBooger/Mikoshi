from __future__ import annotations

from typing import Any, Optional

from sqlalchemy.orm import Session
from sqlalchemy import func

from models import Persona, User, Character
from schemas import PersonaOut
from utils.chat_history_utils import fetch_user_chat_history


def enrich_user_with_character_count(user: User, db: Session) -> dict:
    """Convert User to dict with characters_created count"""
    return {
        "id": user.id,
        "email": user.email,
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
        "badges": user.badges or {},
        "active_badge": user.active_badge,
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

    return {
        "id": user.id,
        "email": user.email,
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
        "default_persona_id": user.default_persona_id,
        "default_persona": default_persona,
        "badges": user.badges or {},
        "active_badge": user.active_badge,
    }
