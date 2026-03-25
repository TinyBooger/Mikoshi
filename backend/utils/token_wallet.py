from __future__ import annotations

import json
from typing import Any
from datetime import datetime, UTC

from sqlalchemy.orm import Session

from models import SystemSettings, User, UserTokenWalletLedger

TOKEN_TOPUP_PACKAGES_SETTING_KEY = "token_topup_packages"
DEFAULT_TOKEN_TOPUP_PACKAGES = [
    {"id": "topup_500k", "tokens": 500_000, "price_cny": 3, "label": "入门"},
    {"id": "topup_1m", "tokens": 1_000_000, "price_cny": 6, "label": "标准"},
    {"id": "topup_2m", "tokens": 2_000_000, "price_cny": 12, "label": "热门"},
    {"id": "topup_5m", "tokens": 5_000_000, "price_cny": 30, "label": "巨量"},
    {"id": "topup_10m", "tokens": 10_000_000, "price_cny": 60, "label": "海量"},
]


def _normalize_package(raw: dict[str, Any]) -> dict[str, Any] | None:
    package_id = str(raw.get("id") or "").strip()
    if not package_id:
        return None

    try:
        tokens = int(raw.get("tokens") or 0)
        price_cny = float(raw.get("price_cny") or 0)
    except (TypeError, ValueError):
        return None

    if tokens <= 0 or price_cny <= 0:
        return None

    return {
        "id": package_id,
        "tokens": tokens,
        "price_cny": round(price_cny, 2),
        "label": str(raw.get("label") or "").strip() or package_id,
    }


def _serialize_packages(packages: list[dict[str, Any]]) -> str:
    return json.dumps(packages, ensure_ascii=False)


def get_token_topup_packages(db: Session, *, ensure_default: bool = True) -> list[dict[str, Any]]:
    setting = db.query(SystemSettings).filter(SystemSettings.key == TOKEN_TOPUP_PACKAGES_SETTING_KEY).first()

    if not setting:
        if not ensure_default:
            return []
        setting = SystemSettings(
            key=TOKEN_TOPUP_PACKAGES_SETTING_KEY,
            value=_serialize_packages(DEFAULT_TOKEN_TOPUP_PACKAGES),
        )
        db.add(setting)
        db.commit()
        db.refresh(setting)

    parsed: Any
    try:
        parsed = json.loads(setting.value or "[]")
    except Exception:
        parsed = DEFAULT_TOKEN_TOPUP_PACKAGES

    packages: list[dict[str, Any]] = []
    if isinstance(parsed, list):
        for item in parsed:
            if not isinstance(item, dict):
                continue
            normalized = _normalize_package(item)
            if normalized:
                packages.append(normalized)

    if not packages:
        packages = [dict(item) for item in DEFAULT_TOKEN_TOPUP_PACKAGES]

    packages.sort(key=lambda item: item["tokens"])
    return packages


def get_token_topup_package_by_id(db: Session, package_id: str) -> dict[str, Any] | None:
    normalized_id = str(package_id or "").strip()
    if not normalized_id:
        return None

    for package in get_token_topup_packages(db):
        if package["id"] == normalized_id:
            return package
    return None


def get_token_topup_package_by_amount(db: Session, amount: float, tolerance: float = 0.01) -> dict[str, Any] | None:
    try:
        amount_value = float(amount)
    except (TypeError, ValueError):
        return None

    for package in get_token_topup_packages(db):
        if abs(float(package["price_cny"]) - amount_value) <= tolerance:
            return package
    return None


def set_token_topup_packages(
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
        raise ValueError("At least one valid token package is required")

    normalized_packages.sort(key=lambda item: item["tokens"])

    setting = db.query(SystemSettings).filter(SystemSettings.key == TOKEN_TOPUP_PACKAGES_SETTING_KEY).first()
    if setting:
        setting.value = _serialize_packages(normalized_packages)
        setting.updated_at = datetime.now(UTC)
        setting.updated_by = updated_by
    else:
        setting = SystemSettings(
            key=TOKEN_TOPUP_PACKAGES_SETTING_KEY,
            value=_serialize_packages(normalized_packages),
            updated_by=updated_by,
        )
        db.add(setting)

    db.commit()
    return normalized_packages


def _load_user_for_update(db: Session, user_id: str) -> User | None:
    return db.query(User).filter(User.id == user_id).with_for_update().first()


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
    if tokens <= 0:
        raise ValueError("tokens must be positive")

    if idempotency_key:
        existing = db.query(UserTokenWalletLedger).filter(UserTokenWalletLedger.idempotency_key == idempotency_key).first()
        if existing:
            return False, int(existing.balance_after or 0)

    user = _load_user_for_update(db, user_id)
    if not user:
        raise ValueError("user not found")

    new_balance = int(user.purchased_token_balance or 0) + int(tokens)
    user.purchased_token_balance = new_balance
    user.purchased_tokens_bought_total = int(user.purchased_tokens_bought_total or 0) + int(tokens)

    db.add(UserTokenWalletLedger(
        user_id=user_id,
        transaction_type="credit",
        token_amount=int(tokens),
        balance_after=new_balance,
        source=source,
        source_order_no=source_order_no,
        idempotency_key=idempotency_key,
        wallet_meta=metadata or {},
    ))

    db.flush()
    return True, new_balance


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
    if tokens <= 0:
        return True, 0

    if idempotency_key:
        existing = db.query(UserTokenWalletLedger).filter(UserTokenWalletLedger.idempotency_key == idempotency_key).first()
        if existing:
            return True, int(existing.balance_after or 0)

    user = _load_user_for_update(db, user_id)
    if not user:
        raise ValueError("user not found")

    current_balance = int(user.purchased_token_balance or 0)
    if current_balance < int(tokens):
        return False, current_balance

    new_balance = current_balance - int(tokens)
    user.purchased_token_balance = new_balance
    user.purchased_tokens_consumed_total = int(user.purchased_tokens_consumed_total or 0) + int(tokens)

    db.add(UserTokenWalletLedger(
        user_id=user_id,
        transaction_type="consume",
        token_amount=-int(tokens),
        balance_after=new_balance,
        source=source,
        source_order_no=source_order_no,
        idempotency_key=idempotency_key,
        wallet_meta=metadata or {},
    ))

    db.flush()
    return True, new_balance


def reverse_wallet_tokens_for_refund(
    db: Session,
    *,
    user_id: str,
    tokens: int,
    source_order_no: str,
    idempotency_key: str,
) -> dict[str, int]:
    if tokens <= 0:
        return {"reversed_tokens": 0, "shortfall_tokens": 0, "balance_after": 0}

    existing = db.query(UserTokenWalletLedger).filter(UserTokenWalletLedger.idempotency_key == idempotency_key).first()
    if existing:
        return {"reversed_tokens": abs(int(existing.token_amount or 0)), "shortfall_tokens": 0, "balance_after": int(existing.balance_after or 0)}

    user = _load_user_for_update(db, user_id)
    if not user:
        raise ValueError("user not found")

    current_balance = int(user.purchased_token_balance or 0)
    reversed_tokens = min(current_balance, int(tokens))
    shortfall = int(tokens) - reversed_tokens

    if reversed_tokens > 0:
        user.purchased_token_balance = current_balance - reversed_tokens
        db.add(UserTokenWalletLedger(
            user_id=user_id,
            transaction_type="refund_reverse",
            token_amount=-reversed_tokens,
            balance_after=int(user.purchased_token_balance or 0),
            source="refund",
            source_order_no=source_order_no,
            idempotency_key=idempotency_key,
            wallet_meta={"shortfall_tokens": shortfall},
        ))
        db.flush()

    return {
        "reversed_tokens": int(reversed_tokens),
        "shortfall_tokens": int(shortfall),
        "balance_after": int(user.purchased_token_balance or 0),
    }
