"""
支付宝支付工具类
提供支付宝沙盒环境的支付接口封装
"""
import os
from alipay.aop.api.AlipayClientConfig import AlipayClientConfig
from alipay.aop.api.DefaultAlipayClient import DefaultAlipayClient
from alipay.aop.api.domain.AlipayTradePagePayModel import AlipayTradePagePayModel
from alipay.aop.api.domain.AlipayTradeWapPayModel import AlipayTradeWapPayModel
from alipay.aop.api.domain.AlipayTradeQueryModel import AlipayTradeQueryModel
from alipay.aop.api.domain.AlipayTradeCloseModel import AlipayTradeCloseModel
from alipay.aop.api.domain.AlipayTradeRefundModel import AlipayTradeRefundModel
from alipay.aop.api.request.AlipayTradePagePayRequest import AlipayTradePagePayRequest
from alipay.aop.api.request.AlipayTradeWapPayRequest import AlipayTradeWapPayRequest
from alipay.aop.api.request.AlipayTradeQueryRequest import AlipayTradeQueryRequest
from alipay.aop.api.request.AlipayTradeCloseRequest import AlipayTradeCloseRequest
from alipay.aop.api.request.AlipayTradeRefundRequest import AlipayTradeRefundRequest
from datetime import datetime
import logging

logger = logging.getLogger(__name__)


class AlipayClient:
    """支付宝客户端封装"""
    
    def __init__(self):
        # 从环境变量获取支付宝配置
        self.app_id = os.getenv("ALIPAY_APP_ID", "")
        self.app_private_key = os.getenv("ALIPAY_APP_PRIVATE_KEY", "")
        self.alipay_public_key = os.getenv("ALIPAY_PUBLIC_KEY", "")
        
        # 是否为沙盒环境
        self.debug = os.getenv("ALIPAY_DEBUG", "true").lower() == "true"
        
        # 初始化支付宝客户端
        self.alipay = None
        if self.app_id and self.app_private_key and self.alipay_public_key:
            try:
                # 配置客户端
                alipay_client_config = AlipayClientConfig()
                alipay_client_config.app_id = self.app_id
                alipay_client_config.app_private_key = self.app_private_key
                alipay_client_config.alipay_public_key = self.alipay_public_key
                
                # 设置网关地址
                if self.debug:
                    alipay_client_config.server_url = "https://openapi-sandbox.dl.alipaydev.com/gateway.do"
                else:
                    alipay_client_config.server_url = "https://openapi.alipay.com/gateway.do"
                
                # 创建客户端
                self.alipay = DefaultAlipayClient(alipay_client_config=alipay_client_config)
                logger.info(f"支付宝客户端初始化成功 - {'沙盒模式' if self.debug else '正式模式'}")
            except Exception as e:
                logger.error(f"支付宝客户端初始化失败: {e}")
        else:
            logger.warning("支付宝配置不完整，请检查环境变量")
    
    def create_page_pay(self, out_trade_no: str, total_amount: float, subject: str, 
                       return_url: str = None, notify_url: str = None, timeout_express: str = None):
        """
        创建电脑网站支付订单
        
        Args:
            out_trade_no: 商户订单号，64个字符以内
            total_amount: 订单总金额，单位为元，精确到小数点后两位
            subject: 订单标题
            return_url: HTTP/HTTPS开头字符串，支付完成后返回的地址
            notify_url: 支付宝服务器主动通知商户服务器里指定的页面http/https路径
            timeout_express: 相对超时时间，沙箱环境不超过15小时（例如：30m、2h、1d等）
            
        Returns:
            支付链接
            
        注意事项（沙箱环境）:
            - 只支持余额支付，不支持银行卡、余额宝、花呗等
            - 电脑网站支付扫码支付需使用沙箱钱包扫一扫
            - 电脑网站支付PC登录需使用沙箱账户
            - timeout_express不可超过当前时间15小时
        """
        if not self.alipay:
            raise Exception("支付宝客户端未初始化")
        
        try:
            # 创建模型对象
            model = AlipayTradePagePayModel()
            model.out_trade_no = out_trade_no
            model.total_amount = str(total_amount)
            model.subject = subject
            model.product_code = "FAST_INSTANT_TRADE_PAY"
            
            if timeout_express:
                model.timeout_express = timeout_express
            
            # 创建请求对象
            request = AlipayTradePagePayRequest(biz_model=model)
            if return_url:
                request.return_url = return_url
            if notify_url:
                request.notify_url = notify_url
            
            # 执行请求
            response = self.alipay.page_execute(request, http_method="GET")
            
            logger.info(f"创建支付订单成功: {out_trade_no}")
            return response
            
        except Exception as e:
            logger.error(f"创建支付订单失败: {e}")
            raise
    
    def create_wap_pay(self, out_trade_no: str, total_amount: float, subject: str,
                      return_url: str = None, notify_url: str = None, timeout_express: str = None):
        """
        创建手机网站支付订单
        
        Args:
            out_trade_no: 商户订单号
            total_amount: 订单总金额
            subject: 订单标题
            return_url: 支付完成后返回的地址
            notify_url: 异步通知地址
            timeout_express: 相对超时时间，沙箱环境不超过15小时（例如：30m、2h、1d等）
            
        Returns:
            支付链接
            
        注意事项（沙箱环境）:
            - 仅支持余额支付，不支持银行卡、余额宝等
            - 需使用沙箱账户登录支付
            - 建议在真实手机设备上测试
        """
        if not self.alipay:
            raise Exception("支付宝客户端未初始化")
        
        try:
            # 创建模型对象
            model = AlipayTradeWapPayModel()
            model.out_trade_no = out_trade_no
            model.total_amount = str(total_amount)
            model.subject = subject
            model.product_code = "QUICK_WAP_WAY"
            
            if timeout_express:
                model.timeout_express = timeout_express
            
            # 创建请求对象
            request = AlipayTradeWapPayRequest(biz_model=model)
            if return_url:
                request.return_url = return_url
            if notify_url:
                request.notify_url = notify_url
            
            # 执行请求
            response = self.alipay.page_execute(request, http_method="GET")
            
            logger.info(f"创建手机支付订单成功: {out_trade_no}")
            return response
            
        except Exception as e:
            logger.error(f"创建手机支付订单失败: {e}")
            raise
    
    def verify_notify(self, data: dict):
        """
        验证支付宝异步通知签名
        
        Args:
            data: 支付宝POST过来的数据，字典格式
            
        Returns:
            bool: 验证是否成功
        """
        if not self.alipay:
            raise Exception("支付宝客户端未初始化")
        
        try:
            signature = data.pop("sign", None)
            if not signature:
                logger.error("通知数据中缺少签名")
                return False
            
            success = self.alipay.verify(data, signature)
            logger.info(f"异步通知验签{'成功' if success else '失败'}")
            return success
        except Exception as e:
            logger.error(f"验签失败: {e}")
            return False
    
    def query_order(self, out_trade_no: str = None, trade_no: str = None):
        """
        查询订单状态
        
        Args:
            out_trade_no: 商户订单号
            trade_no: 支付宝交易号
            
        Returns:
            订单查询结果
        """
        if not self.alipay:
            raise Exception("支付宝客户端未初始化")
        
        try:
            # 创建模型对象
            model = AlipayTradeQueryModel()
            if out_trade_no:
                model.out_trade_no = out_trade_no
            if trade_no:
                model.trade_no = trade_no
            
            # 创建请求对象
            request = AlipayTradeQueryRequest(biz_model=model)
            
            # 执行请求
            response = self.alipay.execute(request)
            
            logger.info(f"查询订单: {out_trade_no or trade_no}")
            return response
        except Exception as e:
            logger.error(f"查询订单失败: {e}")
            raise
    
    def close_order(self, out_trade_no: str = None, trade_no: str = None):
        """
        关闭订单
        
        Args:
            out_trade_no: 商户订单号
            trade_no: 支付宝交易号
            
        Returns:
            关闭结果
        """
        if not self.alipay:
            raise Exception("支付宝客户端未初始化")
        
        try:
            # 创建模型对象
            model = AlipayTradeCloseModel()
            if out_trade_no:
                model.out_trade_no = out_trade_no
            if trade_no:
                model.trade_no = trade_no
            
            # 创建请求对象
            request = AlipayTradeCloseRequest(biz_model=model)
            
            # 执行请求
            response = self.alipay.execute(request)
            
            logger.info(f"关闭订单: {out_trade_no or trade_no}")
            return response
        except Exception as e:
            logger.error(f"关闭订单失败: {e}")
            raise
    
    def refund(self, out_trade_no: str, refund_amount: float, refund_reason: str = None):
        """
        申请退款
        
        Args:
            out_trade_no: 商户订单号
            refund_amount: 退款金额
            refund_reason: 退款原因
            
        Returns:
            退款结果
            
        沙箱环境限制:
            - 退款金额需和支付金额保持一致（不支持部分退款）
            - 每笔交易订单仅支持调用一次退款接口
        """
        if not self.alipay:
            raise Exception("支付宝客户端未初始化")
        
        try:
            # 沙箱环境提示：需要查询订单金额验证
            if self.debug:
                logger.warning("沙箱环境退款注意：退款金额需和支付金额一致，每笔订单仅支持调用一次退款接口")
            
            # 创建模型对象
            model = AlipayTradeRefundModel()
            model.out_trade_no = out_trade_no
            model.refund_amount = str(refund_amount)
            if refund_reason:
                model.refund_reason = refund_reason
            
            # 创建请求对象
            request = AlipayTradeRefundRequest(biz_model=model)
            
            # 执行请求
            response = self.alipay.execute(request)
            
            logger.info(f"申请退款: {out_trade_no}, 金额: {refund_amount}")
            return response
        except Exception as e:
            logger.error(f"退款失败: {e}")
            raise


# 全局支付宝客户端实例
alipay_client = AlipayClient()
