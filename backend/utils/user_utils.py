from __future__ import annotations

from typing import Any, Optional

from sqlalchemy.orm import Session

from models import Persona, User
from schemas import PersonaOut
from utils.chat_history_utils import fetch_user_chat_history


def build_user_response(user: User, db: Session) -> dict[str, Any]:
    """Serialize a User with default persona and chat history included."""
    default_persona: Optional[PersonaOut] = None
    if user.default_persona_id:
        persona = db.query(Persona).filter(Persona.id == user.default_persona_id).first()
        if persona:
            default_persona = PersonaOut.model_validate(persona)

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
        "is_admin": user.is_admin or False,
        "default_persona_id": user.default_persona_id,
        "default_persona": default_persona,
    }
