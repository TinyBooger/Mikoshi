"""Prompt-only local-time marker for the outgoing chat request.

Prefixes the *last user message* with a compact local clock stamp — and, when
the conversation has been idle long enough for it to matter, how long it has
been since the previous message.

This is a decoration of the request that is sent to the model, nothing more:

* it is applied to the request copy *after* compaction, in ``routes/chat.py``;
* it is never written to chat history (the route persists ``full_messages``,
  a separate array) and is never returned to the client.

Two switches control it, and both must be on for the marker to appear:

* :data:`PROMPT_TIME_ENABLED` — the module-wide master switch (deploy knob);
* ``enabled=`` on the build/apply calls — the per-chat ``time_awareness``
  setting a Pro user can flip in the chat settings panel.
"""

from datetime import UTC, datetime, timedelta
from typing import Optional

# Module-wide master switch — off disables the marker everywhere, regardless of
# what any per-chat ``time_awareness`` setting says.
PROMPT_TIME_ENABLED = True

# Gaps shorter than this are not mentioned at all: during a rapid back-and-forth
# a "5 minutes ago" marker is pure noise, costs tokens, and invites the model to
# comment on the gap.
MIN_GAP_SECONDS = 30 * 60

_MAX_TZ_OFFSET_MINUTES = 14 * 60

_MINUTE = 60.0
_HOUR = 60.0 * _MINUTE
_DAY = 24.0 * _HOUR

_WEEKDAYS = (
    "Monday",
    "Tuesday",
    "Wednesday",
    "Thursday",
    "Friday",
    "Saturday",
    "Sunday",
)

_TRUE_STRINGS = {"1", "true", "yes", "on"}
_FALSE_STRINGS = {"0", "false", "no", "off", ""}


def _as_utc(value: Optional[datetime]) -> Optional[datetime]:
    """Coerce a stored timestamp to an aware UTC datetime.

    SQLite drops tzinfo even for ``DateTime(timezone=True)`` columns, so a
    naive value read back is assumed to be UTC — which is how this app writes
    these timestamps.
    """
    if value is None:
        return None
    if value.tzinfo is None:
        return value.replace(tzinfo=UTC)
    return value.astimezone(UTC)


def normalize_tz_offset_minutes(value: object) -> Optional[int]:
    """Validate a client-supplied UTC offset (minutes east of UTC)."""
    if isinstance(value, bool):  # bool is an int subclass — reject explicitly
        return None
    try:
        offset = int(value)  # type: ignore[arg-type]
    except (TypeError, ValueError):
        return None
    if abs(offset) > _MAX_TZ_OFFSET_MINUTES:
        return None
    return offset


def normalize_time_awareness(value: object, *, default: bool = True) -> bool:
    """Interpret the ``time_awareness`` switch from a payload or a stored row.

    Accepts real booleans, the 0/1 a JSON blob may carry, and the strings a
    multipart form or a JSON client can deliver. Anything unrecognised — a
    missing key, ``None``, ``"banana"`` — falls back to *default* so a malformed
    value can never silently switch the feature off. (``bool`` is checked first
    because it is an ``int`` subclass.)
    """
    if isinstance(value, bool):
        return value
    if isinstance(value, (int, float)):
        return value != 0
    if isinstance(value, str):
        normalized = value.strip().lower()
        if normalized in _TRUE_STRINGS:
            return True
        if normalized in _FALSE_STRINGS:
            return False
    return default


def _format_gap(seconds: float) -> str:
    """Compact duration: ``45min`` / ``2h`` / ``3d``."""
    if seconds < _HOUR:
        return f"{max(1, int(round(seconds / _MINUTE)))}min"
    if seconds < _DAY:
        return f"{max(1, int(round(seconds / _HOUR)))}h"
    return f"{max(1, int(round(seconds / _DAY)))}d"


def build_time_marker(
    *,
    now: datetime,
    last_message_at: Optional[datetime] = None,
    tz_offset_minutes: Optional[int] = None,
    enabled: bool = True,
) -> Optional[str]:
    """Return the bracket marker (e.g. ``[2026-10-03 21:14 Saturday]``).

    ``tz_offset_minutes`` is minutes *east* of UTC (``-new Date().getTimezoneOffset()``
    in the browser); without a valid offset the stamp falls back to UTC.
    ``enabled`` is the per-chat switch, ANDed with the module master switch.
    """
    if not PROMPT_TIME_ENABLED or not enabled:
        return None

    now_utc = _as_utc(now) or datetime.now(UTC)
    offset = normalize_tz_offset_minutes(tz_offset_minutes)
    local_now = now_utc + timedelta(minutes=offset) if offset is not None else now_utc

    stamp = f"{local_now.strftime('%Y-%m-%d %H:%M')} {_WEEKDAYS[local_now.weekday()]}"

    previous_utc = _as_utc(last_message_at)
    if previous_utc is not None:
        elapsed = (now_utc - previous_utc).total_seconds()
        # Negative elapsed means clock skew between the write and this read;
        # stay silent rather than emit a nonsensical "in the future".
        if elapsed >= MIN_GAP_SECONDS:
            stamp = f"{stamp} · {_format_gap(elapsed)} since last message"

    return f"[{stamp}]"


def apply_time_marker(
    messages: list,
    *,
    now: datetime,
    last_message_at: Optional[datetime] = None,
    tz_offset_minutes: Optional[int] = None,
    enabled: bool = True,
) -> Optional[str]:
    """Prefix the marker to the last user message, in place.

    Returns the applied marker (or ``None`` when nothing was applied). The
    message dict is *replaced* rather than mutated so a reference shared with
    the persisted payload can never pick the marker up.
    """
    if not isinstance(messages, list):
        return None

    marker = build_time_marker(
        now=now,
        last_message_at=last_message_at,
        tz_offset_minutes=tz_offset_minutes,
        enabled=enabled,
    )
    if not marker:
        return None

    for index in range(len(messages) - 1, -1, -1):
        message = messages[index]
        if not isinstance(message, dict):
            continue
        if str(message.get("role") or "").strip().lower() != "user":
            continue
        content = message.get("content")
        if not isinstance(content, str):
            return None
        messages[index] = {**message, "content": f"{marker} {content}"}
        return marker

    return None
