"""
支付宝支付路由
提供支付宝支付相关的API接口
"""
from fastapi import APIRouter, HTTPException, Request, Depends, Header
from pydantic import BaseModel
from typing import Optional, Tuple
from datetime import datetime
import os
import logging
import uuid
from urllib.parse import urlparse, parse_qs

from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError

from utils.payment_provider import get_active_payment_provider
from utils.session import verify_session_token, get_current_admin_user
from utils.user_utils import upgrade_to_pro
from utils.token_wallet import (
    get_token_topup_packages,
    get_token_topup_package_by_id,
    get_token_topup_package_by_amount,
    credit_wallet_tokens,
    reverse_wallet_tokens_for_refund,
)
from database import get_db
from models import User, PaymentOrder
from utils.audit_logger import AuditLog

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/alipay", tags=["alipay"])

PRO_UPGRADE_PRICE_CNY = float(os.getenv("PRO_UPGRADE_PRICE_CNY", "29"))
PRO_UPGRADE_DURATION_DAYS = int(os.getenv("PRO_UPGRADE_DURATION_DAYS", "30"))
PRO_AMOUNT_TOLERANCE = 0.01
TOKEN_TOPUP_AMOUNT_TOLERANCE = 0.01


def _get_payment_provider():
    return get_active_payment_provider()


def _is_public_base_url(base_url: str) -> bool:
    if not base_url:
        return False
    lowered = base_url.lower()
    if "localhost" in lowered or "127.0.0.1" in lowered:
        return False
    return lowered.startswith("http://") or lowered.startswith("https://")


def _extract_user_id(out_trade_no: Optional[str]) -> Optional[str]:
    if not out_trade_no or "_U" not in out_trade_no:
        return None
    user_segment = out_trade_no.split("_U", 1)[-1]
    if "_C" in user_segment:
        user_segment = user_segment.split("_C", 1)[0]
    return user_segment or None


def _get_trade_status(result: dict) -> Tuple[Optional[str], Optional[str]]:
    if not isinstance(result, dict):
        return None, None
    payload = result.get("alipay_trade_query_response") or result
    return payload.get("trade_status"), payload.get("code")


def _is_valid_pro_upgrade_amount(total_amount: Optional[str | float | int]) -> bool:
    try:
        if total_amount is None:
            return False
        amount = float(total_amount)
        return abs(amount - PRO_UPGRADE_PRICE_CNY) <= PRO_AMOUNT_TOLERANCE
    except (TypeError, ValueError):
        return False


def _resolve_order_type_from_out_trade_no(out_trade_no: str) -> str:
    if out_trade_no.startswith("PRO_"):
        return "pro_upgrade"
    if out_trade_no.startswith("TOPUP_"):
        return "token_topup"
    return "unknown"


def _build_notify_url() -> Optional[str]:
    backend_base_url = os.getenv("BACKEND_BASE_URL", "").rstrip("/")
    if _is_public_base_url(backend_base_url):
        return f"{backend_base_url}/api/alipay/notify"
    return None


def _is_mock_provider() -> bool:
    return _get_payment_provider().provider_name == "mock"


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
    action = f"alipay_{order_type}:{out_trade_no}"
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
        logger.error(f"记录订单审计日志失败: {e}")


def _handle_pro_upgrade(
    db,
    out_trade_no: str,
    trade_no: Optional[str],
    total_amount: Optional[str],
    source: str,
):
    if not out_trade_no.startswith("PRO_"):
        return

    user_id = _extract_user_id(out_trade_no)

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
        logger.info(f"订单已被处理或处理中，跳过升级: {out_trade_no}, status={existing_status}")
        return

    if not _is_valid_pro_upgrade_amount(total_amount):
        _finalize_payment_order(
            db=db,
            payment_order=payment_order,
            status="failure",
            error_message="invalid_amount",
            trade_no=trade_no,
            total_amount=total_amount,
            source=source,
        )
        _record_order_result(
            db,
            out_trade_no=out_trade_no,
            order_type="pro_upgrade",
            user_id=user_id,
            trade_no=trade_no,
            total_amount=total_amount,
            source=source,
            status="failure",
            error_message="invalid_amount",
        )
        logger.error(f"Pro订单金额不合法，跳过升级: {out_trade_no}, amount={total_amount}")
        return

    if not user_id:
        _finalize_payment_order(
            db=db,
            payment_order=payment_order,
            status="failure",
            error_message="missing_user_id",
            trade_no=trade_no,
            total_amount=total_amount,
            source=source,
        )
        _record_order_result(
            db,
            out_trade_no=out_trade_no,
            order_type="pro_upgrade",
            user_id=None,
            trade_no=trade_no,
            total_amount=total_amount,
            source=source,
            status="failure",
            error_message="missing_user_id",
        )
        logger.error(f"订单缺少用户ID: {out_trade_no}")
        return

    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        _finalize_payment_order(
            db=db,
            payment_order=payment_order,
            status="failure",
            error_message="user_not_found",
            trade_no=trade_no,
            total_amount=total_amount,
            source=source,
        )
        _record_order_result(
            db,
            out_trade_no=out_trade_no,
            order_type="pro_upgrade",
            user_id=user_id,
            trade_no=trade_no,
            total_amount=total_amount,
            source=source,
            status="failure",
            error_message="user_not_found",
        )
        logger.error(f"未找到用户 {user_id}")
        return

    try:
        upgrade_to_pro(user, db, duration_days=PRO_UPGRADE_DURATION_DAYS)
        payment_order = db.query(PaymentOrder).filter(PaymentOrder.out_trade_no == out_trade_no).first()
        if payment_order:
            _finalize_payment_order(
                db=db,
                payment_order=payment_order,
                status="success",
                trade_no=trade_no,
                total_amount=total_amount,
                source=source,
            )
        _record_order_result(
            db,
            out_trade_no=out_trade_no,
            order_type="pro_upgrade",
            user_id=user_id,
            trade_no=trade_no,
            total_amount=total_amount,
            source=source,
            status="success",
        )
        logger.info(f"用户 {user_id} 已升级为Pro会员")
    except Exception as e:
        db.rollback()
        payment_order = db.query(PaymentOrder).filter(PaymentOrder.out_trade_no == out_trade_no).first()
        if payment_order:
            _finalize_payment_order(
                db=db,
                payment_order=payment_order,
                status="error",
                error_message=str(e),
                trade_no=trade_no,
                total_amount=total_amount,
                source=source,
            )
        _record_order_result(
            db,
            out_trade_no=out_trade_no,
            order_type="pro_upgrade",
            user_id=user_id,
            trade_no=trade_no,
            total_amount=total_amount,
            source=source,
            status="error",
            error_message=str(e),
        )
        logger.error(f"升级Pro会员失败: {e}")


def _handle_token_topup(
    db,
    out_trade_no: str,
    trade_no: Optional[str],
    total_amount: Optional[str],
    source: str,
):
    if not out_trade_no.startswith("TOPUP_"):
        return

    user_id = _extract_user_id(out_trade_no)

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
        logger.info(f"充值订单已处理或处理中，跳过: {out_trade_no}, status={existing_status}")
        return

    try:
        paid_amount = float(total_amount or 0)
    except (TypeError, ValueError):
        paid_amount = -1

    package = get_token_topup_package_by_amount(db, paid_amount, TOKEN_TOPUP_AMOUNT_TOLERANCE)
    if not package:
        _finalize_payment_order(
            db=db,
            payment_order=payment_order,
            status="failure",
            error_message="invalid_topup_amount",
            trade_no=trade_no,
            total_amount=total_amount,
            source=source,
        )
        _record_order_result(
            db,
            out_trade_no=out_trade_no,
            order_type="token_topup",
            user_id=user_id,
            trade_no=trade_no,
            total_amount=total_amount,
            source=source,
            status="failure",
            error_message="invalid_topup_amount",
        )
        return

    if not user_id:
        _finalize_payment_order(
            db=db,
            payment_order=payment_order,
            status="failure",
            error_message="missing_user_id",
            trade_no=trade_no,
            total_amount=total_amount,
            source=source,
        )
        _record_order_result(
            db,
            out_trade_no=out_trade_no,
            order_type="token_topup",
            user_id=None,
            trade_no=trade_no,
            total_amount=total_amount,
            source=source,
            status="failure",
            error_message="missing_user_id",
        )
        return

    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        _finalize_payment_order(
            db=db,
            payment_order=payment_order,
            status="failure",
            error_message="user_not_found",
            trade_no=trade_no,
            total_amount=total_amount,
            source=source,
        )
        _record_order_result(
            db,
            out_trade_no=out_trade_no,
            order_type="token_topup",
            user_id=user_id,
            trade_no=trade_no,
            total_amount=total_amount,
            source=source,
            status="failure",
            error_message="user_not_found",
        )
        return

    try:
        credit_wallet_tokens(
            db,
            user_id=user_id,
            tokens=int(package["tokens"]),
            source="alipay_topup",
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
            _finalize_payment_order(
                db=db,
                payment_order=payment_order,
                status="success",
                trade_no=trade_no,
                total_amount=total_amount,
                source=source,
            )
        _record_order_result(
            db,
            out_trade_no=out_trade_no,
            order_type="token_topup",
            user_id=user_id,
            trade_no=trade_no,
            total_amount=total_amount,
            source=source,
            status="success",
        )
        logger.info(f"用户 {user_id} 充值成功，token +{package['tokens']}")
    except Exception as e:
        db.rollback()
        payment_order = db.query(PaymentOrder).filter(PaymentOrder.out_trade_no == out_trade_no).first()
        if payment_order:
            _finalize_payment_order(
                db=db,
                payment_order=payment_order,
                status="error",
                error_message=str(e),
                trade_no=trade_no,
                total_amount=total_amount,
                source=source,
            )
        _record_order_result(
            db,
            out_trade_no=out_trade_no,
            order_type="token_topup",
            user_id=user_id,
            trade_no=trade_no,
            total_amount=total_amount,
            source=source,
            status="error",
            error_message=str(e),
        )
        logger.error(f"充值token失败: {e}")


# 请求模型
class CreateOrderRequest(BaseModel):
    """创建订单请求"""
    total_amount: float  # 订单金额
    subject: str  # 订单标题
    body: Optional[str] = None  # 订单描述
    payment_type: Optional[str] = "page"  # 支付类型: page(电脑网站), wap(手机网站)
    timeout_express: Optional[str] = None  # 超时时间: 30m、2h、1d等 (沙箱环境不超过15小时)
    order_type: Optional[str] = None  # 订单类型: pro_upgrade等
    user_id: Optional[str] = None  # 用户ID (Firebase UID是字符串)
    package_id: Optional[str] = None  # 充值包ID（token_topup专用）


class QueryOrderRequest(BaseModel):
    """查询订单请求"""
    out_trade_no: Optional[str] = None  # 商户订单号
    trade_no: Optional[str] = None  # 支付宝交易号


class RefundRequest(BaseModel):
    """退款请求"""
    out_trade_no: str  # 商户订单号
    refund_amount: float  # 退款金额
    refund_reason: Optional[str] = None  # 退款原因


@router.post("/create-order")
async def create_order(
    request: CreateOrderRequest,
    db: Session = Depends(get_db),
    session_token: Optional[str] = Header(None, alias="Authorization"),
):
    """
    创建支付订单
    
    Returns:
        - payment_url: 支付链接
        - out_trade_no: 商户订单号
    """
    try:
        logger.info(f"收到创建订单请求: amount={request.total_amount}, subject={request.subject}, body={request.body}, "
                   f"payment_type={request.payment_type}, order_type={request.order_type}, user_id={request.user_id}")

        resolved_user_id: Optional[str] = None
        topup_package: Optional[dict] = None
        if request.order_type == "pro_upgrade":
            if not _is_valid_pro_upgrade_amount(request.total_amount):
                raise HTTPException(status_code=400, detail=f"Pro升级金额必须为 {PRO_UPGRADE_PRICE_CNY:.2f}")

            authed_user_id = verify_session_token(session_token)
            if not authed_user_id:
                raise HTTPException(status_code=401, detail="Pro升级订单需要登录")

            authed_user = db.query(User).filter(User.id == authed_user_id).first()
            if not authed_user:
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
            logger.info(f"查询充值包: package_id={request.package_id}, result={topup_package}")
            if not topup_package:
                raise HTTPException(status_code=400, detail="无效的充值包")

            expected_amount = float(topup_package["price_cny"])
            if abs(float(request.total_amount) - expected_amount) > TOKEN_TOPUP_AMOUNT_TOLERANCE:
                raise HTTPException(status_code=400, detail="充值金额与充值包不匹配")

            resolved_user_id = authed_user_id
        elif request.order_type:
            raise HTTPException(status_code=400, detail="Unsupported order type")
        
        # 生成唯一订单号，包含订单类型前缀以便后续识别
        if request.order_type == "pro_upgrade":
            prefix = "PRO_"
        elif request.order_type == "token_topup":
            prefix = "TOPUP_"
        else:
            prefix = "MK"
        out_trade_no = f"{prefix}{datetime.now().strftime('%Y%m%d%H%M%S')}{uuid.uuid4().hex[:8]}"
        
        # 如果是Pro升级订单，将user_id附加到订单号末尾
        if request.order_type in {"pro_upgrade", "token_topup"} and resolved_user_id:
            out_trade_no = f"{out_trade_no}_U{resolved_user_id}"
        
        # 构造回调URL（使用完整URL以确保支付宝可以正确跳转）
        frontend_base_url = os.getenv("FRONTEND_BASE_URL", "").rstrip("/")
        return_url = f"{frontend_base_url}/alipay/return" if frontend_base_url else None

        provider = _get_payment_provider()

        # 异步通知地址必须是后端公网地址
        notify_url = _build_notify_url() if provider.provider_name == "alipay" else None
        if provider.provider_name == "alipay" and not notify_url:
            logger.warning("BACKEND_BASE_URL 未配置为公网地址，支付宝异步通知可能无法到达")
        
        # 根据支付类型创建订单
        if request.payment_type == "wap":
            payment_url = provider.create_wap_pay(
                out_trade_no=out_trade_no,
                total_amount=request.total_amount,
                subject=request.subject,
                return_url=return_url,
                notify_url=notify_url,
                timeout_express=request.timeout_express
            )
        else:
            payment_url = provider.create_page_pay(
                out_trade_no=out_trade_no,
                total_amount=request.total_amount,
                subject=request.subject,
                return_url=return_url,
                notify_url=notify_url,
                timeout_express=request.timeout_express
            )

        # In local/dev we can auto-settle create-order for faster testing.
        # Mock always auto-settles; Alipay can auto-settle outside production or via explicit env flag.
        should_auto_settle = provider.provider_name == "mock"

        if should_auto_settle:
            parsed_url = urlparse(payment_url)
            trade_no_values = parse_qs(parsed_url.query).get("trade_no") or []
            mock_trade_no = trade_no_values[0] if trade_no_values else f"MOCK_{uuid.uuid4().hex[:24]}"
            total_amount = f"{request.total_amount:.2f}"
            if provider.provider_name == "alipay":
                logger.warning("Alipay create-order auto-settle is enabled; order will be settled before notify/return callback")
            resolved_order_type = _resolve_order_type_from_out_trade_no(out_trade_no)
            if resolved_order_type == "pro_upgrade":
                _handle_pro_upgrade(
                    db=db,
                    out_trade_no=out_trade_no,
                    trade_no=mock_trade_no,
                    total_amount=total_amount,
                    source=f"{provider.provider_name}_create_order",
                )
            elif resolved_order_type == "token_topup":
                _handle_token_topup(
                    db=db,
                    out_trade_no=out_trade_no,
                    trade_no=mock_trade_no,
                    total_amount=total_amount,
                    source=f"{provider.provider_name}_create_order",
                )
        
        logger.info(f"创建支付订单: {out_trade_no}, 金额: {request.total_amount}, provider={provider.provider_name}")
        
        return {
            "success": True,
            "payment_url": payment_url,
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
        logger.error(f"创建支付订单失败: {e}")
        raise HTTPException(status_code=500, detail=f"创建支付订单失败: {str(e)}")


@router.post("/notify")
async def alipay_notify(request: Request, db: Session = Depends(get_db)):
    """
    支付宝异步通知接口
    支付宝会POST支付结果到这个接口
    
    注意：这个接口需要公网可访问，用于接收支付宝的异步通知
    """
    try:
        provider = _get_payment_provider()

        if provider.provider_name != "alipay":
            logger.info("当前支付提供方不是Alipay，忽略notify回调")
            return "success"

        # 获取POST数据
        data = await request.form()
        data_dict = dict(data)
        
        logger.info(f"收到支付宝异步通知: {data_dict}")
        
        # 验证签名（不要修改原始数据）
        if not provider.verify_notify(data_dict):
            logger.warning("支付宝异步通知验签失败")
            return "failure"
        
        # 获取交易状态
        trade_status = data_dict.get("trade_status")
        out_trade_no = data_dict.get("out_trade_no")
        trade_no = data_dict.get("trade_no")
        total_amount = data_dict.get("total_amount")
        
        # 支付成功
        if trade_status == "TRADE_SUCCESS" or trade_status == "TRADE_FINISHED":
            logger.info(f"订单支付成功: {out_trade_no}, 支付宝交易号: {trade_no}, 金额: {total_amount}")
            resolved_order_type = _resolve_order_type_from_out_trade_no(out_trade_no or "")
            if resolved_order_type == "pro_upgrade":
                _handle_pro_upgrade(
                    db=db,
                    out_trade_no=out_trade_no or "",
                    trade_no=trade_no,
                    total_amount=total_amount,
                    source="notify",
                )
            elif resolved_order_type == "token_topup":
                _handle_token_topup(
                    db=db,
                    out_trade_no=out_trade_no or "",
                    trade_no=trade_no,
                    total_amount=total_amount,
                    source="notify",
                )
            return "success"
        
        # 其他状态
        logger.info(f"订单状态: {trade_status}, 订单号: {out_trade_no}")
        return "success"
        
    except Exception as e:
        logger.error(f"处理支付宝异步通知失败: {e}")
        return "failure"


@router.get("/return")
async def alipay_return(request: Request, db: Session = Depends(get_db)):
    """
    支付宝同步返回接口
    支付完成后用户会被重定向到这个页面
    """
    try:
        provider = _get_payment_provider()

        # 获取GET参数
        data = dict(request.query_params)
        
        logger.info(f"收到支付宝同步返回: {data}")

        if provider.provider_name == "alipay":
            # 验证签名（不要修改原始数据）
            if not provider.verify_notify(data):
                logger.warning("支付宝同步返回验签失败")
                raise HTTPException(status_code=400, detail="签名验证失败")
        
        # 获取订单信息
        out_trade_no = data.get("out_trade_no")
        trade_no = data.get("trade_no")
        total_amount = data.get("total_amount")

        # 按照沙箱指引：同步返回只做展示，关键结果以主动查询/异步通知为准
        trade_status = None
        query_code = None
        if provider.provider_name == "mock":
            trade_status = data.get("trade_status") or "TRADE_SUCCESS"
            query_code = "10000"
            resolved_order_type = _resolve_order_type_from_out_trade_no(out_trade_no or "")
            if resolved_order_type == "pro_upgrade":
                _handle_pro_upgrade(
                    db=db,
                    out_trade_no=out_trade_no or "",
                    trade_no=trade_no,
                    total_amount=total_amount,
                    source="return_query",
                )
            elif resolved_order_type == "token_topup":
                _handle_token_topup(
                    db=db,
                    out_trade_no=out_trade_no or "",
                    trade_no=trade_no,
                    total_amount=total_amount,
                    source="return_query",
                )
        elif out_trade_no or trade_no:
            try:
                query_result = provider.query_order(out_trade_no=out_trade_no, trade_no=trade_no)
                trade_status, query_code = _get_trade_status(query_result)
            except Exception as e:
                logger.warning(f"查询订单状态失败: {e}")

        if query_code == "10000" and trade_status in ("TRADE_SUCCESS", "TRADE_FINISHED"):
            resolved_order_type = _resolve_order_type_from_out_trade_no(out_trade_no or "")
            if resolved_order_type == "pro_upgrade":
                _handle_pro_upgrade(
                    db=db,
                    out_trade_no=out_trade_no or "",
                    trade_no=trade_no,
                    total_amount=total_amount,
                    source="return_query",
                )
            elif resolved_order_type == "token_topup":
                _handle_token_topup(
                    db=db,
                    out_trade_no=out_trade_no or "",
                    trade_no=trade_no,
                    total_amount=total_amount,
                    source="return_query",
                )
        return {
            "success": True,
            "message": "支付结果已接收",
            "out_trade_no": out_trade_no,
            "trade_no": trade_no,
            "total_amount": total_amount,
            "trade_status": trade_status
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"处理支付宝同步返回失败: {e}")
        raise HTTPException(status_code=500, detail=f"处理支付返回失败: {str(e)}")


@router.post("/query-order")
async def query_order(
    request: QueryOrderRequest,
    db: Session = Depends(get_db),
    _current_admin_user: User = Depends(get_current_admin_user),
):
    """
    查询订单支付状态
    """
    try:
        provider = _get_payment_provider()

        if not request.out_trade_no and not request.trade_no:
            raise HTTPException(status_code=400, detail="商户订单号和支付宝交易号至少提供一个")
        
        if provider.provider_name == "mock":
            payment_order = None
            if request.out_trade_no:
                payment_order = db.query(PaymentOrder).filter(PaymentOrder.out_trade_no == request.out_trade_no).first()
            elif request.trade_no:
                payment_order = db.query(PaymentOrder).filter(PaymentOrder.trade_no == request.trade_no).first()

            if payment_order:
                result = {
                    "alipay_trade_query_response": {
                        "code": "10000",
                        "msg": "Success",
                        "out_trade_no": payment_order.out_trade_no,
                        "trade_no": payment_order.trade_no,
                        "trade_status": "TRADE_SUCCESS" if payment_order.status == "success" else "WAIT_BUYER_PAY",
                        "total_amount": payment_order.total_amount,
                    }
                }
            else:
                result = {
                    "alipay_trade_query_response": {
                        "code": "40004",
                        "msg": "Business Failed",
                        "sub_msg": "trade not found",
                        "out_trade_no": request.out_trade_no,
                        "trade_no": request.trade_no,
                    }
                }
        else:
            result = provider.query_order(
                out_trade_no=request.out_trade_no,
                trade_no=request.trade_no
            )
        
        logger.info(f"查询订单结果: {result}")
        
        return {
            "success": True,
            "data": result
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"查询订单失败: {e}")
        raise HTTPException(status_code=500, detail=f"查询订单失败: {str(e)}")


@router.post("/close-order")
async def close_order(
    request: QueryOrderRequest,
    db: Session = Depends(get_db),
    _current_admin_user: User = Depends(get_current_admin_user),
):
    """
    关闭订单
    """
    try:
        provider = _get_payment_provider()

        if not request.out_trade_no and not request.trade_no:
            raise HTTPException(status_code=400, detail="商户订单号和支付宝交易号至少提供一个")

        if provider.provider_name == "mock":
            payment_order = None
            if request.out_trade_no:
                payment_order = db.query(PaymentOrder).filter(PaymentOrder.out_trade_no == request.out_trade_no).first()
            elif request.trade_no:
                payment_order = db.query(PaymentOrder).filter(PaymentOrder.trade_no == request.trade_no).first()

            if payment_order and payment_order.status != "success":
                payment_order.status = "closed"
                payment_order.source = payment_order.source or "mock"
                db.commit()

            result = {
                "alipay_trade_close_response": {
                    "code": "10000",
                    "msg": "Success",
                    "out_trade_no": request.out_trade_no,
                    "trade_no": request.trade_no,
                }
            }
        else:
            result = provider.close_order(
                out_trade_no=request.out_trade_no,
                trade_no=request.trade_no
            )
        
        logger.info(f"关闭订单结果: {result}")
        
        return {
            "success": True,
            "data": result
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"关闭订单失败: {e}")
        raise HTTPException(status_code=500, detail=f"关闭订单失败: {str(e)}")


@router.post("/refund")

async def refund_order(
    request: RefundRequest,
    db: Session = Depends(get_db),
    session_token: Optional[str] = Header(None, alias="Authorization"),
):
    """
    申请退款
    """
    # 用户必须登录，且只能为自己的订单退款
    authed_user_id = verify_session_token(session_token)
    if not authed_user_id:
        raise HTTPException(status_code=401, detail="请先登录")

    try:
        payment_order = db.query(PaymentOrder).filter(PaymentOrder.out_trade_no == request.out_trade_no).first()
        if not payment_order:
            raise HTTPException(status_code=404, detail="订单不存在")
        if payment_order.user_id != authed_user_id:
            raise HTTPException(status_code=403, detail="只能为自己的订单退款")

        refund_reversal = None
        provider = _get_payment_provider()

        # Set refund_status to pending
        payment_order.refund_status = "pending"
        db.commit()

        # Token top-up: only if tokens unused
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
                raise HTTPException(status_code=400, detail="用户不存在，无法退款")
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

        # Pro upgrade: only if within 7 days and tokens unused
        if payment_order.order_type == "pro_upgrade":
            user = db.query(User).filter(User.id == payment_order.user_id).first()
            if not user:
                payment_order.refund_status = "failed"
                db.commit()
                raise HTTPException(status_code=400, detail="用户不存在，无法退款")
            if not user.is_pro or not user.pro_start_date:
                payment_order.refund_status = "failed"
                db.commit()
                raise HTTPException(status_code=400, detail="用户当前不是Pro会员，无法退款")
            from datetime import datetime, UTC, timedelta
            now = datetime.now(UTC)
            if (now - user.pro_start_date).days > 7:
                payment_order.refund_status = "failed"
                db.commit()
                raise HTTPException(status_code=400, detail="Pro会员已超过7天，无法退款")
            from utils.user_utils import downgrade_from_pro
            downgrade_from_pro(user, db)
            logger.info(f"用户 {user.id} 已因退款降级为普通用户")

        # 发起退款
        try:
            result = provider.refund(
                out_trade_no=request.out_trade_no,
                refund_amount=request.refund_amount,
                refund_reason=request.refund_reason
            )
            payment_order.refund_status = "success"
            db.commit()
        except Exception as e:
            payment_order.refund_status = "failed"
            db.commit()
            logger.error(f"退款失败: {e}")
            raise HTTPException(status_code=500, detail=f"退款失败: {str(e)}")
        logger.info(f"退款结果: {result}")
        return {
            "success": True,
            "data": result,
            "wallet_refund_reversal": refund_reversal,
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"退款失败: {e}")
        raise HTTPException(status_code=500, detail=f"退款失败: {str(e)}")


@router.get("/config")
async def get_config(_current_admin_user: User = Depends(get_current_admin_user)):
    """
    获取支付宝配置信息（用于前端调试）
    注意：生产环境不应该暴露敏感信息
    """
    provider = _get_payment_provider()

    return {
        "app_id": "",
        "debug": provider.debug,
        "is_configured": provider.is_configured,
        "provider": provider.provider_name,
        "environment": os.getenv("ENVIRONMENT", "development"),
    }


@router.get("/token-packages")
async def get_token_packages(db: Session = Depends(get_db)):
    packages = get_token_topup_packages(db)
    return {
        "success": True,
        "packages": packages,
    }
