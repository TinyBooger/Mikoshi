from __future__ import annotations

from typing import Any

from model_configs import get_model


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


def usage_to_credits(usage: Any, model_id: str) -> float:
    """
    Convert a usage payload into credits (点数) using the model's pricing.

    Returns 0.0 when the model is unknown or usage is empty.
    """
    normalized = normalize_usage(usage)
    if normalized["total_tokens"] <= 0:
        return 0.0

    model_cfg = get_model(model_id)
    if not model_cfg:
        return 0.0

    return model_cfg.tokens_to_credits(
        normalized["prompt_tokens"],
        normalized["completion_tokens"],
    )

