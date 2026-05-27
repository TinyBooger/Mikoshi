from __future__ import annotations

from datetime import datetime, UTC
import uuid
from typing import Any, List, Optional

from sqlalchemy import func
from sqlalchemy.orm import Session

from models import ChatHistory, Character


CHAT_HISTORY_VERSION = 2
DEFAULT_BRANCH_ID = "branch_main"


def generate_chat_branch_id() -> str:
    return f"branch_{uuid.uuid4()}"


def generate_chat_message_id() -> str:
    return f"msg_{uuid.uuid4()}"


def _normalize_message(message: Any) -> Optional[dict[str, Any]]:
    if not isinstance(message, dict):
        return None

    role = str(message.get("role") or "").strip().lower()
    content = message.get("content")
    if not role or not isinstance(content, str) or not content.strip():
        return None

    normalized = dict(message)
    normalized["role"] = role
    normalized["content"] = content

    if role == "system":
        normalized.pop("is_pinned", None)
        if not isinstance(normalized.get("message_id"), str) or not normalized.get("message_id", "").strip():
            normalized.pop("message_id", None)
        return normalized

    message_id = normalized.get("message_id")
    normalized["message_id"] = message_id.strip() if isinstance(message_id, str) and message_id.strip() else generate_chat_message_id()
    normalized["is_pinned"] = bool(normalized.get("is_pinned"))
    return normalized


def _normalize_messages(messages: Any) -> list[dict[str, Any]]:
    if not isinstance(messages, list):
        return []

    normalized_messages: list[dict[str, Any]] = []
    for message in messages:
        normalized = _normalize_message(message)
        if normalized is not None:
            normalized_messages.append(normalized)
    return normalized_messages


def _normalize_branch(branch: Any, fallback_index: int = 0) -> Optional[dict[str, Any]]:
    if not isinstance(branch, dict):
        return None

    branch_id = branch.get("branch_id")
    if not isinstance(branch_id, str) or not branch_id.strip():
        branch_id = DEFAULT_BRANCH_ID if fallback_index == 0 else generate_chat_branch_id()
    branch_id = branch_id.strip()

    parent_branch_id = branch.get("parent_branch_id")
    if not isinstance(parent_branch_id, str) or not parent_branch_id.strip():
        parent_branch_id = None
    else:
        parent_branch_id = parent_branch_id.strip()

    parent_message_id = branch.get("parent_message_id")
    if not isinstance(parent_message_id, str) or not parent_message_id.strip():
        parent_message_id = None
    else:
        parent_message_id = parent_message_id.strip()

    label = branch.get("label")
    if not isinstance(label, str) or not label.strip():
        label = "Main" if fallback_index == 0 else f"Branch {fallback_index + 1}"

    return {
        "branch_id": branch_id,
        "parent_branch_id": parent_branch_id,
        "parent_message_id": parent_message_id,
        "label": label.strip(),
        "created_at": branch.get("created_at"),
        "last_updated": branch.get("last_updated"),
        "messages": _normalize_messages(branch.get("messages")),
    }


def normalize_chat_history_payload(raw_messages: Any) -> dict[str, Any]:
    if isinstance(raw_messages, dict):
        branches = raw_messages.get("branches")
        if isinstance(branches, list):
            normalized_branches: list[dict[str, Any]] = []
            seen_branch_ids: set[str] = set()
            for index, branch in enumerate(branches):
                normalized_branch = _normalize_branch(branch, index)
                if not normalized_branch:
                    continue
                branch_id = normalized_branch["branch_id"]
                if branch_id in seen_branch_ids:
                    normalized_branch["branch_id"] = generate_chat_branch_id()
                seen_branch_ids.add(normalized_branch["branch_id"])
                normalized_branches.append(normalized_branch)

            if normalized_branches:
                active_branch_id = raw_messages.get("active_branch_id")
                if not isinstance(active_branch_id, str) or active_branch_id not in {branch["branch_id"] for branch in normalized_branches}:
                    active_branch_id = normalized_branches[0]["branch_id"]
                return {
                    "version": CHAT_HISTORY_VERSION,
                    "active_branch_id": active_branch_id,
                    "branches": normalized_branches,
                }

    legacy_messages = _normalize_messages(raw_messages)
    return {
        "version": CHAT_HISTORY_VERSION,
        "active_branch_id": DEFAULT_BRANCH_ID,
        "branches": [
            {
                "branch_id": DEFAULT_BRANCH_ID,
                "parent_branch_id": None,
                "parent_message_id": None,
                "label": "Main",
                "created_at": None,
                "last_updated": None,
                "messages": legacy_messages,
            }
        ],
    }


def get_chat_history_branch(raw_messages: Any, branch_id: str | None = None) -> dict[str, Any]:
    payload = normalize_chat_history_payload(raw_messages)
    effective_branch_id = branch_id or payload["active_branch_id"]
    for branch in payload["branches"]:
        if branch["branch_id"] == effective_branch_id:
            return branch
    return payload["branches"][0]


def get_chat_history_messages(raw_messages: Any, branch_id: str | None = None) -> list[dict[str, Any]]:
    return list(get_chat_history_branch(raw_messages, branch_id).get("messages") or [])


def get_chat_history_active_branch_id(raw_messages: Any) -> str:
    return normalize_chat_history_payload(raw_messages)["active_branch_id"]


def set_chat_history_active_branch(raw_messages: Any, branch_id: str) -> dict[str, Any]:
    payload = normalize_chat_history_payload(raw_messages)
    if any(branch["branch_id"] == branch_id for branch in payload["branches"]):
        payload["active_branch_id"] = branch_id
    return payload


def replace_chat_history_branch_messages(
    raw_messages: Any,
    *,
    branch_id: str,
    messages: Any,
    parent_branch_id: str | None = None,
    parent_message_id: str | None = None,
    label: str | None = None,
    make_active: bool = True,
) -> tuple[dict[str, Any], dict[str, Any]]:
    payload = normalize_chat_history_payload(raw_messages)
    normalized_messages = _normalize_messages(messages)
    now_iso = datetime.now(UTC).isoformat()

    target_branch = None
    for branch in payload["branches"]:
        if branch["branch_id"] != branch_id:
            continue
        branch["messages"] = normalized_messages
        branch["last_updated"] = now_iso
        if label:
            branch["label"] = label
        target_branch = branch
        break

    if target_branch is None:
        target_branch = {
            "branch_id": branch_id,
            "parent_branch_id": parent_branch_id,
            "parent_message_id": parent_message_id,
            "label": label or f"Branch {len(payload['branches']) + 1}",
            "created_at": now_iso,
            "last_updated": now_iso,
            "messages": normalized_messages,
        }
        payload["branches"].append(target_branch)

    if make_active:
        payload["active_branch_id"] = target_branch["branch_id"]

    return payload, target_branch


def fork_chat_history_branch(
    raw_messages: Any,
    *,
    source_branch_id: str | None,
    messages: Any,
    parent_message_id: str | None = None,
    label: str | None = None,
) -> tuple[dict[str, Any], dict[str, Any]]:
    payload = normalize_chat_history_payload(raw_messages)
    branch_index = len(payload["branches"]) + 1
    branch_id = generate_chat_branch_id()
    return replace_chat_history_branch_messages(
        payload,
        branch_id=branch_id,
        messages=messages,
        parent_branch_id=source_branch_id or payload["active_branch_id"],
        parent_message_id=parent_message_id,
        label=label or f"Branch {branch_index}",
        make_active=True,
    )


def iter_chat_history_messages(raw_messages: Any, *, dedupe: bool = False) -> list[dict[str, Any]]:
    payload = normalize_chat_history_payload(raw_messages)
    collected: list[dict[str, Any]] = []
    seen_ids: set[str] = set()

    for branch in payload["branches"]:
        for message in branch.get("messages") or []:
            if not isinstance(message, dict):
                continue
            if dedupe:
                message_id = message.get("message_id")
                if isinstance(message_id, str) and message_id in seen_ids:
                    continue
                if isinstance(message_id, str):
                    seen_ids.add(message_id)
            collected.append(message)

    return collected


def count_chat_history_messages(raw_messages: Any, branch_id: str | None = None) -> int:
    return len(get_chat_history_messages(raw_messages, branch_id))


def serialize_chat_history_entry(entry: ChatHistory) -> dict:
    """Convert a ChatHistory ORM object into a JSON-friendly dict."""
    payload = normalize_chat_history_payload(entry.messages)
    active_branch = get_chat_history_branch(payload)
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
        "messages": active_branch.get("messages") or [],
        "branches": payload["branches"],
        "active_branch_id": payload["active_branch_id"],
        "message_store_version": payload["version"],
        "chat_config": entry.chat_config or {},
        "is_pinned": bool(getattr(entry, "is_pinned", False)),
        "hidden_from_recent": bool(getattr(entry, "hidden_from_recent", False)),
        "last_updated": entry.last_updated.isoformat() if entry.last_updated else None,
        "created_at": entry.created_at.isoformat() if entry.created_at else None,
    }


def fetch_user_chat_history(db: Session, user_id: str, limit: int = 30) -> List[dict]:
    """Return the most recent visible (not hidden_from_recent) chat history entries for a user."""
    entries = (
        db.query(ChatHistory)
        .filter(ChatHistory.user_id == user_id, ChatHistory.hidden_from_recent == False)  # noqa: E712
        .order_by(ChatHistory.last_updated.desc(), ChatHistory.id.desc())
        .limit(limit)
        .all()
    )

    # Bulk-lookup character status to detect deletions and moderation
    character_ids = [e.character_id for e in entries if e.character_id is not None]
    char_status: dict[str, str | None] = {}  # character_id (as str) -> moderation_status
    if character_ids:
        int_ids = []
        for cid in character_ids:
            try:
                int_ids.append(int(cid))
            except (ValueError, TypeError):
                pass
        if int_ids:
            rows = (
                db.query(Character.id, Character.moderation_status)
                .filter(Character.id.in_(int_ids))
                .all()
            )
            for cid, mod_status in rows:
                char_status[str(cid)] = mod_status  # None means normal

    results = []
    for entry in entries:
        serialized = serialize_chat_history_entry(entry)
        cid = str(entry.character_id) if entry.character_id is not None else None
        if cid is None:
            # character_id was set to NULL by ON DELETE SET NULL — character was deleted
            # (only if there is a cached name; otherwise it was never a character chat)
            serialized["character_deleted"] = bool(entry.character_name)
            serialized["character_moderation_status"] = None
        elif cid not in char_status:
            # Shouldn't normally happen with SET NULL FK, but handle defensively
            serialized["character_deleted"] = True
            serialized["character_moderation_status"] = None
        else:
            serialized["character_deleted"] = False
            serialized["character_moderation_status"] = char_status[cid]
        results.append(serialized)

    return results


def fetch_user_chat_history_paginated(db: Session, user_id: str, page: int = 1, page_size: int = 20) -> dict:
    """Return all chat history entries (including hidden) for the profile history tab, with pagination."""
    offset = (page - 1) * page_size
    query = (
        db.query(ChatHistory)
        .filter(ChatHistory.user_id == user_id)
        .order_by(ChatHistory.last_updated.desc(), ChatHistory.id.desc())
    )
    total = query.count()
    entries = query.offset(offset).limit(page_size).all()
    return {
        "items": [serialize_chat_history_entry(entry) for entry in entries],
        "total": total,
        "page": page,
        "page_size": page_size,
    }


def fetch_user_chat_history_grouped_by_character(db: Session, user_id: str, page: int = 1, page_size: int = 20) -> dict:
    """Return one entry per character (the most recent chat) for the profile history tab.

    Includes entries for deleted characters whose character_id was set to NULL by the
    ON DELETE SET NULL FK constraint — these are grouped by cached character_name.
    """
    from sqlalchemy.orm import aliased

    CharAlias = aliased(Character)

    # ── Part 1: active characters (character_id still set) ─────────────────────
    sub = (
        db.query(
            ChatHistory.character_id,
            func.max(ChatHistory.last_updated).label("max_updated"),
            func.count(ChatHistory.id).label("chat_count"),
        )
        .filter(ChatHistory.user_id == user_id, ChatHistory.character_id.isnot(None))
        .group_by(ChatHistory.character_id)
        .subquery()
    )

    active_rows = (
        db.query(ChatHistory, sub.c.chat_count, CharAlias.id.label("char_exists"), CharAlias.moderation_status.label("char_mod_status"))
        .join(
            sub,
            (ChatHistory.character_id == sub.c.character_id)
            & (ChatHistory.last_updated == sub.c.max_updated)
            & (ChatHistory.user_id == user_id),
        )
        .outerjoin(CharAlias, CharAlias.id == ChatHistory.character_id)
        .all()
    )

    items: list[dict] = []
    for entry, chat_count, char_exists, char_mod_status in active_rows:
        items.append({
            "chat_id": entry.chat_id,
            "character_id": entry.character_id,
            "character_name": entry.character_name,
            "character_picture": entry.character_picture,
            "scene_id": entry.scene_id,
            "scene_name": entry.scene_name,
            "scene_picture": entry.scene_picture,
            "hidden_from_recent": bool(getattr(entry, "hidden_from_recent", False)),
            "last_updated": entry.last_updated.isoformat() if entry.last_updated else None,
            "chat_count": chat_count,
            "character_deleted": char_exists is None,
            "character_moderation_status": char_mod_status if char_exists is not None else None,
        })

    # ── Part 2: deleted characters (character_id NULLed by FK cascade) ─────────
    # Group by character_name since the ID is gone.
    del_sub = (
        db.query(
            ChatHistory.character_name,
            ChatHistory.character_picture,
            func.max(ChatHistory.last_updated).label("max_updated"),
            func.count(ChatHistory.id).label("chat_count"),
        )
        .filter(
            ChatHistory.user_id == user_id,
            ChatHistory.character_id.is_(None),
            ChatHistory.character_name.isnot(None),
        )
        .group_by(ChatHistory.character_name, ChatHistory.character_picture)
        .subquery()
    )

    deleted_rows = (
        db.query(ChatHistory, del_sub.c.chat_count)
        .join(
            del_sub,
            (ChatHistory.character_name == del_sub.c.character_name)
            & (ChatHistory.last_updated == del_sub.c.max_updated)
            & (ChatHistory.user_id == user_id)
            & ChatHistory.character_id.is_(None),
        )
        .all()
    )

    for entry, chat_count in deleted_rows:
        items.append({
            "chat_id": entry.chat_id,
            "character_id": None,
            "character_name": entry.character_name,
            "character_picture": entry.character_picture,
            "scene_id": entry.scene_id,
            "scene_name": entry.scene_name,
            "scene_picture": entry.scene_picture,
            "hidden_from_recent": bool(getattr(entry, "hidden_from_recent", False)),
            "last_updated": entry.last_updated.isoformat() if entry.last_updated else None,
            "chat_count": chat_count,
            "character_deleted": True,
            "character_moderation_status": None,
        })

    # ── Sort combined list and paginate in Python ───────────────────────────────
    items.sort(key=lambda x: x["last_updated"] or "", reverse=True)
    total_rows = len(items)
    start = (page - 1) * page_size
    paged = items[start: start + page_size]

    return {"items": paged, "total": total_rows, "page": page, "page_size": page_size}


def delete_user_chat_history_by_character(
    db: Session,
    user_id: str,
    character_id: str | None,
    character_name: str | None = None,
) -> int:
    """Delete all chat history entries for a user+character.

    When character_id is None (deleted character whose FK was set to NULL),
    falls back to matching by character_name. Returns the number of rows deleted.
    """
    if character_id is not None:
        q = db.query(ChatHistory).filter(
            ChatHistory.user_id == user_id,
            ChatHistory.character_id == character_id,
        )
    elif character_name:
        q = db.query(ChatHistory).filter(
            ChatHistory.user_id == user_id,
            ChatHistory.character_id.is_(None),
            ChatHistory.character_name == character_name,
        )
    else:
        return 0
    deleted = q.delete(synchronize_session=False)
    db.commit()
    return deleted


def delete_unavailable_chat_history(db: Session, user_id: str) -> int:
    """Delete all chat history entries for unavailable characters.

    Covers two cases:
    1. Deleted characters — character_id was set to NULL by ON DELETE SET NULL cascade.
    2. Moderated characters — character still exists but has been restricted or taken down.
    Returns total rows deleted.
    """
    # Case 1: deleted characters (character_id NULLed, name cached)
    deleted = (
        db.query(ChatHistory)
        .filter(
            ChatHistory.user_id == user_id,
            ChatHistory.character_id.is_(None),
            ChatHistory.character_name.isnot(None),
        )
        .delete(synchronize_session=False)
    )

    # Case 2: moderated characters still in the Character table
    moderated_ids = (
        db.query(Character.id)
        .filter(Character.moderation_status.in_(['restricted', 'takedown']))
        .subquery()
    )
    deleted += (
        db.query(ChatHistory)
        .filter(
            ChatHistory.user_id == user_id,
            ChatHistory.character_id.in_(moderated_ids),
        )
        .delete(synchronize_session=False)
    )

    db.commit()
    return deleted


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
        "messages": normalize_chat_history_payload(payload.get("messages", getattr(entry, "messages", []))),
        "chat_config": payload.get("chat_config", getattr(entry, "chat_config", {}) or {}),
        "is_pinned": bool(payload.get("is_pinned")) if "is_pinned" in payload else bool(getattr(entry, "is_pinned", False)),
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
