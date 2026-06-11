from __future__ import annotations

import os
from datetime import datetime, UTC, timedelta, timezone
from typing import Any

from sqlalchemy import func
from sqlalchemy.orm import Session

from models import User, UserCreditUsageLedger


CHINA_TIMEZONE = timezone(timedelta(hours=8), name="Asia/Shanghai")
FREE_DAILY_RESET_HOUR_LOCAL = 12


def _get_float_env(name: str, default: float) -> float:
    raw = os.getenv(name)
    if raw is None:
        return default
    try:
        value = float(raw)
        return value if value >= 0 else default
    except (TypeError, ValueError):
        return default


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


def is_user_pro_active(user: User) -> bool:
    return _resolve_pro_active(user)


def get_free_daily_usage_date(when: datetime | None = None):
    now = when or datetime.now(UTC)
    local_now = now.astimezone(CHINA_TIMEZONE)
    shifted = local_now - timedelta(hours=FREE_DAILY_RESET_HOUR_LOCAL)
    return shifted.date()


def get_pro_cycle_start(user: "User", now: datetime) -> datetime:
    """Return the start of the current billing cycle based on the day-of-month of pro_start_date."""
    pro_start = getattr(user, "pro_start_date", None)
    if pro_start is None:
        return now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    if pro_start.tzinfo is None:
        pro_start = pro_start.replace(tzinfo=UTC)
    pro_start_midnight = pro_start.replace(hour=0, minute=0, second=0, microsecond=0)
    if now < pro_start:
        return pro_start_midnight
    anchor_day = pro_start.day
    import calendar
    def _cycle_start_for(year: int, month: int) -> datetime:
        last_day = calendar.monthrange(year, month)[1]
        day = min(anchor_day, last_day)
        return pro_start.replace(year=year, month=month, day=day,
                                 hour=0, minute=0,
                                 second=0, microsecond=0)

    candidate = _cycle_start_for(now.year, now.month)
    if now < candidate:
        prev_month = now.month - 1 or 12
        prev_year = now.year if now.month > 1 else now.year - 1
        return _cycle_start_for(prev_year, prev_month)
    return candidate


def get_next_free_daily_reset_at(when: datetime | None = None) -> datetime:
    now = when or datetime.now(UTC)
    local_now = now.astimezone(CHINA_TIMEZONE)
    reset_anchor_local = local_now.replace(
        hour=FREE_DAILY_RESET_HOUR_LOCAL,
        minute=0,
        second=0,
        microsecond=0,
    )
    if local_now < reset_anchor_local:
        return reset_anchor_local.astimezone(UTC)
    return (reset_anchor_local + timedelta(days=1)).astimezone(UTC)


# -- Credit-based usage queries ------------------------------------------------

def get_user_credit_usage(
    db: Session,
    user_id: str,
    *,
    daily_usage_date,
    month_start_date,
) -> dict[str, float]:
    """Sum credit_amount from the usage ledger instead of raw tokens."""

    daily_credits = (
        db.query(func.coalesce(func.sum(UserCreditUsageLedger.credit_amount), 0.0))
        .filter(
            UserCreditUsageLedger.user_id == user_id,
            UserCreditUsageLedger.usage_date == daily_usage_date,
        )
        .scalar()
    ) or 0.0

    monthly_credits = (
        db.query(func.coalesce(func.sum(UserCreditUsageLedger.credit_amount), 0.0))
        .filter(
            UserCreditUsageLedger.user_id == user_id,
            UserCreditUsageLedger.usage_date >= month_start_date,
        )
        .scalar()
    ) or 0.0

    return {
        "daily_credit_usage": float(daily_credits),
        "monthly_credit_usage": float(monthly_credits),
    }


def get_credit_cap_info(user: User, db: Session) -> dict[str, Any]:
    """Return credit (点数) cap information for the given user."""
    pro_active = _resolve_pro_active(user)

    free_daily_credit_cap = _get_float_env("FREE_DAILY_CREDIT_CAP", 10.0)
    pro_monthly_credit_cap = _get_float_env("PRO_MONTHLY_CREDIT_CAP", 10000.0)

    now = datetime.now(UTC)
    month_start = get_pro_cycle_start(user, now) if pro_active else now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    daily_usage_date = now.date() if pro_active else get_free_daily_usage_date(now)
    usage = get_user_credit_usage(
        db,
        user.id,
        daily_usage_date=daily_usage_date,
        month_start_date=month_start.date(),
    )

    if pro_active:
        cap_scope = "monthly"
        cap_value = pro_monthly_credit_cap
        used_credits = usage["monthly_credit_usage"]
        next_month = month_start.month % 12 + 1
        next_year = month_start.year if month_start.month < 12 else month_start.year + 1
        import calendar as _cal
        _last = _cal.monthrange(next_year, next_month)[1]
        _day = min(month_start.day, _last)
        cycle_reset_at = month_start.replace(year=next_year, month=next_month, day=_day)
        pro_expire_date = getattr(user, "pro_expire_date", None)
        if pro_expire_date is not None and pro_expire_date.tzinfo is None:
            pro_expire_date = pro_expire_date.replace(tzinfo=UTC)
        if pro_expire_date is not None and pro_expire_date < cycle_reset_at:
            reset_at = pro_expire_date.isoformat()
        else:
            reset_at = cycle_reset_at.isoformat()
    else:
        cap_scope = "daily"
        cap_value = free_daily_credit_cap
        used_credits = usage["daily_credit_usage"]
        reset_at = get_next_free_daily_reset_at(now).isoformat()

    is_limited = cap_value > 0
    remaining_credits = max(0.0, cap_value - used_credits) if is_limited else None
    cap_reached = bool(is_limited and used_credits >= cap_value)
    purchased_credit_balance = float(getattr(user, "purchased_credit_balance", 0.0) or 0.0)
    wallet_available = purchased_credit_balance > 0

    return {
        "is_pro": pro_active,
        "plan": "pro" if pro_active else "free",
        "daily_credit_usage": usage["daily_credit_usage"],
        "monthly_credit_usage": usage["monthly_credit_usage"],
        "cap_scope": cap_scope,
        "credit_cap": cap_value if is_limited else None,
        "remaining_credits": remaining_credits,
        "is_limited": is_limited,
        "cap_reached": cap_reached,
        "purchased_credit_balance": purchased_credit_balance,
        "wallet_available": wallet_available,
        "wallet_fallback_active": bool(cap_reached and wallet_available),
        "reset_at": reset_at,
        "checked_at": now.isoformat(),
        "free_daily_credit_cap": free_daily_credit_cap,
        "pro_monthly_credit_cap": pro_monthly_credit_cap,
    }


def can_consume_credits(user: User, db: Session) -> dict[str, Any]:
    """Check whether the user can consume credits under their plan cap."""
    info = get_credit_cap_info(user, db)
    cap_reached = bool(info.get("cap_reached"))
    wallet_available = bool(info.get("wallet_available"))
    return {
        "blocked": bool(cap_reached and not wallet_available),
        "consume_from_wallet": bool(cap_reached and wallet_available),
        "limit": info,
    }


def build_credit_cap_reached_payload(limit_info: dict[str, Any]) -> dict[str, Any]:
    plan = str(limit_info.get("plan") or "free")
    cap_scope = str(limit_info.get("cap_scope") or "daily")

    if plan == "pro" and cap_scope == "monthly":
        message = "You have reached your monthly credit limit for Pro. Please wait until next month for reset or top up wallet credits."
    else:
        message = "You have reached your daily credit limit. Upgrade to Pro for a much higher monthly limit or top up wallet credits."

    return {
        "error": "CREDIT_CAP_REACHED",
        "message": message,
        "credit_limits": limit_info,
    }

