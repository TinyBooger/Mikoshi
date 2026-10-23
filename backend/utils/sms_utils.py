# -*- coding: utf-8 -*-
import os
import json
import logging
import secrets
from alibabacloud_dysmsapi20170525.client import Client as DysmsapiClient
from alibabacloud_tea_openapi import models as open_api_models
from alibabacloud_dysmsapi20170525 import models as dysmsapi_models
from alibabacloud_tea_util import models as util_models
from datetime import datetime, timedelta
from typing import Dict

logger = logging.getLogger(__name__)

# 验证码缓存（生产环境建议使用Redis）
verification_codes: Dict[str, dict] = {}

# 已验证手机号的临时token（验证通过后5分钟内有效，用于注册）
verified_phone_tokens: Dict[str, dict] = {}

# 开发环境万能验证码（仅非生产环境生效，用于跳过短信验证，方便本地/测试）
DEV_SMS_BYPASS_CODE = '888888'

# 运行时开关（默认开启，仅非生产环境可启用；可通过管理后台切换）
_dev_sms_bypass_enabled = True


def is_dev_environment() -> bool:
    """当前是否为非生产环境（开发/测试）。"""
    return os.getenv('ENVIRONMENT', 'development').strip().lower() != 'production'


def is_dev_sms_bypass_active() -> bool:
    """万能验证码当前是否生效（非生产环境且开关开启）。"""
    return is_dev_environment() and _dev_sms_bypass_enabled


def set_dev_sms_bypass_enabled(enabled: bool) -> None:
    """设置万能验证码开关（仅非生产环境可启用）。"""
    global _dev_sms_bypass_enabled
    _dev_sms_bypass_enabled = bool(enabled)


def get_dev_sms_bypass_info():
    """
    返回开发环境短信验证码绕过配置，供前端展示万能验证码。
    生产环境返回 None。
    """
    if not is_dev_environment():
        return None
    return {
        'enabled': _dev_sms_bypass_enabled,
        'code': DEV_SMS_BYPASS_CODE,
    }


def create_sms_client() -> DysmsapiClient:
    """
    Create the Aliyun Dysmsapi client using AccessKey credentials from the environment.
    """
    access_key_id = os.getenv('ALIBABA_CLOUD_ACCESS_KEY_ID')
    access_key_secret = os.getenv('ALIBABA_CLOUD_ACCESS_KEY_SECRET')
    sign_name = os.getenv('ALIBABA_CLOUD_SMS_SIGN_NAME')
    template_code = os.getenv('ALIBABA_CLOUD_SMS_TEMPLATE_CODE')

    missing = [
        name
        for name, value in (
            ('ALIBABA_CLOUD_ACCESS_KEY_ID', access_key_id),
            ('ALIBABA_CLOUD_ACCESS_KEY_SECRET', access_key_secret),
            ('ALIBABA_CLOUD_SMS_SIGN_NAME', sign_name),
            ('ALIBABA_CLOUD_SMS_TEMPLATE_CODE', template_code),
        )
        if not value
    ]
    if missing:
        raise RuntimeError(
            f"{', '.join(missing)} must be set in environment variables"
        )

    config = open_api_models.Config(
        access_key_id=access_key_id,
        access_key_secret=access_key_secret
    )
    config.endpoint = 'dysmsapi.aliyuncs.com'
    return DysmsapiClient(config)


async def send_verification_code(phone_number: str) -> dict:
    """
    发送短信验证码
    
    Args:
        phone_number: 手机号（不含+86）
        
    Returns:
        dict: {"success": bool, "message": str, "verify_code": str (仅开发环境)}
    """
    try:
        # 频率限制：同一手机号60秒内只能发送一次
        if phone_number in verification_codes:
            last_send = verification_codes[phone_number].get('sent_at')
            if last_send and (datetime.now() - last_send).total_seconds() < 60:
                return {
                    "success": False,
                    "message": "请求过于频繁，请60秒后再试"
                }
        
        client = create_sms_client()
        sign_name = os.environ['ALIBABA_CLOUD_SMS_SIGN_NAME']
        template_code = os.environ['ALIBABA_CLOUD_SMS_TEMPLATE_CODE']
        verify_code = f'{secrets.randbelow(1_000_000):06d}'
        request = dysmsapi_models.SendSmsRequest(
            phone_numbers=phone_number,
            sign_name=sign_name,
            template_code=template_code,
            template_param=json.dumps({'code': verify_code})
        )

        runtime = util_models.RuntimeOptions()
        response = await client.send_sms_with_options_async(request, runtime)

        if response.body.code == 'OK':
            verification_codes[phone_number] = {
                'code': verify_code,
                'sent_at': datetime.now(),
                'expires_at': datetime.now() + timedelta(minutes=5)
            }

            result = {
                "success": True,
                "message": "验证码已发送"
            }
            if is_dev_environment():
                result['verify_code'] = verify_code
            return result
        else:
            err_code = response.body.code or 'Unknown'
            err_msg = response.body.message or 'Invalid parameters'
            logger.error("Aliyun SMS request failed: %s - %s", err_code, err_msg)
            return {
                "success": False,
                "message": f"发送失败：{err_code} - {err_msg}"
            }

    except Exception:
        logger.exception("Aliyun SMS request failed")
        return {
            "success": False,
            "message": "短信发送失败，请稍后重试"
        }


def verify_code(phone_number: str, code: str) -> bool:
    """
    验证短信验证码
    
    Args:
        phone_number: 手机号
        code: 用户输入的验证码
        
    Returns:
        bool: 验证是否成功
    """
    # 开发环境万能验证码：跳过短信验证，方便本地/测试环境登录
    if is_dev_sms_bypass_active() and code and code == DEV_SMS_BYPASS_CODE:
        return True

    if phone_number not in verification_codes:
        return False
    
    stored = verification_codes[phone_number]
    
    # 检查是否过期
    if datetime.now() > stored['expires_at']:
        del verification_codes[phone_number]
        return False
    
    # 验证码匹配
    if stored['code'] == code:
        # 验证成功后删除验证码（一次性使用）
        del verification_codes[phone_number]
        return True
    
    return False


def create_verified_phone_token(phone_number: str) -> str:
    """
    为已验证的手机号创建临时token
    用于跳转到注册页面时证明手机号已通过验证
    
    Args:
        phone_number: 已验证的手机号
        
    Returns:
        str: 临时token（5分钟有效）
    """
    token = secrets.token_urlsafe(32)
    verified_phone_tokens[token] = {
        'phone_number': phone_number,
        'expires_at': datetime.now() + timedelta(minutes=5)
    }
    return token


def verify_phone_token(token: str) -> str:
    """
    验证临时token并返回关联的手机号
    
    Args:
        token: 临时token
        
    Returns:
        str: 手机号，如果token无效或过期返回None
    """
    if token not in verified_phone_tokens:
        return None
    
    stored = verified_phone_tokens[token]
    
    # 检查是否过期
    if datetime.now() > stored['expires_at']:
        del verified_phone_tokens[token]
        return None
    
    # Token验证成功后删除（一次性使用）
    phone_number = stored['phone_number']
    del verified_phone_tokens[token]
    return phone_number
