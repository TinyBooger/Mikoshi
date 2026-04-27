import os
from datetime import datetime, UTC

from utils.user_utils import is_pro_active


def _get_int_env(name: str, default: int) -> int:
    raw = os.getenv(name)
    if raw is None:
        return default
    try:
        value = int(raw)
        return value if value >= 0 else default
    except (TypeError, ValueError):
        return default


def _is_user_chat_request(messages) -> bool:
    if not isinstance(messages, list) or not messages:
        return False
    last_message = messages[-1] if isinstance(messages[-1], dict) else None
    if not last_message:
        return False
    return last_message.get("role") == "user"


def get_message_limit_info(user) -> dict:
    current_count = 0

    is_pro = is_pro_active(user)
    cap = _get_int_env("NON_PRO_DAILY_MESSAGE_CAP", 100)
    warning_remaining = _get_int_env("NON_PRO_DAILY_MESSAGE_WARNING_REMAINING", 10)

    if is_pro or cap <= 0:
        return {
            "is_pro": True,
            "is_limited": False,
            "daily_message_count": current_count,
            "daily_message_cap": None,
            "remaining_messages": None,
            "approaching_limit": False,
            "limit_reached": False,
            "warning_remaining": warning_remaining,
            "reset_at": None,
        }

    remaining = max(0, cap - current_count)
    approaching = remaining <= warning_remaining and remaining > 0

    return {
        "is_pro": False,
        "is_limited": True,
        "daily_message_count": current_count,
        "daily_message_cap": cap,
        "remaining_messages": remaining,
        "approaching_limit": approaching,
        "limit_reached": remaining <= 0,
        "warning_remaining": warning_remaining,
        "reset_at": datetime.now(UTC).isoformat(),
    }


def can_send_user_message(user, messages) -> dict:
    info = get_message_limit_info(user)
    is_user_request = _is_user_chat_request(messages)

    blocked = bool(
        is_user_request
        and info.get("is_limited")
        and info.get("limit_reached")
    )

    return {
        "blocked": blocked,
        "is_user_request": is_user_request,
        "limit": info,
    }


def increment_user_message_count(user, db_session, should_increment: bool) -> dict:
    if not should_increment:
        return get_message_limit_info(user)

    return get_message_limit_info(user)
