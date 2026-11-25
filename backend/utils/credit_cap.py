from __future__ import annotations

import os
from datetime import datetime, UTC, timedelta, timezone
from typing import Any

from sqlalchemy import func
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.orm import Session

from models import User, UserCreditUsageLedger, UserFreeCreditQuota


CHINA_TIMEZONE = timezone(timedelta(hours=8), name="Asia/Shanghai")
FREE_DAILY_RESET_HOUR_LOCAL = 12

# Free-plan credit pool (点数). The pool refills `FREE_CREDIT_REFILL_AMOUNT`
# at every `FREE_CREDIT_REFILL_INTERVAL_SECONDS` wall-clock boundary (whole
# hours by default) and banks unused credits up to
# `FREE_CREDIT_MAX_ACCUMULATION`, so an idle user builds up a full pool instead
# of losing the balance on a daily reset.
DEFAULT_FREE_CREDIT_REFILL_AMOUNT = 3.0
DEFAULT_FREE_CREDIT_REFILL_INTERVAL_SECONDS = 3600
DEFAULT_FREE_CREDIT_MAX_ACCUMULATION = 100.0


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


def _as_utc(value: datetime | None) -> datetime | None:
    if value is None:
        return None
    if value.tzinfo is None:
        return value.replace(tzinfo=UTC)
    return value.astimezone(UTC)


# -- Free credit pool ----------------------------------------------------------

def get_free_credit_settings() -> dict[str, float]:
    """Current refill configuration (env-overridable)."""
    return {
        "refill_amount": _get_float_env(
            "FREE_CREDIT_REFILL_AMOUNT", DEFAULT_FREE_CREDIT_REFILL_AMOUNT
        ),
        "refill_interval_seconds": float(
            _get_int_env(
                "FREE_CREDIT_REFILL_INTERVAL_SECONDS",
                DEFAULT_FREE_CREDIT_REFILL_INTERVAL_SECONDS,
            )
        ),
        "max_accumulation": _get_float_env(
            "FREE_CREDIT_MAX_ACCUMULATION", DEFAULT_FREE_CREDIT_MAX_ACCUMULATION
        ),
    }


def _refill_tick_floor(moment: datetime, interval: float) -> datetime:
    """Snap an instant down to the refill grid.

    Ticks sit on fixed wall-clock boundaries (every whole hour for the default
    3600s interval) rather than being offset by whenever the user happened to
    spend credits, so every user gets topped up at the same round hours.
    """
    if interval <= 0:
        return _as_utc(moment)
    epoch_seconds = _as_utc(moment).timestamp()
    return datetime.fromtimestamp(epoch_seconds - (epoch_seconds % interval), UTC)


def _ensure_free_credit_quota_row(
    db: Session,
    user_id: str,
    now: datetime,
    settings: dict[str, float],
) -> UserFreeCreditQuota:
    """Load (creating when missing) the user's rolling free credit pool.

    New rows start full, so first-time users get the whole accumulation cap
    right away. The common path is a plain SELECT: reads that find a row never
    write, so `get_credit_cap_info` stays cheap on hot endpoints.
    """
    state = (
        db.query(UserFreeCreditQuota)
        .filter(UserFreeCreditQuota.user_id == user_id)
        .first()
    )
    if state is not None:
        return state

    # Seed the anchor on the refill grid so a fresh row lines up with the
    # round-hour ticks every other pool follows.
    anchor = _refill_tick_floor(
        now, float(settings["refill_interval_seconds"] or 0.0)
    )
    # `ON CONFLICT DO NOTHING` keeps concurrent first reads from raising a
    # primary-key violation.
    db.execute(
        pg_insert(UserFreeCreditQuota)
        .values(
            user_id=user_id,
            balance=settings["max_accumulation"],
            last_refill_at=anchor,
            updated_at=now,
        )
        .on_conflict_do_nothing(index_elements=[UserFreeCreditQuota.user_id])
    )
    state = (
        db.query(UserFreeCreditQuota)
        .filter(UserFreeCreditQuota.user_id == user_id)
        .first()
    )
    if state is None:
        state = UserFreeCreditQuota(
            user_id=user_id,
            balance=settings["max_accumulation"],
            last_refill_at=anchor,
            updated_at=now,
        )
        db.add(state)
        db.flush()
    return state


def _apply_free_credit_refill(
    state: UserFreeCreditQuota,
    now: datetime,
    settings: dict[str, float],
) -> float:
    """Bank every wall-clock refill tick elapsed since the last one; return the gain.

    Ticks land on fixed boundaries (whole hours by default) instead of counting
    from the last consumption, so spending credits never restarts the clock.
    """
    max_balance = float(settings["max_accumulation"] or 0.0)
    interval = float(settings["refill_interval_seconds"] or 0.0)
    amount = float(settings["refill_amount"] or 0.0)
    balance = max(0.0, float(state.balance or 0.0))
    last_refill = _as_utc(state.last_refill_at) or now

    if max_balance <= 0:
        # Cap disabled: unmetered free quota, nothing to refill or track.
        return 0.0

    if balance >= max_balance:
        # A full pool banks nothing; keeps this path read-only while full.
        # `consume_free_credit_quota` re-pins the anchor when the pool drops.
        return 0.0

    if amount <= 0 or interval <= 0:
        state.balance = balance
        return 0.0

    current_tick = _refill_tick_floor(now, interval)
    last_tick = _refill_tick_floor(last_refill, interval)
    ticks = int((current_tick - last_tick).total_seconds() // interval)
    if ticks <= 0:
        state.balance = balance
        return 0.0

    new_balance = min(max_balance, balance + ticks * amount)
    state.balance = new_balance
    # Always store a boundary, never the read time, so the next tick stays on
    # the same grid even when the pool just filled up.
    state.last_refill_at = last_tick + timedelta(seconds=ticks * interval)
    state.updated_at = now
    return new_balance - balance


def get_free_credit_quota(
    db: Session,
    user_id: str,
    *,
    now: datetime | None = None,
    settings: dict[str, float] | None = None,
) -> UserFreeCreditQuota:
    """Return the user's free credit pool with all due refills already banked."""
    when = now or datetime.now(UTC)
    cfg = settings or get_free_credit_settings()
    state = _ensure_free_credit_quota_row(db, user_id, when, cfg)
    _apply_free_credit_refill(state, when, cfg)
    return state


def get_next_free_credit_refill_at(
    state: UserFreeCreditQuota,
    settings: dict[str, float],
    now: datetime | None = None,
) -> datetime | None:
    """When the next wall-clock refill tick lands, or None when already full."""
    max_balance = float(settings["max_accumulation"] or 0.0)
    interval = float(settings["refill_interval_seconds"] or 0.0)
    amount = float(settings["refill_amount"] or 0.0)
    if max_balance <= 0 or interval <= 0 or amount <= 0:
        return None
    balance = max(0.0, float(state.balance or 0.0))
    if balance >= max_balance:
        return None
    when = now or datetime.now(UTC)
    return _refill_tick_floor(when, interval) + timedelta(seconds=interval)


def consume_free_credit_quota(
    db: Session,
    user_id: str,
    credit_amount: float,
    *,
    now: datetime | None = None,
) -> float:
    """Spend from the rolling free pool; returns the credits actually taken.

    The balance never goes negative: a request that costs more than what is
    left drains the pool to zero, and the next request is blocked right after
    (matching the previous overshoot-then-block behaviour).
    """
    if credit_amount <= 0:
        return 0.0
    when = now or datetime.now(UTC)
    settings = get_free_credit_settings()
    state = get_free_credit_quota(db, user_id, now=when, settings=settings)

    balance = max(0.0, float(state.balance or 0.0))
    if balance <= 0:
        return 0.0

    max_balance = float(settings["max_accumulation"] or 0.0)
    was_full = max_balance > 0 and balance >= max_balance
    consumed = min(balance, float(credit_amount))
    state.balance = max(0.0, balance - consumed)
    if was_full:
        # Re-pin the anchor to the current tick so hours spent at full do not
        # turn into retroactive refills; the next refill is still the next
        # round hour, not an interval from now.
        state.last_refill_at = _refill_tick_floor(
            when, float(settings["refill_interval_seconds"] or 0.0)
        )
    state.updated_at = when
    return consumed



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
         - free: rolling free pool (refills at every round hour, banks up to the cap)
         - pro with monthly quota left: monthly bucket (billing cycle)
         - pro who exhausted the monthly quota ("broke"): falls back to the
           free pool, exactly like a free user
      2. Wallet credits (purchased_credit_balance)
      3. Blocked — only when every source above is exhausted.

    The returned "effective" fields (`cap_scope`, `credit_cap`, `used_credits`,
    `remaining_credits`, `cap_reached`, `reset_at`) describe the bucket the user
    is currently consuming against. Pro benefits other than the credit quota are
    untouched: `is_pro` stays true regardless of `broke`.
    """
    pro_active = _resolve_pro_active(user)

    free_settings = get_free_credit_settings()
    free_max_accumulation = free_settings["max_accumulation"]
    pro_monthly_credit_cap = _get_float_env("PRO_MONTHLY_CREDIT_CAP", 10000.0)

    now = datetime.now(UTC)
    month_start = (
        get_pro_cycle_start(user, now)
        if pro_active
        else now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    )
    free_state = None
    free_balance: float | None = None
    next_free_refill_at = None

    free_daily_usage_date = get_free_daily_usage_date(now)
    usage = get_user_credit_usage(
        db,
        user.id,
        daily_usage_date=free_daily_usage_date,
        month_start_date=month_start.date(),
    )
    daily_usage = usage["daily_credit_usage"]
    monthly_usage = usage["monthly_credit_usage"]

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
    # the credit mechanism works exactly like a free user's (rolling pool) — but
    # pro benefits (configs, rate limits, message caps, etc.) are untouched
    # because nothing gates those on this flag.
    broke = bool(pro_active and monthly_cap_reached)

    # The rolling free pool is only the effective bucket for free users and for
    # broke pros, so only those pay for reading/refilling it. Active pro users
    # keep whatever the pool held when they last consumed it.
    use_free_bucket = broke or not pro_active
    free_limited = free_max_accumulation > 0
    if use_free_bucket:
        free_state = get_free_credit_quota(db, user.id, now=now, settings=free_settings)
        free_balance = max(0.0, float(free_state.balance or 0.0))
        next_free_refill_at = get_next_free_credit_refill_at(
            free_state, free_settings, now
        )
    else:
        free_state = None
        free_balance = None
        next_free_refill_at = None
    free_cap_reached = bool(free_limited and free_balance is not None and free_balance <= 0)
    free_full = bool(
        free_limited and free_balance is not None and free_balance >= free_max_accumulation
    )

    # Effective bucket selection (single source of truth for all callers).
    if broke or not pro_active:
        cap_scope = "daily"
        cap_value = free_max_accumulation
        free_balance_value = float(free_balance or 0.0)
        used_credits = max(0.0, free_max_accumulation - free_balance_value)
        reset_at = next_free_refill_at.isoformat() if next_free_refill_at else None
        is_limited = free_limited
        cap_reached = free_cap_reached
    else:
        cap_scope = "monthly"
        cap_value = pro_monthly_credit_cap
        used_credits = monthly_usage
        reset_at = monthly_reset_at
        is_limited = monthly_limited
        cap_reached = monthly_cap_reached

    if not is_limited:
        remaining_credits = None
    elif cap_scope == "daily":
        remaining_credits = float(free_balance or 0.0)
    else:
        remaining_credits = max(0.0, cap_value - used_credits)

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
        "free_daily_cap_reached": free_cap_reached,
        "next_free_daily_reset_at": (
            next_free_refill_at.isoformat() if next_free_refill_at else None
        ),
        "reset_at": reset_at,
        "checked_at": now.isoformat(),
        # Rolling free pool (点数) details for the quota UI.
        "free_credit_balance": free_balance,
        "free_credit_max_accumulation": free_max_accumulation,
        "free_credit_refill_amount": free_settings["refill_amount"],
        "free_credit_refill_interval_seconds": int(
            free_settings["refill_interval_seconds"]
        ),
        "next_free_credit_refill_at": (
            next_free_refill_at.isoformat() if next_free_refill_at else None
        ),
        "free_credit_full": free_full,
        "free_daily_credit_cap": free_max_accumulation,
        "pro_monthly_credit_cap": pro_monthly_credit_cap,
    }


def should_record_to_free_daily(limit_info: dict[str, Any]) -> bool:
    """Whether new consumption should be recorded against the free bucket.

    True for free users (primary bucket) and for broke pro users (fallback
    bucket, which draws from the rolling free credit pool). False only for pro
    users still on their monthly quota, whose usage is recorded against the
    billing cycle. This keeps recording aligned with the effective bucket
    returned by `get_credit_cap_info()`.
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

    try:
        interval_hours = max(
            1, int(round(float(limit_info.get("free_credit_refill_interval_seconds") or 3600) / 3600))
        )
    except (TypeError, ValueError):
        interval_hours = 1
    try:
        refill_amount = float(limit_info.get("free_credit_refill_amount") or 0)
    except (TypeError, ValueError):
        refill_amount = 0.0
    try:
        max_accumulation = float(limit_info.get("free_credit_max_accumulation") or 0)
    except (TypeError, ValueError):
        max_accumulation = 0.0

    refill_text = (
        f"免费点数每 {interval_hours} 小时补充 {refill_amount:g} 点"
        f"（可积累至 {max_accumulation:g} 点）"
    )

    if plan == "pro" and broke:
        message = (
            f"您已达到 Pro 月度点数额度，免费点数也已用完。{refill_text}。"
            "请充值钱包点数，或等待点数补充后再试。"
        )
    elif plan == "pro" and cap_scope == "monthly":
        message = "您已达到 Pro 月度点数额度上限。请等待下月额度重置，或充值钱包点数后继续使用。"
    else:
        message = (
            f"您的免费点数已用完。{refill_text}。"
            "升级至 Pro 可获得更高的月度额度，或充值钱包点数后继续使用。"
        )

    return {
        "error": "CREDIT_CAP_REACHED",
        "message": message,
        "credit_limits": limit_info,
    }
