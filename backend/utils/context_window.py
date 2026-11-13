import re
from math import ceil
from typing import Dict, List, Optional
from utils.usage_utils import normalize_usage

DEFAULT_SOFT_TOKEN_LIMIT = 8000
CONTEXT_FALLBACK_MARKER = (
    "Older conversation context was omitted to fit the model context window. "
    "Continue from the remaining messages and the user's latest message."
)
# Fail-closed guard cushion. This is a placeholder invented to absorb
# estimator error, NOT derived from real error data.
ESTIMATOR_FULL_REQUEST_CUSHION = 1.15


def _normalize_text(value: str) -> str:
    return re.sub(r"\s+", " ", (value or "").strip())


def _normalize_message_content(value: object) -> str:
    if not isinstance(value, str):
        return ""
    return value.strip()


def _estimate_tokens(text: str) -> int:
    normalized = _normalize_text(text)
    if not normalized:
        return 0

    english_words = re.findall(r"[A-Za-z0-9']+", normalized)
    cjk_chars = re.findall(r"[\u4e00-\u9fff]", normalized)

    ascii_letters_count = sum(len(word) for word in english_words)
    cjk_count = len(cjk_chars)
    remaining_chars = max(0, len(normalized) - ascii_letters_count - cjk_count)

    # Rough approximation: English words ~1 token, CJK chars ~1 token,
    # punctuation/other content ~1 token per 6 chars.
    estimate = len(english_words) + cjk_count + ceil(remaining_chars / 6)
    return max(1, int(estimate))


def _sanitize_messages(messages: List[dict]) -> List[dict]:
    clean_messages: List[dict] = []
    for msg in messages:
        if not isinstance(msg, dict):
            continue
        role = str(msg.get("role", "")).strip().lower()
        content = _normalize_message_content(msg.get("content"))
        if not role or not content:
            continue
        normalized = {"role": role, "content": content}
        message_id = msg.get("message_id")
        if isinstance(message_id, str) and message_id.strip():
            normalized["message_id"] = message_id.strip()

        if bool(msg.get("is_pinned")):
            normalized["is_pinned"] = True

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


def trim_oldest_context_for_fallback(
    messages: List[dict],
    *,
    target_token_limit: int,
    context_info: Optional[dict] = None,
) -> tuple[List[dict], Dict[str, object]]:
    """Trim oldest raw conversation messages from the request, never system messages."""
    sanitized = _sanitize_messages(messages)
    if not sanitized:
        return [], dict(context_info or {})

    latest_user_index = next(
        (index for index in range(len(sanitized) - 1, -1, -1) if sanitized[index]["role"] == "user"),
        None,
    )
    if latest_user_index is None:
        latest_user_index = next(
            (index for index in range(len(sanitized) - 1, -1, -1) if sanitized[index]["role"] != "system"),
            None,
        )

    removable_message_indexes = [
        index
        for index, message in enumerate(sanitized)
        if message["role"] != "system" and index != latest_user_index
    ]
    removed_indexes: set[int] = set()

    def build_request() -> List[dict]:
        retained = [
            message
            for index, message in enumerate(sanitized)
            if index not in removed_indexes
        ]
        if not removed_indexes:
            return retained
        marker = {"role": "system", "content": CONTEXT_FALLBACK_MARKER}
        insertion_index = next(
            (index for index, message in enumerate(retained) if message["role"] != "system"),
            len(retained),
        )
        return [*retained[:insertion_index], marker, *retained[insertion_index:]]

    target = max(1, int(target_token_limit))
    for index in removable_message_indexes:
        if estimate_request_input_tokens(build_request()) <= target:
            break
        removed_indexes.add(index)

    request_messages = build_request()
    estimated_tokens = _estimate_messages(request_messages)
    info = dict(context_info or {})
    info.update(
        {
            "sent_estimate_tokens": estimated_tokens,
            "estimated_new_tokens": estimated_tokens,
            "measured_input_tokens": 0,
            "guard_input_tokens": estimate_request_input_tokens(request_messages),
            "context_truncated": bool(removed_indexes),
            "omitted_message_count": sum(
                1
                for index in removed_indexes
                if sanitized[index]["role"] != "system"
            ),
            "fallback_target_tokens": target,
        }
    )
    return request_messages, info


def _estimate_messages(messages: List[dict]) -> int:
    return sum(_estimate_tokens(str(m.get("content", ""))) for m in messages)


def estimate_request_input_tokens(messages: List[dict]) -> int:
    """Estimate a built request with a cushion for token-estimator error."""
    return int(ESTIMATOR_FULL_REQUEST_CUSHION * max(_estimate_messages(messages), 1))


def prepare_context_request(
    messages: List[dict],
    *,
    soft_token_limit: int = DEFAULT_SOFT_TOKEN_LIMIT,
) -> tuple[List[dict], Dict[str, object]]:
    """Sanitize a chat request and describe its context-window usage.

    The returned info dict feeds the ``context_window`` payload the client renders
    as its usage indicator; :func:`trim_oldest_context_for_fallback` updates it
    when the provider's input cap forces older turns to be dropped.
    """
    prepared_messages = _sanitize_messages(messages)
    system_prompt_tokens = sum(
        _estimate_tokens(message["content"])
        for message in prepared_messages
        if message["role"] == "system"
    )
    measured_input_tokens = _latest_assistant_usage(prepared_messages)["prompt_tokens"]
    sent_estimate_tokens = _estimate_messages(prepared_messages)
    input_tokens = measured_input_tokens or sent_estimate_tokens
    return prepared_messages, {
        "input_tokens": input_tokens,
        "output_tokens": 0,
        "total_tokens": input_tokens,
        "soft_token_limit": max(1, int(soft_token_limit)),
        "token_source": "usage" if measured_input_tokens else "estimate",
        "measured_input_tokens": measured_input_tokens,
        "sent_estimate_tokens": sent_estimate_tokens,
        "estimated_new_tokens": sent_estimate_tokens,
        "system_prompt_tokens": system_prompt_tokens,
        "recent_messages_count": sum(
            1 for message in prepared_messages if message["role"] != "system"
        ),
        "context_truncated": False,
        "omitted_message_count": 0,
    }

