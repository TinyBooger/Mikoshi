from fastapi import APIRouter, Request, Depends, HTTPException
from fastapi.responses import JSONResponse, StreamingResponse, Response
from sqlalchemy.orm import Session
from starlette.requests import ClientDisconnect
from database import get_db
from utils.session import get_current_user
from utils.llm_client import client, stream_chat_completion_with_config
from utils.chat_history_utils import (
    fetch_chat_history_entry,
    upsert_chat_history_entry,
    serialize_chat_history_entry,
    normalize_chat_history_payload,
    get_chat_history_active_branch_id,
    get_chat_history_branch,
    get_chat_history_messages,
    set_chat_history_active_branch,
    replace_chat_history_branch_messages,
    fork_chat_history_branch,
    generate_chat_message_id,
)
import uuid
import json
import re
from pathlib import Path
from datetime import datetime, UTC
from models import User, Character, Scene, ChatHistory
from utils.message_limit import can_send_user_message, increment_user_message_count
from utils.context_window import compact_conversation_messages, resolve_context_window_settings
from utils.usage_utils import normalize_usage
from utils.token_usage_ledger import apply_token_usage_with_wallet
from utils.token_cap import can_consume_tokens, get_token_cap_info, build_token_cap_reached_payload

router = APIRouter()


def _extract_context_summary_usage(context_info: dict | None) -> dict[str, int]:
    if not isinstance(context_info, dict):
        return normalize_usage(None)
    return normalize_usage(context_info.get("summary_usage"))

_KEYWORD_TOKEN_RE = re.compile(r"[A-Za-z0-9']+|[\u4e00-\u9fff]{2,}")
_COMMON_WORDS_FILES = (
    Path(__file__).resolve().parents[1] / "utils" / "common_words.txt",
    Path(__file__).resolve().parents[1] / "utils" / "common_words_zh.txt",
)
_DEFAULT_COMMON_WORDS = {
    "a", "an", "and", "are", "as", "at", "be", "by", "for", "from", "has", "he",
    "her", "his", "i", "in", "is", "it", "its", "me", "my", "of", "on", "or", "our",
    "she", "that", "the", "their", "them", "there", "they", "this", "to", "was", "we",
    "were", "will", "with", "you", "your",
}
MAX_PINNED_MEMORIES = 10


def _load_common_words() -> set[str]:
    loaded_words: set[str] = set()
    for file_path in _COMMON_WORDS_FILES:
        if not file_path.exists():
            continue

        with file_path.open("r", encoding="utf-8") as handle:
            for raw_line in handle:
                line = raw_line.strip().lower()
                if not line or line.startswith("#"):
                    continue
                loaded_words.add(line)

    return loaded_words or set(_DEFAULT_COMMON_WORDS)


_COMMON_WORDS = _load_common_words()


def _extract_latest_user_message(messages: list[dict] | None) -> str:
    if not isinstance(messages, list):
        return ""
    for message in reversed(messages):
        if not isinstance(message, dict):
            continue
        if message.get("role") != "user":
            continue
        content = message.get("content")
        if isinstance(content, str) and content.strip():
            return content.strip()
    return ""


def _extract_keywords(text: str, *, max_keywords: int = 24) -> list[str]:
    if not isinstance(text, str) or not text.strip():
        return []

    keywords: list[str] = []
    seen = set()
    for token in _KEYWORD_TOKEN_RE.findall(text):
        normalized = token.lower().strip("_'")
        if not normalized or normalized in seen:
            continue
        if normalized.isascii():
            if len(normalized) < 3 or normalized in _COMMON_WORDS or normalized.isdigit():
                continue
        else:
            if len(normalized) < 2:
                continue

        keywords.append(normalized)
        seen.add(normalized)
        if len(keywords) >= max_keywords:
            break
    return keywords


def _build_semantic_char_set(text: str) -> set[str]:
    chars: set[str] = set()
    for keyword in _extract_keywords(text):
        for char in keyword:
            if char.strip():
                chars.add(char)
    return chars


def _semantic_overlap_score(chunk_text: str, latest_user_message: str) -> int:
    chunk_chars = _build_semantic_char_set(chunk_text)
    if not chunk_chars:
        return 0
    message_chars = _build_semantic_char_set(latest_user_message)
    if not message_chars:
        return 0
    return len(chunk_chars & message_chars)


def select_long_description_chunks(
    long_description_chunks: list[dict] | None,
    latest_user_message: str,
    *,
    always_include: int = 2,
    max_keyword_matched: int = 2,
) -> list[str]:
    if not isinstance(long_description_chunks, list):
        return []

    normalized_chunks: list[str] = []
    for chunk in long_description_chunks:
        if not isinstance(chunk, dict):
            continue
        content = chunk.get("content")
        if isinstance(content, str) and content.strip():
            normalized_chunks.append(content.strip())

    if not normalized_chunks:
        return []

    selected = normalized_chunks[:always_include]
    if max_keyword_matched <= 0:
        return selected

    scored_candidates: list[tuple[int, int, str]] = []
    for index, chunk_text in enumerate(normalized_chunks[always_include:], start=always_include):
        score = _semantic_overlap_score(chunk_text, latest_user_message)
        if score <= 0:
            continue
        scored_candidates.append((score, index, chunk_text))

    scored_candidates.sort(key=lambda item: (-item[0], item[1]))
    for _, _, chunk_text in scored_candidates[:max_keyword_matched]:
        selected.append(chunk_text)

    return selected


def build_chunk_context_system_message(selected_chunks: list[str]) -> dict | None:
    if not selected_chunks:
        return None

    lines = [
        "[Priority Character Memory]",
        "Use the following memory chunks as high-priority character context for this turn.",
        "If there is any conflict, prefer these chunks over less specific lore.",
    ]
    lines.extend(f"{idx}. {chunk}" for idx, chunk in enumerate(selected_chunks, start=1))
    lines.append("[/Priority Character Memory]")
    return {
        "role": "system",
        "content": "\n".join(lines),
    }


def inject_chunk_context_message(messages: list[dict], context_message: dict | None) -> list[dict]:
    if not context_message:
        return messages
    if not isinstance(messages, list) or not messages:
        return [context_message]

    injected = list(messages)
    if injected[-1].get("role") == "user":
        injected.insert(len(injected) - 1, context_message)
    else:
        injected.append(context_message)
    return injected

def generate_chat_title(messages, existing_title=None):
    """Generate a title from the first user message if no title exists"""
    if existing_title:
        return existing_title
    user_messages = [m for m in messages if m.get("role") == "user"]
    if user_messages:
        first_msg = user_messages[0].get("content", "")
        return first_msg[:30] + ("..." if len(first_msg) > 30 else "")
    return "New Chat"


def parse_chat_config(chat_config):
    defaults = {
        "model": "deepseek-chat",
        "max_tokens": 250,
        "temperature": 1.3,
        "top_p": 0.9,
        "presence_penalty": 0.0,
        "frequency_penalty": 0.0,
    }

    if not isinstance(chat_config, dict):
        return defaults

    config = dict(defaults)
    allowed_models = {"deepseek-chat", "deepseek-reasoner"}
    model = chat_config.get("model")
    if isinstance(model, str) and model in allowed_models:
        config["model"] = model

    try:
        config["max_tokens"] = int(chat_config.get("max_tokens", defaults["max_tokens"]))
    except (TypeError, ValueError):
        config["max_tokens"] = defaults["max_tokens"]
    config["max_tokens"] = max(1, min(8192, config["max_tokens"]))

    def clamp_float(key, min_value, max_value):
        try:
            value = float(chat_config.get(key, defaults[key]))
        except (TypeError, ValueError):
            value = defaults[key]
        return max(min_value, min(max_value, value))

    config["temperature"] = clamp_float("temperature", 0.0, 2.0)
    config["top_p"] = clamp_float("top_p", 0.0, 1.0)
    config["presence_penalty"] = clamp_float("presence_penalty", -2.0, 2.0)
    config["frequency_penalty"] = clamp_float("frequency_penalty", -2.0, 2.0)

    return config


def default_chat_config():
    return {
        "model": "deepseek-chat",
        "max_tokens": 250,
        "temperature": 1.3,
        "top_p": 0.9,
        "presence_penalty": 0.0,
        "frequency_penalty": 0.0,
    }


def _normalize_message_content(content: str | None) -> str:
    if not isinstance(content, str):
        return ""
    return re.sub(r"\s+", " ", content).strip()


def _build_assistant_message(content: str, usage: dict[str, int]) -> dict:
    return {
        "role": "assistant",
        "content": content,
        "usage": usage,
        "message_id": generate_chat_message_id(),
        "is_pinned": False,
    }


def _persist_chat_history_turn(
    db_session: Session,
    *,
    current_user_id: str,
    chat_id: str,
    existing_entry: ChatHistory | None,
    character_id: int | None,
    scene_id: int | None,
    persona_id: int | None,
    full_messages: list[dict],
    reply: str,
    response_usage: dict[str, int],
    persisted_chat_config: dict,
    context_window_soft_limit: int,
    requested_branch_id: str | None,
    fork_from_message_id: str | None,
) -> ChatHistory:
    assistant_message = _build_assistant_message(reply, response_usage)
    updated_messages = full_messages + [assistant_message]

    existing_payload = normalize_chat_history_payload(existing_entry.messages if existing_entry else [])

    if fork_from_message_id:
        message_payload, _ = fork_chat_history_branch(
            existing_payload,
            source_branch_id=requested_branch_id or get_chat_history_active_branch_id(existing_payload),
            messages=updated_messages,
            parent_message_id=fork_from_message_id,
        )
    else:
        target_branch_id = requested_branch_id or get_chat_history_active_branch_id(existing_payload)
        existing_branch = get_chat_history_branch(existing_payload, target_branch_id)
        message_payload, _ = replace_chat_history_branch_messages(
            existing_payload,
            branch_id=existing_branch.get("branch_id") or target_branch_id,
            messages=updated_messages,
            parent_branch_id=existing_branch.get("parent_branch_id"),
            parent_message_id=existing_branch.get("parent_message_id"),
            label=existing_branch.get("label"),
            make_active=True,
        )

    character = db_session.query(Character).filter(Character.id == character_id).first() if character_id else None

    payload = {
        "character_id": character_id,
        "character_name": character.name if character else None,
        "character_picture": character.picture if character else None,
        "title": generate_chat_title(full_messages, existing_entry.title if existing_entry else None),
        "messages": message_payload,
        "chat_config": persisted_chat_config,
        "last_updated": datetime.now(UTC),
        "created_at": existing_entry.created_at if existing_entry else datetime.now(UTC),
    }
    if scene_id:
        payload["scene_id"] = scene_id
        scene = db_session.query(Scene).filter(Scene.id == scene_id).first()
        if scene:
            payload["scene_name"] = scene.name
            payload["scene_picture"] = scene.picture
    if persona_id:
        payload["persona_id"] = persona_id

    return upsert_chat_history_entry(
        db_session,
        user_id=current_user_id,
        chat_id=chat_id,
        payload=payload,
    )

@router.post("/api/chat")
async def chat(request: Request, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    try:
        data = await request.json()
    except ClientDisconnect:
        return Response(status_code=499)
    messages = data.get("messages")
    context_messages = data.get("context_messages")
    full_messages = data.get("full_messages")
    character_id = data.get("character_id")
    chat_id = data.get("chat_id")
    scene_id = data.get("scene_id")
    persona_id = data.get("persona_id")
    branch_id = data.get("branch_id")
    fork_from_message_id = data.get("fork_from_message_id")
    can_use_advanced_config = bool(current_user.is_pro)
    raw_chat_config = data.get("chat_config")
    chat_config = parse_chat_config(raw_chat_config) if can_use_advanced_config else default_chat_config()
    context_window_tier, context_window_soft_limit = resolve_context_window_settings(
        raw_chat_config,
        can_use_advanced_config=can_use_advanced_config,
        is_pro=bool(current_user.is_pro),
    )
    persisted_chat_config = {
        **chat_config,
        "context_window_tier": context_window_tier,
    }
    stream = data.get("stream", True)  # Default to streaming

    if not messages or not isinstance(messages, list):
        return JSONResponse(content={"error": "Invalid or missing messages"}, status_code=400)

    if not isinstance(full_messages, list) or not full_messages:
        full_messages = messages

    if not isinstance(context_messages, list) or not context_messages:
        context_messages = messages

    limit_check = can_send_user_message(current_user, full_messages)
    limit_info = limit_check.get("limit") or {}
    if limit_check["blocked"]:
        return JSONResponse(
            content={
                "error": "DAILY_MESSAGE_CAP_REACHED",
                "message": "You have reached your daily message limit. Upgrade to Pro for unlimited messages.",
                "limits": limit_info,
            },
            status_code=429,
        )

    token_check = can_consume_tokens(current_user, db)
    token_limit_info = token_check.get("limit") or {}
    if token_check["blocked"]:
        return JSONResponse(
            content=build_token_cap_reached_payload(token_limit_info),
            status_code=429,
        )

    prepared_messages, prepared_context_info = compact_conversation_messages(
        messages,
        soft_token_limit=context_window_soft_limit,
    )
    if context_messages == messages:
        context_window_info = prepared_context_info
    else:
        _, context_window_info = compact_conversation_messages(
            context_messages,
            soft_token_limit=context_window_soft_limit,
        )

    summary_usage = normalize_usage(None)
    prepared_summary_usage = _extract_context_summary_usage(prepared_context_info)
    summary_usage["prompt_tokens"] += prepared_summary_usage["prompt_tokens"]
    summary_usage["completion_tokens"] += prepared_summary_usage["completion_tokens"]
    summary_usage["total_tokens"] += prepared_summary_usage["total_tokens"]

    if context_window_info is not prepared_context_info:
        context_summary_usage = _extract_context_summary_usage(context_window_info)
        summary_usage["prompt_tokens"] += context_summary_usage["prompt_tokens"]
        summary_usage["completion_tokens"] += context_summary_usage["completion_tokens"]
        summary_usage["total_tokens"] += context_summary_usage["total_tokens"]

    if summary_usage["total_tokens"] > 0:
        summary_usage_result = apply_token_usage_with_wallet(
            db,
            user=current_user,
            usage=summary_usage,
            source="chat_context_summary",
            metadata={"chat_id": chat_id},
        )
        if not summary_usage_result.get("success"):
            return JSONResponse(
                content=build_token_cap_reached_payload(summary_usage_result.get("limit") or token_limit_info),
                status_code=429,
            )
        db.commit()
        token_limit_info = get_token_cap_info(current_user, db)
    if not prepared_messages:
        return JSONResponse(content={"error": "Invalid messages after normalization"}, status_code=400)

    # Get existing chat info if this is an existing chat
    existing_entry = None
    if chat_id:
        existing_entry = fetch_chat_history_entry(db, current_user.id, chat_id)
        if existing_entry and (not isinstance(branch_id, str) or not branch_id.strip()):
            branch_id = get_chat_history_active_branch_id(existing_entry.messages)
    if isinstance(branch_id, str):
        branch_id = branch_id.strip() or None
    else:
        branch_id = None

    if isinstance(fork_from_message_id, str):
        fork_from_message_id = fork_from_message_id.strip() or None
    else:
        fork_from_message_id = None

    # Generate chat_id upfront for new chats
    if not chat_id and character_id:
        chat_id = str(uuid.uuid4())

    character = None
    effective_character_id = character_id or (existing_entry.character_id if existing_entry else None)
    if effective_character_id:
        character = db.query(Character).filter(Character.id == effective_character_id).first()
        if not character:
            raise HTTPException(status_code=404, detail="Character not found")

        latest_user_message = _extract_latest_user_message(full_messages)
        selected_chunks = select_long_description_chunks(
            character.long_description_chunks,
            latest_user_message,
            always_include=2,
            max_keyword_matched=2,
        )
        chunk_context_message = build_chunk_context_system_message(selected_chunks)
        prepared_messages = inject_chunk_context_message(prepared_messages, chunk_context_message)

    if stream:
        # Return streaming response
        async def generate():
            accumulated_reply = ""
            current_token_limit_info = token_limit_info
            response_usage = {
                "prompt_tokens": 0,
                "completion_tokens": 0,
                "total_tokens": 0,
            }
            try:
                print(
                    "[chat] prepared_messages:",
                    json.dumps(prepared_messages, ensure_ascii=False, indent=2),
                    flush=True,
                )
                for stream_event in stream_chat_completion_with_config(
                    prepared_messages,
                    model=chat_config["model"],
                    max_tokens=chat_config["max_tokens"],
                    temperature=chat_config["temperature"],
                    top_p=chat_config["top_p"],
                    presence_penalty=chat_config["presence_penalty"],
                    frequency_penalty=chat_config["frequency_penalty"],
                ):
                    event_type = (stream_event or {}).get("type")
                    if event_type == "usage":
                        response_usage = normalize_usage((stream_event or {}).get("usage"))
                        continue

                    chunk = (stream_event or {}).get("content")
                    if not isinstance(chunk, str) or not chunk:
                        continue

                    accumulated_reply += chunk
                    # Send each chunk as SSE
                    yield f"data: {json.dumps({'chunk': chunk})}\n\n"
                
                # After streaming completes, save to database
                if character_id:
                    # Create new DB session for generator context
                    from database import SessionLocal
                    db_session = SessionLocal()
                    try:
                        stream_user = db_session.query(User).filter(User.id == current_user.id).first()
                        if not stream_user:
                            raise HTTPException(status_code=404, detail="User not found")
                        limit_info = increment_user_message_count(
                            stream_user,
                            db_session,
                            limit_check["is_user_request"],
                        ) or (limit_check.get("limit") or {})
                        usage_result = apply_token_usage_with_wallet(
                            db_session,
                            user=stream_user,
                            usage=response_usage,
                            source="chat_stream",
                            source_order_no=chat_id,
                            metadata={"stream": True, "character_id": character_id},
                        )
                        if not usage_result.get("success"):
                            db_session.rollback()
                            yield f"data: {json.dumps({'error': 'TOKEN_CAP_REACHED', 'token_limits': usage_result.get('limit') or {}})}\n\n"
                            return
                        entry = _persist_chat_history_turn(
                            db_session,
                            current_user_id=current_user.id,
                            chat_id=chat_id,
                            existing_entry=existing_entry,
                            character_id=character_id,
                            scene_id=scene_id,
                            persona_id=persona_id,
                            full_messages=full_messages,
                            reply=accumulated_reply,
                            response_usage=response_usage,
                            persisted_chat_config=persisted_chat_config,
                            context_window_soft_limit=context_window_soft_limit,
                            requested_branch_id=branch_id,
                            fork_from_message_id=fork_from_message_id,
                        )
                        serialized_entry = serialize_chat_history_entry(entry)
                        current_token_limit_info = get_token_cap_info(stream_user, db_session)
                    finally:
                        db_session.close()
                else:
                    limit_info = increment_user_message_count(
                        current_user,
                        db,
                        limit_check["is_user_request"],
                    ) or (limit_check.get("limit") or {})
                    usage_result = apply_token_usage_with_wallet(
                        db,
                        user=current_user,
                        usage=response_usage,
                        source="chat_stream",
                        source_order_no=chat_id,
                        metadata={"stream": True, "character_id": character_id},
                    )
                    if not usage_result.get("success"):
                        db.rollback()
                        yield f"data: {json.dumps({'error': 'TOKEN_CAP_REACHED', 'token_limits': usage_result.get('limit') or {}})}\n\n"
                        return
                    db.commit()
                    current_token_limit_info = get_token_cap_info(current_user, db)

                # Send final metadata
                done_payload = {
                    'done': True,
                    'chat_id': chat_id,
                    'chat_title': generate_chat_title(full_messages, existing_entry.title if existing_entry else None),
                    'limits': limit_info,
                    'token_limits': current_token_limit_info,
                    'context_window': {**context_window_info, 'message_count': len(context_messages), 'selected_tier': context_window_tier},
                }
                if character_id:
                    done_payload['chat_entry'] = serialized_entry
                    done_payload['branch_id'] = serialized_entry.get('active_branch_id')
                yield f"data: {json.dumps(done_payload)}\n\n"
            
            except ClientDisconnect:
                return
            except Exception as e:
                yield f"data: {json.dumps({'error': str(e)})}\n\n"

        return StreamingResponse(generate(), media_type="text/event-stream")
    
    else:
        # Non-streaming fallback (original logic)
        try:
            print(
                "[chat] prepared_messages:",
                json.dumps(prepared_messages, ensure_ascii=False, indent=2),
                flush=True,
            )
            response = client.chat.completions.create(
                model=chat_config["model"],
                messages=prepared_messages,
                max_tokens=chat_config["max_tokens"],
                temperature=chat_config["temperature"],
                top_p=chat_config["top_p"],
                presence_penalty=chat_config["presence_penalty"],
                frequency_penalty=chat_config["frequency_penalty"],
            )
            reply = response.choices[0].message.content.strip()
            response_usage = normalize_usage(getattr(response, "usage", None))
        except Exception:
            return JSONResponse(content={"error": "Server busy, please try again later."}, status_code=503)

        limit_info = increment_user_message_count(
            current_user,
            db,
            limit_check["is_user_request"],
        ) or (limit_check.get("limit") or {})
        usage_result = apply_token_usage_with_wallet(
            db,
            user=current_user,
            usage=response_usage,
            source="chat_non_stream",
            source_order_no=chat_id,
            metadata={"stream": False, "character_id": character_id},
        )
        if not usage_result.get("success"):
            db.rollback()
            return JSONResponse(
                content=build_token_cap_reached_payload(usage_result.get("limit") or token_limit_info),
                status_code=429,
            )
        db.commit()
        token_limit_info = get_token_cap_info(current_user, db)

        serialized_entry = None

        # Update chat history
        if character_id:
            entry = _persist_chat_history_turn(
                db,
                current_user_id=current_user.id,
                chat_id=chat_id,
                existing_entry=existing_entry,
                character_id=character_id,
                scene_id=scene_id,
                persona_id=persona_id,
                full_messages=full_messages,
                reply=reply,
                response_usage=response_usage,
                persisted_chat_config=persisted_chat_config,
                context_window_soft_limit=context_window_soft_limit,
                requested_branch_id=branch_id,
                fork_from_message_id=fork_from_message_id,
            )
            serialized_entry = serialize_chat_history_entry(entry)

            return {
                "response": reply,
                "chat_id": entry.chat_id,
                "chat_title": entry.title,
                "branch_id": serialized_entry.get("active_branch_id"),
                "chat_entry": serialized_entry,
                "limits": limit_info,
                "token_limits": token_limit_info,
                "context_window": {
                    **context_window_info,
                    "message_count": len(context_messages),
                    "selected_tier": context_window_tier,
                },
            }

        return {
            "response": reply,
            "limits": limit_info,
            "token_limits": token_limit_info,
            "context_window": {
                **context_window_info,
                "message_count": len(context_messages),
                "selected_tier": context_window_tier,
            },
        }

@router.post("/api/chat/rename")
async def rename_chat(request: Request, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    try:
        data = await request.json()
    except ClientDisconnect:
        return Response(status_code=499)
    chat_id = data.get("chat_id")
    new_title = data.get("new_title")

    if not chat_id or not new_title:
        return JSONResponse(content={"error": "Missing chat_id or new_title"}, status_code=400)

    entry = fetch_chat_history_entry(db, current_user.id, chat_id)
    if not entry:
        return JSONResponse(content={"error": "Chat not found"}, status_code=404)

    entry.title = new_title
    entry.last_updated = datetime.now(UTC)
    db.commit()
    return {"status": "success"}

@router.post("/api/chat/delete")
async def delete_chat(request: Request, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    try:
        data = await request.json()
    except ClientDisconnect:
        return Response(status_code=499)
    chat_id = data.get("chat_id")

    if not chat_id:
        return JSONResponse(content={"error": "Missing chat_id"}, status_code=400)

    entry = fetch_chat_history_entry(db, current_user.id, chat_id)
    if not entry:
        return JSONResponse(content={"error": "Chat not found"}, status_code=404)

    db.delete(entry)
    db.commit()
    return {"status": "success"}


@router.post("/api/chat/pin")
async def pin_chat(request: Request, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    try:
        data = await request.json()
    except ClientDisconnect:
        return Response(status_code=499)

    chat_id = data.get("chat_id")
    is_pinned = bool(data.get("is_pinned"))

    if not isinstance(chat_id, str) or not chat_id.strip():
        return JSONResponse(content={"error": "Missing chat_id"}, status_code=400)

    entry = fetch_chat_history_entry(db, current_user.id, chat_id)
    if not entry:
        return JSONResponse(content={"error": "Chat not found"}, status_code=404)

    entry.is_pinned = is_pinned
    db.commit()

    return {
        "status": "success",
        "chat_id": chat_id,
        "is_pinned": bool(entry.is_pinned),
    }


@router.post("/api/chat/select-branch")
async def select_chat_branch(request: Request, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    try:
        data = await request.json()
    except ClientDisconnect:
        return Response(status_code=499)

    chat_id = data.get("chat_id")
    branch_id = data.get("branch_id")

    if not isinstance(chat_id, str) or not chat_id.strip():
        return JSONResponse(content={"error": "Missing chat_id"}, status_code=400)

    if not isinstance(branch_id, str) or not branch_id.strip():
        return JSONResponse(content={"error": "Missing branch_id"}, status_code=400)

    entry = fetch_chat_history_entry(db, current_user.id, chat_id)
    if not entry:
        return JSONResponse(content={"error": "Chat not found"}, status_code=404)

    entry.messages = set_chat_history_active_branch(entry.messages, branch_id.strip())
    entry.last_updated = datetime.now(UTC)
    db.commit()
    db.refresh(entry)

    return {
        "status": "success",
        "chat": serialize_chat_history_entry(entry),
    }


@router.post("/api/chat/pin-message")
async def pin_chat_message(request: Request, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    try:
        data = await request.json()
    except ClientDisconnect:
        return Response(status_code=499)

    chat_id = data.get("chat_id")
    message_id = data.get("message_id")
    is_pinned = bool(data.get("is_pinned"))
    branch_id = data.get("branch_id")
    message_role = str(data.get("message_role") or "").strip().lower()
    message_content = _normalize_message_content(data.get("message_content"))

    if not isinstance(chat_id, str) or not chat_id.strip():
        return JSONResponse(content={"error": "Missing chat_id"}, status_code=400)

    if not isinstance(message_id, str) or not message_id.strip():
        return JSONResponse(content={"error": "Missing message_id"}, status_code=400)

    entry = fetch_chat_history_entry(db, current_user.id, chat_id)
    if not entry:
        return JSONResponse(content={"error": "Chat not found"}, status_code=404)

    if not isinstance(branch_id, str) or not branch_id.strip():
        branch_id = get_chat_history_active_branch_id(entry.messages)
    else:
        branch_id = branch_id.strip()

    messages = get_chat_history_messages(entry.messages, branch_id)
    target_message = None

    for message in messages:
        if not isinstance(message, dict):
            continue
        existing_message_id = message.get("message_id")
        if isinstance(existing_message_id, str) and existing_message_id == message_id:
            target_message = message
            break

    if target_message is None and message_role in {"user", "assistant"} and message_content:
        for message in messages:
            if not isinstance(message, dict):
                continue
            role = str(message.get("role") or "").strip().lower()
            if role != message_role:
                continue
            content = _normalize_message_content(message.get("content"))
            if content != message_content:
                continue
            target_message = message
            break

    if target_message is None:
        return JSONResponse(content={"error": "Message not found in chat"}, status_code=404)

    was_pinned = bool(target_message.get("is_pinned"))
    if is_pinned and not was_pinned:
        pinned_count_before = 0
        for message in messages:
            if not isinstance(message, dict):
                continue
            if str(message.get("role") or "").strip().lower() not in {"user", "assistant"}:
                continue
            if bool(message.get("is_pinned")):
                pinned_count_before += 1

        if pinned_count_before >= MAX_PINNED_MEMORIES:
            return JSONResponse(
                content={
                    "error": "MEMORY_PIN_LIMIT_REACHED",
                    "message": f"You can pin up to {MAX_PINNED_MEMORIES} memories per chat.",
                    "max_pinned_memories": MAX_PINNED_MEMORIES,
                },
                status_code=400,
            )

    target_message["message_id"] = message_id
    target_message["is_pinned"] = is_pinned
    updated_payload, _ = replace_chat_history_branch_messages(
        entry.messages,
        branch_id=branch_id,
        messages=messages,
        parent_branch_id=get_chat_history_branch(entry.messages, branch_id).get("parent_branch_id"),
        parent_message_id=get_chat_history_branch(entry.messages, branch_id).get("parent_message_id"),
        label=get_chat_history_branch(entry.messages, branch_id).get("label"),
        make_active=True,
    )
    entry.messages = updated_payload
    entry.last_updated = datetime.now(UTC)

    db.commit()

    pinned_count = 0
    for message in messages:
        if not isinstance(message, dict):
            continue
        if str(message.get("role") or "").strip().lower() not in {"user", "assistant"}:
            continue
        if bool(message.get("is_pinned")):
            pinned_count += 1

    return {
        "status": "success",
        "chat_id": chat_id,
        "message_id": message_id,
        "is_pinned": is_pinned,
        "branch_id": branch_id,
        "pinned_messages_count": pinned_count,
    }
