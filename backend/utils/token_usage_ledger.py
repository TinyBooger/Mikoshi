from __future__ import annotations

from datetime import datetime, UTC
from typing import Any

from sqlalchemy.orm import Session
from sqlalchemy.dialects.postgresql import insert

from models import UserTokenUsageLedger
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
