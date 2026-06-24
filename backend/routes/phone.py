"""
Phone-based authentication routes — SMS verification, phone login,
and phone registration.
"""
from fastapi import APIRouter, Form, HTTPException, Depends, status, Request, UploadFile, File
from sqlalchemy.orm import Session
from passlib.context import CryptContext
from database import get_db
from models import User
from schemas import AuthUserOut, VerifyPhoneOut
from utils.session import create_session_token
from utils.user_utils import build_user_response
from utils.validators import validate_account_fields
from utils.sms_utils import send_verification_code, verify_code, create_verified_phone_token, verify_phone_token
from utils.captcha_utils import verify_captcha_param
from utils.request_utils import get_client_ip, get_device_fingerprint, update_tracking_array
from utils.image_moderation import moderate_image_with_decision
from utils.text_moderation import moderate_form_payload_with_review
from utils.invitation_utils import generate_invitation_code, process_invitation_code, track_invitation
import re
from typing import Optional

router = APIRouter()
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


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
    request: Request,
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
    
    # 创建新用户
    user_id = f"phone_{phone_number}"

    # Validate invitation code (optional referral) — must happen here
    # so we can validate before creating the user, but bonus grant
    # is deferred until after the user is committed.
    if invitation_code and invitation_code.strip():
        code = invitation_code.strip().upper()
        # Only check existence & self-use; defer full processing
        inviter = db.query(User).filter(User.invitation_code == code).first()
        if not inviter:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid invitation code"
            )
        if inviter.id == user_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Cannot use your own invitation code"
            )

    text_safe, _, blocked_field, blocked_label, _, _ = moderate_form_payload_with_review({
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

    # Hash password if provided
    hashed_pw = ""
    if password and password.strip():
        hashed_pw = pwd_context.hash(password.strip())
    
    client_ip = get_client_ip(request)
    fingerprint = get_device_fingerprint(request)
    user = User(
        id=user_id,
        phone_number=phone_number,
        name=name,
        email=email.strip() if email and email.strip() else None,
        bio=bio,
        hashed_password=hashed_pw,
        profile_pic=None,
        invitation_code=generate_invitation_code(db),
        last_known_ips=update_tracking_array([], client_ip),
        device_fingerprints=update_tracking_array([], fingerprint),
    )
    
    db.add(user)
    db.commit()
    db.refresh(user)
    
    # Validate & grant invitation bonus, then track who invited this user
    if invitation_code and invitation_code.strip():
        is_valid, err = process_invitation_code(db, invitation_code, user.id)
        if not is_valid:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=err or "Invalid invitation code")
        track_invitation(db, invitation_code, user)
        db.commit()
    
    # 如果上传了头像，先审核再保存
    if profile_pic:
        try:
            import io
            from utils.local_storage_utils import save_image

            image_bytes = profile_pic.file.read()
            is_safe, label, _ = moderate_image_with_decision(image_bytes)
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
    
    # 创建session token
    token = create_session_token(user)
    user_response = build_user_response(user, db)
    
    return {
        "message": "Registration successful",
        "token": token,
        "user": user_response
    }
