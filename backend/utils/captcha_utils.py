# -*- coding: utf-8 -*-
"""
阿里云人机验证码验签工具
用于验证客户端提交的验证码参数
"""
import os
import json
from typing import Dict, Optional

from alibabacloud_captcha20230305.client import Client as CaptchaClient
from alibabacloud_tea_openapi import models as open_api_models
from alibabacloud_captcha20230305 import models as captcha_models
from alibabacloud_tea_util import models as util_models


class CaptchaVerifier:
    """阿里云验证码验证器"""
    
    def __init__(self):
        """初始化验证码客户端"""
        self.client = self._create_client()
        self.scene_id = os.getenv("ALIYUN_CAPTCHA_SCENE_ID", "z6idp2sa")
        self.is_available = self.client is not None
    
    @staticmethod
    def _create_client() -> CaptchaClient:
        """
        创建阿里云验证码客户端
        使用默认凭证链（推荐方式）
        
        环境变量配置说明：
        - ALIBABA_CLOUD_ACCESS_KEY_ID: 阿里云Access Key ID
        - ALIBABA_CLOUD_ACCESS_KEY_SECRET: 阿里云Access Key Secret
        
        或者使用临时凭证：
        - ALIBABA_CLOUD_SECURITY_TOKEN: 临时安全令牌
        """
        try:
            # 检查环境变量
            access_key_id = os.getenv('ALIBABA_CLOUD_ACCESS_KEY_ID')
            access_key_secret = os.getenv('ALIBABA_CLOUD_ACCESS_KEY_SECRET')
            
            if not access_key_id or not access_key_secret:
                print("⚠️  警告: 阿里云验证码凭证未配置，验证码功能将不可用")
                print("   请在 secrets/Mikoshi.env 中配置:")
                print("   ALIBABA_CLOUD_ACCESS_KEY_ID=your_key_id")
                print("   ALIBABA_CLOUD_ACCESS_KEY_SECRET=your_key_secret")
                return None
            
            # 直接使用 AccessKey 凭证（避免 CredentialClient 凭证链的副作用：
            # 1. signal.signal() 只能在主线程调用
            # 2. EcsRamRoleCredentialsProvider 每实例创建一个 APScheduler 循环任务）
            config = open_api_models.Config(
                access_key_id=access_key_id,
                access_key_secret=access_key_secret
            )
            # 设置端点
            config.endpoint = 'captcha.cn-shanghai.aliyuncs.com'
            return CaptchaClient(config)
        except Exception as e:
            print(f"❌ 验证码客户端初始化失败: {str(e)}")
            return None
    
    def verify_captcha(
        self, 
        captcha_verify_param: str,
        scene_id: Optional[str] = None
    ) -> Dict:
        """
        验证验证码参数
        
        参数：
        - captcha_verify_param: 客户端验证码验证后返回的验签参数（JSON字符串）
        - scene_id: 验证码场景ID，不指定时使用默认值
        
        返回值：
        - success: 验证是否成功
        - passed: 验证是否通过
        - message: 返回信息
        - request_id: 请求ID（用于追踪）
        """
        try:
            # 检查客户端是否可用
            if not self.is_available or self.client is None:
                print("⚠️  验证码客户端未初始化，跳过验证码验证")
                return {
                    "success": True,
                    "passed": True,
                    "message": "Captcha verification skipped (client not configured)",
                    "warning": "Captcha credentials not configured"
                }
            
            if not captcha_verify_param:
                return {
                    "success": False,
                    "passed": False,
                    "message": "Missing captcha verify parameter"
                }
            
            scene_id = scene_id or self.scene_id
            
            print(f"🔍 验证验证码参数: scene_id={scene_id}, param_length={len(captcha_verify_param)}")
            
            # 构建验证请求
            request = captcha_models.VerifyIntelligentCaptchaRequest(
                captcha_verify_param=captcha_verify_param,
                scene_id=scene_id
            )
            
            # 发送验证请求
            response = self.client.verify_intelligent_captcha_with_options(
                request,
                util_models.RuntimeOptions()
            )
            
            # 解析响应
            result = self._parse_response(response)
            print(f"✓ 验证码验证结果: passed={result.get('passed')}, verify_result={result.get('verify_result')}, api_success={result.get('api_success')}")
            return result
            
        except Exception as e:
            print(f"❌ 验证码验证异常: {str(e)}")
            return {
                "success": False,
                "passed": False,
                "message": f"Verification error: {str(e)}",
                "error": str(e)
            }
    
    @staticmethod
    def _parse_response(response) -> Dict:
        """
        解析阿里云验证码API响应
        
        响应字段说明 (SDK v20230305 VerifyIntelligentCaptchaResponseBody):
        - Code: HTTP 状态码字符串 (e.g. "200")
        - Message: 返回消息
        - RequestId: 请求ID
        - Success: 请求是否成功 (bool)
        - Result:
            - CertifyId: 认证ID
            - VerifyCode: 验证码字符串
            - VerifyResult: 验证是否通过 (bool)
        """
        try:
            if not response or not response.body:
                return {
                    "success": False,
                    "passed": False,
                    "message": "Empty response from Aliyun"
                }
            
            body = response.body
            request_id = body.request_id if hasattr(body, 'request_id') else 'unknown'
            api_success = body.success if hasattr(body, 'success') else False
            
            # 验证结果在 body.result.verify_result 中（bool 类型）
            verify_result = None
            certify_id = None
            if hasattr(body, 'result') and body.result:
                verify_result = body.result.verify_result if hasattr(body.result, 'verify_result') else None
                certify_id = body.result.certify_id if hasattr(body.result, 'certify_id') else None
            
            # 判断验证是否通过：
            # 1. API 调用本身成功 (body.success == True)
            # 2. 验证结果明确为 True (body.result.verify_result == True)
            passed = api_success and (verify_result is True)
            
            return {
                "success": True,
                "passed": passed,
                "message": f"Verification {'passed' if passed else 'failed'}",
                "verify_result": verify_result,
                "certify_id": certify_id,
                "request_id": request_id,
                "api_success": api_success
            }
        except Exception as e:
            return {
                "success": False,
                "passed": False,
                "message": f"Failed to parse response: {str(e)}",
                "error": str(e)
            }


# 全局验证器实例
# 在模块加载时立即初始化（主线程），避免后续在 worker 线程中初始化
# 导致 CredentialClient 内部 signal.signal() 调用失败
_captcha_verifier: Optional[CaptchaVerifier] = None


def _init_captcha_verifier():
    """在模块加载时（主线程）初始化验证码验证器"""
    global _captcha_verifier
    try:
        _captcha_verifier = CaptchaVerifier()
    except Exception as e:
        print(f"⚠️  验证码验证器模块加载时初始化失败: {str(e)}")
        _captcha_verifier = None


def get_captcha_verifier() -> CaptchaVerifier:
    """
    获取验证码验证器实例（单例模式）
    注意：验证器在模块加载时已初始化，此函数仅返回已有实例。
    如果初始化失败（凭证未配置），会返回一个 client 为 None 的实例。
    """
    global _captcha_verifier
    if _captcha_verifier is None:
        # 兜底：如果模块加载时初始化失败，在此处重试
        # 此时应确保在主线程中调用（例如从 startup 事件）
        _init_captcha_verifier()
    return _captcha_verifier


def reinitialize_captcha_verifier():
    """
    强制重新初始化验证码验证器（仅在主线程中调用）
    用于在环境变量加载后重新创建客户端
    """
    global _captcha_verifier
    _captcha_verifier = None
    _init_captcha_verifier()
    if _captcha_verifier and _captcha_verifier.is_available:
        print("✓ 验证码验证器重新初始化成功")
    else:
        print("⚠️  验证码验证器重新初始化失败（凭证可能未配置）")


# 模块加载时立即初始化（在主线程中）
_init_captcha_verifier()


def verify_captcha_param(captcha_verify_param: str, scene_id: Optional[str] = None) -> bool:
    """
    快速验证验证码参数
    
    参数：
    - captcha_verify_param: 验证码验证参数
    - scene_id: 场景ID（可选）
    
    返回：
    - True: 验证通过
    - False: 验证失败
    """
    verifier = get_captcha_verifier()
    result = verifier.verify_captcha(captcha_verify_param, scene_id)
    return result.get("passed", False) and result.get("success", False)
