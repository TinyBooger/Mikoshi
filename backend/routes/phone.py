"""
Phone-based authentication routes — SMS verification and phone login/sign-up.
"""
from fastapi import APIRouter, Form, HTTPException, Depends, status, Request
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError
from database import get_db
from models import User
from schemas import VerifyPhoneOut
from utils.session import create_session_token
from utils.user_utils import build_user_response
from utils.sms_utils import send_verification_code, verify_code, get_dev_sms_bypass_info
from utils.captcha_utils import verify_captcha_param
from utils.request_utils import get_client_ip, get_device_fingerprint, update_tracking_array
from utils.audit_logger import audit_request
from utils.invitation_utils import generate_invitation_code
from utils.credit_wallet import SIGNUP_BONUS_CREDITS, credit_wallet
from utils.onboarding_nicknames import generate_onboarding_nickname
import re

router = APIRouter()


# Dev-only endpoint: expose the universal verification code so the frontend
# can display it on the login page (production returns disabled).
@router.get("/api/dev-sms-bypass")
def dev_sms_bypass():
    """开发环境万能验证码配置（生产环境返回 disabled）"""
    info = get_dev_sms_bypass_info()
    if info is None:
        return {"enabled": False, "code": None}
    return info


# Send SMS verification code endpoint
@router.post("/api/send-verification-code")
async def send_sms_code(phone_number: str = Form(...)):
    """发送短信验证码"""
    # 验证手机号格式（中国大陆）
    if not re.match(r'^1[3-9]\d{9}$', phone_number):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid phone number format"
        )
    
    result = await send_verification_code(phone_number)
    if not result['success']:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=result['message']
        )
    
    return result


# Phone number verification — logs in existing users and creates new accounts
@router.post("/api/verify-phone", response_model=VerifyPhoneOut)
def verify_phone(
    request: Request,
    phone_number: str = Form(...),
    verification_code: str = Form(...),
    captcha_verify_param: str = Form(None),
    terms_accepted: bool = Form(False),
    db: Session = Depends(get_db)
):
    """
    验证手机号验证码
    - 首先验证人机验证码（如果提供）
    - 如果手机号已存在，直接登录返回session token
    - 如果手机号不存在，自动创建账号并登录
    
    参数：
    - phone_number: 手机号
    - verification_code: 手机验证码
    - captcha_verify_param: 人机验证码验签参数（建议必填）
    """
    if not terms_accepted:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="请先阅读并同意用户协议和隐私政策"
        )

    # 验证人机验证码（可选但推荐）
    if captcha_verify_param:
        try:
            print(f"📞 收到登录请求 - phone: {phone_number}, captcha_param长度: {len(captcha_verify_param)}")
            verification_result = verify_captcha_param(captcha_verify_param)
            print(f"🔐 验证码验证结果: {verification_result}")
            if not verification_result:
                print("❌ 验证码验证失败")
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Captcha verification failed"
                )
            print("✓ 验证码验证通过")
        except HTTPException:
            raise
        except Exception as e:
            print(f"❌ 验证码验证异常: {str(e)}")
            # 如果验证码服务异常，允许继续（但应该记录警告）
            print("⚠️  验证码服务异常，允许继续登录（请检查配置）")
    
    # 验证手机号验证码
    if not verify_code(phone_number, verification_code):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="验证码无效或已过期"
        )
    
    # 查找用户
    user = db.query(User).filter(User.phone_number == phone_number).first()
    
    if user:
        # 已存在用户，直接登录
        token = create_session_token(user)
        user_response = build_user_response(user, db)
        return {
            "status": "existing_user",
            "message": "Login successful",
            "session_token": token,
            "user": user_response
        }
    else:
        created_user = True
        user = User(
            id=f"phone_{phone_number}",
            phone_number=phone_number,
            name=generate_onboarding_nickname(),
            email=None,
            bio=None,
            hashed_password="",
            profile_pic=None,
            invitation_code=generate_invitation_code(db),
            last_known_ips=update_tracking_array([], get_client_ip(request)),
            device_fingerprints=update_tracking_array([], get_device_fingerprint(request)),
        )
        db.add(user)
        try:
            db.commit()
        except IntegrityError:
            db.rollback()
            user = db.query(User).filter(User.phone_number == phone_number).first()
            if not user:
                raise
            created_user = False
        db.refresh(user)
        if created_user:
            # One-time sign-up bonus for auto-created phone accounts
            credit_wallet(
                db,
                user_id=user.id,
                credits=SIGNUP_BONUS_CREDITS,
                source="signup_bonus",
                idempotency_key=f"signup_bonus_{user.id}",
                metadata={"bonus": "signup"},
            )
            db.commit()
            db.refresh(user)
        token = create_session_token(user)
        user_response = build_user_response(user, db)
        if created_user:
            audit_request(
                request,
                action="register",
                user_id=user.id,
                metadata={
                    "signup_method": "phone",
                    "name": user.name,
                    "phone_number": phone_number,
                    "invitation_code": None,
                },
            )
        return {
            "status": "new_user" if created_user else "existing_user",
            "message": "Account created successfully" if created_user else "Login successful",
            "session_token": token,
            "user": user_response,
        }


