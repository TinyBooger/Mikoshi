import os
import re
from typing import Dict, List, Tuple
from utils.usage_utils import normalize_usage


DEFAULT_SOFT_TOKEN_LIMIT = int(os.getenv("CHAT_CONTEXT_SOFT_TOKEN_LIMIT", "900"))
DEFAULT_PRO_SOFT_LIMIT_MULTIPLIER = float(os.getenv("CHAT_CONTEXT_PRO_SOFT_LIMIT_MULTIPLIER", "2.0"))
DEFAULT_MAX_CONTEXT_MESSAGES = int(os.getenv("CHAT_CONTEXT_MAX_MESSAGES", "28"))


def _normalize_text(value: str) -> str:
    return re.sub(r"\s+", " ", (value or "").strip())


def _sanitize_messages(messages: List[dict]) -> List[dict]:
    clean_messages: List[dict] = []
    for msg in messages:
        if not isinstance(msg, dict):
            continue
        role = str(msg.get("role", "")).strip().lower()
        content = _normalize_text(str(msg.get("content", "")))
        if not role or not content:
            continue
        normalized = {"role": role, "content": content}
        if role == "assistant":
            usage = normalize_usage(msg.get("usage"))
            if usage["total_tokens"] > 0:
                normalized["usage"] = usage
        clean_messages.append(normalized)
    return clean_messages


def _latest_assistant_usage(messages: List[dict]) -> dict[str, int]:
    for msg in reversed(messages):
        if not isinstance(msg, dict):
            continue
        if msg.get("role") != "assistant":
            continue
        usage = normalize_usage(msg.get("usage"))
        if usage["total_tokens"] > 0:
            return usage
    return normalize_usage(None)


def compact_conversation_messages(
    messages: List[dict],
    *,
    soft_token_limit: int = DEFAULT_SOFT_TOKEN_LIMIT,
    max_context_messages: int = DEFAULT_MAX_CONTEXT_MESSAGES,
    is_pro_user: bool = False,
    pro_soft_limit_multiplier: float = DEFAULT_PRO_SOFT_LIMIT_MULTIPLIER,
) -> Tuple[List[dict], Dict[str, int | bool]]:
    sanitized = _sanitize_messages(messages)
    if not sanitized:
        return [], {
            "input_tokens": 0,
            "output_tokens": 0,
            "summary_messages_count": 0,
            "recent_messages_count": 0,
            "soft_token_limit": soft_token_limit,
            "token_source": "usage",
            "message_cap": max_context_messages,
        }

    effective_soft_token_limit = soft_token_limit
    if is_pro_user and pro_soft_limit_multiplier > 1:
        effective_soft_token_limit = int(soft_token_limit * pro_soft_limit_multiplier)
    effective_message_cap = max_context_messages * 2 if is_pro_user else max_context_messages

    latest_usage = _latest_assistant_usage(sanitized)
    input_tokens = latest_usage["prompt_tokens"]

    system_messages = [m for m in sanitized if m.get("role") == "system"]
    conversation_messages = [m for m in sanitized if m.get("role") != "system"]

    return sanitized, {
        "input_tokens": input_tokens,
        "output_tokens": latest_usage["completion_tokens"],
        "summary_messages_count": 0,
        "recent_messages_count": len(conversation_messages),
        "soft_token_limit": effective_soft_token_limit,
        "token_source": "usage",
        "message_cap": effective_message_cap,
    }
