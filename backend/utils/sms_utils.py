# -*- coding: utf-8 -*-
import os
import json
import secrets
from alibabacloud_dypnsapi20170525.client import Client as DypnsapiClient
from alibabacloud_credentials.client import Client as CredentialClient
from alibabacloud_tea_openapi import models as open_api_models
from alibabacloud_dypnsapi20170525 import models as dypnsapi_models
from alibabacloud_tea_util import models as util_models
from datetime import datetime, timedelta
from typing import Dict

# 验证码缓存（生产环境建议使用Redis）
verification_codes: Dict[str, dict] = {}

# 已验证手机号的临时token（验证通过后5分钟内有效，用于注册）
verified_phone_tokens: Dict[str, dict] = {}


def create_sms_client() -> DypnsapiClient:
    """创建阿里云短信服务客户端"""
    credential = CredentialClient()
    config = open_api_models.Config(credential=credential)
    config.endpoint = 'dypnsapi.aliyuncs.com'
    return DypnsapiClient(config)


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
        request = dypnsapi_models.SendSmsVerifyCodeRequest(
            phone_number=phone_number,
            sign_name='速通互联验证码',
            template_code='100001',
            template_param='{"code":"##code##","min":"5"}',  # 验证码占位符
            code_type=1,  # 数字验证码
            code_length=6,  # 6位验证码
            valid_time=300,  # 5分钟有效期
            interval=60,  # 60秒发送间隔
            return_verify_code=True,  # 开发环境返回验证码
            duplicate_policy=1  # 新验证码覆盖旧验证码
        )
        
        runtime = util_models.RuntimeOptions()
        response = await client.send_sms_verify_code_with_options_async(request, runtime)

        # 如果阿里云返回非OK，直接透传错误信息，方便定位签名/模板/参数问题
        if response.body.code == 'OK':
            # 存储验证码到缓存
            verify_code = response.body.model.verify_code if response.body.model else None
            verification_codes[phone_number] = {
                'code': verify_code,
                'sent_at': datetime.now(),
                'expires_at': datetime.now() + timedelta(minutes=5),
                'biz_id': response.body.model.biz_id if response.body.model else None
            }
            
            result = {
                "success": True,
                "message": "验证码已发送"
            }
            # 开发环境返回验证码（生产环境删除此行）
            if verify_code:
                result['verify_code'] = verify_code
            
            return result
        else:
            err_code = response.body.code or 'Unknown'
            err_msg = response.body.message or 'Invalid parameters'
            detail = getattr(response.body, 'access_denied_detail', None) or getattr(response.body, 'AccessDeniedDetail', None)
            return {
                "success": False,
                "message": f"发送失败：{err_code} - {err_msg}",
                "detail": detail,
            }
            
    except Exception as e:
        print(f"SMS Error: {str(e)}")
        return {
            "success": False,
            "message": f"发送失败：{str(e)}"
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
