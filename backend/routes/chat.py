from fastapi import APIRouter, Request, Depends, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.responses import JSONResponse, StreamingResponse, Response
from sqlalchemy.orm import Session
from starlette.requests import ClientDisconnect
from database import get_db, SessionLocal
from model_configs import ALLOWED_MODEL_IDS, get_model, derive_per_turn_context_budget
from utils.session import get_current_user, verify_session_token
from utils.llm_client import stream_chat_completion_with_config
from utils.asr_utils import ASR_MODEL, ASR_SAMPLE_RATE, DASHSCOPE_API_KEY
from utils.chat_history_utils import (
    DEFAULT_BRANCH_ID,
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
    fetch_user_chat_history_paginated,
    fetch_user_chat_history_grouped_by_character,
    delete_user_chat_history_by_character,
    delete_unavailable_chat_history,
    set_chat_history_active_branch_for_entry,
    toggle_chat_history_message_pin,
)
import uuid
import json
import re
import logging
from datetime import datetime, UTC
from models import User, Character, Scene, ChatHistory
from utils.message_limit import can_send_user_message, increment_user_message_count
from utils.context_window import compact_conversation_messages, DEFAULT_SOFT_TOKEN_LIMIT, SUMMARY_PREFIX, estimate_guard_input
from utils.usage_utils import normalize_usage, usage_to_credits
from utils.credit_usage_ledger import apply_credit_usage_with_wallet, apply_fixed_credit_usage_with_wallet
from utils.credit_cap import can_consume_credits, get_credit_cap_info, build_credit_cap_reached_payload
from utils.model_rate_limiter import rate_limiter
from utils.upstream_bucket import acquire_upstream
from utils.user_utils import is_chat_banned

logger = logging.getLogger(__name__)

router = APIRouter()


def _extract_context_summary_usage(context_info: dict | None) -> dict[str, int]:
    if not isinstance(context_info, dict):
        return normalize_usage(None)
    return normalize_usage(context_info.get("summary_usage"))

MAX_PINNED_MEMORIES = 10

def generate_chat_title(messages, existing_title=None):
    """Generate a title from the first user message, or first assistant message as fallback"""
    if existing_title:
        return existing_title
    for role in ("user", "assistant"):
        for m in messages:
            if m.get("role") == role:
                content = m.get("content", "")
                return content[:30] + ("..." if len(content) > 30 else "")
    return "New Chat"


def parse_chat_config(chat_config):
    defaults = {
        "model": "deepseek-v4-flash",
        "max_tokens": 4000,
        "temperature": 1.3,
        "top_p": 0.9,
        "presence_penalty": 0.0,
        "frequency_penalty": 0.0,
    }

    if not isinstance(chat_config, dict):
        return defaults

    config = dict(defaults)
    model = chat_config.get("model")
    if isinstance(model, str) and model in ALLOWED_MODEL_IDS:
        config["model"] = model

    try:
        config["max_tokens"] = int(chat_config.get("max_tokens", defaults["max_tokens"]))
    except (TypeError, ValueError):
        config["max_tokens"] = defaults["max_tokens"]


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
        "model": "deepseek-v4-flash",
        "max_tokens": 4000,
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
    context_window_soft_limit: int,
    context_summary: dict | None = None,
    requested_branch_id: str | None,
    fork_from_message_id: str | None,
    base_message_count: int | None = None,
) -> ChatHistory:
    assistant_message = _build_assistant_message(reply, response_usage)

    # Once rolling-summary state is persisted, drop any legacy inline
    # "Summary of previous conversation:" system messages from the raw stored
    # messages so the summary text has exactly one source of truth (the
    # chat_histories.context_summary column).
    if context_summary:
        full_messages = [
            message
            for message in full_messages
            if not (
                message.get("role") == "system"
                and isinstance(message.get("content"), str)
                and message["content"].lstrip().startswith(SUMMARY_PREFIX)
            )
        ]

    # Re-read the freshest persisted entry within THIS session. A concurrent
    # turn may have already advanced the branch; using the request-time
    # snapshot would let this stale turn roll it back.
    if chat_id:
        existing_entry = fetch_chat_history_entry(db_session, current_user_id, chat_id)

    existing_payload = normalize_chat_history_payload(existing_entry.messages if existing_entry else [])
    if existing_entry:
        serialized_existing = serialize_chat_history_entry(existing_entry)
        existing_payload = normalize_chat_history_payload(
            {
                "active_branch_id": serialized_existing.get("active_branch_id"),
                "branches": serialized_existing.get("branches") or [],
            }
        )

    # Hardening against overlapping turns: if the client's snapshot is behind
    # the currently persisted branch, this turn is stale and must not overwrite
    # history that already advanced past it. Reject it and return the freshest
    # entry so the client can reconcile to the latest state.
    if not fork_from_message_id:
        target_branch_id = requested_branch_id or get_chat_history_active_branch_id(existing_payload)
        existing_branch = get_chat_history_branch(existing_payload, target_branch_id)
        current_message_count = len(existing_branch.get("messages") or [])
        if base_message_count is not None and current_message_count > base_message_count:
            logger.warning(
                "Stale chat turn rejected | user=%s | chat=%s | branch=%s | current_messages=%d | base_message_count=%d",
                current_user_id,
                chat_id,
                target_branch_id,
                current_message_count,
                base_message_count,
            )
            return existing_entry

    updated_messages = full_messages + [assistant_message]

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
        "title": generate_chat_title(updated_messages, existing_entry.title if existing_entry else None),
        "messages": message_payload,
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

    if context_summary:
        payload["context_summary"] = context_summary

    return upsert_chat_history_entry(
        db_session,
        user_id=current_user_id,
        chat_id=chat_id,
        payload=payload,
    )

@router.websocket("/api/chat/voice-to-text/stream")
async def voice_to_text_stream(websocket: WebSocket):
    """Receive 16 kHz mono PCM frames and emit interim ASR transcripts."""
    import asyncio
    from dashscope.audio.asr import Recognition, RecognitionCallback, RecognitionResult

    await websocket.accept()
    db = SessionLocal()
    recognition = None
    loop = asyncio.get_running_loop()
    events = asyncio.Queue()
    audio_bytes = 0
    user = None

    class Callback(RecognitionCallback):
        def on_event(self, result):
            sentence = result.get_sentence()
            if isinstance(sentence, list):
                sentence = sentence[-1] if sentence else {}
            if isinstance(sentence, dict) and sentence.get("text"):
                loop.call_soon_threadsafe(events.put_nowait, {
                    "type": "transcript",
                    "text": sentence["text"],
                    "is_final": RecognitionResult.is_sentence_end(sentence),
                })

        def on_error(self, result):
            loop.call_soon_threadsafe(events.put_nowait, {
                "type": "error",
                "message": result.message or "Voice recognition failed",
            })

        def on_complete(self):
            loop.call_soon_threadsafe(events.put_nowait, {"type": "complete"})

    try:
        auth_message = await websocket.receive_json()
        user_id = verify_session_token(auth_message.get("token"))
        user = db.query(User).filter(User.id == user_id).first() if user_id else None
        if not user:
            await websocket.send_json({"type": "error", "message": "Invalid or missing session token"})
            return
        if not DASHSCOPE_API_KEY:
            await websocket.send_json({"type": "error", "message": "DASHSCOPE_API_KEY is not configured"})
            return

        recognition = Recognition(
            model=ASR_MODEL,
            format="pcm",
            sample_rate=ASR_SAMPLE_RATE,
            language_hints=["zh", "en"],
            callback=Callback(),
        )
        recognition.start()
        await websocket.send_json({"type": "ready"})

        async def send_events():
            while True:
                event = await events.get()
                await websocket.send_json(event)
                if event["type"] in {"complete", "error"}:
                    break

        event_task = asyncio.create_task(send_events())
        try:
            while True:
                message = await websocket.receive()
                if message.get("bytes") is not None:
                    frame = message["bytes"]
                    audio_bytes += len(frame)
                    recognition.send_audio_frame(frame)
                elif message.get("text"):
                    command = json.loads(message["text"])
                    if command.get("type") == "stop":
                        recognition.stop()
                        break
        finally:
            if recognition and getattr(recognition, "_running", False):
                recognition.stop()
            await event_task

        duration_seconds = audio_bytes / (ASR_SAMPLE_RATE * 2)
        if duration_seconds > 0:
            credit_amount = round(duration_seconds * 0.24, 6)
            usage_result = apply_fixed_credit_usage_with_wallet(
                db,
                user=user,
                credit_amount=credit_amount,
                source="voice_to_text",
                idempotency_key=f"voice_to_text:{uuid.uuid4()}",
                metadata={"duration_seconds": round(duration_seconds, 3), "model": ASR_MODEL},
            )
            if not usage_result.get("success"):
                await websocket.send_json({"type": "error", "message": "Insufficient credits for voice recognition"})
                db.rollback()
            else:
                db.commit()
                await websocket.send_json({"type": "charged", "credit_amount": credit_amount})
    except WebSocketDisconnect:
        if recognition and getattr(recognition, "_running", False):
            recognition.stop()
        db.rollback()
    except Exception as exc:
        logger.exception("Live voice-to-text error")
        db.rollback()
        try:
            await websocket.send_json({"type": "error", "message": str(exc)})
        except Exception:
            pass
    finally:
        db.close()

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
    raw_base_message_count = data.get("base_message_count")
    base_message_count = None
    if isinstance(raw_base_message_count, int) and raw_base_message_count >= 0:
        base_message_count = raw_base_message_count
    elif isinstance(raw_base_message_count, str) and raw_base_message_count.strip().isdigit():
        base_message_count = int(raw_base_message_count.strip())
    can_use_advanced_config = bool(current_user.is_pro)
    raw_chat_config = data.get("chat_config")
    chat_config = parse_chat_config(raw_chat_config)
    # The model id is always accepted from the user (the per-turn context
    # budget below is derived from that model's config, never user-picked).
    # Sampling params (temperature, top_p, max_tokens, penalties) are gated for Pro users.
    if not can_use_advanced_config:
        default_cfg = default_chat_config()
        chat_config["temperature"] = default_cfg["temperature"]
        chat_config["top_p"] = default_cfg["top_p"]
        chat_config["max_tokens"] = default_cfg["max_tokens"]
        chat_config["presence_penalty"] = default_cfg["presence_penalty"]
        chat_config["frequency_penalty"] = default_cfg["frequency_penalty"]
    # The model context window is shared between the prompt and this turn's
    # completion, so reserve the requested output room before comparing input
    # size against the window. Models with an explicit input cap (e.g.
    # qwen3.7-flash: 1M advertised context but a 32k real input limit) must
    # never be budgeted from the raw context_length — the compaction trigger
    # would sit beyond the provider's real cap and never fire. The math lives
    # in model_configs.derive_per_turn_context_budget (unit-tested there).
    context_window_soft_limit = DEFAULT_SOFT_TOKEN_LIMIT
    provider_input_cap: int | None = None
    model_config_entry = get_model(chat_config.get("model"))
    if model_config_entry is not None:
        requested_max_tokens = int(chat_config["max_tokens"])
        context_budget = derive_per_turn_context_budget(
            model_config_entry, requested_max_tokens=requested_max_tokens
        )
        clamped_max_tokens = int(context_budget["clamped_max_tokens"])
        if clamped_max_tokens != requested_max_tokens:
            logger.info(
                "Clamping max_tokens %d -> %d for model %s (model output cap)",
                requested_max_tokens,
                clamped_max_tokens,
                chat_config["model"],
            )
        chat_config["max_tokens"] = clamped_max_tokens
        context_window_soft_limit = int(context_budget["soft_token_limit"])
        provider_input_cap = int(context_budget["provider_input_cap"])

    if not messages or not isinstance(messages, list):
        return JSONResponse(content={"error": "Invalid or missing messages"}, status_code=400)

    if not isinstance(full_messages, list) or not full_messages:
        full_messages = messages

    if not isinstance(context_messages, list) or not context_messages:
        context_messages = messages

    if is_chat_banned(current_user):
        ban_until = getattr(current_user, "ban_until", None)
        return JSONResponse(
            content={
                "error": "ACCOUNT_BANNED",
                "ban_type": "full_ban",
                "ban_until": ban_until.isoformat() if ban_until else None,
            },
            status_code=403,
        )

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

    credit_check = can_consume_credits(current_user, db)
    credit_limit_info = credit_check.get("limit") or {}
    logger.info(
        "💳 Credit check for user=%s | blocked=%s | consume_from_wallet=%s | cap_scope=%s | broke=%s | daily_used=%.2f | monthly_used=%.2f | cap=%.2f",
        current_user.id,
        credit_check["blocked"],
        credit_check.get("consume_from_wallet", False),
        credit_limit_info.get("cap_scope", "n/a"),
        credit_limit_info.get("broke", False),
        float(credit_limit_info.get("daily_credit_usage", 0)),
        float(credit_limit_info.get("monthly_credit_usage", 0)),
        float(credit_limit_info.get("credit_cap", 0)),
    )
    if credit_check["blocked"]:
        return JSONResponse(
            content=build_credit_cap_reached_payload(credit_limit_info),
            status_code=429,
        )

    # --- Model API rate limit (per‑user, Redis‑backed sliding window) ---
    rate_limit_result = await rate_limiter.check(
        current_user.id,
        is_pro=bool(current_user.is_pro),
    )
    if not rate_limit_result["allowed"]:
        return JSONResponse(
            content={
                "error": "RATE_LIMIT_EXCEEDED",
                "message": (
                    "You are sending requests too quickly. "
                    "Please wait a moment before trying again."
                ),
                "rate_limits": {
                    "tier": rate_limit_result["tier"],
                    "limit_rpm": rate_limit_result["limit"],
                    "remaining": rate_limit_result["remaining"],
                    "reset_seconds": rate_limit_result["reset_seconds"],
                },
            },
            status_code=429,
            headers={"Retry-After": str(max(1, rate_limit_result["reset_seconds"]))},
        )

    # Resolve the persisted entry and the active branch BEFORE compacting: the
    # per-branch rolling-summary cursor stored on the entry decides which raw
    # messages are already folded into the summary and must be dropped here.
    existing_entry = None
    if chat_id:
        existing_entry = fetch_chat_history_entry(db, current_user.id, chat_id)
        if existing_entry and (not isinstance(branch_id, str) or not branch_id.strip()):
            branch_id = serialize_chat_history_entry(existing_entry).get("active_branch_id")
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

    summary_state = None
    if existing_entry is not None and existing_entry.context_summary:
        summary_state = existing_entry.context_summary
    summary_branch_id = branch_id or DEFAULT_BRANCH_ID

    prepared_messages, prepared_context_info, state_update = await compact_conversation_messages(
        messages,
        soft_token_limit=context_window_soft_limit,
        summary_state=summary_state,
        branch_id=summary_branch_id,
    )
    context_window_info = prepared_context_info
    if context_messages != messages:
        _, context_window_info, _ = await compact_conversation_messages(
            context_messages,
            soft_token_limit=context_window_soft_limit,
            summary_state=summary_state,
            branch_id=summary_branch_id,
            measure_only=True,
        )

    # --- Fail-closed: never ship a request the provider cannot accept. ------
    # If compaction could not bring the request under the window (summary API
    # failure, fully pinned history, edited history), degrade gracefully
    # instead of silently sending the oversized prompt. Rungs, in order:
    #   1. shrink this turn's max_tokens to whatever room is actually left in
    #      the context window;
    #   2. if the input alone would exceed the provider's cap, try ONE
    #      emergency compaction pass (fold everything except the last turns,
    #      ignoring pinning) before refusing with a hard error — for a
    #      roleplay product a mid-scene 400 must stay a last resort.
    context_turn_metadata: dict[str, object] = {}
    emergency_info: dict | None = None
    pre_emergency_info: dict | None = None
    if provider_input_cap is not None and model_config_entry is not None:
        guard_input = estimate_guard_input(prepared_context_info, state_update)
        if guard_input >= provider_input_cap:
            logger.warning(
                "Context overflow, attempting emergency compaction | user=%s | chat=%s | model=%s | guard_input=%d | input_cap=%d",
                current_user.id,
                chat_id or "none",
                chat_config["model"],
                guard_input,
                provider_input_cap,
            )
            emergency_messages, emergency_info, emergency_update = await compact_conversation_messages(
                messages,
                soft_token_limit=context_window_soft_limit,
                recent_message_count=2,
                summary_state=summary_state,
                branch_id=summary_branch_id,
                force_compact=True,
            )
            emergency_guard = estimate_guard_input(emergency_info, emergency_update)
            if emergency_guard >= provider_input_cap:
                logger.warning(
                    "Context overflow refused | user=%s | chat=%s | model=%s | guard_input=%d | input_cap=%d | after emergency compaction",
                    current_user.id,
                    chat_id or "none",
                    chat_config["model"],
                    emergency_guard,
                    provider_input_cap,
                )
                return JSONResponse(
                    content={
                        "error": "CONTEXT_WINDOW_EXCEEDED",
                        "message": (
                            f"The conversation is too long for {chat_config['model']} even after "
                            "summarization. Start a new chat, trim older messages, or unpin "
                            "pinned messages and try again."
                        ),
                        "context_window": {
                            "input_tokens": emergency_guard,
                            "input_cap": provider_input_cap,
                        },
                    },
                    status_code=400,
                )
            pre_emergency_info = prepared_context_info
            prepared_messages = emergency_messages
            prepared_context_info = emergency_info
            state_update = emergency_update
            guard_input = emergency_guard
            context_turn_metadata["emergency_compaction"] = True
            logger.info(
                "Emergency compaction succeeded | user=%s | chat=%s | model=%s | guard_input=%d | input_cap=%d",
                current_user.id,
                chat_id or "none",
                chat_config["model"],
                guard_input,
                provider_input_cap,
            )

        room_for_output = int(model_config_entry.context_length) - guard_input
        context_turn_metadata["input_cap"] = provider_input_cap
        context_turn_metadata["guard_input"] = guard_input
        if int(chat_config["max_tokens"]) > room_for_output:
            previous_max_tokens = int(chat_config["max_tokens"])
            chat_config["max_tokens"] = max(1, room_for_output)
            context_turn_metadata["max_tokens_clamped"] = True
            context_turn_metadata["max_tokens_before"] = previous_max_tokens
            context_turn_metadata["max_tokens_after"] = int(chat_config["max_tokens"])
            logger.warning(
                "Shrinking max_tokens %d -> %d | user=%s | chat=%s | model=%s | guard_input=%d | context=%d",
                previous_max_tokens,
                chat_config["max_tokens"],
                current_user.id,
                chat_id or "none",
                chat_config["model"],
                guard_input,
                int(model_config_entry.context_length),
            )
        else:
            context_turn_metadata["max_tokens_clamped"] = False

    # Only this branch's update travels to the persist step; upsert merges it
    # branch-wise into whatever state the freshest entry already holds.
    merged_context_summary = None
    if state_update:
        merged_context_summary = {summary_branch_id: state_update}

    summary_usage = normalize_usage(None)
    # Both the pre-emergency compaction and the emergency pass may have billed
    # summary calls; collect usage from every distinct info dict exactly once.
    summary_usage_sources = [prepared_context_info]
    if pre_emergency_info is not None and pre_emergency_info is not prepared_context_info:
        summary_usage_sources.append(pre_emergency_info)
    if context_window_info is not prepared_context_info and (
        pre_emergency_info is None or context_window_info is not pre_emergency_info
    ):
        summary_usage_sources.append(context_window_info)
    for context_info_source in summary_usage_sources:
        source_usage = _extract_context_summary_usage(context_info_source)
        summary_usage["prompt_tokens"] += source_usage["prompt_tokens"]
        summary_usage["completion_tokens"] += source_usage["completion_tokens"]
        summary_usage["total_tokens"] += source_usage["total_tokens"]

    if summary_usage["total_tokens"] > 0:
        summary_credit_amount = usage_to_credits(summary_usage, "deepseek-v4-flash")
        logger.info(
            "📝 Summary credit | user=%s | chat=%s | prompt_tokens=%d | completion_tokens=%d | total_tokens=%d | credit=%.4f",
            current_user.id,
            chat_id or "none",
            summary_usage["prompt_tokens"],
            summary_usage["completion_tokens"],
            summary_usage["total_tokens"],
            summary_credit_amount,
        )
        summary_usage_result = apply_credit_usage_with_wallet(
            db,
            user=current_user,
            usage=summary_usage,
            source="chat_context_summary",
            metadata={"chat_id": chat_id},
            credit_amount=summary_credit_amount,
        )
        if not summary_usage_result.get("success"):
            return JSONResponse(
                content=build_credit_cap_reached_payload(summary_usage_result.get("limit") or credit_limit_info),
                status_code=429,
            )
        db.commit()
        credit_limit_info = get_credit_cap_info(current_user, db)
        logger.info(
            "✅ Summary credit applied | user=%s | consumed_from_wallet=%s",
            current_user.id,
            summary_usage_result.get("consumed_from_wallet", False),
        )
    if not prepared_messages:
        return JSONResponse(content={"error": "Invalid messages after normalization"}, status_code=400)

    character = None
    effective_character_id = character_id or (existing_entry.character_id if existing_entry else None)
    if effective_character_id:
        character = db.query(Character).filter(Character.id == effective_character_id).first()
        if not character:
            raise HTTPException(status_code=404, detail="Character not found")

    # Return streaming response
    async def generate():
        accumulated_reply = ""
        current_credit_limit_info = credit_limit_info
        response_usage = {
            "prompt_tokens": 0,
            "completion_tokens": 0,
            "total_tokens": 0,
        }

        # --- upstream bucket (per-model RPM pacing) ---
        if not await acquire_upstream(chat_config["model"], is_pro=bool(current_user.is_pro)):
            yield f"data: {json.dumps({'error': 'UPSTREAM_BUSY', 'message': 'The model provider is currently at capacity. Please try again shortly.'})}\n\n"
            return

        try:
            async for stream_event in stream_chat_completion_with_config(
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
            stream_credit_amount = usage_to_credits(response_usage, chat_config["model"])
            logger.info(
                "💬 Stream credit | user=%s | chat=%s | model=%s | prompt_tokens=%d | completion_tokens=%d | total_tokens=%d | credit=%.4f | has_character=%s",
                current_user.id,
                chat_id or "none",
                chat_config["model"],
                response_usage["prompt_tokens"],
                response_usage["completion_tokens"],
                response_usage["total_tokens"],
                stream_credit_amount,
                bool(character_id),
            )
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
                    usage_result = apply_credit_usage_with_wallet(
                        db_session,
                        user=stream_user,
                        usage=response_usage,
                        source="chat_stream",
                        source_order_no=chat_id,
                        metadata={"stream": True, "character_id": character_id},
                        credit_amount=stream_credit_amount,
                    )
                    if not usage_result.get("success"):
                        db_session.rollback()
                        yield f"data: {json.dumps({'error': 'CREDIT_CAP_REACHED', 'credit_limits': usage_result.get('limit') or {}})}\n\n"
                        return
                    logger.info(
                        "✅ Stream credit applied (w/ character) | user=%s | chat=%s | consumed_from_wallet=%s | wallet_balance_after=%.2f",
                        current_user.id,
                        chat_id,
                        usage_result.get("consumed_from_wallet", False),
                        float(usage_result.get("wallet_balance_after", 0)),
                    )
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
                        context_window_soft_limit=context_window_soft_limit,
                        context_summary=merged_context_summary,
                        requested_branch_id=branch_id,
                        fork_from_message_id=fork_from_message_id,
                        base_message_count=base_message_count,
                    )
                    serialized_entry = serialize_chat_history_entry(entry)
                    current_credit_limit_info = get_credit_cap_info(stream_user, db_session)
                    db_session.commit()
                finally:
                    db_session.close()
            else:
                limit_info = increment_user_message_count(
                    current_user,
                    db,
                    limit_check["is_user_request"],
                ) or (limit_check.get("limit") or {})
                usage_result = apply_credit_usage_with_wallet(
                    db,
                    user=current_user,
                    usage=response_usage,
                    source="chat_stream",
                    source_order_no=chat_id,
                    metadata={"stream": True, "character_id": character_id},
                    credit_amount=stream_credit_amount,
                )
                if not usage_result.get("success"):
                    db.rollback()
                    yield f"data: {json.dumps({'error': 'CREDIT_CAP_REACHED', 'credit_limits': usage_result.get('limit') or {}})}\n\n"
                    return
                db.commit()
                current_credit_limit_info = get_credit_cap_info(current_user, db)
                logger.info(
                    "✅ Stream credit applied (wo/ character) | user=%s | chat=%s | consumed_from_wallet=%s | wallet_balance_after=%.2f",
                    current_user.id,
                    chat_id,
                    usage_result.get("consumed_from_wallet", False),
                    float(usage_result.get("wallet_balance_after", 0)),
                )

            # Overlay the real usage reported by the LLM response when available;
            # the pre-call estimate in context_window_info is based only on the
            # input messages and is especially inaccurate for the
            # improvised-greeting turn where there are no prior messages to
            # derive real usage from.
            actual_prompt_tokens = response_usage.get("prompt_tokens", 0)
            actual_total_tokens = response_usage.get("total_tokens", 0)
            # Estimator-error tracking: log what the provider actually billed
            # vs what the trigger/guard estimated, per request, so the cushion
            # constants (ESTIMATOR_FULL_REQUEST_CUSHION / DELTA_CUSHION in
            # utils/context_window.py) can eventually be replaced with numbers
            # derived from real error on CJK + mixed-language roleplay text.
            try:
                measured_input = int(prepared_context_info.get("measured_input_tokens") or 0)
                sent_estimate = int(prepared_context_info.get("sent_estimate_tokens") or 0)
                new_estimate = int(prepared_context_info.get("estimated_new_tokens") or 0)
                folded_this_turn = isinstance(state_update, dict) and bool(
                    state_update.get("through_message_id")
                )
                if actual_prompt_tokens > 0:
                    if folded_this_turn:
                        ratio = (actual_prompt_tokens / sent_estimate) if sent_estimate > 0 else 0.0
                        logger.info(
                            "Context estimator | mode=folded | user=%s | model=%s | actual=%d | estimated=%d | ratio=%.3f",
                            current_user.id,
                            chat_config["model"],
                            actual_prompt_tokens,
                            sent_estimate,
                            ratio,
                        )
                    elif measured_input > 0:
                        actual_delta = max(0, actual_prompt_tokens - measured_input)
                        ratio = (actual_delta / new_estimate) if new_estimate > 0 else 0.0
                        logger.info(
                            "Context estimator | mode=measured_delta | user=%s | model=%s | actual_delta=%d | estimated_delta=%d | ratio=%.3f | measured_input=%d",
                            current_user.id,
                            chat_config["model"],
                            actual_delta,
                            new_estimate,
                            ratio,
                            measured_input,
                        )
                    else:
                        ratio = (actual_prompt_tokens / new_estimate) if new_estimate > 0 else 0.0
                        logger.info(
                            "Context estimator | mode=naive | user=%s | model=%s | actual=%d | estimated=%d | ratio=%.3f",
                            current_user.id,
                            chat_config["model"],
                            actual_prompt_tokens,
                            new_estimate,
                            ratio,
                        )
            except Exception:
                logger.exception("Context estimator logging failed")

            # Overlay the real usage reported by the LLM response when available;
            # the pre-call estimate in context_window_info is based only on the
            # input messages and is especially inaccurate for the
            # improvised-greeting turn where there are no prior messages to
            # derive real usage from. When an emergency compaction shipped, show
            # what we actually sent rather than the pre-emergency estimate.
            context_display_info = prepared_context_info if emergency_info is not None else context_window_info
            effective_context_window_info = {**context_display_info}
            if actual_prompt_tokens > 0:
                effective_context_window_info["input_tokens"] = actual_prompt_tokens
                if actual_total_tokens > 0:
                    effective_context_window_info["total_tokens"] = actual_total_tokens
            elif actual_total_tokens > 0:
                effective_context_window_info["total_tokens"] = actual_total_tokens
            done_payload = {
                'done': True,
                'chat_id': chat_id,
                'chat_title': generate_chat_title(full_messages, existing_entry.title if existing_entry else None),
                'limits': limit_info,
                'credit_limits': current_credit_limit_info,
                'context_window': {
                    **effective_context_window_info,
                    'message_count': len(context_messages),
                    **context_turn_metadata,
                },
            }
            if character_id:
                done_payload['chat_entry'] = serialized_entry
                done_payload['branch_id'] = serialized_entry.get('active_branch_id')
            yield f"data: {json.dumps(done_payload)}\n\n"

        except ClientDisconnect:
            return
        except Exception as e:
            yield f"data: {json.dumps({'error': str(e)})}\n\n"

    return StreamingResponse(
        generate(),
        media_type="text/event-stream",
        headers={
            "X-RateLimit-Limit-Minute": str(rate_limit_result["limit"]),
            "X-RateLimit-Remaining-Minute": str(rate_limit_result["remaining"]),
            # Tell nginx to forward each SSE chunk as it arrives instead of
            # buffering the whole response (which made long generations look
            # idle and hit nginx's proxy_read_timeout).
            "X-Accel-Buffering": "no",
        },
    )

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

    switched = set_chat_history_active_branch_for_entry(db, entry, branch_id.strip())
    if not switched:
        return JSONResponse(content={"error": "Branch not found"}, status_code=404)

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
        branch_id = serialize_chat_history_entry(entry).get("active_branch_id")
    else:
        branch_id = branch_id.strip()

    pin_result = toggle_chat_history_message_pin(
        db,
        entry=entry,
        branch_id=branch_id,
        message_id=message_id,
        is_pinned=is_pinned,
        message_role=message_role,
        message_content=message_content,
        max_pinned_memories=MAX_PINNED_MEMORIES,
    )
    if not pin_result[0]:
        if pin_result[2] == "PIN_LIMIT_REACHED":
            return JSONResponse(
                content={
                    "error": "MEMORY_PIN_LIMIT_REACHED",
                    "message": f"You can pin up to {MAX_PINNED_MEMORIES} memories per chat.",
                    "max_pinned_memories": MAX_PINNED_MEMORIES,
                },
                status_code=400,
            )
        return JSONResponse(content={"error": "Message not found in chat"}, status_code=404)

    db.commit()

    return {
        "status": "success",
        "chat_id": chat_id,
        "message_id": message_id,
        "is_pinned": is_pinned,
        "branch_id": branch_id,
        "pinned_messages_count": pin_result[1],
    }


@router.post("/api/chat/hide-from-recent")
async def hide_chat_from_recent(request: Request, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    try:
        data = await request.json()
    except ClientDisconnect:
        return Response(status_code=499)

    chat_id = data.get("chat_id")
    if not isinstance(chat_id, str) or not chat_id.strip():
        return JSONResponse(content={"error": "Missing chat_id"}, status_code=400)

    entry = fetch_chat_history_entry(db, current_user.id, chat_id)
    if not entry:
        return JSONResponse(content={"error": "Chat not found"}, status_code=404)

    entry.hidden_from_recent = True
    db.commit()
    return {"status": "success", "chat_id": chat_id}


@router.post("/api/chat/restore-to-recent")
async def restore_chat_to_recent(request: Request, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    try:
        data = await request.json()
    except ClientDisconnect:
        return Response(status_code=499)

    chat_id = data.get("chat_id")
    if not isinstance(chat_id, str) or not chat_id.strip():
        return JSONResponse(content={"error": "Missing chat_id"}, status_code=400)

    entry = fetch_chat_history_entry(db, current_user.id, chat_id)
    if not entry:
        return JSONResponse(content={"error": "Chat not found"}, status_code=404)

    entry.hidden_from_recent = False
    db.commit()
    return {"status": "success", "chat_id": chat_id}


@router.get("/api/chat/history")
async def get_chat_history(
    page: int = 1,
    page_size: int = 20,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if page < 1:
        page = 1
    if page_size < 1 or page_size > 100:
        page_size = 20
    return fetch_user_chat_history_paginated(db, current_user.id, page=page, page_size=page_size)


@router.get("/api/chat/history-by-character")
async def get_chat_history_by_character(
    page: int = 1,
    page_size: int = 20,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if page < 1:
        page = 1
    if page_size < 1 or page_size > 100:
        page_size = 20
    return fetch_user_chat_history_grouped_by_character(db, current_user.id, page=page, page_size=page_size)


@router.post("/api/chat/delete-by-character")
async def delete_chat_history_by_character(
    request: Request,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    try:
        data = await request.json()
    except ClientDisconnect:
        return Response(status_code=499)

    character_id = data.get("character_id")  # may be None for deleted characters
    character_name = data.get("character_name")
    if not character_id and not character_name:
        return JSONResponse(content={"error": "Missing character_id or character_name"}, status_code=400)

    deleted_count = delete_user_chat_history_by_character(
        db,
        current_user.id,
        str(character_id) if character_id is not None else None,
        character_name=character_name,
    )
    return {"status": "success", "deleted": deleted_count}


@router.post("/api/chat/delete-unavailable")
async def delete_unavailable_chat_histories(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    deleted_count = delete_unavailable_chat_history(db, current_user.id)
    return {"status": "success", "deleted": deleted_count}


@router.get("/api/chat/rate-limit-status")
async def get_rate_limit_status(
    current_user: User = Depends(get_current_user),
):
    """Return the current rate‑limit status for the authenticated user
    without consuming a request."""
    return await rate_limiter.status(
        current_user.id,
        is_pro=bool(current_user.is_pro),
    )
