"""
支付宝支付路由
提供支付宝支付相关的API接口
"""
from fastapi import APIRouter, HTTPException, Request, Depends
from pydantic import BaseModel
from typing import Optional
from datetime import datetime
import os
import logging
import uuid

from utils.alipay_utils import alipay_client
from utils.session import get_current_user

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/alipay", tags=["alipay"])


# 请求模型
class CreateOrderRequest(BaseModel):
    """创建订单请求"""
    total_amount: float  # 订单金额
    subject: str  # 订单标题
    body: Optional[str] = None  # 订单描述
    payment_type: Optional[str] = "page"  # 支付类型: page(电脑网站), wap(手机网站)
    timeout_express: Optional[str] = None  # 超时时间: 30m、2h、1d等 (沙箱环境不超过15小时)


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
async def create_order(request: CreateOrderRequest):
    """
    创建支付订单
    
    Returns:
        - payment_url: 支付链接
        - out_trade_no: 商户订单号
    """
    try:
        # 生成唯一订单号
        out_trade_no = f"MK{datetime.now().strftime('%Y%m%d%H%M%S')}{uuid.uuid4().hex[:8]}"
        
        # 构造回调URL（使用完整URL以确保支付宝可以正确跳转）
        frontend_base_url = os.getenv("FRONTEND_BASE_URL").rstrip("/")
        return_url = f"{frontend_base_url}/alipay/return"  # 支付完成返回页面
        notify_url = "http://your-domain.com/api/alipay/notify"  # 异步通知地址（需要公网可访问）
        
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
            "subject": request.subject
        }
        
    except Exception as e:
        logger.error(f"创建支付订单失败: {e}")
        raise HTTPException(status_code=500, detail=f"创建支付订单失败: {str(e)}")


@router.post("/notify")
async def alipay_notify(request: Request):
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
        
        # 验证签名
        if not alipay_client.verify_notify(data_dict.copy()):
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
            
            # TODO: 在这里处理业务逻辑
            # 例如：更新订单状态、增加用户积分等
            
            return "success"
        
        # 其他状态
        logger.info(f"订单状态: {trade_status}, 订单号: {out_trade_no}")
        return "success"
        
    except Exception as e:
        logger.error(f"处理支付宝异步通知失败: {e}")
        return "failure"


@router.get("/return")
async def alipay_return(request: Request):
    """
    支付宝同步返回接口
    支付完成后用户会被重定向到这个页面
    """
    try:
        # 获取GET参数
        data = dict(request.query_params)
        
        logger.info(f"收到支付宝同步返回: {data}")
        
        # 验证签名
        if not alipay_client.verify_notify(data.copy()):
            logger.warning("支付宝同步返回验签失败")
            raise HTTPException(status_code=400, detail="签名验证失败")
        
        # 获取订单信息
        out_trade_no = data.get("out_trade_no")
        trade_no = data.get("trade_no")
        total_amount = data.get("total_amount")
        
        return {
            "success": True,
            "message": "支付成功",
            "out_trade_no": out_trade_no,
            "trade_no": trade_no,
            "total_amount": total_amount
        }
        
    except Exception as e:
        logger.error(f"处理支付宝同步返回失败: {e}")
        raise HTTPException(status_code=500, detail=f"处理支付返回失败: {str(e)}")


@router.post("/query-order")
async def query_order(request: QueryOrderRequest):
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
        
    except Exception as e:
        logger.error(f"查询订单失败: {e}")
        raise HTTPException(status_code=500, detail=f"查询订单失败: {str(e)}")


@router.post("/close-order")
async def close_order(request: QueryOrderRequest):
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
        
    except Exception as e:
        logger.error(f"关闭订单失败: {e}")
        raise HTTPException(status_code=500, detail=f"关闭订单失败: {str(e)}")


@router.post("/refund")
async def refund_order(request: RefundRequest):
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
        
    except Exception as e:
        logger.error(f"退款失败: {e}")
        raise HTTPException(status_code=500, detail=f"退款失败: {str(e)}")


@router.get("/config")
async def get_config():
    """
    获取支付宝配置信息（用于前端调试）
    注意：生产环境不应该暴露敏感信息
    """
    return {
        "app_id": alipay_client.app_id,
        "debug": alipay_client.debug,
        "is_configured": alipay_client.alipay is not None
    }
