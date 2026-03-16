import re
from math import ceil
from typing import Dict, List, Tuple
from utils.llm_client import client as llm_client
from utils.usage_utils import normalize_usage


SUMMARY_PREFIX = "Summary of previous conversation:"
ROLE_LABELS = {
    "user": "User",
    "assistant": "Assistant",
}
SUMMARY_MODEL = "deepseek-chat"
SUMMARY_SYSTEM_PROMPT = (
    "You are a conversation memory compressor. "
    "Summarize the provided dialogue history into a compact memory for future turns. "
    "Keep only durable information: user goals, constraints, preferences, key facts, decisions, unresolved items, and important context. "
    "Do not invent facts. Do not include meta commentary. Output plain text only. "
    "The output must be no more than 300 tokens."
)

DEFAULT_SOFT_TOKEN_LIMIT = 3000
DEFAULT_RECENT_MESSAGE_COUNT = 15
DEFAULT_SUMMARY_MAX_TOKENS = 300


def _normalize_text(value: str) -> str:
    return re.sub(r"\s+", " ", (value or "").strip())


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
        content = _normalize_text(str(msg.get("content", "")))
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


def _is_summary_system_message(message: dict) -> bool:
    if message.get("role") != "system":
        return False
    content = _normalize_text(str(message.get("content", "")))
    return bool(content) and content.startswith(SUMMARY_PREFIX)


def _extract_summary_body(summary_message: dict) -> str:
    content = _normalize_text(str(summary_message.get("content", "")))
    if not content.startswith(SUMMARY_PREFIX):
        return ""
    return content[len(SUMMARY_PREFIX):].strip(" :\n")


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


def _is_pinned_conversation_message(message: dict) -> bool:
    role = str(message.get("role", "")).strip().lower()
    if role not in {"user", "assistant"}:
        return False
    return bool(message.get("is_pinned"))


def _build_summary_prompt_input(existing_summary_text: str, old_messages: List[dict]) -> str:
    lines: List[str] = []

    if existing_summary_text:
        lines.append("[Existing summary]")
        lines.append(existing_summary_text)
        lines.append("")

    lines.append("[New messages to compress]")
    for msg in old_messages:
        role = str(msg.get("role", "")).strip().lower()
        content = _normalize_text(str(msg.get("content", "")))
        if role not in {"user", "assistant"} or not content:
            continue
        role_label = ROLE_LABELS.get(role, role.title())
        lines.append(f"{role_label}: {content}")

    return "\n".join(lines).strip()


def _summarize_with_prompt(summary_input: str, *, summary_max_tokens: int) -> str:
    if not summary_input:
        return ""

    response = llm_client.chat.completions.create(
        model=SUMMARY_MODEL,
        messages=[
            {"role": "system", "content": SUMMARY_SYSTEM_PROMPT},
            {"role": "user", "content": summary_input},
        ],
        max_tokens=summary_max_tokens,
        temperature=0.2,
        top_p=0.9,
    )
    content = response.choices[0].message.content if response and response.choices else ""
    return _normalize_text(content)


def _build_summary_message(
    existing_summary_text: str,
    old_messages: List[dict],
    *,
    summary_max_tokens: int,
) -> dict | None:
    if not existing_summary_text and not old_messages:
        return None

    summary_input = _build_summary_prompt_input(existing_summary_text, old_messages)
    summary_body = ""
    try:
        summary_body = _summarize_with_prompt(summary_input, summary_max_tokens=summary_max_tokens)
    except Exception:
        summary_body = ""

    if not summary_body and existing_summary_text:
        # Keep previous memory if summarization fails.
        summary_body = existing_summary_text

    if not summary_body:
        return None

    return {
        "role": "system",
        "content": f"{SUMMARY_PREFIX}\n{summary_body}",
    }


def compact_conversation_messages(
    messages: List[dict],
    *,
    soft_token_limit: int = DEFAULT_SOFT_TOKEN_LIMIT,
    recent_message_count: int = DEFAULT_RECENT_MESSAGE_COUNT,
    summary_max_tokens: int = DEFAULT_SUMMARY_MAX_TOKENS,
) -> Tuple[List[dict], Dict[str, int | bool]]:
    sanitized = _sanitize_messages(messages)
    if not sanitized:
        return [], {
            "input_tokens": 0,
            "output_tokens": 0,
            "summary_messages_count": 0,
            "recent_messages_count": 0,
            "pinned_messages_count": 0,
            "soft_token_limit": soft_token_limit,
            "token_source": "usage",
        }

    effective_soft_token_limit = soft_token_limit
    effective_recent_message_count = max(1, int(recent_message_count))
    effective_summary_max_tokens = max(64, int(summary_max_tokens))

    latest_usage = _latest_assistant_usage(sanitized)
    usage_input_tokens = latest_usage["prompt_tokens"]

    summary_system_messages = [m for m in sanitized if _is_summary_system_message(m)]
    system_messages = [m for m in sanitized if m.get("role") == "system" and not _is_summary_system_message(m)]
    conversation_messages = [m for m in sanitized if m.get("role") != "system"]
    pinned_messages = [m for m in conversation_messages if _is_pinned_conversation_message(m)]
    unpinned_messages = [m for m in conversation_messages if not _is_pinned_conversation_message(m)]

    estimated_conversation_tokens = sum(_estimate_tokens(str(m.get("content", ""))) for m in conversation_messages)

    should_compact = estimated_conversation_tokens >= effective_soft_token_limit

    summary_messages_count = 0
    pinned_messages_count = len(pinned_messages)
    if should_compact and unpinned_messages:
        recent_count = min(effective_recent_message_count, len(unpinned_messages))
        recent_messages = unpinned_messages[-recent_count:]
        old_messages = unpinned_messages[:-recent_count]

        existing_summary_text = "\n".join(
            filter(None, (_extract_summary_body(msg) for msg in summary_system_messages))
        )
        summary_message = _build_summary_message(
            existing_summary_text,
            old_messages,
            summary_max_tokens=effective_summary_max_tokens,
        )

        if old_messages and not summary_message:
            # Avoid dropping history when model-based summarization fails.
            compacted_messages = sanitized
            summary_messages_count = len(summary_system_messages)
            recent_messages_count = len(conversation_messages)
        else:
            kept_unpinned_ids = {id(msg) for msg in recent_messages}
            compacted_messages = [*system_messages]
            if summary_message:
                compacted_messages.append(summary_message)
                summary_messages_count = 1
            for message in conversation_messages:
                if _is_pinned_conversation_message(message):
                    compacted_messages.append(message)
                    continue
                if id(message) in kept_unpinned_ids:
                    compacted_messages.append(message)

            recent_messages_count = len(recent_messages)
    else:
        compacted_messages = sanitized
        summary_messages_count = len(summary_system_messages)
        recent_messages_count = len(conversation_messages)

    estimated_input_tokens = sum(_estimate_tokens(str(m.get("content", ""))) for m in compacted_messages)
    input_tokens = usage_input_tokens if usage_input_tokens > 0 else estimated_input_tokens
    token_source = "usage" if usage_input_tokens > 0 else "estimate"

    return compacted_messages, {
        "input_tokens": input_tokens,
        "output_tokens": latest_usage["completion_tokens"],
        "summary_messages_count": summary_messages_count,
        "recent_messages_count": recent_messages_count,
        "pinned_messages_count": pinned_messages_count,
        "soft_token_limit": effective_soft_token_limit,
        "token_source": token_source,
    }
