"""Admin API: system configuration - rate-limit inspection, credit top-up
packages and the dev-only SMS verification bypass toggle.
"""

from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel
from sqlalchemy.orm import Session

from database import get_db
from models import User
from utils.credit_wallet import get_credit_topup_packages
from utils.security_middleware import get_rate_limit_status
from utils.session import get_current_admin_user
from utils.sms_utils import (
    is_dev_environment,
    get_dev_sms_bypass_info,
    set_dev_sms_bypass_enabled,
)

router = APIRouter(tags=["admin"])


# Pydantic models for request bodies
class DevSmsBypassToggle(BaseModel):
    enabled: bool


class CreditTopupPackageItem(BaseModel):
    id: str
    credits: int
    price_cny: float
    label: Optional[str] = None


class CreditTopupPackagesUpdateRequest(BaseModel):
    packages: List[CreditTopupPackageItem]


@router.get("/security/rate-limit/{ip}")
def get_ip_rate_limit_status(
    ip: str,
    current_admin: User = Depends(get_current_admin_user)
):
    """Get rate limit status for a specific IP - Admin only"""
    status = get_rate_limit_status(ip)
    return status


@router.get("/security/rate-limit")
def get_current_rate_limit_status(
    request: Request,
    current_admin: User = Depends(get_current_admin_user)
):
    """Get rate limit status for the current IP - Admin only"""
    # Extract IP from request
    forwarded_for = request.headers.get("X-Forwarded-For")
    if forwarded_for:
        ip = forwarded_for.split(",")[0].strip()
    else:
        ip = request.headers.get("X-Real-IP") or request.client.host

    status = get_rate_limit_status(ip)
    return status


@router.get("/credit-topup-packages")
def get_credit_topup_packages_admin(
    db: Session = Depends(get_db),
    current_admin: User = Depends(get_current_admin_user),
):
    packages = get_credit_topup_packages(db)
    return {
        "packages": packages,
    }


@router.put("/credit-topup-packages")
def update_credit_topup_packages_admin(
    payload: CreditTopupPackagesUpdateRequest,
    db: Session = Depends(get_db),
    current_admin: User = Depends(get_current_admin_user),
):
    if not payload.packages:
        raise HTTPException(status_code=400, detail="At least one package is required")

    raw_packages = [
        {
            "id": item.id,
            "credits": item.credits,
            "price_cny": item.price_cny,
            "label": item.label,
        }
        for item in payload.packages
    ]

    return {
        "message": "Credit top-up packages are now defined in code. Edit credit_wallet.py DEFAULT_CREDIT_TOPUP_PACKAGES to change.",
        "packages": get_credit_topup_packages(db),
    }


# ---------------------------------------------------------------------------
# Dev-only: SMS verification bypass toggle
# ---------------------------------------------------------------------------

@router.get("/dev-sms-bypass")
def get_dev_sms_bypass(
    current_admin: User = Depends(get_current_admin_user)
):
    """获取开发环境万能验证码状态（仅开发环境，管理后台用）。"""
    if not is_dev_environment():
        return {"available": False, "enabled": False, "code": None}
    info = get_dev_sms_bypass_info()
    return {"available": True, "enabled": info['enabled'], "code": info['code']}


@router.post("/dev-sms-bypass")
def toggle_dev_sms_bypass(
    payload: DevSmsBypassToggle,
    current_admin: User = Depends(get_current_admin_user)
):
    """开启/关闭开发环境万能验证码（仅开发环境，管理后台用）。"""
    if not is_dev_environment():
        raise HTTPException(status_code=404, detail="Dev SMS bypass is not available in production")
    set_dev_sms_bypass_enabled(payload.enabled)
    info = get_dev_sms_bypass_info()
    return {"available": True, "enabled": info['enabled'], "code": info['code']}
