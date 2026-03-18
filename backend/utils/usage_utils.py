from __future__ import annotations

from typing import Any


def _to_non_negative_int(value: Any) -> int:
    try:
        return max(0, int(value))
    except (TypeError, ValueError):
        return 0


def normalize_usage(usage: Any) -> dict[str, int]:
    """Normalize provider usage payload into prompt/completion/total token integers."""
    if usage is None:
        return {
            "prompt_tokens": 0,
            "completion_tokens": 0,
            "total_tokens": 0,
        }

    if isinstance(usage, dict):
        prompt_tokens = _to_non_negative_int(usage.get("prompt_tokens"))
        completion_tokens = _to_non_negative_int(usage.get("completion_tokens"))
        total_tokens = _to_non_negative_int(usage.get("total_tokens"))
    else:
        prompt_tokens = _to_non_negative_int(getattr(usage, "prompt_tokens", 0))
        completion_tokens = _to_non_negative_int(getattr(usage, "completion_tokens", 0))
        total_tokens = _to_non_negative_int(getattr(usage, "total_tokens", 0))

    if total_tokens <= 0:
        total_tokens = prompt_tokens + completion_tokens

    return {
        "prompt_tokens": prompt_tokens,
        "completion_tokens": completion_tokens,
        "total_tokens": total_tokens,
    }

