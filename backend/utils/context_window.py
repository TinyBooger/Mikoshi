import os
import re
from typing import Dict, List, Tuple


DEFAULT_SOFT_TOKEN_LIMIT = int(os.getenv("CHAT_CONTEXT_SOFT_TOKEN_LIMIT", "900"))
DEFAULT_TARGET_TOKEN_LIMIT = int(os.getenv("CHAT_CONTEXT_TARGET_TOKEN_LIMIT", "520"))
DEFAULT_MAX_SUMMARY_POINTS = int(os.getenv("CHAT_CONTEXT_MAX_SUMMARY_POINTS", "10"))
DEFAULT_PRO_SOFT_LIMIT_MULTIPLIER = float(os.getenv("CHAT_CONTEXT_PRO_SOFT_LIMIT_MULTIPLIER", "2.0"))


def _normalize_text(value: str) -> str:
    return re.sub(r"\s+", " ", (value or "").strip())


def _truncate_text(value: str, max_len: int) -> str:
    if len(value) <= max_len:
        return value
    return value[: max_len - 3].rstrip() + "..."


def _approx_tokens(messages: List[dict]) -> int:
    total_chars = 0
    for msg in messages:
        if not isinstance(msg, dict):
            continue
        role = str(msg.get("role", ""))
        content = str(msg.get("content", ""))
        total_chars += len(role) + len(content) + 10
    return max(1, total_chars // 4)


def _sanitize_messages(messages: List[dict]) -> List[dict]:
    clean_messages: List[dict] = []
    for msg in messages:
        if not isinstance(msg, dict):
            continue
        role = str(msg.get("role", "")).strip().lower()
        content = _normalize_text(str(msg.get("content", "")))
        if not role or not content:
            continue
        clean_messages.append({"role": role, "content": content})
    return clean_messages


def _build_summary_block(older_messages: List[dict], max_points: int) -> dict:
    lines: List[str] = []
    for msg in older_messages:
        role = msg.get("role", "unknown")
        if role == "user":
            prefix = "User"
        elif role == "assistant":
            prefix = "Assistant"
        else:
            prefix = role.capitalize()
        lines.append(f"- {prefix}: {_truncate_text(msg.get('content', ''), 140)}")

    if len(lines) > max_points:
        keep_head = min(2, max_points)
        keep_tail = max_points - keep_head
        lines = lines[:keep_head] + ["- ..."] + lines[-keep_tail:]

    summary_content = "\n".join(
        [
            "Summary of previous conversation:",
            *lines,
        ]
    )
    return {"role": "system", "content": summary_content}


def compact_conversation_messages(
    messages: List[dict],
    *,
    soft_token_limit: int = DEFAULT_SOFT_TOKEN_LIMIT,
    target_token_limit: int = DEFAULT_TARGET_TOKEN_LIMIT,
    max_summary_points: int = DEFAULT_MAX_SUMMARY_POINTS,
    is_pro_user: bool = False,
    pro_soft_limit_multiplier: float = DEFAULT_PRO_SOFT_LIMIT_MULTIPLIER,
) -> Tuple[List[dict], Dict[str, int | bool]]:
    sanitized = _sanitize_messages(messages)
    if not sanitized:
        return [], {"was_summarized": False, "input_tokens": 0, "output_tokens": 0}

    effective_soft_token_limit = soft_token_limit
    if is_pro_user and pro_soft_limit_multiplier > 1:
        effective_soft_token_limit = int(soft_token_limit * pro_soft_limit_multiplier)

    input_tokens = _approx_tokens(sanitized)
    if input_tokens <= effective_soft_token_limit:
        return sanitized, {
            "was_summarized": False,
            "input_tokens": input_tokens,
            "output_tokens": input_tokens,
            "summary_messages_count": 0,
            "soft_token_limit": effective_soft_token_limit,
        }

    system_messages = [m for m in sanitized if m.get("role") == "system"]
    conversation_messages = [m for m in sanitized if m.get("role") != "system"]

    if not conversation_messages:
        compacted = system_messages
    else:
        older_messages: List[dict] = []
        recent_messages = conversation_messages[:]
        local_max_summary_points = max(3, max_summary_points)
        compacted = [*system_messages, *recent_messages]

        while _approx_tokens(compacted) > target_token_limit:
            if len(recent_messages) > 1:
                older_messages.append(recent_messages.pop(0))
            elif local_max_summary_points > 3:
                local_max_summary_points -= 1
            else:
                break

            if older_messages:
                summary_message = _build_summary_block(older_messages, max_points=local_max_summary_points)
                compacted = [*system_messages, summary_message, *recent_messages]
            else:
                compacted = [*system_messages, *recent_messages]

    return compacted, {
        "was_summarized": True,
        "input_tokens": input_tokens,
        "output_tokens": _approx_tokens(compacted),
        "summary_messages_count": len(older_messages) if conversation_messages else 0,
        "recent_messages_count": len(recent_messages) if conversation_messages else 0,
        "soft_token_limit": effective_soft_token_limit,
    }
