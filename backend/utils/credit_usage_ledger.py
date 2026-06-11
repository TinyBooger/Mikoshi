from __future__ import annotations

from datetime import datetime, UTC
from typing import Any

from sqlalchemy.orm import Session
from sqlalchemy.dialects.postgresql import insert

from models import User, UserCreditUsageLedger
from utils.credit_cap import can_consume_credits, get_free_daily_usage_date, is_user_pro_active
from utils.credit_wallet import consume_wallet_credits
from utils.usage_utils import normalize_usage


def record_credit_usage(
    db_session: Session,
    *,
    user_id: str,
    usage: Any,
    usage_timestamp: datetime | None = None,
    use_free_daily_reset: bool = False,
    credit_amount: float = 0.0,
) -> None:
    """Increment token usage ledger for a UTC day or free-user noon-reset window."""
    normalized = normalize_usage(usage)
    total_tokens = int(normalized["total_tokens"])
    if total_tokens <= 0:
        return

    when = usage_timestamp or datetime.now(UTC)
    usage_date = get_free_daily_usage_date(when) if use_free_daily_reset else when.date()

    stmt = insert(UserCreditUsageLedger).values(
        user_id=user_id,
        usage_date=usage_date,
        prompt_tokens=normalized["prompt_tokens"],
        completion_tokens=normalized["completion_tokens"],
        total_tokens=total_tokens,
        credit_amount=credit_amount,
    )

    stmt = stmt.on_conflict_do_update(
        index_elements=[UserCreditUsageLedger.user_id, UserCreditUsageLedger.usage_date],
        set_={
            "prompt_tokens": UserCreditUsageLedger.prompt_tokens + normalized["prompt_tokens"],
            "completion_tokens": UserCreditUsageLedger.completion_tokens + normalized["completion_tokens"],
            "total_tokens": UserCreditUsageLedger.total_tokens + total_tokens,
            "credit_amount": UserCreditUsageLedger.credit_amount + credit_amount,
            "updated_at": datetime.now(UTC),
        },
    )

    db_session.execute(stmt)


def apply_credit_usage_with_wallet(
    db_session: Session,
    *,
    user: User,
    usage: Any,
    source: str,
    source_order_no: str | None = None,
    idempotency_key: str | None = None,
    metadata: dict[str, Any] | None = None,
    credit_amount: float = 0.0,
) -> dict[str, Any]:
    """Apply usage to plan credit quota first, then wallet credits after plan cap is reached."""
    normalized = normalize_usage(usage)
    total_tokens = int(normalized["total_tokens"])
    if total_tokens <= 0:
        return {
            "success": True,
            "total_tokens": 0,
            "credit_amount": 0.0,
            "consumed_from_wallet": False,
        }

    credit_check = can_consume_credits(user, db_session)
    if credit_check.get("blocked"):
        return {
            "success": False,
            "error": "CREDIT_CAP_REACHED",
            "limit": credit_check.get("limit") or {},
            "consumed_from_wallet": False,
        }

    if credit_check.get("consume_from_wallet"):
        consumed, balance_after = consume_wallet_credits(
            db_session,
            user_id=user.id,
            credits=credit_amount,
            source=source,
            source_order_no=source_order_no,
            idempotency_key=idempotency_key,
            metadata=metadata,
        )
        if not consumed:
            return {
                "success": False,
                "error": "INSUFFICIENT_WALLET_CREDITS",
                "wallet_balance": balance_after,
                "required_credits": credit_amount,
                "consumed_from_wallet": False,
                "limit": credit_check.get("limit") or {},
            }

        return {
            "success": True,
            "total_tokens": total_tokens,
            "credit_amount": credit_amount,
            "consumed_from_wallet": True,
            "wallet_balance": balance_after,
        }

    record_credit_usage(
        db_session,
        user_id=user.id,
        usage=normalized,
        use_free_daily_reset=not is_user_pro_active(user),
        credit_amount=credit_amount,
    )
    return {
        "success": True,
        "total_tokens": total_tokens,
        "credit_amount": credit_amount,
        "consumed_from_wallet": False,
    }
