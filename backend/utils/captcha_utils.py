# -*- coding: utf-8 -*-
"""
阿里云人机验证码验签工具
用于验证客户端提交的验证码参数
"""
import os
import json
from typing import Dict, Optional

from alibabacloud_captcha20230305.client import Client as CaptchaClient
from alibabacloud_credentials.client import Client as CredentialClient
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
            
            # 使用默认凭证链
            credential = CredentialClient()
            config = open_api_models.Config(
                credential=credential
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
            print(f"✓ 验证码验证结果: passed={result.get('passed')}, certify_result={result.get('certify_result')}")
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
        
        响应字段说明：
        - RequestId: 请求ID
        - Body:
            - RequestId: 请求ID
            - HasError: 是否发生错误（true/false）
            - CertifyResult: 验证结果（pass/refuse/unknown）
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
            has_error = body.has_error if hasattr(body, 'has_error') else False
            certify_result = body.certify_result if hasattr(body, 'certify_result') else 'unknown'
            
            passed = (not has_error) and (certify_result == 'pass')
            
            return {
                "success": True,
                "passed": passed,
                "message": f"Verification {certify_result}",
                "certify_result": certify_result,
                "request_id": request_id,
                "has_error": has_error
            }
        except Exception as e:
            return {
                "success": False,
                "passed": False,
                "message": f"Failed to parse response: {str(e)}",
                "error": str(e)
            }


# 全局验证器实例
_captcha_verifier: Optional[CaptchaVerifier] = None


def get_captcha_verifier() -> CaptchaVerifier:
    """
    获取验证码验证器实例（单例模式）
    """
    global _captcha_verifier
    if _captcha_verifier is None:
        _captcha_verifier = CaptchaVerifier()
    return _captcha_verifier


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
