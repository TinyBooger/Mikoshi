from __future__ import annotations

from datetime import datetime, UTC
from typing import Any

from sqlalchemy.orm import Session
from sqlalchemy.dialects.postgresql import insert

from models import User, UserTokenUsageLedger
from utils.token_cap import can_consume_tokens
from utils.token_wallet import consume_wallet_tokens
from utils.usage_utils import normalize_usage


def record_token_usage(
    db_session: Session,
    *,
    user_id: str,
    usage: Any,
    usage_timestamp: datetime | None = None,
) -> None:
    """Increment the user's token usage ledger for a UTC day."""
    normalized = normalize_usage(usage)
    if normalized["total_tokens"] <= 0:
        return

    when = usage_timestamp or datetime.now(UTC)
    usage_date = when.date()

    stmt = insert(UserTokenUsageLedger).values(
        user_id=user_id,
        usage_date=usage_date,
        prompt_tokens=normalized["prompt_tokens"],
        completion_tokens=normalized["completion_tokens"],
        total_tokens=normalized["total_tokens"],
    )

    stmt = stmt.on_conflict_do_update(
        index_elements=[UserTokenUsageLedger.user_id, UserTokenUsageLedger.usage_date],
        set_={
            "prompt_tokens": UserTokenUsageLedger.prompt_tokens + normalized["prompt_tokens"],
            "completion_tokens": UserTokenUsageLedger.completion_tokens + normalized["completion_tokens"],
            "total_tokens": UserTokenUsageLedger.total_tokens + normalized["total_tokens"],
            "updated_at": datetime.now(UTC),
        },
    )

    db_session.execute(stmt)


def apply_token_usage_with_wallet(
    db_session: Session,
    *,
    user: User,
    usage: Any,
    source: str,
    source_order_no: str | None = None,
    idempotency_key: str | None = None,
    metadata: dict[str, Any] | None = None,
) -> dict[str, Any]:
    """Apply usage to plan quota first, then wallet tokens after plan cap is reached."""
    normalized = normalize_usage(usage)
    total_tokens = int(normalized["total_tokens"])
    if total_tokens <= 0:
        return {
            "success": True,
            "total_tokens": 0,
            "consumed_from_wallet": False,
        }

    token_check = can_consume_tokens(user, db_session)
    if token_check.get("blocked"):
        return {
            "success": False,
            "error": "TOKEN_CAP_REACHED",
            "limit": token_check.get("limit") or {},
            "consumed_from_wallet": False,
        }

    if token_check.get("consume_from_wallet"):
        consumed, balance_after = consume_wallet_tokens(
            db_session,
            user_id=user.id,
            tokens=total_tokens,
            source=source,
            source_order_no=source_order_no,
            idempotency_key=idempotency_key,
            metadata=metadata,
        )
        if not consumed:
            return {
                "success": False,
                "error": "INSUFFICIENT_WALLET_TOKENS",
                "wallet_balance": balance_after,
                "required_tokens": total_tokens,
                "consumed_from_wallet": False,
                "limit": token_check.get("limit") or {},
            }

        return {
            "success": True,
            "total_tokens": total_tokens,
            "consumed_from_wallet": True,
            "wallet_balance": balance_after,
        }

    record_token_usage(
        db_session,
        user_id=user.id,
        usage=normalized,
    )
    return {
        "success": True,
        "total_tokens": total_tokens,
        "consumed_from_wallet": False,
    }
