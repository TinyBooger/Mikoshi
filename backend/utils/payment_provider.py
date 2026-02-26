import os
import uuid
import logging
from abc import ABC, abstractmethod
from typing import Optional
from urllib.parse import urlencode

from utils.alipay_utils import alipay_client

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


def get_active_payment_provider() -> BasePaymentProvider:
    environment = os.getenv("ENVIRONMENT", "development").strip().lower()
    provider = os.getenv("PAYMENT_PROVIDER", "mock").strip().lower()

    if environment == "production":
        if provider != "alipay":
            logger.warning("生产环境强制使用AlipayProvider，忽略 PAYMENT_PROVIDER=%s", provider)
        return _alipay_provider

    if provider == "alipay":
        return _alipay_provider

    return _mock_provider
