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
    """Return credit (点数) cap information for the given user.

    Consumption order (all users):
      1. Effective plan quota:
         - free: daily bucket (noon reset)
         - pro with monthly quota left: monthly bucket (billing cycle)
         - pro who exhausted the monthly quota ("broke"): falls back to the
           daily bucket (noon reset), exactly like a free user
      2. Wallet credits (purchased_credit_balance)
      3. Blocked — only when every source above is exhausted.

    The returned "effective" fields (`cap_scope`, `credit_cap`, `used_credits`,
    `remaining_credits`, `cap_reached`, `reset_at`) describe the bucket the user
    is currently consuming against, so a broke pro sees the daily bucket (with
    the noon reset) just like a free user. Pro benefits other than the credit
    quota are untouched: `is_pro` stays true regardless of `broke`.
    """
    pro_active = _resolve_pro_active(user)

    free_daily_credit_cap = _get_float_env("FREE_DAILY_CREDIT_CAP", 10.0)
    pro_monthly_credit_cap = _get_float_env("PRO_MONTHLY_CREDIT_CAP", 10000.0)

    now = datetime.now(UTC)
    month_start = (
        get_pro_cycle_start(user, now)
        if pro_active
        else now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    )
    # The free daily window (noon-shifted) is the bucket free users are capped
    # on and broke pros fall back to, so compute it for everyone.
    free_daily_usage_date = get_free_daily_usage_date(now)
    usage = get_user_credit_usage(
        db,
        user.id,
        daily_usage_date=free_daily_usage_date,
        month_start_date=month_start.date(),
    )
    daily_usage = usage["daily_credit_usage"]
    monthly_usage = usage["monthly_credit_usage"]

    free_daily_limited = free_daily_credit_cap > 0
    free_daily_cap_reached = bool(free_daily_limited and daily_usage >= free_daily_credit_cap)
    next_free_daily_reset_at = get_next_free_daily_reset_at(now).isoformat()

    # Monthly (pro primary) bucket.
    if pro_active:
        next_month = month_start.month % 12 + 1
        next_year = month_start.year if month_start.month < 12 else month_start.year + 1
        import calendar as _cal
        _last = _cal.monthrange(next_year, next_month)[1]
        _day = min(month_start.day, _last)
        cycle_reset_at = month_start.replace(year=next_year, month=next_month, day=_day)
        pro_expire_date = getattr(user, "pro_expire_date", None)
        if pro_expire_date is not None and pro_expire_date.tzinfo is None:
            pro_expire_date = pro_expire_date.replace(tzinfo=UTC)
        monthly_reset_at = (
            pro_expire_date.isoformat()
            if pro_expire_date is not None and pro_expire_date < cycle_reset_at
            else cycle_reset_at.isoformat()
        )
        monthly_limited = pro_monthly_credit_cap > 0
        monthly_cap_reached = bool(monthly_limited and monthly_usage >= pro_monthly_credit_cap)
    else:
        monthly_reset_at = None
        monthly_limited = False
        monthly_cap_reached = False

    # Derived "broke" flag: pro whose monthly quota is exhausted. While broke,
    # the credit reset mechanism works exactly like a free user's (daily bucket,
    # noon reset) — but pro benefits (configs, rate limits, message caps, etc.)
    # are untouched because nothing gates those on this flag.
    broke = bool(pro_active and monthly_cap_reached)

    # Effective bucket selection (single source of truth for all callers).
    if broke or not pro_active:
        cap_scope = "daily"
        cap_value = free_daily_credit_cap
        used_credits = daily_usage
        reset_at = next_free_daily_reset_at
        is_limited = free_daily_limited
        cap_reached = free_daily_cap_reached
    else:
        cap_scope = "monthly"
        cap_value = pro_monthly_credit_cap
        used_credits = monthly_usage
        reset_at = monthly_reset_at
        is_limited = monthly_limited
        cap_reached = monthly_cap_reached

    remaining_credits = max(0.0, cap_value - used_credits) if is_limited else None
    purchased_credit_balance = float(getattr(user, "purchased_credit_balance", 0.0) or 0.0)
    wallet_available = purchased_credit_balance > 0

    return {
        "is_pro": pro_active,
        "plan": "pro" if pro_active else "free",
        "daily_credit_usage": daily_usage,
        "monthly_credit_usage": monthly_usage,
        "cap_scope": cap_scope,
        "credit_cap": cap_value if is_limited else None,
        "used_credits": used_credits,
        "remaining_credits": remaining_credits,
        "is_limited": is_limited,
        "cap_reached": cap_reached,
        "purchased_credit_balance": purchased_credit_balance,
        "wallet_available": wallet_available,
        "wallet_fallback_active": bool(cap_reached and wallet_available),
        "monthly_cap_reached": monthly_cap_reached,
        "broke": broke,
        "free_daily_cap_reached": free_daily_cap_reached,
        "next_free_daily_reset_at": next_free_daily_reset_at,
        "reset_at": reset_at,
        "checked_at": now.isoformat(),
        "free_daily_credit_cap": free_daily_credit_cap,
        "pro_monthly_credit_cap": pro_monthly_credit_cap,
    }


def should_record_to_free_daily(limit_info: dict[str, Any]) -> bool:
    """Whether new consumption should be recorded against the free-daily (noon-reset) bucket.

    True for free users (primary bucket) and for broke pro users (fallback
    bucket). False only for pro users still on their monthly quota, whose usage
    is recorded against the billing cycle. This keeps recording aligned with
    the effective bucket returned by `get_credit_cap_info()`.
    """
    return not bool(limit_info.get("is_pro")) or bool(limit_info.get("broke"))


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
    broke = bool(limit_info.get("broke"))

    if plan == "pro" and broke:
        message = (
            "You have reached your monthly Pro credit limit and today's free "
            "credit allowance. Daily free credits reset at 12:00 PM (noon). "
            "Please top up wallet credits or wait for the daily reset."
        )
    elif plan == "pro" and cap_scope == "monthly":
        message = "You have reached your monthly credit limit for Pro. Please wait until next month for reset or top up wallet credits."
    else:
        message = "You have reached your daily credit limit. Upgrade to Pro for a much higher monthly limit or top up wallet credits."

    return {
        "error": "CREDIT_CAP_REACHED",
        "message": message,
        "credit_limits": limit_info,
    }

