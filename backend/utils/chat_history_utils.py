from __future__ import annotations

from datetime import datetime, UTC
from typing import List, Optional

from sqlalchemy.orm import Session

from models import ChatHistory


def serialize_chat_history_entry(entry: ChatHistory) -> dict:
    """Convert a ChatHistory ORM object into a JSON-friendly dict."""
    return {
        "chat_id": entry.chat_id,
        "character_id": entry.character_id,
        "character_name": entry.character_name,
        "character_picture": entry.character_picture,
        "scene_id": entry.scene_id,
        "scene_name": entry.scene_name,
        "scene_picture": entry.scene_picture,
        "persona_id": entry.persona_id,
        "title": entry.title,
        "messages": entry.messages or [],
        "last_updated": entry.last_updated.isoformat() if entry.last_updated else None,
        "created_at": entry.created_at.isoformat() if entry.created_at else None,
    }


def fetch_user_chat_history(db: Session, user_id: str, limit: int = 30) -> List[dict]:
    """Return the most recent chat history entries for a user, newest first."""
    entries = (
        db.query(ChatHistory)
        .filter(ChatHistory.user_id == user_id)
        .order_by(ChatHistory.last_updated.desc(), ChatHistory.id.desc())
        .limit(limit)
        .all()
    )
    return [serialize_chat_history_entry(entry) for entry in entries]


def fetch_chat_history_entry(db: Session, user_id: str, chat_id: str) -> Optional[ChatHistory]:
    return (
        db.query(ChatHistory)
        .filter(ChatHistory.user_id == user_id, ChatHistory.chat_id == chat_id)
        .first()
    )


def prune_chat_history(db: Session, user_id: str, limit: int = 30, auto_commit: bool = True) -> None:
    """Keep only the newest `limit` entries for the user."""
    extras = (
        db.query(ChatHistory)
        .filter(ChatHistory.user_id == user_id)
        .order_by(ChatHistory.last_updated.desc(), ChatHistory.id.desc())
        .offset(limit)
        .all()
    )
    if not extras:
        return

    for entry in extras:
        db.delete(entry)

    if auto_commit:
        db.commit()


def upsert_chat_history_entry(
    db: Session,
    *,
    user_id: str,
    chat_id: str,
    payload: dict,
    limit: int = 30,
) -> ChatHistory:
    """Insert or update a chat history entry, then enforce the per-user limit."""
    entry = fetch_chat_history_entry(db, user_id, chat_id)
    now = datetime.now(UTC)

    fields = {
        "character_id": payload.get("character_id"),
        "scene_id": payload.get("scene_id"),
        "persona_id": payload.get("persona_id"),
        "character_name": payload.get("character_name"),
        "character_picture": payload.get("character_picture"),
        "scene_name": payload.get("scene_name"),
        "scene_picture": payload.get("scene_picture"),
        "title": payload.get("title"),
        "messages": payload.get("messages", []),
        "last_updated": payload.get("last_updated", now),
    }

    created_at = payload.get("created_at") or now

    if entry:
        for key, value in fields.items():
            setattr(entry, key, value)
        if not entry.created_at:
            entry.created_at = created_at
    else:
        entry = ChatHistory(
            chat_id=chat_id,
            user_id=user_id,
            created_at=created_at,
            **fields,
        )
        db.add(entry)

    db.flush()
    prune_chat_history(db, user_id, limit, auto_commit=False)
    db.commit()
    db.refresh(entry)
    return entry
