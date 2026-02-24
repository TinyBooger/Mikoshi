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

from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError

from utils.alipay_utils import alipay_client
from utils.session import verify_session_token, get_current_admin_user
from utils.user_utils import upgrade_to_pro
from database import get_db
from models import User, PaymentOrder, Character, CharacterPurchase
from utils.audit_logger import AuditLog

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/alipay", tags=["alipay"])

PRO_UPGRADE_PRICE_CNY = float(os.getenv("PRO_UPGRADE_PRICE_CNY", "29"))
PRO_UPGRADE_DURATION_DAYS = int(os.getenv("PRO_UPGRADE_DURATION_DAYS", "30"))
PRO_AMOUNT_TOLERANCE = 0.01
CHARACTER_AMOUNT_TOLERANCE = 0.01


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
    parts = out_trade_no.split("_U")
    return parts[-1] or None


def _extract_character_id(out_trade_no: Optional[str]) -> Optional[int]:
    if not out_trade_no or "_C" not in out_trade_no:
        return None
    try:
        suffix = out_trade_no.split("_C")[-1]
        return int(suffix)
    except (TypeError, ValueError):
        return None


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


def _is_valid_character_purchase_amount(total_amount: Optional[str | float | int], character_price: Optional[str | float | int]) -> bool:
    try:
        if total_amount is None or character_price is None:
            return False
        amount = float(total_amount)
        price = float(character_price)
        return abs(amount - price) <= CHARACTER_AMOUNT_TOLERANCE
    except (TypeError, ValueError):
        return False


def _build_notify_url() -> Optional[str]:
    backend_base_url = os.getenv("BACKEND_BASE_URL", "").rstrip("/")
    if _is_public_base_url(backend_base_url):
        return f"{backend_base_url}/api/alipay/notify"
    return None


def _claim_payment_order(
    db: Session,
    out_trade_no: str,
    order_type: str,
    user_id: Optional[str],
    trade_no: Optional[str],
    total_amount: Optional[str],
    source: str,
    target_type: Optional[str] = None,
    target_id: Optional[int] = None,
) -> Optional[PaymentOrder]:
    payment_order = PaymentOrder(
        out_trade_no=out_trade_no,
        user_id=user_id,
        order_type=order_type,
        trade_no=trade_no,
        total_amount=str(total_amount) if total_amount is not None else None,
        target_type=target_type,
        target_id=target_id,
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
    target_type: Optional[str] = None,
    target_id: Optional[int] = None,
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
            "target_type": target_type,
            "target_id": target_id,
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


def _handle_character_purchase(
    db,
    out_trade_no: str,
    trade_no: Optional[str],
    total_amount: Optional[str],
    source: str,
):
    if not out_trade_no.startswith("CHAR_"):
        return

    user_id = _extract_user_id(out_trade_no)
    character_id = _extract_character_id(out_trade_no)

    payment_order = _claim_payment_order(
        db=db,
        out_trade_no=out_trade_no,
        order_type="character_purchase",
        user_id=user_id,
        trade_no=trade_no,
        total_amount=total_amount,
        source=source,
        target_type="character",
        target_id=character_id,
    )
    if payment_order is None:
        existing = db.query(PaymentOrder).filter(PaymentOrder.out_trade_no == out_trade_no).first()
        existing_status = existing.status if existing else "unknown"
        logger.info(f"角色订单已被处理或处理中，跳过发货: {out_trade_no}, status={existing_status}")
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
            order_type="character_purchase",
            user_id=None,
            trade_no=trade_no,
            total_amount=total_amount,
            source=source,
            target_type="character",
            target_id=character_id,
            status="failure",
            error_message="missing_user_id",
        )
        return

    if not character_id:
        _finalize_payment_order(
            db=db,
            payment_order=payment_order,
            status="failure",
            error_message="missing_character_id",
            trade_no=trade_no,
            total_amount=total_amount,
            source=source,
        )
        _record_order_result(
            db,
            out_trade_no=out_trade_no,
            order_type="character_purchase",
            user_id=user_id,
            trade_no=trade_no,
            total_amount=total_amount,
            source=source,
            target_type="character",
            target_id=None,
            status="failure",
            error_message="missing_character_id",
        )
        return

    user = db.query(User).filter(User.id == user_id).first()
    character = db.query(Character).filter(Character.id == character_id).first()

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
            order_type="character_purchase",
            user_id=user_id,
            trade_no=trade_no,
            total_amount=total_amount,
            source=source,
            target_type="character",
            target_id=character_id,
            status="failure",
            error_message="user_not_found",
        )
        return

    if not character:
        _finalize_payment_order(
            db=db,
            payment_order=payment_order,
            status="failure",
            error_message="character_not_found",
            trade_no=trade_no,
            total_amount=total_amount,
            source=source,
        )
        _record_order_result(
            db,
            out_trade_no=out_trade_no,
            order_type="character_purchase",
            user_id=user_id,
            trade_no=trade_no,
            total_amount=total_amount,
            source=source,
            target_type="character",
            target_id=character_id,
            status="failure",
            error_message="character_not_found",
        )
        return

    if character.is_free:
        _finalize_payment_order(
            db=db,
            payment_order=payment_order,
            status="failure",
            error_message="character_is_free",
            trade_no=trade_no,
            total_amount=total_amount,
            source=source,
        )
        _record_order_result(
            db,
            out_trade_no=out_trade_no,
            order_type="character_purchase",
            user_id=user_id,
            trade_no=trade_no,
            total_amount=total_amount,
            source=source,
            target_type="character",
            target_id=character_id,
            status="failure",
            error_message="character_is_free",
        )
        return

    if character.creator_id == user_id:
        _finalize_payment_order(
            db=db,
            payment_order=payment_order,
            status="failure",
            error_message="self_purchase_not_allowed",
            trade_no=trade_no,
            total_amount=total_amount,
            source=source,
        )
        _record_order_result(
            db,
            out_trade_no=out_trade_no,
            order_type="character_purchase",
            user_id=user_id,
            trade_no=trade_no,
            total_amount=total_amount,
            source=source,
            target_type="character",
            target_id=character_id,
            status="failure",
            error_message="self_purchase_not_allowed",
        )
        return

    if not _is_valid_character_purchase_amount(total_amount, character.price):
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
            order_type="character_purchase",
            user_id=user_id,
            trade_no=trade_no,
            total_amount=total_amount,
            source=source,
            target_type="character",
            target_id=character_id,
            status="failure",
            error_message="invalid_amount",
        )
        return

    try:
        existing_purchase = db.query(CharacterPurchase).filter(
            CharacterPurchase.user_id == user_id,
            CharacterPurchase.character_id == character_id
        ).first()
        if not existing_purchase:
            db.add(CharacterPurchase(
                user_id=user_id,
                character_id=character_id,
                price_paid=float(total_amount),
                out_trade_no=out_trade_no,
                trade_no=trade_no,
            ))
            db.commit()

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
            order_type="character_purchase",
            user_id=user_id,
            trade_no=trade_no,
            total_amount=total_amount,
            source=source,
            target_type="character",
            target_id=character_id,
            status="success",
        )
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
            order_type="character_purchase",
            user_id=user_id,
            trade_no=trade_no,
            total_amount=total_amount,
            source=source,
            target_type="character",
            target_id=character_id,
            status="error",
            error_message=str(e),
        )
        logger.error(f"角色发货失败: {e}")


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
    character_id: Optional[int] = None  # 角色ID（购买角色时必填）


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
        resolved_character_id: Optional[int] = None
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
        elif request.order_type == "character_purchase":
            authed_user_id = verify_session_token(session_token)
            if not authed_user_id:
                raise HTTPException(status_code=401, detail="购买角色需要登录")

            authed_user = db.query(User).filter(User.id == authed_user_id).first()
            if not authed_user:
                raise HTTPException(status_code=401, detail="无效用户会话")

            if not request.character_id:
                raise HTTPException(status_code=400, detail="character_id 为必填")

            character = db.query(Character).filter(Character.id == request.character_id).first()
            if not character:
                raise HTTPException(status_code=404, detail="角色不存在")
            if character.is_free:
                raise HTTPException(status_code=400, detail="该角色为免费角色，无需购买")
            if character.creator_id == authed_user_id:
                raise HTTPException(status_code=400, detail="不能购买自己创建的角色")
            if not _is_valid_character_purchase_amount(request.total_amount, character.price):
                raise HTTPException(status_code=400, detail="角色购买金额不正确")

            resolved_user_id = authed_user_id
            resolved_character_id = character.id
        
        # 生成唯一订单号，包含订单类型前缀以便后续识别
        if request.order_type == "pro_upgrade":
            prefix = "PRO_"
        elif request.order_type == "character_purchase":
            prefix = "CHAR_"
        else:
            prefix = "MK"
        out_trade_no = f"{prefix}{datetime.now().strftime('%Y%m%d%H%M%S')}{uuid.uuid4().hex[:8]}"
        
        # 如果是Pro升级订单，将user_id附加到订单号末尾
        if request.order_type == "pro_upgrade" and resolved_user_id:
            out_trade_no = f"{out_trade_no}_U{resolved_user_id}"
        elif request.order_type == "character_purchase" and resolved_user_id and resolved_character_id:
            out_trade_no = f"{out_trade_no}_U{resolved_user_id}_C{resolved_character_id}"
        
        # 构造回调URL（使用完整URL以确保支付宝可以正确跳转）
        frontend_base_url = os.getenv("FRONTEND_BASE_URL", "").rstrip("/")
        return_url = f"{frontend_base_url}/alipay/return" if frontend_base_url else None

        # 异步通知地址必须是后端公网地址
        notify_url = _build_notify_url()
        if not notify_url:
            logger.warning("BACKEND_BASE_URL 未配置为公网地址，支付宝异步通知可能无法到达")
        
        # 根据支付类型创建订单
        if request.payment_type == "wap":
            payment_url = alipay_client.create_wap_pay(
                out_trade_no=out_trade_no,
                total_amount=request.total_amount,
                subject=request.subject,
                return_url=return_url,
                notify_url=notify_url,
                timeout_express=request.timeout_express
            )
        else:
            payment_url = alipay_client.create_page_pay(
                out_trade_no=out_trade_no,
                total_amount=request.total_amount,
                subject=request.subject,
                return_url=return_url,
                notify_url=notify_url,
                timeout_express=request.timeout_express
            )
        
        logger.info(f"创建支付订单: {out_trade_no}, 金额: {request.total_amount}")
        
        return {
            "success": True,
            "payment_url": payment_url,
            "out_trade_no": out_trade_no,
            "total_amount": request.total_amount,
            "subject": request.subject,
            "character_id": resolved_character_id
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
        # 获取POST数据
        data = await request.form()
        data_dict = dict(data)
        
        logger.info(f"收到支付宝异步通知: {data_dict}")
        
        # 验证签名（不要修改原始数据）
        if not alipay_client.verify_notify(data_dict):
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
            _handle_pro_upgrade(
                db=db,
                out_trade_no=out_trade_no or "",
                trade_no=trade_no,
                total_amount=total_amount,
                source="notify",
            )
            _handle_character_purchase(
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
        # 获取GET参数
        data = dict(request.query_params)
        
        logger.info(f"收到支付宝同步返回: {data}")
        
        # 验证签名（不要修改原始数据）
        if not alipay_client.verify_notify(data):
            logger.warning("支付宝同步返回验签失败")
            raise HTTPException(status_code=400, detail="签名验证失败")
        
        # 获取订单信息
        out_trade_no = data.get("out_trade_no")
        trade_no = data.get("trade_no")
        total_amount = data.get("total_amount")

        # 按照沙箱指引：同步返回只做展示，关键结果以主动查询/异步通知为准
        trade_status = None
        query_code = None
        if out_trade_no or trade_no:
            try:
                query_result = alipay_client.query_order(out_trade_no=out_trade_no, trade_no=trade_no)
                trade_status, query_code = _get_trade_status(query_result)
            except Exception as e:
                logger.warning(f"查询订单状态失败: {e}")

        if query_code == "10000" and trade_status in ("TRADE_SUCCESS", "TRADE_FINISHED"):
            _handle_pro_upgrade(
                db=db,
                out_trade_no=out_trade_no or "",
                trade_no=trade_no,
                total_amount=total_amount,
                source="return_query",
            )
            _handle_character_purchase(
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
    _current_admin_user: User = Depends(get_current_admin_user),
):
    """
    查询订单支付状态
    """
    try:
        if not request.out_trade_no and not request.trade_no:
            raise HTTPException(status_code=400, detail="商户订单号和支付宝交易号至少提供一个")
        
        result = alipay_client.query_order(
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
    _current_admin_user: User = Depends(get_current_admin_user),
):
    """
    关闭订单
    """
    try:
        if not request.out_trade_no and not request.trade_no:
            raise HTTPException(status_code=400, detail="商户订单号和支付宝交易号至少提供一个")
        
        result = alipay_client.close_order(
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
    _current_admin_user: User = Depends(get_current_admin_user),
):
    """
    申请退款
    """
    try:
        result = alipay_client.refund(
            out_trade_no=request.out_trade_no,
            refund_amount=request.refund_amount,
            refund_reason=request.refund_reason
        )
        
        logger.info(f"退款结果: {result}")
        
        return {
            "success": True,
            "data": result
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
    return {
        "app_id": "",
        "debug": alipay_client.debug,
        "is_configured": alipay_client.alipay is not None
    }
