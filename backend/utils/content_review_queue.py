from datetime import datetime, UTC
from typing import Optional

from sqlalchemy.orm import Session

from models import Character, ContentReviewQueue


def enqueue_character_review(
    db: Session,
    *,
    character_id: int,
    source: str,
    reason: Optional[str] = None,
    triggered_by_report_id: Optional[int] = None,
) -> ContentReviewQueue:
    """Create or refresh a pending review queue item for a character."""
    existing = (
        db.query(ContentReviewQueue)
        .filter(
            ContentReviewQueue.character_id == character_id,
            ContentReviewQueue.source == source,
            ContentReviewQueue.status == "pending",
        )
        .first()
    )

    now = datetime.now(UTC)
    character = db.query(Character).filter(Character.id == character_id).first()
    character_name = character.name if character else None

    if existing:
        existing.reason = reason or existing.reason
        existing.character_name = character_name or existing.character_name
        if triggered_by_report_id is not None:
            existing.triggered_by_report_id = triggered_by_report_id
        existing.updated_time = now
        return existing

    entry = ContentReviewQueue(
        character_id=character_id,
        character_name=character_name,
        source=source,
        reason=reason,
        status="pending",
        triggered_by_report_id=triggered_by_report_id,
        created_time=now,
        updated_time=now,
    )
    db.add(entry)
    return entry
