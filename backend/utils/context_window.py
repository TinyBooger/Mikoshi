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

# Per-turn conversation-history budget, sized by COST and never by the model's
# advertised window: a 1M-token model must not be handed a 1M-token transcript
# just because it would accept one. Both the branch query (which messages load)
# and the request-time trim (which messages send) share this number.
#
# The binding economics: 1 credit = ¥0.001, a Pro user gets
# PRO_MONTHLY_CREDIT_CAP = 10,000 credits/month and a free user
# FREE_DAILY_CREDIT_CAP = 10 credits/day. A saturated turn's prompt costs
#     budget / 1M × input_price  (¥) × 1000 credits/¥
# so 16k tokens costs, per fully-saturated turn:
#
#   qwen3.7-flash     ¥0.20/M →   3.2 credits  (0.03% of a Pro month)
#   qwen-plus-character ¥0.80/M → 12.8 credits (0.13% of a Pro month)
#   qwen3.7-plus      ¥2.00/M →  32.0 credits  (0.32% of a Pro month)
#   deepseek-v4-flash ¥3.00/M peak → 48.0 credits (0.48% of a Pro month)
#   deepseek-v4-pro   ¥9.00/M peak → 144.0 credits (1.4% of a Pro month)
#
# So even the most expensive model at peak pricing, on the longest history the
# budget allows, is ~1% of a Pro month: ~70 maximal turns fit inside the cap, and
# ordinary (non-saturated) turns cost a fraction of that. 16k also leaves room
# under the smallest provider input cap (32k on qwen3.7-flash /
# qwen-plus-character) for the character prompt, the time marker, the user's new
# message and the reply, so the fail-closed guard stays a pathological-case path
# instead of the normal one.
HISTORY_TOKEN_BUDGET = 16_000

# Upper bound on rows a branch context query may pull before the token budget
# decides. The token budget is authoritative; this only stops a transcript of
# tens of thousands of very short messages from being materialized (and then
# parsed) just to be thrown away.
HISTORY_CONTEXT_MESSAGE_WINDOW = 1_000


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


def estimate_text_tokens(text: str) -> int:
    """Public token estimate for one string (shared with the history query)."""
    return _estimate_tokens(text)


def trim_oldest_context_for_fallback(
    messages: List[dict],
    *,
    target_token_limit: int,
    context_info: Optional[dict] = None,
) -> tuple[List[dict], Dict[str, object]]:
    """Trim oldest raw conversation messages from the request, never system messages.

    Works backwards from the newest message and keeps the longest recent tail the
    budget allows, so the cost is proportional to what is *kept* rather than to
    what is dropped. A transcript of tens of thousands of messages is therefore
    as cheap as a short one — the omitted messages are never token-estimated.

    System messages and the user message being answered are always retained, so
    a single oversized user message can still exceed the budget; the fail-closed
    guard in ``routes/chat.py`` is what refuses that case.
    """
    sanitized = _sanitize_messages(messages)
    if not sanitized:
        return [], dict(context_info or {})

    target = max(1, int(target_token_limit))
    system_tokens = sum(
        _estimate_tokens(message["content"])
        for message in sanitized
        if message["role"] == "system"
    )
    # ``estimate_request_input_tokens`` inflates the whole request by the cushion,
    # so undo it here to get the raw token room the retained tail may use. System
    # messages are never trimmed, so they come off the top.
    budget = int(target / ESTIMATOR_FULL_REQUEST_CUSHION) - system_tokens
    marker_tokens = _estimate_tokens(CONTEXT_FALLBACK_MARKER)

    latest_user_index = next(
        (index for index in range(len(sanitized) - 1, -1, -1) if sanitized[index]["role"] == "user"),
        None,
    )
    if latest_user_index is None:
        latest_user_index = next(
            (index for index in range(len(sanitized) - 1, -1, -1) if sanitized[index]["role"] != "system"),
            None,
        )

    # ``keep_from`` is the first index of the retained tail: everything before it
    # is a removal candidate. Walking newest-first means only the messages that
    # survive are ever estimated. The answered user message is always retained, so
    # its tokens are charged to the budget up front instead of being discovered
    # mid-walk — otherwise it would silently overrun the target.
    forced_tokens = (
        _estimate_tokens(sanitized[latest_user_index]["content"])
        if latest_user_index is not None
        else 0
    )
    kept_tokens = forced_tokens
    keep_from = 0
    truncated = False
    for index in range(len(sanitized) - 1, -1, -1):
        message = sanitized[index]
        if message["role"] == "system" or index == latest_user_index:
            keep_from = index
            continue
        message_tokens = _estimate_tokens(message["content"])
        if kept_tokens + message_tokens > budget:
            keep_from = index + 1
            truncated = True
            break
        kept_tokens += message_tokens
        keep_from = index

    if truncated:
        # The marker that stands in for the omitted messages is part of the
        # request too, so the retained tail has to give up its room as well.
        while keep_from < len(sanitized) and kept_tokens + marker_tokens > budget:
            message = sanitized[keep_from]
            if message["role"] != "system" and keep_from != latest_user_index:
                kept_tokens -= _estimate_tokens(message["content"])
            keep_from += 1

    removed_indexes: set[int] = {
        index
        for index in range(keep_from)
        if sanitized[index]["role"] != "system" and index != latest_user_index
    }

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

