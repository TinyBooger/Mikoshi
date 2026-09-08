import re
from math import ceil
from typing import Dict, List, Tuple, Optional
from utils.llm_client import client as llm_client
from utils.usage_utils import normalize_usage


SUMMARY_PREFIX = "Summary of previous conversation:"
ROLE_LABELS = {
    "user": "User",
    "assistant": "Assistant",
}
SUMMARY_MODEL = "deepseek-v4-flash"
SUMMARY_SYSTEM_PROMPT = (
    "You are a conversation memory compressor. "
    "Summarize the provided dialogue history into a compact memory for future turns. "
    "Keep only durable information: user goals, constraints, preferences, key facts, decisions, unresolved items, and important context. "
    "Do not invent facts. Do not include meta commentary. Output plain text only. "
    "The output must be no more than 300 tokens."
)

DEFAULT_SOFT_TOKEN_LIMIT = 8000
DEFAULT_RECENT_MESSAGE_COUNT = 2
DEFAULT_SUMMARY_MAX_TOKENS = 300
# Compaction fires when the estimated request size reaches this fraction of
# the per-turn INPUT budget (not the raw context window — see routes/chat.py,
# which derives the budget and reserves output room there). The ratio exists
# to absorb token-estimator error; 0.95 left far too little margin, and it
# was applied against the wrong (context_length) denominator.
DEFAULT_COMPACTION_TRIGGER_RATIO = 0.85

# Fail-closed guard cushions (see estimate_guard_input). These are placeholders
# invented to absorb estimator error, NOT derived from real error data: the
# "Context estimator | mode=..." log lines in routes/chat.py record actual vs
# estimated tokens per request so these constants can later be replaced with
# numbers backed by the real estimation error on CJK/mixed roleplay text.
ESTIMATOR_FULL_REQUEST_CUSHION = 1.15
ESTIMATOR_DELTA_CUSHION = 1.35


def estimate_guard_input(info: dict, state_update: Optional[dict]) -> int:
    """Estimate the size of the request compaction is about to ship.

    Picks the most reliable available signal (mirrors the trigger logic):
      * a fold that advanced the cursor rebuilt the request from summary +
        recent messages → cushion the estimate of that shaped request;
      * no fold but a measured anchor exists → the previous exact
        ``prompt_tokens`` plus a cushion on the estimate of only the
        never-seen delta (the measured part needs no cushion);
      * otherwise (first turn / legacy history) → cushion the full estimate.

    ``state_update`` is the third return value of ``compact_conversation_messages``;
    it is only ever set when the summarizer call succeeded AND the cursor
    advanced, so a stale/dict-without-``through_message_id`` update must NOT be
    treated as a successful fold (that is the folded-vs-not regression case).
    """
    measured_input = max(0, int(info.get("measured_input_tokens") or 0))
    sent_estimate = max(0, int(info.get("sent_estimate_tokens") or 0))
    estimated_new = max(0, int(info.get("estimated_new_tokens") or 0))
    folded_now = isinstance(state_update, dict) and bool(state_update.get("through_message_id"))
    if folded_now:
        return int(ESTIMATOR_FULL_REQUEST_CUSHION * max(sent_estimate, 1))
    if measured_input > 0:
        return measured_input + int(ESTIMATOR_DELTA_CUSHION * estimated_new)
    return int(ESTIMATOR_FULL_REQUEST_CUSHION * max(sent_estimate, estimated_new, 1))


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


async def _summarize_with_prompt(summary_input: str, *, summary_max_tokens: int) -> tuple[str, dict[str, int]]:
    if not summary_input:
        return "", normalize_usage(None)

    response = await llm_client.chat.completions.create(
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
    usage = normalize_usage(getattr(response, "usage", None))
    return _normalize_text(content), usage


async def _build_summary_message(
    existing_summary_text: str,
    old_messages: List[dict],
    *,
    summary_max_tokens: int,
) -> tuple[dict | None, dict[str, int]]:
    if not existing_summary_text and not old_messages:
        return None, normalize_usage(None)

    summary_input = _build_summary_prompt_input(existing_summary_text, old_messages)
    summary_body = ""
    summary_usage = normalize_usage(None)
    try:
        summary_body, summary_usage = await _summarize_with_prompt(summary_input, summary_max_tokens=summary_max_tokens)
    except Exception:
        summary_body = ""
        summary_usage = normalize_usage(None)

    if not summary_body and existing_summary_text:
        # Keep previous memory if summarization fails.
        summary_body = existing_summary_text

    if not summary_body:
        return None, summary_usage

    return {
        "role": "system",
        "content": f"{SUMMARY_PREFIX}\n{summary_body}",
    }, summary_usage


def _find_message_index(messages: List[dict], message_id: str) -> Optional[int]:
    """Return the index of the first message whose ``message_id`` equals *message_id*."""
    needle = str(message_id or "").strip()
    if not needle:
        return None
    for index, message in enumerate(messages):
        if str(message.get("message_id") or "").strip() == needle:
            return index
    return None


def _estimate_messages(messages: List[dict]) -> int:
    return sum(_estimate_tokens(str(m.get("content", ""))) for m in messages)


async def compact_conversation_messages(
    messages: List[dict],
    *,
    soft_token_limit: int = DEFAULT_SOFT_TOKEN_LIMIT,
    recent_message_count: int = DEFAULT_RECENT_MESSAGE_COUNT,
    summary_max_tokens: int = DEFAULT_SUMMARY_MAX_TOKENS,
    summary_state: Optional[dict] = None,
    branch_id: Optional[str] = None,
    measure_only: bool = False,
    force_compact: bool = False,
) -> Tuple[List[dict], Dict[str, object], Optional[dict]]:
    sanitized = _sanitize_messages(messages)
    empty_info = {
        "input_tokens": 0,
        "output_tokens": 0,
        "total_tokens": 0,
        "summary_usage": normalize_usage(None),
        "summary_calls": 0,
        "summary_messages_count": 0,
        "recent_messages_count": 0,
        "pinned_messages_count": 0,
        "soft_token_limit": soft_token_limit,
        "token_source": "usage",
        "measured_input_tokens": 0,
        "sent_estimate_tokens": 0,
        "estimated_new_tokens": 0,
        "trigger_input_tokens": 0,
    }
    if not sanitized:
        return [], empty_info, None

    effective_soft_token_limit = max(1, int(soft_token_limit or DEFAULT_SOFT_TOKEN_LIMIT))
    effective_recent_message_count = max(1, int(recent_message_count))
    effective_summary_max_tokens = max(64, int(summary_max_tokens))
    compaction_trigger_tokens = max(1, int(effective_soft_token_limit * DEFAULT_COMPACTION_TRIGGER_RATIO))

    latest_usage = _latest_assistant_usage(sanitized)
    usage_input_tokens = latest_usage["prompt_tokens"]
    usage_total_tokens = latest_usage["total_tokens"]

    summary_system_messages = [m for m in sanitized if _is_summary_system_message(m)]
    system_messages = [m for m in sanitized if m.get("role") == "system" and not _is_summary_system_message(m)]
    conversation_messages = [m for m in sanitized if m.get("role") != "system"]
    pinned_messages = [m for m in conversation_messages if _is_pinned_conversation_message(m)]
    pinned_ids = {id(m) for m in pinned_messages}
    unpinned_messages = [m for m in conversation_messages if id(m) not in pinned_ids]

    # --- Persisted rolling-summary state (per chat branch) -------------------
    # summary_state: {branch_id: {"text": str, "through_message_id": str}}
    # ``text`` is the summary (overwritten in place on every fold) and
    # ``through_message_id`` marks the last RAW message whose content is
    # already folded into it. Request reconstruction keeps only messages that
    # come after that cursor. The state is honored only when the cursor
    # message still exists in the incoming history; otherwise (edited, forked
    # or deleted history) it is stale and we rebuild from the raw messages.
    state_text = ""
    cursor_index: Optional[int] = None
    if isinstance(summary_state, dict) and isinstance(branch_id, str) and branch_id.strip():
        branch_state = summary_state.get(branch_id.strip())
        if isinstance(branch_state, dict):
            stored_text = str(branch_state.get("text") or "").strip()
            through_id = str(branch_state.get("through_message_id") or "").strip()
            found_index = _find_message_index(conversation_messages, through_id)
            if stored_text and through_id and found_index is not None:
                state_text = stored_text
                cursor_index = found_index

    # Legacy chats (created before the cursor existed) may carry the summary as
    # an inline "Summary of previous conversation:" system message instead.
    legacy_summary_text = "\n".join(
        filter(None, (_extract_summary_body(msg) for msg in summary_system_messages))
    ).strip()
    has_persisted_state = cursor_index is not None
    summary_text = state_text if has_persisted_state else legacy_summary_text

    summary_messages_count = 0
    summary_usage = normalize_usage(None)
    pinned_messages_count = len(pinned_messages)
    recent_messages_count = len(conversation_messages)

    # ------------------------------------------------------------------
    # Trigger signal.
    #
    # Providers count the whole request (system + summary + conversation)
    # against the context window, so we measure the request that would actually
    # be sent when compaction does NOT run. The primary signal is the *measured*
    # size of the previous request — the exact prompt_tokens the provider
    # reported on the most recent assistant message — plus an estimate of only
    # the messages the model has never seen (turns added since that
    # measurement). The naive estimator is deliberately just a pre-first-request
    # fallback and a floor against edits/pinning, never the primary signal once
    # real usage exists.
    pinned_indexes = {i for i, m in enumerate(conversation_messages) if id(m) in pinned_ids}

    def _message_in_request(index: int) -> bool:
        # With a persisted rolling-summary cursor the request keeps pinned
        # messages verbatim plus everything after the cursor; otherwise the
        # raw conversation is sent as-is.
        if has_persisted_state:
            return index in pinned_indexes or index > (cursor_index if cursor_index is not None else -1)
        return True

    # Floor / fallback: naive estimate of the un-compacted request.
    naive_shape_estimate = _estimate_messages(system_messages)
    if summary_text:
        naive_shape_estimate += _estimate_tokens(summary_text)
    naive_shape_estimate += _estimate_messages(
        m for i, m in enumerate(conversation_messages) if _message_in_request(i)
    )

    measured_anchor_index: Optional[int] = None
    measured_anchor_tokens = 0
    for index in range(len(conversation_messages) - 1, -1, -1):
        if conversation_messages[index].get("role") != "assistant":
            continue
        anchor_usage = normalize_usage(conversation_messages[index].get("usage"))
        if anchor_usage["prompt_tokens"] > 0:
            measured_anchor_index = index
            measured_anchor_tokens = anchor_usage["prompt_tokens"]
            break

    if measured_anchor_index is not None:
        estimated_new_tokens = sum(
            _estimate_tokens(str(m.get("content", "")))
            for i, m in enumerate(conversation_messages)
            if i > measured_anchor_index and _message_in_request(i)
        )
        trigger_estimate = max(measured_anchor_tokens + estimated_new_tokens, naive_shape_estimate)
    else:
        # No measured request yet (first turn / legacy history): the naive
        # estimate is the only signal, and the whole shape is unmeasured.
        estimated_new_tokens = naive_shape_estimate
        trigger_estimate = naive_shape_estimate

    should_compact = trigger_estimate >= compaction_trigger_tokens

    summary_state_update: Optional[dict] = None
    if not measure_only and conversation_messages and (should_compact or force_compact):
        if force_compact:
            # Emergency pass (routes/chat.py fail-closed rung): fold everything
            # except the most recent turns and ignore pinning entirely — pinned
            # messages beyond the recent window are compressed too. This runs
            # once, only when a normal compaction still left the request over
            # the provider's input cap.
            tail_window = (
                conversation_messages[cursor_index + 1 :]
                if cursor_index is not None
                else conversation_messages
            )
            recent_raw = tail_window[-effective_recent_message_count:]
            old_messages = tail_window[:-effective_recent_message_count]
        elif has_persisted_state:
            tail_unpinned = [m for m in conversation_messages[cursor_index + 1:] if id(m) not in pinned_ids]
            recent_raw = tail_unpinned[-effective_recent_message_count:]
            old_messages = tail_unpinned[:-effective_recent_message_count]
        else:
            recent_raw = unpinned_messages[-effective_recent_message_count:]
            old_messages = unpinned_messages[:-effective_recent_message_count]
        recent_raw_ids = {id(m) for m in recent_raw}
        old_messages = [m for m in old_messages if id(m) not in recent_raw_ids]

        if old_messages:
            previous_text = summary_text
            summary_message, summary_usage = await _build_summary_message(
                previous_text,
                old_messages,
                summary_max_tokens=effective_summary_max_tokens,
            )
            # Only advance the cursor when the summary was actually rewritten;
            # a failed call keeps the previous text and must NOT drop raw
            # messages that were never folded into it.
            folded_ok = summary_message is not None and (
                summary_usage["total_tokens"] > 0 or not previous_text
            )
            if folded_ok:
                last_message_id = str(old_messages[-1].get("message_id") or "").strip()
                resolved_index = _find_message_index(conversation_messages, last_message_id)
                if last_message_id and resolved_index is not None:
                    summary_text = _extract_summary_body(summary_message)
                    cursor_index = resolved_index
                    has_persisted_state = True
                    summary_messages_count = 1
                    recent_messages_count = len(recent_raw)
                    summary_state_update = {
                        "text": summary_text,
                        "through_message_id": last_message_id,
                    }

    # Reconstruct the request the model actually sees:
    # [character card / system prompt] + [summary, if any] + raw messages that
    # come after the cursor (pinned messages are always kept verbatim).
    if has_persisted_state and summary_text:
        compacted_messages = [*system_messages]
        compacted_messages.append({"role": "system", "content": f"{SUMMARY_PREFIX}\n{summary_text}"})
        if cursor_index is not None:
            for index, message in enumerate(conversation_messages):
                # Normal passes keep pinned messages verbatim; an emergency
                # force pass compressed them too, so only post-cursor messages
                # survive the rebuild.
                if (not force_compact and id(message) in pinned_ids) or index > cursor_index:
                    compacted_messages.append(message)
        if summary_messages_count == 0:
            summary_messages_count = 1
        recent_messages_count = sum(1 for m in compacted_messages if m.get("role") != "system")
    else:
        compacted_messages = sanitized
        if summary_messages_count == 0:
            summary_messages_count = len(summary_system_messages)

    estimated_input_tokens = _estimate_messages(compacted_messages)
    input_tokens = usage_input_tokens if usage_input_tokens > 0 else estimated_input_tokens
    output_tokens = latest_usage["completion_tokens"]
    total_tokens = usage_total_tokens if usage_total_tokens > 0 else input_tokens + output_tokens
    token_source = "usage" if usage_input_tokens > 0 else "estimate"

    return compacted_messages, {
        "input_tokens": input_tokens,
        "output_tokens": output_tokens,
        "total_tokens": total_tokens,
        "summary_usage": summary_usage,
        "summary_calls": 1 if summary_usage["total_tokens"] > 0 else 0,
        "summary_messages_count": summary_messages_count,
        "recent_messages_count": recent_messages_count,
        "pinned_messages_count": pinned_messages_count,
        "soft_token_limit": effective_soft_token_limit,
        "compaction_trigger_tokens": compaction_trigger_tokens,
        "token_source": token_source,
        "measured_input_tokens": measured_anchor_tokens if measured_anchor_index is not None else 0,
        "sent_estimate_tokens": estimated_input_tokens,
        "estimated_new_tokens": estimated_new_tokens,
        "trigger_input_tokens": trigger_estimate,
    }, summary_state_update
