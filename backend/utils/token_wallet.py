from __future__ import annotations

import json
from typing import Any
from datetime import datetime, UTC

from sqlalchemy.orm import Session

from models import SystemSettings, User, UserTokenWalletLedger

CREDIT_TOPUP_PACKAGES_SETTING_KEY = "credit_topup_packages"
DEFAULT_CREDIT_TOPUP_PACKAGES = [
    {"id": "topup_500", "credits": 500, "price_cny": 3, "label": "入门"},
    {"id": "topup_1000", "credits": 1000, "price_cny": 6, "label": "标准"},
    {"id": "topup_2000", "credits": 2000, "price_cny": 12, "label": "热门"},
    {"id": "topup_5000", "credits": 5000, "price_cny": 30, "label": "巨量"},
    {"id": "topup_10000", "credits": 10000, "price_cny": 60, "label": "海量"},
]

# Legacy token constants (kept for backward compatibility with admin UI)
TOKEN_TOPUP_PACKAGES_SETTING_KEY = "token_topup_packages"
DEFAULT_TOKEN_TOPUP_PACKAGES = [
    {"id": "topup_500k", "tokens": 500_000, "price_cny": 3, "label": "入门"},
    {"id": "topup_1m", "tokens": 1_000_000, "price_cny": 6, "label": "标准"},
    {"id": "topup_2m", "tokens": 2_000_000, "price_cny": 12, "label": "热门"},
    {"id": "topup_5m", "tokens": 5_000_000, "price_cny": 30, "label": "巨量"},
    {"id": "topup_10m", "tokens": 10_000_000, "price_cny": 60, "label": "海量"},
]


def _normalize_package(raw: dict[str, Any]) -> dict[str, Any] | None:
    """Normalize a package dict — supports both 'tokens' (legacy) and 'credits' (new) keys."""
    package_id = str(raw.get("id") or "").strip()
    if not package_id:
        return None

    # Prefer credits; fall back to tokens for legacy data
    credits = raw.get("credits")
    if credits is not None:
        try:
            credits_val = float(credits)
        except (TypeError, ValueError):
            return None
    else:
        try:
            credits_val = float(raw.get("tokens") or 0)
        except (TypeError, ValueError):
            return None

    try:
        price_cny = float(raw.get("price_cny") or 0)
    except (TypeError, ValueError):
        return None

    if credits_val <= 0 or price_cny <= 0:
        return None

    return {
        "id": package_id,
        "credits": credits_val,
        "price_cny": round(price_cny, 2),
        "label": str(raw.get("label") or "").strip() or package_id,
    }


def _serialize_packages(packages: list[dict[str, Any]]) -> str:
    return json.dumps(packages, ensure_ascii=False)


# -- Credit top-up packages (new) --------------------------------------------------

def get_credit_topup_packages(db: Session, *, ensure_default: bool = True) -> list[dict[str, Any]]:
    """Return the list of credit (点数) top-up packages."""
    setting = db.query(SystemSettings).filter(SystemSettings.key == CREDIT_TOPUP_PACKAGES_SETTING_KEY).first()

    if not setting:
        if not ensure_default:
            return []
        setting = SystemSettings(
            key=CREDIT_TOPUP_PACKAGES_SETTING_KEY,
            value=_serialize_packages(DEFAULT_CREDIT_TOPUP_PACKAGES),
        )
        db.add(setting)
        db.commit()
        db.refresh(setting)

    parsed: Any
    try:
        parsed = json.loads(setting.value or "[]")
    except Exception:
        parsed = DEFAULT_CREDIT_TOPUP_PACKAGES

    packages: list[dict[str, Any]] = []
    if isinstance(parsed, list):
        for item in parsed:
            if not isinstance(item, dict):
                continue
            normalized = _normalize_package(item)
            if normalized:
                packages.append(normalized)

    if not packages:
        packages = [dict(item) for item in DEFAULT_CREDIT_TOPUP_PACKAGES]

    packages.sort(key=lambda item: item["credits"])
    return packages


def get_credit_topup_package_by_id(db: Session, package_id: str) -> dict[str, Any] | None:
    normalized_id = str(package_id or "").strip()
    if not normalized_id:
        return None

    for package in get_credit_topup_packages(db):
        if package["id"] == normalized_id:
            return package
    return None


def get_credit_topup_package_by_amount(db: Session, amount: float, tolerance: float = 0.01) -> dict[str, Any] | None:
    try:
        amount_value = float(amount)
    except (TypeError, ValueError):
        return None

    for package in get_credit_topup_packages(db):
        if abs(float(package["price_cny"]) - amount_value) <= tolerance:
            return package
    return None


def set_credit_topup_packages(
    db: Session,
    *,
    packages: list[dict[str, Any]],
    updated_by: str | None = None,
) -> list[dict[str, Any]]:
    normalized_packages: list[dict[str, Any]] = []
    seen_ids: set[str] = set()
    for raw in packages:
        if not isinstance(raw, dict):
            continue
        normalized = _normalize_package(raw)
        if not normalized:
            continue
        if normalized["id"] in seen_ids:
            continue
        seen_ids.add(normalized["id"])
        normalized_packages.append(normalized)

    if not normalized_packages:
        raise ValueError("At least one valid credit package is required")

    normalized_packages.sort(key=lambda item: item["credits"])

    setting = db.query(SystemSettings).filter(SystemSettings.key == CREDIT_TOPUP_PACKAGES_SETTING_KEY).first()
    if setting:
        setting.value = _serialize_packages(normalized_packages)
        setting.updated_at = datetime.now(UTC)
        setting.updated_by = updated_by
    else:
        setting = SystemSettings(
            key=CREDIT_TOPUP_PACKAGES_SETTING_KEY,
            value=_serialize_packages(normalized_packages),
            updated_by=updated_by,
        )
        db.add(setting)

    db.commit()
    return normalized_packages


# -- Legacy token top-up packages (kept for admin backward compat) ------------------

# These are thin wrappers that delegate to the credit equivalents but return
# "tokens"-keyed dicts so existing admin callers aren't broken.

def get_token_topup_packages(db: Session, *, ensure_default: bool = True) -> list[dict[str, Any]]:
    """Legacy wrapper — returns credit packages with 'tokens' alias key."""
    credit_packages = get_credit_topup_packages(db, ensure_default=ensure_default)
    result = []
    for pkg in credit_packages:
        p = dict(pkg)
        p["tokens"] = p.pop("credits", 0)
        result.append(p)
    return result


def get_token_topup_package_by_id(db: Session, package_id: str) -> dict[str, Any] | None:
    pkg = get_credit_topup_package_by_id(db, package_id)
    if not pkg:
        return None
    p = dict(pkg)
    p["tokens"] = p.pop("credits", 0)
    return p


def get_token_topup_package_by_amount(db: Session, amount: float, tolerance: float = 0.01) -> dict[str, Any] | None:
    pkg = get_credit_topup_package_by_amount(db, amount, tolerance)
    if not pkg:
        return None
    p = dict(pkg)
    p["tokens"] = p.pop("credits", 0)
    return p


def set_token_topup_packages(
    db: Session,
    *,
    packages: list[dict[str, Any]],
    updated_by: str | None = None,
) -> list[dict[str, Any]]:
    """Legacy wrapper — accepts token-keyed packages, stores as credits."""
    return set_credit_topup_packages(db, packages=packages, updated_by=updated_by)


# -- Credit wallet operations ------------------------------------------------------

def _load_user_for_update(db: Session, user_id: str) -> User | None:
    return db.query(User).filter(User.id == user_id).with_for_update().first()


def credit_wallet(
    db: Session,
    *,
    user_id: str,
    credits: float,
    source: str,
    source_order_no: str | None = None,
    idempotency_key: str | None = None,
    metadata: dict[str, Any] | None = None,
) -> tuple[bool, float]:
    """Add credits (点数) to a user's purchased credit balance."""
    if credits <= 0:
        raise ValueError("credits must be positive")

    if idempotency_key:
        existing = db.query(UserTokenWalletLedger).filter(UserTokenWalletLedger.idempotency_key == idempotency_key).first()
        if existing:
            return False, float(existing.credit_balance_after or 0)

    user = _load_user_for_update(db, user_id)
    if not user:
        raise ValueError("user not found")

    current_balance = float(user.purchased_credit_balance or 0)
    new_balance = current_balance + float(credits)
    user.purchased_credit_balance = new_balance
    user.purchased_credits_bought_total = float(user.purchased_credits_bought_total or 0) + float(credits)

    db.add(UserTokenWalletLedger(
        user_id=user_id,
        transaction_type="credit",
        token_amount=int(credits),  # legacy int field
        balance_after=0,  # legacy int field
        credit_amount=float(credits),
        credit_balance_after=new_balance,
        source=source,
        source_order_no=source_order_no,
        idempotency_key=idempotency_key,
        wallet_meta=metadata or {},
    ))

    db.flush()
    return True, new_balance


def consume_wallet_credits(
    db: Session,
    *,
    user_id: str,
    credits: float,
    source: str,
    source_order_no: str | None = None,
    idempotency_key: str | None = None,
    metadata: dict[str, Any] | None = None,
) -> tuple[bool, float]:
    """Consume credits from a user's purchased credit balance. Returns (success, balance_after)."""
    if credits <= 0:
        return True, 0.0

    if idempotency_key:
        existing = db.query(UserTokenWalletLedger).filter(UserTokenWalletLedger.idempotency_key == idempotency_key).first()
        if existing:
            return True, float(existing.credit_balance_after or 0)

    user = _load_user_for_update(db, user_id)
    if not user:
        raise ValueError("user not found")

    current_balance = float(user.purchased_credit_balance or 0)
    if current_balance < float(credits):
        return False, current_balance

    new_balance = current_balance - float(credits)
    user.purchased_credit_balance = new_balance
    user.purchased_credits_consumed_total = float(user.purchased_credits_consumed_total or 0) + float(credits)

    db.add(UserTokenWalletLedger(
        user_id=user_id,
        transaction_type="consume",
        token_amount=-int(credits),  # legacy int field
        balance_after=0,  # legacy int field
        credit_amount=-float(credits),
        credit_balance_after=new_balance,
        source=source,
        source_order_no=source_order_no,
        idempotency_key=idempotency_key,
        wallet_meta=metadata or {},
    ))

    db.flush()
    return True, new_balance


def reverse_wallet_credits_for_refund(
    db: Session,
    *,
    user_id: str,
    credits: float,
    source_order_no: str,
    idempotency_key: str,
) -> dict[str, float]:
    """Reverse credits from wallet for a refund. Returns {reversed_credits, shortfall_credits, balance_after}."""
    if credits <= 0:
        return {"reversed_credits": 0.0, "shortfall_credits": 0.0, "balance_after": 0.0}

    existing = db.query(UserTokenWalletLedger).filter(UserTokenWalletLedger.idempotency_key == idempotency_key).first()
    if existing:
        return {
            "reversed_credits": abs(float(existing.credit_amount or 0)),
            "shortfall_credits": 0.0,
            "balance_after": float(existing.credit_balance_after or 0),
        }

    user = _load_user_for_update(db, user_id)
    if not user:
        raise ValueError("user not found")

    current_balance = float(user.purchased_credit_balance or 0)
    reversed_credits = min(current_balance, float(credits))
    shortfall = float(credits) - reversed_credits

    if reversed_credits > 0:
        user.purchased_credit_balance = current_balance - reversed_credits
        db.add(UserTokenWalletLedger(
            user_id=user_id,
            transaction_type="refund_reverse",
            token_amount=-int(reversed_credits),
            balance_after=0,
            credit_amount=-reversed_credits,
            credit_balance_after=float(user.purchased_credit_balance or 0),
            source="refund",
            source_order_no=source_order_no,
            idempotency_key=idempotency_key,
            wallet_meta={"shortfall_credits": shortfall},
        ))
        db.flush()

    return {
        "reversed_credits": reversed_credits,
        "shortfall_credits": shortfall,
        "balance_after": float(user.purchased_credit_balance or 0),
    }


# -- Legacy token wallet functions (backward compat wrappers) -----------------------

def credit_wallet_tokens(
    db: Session,
    *,
    user_id: str,
    tokens: int,
    source: str,
    source_order_no: str | None = None,
    idempotency_key: str | None = None,
    metadata: dict[str, Any] | None = None,
) -> tuple[bool, int]:
    """Legacy — delegates to credit_wallet."""
    success, balance = credit_wallet(
        db,
        user_id=user_id,
        credits=float(tokens),
        source=source,
        source_order_no=source_order_no,
        idempotency_key=idempotency_key,
        metadata=metadata,
    )
    return success, int(balance)


def consume_wallet_tokens(
    db: Session,
    *,
    user_id: str,
    tokens: int,
    source: str,
    source_order_no: str | None = None,
    idempotency_key: str | None = None,
    metadata: dict[str, Any] | None = None,
) -> tuple[bool, int]:
    """Legacy — delegates to consume_wallet_credits."""
    success, balance = consume_wallet_credits(
        db,
        user_id=user_id,
        credits=float(tokens),
        source=source,
        source_order_no=source_order_no,
        idempotency_key=idempotency_key,
        metadata=metadata,
    )
    return success, int(balance)


def reverse_wallet_tokens_for_refund(
    db: Session,
    *,
    user_id: str,
    tokens: int,
    source_order_no: str,
    idempotency_key: str,
) -> dict[str, int]:
    """Legacy — delegates to reverse_wallet_credits_for_refund."""
    result = reverse_wallet_credits_for_refund(
        db,
        user_id=user_id,
        credits=float(tokens),
        source_order_no=source_order_no,
        idempotency_key=idempotency_key,
    )
    return {
        "reversed_tokens": int(result["reversed_credits"]),
        "shortfall_tokens": int(result["shortfall_credits"]),
        "balance_after": int(result["balance_after"]),
    }
