import os
import uuid
import logging
from abc import ABC, abstractmethod
from typing import Optional
from urllib.parse import urlencode

from utils.alipay_utils import alipay_client
from utils.wechat_pay_utils import wechat_pay_client

logger = logging.getLogger(__name__)


class BasePaymentProvider(ABC):
    @property
    @abstractmethod
    def provider_name(self) -> str:
        pass

    @property
    @abstractmethod
    def debug(self) -> bool:
        pass

    @property
    @abstractmethod
    def is_configured(self) -> bool:
        pass

    @abstractmethod
    def create_page_pay(
        self,
        out_trade_no: str,
        total_amount: float,
        subject: str,
        return_url: Optional[str] = None,
        notify_url: Optional[str] = None,
        timeout_express: Optional[str] = None,
    ) -> str:
        pass

    @abstractmethod
    def create_wap_pay(
        self,
        out_trade_no: str,
        total_amount: float,
        subject: str,
        return_url: Optional[str] = None,
        notify_url: Optional[str] = None,
        timeout_express: Optional[str] = None,
    ) -> str:
        pass

    @abstractmethod
    def verify_notify(self, data: dict) -> bool:
        pass

    @abstractmethod
    def query_order(self, out_trade_no: Optional[str] = None, trade_no: Optional[str] = None) -> dict:
        pass

    @abstractmethod
    def close_order(self, out_trade_no: Optional[str] = None, trade_no: Optional[str] = None) -> dict:
        pass

    @abstractmethod
    def refund(self, out_trade_no: str, refund_amount: float, refund_reason: Optional[str] = None) -> dict:
        pass


class AlipayProvider(BasePaymentProvider):
    @property
    def provider_name(self) -> str:
        return "alipay"

    @property
    def debug(self) -> bool:
        return alipay_client.debug

    @property
    def is_configured(self) -> bool:
        return alipay_client.alipay is not None

    def create_page_pay(self, out_trade_no: str, total_amount: float, subject: str, return_url: Optional[str] = None,
                        notify_url: Optional[str] = None, timeout_express: Optional[str] = None) -> str:
        return alipay_client.create_page_pay(
            out_trade_no=out_trade_no,
            total_amount=total_amount,
            subject=subject,
            return_url=return_url,
            notify_url=notify_url,
            timeout_express=timeout_express,
        )

    def create_wap_pay(self, out_trade_no: str, total_amount: float, subject: str, return_url: Optional[str] = None,
                       notify_url: Optional[str] = None, timeout_express: Optional[str] = None) -> str:
        return alipay_client.create_wap_pay(
            out_trade_no=out_trade_no,
            total_amount=total_amount,
            subject=subject,
            return_url=return_url,
            notify_url=notify_url,
            timeout_express=timeout_express,
        )

    def verify_notify(self, data: dict) -> bool:
        return alipay_client.verify_notify(data)

    def query_order(self, out_trade_no: Optional[str] = None, trade_no: Optional[str] = None) -> dict:
        return alipay_client.query_order(out_trade_no=out_trade_no, trade_no=trade_no)

    def close_order(self, out_trade_no: Optional[str] = None, trade_no: Optional[str] = None) -> dict:
        return alipay_client.close_order(out_trade_no=out_trade_no, trade_no=trade_no)

    def refund(self, out_trade_no: str, refund_amount: float, refund_reason: Optional[str] = None) -> dict:
        return alipay_client.refund(out_trade_no=out_trade_no, refund_amount=refund_amount, refund_reason=refund_reason)


class MockPaymentProvider(BasePaymentProvider):
    def __init__(self):
        self._order_trade_map: dict[str, str] = {}

    @property
    def provider_name(self) -> str:
        return "mock"

    @property
    def debug(self) -> bool:
        return True

    @property
    def is_configured(self) -> bool:
        return True

    def _generate_trade_no(self, out_trade_no: str) -> str:
        if out_trade_no in self._order_trade_map:
            return self._order_trade_map[out_trade_no]
        trade_no = f"MOCK_{uuid.uuid4().hex[:24]}"
        self._order_trade_map[out_trade_no] = trade_no
        return trade_no

    def _build_mock_return_url(self, out_trade_no: str, total_amount: float, return_url: Optional[str] = None) -> str:
        if return_url:
            base_url = return_url
        else:
            frontend_base_url = os.getenv("FRONTEND_BASE_URL", "").rstrip("/")
            base_url = f"{frontend_base_url}/alipay/return" if frontend_base_url else "http://localhost:3000/alipay/return"

        query = urlencode({
            "out_trade_no": out_trade_no,
            "trade_no": self._generate_trade_no(out_trade_no),
            "total_amount": f"{float(total_amount):.2f}",
            "trade_status": "TRADE_SUCCESS",
            "provider": "mock",
        })
        return f"{base_url}?{query}"

    def create_page_pay(self, out_trade_no: str, total_amount: float, subject: str, return_url: Optional[str] = None,
                        notify_url: Optional[str] = None, timeout_express: Optional[str] = None) -> str:
        logger.info(f"Mock支付创建订单成功: {out_trade_no}, amount={total_amount}, subject={subject}")
        return self._build_mock_return_url(out_trade_no=out_trade_no, total_amount=total_amount, return_url=return_url)

    def create_wap_pay(self, out_trade_no: str, total_amount: float, subject: str, return_url: Optional[str] = None,
                       notify_url: Optional[str] = None, timeout_express: Optional[str] = None) -> str:
        logger.info(f"Mock支付创建WAP订单成功: {out_trade_no}, amount={total_amount}, subject={subject}")
        return self._build_mock_return_url(out_trade_no=out_trade_no, total_amount=total_amount, return_url=return_url)

    def verify_notify(self, data: dict) -> bool:
        return True

    def query_order(self, out_trade_no: Optional[str] = None, trade_no: Optional[str] = None) -> dict:
        resolved_out_trade_no = out_trade_no
        resolved_trade_no = trade_no

        if not resolved_trade_no and resolved_out_trade_no:
            resolved_trade_no = self._generate_trade_no(resolved_out_trade_no)

        return {
            "alipay_trade_query_response": {
                "code": "10000",
                "msg": "Success",
                "trade_status": "TRADE_SUCCESS",
                "out_trade_no": resolved_out_trade_no,
                "trade_no": resolved_trade_no,
                "total_amount": None,
            }
        }

    def close_order(self, out_trade_no: Optional[str] = None, trade_no: Optional[str] = None) -> dict:
        return {
            "alipay_trade_close_response": {
                "code": "10000",
                "msg": "Success",
                "out_trade_no": out_trade_no,
                "trade_no": trade_no,
            }
        }

    def refund(self, out_trade_no: str, refund_amount: float, refund_reason: Optional[str] = None) -> dict:
        return {
            "alipay_trade_refund_response": {
                "code": "10000",
                "msg": "Success",
                "out_trade_no": out_trade_no,
                "refund_fee": f"{float(refund_amount):.2f}",
                "refund_reason": refund_reason,
            }
        }


_alipay_provider = AlipayProvider()
_mock_provider = MockPaymentProvider()


def _resolve_payment_mode() -> str:
    """
    PAYMENT_PROVIDER unified semantics:
    - mock: use simulated providers for all payment channels
    - real: use real providers for all payment channels

    Backward compatibility:
    - alipay / wechat are treated as real
    """
    raw = os.getenv("PAYMENT_PROVIDER", "mock").strip().lower()
    if raw in {"real", "mock"}:
        return raw
    if raw in {"alipay", "wechat"}:
        logger.warning("PAYMENT_PROVIDER=%s 为旧配置，已兼容映射为 real；建议改为 PAYMENT_PROVIDER=real", raw)
        return "real"
    logger.warning("未知 PAYMENT_PROVIDER=%s，默认按 mock 处理", raw)
    return "mock"


def get_active_payment_provider() -> BasePaymentProvider:
    environment = os.getenv("ENVIRONMENT", "development").strip().lower()
    payment_mode = _resolve_payment_mode()

    if environment == "production":
        if payment_mode != "real":
            logger.warning("生产环境强制使用真实支付网关，忽略 PAYMENT_PROVIDER=%s", payment_mode)
        return _alipay_provider

    if payment_mode == "real":
        return _alipay_provider

    return _mock_provider


# ─────────────────────────────────────────────
# WeChat Pay providers
# ─────────────────────────────────────────────

class WeChatPayProvider:
    @property
    def provider_name(self) -> str:
        return "wechat"

    @property
    def is_configured(self) -> bool:
        return wechat_pay_client.is_configured

    def create_native_order(
        self,
        out_trade_no: str,
        total_amount: float,
        description: str,
        notify_url: Optional[str] = None,
        time_expire: Optional[str] = None,
    ) -> str:
        return wechat_pay_client.create_native_order(
            out_trade_no=out_trade_no,
            total_amount_yuan=total_amount,
            description=description,
            notify_url=notify_url,
            time_expire=time_expire,
        )

    def query_order(self, out_trade_no: str) -> dict:
        return wechat_pay_client.query_order(out_trade_no=out_trade_no)

    def close_order(self, out_trade_no: str) -> dict:
        return wechat_pay_client.close_order(out_trade_no=out_trade_no)

    def refund(
        self,
        out_trade_no: str,
        refund_amount: float,
        total_amount: float,
        reason: Optional[str] = None,
    ) -> dict:
        return wechat_pay_client.refund(
            out_trade_no=out_trade_no,
            refund_amount_yuan=refund_amount,
            total_amount_yuan=total_amount,
            reason=reason,
        )

    def verify_notify(self, headers: dict, body: str) -> dict:
        return wechat_pay_client.verify_notify(headers=headers, body=body)


class MockWeChatPayProvider:
    def __init__(self):
        self._order_map: dict[str, str] = {}  # out_trade_no → mock transaction_id

    @property
    def provider_name(self) -> str:
        return "mock_wechat"

    @property
    def is_configured(self) -> bool:
        return True

    def _get_transaction_id(self, out_trade_no: str) -> str:
        if out_trade_no not in self._order_map:
            self._order_map[out_trade_no] = f"MOCKWX_{uuid.uuid4().hex[:24]}"
        return self._order_map[out_trade_no]

    def create_native_order(
        self,
        out_trade_no: str,
        total_amount: float,
        description: str,
        notify_url: Optional[str] = None,
        time_expire: Optional[str] = None,
    ) -> str:
        logger.info(f"Mock微信支付创建Native订单: {out_trade_no}, amount={total_amount}")
        # Return a placeholder code_url for testing; the QR code just encodes this string.
        return f"weixin://wxpay/bizpayurl?pr=MOCK_{out_trade_no}"

    def query_order(self, out_trade_no: str) -> dict:
        return {
            "trade_state": "SUCCESS",
            "transaction_id": self._get_transaction_id(out_trade_no),
            "out_trade_no": out_trade_no,
            "amount": {"total": 0},
        }

    def close_order(self, out_trade_no: str) -> dict:
        return {"_http_code": 204}

    def refund(
        self,
        out_trade_no: str,
        refund_amount: float,
        total_amount: float,
        reason: Optional[str] = None,
    ) -> dict:
        return {
            "out_refund_no": f"RF_MOCK_{out_trade_no}",
            "out_trade_no": out_trade_no,
            "status": "SUCCESS",
        }

    def verify_notify(self, headers: dict, body: str) -> dict:
        import json
        return json.loads(body)


_wechat_provider = WeChatPayProvider()
_mock_wechat_provider = MockWeChatPayProvider()


def get_wechat_payment_provider():
    environment = os.getenv("ENVIRONMENT", "development").strip().lower()
    payment_mode = _resolve_payment_mode()

    if environment == "production":
        if payment_mode != "real":
            logger.warning("生产环境微信支付强制使用真实网关，忽略 PAYMENT_PROVIDER=%s", payment_mode)
        return _wechat_provider

    if payment_mode == "real":
        return _wechat_provider

    return _mock_wechat_provider
