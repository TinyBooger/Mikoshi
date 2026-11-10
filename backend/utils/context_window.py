import asyncio
import re
import logging
from math import ceil
from typing import Dict, List, Tuple, Optional
from utils.llm_client import client as llm_client
from utils.usage_utils import normalize_usage

logger = logging.getLogger(__name__)

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
SUMMARY_REQUEST_TOKEN_LIMIT = 12000
SUMMARY_CHUNK_TOKEN_LIMIT = 8000
SUMMARY_MESSAGE_TOKEN_LIMIT = 4000
SUMMARY_MESSAGE_CHARACTER_LIMIT = 3000
MAX_SUMMARY_CHUNKS = 64
SUMMARY_ESTIMATE_SAFETY_FACTOR = 1.25
CONTEXT_FALLBACK_MARKER = (
    "Older conversation context was omitted to fit the model context window. "
    "Continue from the remaining messages and the user's latest message."
)
# Compaction fires when the estimated size of the FOLDABLE request (summary +
# conversation) reaches this fraction of the per-turn INPUT budget left after
# the character card / system prompt is paid for (not the raw context window —
# see routes/chat.py, which derives the budget and reserves output room there).
# The ratio exists to absorb token-estimator error; 0.95 left far too little
# margin, and it was applied against the wrong (context_length) denominator.
#
# The system prompt must NOT be part of the numerator: it is never a fold
# candidate, so counting it made the trigger a constant once
# ``system prompt + summary + recent turns`` crossed the threshold — see
# compact_conversation_messages for how the budget is split.
DEFAULT_COMPACTION_TRIGGER_RATIO = 0.85

# A fold costs one non-streaming summarizer round-trip plus a rewrite of the
# stored summary, so it has to be worth doing. In steady state the fold window
# ("everything after the cursor minus the recent tail") is exactly ONE message
# once the cursor is current: folding it bought back a single turn while
# charging an LLM call, so the summarizer ran on every request. Requiring a
# minimum number of messages — and a minimum reclaimed size — makes a fold
# amortize several turns of history instead.
DEFAULT_MIN_FOLD_MESSAGES = 4
DEFAULT_MIN_FOLD_SAVING_TOKENS = 64

# Fail-closed guard cushion. This is a placeholder invented to absorb
# estimator error, NOT derived from real error data:
# "Context estimator | mode=..." log lines in routes/chat.py record actual vs
# estimated tokens per request so these constants can later be replaced with
# numbers backed by the real estimation error on CJK/mixed roleplay text.
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


def _truncate_summary_text(text: str, max_tokens: int) -> str:
    normalized = _normalize_text(text)
    if _estimate_tokens(normalized) <= max_tokens:
        return normalized

    marker = " [ ... middle of this message omitted ... ] "
    low, high = 0, len(normalized)
    best = marker.strip()
    while low <= high:
        retained_chars = (low + high) // 2
        head_chars = (retained_chars + 1) // 2
        tail_chars = retained_chars // 2
        candidate = (
            normalized[:head_chars].rstrip()
            + marker
            + (normalized[-tail_chars:].lstrip() if tail_chars else "")
        )
        if _estimate_tokens(candidate) <= max_tokens:
            best = candidate
            low = retained_chars + 1
        else:
            high = retained_chars - 1
    return best


def _truncate_summary_message(text: str) -> str:
    normalized = _normalize_text(text)
    if len(normalized) <= SUMMARY_MESSAGE_CHARACTER_LIMIT:
        return normalized

    marker = "[中间内容已省略]"
    retained_chars = SUMMARY_MESSAGE_CHARACTER_LIMIT - len(marker)
    head_chars = (retained_chars + 1) // 2
    tail_chars = retained_chars // 2
    return normalized[:head_chars].rstrip() + marker + normalized[-tail_chars:].lstrip()


def _pack_summary_entries(entries: List[str], *, prefix: str = "[New messages to compress]") -> List[str]:
    chunks: List[str] = []
    current_entries = [prefix]
    for entry in entries:
        candidate = "\n".join([*current_entries, entry])
        if len(current_entries) > 1 and _estimate_tokens(candidate) > SUMMARY_CHUNK_TOKEN_LIMIT:
            chunks.append("\n".join(current_entries))
            current_entries = [prefix, entry]
        else:
            current_entries.append(entry)
    if len(current_entries) > 1 or not chunks:
        chunks.append("\n".join(current_entries))
    return chunks


def _build_summary_chunks(existing_summary_text: str, old_messages: List[dict]) -> List[str]:
    entries: List[str] = []
    if existing_summary_text:
        bounded_summary = _truncate_summary_text(existing_summary_text, SUMMARY_MESSAGE_TOKEN_LIMIT)
        entries.append(f"[Existing summary]\n{bounded_summary}")

    for message in old_messages:
        role = str(message.get("role", "")).strip().lower()
        content = _normalize_text(str(message.get("content", "")))
        if role not in {"user", "assistant"} or not content:
            continue
        role_label = ROLE_LABELS.get(role, role.title())
        bounded_content = _truncate_summary_message(content)
        entries.append(f"{role_label}: {bounded_content}")

    return _pack_summary_entries(entries)


def _summary_request_estimate(summary_input: str, summary_max_tokens: int) -> int:
    estimate = (
        _estimate_tokens(SUMMARY_SYSTEM_PROMPT)
        + _estimate_tokens(summary_input)
        + max(0, int(summary_max_tokens))
    )
    return int(estimate * SUMMARY_ESTIMATE_SAFETY_FACTOR) + 128


def _add_summary_usage(total: dict[str, int], usage: dict[str, int]) -> None:
    for key in ("prompt_tokens", "completion_tokens", "total_tokens"):
        total[key] += int(usage.get(key, 0) or 0)


async def _summarize_with_prompt(summary_input: str, *, summary_max_tokens: int) -> tuple[str, dict[str, int]]:
    if not summary_input:
        return "", normalize_usage(None)

    request_estimate = _summary_request_estimate(summary_input, summary_max_tokens)
    if request_estimate > SUMMARY_REQUEST_TOKEN_LIMIT:
        raise ValueError(
            f"Summary request estimate {request_estimate} exceeds "
            f"the {SUMMARY_REQUEST_TOKEN_LIMIT}-token safety limit"
        )

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


async def _summarize_bounded_chunks(
    existing_summary_text: str,
    old_messages: List[dict],
    *,
    summary_max_tokens: int,
) -> tuple[str, dict[str, int], int]:
    chunks = _build_summary_chunks(existing_summary_text, old_messages)
    total_usage = normalize_usage(None)
    summary_calls = 0
    if len(chunks) > MAX_SUMMARY_CHUNKS:
        logger.warning(
            "Conversation summary requires %d chunks; maximum is %d",
            len(chunks),
            MAX_SUMMARY_CHUNKS,
        )
        return "", total_usage, summary_calls
    logger.info(
        "Conversation summary started | old_messages=%d | input_chunks=%d | has_existing_summary=%s",
        len(old_messages),
        len(chunks),
        bool(existing_summary_text),
    )

    async def summarize_chunks(inputs: List[str], *, stage: str) -> Optional[List[str]]:
        nonlocal summary_calls
        results: List[str] = []
        for batch_start in range(0, len(inputs), 4):
            batch = inputs[batch_start:batch_start + 4]
            logger.info(
                "Conversation summary requests | stage=%s | chunks=%d-%d/%d",
                stage,
                batch_start + 1,
                batch_start + len(batch),
                len(inputs),
            )
            responses = await asyncio.gather(
                *(
                    _summarize_with_prompt(
                        summary_input,
                        summary_max_tokens=summary_max_tokens,
                    )
                    for summary_input in batch
                ),
                return_exceptions=True,
            )
            summary_calls += len(batch)
            batch_failed = False
            for offset, result in enumerate(responses):
                chunk_number = batch_start + offset + 1
                if isinstance(result, asyncio.CancelledError):
                    raise result
                if isinstance(result, BaseException):
                    logger.warning(
                        "Conversation summary chunk %d/%d failed: %s",
                        chunk_number,
                        len(inputs),
                        result,
                        exc_info=(type(result), result, result.__traceback__),
                    )
                    batch_failed = True
                    continue

                body, usage = result
                _add_summary_usage(total_usage, usage)
                if not body:
                    logger.warning(
                        "Conversation summary chunk %d/%d returned no summary",
                        chunk_number,
                        len(inputs),
                    )
                    batch_failed = True
                else:
                    results.append(
                        _truncate_summary_text(
                            body,
                            max(64, int(summary_max_tokens)),
                        )
                    )
            if batch_failed:
                return None
        return results

    summaries = await summarize_chunks(chunks, stage="messages")
    if not summaries:
        logger.warning(
            "Conversation summary stopped | stage=messages | calls=%d | total_tokens=%d",
            summary_calls,
            total_usage["total_tokens"],
        )
        return "", total_usage, summary_calls

    reduction_round = 0
    while len(summaries) > 1:
        reduction_round += 1
        entries = [
            f"[Summary of chunk {index + 1}]\n{summary}"
            for index, summary in enumerate(summaries)
        ]
        reduction_chunks = _pack_summary_entries(
            entries,
            prefix="[Summaries to combine]",
        )
        logger.info(
            "Conversation summary reduction | round=%d | summaries=%d | reduction_chunks=%d",
            reduction_round,
            len(summaries),
            len(reduction_chunks),
        )
        reduced = await summarize_chunks(reduction_chunks, stage=f"reduce-{reduction_round}")
        if not reduced:
            logger.warning(
                "Conversation summary stopped | stage=reduce-%d | calls=%d | total_tokens=%d",
                reduction_round,
                summary_calls,
                total_usage["total_tokens"],
            )
            return "", total_usage, summary_calls
        summaries = reduced

    logger.info(
        "Conversation summary completed | calls=%d | total_tokens=%d | reduction_rounds=%d",
        summary_calls,
        total_usage["total_tokens"],
        reduction_round,
    )
    return summaries[0], total_usage, summary_calls


async def _build_summary_message(
    existing_summary_text: str,
    old_messages: List[dict],
    *,
    summary_max_tokens: int,
) -> tuple[dict | None, dict[str, int], int]:
    if not existing_summary_text and not old_messages:
        return None, normalize_usage(None), 0

    summary_body = ""
    summary_usage = normalize_usage(None)
    summary_calls = 0
    try:
        summary_body, summary_usage, summary_calls = await _summarize_bounded_chunks(
            existing_summary_text,
            old_messages,
            summary_max_tokens=summary_max_tokens,
        )
    except Exception:
        logger.exception("Conversation history summarization failed")
        summary_body = ""

    if not summary_body and existing_summary_text:
        # Keep previous memory if summarization fails.
        summary_body = existing_summary_text

    if not summary_body:
        return None, summary_usage, summary_calls

    return {
        "role": "system",
        "content": f"{SUMMARY_PREFIX}\n{summary_body}",
    }, summary_usage, summary_calls


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


def build_imported_context_summary(
    messages: List[dict],
    *,
    soft_token_limit: int,
    system_prompt: str = "",
) -> Optional[dict]:
    """Seed a cursor for imported history up to the normal compaction trigger.

    Always retain at least the newest message, even if it alone exceeds the budget.
    """
    conversation_messages = [
        message
        for message in _sanitize_messages(messages)
        if message.get("role") in {"user", "assistant"}
    ]
    if not conversation_messages:
        return None

    foldable_token_budget = max(
        1,
        int(soft_token_limit) - _estimate_tokens(system_prompt),
    )
    trigger_token_limit = max(
        1,
        int(foldable_token_budget * DEFAULT_COMPACTION_TRIGGER_RATIO),
    )
    summary_text = (
        "这是用户导入的一段较长对话。较早的未置顶消息未纳入当前上下文；"
        "较新的消息以及任何已置顶的较早消息仍可用于对话。"
    )
    retention_limit = max(
        1,
        trigger_token_limit - _estimate_tokens(summary_text),
    )
    retained_start = len(conversation_messages)
    retained_tokens = 0
    for index in range(len(conversation_messages) - 1, -1, -1):
        message_tokens = _estimate_tokens(conversation_messages[index]["content"])
        if retained_tokens and retained_tokens + message_tokens > retention_limit:
            break
        retained_tokens += message_tokens
        retained_start = index

    if retained_start == 0:
        return None

    through_message_id = str(
        conversation_messages[retained_start - 1].get("message_id") or ""
    ).strip()
    if not through_message_id:
        raise ValueError("Imported messages must have IDs before setting the summary cursor")

    return {
        "text": summary_text,
        "through_message_id": through_message_id,
    }


def estimate_request_input_tokens(messages: List[dict]) -> int:
    """Estimate a built request with a cushion for token-estimator error."""
    return int(ESTIMATOR_FULL_REQUEST_CUSHION * max(_estimate_messages(messages), 1))


async def compact_conversation_messages(
    messages: List[dict],
    *,
    soft_token_limit: int = DEFAULT_SOFT_TOKEN_LIMIT,
    recent_message_count: int = DEFAULT_RECENT_MESSAGE_COUNT,
    summary_max_tokens: int = DEFAULT_SUMMARY_MAX_TOKENS,
    summary_state: Optional[dict] = None,
    branch_id: Optional[str] = None,
    measure_only: bool = False,
    min_fold_messages: int = DEFAULT_MIN_FOLD_MESSAGES,
    min_fold_saving_tokens: int = DEFAULT_MIN_FOLD_SAVING_TOKENS,
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
        "compaction_trigger_tokens": 0,
        "system_prompt_tokens": 0,
        "foldable_token_budget": 0,
        "fold_candidate_tokens": 0,
        "fold_saving_tokens": 0,
        "fold_skipped_reason": None,
    }
    if not sanitized:
        return [], empty_info, None

    effective_soft_token_limit = max(1, int(soft_token_limit or DEFAULT_SOFT_TOKEN_LIMIT))
    effective_recent_message_count = max(1, int(recent_message_count))
    effective_summary_max_tokens = max(64, int(summary_max_tokens))
    effective_min_fold_messages = max(1, int(min_fold_messages))
    effective_min_fold_saving_tokens = max(0, int(min_fold_saving_tokens))

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
    summary_call_count = 0
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
    #
    # Everything below is measured over the FOLDABLE portion only (summary +
    # conversation). The character card / system prompt is a fixed cost that no
    # amount of folding can reclaim, so it is subtracted from the budget rather
    # than counted towards the trigger — counting it made the trigger
    # permanently true once system prompt + summary + recent turns crossed the
    # threshold, which is what made the summarizer fire on every request.
    pinned_indexes = {i for i, m in enumerate(conversation_messages) if id(m) in pinned_ids}

    def _message_in_request(index: int) -> bool:
        # With a persisted rolling-summary cursor the request keeps pinned
        # messages verbatim plus everything after the cursor; otherwise the
        # raw conversation is sent as-is.
        if has_persisted_state:
            return index in pinned_indexes or index > (cursor_index if cursor_index is not None else -1)
        return True

    # Budget split: the system prompt is paid for first, and only what is left
    # can be spent on the summary + conversation the fold can actually shrink.
    system_prompt_tokens = _estimate_messages(system_messages)
    foldable_token_budget = max(1, effective_soft_token_limit - system_prompt_tokens)
    compaction_trigger_tokens = max(1, int(foldable_token_budget * DEFAULT_COMPACTION_TRIGGER_RATIO))

    # Floor / fallback: naive estimate of the foldable part of the request —
    # what would actually be sent when compaction does NOT run. The system
    # prompt is excluded (see the budget split above).
    naive_foldable_estimate = _estimate_tokens(summary_text) if summary_text else 0
    naive_foldable_estimate += _estimate_messages(
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
        # The measured prompt_tokens covers the whole request of that turn, so
        # strip the system prompt to keep both sides of the comparison on the
        # foldable portion only (`estimated_new_tokens` is already messages-only).
        measured_foldable_anchor = max(0, measured_anchor_tokens - system_prompt_tokens)
        trigger_estimate = max(
            measured_foldable_anchor + estimated_new_tokens,
            naive_foldable_estimate,
        )
    else:
        # No measured request yet (first turn / legacy history): the naive
        # estimate is the only signal, and the whole shape is unmeasured.
        estimated_new_tokens = naive_foldable_estimate
        trigger_estimate = naive_foldable_estimate

    should_compact = trigger_estimate >= compaction_trigger_tokens
    if not measure_only:
        logger.info(
            "Context summary decision | branch=%s | trigger_tokens=%d | trigger_threshold=%d | will_compact=%s | existing_summary=%s",
            branch_id or "default",
            trigger_estimate,
            compaction_trigger_tokens,
            should_compact,
            bool(summary_text),
        )

    summary_state_update: Optional[dict] = None
    fold_candidate_tokens = 0
    fold_saving_tokens = 0
    fold_skipped_reason: Optional[str] = None
    if not measure_only and conversation_messages and should_compact:
        if has_persisted_state:
            tail_unpinned = [m for m in conversation_messages[cursor_index + 1:] if id(m) not in pinned_ids]
            recent_raw = tail_unpinned[-effective_recent_message_count:]
            old_messages = tail_unpinned[:-effective_recent_message_count]
        else:
            recent_raw = unpinned_messages[-effective_recent_message_count:]
            old_messages = unpinned_messages[:-effective_recent_message_count]
        recent_raw_ids = {id(m) for m in recent_raw}
        old_messages = [m for m in old_messages if id(m) not in recent_raw_ids]
        fold_candidate_tokens = _estimate_messages(old_messages)

        # --- Is this fold worth an extra summarizer round-trip? -------------
        # Folding a single aged-out message charges a full non-streaming LLM
        # call to buy back one turn, and because the cursor then sits one
        # message behind again it repeats on the very next request. Require a
        # minimum number of candidates (and a minimum reclaimable size) so a
        # fold amortizes several turns instead.
        if not old_messages:
            fold_skipped_reason = "nothing_to_fold"
        else:
            if len(old_messages) < effective_min_fold_messages:
                fold_skipped_reason = "too_few_messages"
            elif fold_candidate_tokens <= effective_min_fold_saving_tokens:
                fold_skipped_reason = "not_worth_it"

        if should_compact and fold_skipped_reason:
            logger.info(
                "Context summary skipped | branch=%s | reason=%s | candidate_messages=%d | candidate_tokens=%d",
                branch_id or "default",
                fold_skipped_reason,
                len(old_messages),
                fold_candidate_tokens,
            )

        if old_messages and fold_skipped_reason is None:
            previous_text = summary_text
            summary_message, summary_usage, summary_call_count = await _build_summary_message(
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
            # ...and only when the fold genuinely reclaims context. A summary
            # as large as the messages it replaces would drop them from the
            # request without shrinking it, so the raw messages are cheaper.
            if folded_ok:
                fold_saving_tokens = fold_candidate_tokens - _estimate_tokens(
                    _extract_summary_body(summary_message)
                )
                if fold_saving_tokens < effective_min_fold_saving_tokens:
                    folded_ok = False
                    fold_skipped_reason = "no_saving"
                    logger.info(
                        "Context summary not applied | branch=%s | reason=no_saving | candidate_tokens=%d | summary_tokens=%d",
                        branch_id or "default",
                        fold_candidate_tokens,
                        _estimate_tokens(_extract_summary_body(summary_message)),
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
                    logger.info(
                        "Context summary applied | branch=%s | through_message_id=%s | folded_messages=%d | candidate_tokens=%d | reclaimed_tokens=%d | summary_calls=%d",
                        branch_id or "default",
                        last_message_id,
                        len(old_messages),
                        fold_candidate_tokens,
                        fold_saving_tokens,
                        summary_call_count,
                    )
            elif summary_message is None:
                logger.warning(
                    "Context summary not applied | branch=%s | reason=no_summary_returned | candidate_messages=%d | summary_calls=%d",
                    branch_id or "default",
                    len(old_messages),
                    summary_call_count,
                )
            elif not folded_ok:
                logger.info(
                    "Context summary not applied | branch=%s | reason=summary_not_rewritten | existing_summary=%s | summary_calls=%d",
                    branch_id or "default",
                    bool(previous_text),
                    summary_call_count,
                )

    # Reconstruct the request the model actually sees:
    # [character card / system prompt] + [summary, if any] + raw messages that
    # come after the cursor (pinned messages are always kept verbatim).
    if has_persisted_state and summary_text:
        compacted_messages = [*system_messages]
        compacted_messages.append({"role": "system", "content": f"{SUMMARY_PREFIX}\n{summary_text}"})
        if cursor_index is not None:
            for index, message in enumerate(conversation_messages):
                if id(message) in pinned_ids or index > cursor_index:
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
        "summary_calls": summary_call_count,
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
        "system_prompt_tokens": system_prompt_tokens,
        "foldable_token_budget": foldable_token_budget,
        "fold_candidate_tokens": fold_candidate_tokens,
        "fold_saving_tokens": fold_saving_tokens,
        "fold_skipped_reason": fold_skipped_reason,
    }, summary_state_update
