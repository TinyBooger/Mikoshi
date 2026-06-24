"""
Invitation code utilities.
Handles code generation, validation, bonus credit granting, and daily rate limiting.
"""
from __future__ import annotations

import os
import secrets
import string
from datetime import datetime, UTC, timedelta, timezone
from typing import Optional

from sqlalchemy.orm import Session

from models import User, UserCreditWalletLedger
from utils.credit_wallet import credit_wallet

CHINA_TIMEZONE = timezone(timedelta(hours=8), name="Asia/Shanghai")
DAILY_RESET_HOUR = 12

INVITATION_BONUS_CREDITS = float(os.getenv("INVITATION_BONUS_CREDITS", "100"))
INVITATION_MAX_PER_DAY = int(os.getenv("INVITATION_MAX_PER_DAY", "3"))


# ---------------------------------------------------------------------------
# Code generation
# ---------------------------------------------------------------------------

def generate_invitation_code(db: Session, length: int = 8) -> str:
    """Generate a unique invitation code for a new user."""
    alphabet = string.ascii_uppercase + string.digits
    for _ in range(30):
        code = ''.join(secrets.choice(alphabet) for _ in range(length))
        if not db.query(User).filter(User.invitation_code == code).first():
            return code
    # Fallback: double length
    for _ in range(30):
        code = ''.join(secrets.choice(alphabet) for _ in range(length * 2))
        if not db.query(User).filter(User.invitation_code == code).first():
            return code
    raise RuntimeError("Failed to generate unique invitation code")


# ---------------------------------------------------------------------------
# Daily rate limiting (China noon-reset, same window as credit_cap.py)
# ---------------------------------------------------------------------------

def _today_date_china() -> "date":
    """Return the current date in China time, shifted by noon-reset."""
    from datetime import date
    now = datetime.now(UTC)
    local_now = now.astimezone(CHINA_TIMEZONE)
    shifted = local_now - timedelta(hours=DAILY_RESET_HOUR)
    return shifted.date()


def count_today_invites(db: Session, inviter_id: str) -> int:
    """Count how many invitation bonuses this user has earned today."""
    today = _today_date_china()
    # The ledger uses UTC timestamps — filter by date range in UTC
    # that maps to the China noon-reset window
    start_utc = datetime.combine(today, datetime.min.time(), tzinfo=CHINA_TIMEZONE) + timedelta(hours=DAILY_RESET_HOUR)
    end_utc = start_utc + timedelta(days=1)
    return (
        db.query(UserCreditWalletLedger)
        .filter(
            UserCreditWalletLedger.user_id == inviter_id,
            UserCreditWalletLedger.source == "invitation_bonus",
            UserCreditWalletLedger.created_at >= start_utc,
            UserCreditWalletLedger.created_at < end_utc,
        )
        .count()
    )


# ---------------------------------------------------------------------------
# Invitation processing (called during registration)
# ---------------------------------------------------------------------------

def process_invitation_code(
    db: Session,
    invitation_code: str,
    new_user_id: str,
) -> tuple[bool, Optional[str]]:
    """
    Validate and process an invitation code during registration.

    Looks up user personal invitation codes (User.invitation_code). On a
    successful match both inviter and invitee receive bonus credits (idempotent).

    Returns (is_valid, error_message_or_none).
    """
    code = invitation_code.strip().upper()

    # ── User personal invitation codes ──
    inviter = db.query(User).filter(User.invitation_code == code).first()

    if not inviter:
        return False, "Invalid invitation code"

    if inviter.id == new_user_id:
        return False, "Cannot use your own invitation code"

    # Daily rate limit for the inviter
    today_count = count_today_invites(db, inviter.id)
    if today_count >= INVITATION_MAX_PER_DAY:
        return False, f"Daily invitation limit reached ({INVITATION_MAX_PER_DAY}/day)"

    # Grant bonus credits to both parties (idempotent via unique keys)
    _grant_invite_bonus(db, inviter.id, new_user_id, "inviter")
    _grant_invite_bonus(db, new_user_id, inviter.id, "invitee")

    return True, None


def track_invitation(db: Session, invitation_code: str, new_user: User) -> None:
    """Record who invited this user (sets invited_by)."""
    code = invitation_code.strip().upper()
    inviter = db.query(User).filter(User.invitation_code == code).first()
    if inviter and inviter.id != new_user.id:
        new_user.invited_by = inviter.id


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------

def _grant_invite_bonus(db: Session, user_id: str, counterpart_id: str, role: str) -> None:
    """Grant bonus credits with an idempotency key.  Never raises."""
    try:
        credit_wallet(
            db,
            user_id=user_id,
            credits=INVITATION_BONUS_CREDITS,
            source="invitation_bonus",
            idempotency_key=f"invite_{role}_{user_id}_{counterpart_id}",
            metadata={"role": role, "counterpart_id": counterpart_id},
        )
    except Exception:
        pass  # Non-fatal
