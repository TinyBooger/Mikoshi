from __future__ import annotations

from datetime import datetime, UTC
import uuid
from typing import Any, List, Optional
import logging

logger = logging.getLogger(__name__)
logger.setLevel(logging.INFO)

from sqlalchemy import and_, func
from sqlalchemy.orm import Session, object_session

from models import ChatHistory, Character, ChatHistoryBranch, ChatHistoryMessage
from utils.prompt_time import MIN_GAP_SECONDS


CHAT_HISTORY_VERSION = 2
DEFAULT_BRANCH_ID = "branch_main"

# A stored message's ``created_at`` is only handed to the client when we know it
# is the moment the message was actually written:
#
# * rows written before timestamps reached clients carry no meaningful send time,
#   and
# * rows a store backfill had to invent are deliberately stamped with
#   :data:`TIMESTAMP_UNKNOWN` instead of "now" (see ``_sync_chat_history_store``),
#   because a backfill has no idea when those messages were sent.
#
# Anything at or after :data:`TIMESTAMP_TRUSTED_FROM` is real, so the client may
# draw its time dividers from it; older/unknown rows are serialized without a
# timestamp, and the client hides the time instead of showing a wrong one.
# Bump the cutoff only if a future migration invents timestamps again.
TIMESTAMP_TRUSTED_FROM = datetime(2026, 10, 7, tzinfo=UTC)
TIMESTAMP_UNKNOWN = datetime(1970, 1, 1, tzinfo=UTC)


def _as_utc(value: Optional[datetime]) -> Optional[datetime]:
    """Return `value` as an aware UTC datetime (SQLite drops tzinfo)."""
    if not isinstance(value, datetime):
        return None
    return value.replace(tzinfo=UTC) if value.tzinfo is None else value.astimezone(UTC)


def _display_timestamp(value: Optional[datetime]) -> Optional[str]:
    """ISO timestamp for the client, or None when the row's time is not real."""
    timestamp = _as_utc(value)
    if timestamp is None or timestamp < TIMESTAMP_TRUSTED_FROM:
        return None
    return timestamp.isoformat()


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


def _build_chat_history_payload_from_store(db: Session, entry: ChatHistory) -> dict[str, Any]:
    branches = (
        db.query(ChatHistoryBranch)
        .filter(ChatHistoryBranch.chat_id == entry.chat_id)
        .order_by(ChatHistoryBranch.created_at.asc(), ChatHistoryBranch.id.asc())
        .all()
    )
    if not branches:
        return normalize_chat_history_payload(entry.messages)

    payload_branches: list[dict[str, Any]] = []
    known_branch_ids: set[str] = set()

    for branch in branches:
        branch_messages = (
            db.query(ChatHistoryMessage)
            .filter(
                ChatHistoryMessage.chat_id == entry.chat_id,
                ChatHistoryMessage.branch_id == branch.branch_id,
            )
            .order_by(ChatHistoryMessage.created_seq.asc(), ChatHistoryMessage.id.asc())
            .all()
        )

        serialized_messages: list[dict[str, Any]] = []
        for item in branch_messages:
            message = {
                "role": item.role,
                "content": item.content,
            }
            # Empty for rows whose stored time is not trustworthy, so the client
            # has nothing to render a (wrong) clock from.
            created_at = _display_timestamp(item.created_at)
            if created_at:
                message["created_at"] = created_at
            if isinstance(item.usage, dict):
                message["usage"] = item.usage
            if item.role in {"user", "assistant"}:
                message["is_pinned"] = bool(item.is_pinned)
                if item.message_id:
                    message["message_id"] = item.message_id
                else:
                    message["message_id"] = generate_chat_message_id()
            payload_message = _normalize_message(message)
            if payload_message is not None:
                serialized_messages.append(payload_message)

        payload_branches.append(
            {
                "branch_id": branch.branch_id,
                "parent_branch_id": branch.parent_branch_id,
                "parent_message_id": branch.parent_message_id,
                "label": branch.label or "Branch",
                "created_at": branch.created_at.isoformat() if branch.created_at else None,
                "last_updated": branch.last_updated.isoformat() if branch.last_updated else None,
                "messages": serialized_messages,
            }
        )
        known_branch_ids.add(branch.branch_id)

    active_branch_id = entry.active_branch_id if isinstance(entry.active_branch_id, str) else None
    if not active_branch_id or active_branch_id not in known_branch_ids:
        active_branch_id = payload_branches[0]["branch_id"]

    return {
        "version": CHAT_HISTORY_VERSION,
        "active_branch_id": active_branch_id,
        "branches": payload_branches,
    }


def _sync_chat_history_store(
    db: Session,
    entry: ChatHistory,
    payload: dict[str, Any],
    *,
    live_timestamps: bool = True,
) -> None:
    """Append any messages the store does not have yet.

    ``live_timestamps`` says whether the payload being synced was produced by the
    send path, where "now" really is when those messages were sent. A read-path
    backfill passes ``False``, because it is translating a legacy JSON blob whose
    messages have no send time at all — see :data:`TIMESTAMP_UNKNOWN`.
    """
    normalized_payload = normalize_chat_history_payload(payload)
    branch_ids = [b["branch_id"] for b in normalized_payload["branches"]]

    existing_branches = (
        db.query(ChatHistoryBranch)
        .filter(ChatHistoryBranch.chat_id == entry.chat_id)
        .all()
    )
    existing_by_id = {b.branch_id: b for b in existing_branches}

    # Message ids this chat already stores, so a payload that carries an existing
    # message into a new branch (a fork duplicates every message of its source
    # branch) keeps the time that message was actually written instead of looking
    # freshly sent. A copy of an untrusted row inherits that untrustworthiness
    # along with the timestamp.
    stored_message_times = {
        message_id: created_at
        for message_id, created_at in (
            db.query(ChatHistoryMessage.message_id, ChatHistoryMessage.created_at)
            .filter(
                ChatHistoryMessage.chat_id == entry.chat_id,
                ChatHistoryMessage.message_id.isnot(None),
            )
            .all()
        )
    }

    for branch in normalized_payload["branches"]:
        branch_id = branch["branch_id"]
        target = existing_by_id.get(branch_id)
        now = datetime.now(UTC)
        if target is None:
            target = ChatHistoryBranch(
                chat_id=entry.chat_id,
                branch_id=branch_id,
                parent_branch_id=branch.get("parent_branch_id"),
                parent_message_id=branch.get("parent_message_id"),
                label=branch.get("label") or "Branch",
                created_at=now,
                last_updated=now,
            )
            db.add(target)
            db.flush()
        else:
            target.parent_branch_id = branch.get("parent_branch_id")
            target.parent_message_id = branch.get("parent_message_id")
            target.label = branch.get("label") or target.label or "Branch"
            target.last_updated = now

        incoming_messages = _normalize_messages(branch.get("messages"))
        existing_messages = (
            db.query(ChatHistoryMessage)
            .filter(
                ChatHistoryMessage.chat_id == entry.chat_id,
                ChatHistoryMessage.branch_id == branch_id,
            )
            .order_by(ChatHistoryMessage.created_seq.asc(), ChatHistoryMessage.id.asc())
            .all()
        )

        can_append = True
        prefix_len = min(len(existing_messages), len(incoming_messages))
        for index in range(prefix_len):
            stored = existing_messages[index]
            incoming = incoming_messages[index]

            incoming_role = str(incoming.get("role") or "").strip().lower()
            stored_role = str(stored.role or "").strip().lower()

            # System messages (the instruction prompt and context-compression
            # summaries) are ephemeral and legitimately mutable across turns —
            # the frontend rebuilds the instruction prompt from current character
            # data, and summaries evolve with re-summarization. Their divergence
            # is NOT evidence of a stale/concurrent turn, so they must not break
            # the append-only prefix check. The instruction prompt stored at
            # idx 0 is never read back by the client anyway.
            if stored_role == "system" or incoming_role == "system":
                continue

            incoming_usage = incoming.get("usage") if isinstance(incoming.get("usage"), dict) else None
            incoming_message_id = incoming.get("message_id") if isinstance(incoming.get("message_id"), str) else None
            incoming_is_pinned = bool(incoming.get("is_pinned")) if incoming_role in {"user", "assistant"} else False

            if (
                stored.role != incoming_role
                or stored.content != (incoming.get("content") or "")
                or (stored.message_id or None) != incoming_message_id
                or bool(stored.is_pinned) != incoming_is_pinned
                or (stored.usage or None) != incoming_usage
            ):
                logger.warning(
                    f"🚫 can_append broke | chat={entry.chat_id} branch={branch_id} idx={index} | stored_id={stored.message_id!r} incoming_id={incoming_message_id!r} | stored_content={stored.content[:30]!r} incoming_content={(incoming.get('content') or '')[:30]!r}"
                )
                can_append = False
                break

        # Append-only contract: never rewrite old rows when the incoming payload diverges.
        if not can_append:
            continue

        for index in range(len(existing_messages), len(incoming_messages)):
            message = incoming_messages[index]
            role = str(message.get("role") or "assistant").strip().lower()
            message_id = message.get("message_id") if isinstance(message.get("message_id"), str) else None
            db.add(
                ChatHistoryMessage(
                    chat_id=entry.chat_id,
                    branch_id=branch_id,
                    message_id=message_id,
                    role=role,
                    content=message.get("content") or "",
                    usage=message.get("usage") if isinstance(message.get("usage"), dict) else None,
                    is_pinned=bool(message.get("is_pinned")) if role in {"user", "assistant"} else False,
                    created_seq=index,
                    created_at=(
                        stored_message_times.get(message_id)
                        or (datetime.now(UTC) if live_timestamps else TIMESTAMP_UNKNOWN)
                    ),
                )
            )

    active_branch_id = normalized_payload.get("active_branch_id")
    if not isinstance(active_branch_id, str) or active_branch_id not in branch_ids:
        active_branch_id = branch_ids[0] if branch_ids else DEFAULT_BRANCH_ID
    entry.active_branch_id = active_branch_id


def _ensure_chat_history_store(db: Session, entry: ChatHistory) -> None:
    """Create the store rows for `entry` if the chat has none yet.

    This runs from read paths, so the rows a backfill has to create carry no
    timestamps: the legacy payload being backfilled has no send times, and the
    moment of the backfill is not one either.
    """
    branch_exists = (
        db.query(ChatHistoryBranch.id)
        .filter(ChatHistoryBranch.chat_id == entry.chat_id)
        .first()
    )
    if branch_exists:
        if not isinstance(entry.active_branch_id, str) or not entry.active_branch_id.strip():
            payload = _build_chat_history_payload_from_store(db, entry)
            entry.active_branch_id = payload.get("active_branch_id")
            db.flush()
        return

    payload = normalize_chat_history_payload(entry.messages)
    _sync_chat_history_store(db, entry, payload, live_timestamps=False)
    db.flush()


def serialize_chat_history_entry(entry: ChatHistory) -> dict:
    """Convert a ChatHistory ORM object into a JSON-friendly dict."""
    db = object_session(entry)
    if db is not None:
        _ensure_chat_history_store(db, entry)
        payload = _build_chat_history_payload_from_store(db, entry)
    else:
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
        # Same threshold the prompt's time marker uses, so the conversation breaks
        # the client draws match the gaps the model is told about; sent to the
        # client instead of being duplicated there.
        "timestamp_gap_seconds": MIN_GAP_SECONDS,
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
        _ensure_chat_history_store(db, entry)
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
    for entry in entries:
        _ensure_chat_history_store(db, entry)
    return {
        "items": [serialize_chat_history_entry(entry) for entry in entries],
        "total": total,
        "page": page,
        "page_size": page_size,
    }


def fetch_user_chat_history_grouped(db: Session, user_id: str, page: int = 1, page_size: int = 20) -> dict:
    """Return one entry per chat group for the profile history tab.

    A group is the entity the chat was *entered* through, mirroring the two
    entry modes of the chat page:

    * ``group_type == "scene"`` — every chat that used a scene, grouped by
      ``scene_id`` regardless of character. Opening one enters scene mode:
      the scene is kept and a (possibly different) character is chosen.
    * ``group_type == "character"`` — chats with no scene, grouped by
      ``character_id``. Opening one enters character mode: the character is
      kept, the scene can change.

    Deleted characters (``character_id`` NULLed by ON DELETE SET NULL) are
    grouped by the cached ``character_name``. A deleted scene loses its
    ``scene_id`` the same way, so its chats fall back into character groups —
    a scene that no longer exists cannot be entered in scene mode anyway.
    """
    from sqlalchemy.orm import aliased

    CharAlias = aliased(Character)
    items: list[dict] = []

    # ── Part 1: scene groups (scene_id still set) ──────────────────────────────
    # Window functions pick exactly one representative row per group (the most
    # recently updated) while counting the whole partition in the same pass.
    scene_ranked = (
        db.query(
            ChatHistory.id.label("id"),
            func.count().over(partition_by=ChatHistory.scene_id).label("chat_count"),
            func.row_number().over(
                partition_by=ChatHistory.scene_id,
                order_by=(ChatHistory.last_updated.desc(), ChatHistory.id.desc()),
            ).label("rn"),
        )
        .filter(ChatHistory.user_id == user_id, ChatHistory.scene_id.isnot(None))
        .subquery()
    )

    scene_rows = (
        db.query(ChatHistory, scene_ranked.c.chat_count)
        .join(scene_ranked, ChatHistory.id == scene_ranked.c.id)
        .filter(scene_ranked.c.rn == 1)
        .all()
    )

    for entry, chat_count in scene_rows:
        items.append({
            "group_type": "scene",
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
            "character_deleted": False,
            "character_moderation_status": None,
        })

    # ── Part 2: character groups (no scene, character still exists) ─────────────
    char_ranked = (
        db.query(
            ChatHistory.id.label("id"),
            func.count().over(partition_by=ChatHistory.character_id).label("chat_count"),
            func.row_number().over(
                partition_by=ChatHistory.character_id,
                order_by=(ChatHistory.last_updated.desc(), ChatHistory.id.desc()),
            ).label("rn"),
        )
        .filter(
            ChatHistory.user_id == user_id,
            ChatHistory.scene_id.is_(None),
            ChatHistory.character_id.isnot(None),
        )
        .subquery()
    )

    active_rows = (
        db.query(
            ChatHistory,
            char_ranked.c.chat_count,
            CharAlias.id.label("char_exists"),
            CharAlias.moderation_status.label("char_mod_status"),
        )
        .join(char_ranked, ChatHistory.id == char_ranked.c.id)
        .filter(char_ranked.c.rn == 1)
        .outerjoin(CharAlias, CharAlias.id == ChatHistory.character_id)
        .all()
    )

    for entry, chat_count, char_exists, char_mod_status in active_rows:
        items.append({
            "group_type": "character",
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

    # ── Part 3: deleted characters (character_id NULLed, no scene) ─────────────
    # Group by character_name since the ID is gone.
    del_ranked = (
        db.query(
            ChatHistory.id.label("id"),
            func.count().over(
                partition_by=(ChatHistory.character_name, ChatHistory.character_picture)
            ).label("chat_count"),
            func.row_number().over(
                partition_by=(ChatHistory.character_name, ChatHistory.character_picture),
                order_by=(ChatHistory.last_updated.desc(), ChatHistory.id.desc()),
            ).label("rn"),
        )
        .filter(
            ChatHistory.user_id == user_id,
            ChatHistory.scene_id.is_(None),
            ChatHistory.character_id.is_(None),
            ChatHistory.character_name.isnot(None),
        )
        .subquery()
    )

    deleted_rows = (
        db.query(ChatHistory, del_ranked.c.chat_count)
        .join(del_ranked, ChatHistory.id == del_ranked.c.id)
        .filter(del_ranked.c.rn == 1)
        .all()
    )

    for entry, chat_count in deleted_rows:
        items.append({
            "group_type": "character",
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
    """Delete all *scene-less* chat history entries for a user+character.

    Scene chats belong to their scene group, so they are deliberately left
    alone here — use delete_user_chat_history_by_scene for those. When
    character_id is None (deleted character whose FK was set to NULL), falls
    back to matching by character_name. Returns the number of rows deleted.
    """
    if character_id is not None:
        q = db.query(ChatHistory).filter(
            ChatHistory.user_id == user_id,
            ChatHistory.character_id == character_id,
            ChatHistory.scene_id.is_(None),
        )
    elif character_name:
        q = db.query(ChatHistory).filter(
            ChatHistory.user_id == user_id,
            ChatHistory.character_id.is_(None),
            ChatHistory.character_name == character_name,
            ChatHistory.scene_id.is_(None),
        )
    else:
        return 0
    deleted = q.delete(synchronize_session=False)
    db.commit()
    return deleted


def delete_user_chat_history_by_scene(db: Session, user_id: str, scene_id: int | None) -> int:
    """Delete all chat history entries for a user+scene, whatever character they used.

    Mirror of delete_user_chat_history_by_character for scene groups. Returns
    the number of rows deleted.
    """
    if scene_id is None:
        return 0
    deleted = (
        db.query(ChatHistory)
        .filter(
            ChatHistory.user_id == user_id,
            ChatHistory.scene_id == scene_id,
        )
        .delete(synchronize_session=False)
    )
    db.commit()
    return deleted


def delete_unavailable_chat_history(db: Session, user_id: str) -> int:
    """Delete *scene-less* chat history entries for unavailable characters.

    Covers two cases:
    1. Deleted characters — character_id was set to NULL by ON DELETE SET NULL cascade.
    2. Moderated characters — character still exists but has been restricted or taken down.

    Scene chats are skipped: the scene itself may still be usable, and those
    rows belong to a scene group the user can keep with another character.
    Returns total rows deleted.
    """
    # Case 1: deleted characters (character_id NULLed, name cached)
    deleted = (
        db.query(ChatHistory)
        .filter(
            ChatHistory.user_id == user_id,
            ChatHistory.scene_id.is_(None),
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
            ChatHistory.scene_id.is_(None),
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


def chat_history_group_filters(user_id: str, entry: ChatHistory) -> list:
    """Return filter conditions selecting every row in ``entry``'s group.

    A group mirrors how a chat is entered, the same rule the profile history tab
    and the sidebar recents use:

    * a chat with a scene belongs to its **scene** group, whichever character
      it was used with;
    * a chat without a scene belongs to its **character** group;
    * a deleted character (``character_id`` NULLed by ON DELETE SET NULL) falls
      back to the cached ``character_name``.
    """
    if entry.scene_id is not None:
        return [ChatHistory.user_id == user_id, ChatHistory.scene_id == entry.scene_id]
    if entry.character_id is not None:
        return [
            ChatHistory.user_id == user_id,
            ChatHistory.scene_id.is_(None),
            ChatHistory.character_id == entry.character_id,
        ]
    if entry.character_name:
        return [
            ChatHistory.user_id == user_id,
            ChatHistory.scene_id.is_(None),
            ChatHistory.character_id.is_(None),
            ChatHistory.character_name == entry.character_name,
        ]
    # Nothing to group by (no scene, no id, no cached name) — fall back to the
    # single row so callers still behave sensibly.
    return [ChatHistory.user_id == user_id, ChatHistory.chat_id == entry.chat_id]


def set_chat_history_group_pinned(db: Session, user_id: str, entry: ChatHistory, is_pinned: bool) -> int:
    """Pin/unpin every chat in the entry's group (the UI shows one row per group).

    Returns the number of rows updated.
    """
    updated = (
        db.query(ChatHistory)
        .filter(*chat_history_group_filters(user_id, entry))
        .update({ChatHistory.is_pinned: bool(is_pinned)}, synchronize_session=False)
    )
    db.commit()
    return updated


def hide_chat_history_group_from_recent(db: Session, user_id: str, entry: ChatHistory) -> int:
    """Hide every chat in the entry's group from the sidebar recents.

    Hiding only the representative row would just promote the next-newest chat
    of the same group back into the list. Returns the number of rows updated.
    """
    updated = (
        db.query(ChatHistory)
        .filter(*chat_history_group_filters(user_id, entry))
        .update({ChatHistory.hidden_from_recent: True}, synchronize_session=False)
    )
    db.commit()
    return updated


def restore_chat_history_group_to_recent(db: Session, user_id: str, entry: ChatHistory) -> int:
    """Undo hide_chat_history_group_from_recent for the entry's group."""
    updated = (
        db.query(ChatHistory)
        .filter(*chat_history_group_filters(user_id, entry))
        .update({ChatHistory.hidden_from_recent: False}, synchronize_session=False)
    )
    db.commit()
    return updated


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
    normalized_payload = normalize_chat_history_payload(payload.get("messages", getattr(entry, "messages", [])))

    fields = {
        "character_id": payload.get("character_id"),
        "scene_id": payload.get("scene_id"),
        "persona_id": payload.get("persona_id"),
        "character_name": payload.get("character_name"),
        "character_picture": payload.get("character_picture"),
        "scene_name": payload.get("scene_name"),
        "scene_picture": payload.get("scene_picture"),
        "title": payload.get("title"),
        "is_pinned": bool(payload.get("is_pinned")) if "is_pinned" in payload else bool(getattr(entry, "is_pinned", False)),
        "active_branch_id": payload.get("active_branch_id", normalized_payload.get("active_branch_id")),
        "last_updated": payload.get("last_updated", now),
    }

    # Rolling-summary state (context compression cursor), merged branch-wise so
    # concurrent turns on other branches never wipe each other's state.
    if "context_summary" in payload and payload.get("context_summary") is not None:
        existing_summary = dict(getattr(entry, "context_summary", None) or {})
        existing_summary.update(payload.get("context_summary") or {})
        fields["context_summary"] = existing_summary or None

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
            messages=normalized_payload,
            **fields,
        )
        db.add(entry)

    db.flush()
    _sync_chat_history_store(db, entry, normalized_payload)
    prune_chat_history(db, user_id, limit, auto_commit=False)
    db.commit()
    db.refresh(entry)
    return entry


def fetch_chat_history_messages_from_store(db: Session, entry: ChatHistory, branch_id: str | None = None) -> list[dict[str, Any]]:
    _ensure_chat_history_store(db, entry)
    payload = _build_chat_history_payload_from_store(db, entry)
    return get_chat_history_messages(payload, branch_id)


def set_chat_history_active_branch_for_entry(db: Session, entry: ChatHistory, branch_id: str) -> bool:
    if not isinstance(branch_id, str) or not branch_id.strip():
        return False

    normalized_branch_id = branch_id.strip()
    _ensure_chat_history_store(db, entry)
    exists = (
        db.query(ChatHistoryBranch.id)
        .filter(
            ChatHistoryBranch.chat_id == entry.chat_id,
            ChatHistoryBranch.branch_id == normalized_branch_id,
        )
        .first()
    )
    if not exists:
        return False

    entry.active_branch_id = normalized_branch_id
    entry.last_updated = datetime.now(UTC)
    db.flush()
    return True


def toggle_chat_history_message_pin(
    db: Session,
    *,
    entry: ChatHistory,
    branch_id: str,
    message_id: str,
    is_pinned: bool,
    max_pinned_memories: int,
    message_role: str | None = None,
    message_content: str | None = None,
) -> tuple[bool, int, str | None]:
    _ensure_chat_history_store(db, entry)
    normalized_branch_id = branch_id.strip()

    branch_exists = (
        db.query(ChatHistoryBranch.id)
        .filter(
            ChatHistoryBranch.chat_id == entry.chat_id,
            ChatHistoryBranch.branch_id == normalized_branch_id,
        )
        .first()
    )
    if not branch_exists:
        return False, 0, "BRANCH_NOT_FOUND"

    target_message = (
        db.query(ChatHistoryMessage)
        .filter(
            ChatHistoryMessage.chat_id == entry.chat_id,
            ChatHistoryMessage.branch_id == normalized_branch_id,
            ChatHistoryMessage.message_id == message_id,
        )
        .order_by(ChatHistoryMessage.created_seq.asc())
        .first()
    )

    if target_message is None and message_role in {"user", "assistant"} and isinstance(message_content, str) and message_content.strip():
        normalized_content = message_content.strip()
        target_message = (
            db.query(ChatHistoryMessage)
            .filter(
                ChatHistoryMessage.chat_id == entry.chat_id,
                ChatHistoryMessage.branch_id == normalized_branch_id,
                ChatHistoryMessage.role == message_role,
                ChatHistoryMessage.content == normalized_content,
            )
            .order_by(ChatHistoryMessage.created_seq.asc())
            .first()
        )

    if target_message is None:
        return False, 0, "MESSAGE_NOT_FOUND"

    if is_pinned and not bool(target_message.is_pinned):
        pinned_count = (
            db.query(func.count(ChatHistoryMessage.id))
            .filter(
                ChatHistoryMessage.chat_id == entry.chat_id,
                ChatHistoryMessage.branch_id == normalized_branch_id,
                ChatHistoryMessage.role.in_(["user", "assistant"]),
                ChatHistoryMessage.is_pinned == True,  # noqa: E712
            )
            .scalar()
            or 0
        )
        if pinned_count >= max_pinned_memories:
            return False, pinned_count, "PIN_LIMIT_REACHED"

    target_message.message_id = message_id
    target_message.is_pinned = bool(is_pinned)
    entry.active_branch_id = normalized_branch_id
    entry.last_updated = datetime.now(UTC)

    pinned_count_after = (
        db.query(func.count(ChatHistoryMessage.id))
        .filter(
            ChatHistoryMessage.chat_id == entry.chat_id,
            ChatHistoryMessage.branch_id == normalized_branch_id,
            ChatHistoryMessage.role.in_(["user", "assistant"]),
            ChatHistoryMessage.is_pinned == True,  # noqa: E712
        )
        .scalar()
        or 0
    )

    db.flush()
    return True, pinned_count_after, None
