"""Shared helpers used across the admin API submodules."""

from typing import Optional

from passlib.context import CryptContext
from sqlalchemy.orm import Session

from models import User, UserModerationLog, ContentModerationLog

_pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def _log_user_moderation(
    db: Session,
    *,
    user_id: str,
    action: str,
    admin: User,
    ban_reason: Optional[str] = None,
    ban_note: Optional[str] = None,
    ban_until=None,
    notes: Optional[str] = None,
    source: str = "direct",
    source_report_id: Optional[int] = None,
):
    """Insert a UserModerationLog row (does not commit)."""
    db.add(UserModerationLog(
        user_id=user_id,
        action=action,
        ban_reason=ban_reason,
        ban_note=ban_note,
        ban_until=ban_until,
        admin_id=admin.id,
        admin_name=admin.name,
        source=source,
        source_report_id=source_report_id,
        notes=notes,
    ))


def _log_content_moderation(
    db: Session,
    *,
    creator_id: str,
    entity_type: str,
    entity_id: int,
    entity_name: Optional[str],
    action: str,
    admin: User,
    notes: Optional[str] = None,
    source: str = "direct",
    source_report_id: Optional[int] = None,
):
    """Insert a ContentModerationLog row (does not commit)."""
    db.add(ContentModerationLog(
        creator_id=creator_id,
        entity_type=entity_type,
        entity_id=entity_id,
        entity_name=entity_name,
        action=action,
        admin_id=admin.id,
        admin_name=admin.name,
        source=source,
        source_report_id=source_report_id,
        notes=notes,
    ))
