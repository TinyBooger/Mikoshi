"""
微信支付路由（直连商户 v3 Native扫码支付）
"""
from fastapi import APIRouter, HTTPException, Request, Depends, Header, Response, BackgroundTasks
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from typing import Optional
from datetime import datetime
from urllib.parse import urlparse
import ipaddress
import re
import os
import logging
import uuid

from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError

from utils.payment_provider import get_wechat_payment_provider
from utils.wechat_pay_utils import wechat_pay_client
from utils.session import verify_session_token, get_current_admin_user
from utils.user_utils import upgrade_to_pro
from utils.token_wallet import (
    get_token_topup_packages,
    get_token_topup_package_by_id,
    get_token_topup_package_by_amount,
    credit_wallet_tokens,
    reverse_wallet_tokens_for_refund,
)
from database import get_db, SessionLocal
from models import User, PaymentOrder
from utils.audit_logger import AuditLog

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/wechat", tags=["wechat_pay"])

PRO_AMOUNT_TOLERANCE = 0.01
TOKEN_TOPUP_AMOUNT_TOLERANCE = 0.01

PRO_UPGRADE_PLANS = [
    {"amount": 15.0,  "days": 30},
    {"amount": 40.0,  "days": 90},
    {"amount": 72.0,  "days": 180},
    {"amount": 120.0, "days": 365},
]


# ─── Helpers ─────────────────────────────────────────────────────────────────

def _get_payment_provider():
    return get_wechat_payment_provider()


def _is_public_base_url(base_url: str) -> bool:
    if not base_url:
        return False

    parsed = urlparse(base_url)
    if parsed.scheme not in {"http", "https"}:
        return False
    if not parsed.netloc:
        return False
    if parsed.query:
        return False

    host = (parsed.hostname or "").strip().lower()
    if not host:
        return False
    if host == "localhost":
        return False

    try:
        ip = ipaddress.ip_address(host)
        if ip.is_private or ip.is_loopback or ip.is_link_local:
            return False
    except ValueError:
        pass

    return True


def _is_valid_notify_url(url: str) -> bool:
    if not _is_public_base_url(url):
        return False
    parsed = urlparse(url)
    return bool(parsed.path and parsed.path != "/")


def _utf8_len(value: str) -> int:
    return len(value.encode("utf-8"))


_OUT_TRADE_NO_PATTERN = re.compile(r"^[0-9A-Za-z_\-|\*]{6,32}$")


def _is_valid_out_trade_no(out_trade_no: str) -> bool:
    if not out_trade_no:
        return False
    return bool(_OUT_TRADE_NO_PATTERN.fullmatch(out_trade_no))


def _extract_user_id(out_trade_no: Optional[str]) -> Optional[str]:
    if not out_trade_no or "_U" not in out_trade_no:
        return None
    user_segment = out_trade_no.split("_U", 1)[-1]
    if "_C" in user_segment:
        user_segment = user_segment.split("_C", 1)[0]
    return user_segment or None


def _build_wechat_attach(user_id: Optional[str]) -> Optional[str]:
    if not user_id:
        return None
    attach = f"u={user_id}"
    # WeChat attach max length is 128 characters.
    return attach if len(attach) <= 128 else None


def _extract_user_id_from_attach(attach: Optional[str]) -> Optional[str]:
    if not attach:
        return None
    if attach.startswith("u="):
        value = attach[2:].strip()
        return value or None
    return None


def _get_pro_upgrade_plan(total_amount) -> Optional[dict]:
    try:
        if total_amount is None:
            return None
        amount = float(total_amount)
        for plan in PRO_UPGRADE_PLANS:
            if abs(amount - plan["amount"]) <= PRO_AMOUNT_TOLERANCE:
                return plan
        return None
    except (TypeError, ValueError):
        return None


def _is_valid_pro_upgrade_amount(total_amount) -> bool:
    return _get_pro_upgrade_plan(total_amount) is not None


def _resolve_order_type_from_out_trade_no(out_trade_no: str) -> str:
    if out_trade_no.startswith("WXPRO_"):
        return "pro_upgrade"
    if out_trade_no.startswith("WXTOPUP_"):
        return "token_topup"
    return "unknown"


def _build_notify_url() -> Optional[str]:
    # Prefer explicit env var, fall back to BACKEND_BASE_URL
    notify_url = os.getenv("WECHAT_NOTIFY_URL", "").strip()
    if notify_url and _is_valid_notify_url(notify_url):
        return notify_url
    backend_base_url = os.getenv("BACKEND_BASE_URL", "").rstrip("/")
    if _is_public_base_url(backend_base_url):
        candidate = f"{backend_base_url}/api/wechat/notify"
        if _is_valid_notify_url(candidate):
            return candidate
    return None


def _settle_wechat_order_in_background(
    out_trade_no: str,
    trade_no: Optional[str],
    total_yuan: Optional[str],
    source: str,
    attach_user_id: Optional[str],
):
    db = SessionLocal()
    try:
        resolved_order_type = _resolve_order_type_from_out_trade_no(out_trade_no)
        if resolved_order_type == "pro_upgrade":
            _handle_pro_upgrade(
                db=db,
                out_trade_no=out_trade_no,
                trade_no=trade_no,
                total_amount=total_yuan,
                source=source,
                user_id=attach_user_id,
            )
        elif resolved_order_type == "token_topup":
            _handle_token_topup(
                db=db,
                out_trade_no=out_trade_no,
                trade_no=trade_no,
                total_amount=total_yuan,
                source=source,
                user_id=attach_user_id,
            )
    except Exception as e:
        logger.error(f"后台处理微信支付订单失败: out_trade_no={out_trade_no}, error={e}")
    finally:
        db.close()


# ─── Database helpers (mirrored from alipay.py) ───────────────────────────────

def _claim_payment_order(
    db: Session,
    out_trade_no: str,
    order_type: str,
    user_id: Optional[str],
    trade_no: Optional[str],
    total_amount: Optional[str],
    source: str,
) -> Optional[PaymentOrder]:
    payment_order = PaymentOrder(
        out_trade_no=out_trade_no,
        user_id=user_id,
        order_type=order_type,
        trade_no=trade_no,
        total_amount=str(total_amount) if total_amount is not None else None,
        source=source,
        status="processing",
    )
    try:
        db.add(payment_order)
        db.commit()
        db.refresh(payment_order)
        return payment_order
    except IntegrityError:
        db.rollback()
        return None


def _finalize_payment_order(
    db: Session,
    payment_order: PaymentOrder,
    status: str,
    error_message: Optional[str] = None,
    trade_no: Optional[str] = None,
    total_amount: Optional[str] = None,
    source: Optional[str] = None,
):
    payment_order.status = status
    payment_order.error_message = error_message
    if trade_no:
        payment_order.trade_no = trade_no
    if total_amount is not None:
        payment_order.total_amount = str(total_amount)
    if source:
        payment_order.source = source
    db.commit()


def _record_order_result(
    db,
    out_trade_no: str,
    order_type: str,
    user_id: Optional[str],
    trade_no: Optional[str],
    total_amount: Optional[str],
    source: str,
    status: str = "success",
    error_message: Optional[str] = None,
):
    action = f"wechat_{order_type}:{out_trade_no}"
    audit_entry = AuditLog(
        user_id=user_id,
        action=action,
        meta={
            "trade_no": trade_no,
            "total_amount": total_amount,
            "source": source,
            "order_type": order_type,
        },
        status=status,
        error_message=error_message,
    )
    try:
        db.add(audit_entry)
        db.commit()
    except Exception as e:
        db.rollback()
        logger.error(f"记录微信支付审计日志失败: {e}")


def _handle_pro_upgrade(
    db,
    out_trade_no: str,
    trade_no: Optional[str],
    total_amount: Optional[str],
    source: str,
    user_id: Optional[str] = None,
):
    if not out_trade_no.startswith("WXPRO_"):
        return

    user_id = user_id or _extract_user_id(out_trade_no)

    payment_order = _claim_payment_order(
        db=db,
        out_trade_no=out_trade_no,
        order_type="pro_upgrade",
        user_id=user_id,
        trade_no=trade_no,
        total_amount=total_amount,
        source=source,
    )
    if payment_order is None:
        existing = db.query(PaymentOrder).filter(PaymentOrder.out_trade_no == out_trade_no).first()
        existing_status = existing.status if existing else "unknown"
        logger.info(f"微信支付订单已被处理，跳过: {out_trade_no}, status={existing_status}")
        return

    if not _is_valid_pro_upgrade_amount(total_amount):
        _finalize_payment_order(db=db, payment_order=payment_order, status="failure",
                                error_message="invalid_amount", trade_no=trade_no,
                                total_amount=total_amount, source=source)
        _record_order_result(db, out_trade_no=out_trade_no, order_type="pro_upgrade",
                             user_id=user_id, trade_no=trade_no, total_amount=total_amount,
                             source=source, status="failure", error_message="invalid_amount")
        logger.error(f"微信Pro订单金额不合法: {out_trade_no}, amount={total_amount}")
        return

    if not user_id:
        _finalize_payment_order(db=db, payment_order=payment_order, status="failure",
                                error_message="missing_user_id", trade_no=trade_no,
                                total_amount=total_amount, source=source)
        _record_order_result(db, out_trade_no=out_trade_no, order_type="pro_upgrade",
                             user_id=None, trade_no=trade_no, total_amount=total_amount,
                             source=source, status="failure", error_message="missing_user_id")
        logger.error(f"微信订单缺少用户ID: {out_trade_no}")
        return

    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        _finalize_payment_order(db=db, payment_order=payment_order, status="failure",
                                error_message="user_not_found", trade_no=trade_no,
                                total_amount=total_amount, source=source)
        _record_order_result(db, out_trade_no=out_trade_no, order_type="pro_upgrade",
                             user_id=user_id, trade_no=trade_no, total_amount=total_amount,
                             source=source, status="failure", error_message="user_not_found")
        logger.error(f"微信升级找不到用户 {user_id}")
        return

    try:
        plan = _get_pro_upgrade_plan(total_amount)
        duration_days = plan["days"] if plan else 30
        upgrade_to_pro(user, db, duration_days=duration_days)
        payment_order = db.query(PaymentOrder).filter(PaymentOrder.out_trade_no == out_trade_no).first()
        if payment_order:
            _finalize_payment_order(db=db, payment_order=payment_order, status="success",
                                    trade_no=trade_no, total_amount=total_amount, source=source)
        _record_order_result(db, out_trade_no=out_trade_no, order_type="pro_upgrade",
                             user_id=user_id, trade_no=trade_no, total_amount=total_amount,
                             source=source, status="success")
        logger.info(f"微信支付: 用户 {user_id} 已升级为Pro会员")
    except Exception as e:
        db.rollback()
        payment_order = db.query(PaymentOrder).filter(PaymentOrder.out_trade_no == out_trade_no).first()
        if payment_order:
            _finalize_payment_order(db=db, payment_order=payment_order, status="error",
                                    error_message=str(e), trade_no=trade_no,
                                    total_amount=total_amount, source=source)
        _record_order_result(db, out_trade_no=out_trade_no, order_type="pro_upgrade",
                             user_id=user_id, trade_no=trade_no, total_amount=total_amount,
                             source=source, status="error", error_message=str(e))
        logger.error(f"微信支付升级Pro失败: {e}")


def _handle_token_topup(
    db,
    out_trade_no: str,
    trade_no: Optional[str],
    total_amount: Optional[str],
    source: str,
    user_id: Optional[str] = None,
):
    if not out_trade_no.startswith("WXTOPUP_"):
        return

    user_id = user_id or _extract_user_id(out_trade_no)

    payment_order = _claim_payment_order(
        db=db,
        out_trade_no=out_trade_no,
        order_type="token_topup",
        user_id=user_id,
        trade_no=trade_no,
        total_amount=total_amount,
        source=source,
    )
    if payment_order is None:
        existing = db.query(PaymentOrder).filter(PaymentOrder.out_trade_no == out_trade_no).first()
        existing_status = existing.status if existing else "unknown"
        logger.info(f"微信充值订单已处理，跳过: {out_trade_no}, status={existing_status}")
        return

    try:
        paid_amount = float(total_amount or 0)
    except (TypeError, ValueError):
        paid_amount = -1

    package = get_token_topup_package_by_amount(db, paid_amount, TOKEN_TOPUP_AMOUNT_TOLERANCE)
    if not package:
        _finalize_payment_order(db=db, payment_order=payment_order, status="failure",
                                error_message="invalid_topup_amount", trade_no=trade_no,
                                total_amount=total_amount, source=source)
        _record_order_result(db, out_trade_no=out_trade_no, order_type="token_topup",
                             user_id=user_id, trade_no=trade_no, total_amount=total_amount,
                             source=source, status="failure", error_message="invalid_topup_amount")
        return

    if not user_id:
        _finalize_payment_order(db=db, payment_order=payment_order, status="failure",
                                error_message="missing_user_id", trade_no=trade_no,
                                total_amount=total_amount, source=source)
        _record_order_result(db, out_trade_no=out_trade_no, order_type="token_topup",
                             user_id=None, trade_no=trade_no, total_amount=total_amount,
                             source=source, status="failure", error_message="missing_user_id")
        return

    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        _finalize_payment_order(db=db, payment_order=payment_order, status="failure",
                                error_message="user_not_found", trade_no=trade_no,
                                total_amount=total_amount, source=source)
        _record_order_result(db, out_trade_no=out_trade_no, order_type="token_topup",
                             user_id=user_id, trade_no=trade_no, total_amount=total_amount,
                             source=source, status="failure", error_message="user_not_found")
        return

    try:
        credit_wallet_tokens(
            db,
            user_id=user_id,
            tokens=int(package["tokens"]),
            source="wechat_topup",
            source_order_no=out_trade_no,
            idempotency_key=f"credit:{out_trade_no}",
            metadata={
                "package_id": package["id"],
                "price_cny": package["price_cny"],
                "trade_no": trade_no,
            },
        )
        payment_order = db.query(PaymentOrder).filter(PaymentOrder.out_trade_no == out_trade_no).first()
        if payment_order:
            _finalize_payment_order(db=db, payment_order=payment_order, status="success",
                                    trade_no=trade_no, total_amount=total_amount, source=source)
        _record_order_result(db, out_trade_no=out_trade_no, order_type="token_topup",
                             user_id=user_id, trade_no=trade_no, total_amount=total_amount,
                             source=source, status="success")
        logger.info(f"微信支付: 用户 {user_id} 充值成功，token +{package['tokens']}")
    except Exception as e:
        db.rollback()
        payment_order = db.query(PaymentOrder).filter(PaymentOrder.out_trade_no == out_trade_no).first()
        if payment_order:
            _finalize_payment_order(db=db, payment_order=payment_order, status="error",
                                    error_message=str(e), trade_no=trade_no,
                                    total_amount=total_amount, source=source)
        _record_order_result(db, out_trade_no=out_trade_no, order_type="token_topup",
                             user_id=user_id, trade_no=trade_no, total_amount=total_amount,
                             source=source, status="error", error_message=str(e))
        logger.error(f"微信支付充值token失败: {e}")


# ─── Request / Response Models ────────────────────────────────────────────────

class CreateOrderRequest(BaseModel):
    total_amount: float
    subject: str
    body: Optional[str] = None
    order_type: Optional[str] = None          # pro_upgrade | token_topup
    user_id: Optional[str] = None
    package_id: Optional[str] = None          # token_topup 专用


class QueryOrderRequest(BaseModel):
    out_trade_no: str


class RefundRequest(BaseModel):
    out_trade_no: str
    refund_amount: float
    refund_reason: Optional[str] = None


# ─── Endpoints ────────────────────────────────────────────────────────────────

@router.post("/create-order")
async def create_order(
    request: CreateOrderRequest,
    db: Session = Depends(get_db),
    session_token: Optional[str] = Header(None, alias="Authorization"),
):
    """
    创建微信 Native 支付订单。
    返回 code_url（前端渲染二维码），以及 out_trade_no。
    """
    try:
        logger.info(
            f"收到微信支付创建订单请求: amount={request.total_amount}, "
            f"order_type={request.order_type}, user_id={request.user_id}"
        )

        if request.total_amount <= 0:
            raise HTTPException(status_code=400, detail="支付金额必须大于0")
        if len(request.subject) > 127:
            raise HTTPException(status_code=400, detail="商品描述长度不能超过127字符")

        resolved_user_id: Optional[str] = None
        topup_package: Optional[dict] = None

        if request.order_type == "pro_upgrade":
            if not _is_valid_pro_upgrade_amount(request.total_amount):
                valid_prices = ", ".join(f"¥{p['amount']:.0f}" for p in PRO_UPGRADE_PLANS)
                raise HTTPException(status_code=400, detail=f"Pro升级金额无效，有效金额为: {valid_prices}")

            authed_user_id = verify_session_token(session_token)
            if not authed_user_id:
                raise HTTPException(status_code=401, detail="Pro升级订单需要登录")
            if not db.query(User).filter(User.id == authed_user_id).first():
                raise HTTPException(status_code=401, detail="无效用户会话")
            if request.user_id and request.user_id != authed_user_id:
                raise HTTPException(status_code=403, detail="不能为其他用户创建Pro升级订单")
            resolved_user_id = authed_user_id

        elif request.order_type == "token_topup":
            authed_user_id = verify_session_token(session_token)
            if not authed_user_id:
                raise HTTPException(status_code=401, detail="Token充值订单需要登录")
            if request.user_id and request.user_id != authed_user_id:
                raise HTTPException(status_code=403, detail="不能为其他用户创建充值订单")
            if not request.package_id:
                raise HTTPException(status_code=400, detail="缺少充值包ID")

            topup_package = get_token_topup_package_by_id(db, request.package_id)
            if not topup_package:
                raise HTTPException(status_code=400, detail="无效的充值包")

            expected_amount = float(topup_package["price_cny"])
            if abs(float(request.total_amount) - expected_amount) > TOKEN_TOPUP_AMOUNT_TOLERANCE:
                raise HTTPException(status_code=400, detail="充值金额与充值包不匹配")
            resolved_user_id = authed_user_id

        elif request.order_type:
            raise HTTPException(status_code=400, detail="不支持的订单类型")

        # 生成订单号（WXPRO_ / WXTOPUP_）
        if request.order_type == "pro_upgrade":
            prefix = "WXPRO_"
        elif request.order_type == "token_topup":
            prefix = "WXTOPUP_"
        else:
            prefix = "WXMK_"

        out_trade_no = f"{prefix}{datetime.now().strftime('%Y%m%d%H%M%S')}{uuid.uuid4().hex[:8]}"
        # WeChat out_trade_no must be 6-32 chars; keep fixed-length token only.
        if len(out_trade_no) > 32:
            out_trade_no = out_trade_no[:32]
        if not _is_valid_out_trade_no(out_trade_no):
            raise HTTPException(status_code=500, detail="系统生成的商户订单号不符合微信规范")

        provider = _get_payment_provider()
        if provider.provider_name == "wechat" and not provider.is_configured:
            missing = wechat_pay_client.missing_config_fields
            detail = "微信支付尚未正确配置，请检查服务端环境变量"
            if missing:
                detail = f"微信支付尚未正确配置，缺失: {', '.join(missing)}"
            elif wechat_pay_client.last_init_error:
                detail = f"微信支付初始化失败: {wechat_pay_client.last_init_error}"
            raise HTTPException(status_code=503, detail=detail)

        notify_url = _build_notify_url() if provider.provider_name == "wechat" else None
        if provider.provider_name == "wechat" and not notify_url:
            raise HTTPException(status_code=503, detail="WECHAT_NOTIFY_URL 必须是公网可访问且不带参数的完整回调地址")

        attach = _build_wechat_attach(resolved_user_id)

        code_url = provider.create_native_order(
            out_trade_no=out_trade_no,
            total_amount=request.total_amount,
            description=request.subject,
            notify_url=notify_url,
            attach=attach,
        )

        # Mock provider: auto-settle immediately for quicker local testing
        if provider.provider_name == "mock_wechat":
            mock_transaction_id = f"MOCKWX_{uuid.uuid4().hex[:24]}"
            total_amount_str = f"{request.total_amount:.2f}"
            resolved_order_type = _resolve_order_type_from_out_trade_no(out_trade_no)
            if resolved_order_type == "pro_upgrade":
                _handle_pro_upgrade(db=db, out_trade_no=out_trade_no,
                                    trade_no=mock_transaction_id,
                                    total_amount=total_amount_str,
                                    source="mock_wechat_create_order",
                                    user_id=resolved_user_id)
            elif resolved_order_type == "token_topup":
                _handle_token_topup(db=db, out_trade_no=out_trade_no,
                                    trade_no=mock_transaction_id,
                                    total_amount=total_amount_str,
                                    source="mock_wechat_create_order",
                                    user_id=resolved_user_id)

        logger.info(f"微信支付创建订单成功: {out_trade_no}, provider={provider.provider_name}")

        return {
            "success": True,
            "code_url": code_url,
            "out_trade_no": out_trade_no,
            "total_amount": request.total_amount,
            "subject": request.subject,
            "order_type": request.order_type,
            "package": topup_package,
            "provider": provider.provider_name,
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.exception(f"创建微信支付订单失败: {e}")
        raise HTTPException(status_code=500, detail=f"创建微信支付订单失败: {str(e)}")


@router.post("/notify")
async def wechat_notify(
    request: Request,
    background_tasks: BackgroundTasks,
):
    """
    微信支付异步回调（需公网 HTTPS 可访问）
    """
    try:
        provider = _get_payment_provider()
        if provider.provider_name != "wechat":
            logger.info("当前微信支付提供方不是 WeChatPay，忽略 notify 回调")
            return Response(status_code=204)

        headers = dict(request.headers)
        body = await request.body()
        body_str = body.decode("utf-8")

        try:
            data = provider.verify_notify(headers=headers, body=body_str)
        except ValueError as e:
            logger.warning(f"微信支付回调验签失败: {e}")
            return JSONResponse(status_code=400, content={"code": "FAIL", "message": "验签失败"})

        logger.info(f"微信支付回调内容: {data}")

        trade_state = data.get("trade_state")
        out_trade_no = data.get("out_trade_no", "")
        transaction_id = data.get("transaction_id")
        attach = data.get("attach")
        attach_user_id = _extract_user_id_from_attach(attach)
        amount_info = data.get("amount", {})
        total_fen = amount_info.get("payer_total") or amount_info.get("total")
        total_yuan = f"{total_fen / 100:.2f}" if total_fen is not None else None

        if trade_state == "SUCCESS":
            logger.info(f"微信支付成功: {out_trade_no}, transaction_id={transaction_id}")
            background_tasks.add_task(
                _settle_wechat_order_in_background,
                out_trade_no,
                transaction_id,
                total_yuan,
                "wechat_notify",
                attach_user_id,
            )

        return Response(status_code=204)

    except Exception as e:
        logger.error(f"处理微信支付回调失败: {e}")
        return JSONResponse(status_code=500, content={"code": "FAIL", "message": str(e)})


@router.post("/query-order")
async def query_order(
    request: QueryOrderRequest,
    db: Session = Depends(get_db),
    session_token: Optional[str] = Header(None, alias="Authorization"),
):
    """
    查询微信支付订单状态（前端轮询用）。
    用户只能查询自己的订单。
    """
    authed_user_id = verify_session_token(session_token)
    if not authed_user_id:
        raise HTTPException(status_code=401, detail="请先登录")
    if not _is_valid_out_trade_no(request.out_trade_no):
        raise HTTPException(status_code=400, detail="商户订单号格式不合法")

    # 校验订单归属
    payment_order_record = db.query(PaymentOrder).filter(
        PaymentOrder.out_trade_no == request.out_trade_no
    ).first()
    # Allow querying before order is claimed (order may not exist yet if mock just returned code_url)
    if payment_order_record and payment_order_record.user_id != authed_user_id:
        raise HTTPException(status_code=403, detail="只能查询自己的订单")

    try:
        provider = _get_payment_provider()

        if provider.provider_name == "mock_wechat":
            # For mock, derive status from DB record
            if payment_order_record:
                trade_state = "SUCCESS" if payment_order_record.status == "success" else "NOTPAY"
                transaction_id = payment_order_record.trade_no
            else:
                trade_state = "NOTPAY"
                transaction_id = None

            return {
                "success": True,
                "trade_state": trade_state,
                "transaction_id": transaction_id,
                "out_trade_no": request.out_trade_no,
            }

        result = provider.query_order(out_trade_no=request.out_trade_no)
        trade_state = result.get("trade_state")
        transaction_id = result.get("transaction_id")
        attach_user_id = _extract_user_id_from_attach(result.get("attach"))

        # If payment succeeded and not yet settled, settle now
        if trade_state == "SUCCESS" and (
            not payment_order_record or payment_order_record.status not in ("success",)
        ):
            total_fen = (result.get("amount") or {}).get("payer_total") or (result.get("amount") or {}).get("total")
            total_yuan = f"{total_fen / 100:.2f}" if total_fen is not None else None
            resolved_order_type = _resolve_order_type_from_out_trade_no(request.out_trade_no)
            if resolved_order_type == "pro_upgrade":
                _handle_pro_upgrade(db=db, out_trade_no=request.out_trade_no,
                                    trade_no=transaction_id, total_amount=total_yuan,
                                    source="wechat_query_poll",
                                    user_id=attach_user_id)
            elif resolved_order_type == "token_topup":
                _handle_token_topup(db=db, out_trade_no=request.out_trade_no,
                                    trade_no=transaction_id, total_amount=total_yuan,
                                    source="wechat_query_poll",
                                    user_id=attach_user_id)

        return {
            "success": True,
            "trade_state": trade_state,
            "transaction_id": transaction_id,
            "out_trade_no": request.out_trade_no,
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"查询微信支付订单失败: {e}")
        raise HTTPException(status_code=500, detail=f"查询订单失败: {str(e)}")


@router.post("/close-order")
async def close_order(
    request: QueryOrderRequest,
    db: Session = Depends(get_db),
    _current_admin_user: User = Depends(get_current_admin_user),
):
    """关闭未支付订单（管理员）"""
    try:
        if not _is_valid_out_trade_no(request.out_trade_no):
            raise HTTPException(status_code=400, detail="商户订单号格式不合法")

        provider = _get_payment_provider()

        if provider.provider_name == "mock_wechat":
            payment_order = db.query(PaymentOrder).filter(
                PaymentOrder.out_trade_no == request.out_trade_no
            ).first()
            if payment_order and payment_order.status != "success":
                payment_order.status = "closed"
                db.commit()
            return {"success": True, "data": {"_http_code": 204}}

        result = provider.close_order(out_trade_no=request.out_trade_no)
        close_http_code = result.get("_http_code") if isinstance(result, dict) else None
        if close_http_code not in (200, 204):
            raise HTTPException(status_code=502, detail=f"微信关单失败: {result}")

        payment_order = db.query(PaymentOrder).filter(
            PaymentOrder.out_trade_no == request.out_trade_no
        ).first()
        if payment_order and payment_order.status != "success":
            payment_order.status = "closed"
            db.commit()
        return {"success": True, "data": result}

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"关闭微信支付订单失败: {e}")
        raise HTTPException(status_code=500, detail=f"关闭订单失败: {str(e)}")


@router.post("/refund")
async def refund_order(
    request: RefundRequest,
    db: Session = Depends(get_db),
    session_token: Optional[str] = Header(None, alias="Authorization"),
):
    """申请退款（与支付宝规则一致）"""
    authed_user_id = verify_session_token(session_token)
    if not authed_user_id:
        raise HTTPException(status_code=401, detail="请先登录")

    try:
        if not _is_valid_out_trade_no(request.out_trade_no):
            raise HTTPException(status_code=400, detail="商户订单号格式不合法")
        if request.refund_amount <= 0:
            raise HTTPException(status_code=400, detail="退款金额必须大于0")
        if request.refund_reason and _utf8_len(request.refund_reason) > 80:
            raise HTTPException(status_code=400, detail="退款原因长度不能超过80字节")

        payment_order = db.query(PaymentOrder).filter(
            PaymentOrder.out_trade_no == request.out_trade_no
        ).first()
        if not payment_order:
            raise HTTPException(status_code=404, detail="订单不存在")
        if payment_order.user_id != authed_user_id:
            raise HTTPException(status_code=403, detail="只能为自己的订单退款")

        provider = _get_payment_provider()
        refund_reversal = None

        payment_order.refund_status = "pending"
        db.commit()

        if payment_order.order_type == "token_topup":
            try:
                paid_amount = float(payment_order.total_amount or 0)
            except (TypeError, ValueError):
                paid_amount = -1
            package = get_token_topup_package_by_amount(db, paid_amount, TOKEN_TOPUP_AMOUNT_TOLERANCE)
            if not package:
                payment_order.refund_status = "failed"
                db.commit()
                raise HTTPException(status_code=400, detail="充值包信息无效")
            user = db.query(User).filter(User.id == payment_order.user_id).first()
            if not user:
                payment_order.refund_status = "failed"
                db.commit()
                raise HTTPException(status_code=400, detail="用户不存在")
            if int(user.purchased_token_balance or 0) < int(package["tokens"]):
                payment_order.refund_status = "failed"
                db.commit()
                raise HTTPException(status_code=400, detail="充值包已部分使用，无法退款")
            refund_reversal = reverse_wallet_tokens_for_refund(
                db,
                user_id=payment_order.user_id,
                tokens=int(package["tokens"]),
                source_order_no=payment_order.out_trade_no,
                idempotency_key=f"refund_reverse:{payment_order.out_trade_no}",
            )
            db.commit()

        if payment_order.order_type == "pro_upgrade":
            user = db.query(User).filter(User.id == payment_order.user_id).first()
            if not user:
                payment_order.refund_status = "failed"
                db.commit()
                raise HTTPException(status_code=400, detail="用户不存在")
            if not user.is_pro or not user.pro_start_date:
                payment_order.refund_status = "failed"
                db.commit()
                raise HTTPException(status_code=400, detail="用户当前不是Pro会员，无法退款")
            from datetime import UTC
            from datetime import datetime as dt
            if (dt.now(UTC) - user.pro_start_date).days > 7:
                payment_order.refund_status = "failed"
                db.commit()
                raise HTTPException(status_code=400, detail="Pro会员已超过7天，无法退款")
            from utils.user_utils import downgrade_from_pro
            downgrade_from_pro(user, db)

        try:
            total_amount_float = float(payment_order.total_amount or request.refund_amount)
            result = provider.refund(
                out_trade_no=request.out_trade_no,
                refund_amount=request.refund_amount,
                total_amount=total_amount_float,
                reason=request.refund_reason,
            )

            refund_http_code = result.get("_http_code") if isinstance(result, dict) else None
            refund_status = (result.get("status") if isinstance(result, dict) else None) or ""
            refund_status = refund_status.upper()

            if refund_http_code != 200:
                payment_order.refund_status = "failed"
                db.commit()
                raise HTTPException(status_code=502, detail=f"微信退款失败: {result}")

            if refund_status == "SUCCESS":
                payment_order.refund_status = "success"
            elif refund_status == "PROCESSING":
                payment_order.refund_status = "pending"
            else:
                payment_order.refund_status = "failed"

            db.commit()
        except Exception as e:
            if not isinstance(e, HTTPException):
                payment_order.refund_status = "failed"
                db.commit()
                logger.error(f"微信退款失败: {e}")
                raise HTTPException(status_code=500, detail=f"退款失败: {str(e)}")
            raise

        return {"success": True, "data": result, "wallet_refund_reversal": refund_reversal}

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"微信退款失败: {e}")
        raise HTTPException(status_code=500, detail=f"退款失败: {str(e)}")


@router.get("/token-packages")
async def get_token_packages(db: Session = Depends(get_db)):
    packages = get_token_topup_packages(db)
    return {"success": True, "packages": packages}
