import re
from math import ceil
from typing import Dict, List, Optional
from utils.usage_utils import normalize_usage

DEFAULT_SOFT_TOKEN_LIMIT = 8000
# Fail-closed guard cushion, applied on top of the per-character weights below.
ESTIMATOR_FULL_REQUEST_CUSHION = 1.15

# Tokens per Han character. Chinese BPE vocabularies carry whole words, so a
# character is worth well under one token. Measured against provider
# ``prompt_tokens`` on a Chinese transcript: counting 1 token per character
# inflated the request by ~1.4x, which silently shrank the usable context.
CJK_TOKENS_PER_CHAR = 0.75

# Per-turn conversation-history cost ceiling. This is independent of the model's
# context window and requested output length; the provider input-cap guard in the
# chat route separately enforces model limits.
HISTORY_TOKEN_BUDGET = 4_095

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

    # Rough approximation: English words ~1 token, CJK chars ~0.75 token,
    # punctuation/other content ~1 token per 6 chars.
    estimate = (
        len(english_words)
        + ceil(cjk_count * CJK_TOKENS_PER_CHAR)
        + ceil(remaining_chars / 6)
    )
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


def select_recent_messages(
    messages: List[dict],
    *,
    token_budget: int,
) -> tuple[List[dict], int]:
    """Keep the newest whole turns of a prompt that fit ``token_budget``.

    This is the one place that decides what history the model sees, so send,
    resend, regenerate and fork cannot drift apart.

    The budget is spent newest-first — system messages first (they are never
    trimmed), then the turn being answered, then earlier turns for as long as
    they fit. The retained slice is therefore the *most recent* history, and a
    cut only ever lands between turns: a reply whose user message was dropped is
    dropped too, so the transcript never starts on the character's line and never
    ends on a prompt the model was already answering.

    Nothing is injected into the prompt to announce the cut. A second system
    message is not honoured by every model, and it lands in the middle of the
    transcript where it reads as role confusion rather than instruction; the
    omission is reported to the client through ``omitted_count`` instead.

    Returns ``(messages, omitted_count)``.
    """
    budget = max(1, int(token_budget))
    system_messages = [message for message in messages if message.get("role") == "system"]
    conversation = [message for message in messages if message.get("role") != "system"]

    room = budget - system_tokens(system_messages)

    kept = conversation
    if conversation:
        # Charge the turn being answered before anything else: it must never be
        # the message the budget squeezes out.
        keep_from = len(conversation) - 1
        used = _estimate_tokens(conversation[keep_from]["content"])
        for index in range(len(conversation) - 2, -1, -1):
            cost = _estimate_tokens(conversation[index]["content"])
            if used + cost > room:
                break
            used += cost
            keep_from = index
        kept = conversation[keep_from:]
        # Never open on the character's line: that reply answers a user message
        # this budget just dropped.
        while len(kept) > 1 and kept[0].get("role") != "user":
            kept.pop(0)

    omitted = len(conversation) - len(kept)
    return [*system_messages, *_merge_consecutive_roles(kept)], omitted


def _merge_consecutive_roles(messages: List[dict]) -> List[dict]:
    """Collapse turns a previous failure left stacked (two user lines in a row).

    Stored transcripts can hold two consecutive user messages when a reply never
    landed, and two consecutive replies after a regenerate. Either reads to the
    model as an unanswered question, so the pair is merged into one turn instead
    of being dropped — the words stay, the phantom pending task goes.
    """
    merged: List[dict] = []
    for message in messages:
        if merged and merged[-1].get("role") == message.get("role"):
            previous = merged.pop()
            message = {
                **message,
                "content": f"{previous.get('content') or ''}\n\n{message.get('content') or ''}".strip(),
            }
        merged.append(message)
    return merged


def system_tokens(messages: List[dict]) -> int:
    """Token estimate of the messages that are never trimmed."""
    return sum(
        _estimate_tokens(str(message.get("content") or ""))
        for message in messages
        if message.get("role") == "system"
    )


def trim_oldest_context_for_fallback(
    messages: List[dict],
    *,
    target_token_limit: int,
    context_info: Optional[dict] = None,
) -> tuple[List[dict], Dict[str, object]]:
    """Fit an over-long request to the provider's input cap, newest turns first.

    ``target_token_limit`` is a cushioned estimate, so it is converted back to
    raw tokens before :func:`select_recent_messages` runs. System messages and
    the turn being answered are always retained, so a single oversized user
    message can still exceed the cap; ``routes/chat.py`` refuses that case.
    """
    sanitized = _sanitize_messages(messages)
    if not sanitized:
        return [], dict(context_info or {})

    target = max(1, int(target_token_limit))
    request_messages, omitted = select_recent_messages(
        sanitized,
        token_budget=int(target / ESTIMATOR_FULL_REQUEST_CUSHION),
    )
    estimated_tokens = _estimate_messages(request_messages)
    info = dict(context_info or {})
    info.update(
        {
            "sent_estimate_tokens": estimated_tokens,
            "estimated_new_tokens": estimated_tokens,
            "measured_input_tokens": 0,
            "guard_input_tokens": estimate_request_input_tokens(request_messages),
            "context_truncated": omitted > 0,
            "omitted_message_count": omitted,
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

