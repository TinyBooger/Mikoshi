from fastapi import APIRouter, Form, HTTPException, Depends, status, Request, UploadFile, File
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session
from passlib.context import CryptContext
from database import get_db
from models import User, SystemSettings
from schemas import UserOut, AuthUserOut, VerifyPhoneOut
from utils.session import create_session_token, verify_session_token
from utils.user_utils import build_user_response, check_and_expire_pro
from utils.validators import validate_account_fields
from utils.sms_utils import send_verification_code, verify_code, create_verified_phone_token, verify_phone_token
from utils.captcha_utils import verify_captcha_param, get_captcha_verifier
from utils.audit_logger import record_audit
from utils.request_utils import get_client_ip, get_user_agent, get_request_metadata
from utils.image_moderation import moderate_image
from utils.text_moderation import moderate_form_payload
import re
from typing import Optional

router = APIRouter()
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


# Simple session token-based authentication
from fastapi import Header


def _is_invitation_code_required(db: Session) -> bool:
    """Check whether invitation code requirement is currently enabled."""
    setting = db.query(SystemSettings).filter(SystemSettings.key == "invitation_code_required").first()
    return setting.value == "true" if setting else True


@router.get("/api/registration-settings")
def get_registration_settings(db: Session = Depends(get_db)):
    """Public endpoint: returns current registration configuration."""
    return {"invitation_code_required": _is_invitation_code_required(db)}


@router.get("/api/users/me", response_model=UserOut)
def get_current_user(
    db: Session = Depends(get_db),
    session_token: str = Header(None, alias="Authorization")
):
    user_id = verify_session_token(session_token)
    if not user_id:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid or missing session token")
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    user = check_and_expire_pro(user, db)
    
    return build_user_response(user, db)


# 阿里云人机验证码验证接口
@router.post("/api/verify-captcha")
def verify_captcha_endpoint(
    captcha_verify_param: str = Form(...)
):
    """
    验证阿里云人机验证码
    
    参数：
    - captcha_verify_param: 客户端验证码验证后返回的验签参数
    
    返回：
    {
        "success": true,
        "passed": true,
        "message": "Verification pass",
        "certify_result": "pass",
        "request_id": "xxx"
    }
    """
    try:
        verifier = get_captcha_verifier()
        result = verifier.verify_captcha(captcha_verify_param)
        
        if not result.get("success"):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=result.get("message", "Captcha verification failed")
            )
        
        # 返回完整的验证结果
        return {
            "success": True,
            "passed": result.get("passed", False),
            "message": result.get("message", "Verification completed"),
            "certify_result": result.get("certify_result"),
            "request_id": result.get("request_id")
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Internal server error: {str(e)}"
        )


# Registration endpoint
@router.post("/api/users", response_model=AuthUserOut)
def register_user(
    request: Request,
    email: str = Form(...),
    name: str = Form(...),
    password: str = Form(...),
    invitation_code: Optional[str] = Form(None),
    bio: str = Form(None),
    profile_pic: UploadFile = File(None),
    db: Session = Depends(get_db)
):
    from models import InvitationCode
    from datetime import datetime, UTC

    # Validate invitation code only when the setting requires it
    invitation = None
    if _is_invitation_code_required(db):
        if not invitation_code or not invitation_code.strip():
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invitation code is required")

        invitation = db.query(InvitationCode).filter(
            InvitationCode.code == invitation_code.upper()
        ).first()

        if not invitation:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid invitation code")

        if not invitation.is_active:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="This invitation code has been revoked")

        if invitation.use_count >= invitation.max_uses:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="This invitation code has reached its usage limit")

        if invitation.expires_at and datetime.now(UTC) > invitation.expires_at:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="This invitation code has expired")
    
    # Proceed with user registration
    if db.query(User).filter(User.email == email).first():
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Email already registered")

    text_safe, blocked_field, blocked_label = moderate_form_payload({
        "name": name,
        "bio": bio,
    })
    if not text_safe:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Text rejected by content moderation ({blocked_field}: {blocked_label})"
        )

    error = validate_account_fields(name=name)
    if error:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=error)
    hashed_password = pwd_context.hash(password)
    user = User(
        id=email,  # Use email as unique ID for simplicity
        email=email,
        name=name,
        bio=bio,
        profile_pic=None
    )
    # Store hashed password in a separate field if you add it to User model
    setattr(user, "hashed_password", hashed_password)
    db.add(user)
    db.commit()
    db.refresh(user)
    
    # Mark invitation code as used (only when it was validated)
    if invitation:
        invitation.use_count += 1
        if invitation.use_count == 1:  # First use
            invitation.used_by = user.id
            invitation.used_at = datetime.now(UTC)
        db.commit()

    # If an image was uploaded, moderate then save it
    if profile_pic:
        try:
            import io
            from utils.local_storage_utils import save_image

            image_bytes = profile_pic.file.read()
            is_safe, label = moderate_image(image_bytes)
            if not is_safe:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Profile image rejected by content moderation ({label})"
                )

            # Need to refresh user to ensure id exists (id is email here)
            user.profile_pic = save_image(io.BytesIO(image_bytes), 'user', user.id, profile_pic.filename)
            db.commit()
            db.refresh(user)
        except HTTPException:
            raise
        except Exception:
            # Non-fatal: registration succeeded but image saving failed
            pass
    token = create_session_token(user)
    user_response = build_user_response(user, db)
    record_audit(
        user_id=user.id,
        action="register",
        ip_address=get_client_ip(request),
        user_agent=get_user_agent(request),
        metadata=get_request_metadata(request, {"email": email, "name": name})
    )
    return {"message": "User registered successfully", "token": token, "user": user_response}

# Login endpoint
@router.post("/api/login", response_model=AuthUserOut)
def login_user(
    request: Request,
    email: str = Form(...),
    password: str = Form(...),
    db: Session = Depends(get_db)
):
    # Accept either email or phone number in the same field
    account = email.strip()
    user = None
    if '@' in account:
        user = db.query(User).filter(User.email == account).first()
        login_method = "email"
    else:
        # treat as phone number
        user = db.query(User).filter(User.phone_number == account).first()
        login_method = "phone"
    if not user:
        record_audit(
            user_id=None,
            action="login_failed",
            ip_address=get_client_ip(request),
            user_agent=get_user_agent(request),
            status="failure",
            error_message="Invalid credentials",
            metadata=get_request_metadata(request, {"login_method": login_method, "identifier": account})
        )
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid email or password")
    hashed_password = getattr(user, "hashed_password", None)
    if not hashed_password or not pwd_context.verify(password, hashed_password):
        record_audit(
            user_id=user.id,
            action="login_failed",
            ip_address=get_client_ip(request),
            user_agent=get_user_agent(request),
            status="failure",
            error_message="Invalid password",
            metadata=get_request_metadata(request, {"login_method": login_method})
        )
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid email or password")
    token = create_session_token(user)
    user_response = build_user_response(user, db)
    record_audit(
        user_id=user.id,
        action="login",
        ip_address=get_client_ip(request),
        user_agent=get_user_agent(request),
        metadata=get_request_metadata(request, {"login_method": login_method})
    )
    return {"message": "Login successful", "token": token, "user": user_response}

# Password reset endpoint
@router.post("/api/reset-password")
def reset_password(
    request: Request,
    email: str = Form(...),
    new_password: str = Form(...),
    db: Session = Depends(get_db)
):
    user = db.query(User).filter(User.email == email).first()
    if not user:
        record_audit(
            user_id=None,
            action="reset_password_failed",
            ip_address=get_client_ip(request),
            user_agent=get_user_agent(request),
            status="failure",
            error_message="User not found",
            metadata=get_request_metadata(request, {"email": email})
        )
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    # If user has no hashed_password, allow reset (legacy Firebase user)
    # Or allow reset for any user (with proper frontend flow)
    hashed_password = pwd_context.hash(new_password)
    setattr(user, "hashed_password", hashed_password)
    db.commit()
    record_audit(
        user_id=user.id,
        action="reset_password",
        ip_address=get_client_ip(request),
        user_agent=get_user_agent(request),
        metadata=get_request_metadata(request, {"email": email})
    )
    return {"message": "Password reset successful"}


# Change password for current user (requires Authorization header)
@router.post("/api/change-password")
def change_password(request: Request, payload: dict = None, db: Session = Depends(get_db), session_token: str = Header(None, alias="Authorization")):
    # payload expected: { currentPassword: '...', newPassword: '...' }
    currentPassword = None
    newPassword = None
    if payload:
        currentPassword = payload.get('currentPassword') or payload.get('current_password')
        newPassword = payload.get('newPassword') or payload.get('new_password')
    if not currentPassword or not newPassword:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Missing fields")
    user_id = verify_session_token(session_token)
    if not user_id:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid session")
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    hashed = getattr(user, 'hashed_password', None)
    if not hashed or not pwd_context.verify(currentPassword, hashed):
        record_audit(
            user_id=user.id,
            action="change_password_failed",
            ip_address=get_client_ip(request),
            user_agent=get_user_agent(request),
            status="failure",
            error_message="Current password incorrect",
            metadata=get_request_metadata(request)
        )
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Current password incorrect")
    user.hashed_password = pwd_context.hash(newPassword)
    db.commit()
    record_audit(
        user_id=user.id,
        action="change_password",
        ip_address=get_client_ip(request),
        user_agent=get_user_agent(request),
        metadata=get_request_metadata(request)
    )
    return {"message": "Password changed"}


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


# Phone number verification - returns token for new users or logs in existing users
@router.post("/api/verify-phone", response_model=VerifyPhoneOut)
def verify_phone(
    phone_number: str = Form(...),
    verification_code: str = Form(...),
    captcha_verify_param: str = Form(None),
    db: Session = Depends(get_db)
):
    """
    验证手机号验证码
    - 首先验证人机验证码（如果提供）
    - 如果手机号已存在，直接登录返回session token
    - 如果手机号不存在，返回verified_phone_token用于注册
    
    参数：
    - phone_number: 手机号
    - verification_code: 手机验证码
    - captcha_verify_param: 人机验证码验签参数（建议必填）
    """
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
            detail="Invalid or expired verification code"
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
        # 新用户，生成验证token用于注册
        verified_token = create_verified_phone_token(phone_number)
        return {
            "status": "new_user",
            "message": "Phone verified, please complete registration",
            "verified_phone_token": verified_token,
            "phone_number": phone_number
        }


# Phone number registration endpoint
@router.post("/api/register-with-phone", response_model=AuthUserOut)
def register_with_phone(
    verified_phone_token: str = Form(...),
    name: str = Form(...),
    invitation_code: Optional[str] = Form(None),
    email: str = Form(None),
    password: str = Form(None),
    bio: str = Form(None),
    profile_pic: UploadFile = File(None),
    db: Session = Depends(get_db)
):
    """
    使用已验证的手机号完成注册
    """
    # 验证token并获取手机号
    phone_number = verify_phone_token(verified_phone_token)
    if not phone_number:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired verification token"
        )
    
    # 检查手机号是否已被注册（防止重复）
    if db.query(User).filter(User.phone_number == phone_number).first():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Phone number already registered"
        )
    
    # 如果提供了邮箱，检查是否已被使用
    if email and email.strip():
        if db.query(User).filter(User.email == email.strip()).first():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Email already registered"
            )
    
    # 验证邀请码（仅在系统设置要求时）
    from models import InvitationCode
    from datetime import datetime, UTC

    invitation = None
    if _is_invitation_code_required(db):
        if not invitation_code or not invitation_code.strip():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invitation code is required"
            )

        invitation = db.query(InvitationCode).filter(
            InvitationCode.code == invitation_code.upper()
        ).first()

        if not invitation:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid invitation code"
            )

        if not invitation.is_active:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="This invitation code has been revoked"
            )

        if invitation.use_count >= invitation.max_uses:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="This invitation code has reached its usage limit"
            )

        if invitation.expires_at and datetime.now(UTC) > invitation.expires_at:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="This invitation code has expired"
            )
    
    # 验证用户名
    text_safe, blocked_field, blocked_label = moderate_form_payload({
        "name": name,
        "bio": bio,
    })
    if not text_safe:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Text rejected by content moderation ({blocked_field}: {blocked_label})"
        )

    error = validate_account_fields(name=name)
    if error:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=error
        )
    
    # 创建新用户
    user_id = f"phone_{phone_number}"
    
    # Hash password if provided
    hashed_pw = ""
    if password and password.strip():
        hashed_pw = pwd_context.hash(password.strip())
    
    user = User(
        id=user_id,
        phone_number=phone_number,
        name=name,
        email=email.strip() if email and email.strip() else None,
        bio=bio,
        hashed_password=hashed_pw,
        profile_pic=None
    )
    
    db.add(user)
    db.commit()
    db.refresh(user)
    
    # 如果上传了头像，先审核再保存
    if profile_pic:
        try:
            import io
            from utils.local_storage_utils import save_image

            image_bytes = profile_pic.file.read()
            is_safe, label = moderate_image(image_bytes)
            if not is_safe:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Profile image rejected by content moderation ({label})"
                )

            user.profile_pic = save_image(io.BytesIO(image_bytes), 'user', user.id, profile_pic.filename)
            db.commit()
            db.refresh(user)
        except HTTPException:
            raise
        except Exception:
            pass
    
    # 更新邀请码使用记录（仅在使用了邀请码时）
    if invitation:
        invitation.use_count += 1
        if invitation.use_count == 1:
            invitation.used_by = user.id
            invitation.used_at = datetime.now(UTC)
        db.commit()
    
    # 创建session token
    token = create_session_token(user)
    user_response = build_user_response(user, db)
    
    return {
        "message": "Registration successful",
        "token": token,
        "user": user_response
    }


# ==================== 密码重置相关端点 ====================

# 存储重置密码的验证码和token（生产环境应使用Redis）
reset_verification_codes = {}
reset_tokens = {}

@router.post("/api/send-reset-code-phone")
async def send_reset_code_phone(
    phone_number: str = Form(...),
    db: Session = Depends(get_db)
):
    """发送手机号密码重置验证码"""
    # 检查手机号是否已绑定账号
    user = db.query(User).filter(User.phone_number == phone_number).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="该手机号未绑定任何账号，请使用其他方式找回或联系管理员"
        )
    
    # 发送验证码
    result = await send_verification_code(phone_number)
    return result


@router.post("/api/verify-reset-code-phone")
def verify_reset_code_phone(
    phone_number: str = Form(...),
    code: str = Form(...),
    db: Session = Depends(get_db)
):
    """验证手机号密码重置验证码"""
    # 验证验证码
    if not verify_code(phone_number, code):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="验证码错误或已过期"
        )
    
    # 检查用户是否存在
    user = db.query(User).filter(User.phone_number == phone_number).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="该手机号未绑定任何账号"
        )
    
    # 生成重置token
    import secrets
    from datetime import datetime, timedelta
    reset_token = secrets.token_urlsafe(32)
    reset_tokens[reset_token] = {
        'user_id': user.id,
        'expires_at': datetime.now() + timedelta(minutes=10)
    }
    
    return {
        "success": True,
        "reset_token": reset_token
    }


@router.post("/api/send-reset-code-email")
def send_reset_code_email(
    email: str = Form(...),
    db: Session = Depends(get_db)
):
    """发送邮箱密码重置验证码"""
    # 检查邮箱是否已绑定账号
    user = db.query(User).filter(User.email == email).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="该邮箱未绑定任何账号，请使用其他方式找回或联系管理员"
        )
    
    # 生成6位数字验证码
    import secrets
    from datetime import datetime, timedelta
    code = ''.join([str(secrets.randbelow(10)) for _ in range(6)])
    
    # 存储验证码（60秒内不能重复发送）
    if email in reset_verification_codes:
        last_send = reset_verification_codes[email].get('sent_at')
        if last_send and (datetime.now() - last_send).total_seconds() < 60:
            return {
                "success": False,
                "message": "请求过于频繁，请60秒后再试"
            }
    
    reset_verification_codes[email] = {
        'code': code,
        'sent_at': datetime.now(),
        'expires_at': datetime.now() + timedelta(minutes=5)
    }
    
    # TODO: 实际发送邮件（需要配置邮件服务）
    # 开发环境直接返回验证码
    print(f"邮箱验证码: {code}")
    
    return {
        "success": True,
        "message": "验证码已发送到邮箱",
        "code": code  # 开发环境返回，生产环境删除
    }


@router.post("/api/verify-reset-code-email")
def verify_reset_code_email(
    email: str = Form(...),
    code: str = Form(...),
    db: Session = Depends(get_db)
):
    """验证邮箱密码重置验证码"""
    from datetime import datetime
    
    # 验证验证码
    if email not in reset_verification_codes:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="请先获取验证码"
        )
    
    stored = reset_verification_codes[email]
    if datetime.now() > stored['expires_at']:
        del reset_verification_codes[email]
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="验证码已过期"
        )
    
    if stored['code'] != code:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="验证码错误"
        )
    
    # 检查用户是否存在
    user = db.query(User).filter(User.email == email).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="该邮箱未绑定任何账号"
        )
    
    # 生成重置token
    import secrets
    from datetime import timedelta
    reset_token = secrets.token_urlsafe(32)
    reset_tokens[reset_token] = {
        'user_id': user.id,
        'expires_at': datetime.now() + timedelta(minutes=10)
    }
    
    # 删除已使用的验证码
    del reset_verification_codes[email]
    
    return {
        "success": True,
        "reset_token": reset_token
    }


@router.post("/api/reset-password-with-token")
def reset_password_with_token(
    reset_token: str = Form(...),
    new_password: str = Form(...),
    db: Session = Depends(get_db)
):
    """使用重置token重置密码"""
    from datetime import datetime
    
    # 验证token
    if reset_token not in reset_tokens:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="无效的重置令牌"
        )
    
    token_data = reset_tokens[reset_token]
    if datetime.now() > token_data['expires_at']:
        del reset_tokens[reset_token]
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="重置令牌已过期，请重新验证"
        )
    
    # 获取用户
    user = db.query(User).filter(User.id == token_data['user_id']).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="用户不存在"
        )
    
    # 更新密码
    hashed_password = pwd_context.hash(new_password)
    user.hashed_password = hashed_password
    db.commit()
    
    # 删除已使用的token
    del reset_tokens[reset_token]
    
    return {
        "success": True,
        "message": "密码重置成功"
    }
