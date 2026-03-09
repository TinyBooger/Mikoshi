from __future__ import annotations

from typing import Any

import tiktoken

try:
    _ENCODING = tiktoken.get_encoding("cl100k_base")
except Exception:
    # Fail fast so token accounting is always tokenizer-based.
    _ENCODING = tiktoken.encoding_for_model("gpt-4o-mini")


def estimate_text_tokens(text: str) -> int:
    if not text:
        return 0
    return len(_ENCODING.encode(text))


def _estimate_content_tokens(content: Any) -> int:
    if content is None:
        return 0
    if isinstance(content, str):
        return estimate_text_tokens(content)
    if isinstance(content, list):
        total = 0
        for item in content:
            if isinstance(item, str):
                total += estimate_text_tokens(item)
                continue
            if isinstance(item, dict):
                text_value = item.get("text") or item.get("content") or item.get("input_text")
                if isinstance(text_value, str):
                    total += estimate_text_tokens(text_value)
                    continue
                item_type = str(item.get("type") or "")
                if item_type in {"image_url", "input_image", "image"}:
                    # Non-text multimodal blocks still consume prompt tokens.
                    total += 85
                else:
                    total += 12
                continue
            total += estimate_text_tokens(str(item))
        return total
    if isinstance(content, dict):
        text_value = content.get("text") or content.get("content") or content.get("input_text")
        if isinstance(text_value, str):
            return estimate_text_tokens(text_value)
        item_type = str(content.get("type") or "")
        if item_type in {"image_url", "input_image", "image"}:
            return 85
        return max(1, estimate_text_tokens(str(content)) // 2)

    return estimate_text_tokens(str(content))


def estimate_tokens_from_messages(messages: Any) -> int:
    if not isinstance(messages, list):
        return 0

    total = 0
    for message in messages:
        if not isinstance(message, dict):
            continue

        role = str(message.get("role") or "user")
        content = message.get("content")
        name = message.get("name")

        # Chat-format overhead approximation.
        total += 4
        total += estimate_text_tokens(role)
        total += _estimate_content_tokens(content)
        if isinstance(name, str) and name:
            total += estimate_text_tokens(name)

    # Reply priming overhead.
    total += 2
    return max(0, total)
