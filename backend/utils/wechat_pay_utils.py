"""
微信支付工具类（直连商户模式 v3 Native支付）
"""
import os
import uuid
import json
import logging
from typing import Optional

logger = logging.getLogger(__name__)


class WeChatPayClient:
    """微信支付直连商户 v3 客户端封装"""

    REQUIRED_ENV_KEYS = (
        "WECHAT_MCHID",
        "WECHAT_APPID",
        "WECHAT_APIV3_KEY",
        "WECHAT_CERT_SERIAL_NO",
        "WECHAT_API_PRIVATE_KEY",
    )

    def __init__(self):
        self.mchid = ""
        self.appid = ""
        self.apiv3_key = ""
        self.cert_serial_no = ""
        self.private_key = ""
        self.notify_url = ""
        self.public_key = ""
        self.public_key_id = ""
        self._client = None
        self._initialize_client()

    def _load_config(self):
        self.mchid = os.getenv("WECHAT_MCHID", "")
        self.appid = os.getenv("WECHAT_APPID", "")
        self.apiv3_key = os.getenv("WECHAT_APIV3_KEY", "")
        self.cert_serial_no = os.getenv("WECHAT_CERT_SERIAL_NO", "")
        self.private_key = os.getenv("WECHAT_API_PRIVATE_KEY", "")
        self.notify_url = os.getenv("WECHAT_NOTIFY_URL", "")
        self.public_key = os.getenv("WECHAT_PUBLIC_KEY", "")
        self.public_key_id = os.getenv("WECHAT_PUBLIC_KEY_ID", "")

    @property
    def missing_config_fields(self) -> list[str]:
        config_map = {
            "WECHAT_MCHID": self.mchid,
            "WECHAT_APPID": self.appid,
            "WECHAT_APIV3_KEY": self.apiv3_key,
            "WECHAT_CERT_SERIAL_NO": self.cert_serial_no,
            "WECHAT_API_PRIVATE_KEY": self.private_key,
        }
        return [key for key, value in config_map.items() if not value]

    def _initialize_client(self, force_reload: bool = False) -> bool:
        if self._client is not None and not force_reload:
            return True

        self._load_config()

        missing = self.missing_config_fields
        if missing:
            self._client = None
            logger.warning("微信支付配置不完整，缺失: %s", ", ".join(missing))
            return False

        try:
            from wechatpayv3 import WeChatPay, WeChatPayType

            self._client = WeChatPay(
                wechatpay_type=WeChatPayType.NATIVE,
                mchid=self.mchid,
                private_key=self._normalize_private_key(self.private_key),
                cert_serial_no=self.cert_serial_no,
                appid=self.appid,
                apiv3_key=self.apiv3_key,
                notify_url=self.notify_url,
                public_key=(self._normalize_public_key(self.public_key) if self.public_key else None),
                public_key_id=(self.public_key_id or None),
            )

            if bool(self.public_key) ^ bool(self.public_key_id):
                logger.warning("WECHAT_PUBLIC_KEY 与 WECHAT_PUBLIC_KEY_ID 需要同时配置；当前仅配置了一项，已回退平台证书模式")

            logger.info("微信支付客户端初始化成功")
            return True
        except Exception as e:
            self._client = None
            logger.error(f"微信支付客户端初始化失败: {e}")
            return False

    def _ensure_client(self):
        # 尝试按需重建客户端，兼容环境变量晚于模块导入才注入的场景
        if self._client is None:
            self._initialize_client(force_reload=True)
        if not self._client:
            missing = self.missing_config_fields
            if missing:
                raise RuntimeError(f"微信支付客户端未初始化，缺失配置: {', '.join(missing)}")
            raise RuntimeError("微信支付客户端未初始化")

    @staticmethod
    def _normalize_private_key(key_str: str) -> str:
        """确保私钥格式正确（含 PEM 头尾）"""
        key_str = key_str.strip().replace("\\n", "\n")
        if "BEGIN PRIVATE KEY" not in key_str and "BEGIN RSA PRIVATE KEY" not in key_str:
            # 裸 base64，补充 PKCS#8 头尾
            key_str = f"-----BEGIN PRIVATE KEY-----\n{key_str}\n-----END PRIVATE KEY-----"
        return key_str

    @staticmethod
    def _normalize_public_key(key_str: str) -> str:
        """确保公钥格式正确（含 PEM 头尾）"""
        key_str = key_str.strip().replace("\\n", "\n")
        if "BEGIN PUBLIC KEY" not in key_str:
            key_str = f"-----BEGIN PUBLIC KEY-----\n{key_str}\n-----END PUBLIC KEY-----"
        return key_str

    @property
    def is_configured(self) -> bool:
        if self._client is not None:
            return True
        return self._initialize_client(force_reload=True)

    def create_native_order(
        self,
        out_trade_no: str,
        total_amount_yuan: float,
        description: str,
        notify_url: Optional[str] = None,
        time_expire: Optional[str] = None,
        attach: Optional[str] = None,
    ) -> str:
        """
        调用微信支付 Native 下单接口。
        返回 code_url（用于前端生成二维码）。
        total_amount_yuan: 单位元（如 15.0），内部转换为分。
        """
        self._ensure_client()

        amount_fen = int(round(total_amount_yuan * 100))
        if amount_fen <= 0:
            raise ValueError("微信支付金额必须大于0")

        resolved_notify_url = notify_url or self.notify_url
        if not resolved_notify_url:
            raise ValueError("微信支付下单缺少 notify_url")

        kwargs = {
            "description": description,
            "out_trade_no": out_trade_no,
            "amount": {"total": amount_fen, "currency": "CNY"},
            "notify_url": resolved_notify_url,
        }
        if time_expire:
            kwargs["time_expire"] = time_expire
        if attach:
            kwargs["attach"] = attach

        code, message = self._client.pay(**kwargs)
        logger.info(f"微信Native下单响应: code={code}, message={message}")

        if code not in (200, 201):
            raise RuntimeError(f"微信支付下单失败: code={code}, detail={message}")

        data = message if isinstance(message, dict) else json.loads(message)
        code_url = data.get("code_url")
        if not code_url:
            raise RuntimeError(f"微信支付下单未返回code_url: {data}")
        return code_url

    def query_order(self, out_trade_no: str) -> dict:
        """查询订单状态，返回原始响应 dict"""
        self._ensure_client()
        code, message = self._client.query(out_trade_no=out_trade_no)
        logger.info(f"微信查单响应: code={code}")
        data = message if isinstance(message, dict) else json.loads(message)
        data["_http_code"] = code
        return data

    def close_order(self, out_trade_no: str) -> dict:
        """关闭订单"""
        self._ensure_client()
        code, message = self._client.close(out_trade_no=out_trade_no)
        logger.info(f"微信关单响应: code={code}")
        if isinstance(message, str):
            try:
                data = json.loads(message)
                if isinstance(data, dict):
                    data["_http_code"] = code
                    return data
                return {"_raw": message, "_http_code": code}
            except Exception:
                return {"_raw": message, "_http_code": code}
        if isinstance(message, dict):
            message["_http_code"] = code
            return message
        return {"_http_code": code}

    def refund(
        self,
        out_trade_no: str,
        refund_amount_yuan: float,
        total_amount_yuan: float,
        reason: Optional[str] = None,
    ) -> dict:
        """申请退款"""
        self._ensure_client()
        out_refund_no = f"RF{uuid.uuid4().hex[:20]}"
        amount_fen = int(round(refund_amount_yuan * 100))
        total_fen = int(round(total_amount_yuan * 100))
        kwargs = {
            "out_trade_no": out_trade_no,
            "out_refund_no": out_refund_no,
            "amount": {
                "refund": amount_fen,
                "total": total_fen,
                "currency": "CNY",
            },
        }
        if reason:
            kwargs["reason"] = reason
        code, message = self._client.refund(**kwargs)
        logger.info(f"微信退款响应: code={code}")
        data = message if isinstance(message, dict) else json.loads(message)
        if not isinstance(data, dict):
            data = {"_raw": message}
        data["_http_code"] = code
        return data

    def verify_notify(self, headers: dict, body: str) -> dict:
        """
        验证微信支付回调签名并解密报文。
        返回解密后的 dict，验签失败则抛出 ValueError。
        """
        self._ensure_client()
        code, message = self._client.callback(headers=headers, body=body)
        if code != 200:
            raise ValueError(f"微信支付回调验签失败: code={code}, detail={message}")
        data = message if isinstance(message, dict) else json.loads(message)
        return data


# 单例
wechat_pay_client = WeChatPayClient()
