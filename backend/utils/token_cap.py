from __future__ import annotations

import os
from datetime import datetime, UTC, timedelta
from typing import Any

from sqlalchemy import func
from sqlalchemy.orm import Session

from models import User, UserTokenUsageLedger


def _get_int_env(name: str, default: int) -> int:
    raw = os.getenv(name)
    if raw is None:
        return default
    try:
        value = int(raw)
        return value if value >= 0 else default
    except (TypeError, ValueError):
        return default


def _resolve_pro_active(user: User) -> bool:
    now = datetime.now(UTC)
    expire_date = getattr(user, "pro_expire_date", None)
    return bool(expire_date and now < expire_date)


def _get_usage_window_bounds() -> tuple[datetime, datetime, datetime]:
    now = datetime.now(UTC)
    day_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    month_start = day_start.replace(day=1)
    return now, day_start, month_start


def get_user_token_usage(db: Session, user_id: str) -> dict[str, int]:
    _, day_start, month_start = _get_usage_window_bounds()
    today_date = day_start.date()
    month_start_date = month_start.date()

    daily_tokens = (
        db.query(func.coalesce(func.sum(UserTokenUsageLedger.total_tokens), 0))
        .filter(
            UserTokenUsageLedger.user_id == user_id,
            UserTokenUsageLedger.usage_date == today_date,
        )
        .scalar()
    ) or 0

    monthly_tokens = (
        db.query(func.coalesce(func.sum(UserTokenUsageLedger.total_tokens), 0))
        .filter(
            UserTokenUsageLedger.user_id == user_id,
            UserTokenUsageLedger.usage_date >= month_start_date,
        )
        .scalar()
    ) or 0

    return {
        "daily_token_usage": int(daily_tokens),
        "monthly_token_usage": int(monthly_tokens),
    }


def get_token_cap_info(user: User, db: Session) -> dict[str, Any]:
    pro_active = _resolve_pro_active(user)
    usage = get_user_token_usage(db, user.id)

    free_daily_cap = _get_int_env("FREE_DAILY_TOKEN_CAP", 3000)
    pro_monthly_cap = _get_int_env("PRO_MONTHLY_TOKEN_CAP", 3_000_000)

    now, day_start, month_start = _get_usage_window_bounds()

    if pro_active:
        cap_scope = "monthly"
        cap_value = pro_monthly_cap
        used_tokens = usage["monthly_token_usage"]
        next_month_start = (month_start + timedelta(days=32)).replace(day=1)
        reset_at = next_month_start.isoformat()
    else:
        cap_scope = "daily"
        cap_value = free_daily_cap
        used_tokens = usage["daily_token_usage"]
        next_day_start = day_start + timedelta(days=1)
        reset_at = next_day_start.isoformat()

    is_limited = cap_value > 0
    remaining_tokens = max(0, cap_value - used_tokens) if is_limited else None
    cap_reached = bool(is_limited and used_tokens >= cap_value)

    return {
        "is_pro": pro_active,
        "plan": "pro" if pro_active else "free",
        "daily_token_usage": usage["daily_token_usage"],
        "monthly_token_usage": usage["monthly_token_usage"],
        "cap_scope": cap_scope,
        "token_cap": cap_value if is_limited else None,
        "remaining_tokens": remaining_tokens,
        "is_limited": is_limited,
        "cap_reached": cap_reached,
        "reset_at": reset_at,
        "checked_at": now.isoformat(),
        "free_daily_token_cap": free_daily_cap,
        "pro_monthly_token_cap": pro_monthly_cap,
    }


def can_consume_tokens(user: User, db: Session) -> dict[str, Any]:
    info = get_token_cap_info(user, db)
    return {
        "blocked": bool(info.get("cap_reached")),
        "limit": info,
    }


def build_token_cap_reached_payload(limit_info: dict[str, Any]) -> dict[str, Any]:
    plan = str(limit_info.get("plan") or "free")
    cap_scope = str(limit_info.get("cap_scope") or "daily")

    if plan == "pro" and cap_scope == "monthly":
        message = "You have reached your monthly token limit for Pro. Please wait until next month for reset."
    else:
        message = "You have reached your daily token limit. Upgrade to Pro for a much higher monthly limit."

    return {
        "error": "TOKEN_CAP_REACHED",
        "message": message,
        "token_limits": limit_info,
    }
