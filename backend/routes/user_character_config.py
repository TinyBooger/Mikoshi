"""
Per-user, per-character chat configuration overrides (delta storage).

Only keys that differ from the character creator's defaults are stored.
When building effective config: start with character defaults, then apply
the user_character_configs.config delta on top.
"""
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session
from database import get_db
from models import User, Character, UserCharacterConfig
from schemas import UserCharacterConfigIn, UserCharacterConfigOut
from utils.session import get_current_user
from model_configs import ALLOWED_MODEL_IDS
from datetime import datetime, UTC
import logging

logger = logging.getLogger(__name__)

router = APIRouter()

# ---------------------------------------------------------------------------
# Character-default keys we track as overridable.
# Must match the fields on the Character model + context_window_tier.
# ---------------------------------------------------------------------------
CONFIG_KEYS = [
    "model",
    "temperature",
    "top_p",
    "max_tokens",
    "presence_penalty",
    "frequency_penalty",
    "context_window_tier",
]

ALLOWED_CONTEXT_WINDOW_TIERS = {"8k", "32k", "128k", "256k", "512k", "1m"}


def _get_character_defaults(character: Character) -> dict:
    """Return the character's default chat config as a flat dict."""
    return {
        "model": character.model,
        "temperature": float(character.temperature),
        "top_p": float(character.top_p),
        "max_tokens": int(character.max_tokens),
        "presence_penalty": float(character.presence_penalty),
        "frequency_penalty": float(character.frequency_penalty),
        "context_window_tier": character.context_window_tier,
    }


def _compute_delta(full_config: dict, defaults: dict) -> dict:
    """Return only the keys that differ from defaults (delta)."""
    delta = {}
    for key in CONFIG_KEYS:
        user_val = full_config.get(key)
        default_val = defaults.get(key)
        if user_val is not None and user_val != default_val:
            delta[key] = user_val
    return delta


def _apply_delta(defaults: dict, delta: dict) -> dict:
    """Apply a user delta on top of character defaults to produce the effective config."""
    effective = dict(defaults)
    for key in CONFIG_KEYS:
        if key in delta and delta[key] is not None:
            effective[key] = delta[key]
    return effective


def _validate_and_normalize_config(raw: dict, is_pro: bool, defaults: dict) -> dict:
    """Validate and normalize incoming config values, clamping to safe ranges."""
    config = {}

    # model
    model = raw.get("model")
    if isinstance(model, str) and model in ALLOWED_MODEL_IDS:
        config["model"] = model

    # temperature
    try:
        val = float(raw.get("temperature", defaults["temperature"]))
    except (TypeError, ValueError):
        val = defaults["temperature"]
    config["temperature"] = max(0.0, min(2.0, val)) if is_pro else defaults["temperature"]

    # top_p
    try:
        val = float(raw.get("top_p", defaults["top_p"]))
    except (TypeError, ValueError):
        val = defaults["top_p"]
    config["top_p"] = max(0.0, min(1.0, val)) if is_pro else defaults["top_p"]

    # max_tokens
    if is_pro:
        try:
            config["max_tokens"] = max(1, int(raw.get("max_tokens", defaults["max_tokens"])))
        except (TypeError, ValueError):
            config["max_tokens"] = defaults["max_tokens"]
    else:
        config["max_tokens"] = defaults["max_tokens"]

    # presence_penalty
    try:
        val = float(raw.get("presence_penalty", defaults["presence_penalty"]))
    except (TypeError, ValueError):
        val = defaults["presence_penalty"]
    config["presence_penalty"] = max(-2.0, min(2.0, val)) if is_pro else defaults["presence_penalty"]

    # frequency_penalty
    try:
        val = float(raw.get("frequency_penalty", defaults["frequency_penalty"]))
    except (TypeError, ValueError):
        val = defaults["frequency_penalty"]
    config["frequency_penalty"] = max(-2.0, min(2.0, val)) if is_pro else defaults["frequency_penalty"]

    # context_window_tier
    tier = raw.get("context_window_tier")
    if isinstance(tier, str) and tier.lower() in ALLOWED_CONTEXT_WINDOW_TIERS:
        config["context_window_tier"] = tier.lower()

    return config


@router.get("/api/user-character-config/{character_id}")
def get_user_character_config(
    character_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Return the stored config delta for this user+character (empty {} if none)."""
    character = db.query(Character).filter(Character.id == character_id).first()
    if not character:
        raise HTTPException(status_code=404, detail="Character not found")

    entry = db.query(UserCharacterConfig).filter(
        UserCharacterConfig.user_id == current_user.id,
        UserCharacterConfig.character_id == character_id,
    ).first()

    if not entry:
        return JSONResponse(content={
            "user_id": current_user.id,
            "character_id": character_id,
            "config": {},
            "updated_at": None,
        })

    return JSONResponse(content={
        "user_id": entry.user_id,
        "character_id": entry.character_id,
        "config": entry.config or {},
        "updated_at": entry.updated_at.isoformat() if entry.updated_at else None,
    })


@router.put("/api/user-character-config/{character_id}")
def save_user_character_config(
    character_id: int,
    body: UserCharacterConfigIn,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Save user config override delta for this character.

    The client sends the full effective config.  The backend loads character
    defaults, validates/clamps the values, and stores only the keys that differ
    from the defaults (delta).  Non-Pro users get sampling params forced back to
    defaults.
    """
    character = db.query(Character).filter(Character.id == character_id).first()
    if not character:
        raise HTTPException(status_code=404, detail="Character not found")

    is_pro = bool(current_user.is_pro)
    defaults = _get_character_defaults(character)
    normalized = _validate_and_normalize_config(body.model_dump(exclude_none=True), is_pro, defaults)
    delta = _compute_delta(normalized, defaults)

    entry = db.query(UserCharacterConfig).filter(
        UserCharacterConfig.user_id == current_user.id,
        UserCharacterConfig.character_id == character_id,
    ).first()

    if entry:
        entry.config = delta
        entry.updated_at = datetime.now(UTC)
    else:
        entry = UserCharacterConfig(
            user_id=current_user.id,
            character_id=character_id,
            config=delta,
        )
        db.add(entry)

    db.commit()
    db.refresh(entry)

    logger.info(
        "💾 User config saved | user=%s | character=%d | delta_keys=%s",
        current_user.id,
        character_id,
        list(delta.keys()),
    )

    return JSONResponse(content={
        "user_id": entry.user_id,
        "character_id": entry.character_id,
        "config": entry.config or {},
        "updated_at": entry.updated_at.isoformat() if entry.updated_at else None,
    })
