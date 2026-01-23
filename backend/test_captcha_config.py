# -*- coding: utf-8 -*-
"""
测试阿里云验证码配置和功能
"""
import os
import sys
from dotenv import load_dotenv

print("=" * 60)
print("阿里云验证码配置测试")
print("=" * 60)

# 加载环境变量
env_path = "../secrets/Mikoshi.env"
if os.path.exists(env_path):
    print(f"✓ 找到配置文件: {env_path}")
    load_dotenv(env_path)
else:
    print(f"✗ 配置文件不存在: {env_path}")
    sys.exit(1)

# 检查环境变量
print("\n📋 环境变量检查:")
print("-" * 60)

access_key_id = os.getenv("ALIBABA_CLOUD_ACCESS_KEY_ID")
access_key_secret = os.getenv("ALIBABA_CLOUD_ACCESS_KEY_SECRET")
scene_id = os.getenv("ALIYUN_CAPTCHA_SCENE_ID", "z6idp2sa")

if access_key_id:
    print(f"✓ ALIBABA_CLOUD_ACCESS_KEY_ID: {access_key_id[:10]}...")
else:
    print("✗ ALIBABA_CLOUD_ACCESS_KEY_ID: 未配置")

if access_key_secret:
    print(f"✓ ALIBABA_CLOUD_ACCESS_KEY_SECRET: {access_key_secret[:10]}...")
else:
    print("✗ ALIBABA_CLOUD_ACCESS_KEY_SECRET: 未配置")

print(f"✓ ALIYUN_CAPTCHA_SCENE_ID: {scene_id}")

if not access_key_id or not access_key_secret:
    print("\n⚠️  警告: 阿里云凭证未配置，验证码功能将不可用")
    print("\n请在 secrets/Mikoshi.env 中添加:")
    print("  ALIBABA_CLOUD_ACCESS_KEY_ID=your_access_key_id")
    print("  ALIBABA_CLOUD_ACCESS_KEY_SECRET=your_access_key_secret")
    sys.exit(1)

# 测试验证码客户端初始化
print("\n🔧 测试验证码客户端初始化:")
print("-" * 60)

try:
    from utils.captcha_utils import get_captcha_verifier
    
    verifier = get_captcha_verifier()
    
    if verifier.is_available:
        print("✓ 验证码客户端初始化成功")
        print(f"  - 场景ID: {verifier.scene_id}")
        print(f"  - 客户端状态: 可用")
    else:
        print("✗ 验证码客户端初始化失败")
        print("  - 客户端状态: 不可用")
        
except Exception as e:
    print(f"✗ 初始化失败: {str(e)}")
    import traceback
    traceback.print_exc()
    sys.exit(1)

# 测试验证（使用测试参数）
print("\n🧪 测试验证码验证功能:")
print("-" * 60)

# 注意：这里使用无效的测试参数，预期会失败
test_param = "test_invalid_param"
result = verifier.verify_captcha(test_param)

print(f"测试参数: {test_param}")
print(f"验证结果:")
print(f"  - success: {result.get('success')}")
print(f"  - passed: {result.get('passed')}")
print(f"  - message: {result.get('message')}")
if 'request_id' in result:
    print(f"  - request_id: {result.get('request_id')}")
if 'certify_result' in result:
    print(f"  - certify_result: {result.get('certify_result')}")

print("\n" + "=" * 60)
print("测试完成")
print("=" * 60)

print("\n💡 提示:")
print("  - 如果客户端初始化成功，说明凭证配置正确")
print("  - 使用测试参数验证预期会失败，这是正常的")
print("  - 真实的验证参数需要从前端获取")
print("  - 启动服务后，验证码功能会在登录时自动验证")
