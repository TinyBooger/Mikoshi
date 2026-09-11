"""
Password management routes — reset, change, and token-based recovery
via phone SMS or email verification codes.
"""
from fastapi import APIRouter, Form, HTTPException, Depends, status, Request, Header
from sqlalchemy.orm import Session
from passlib.context import CryptContext
from database import get_db
from models import User
from utils.session import verify_session_token
from utils.sms_utils import send_verification_code, verify_code
from utils.audit_logger import record_audit, audit_request
from utils.request_utils import get_client_ip, get_user_agent, get_request_metadata

router = APIRouter()
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


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


# ==================== 密码重置相关端点 ====================

# 存储重置密码的验证码和token（生产环境应使用Redis）
reset_verification_codes = {}
reset_tokens = {}

@router.post("/api/send-reset-code-phone")
async def send_reset_code_phone(
    request: Request,
    phone_number: str = Form(...),
    db: Session = Depends(get_db)
):
    """发送手机号密码重置验证码"""
    # 检查手机号是否已绑定账号
    user = db.query(User).filter(User.phone_number == phone_number).first()
    if not user:
        audit_request(
            request,
            action="reset_code_requested",
            status="failure",
            error_message="Phone not bound to any account",
            metadata={"channel": "phone", "phone_last4": phone_number[-4:]},
        )
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="该手机号未绑定任何账号，请使用其他方式找回或联系管理员"
        )
    
    # 发送验证码
    result = await send_verification_code(phone_number)
    audit_request(
        request,
        action="reset_code_requested",
        user_id=user.id,
        metadata={"channel": "phone", "phone_last4": phone_number[-4:]},
    )
    return result


@router.post("/api/verify-reset-code-phone")
def verify_reset_code_phone(
    request: Request,
    phone_number: str = Form(...),
    code: str = Form(...),
    db: Session = Depends(get_db)
):
    """验证手机号密码重置验证码"""
    # 验证验证码
    if not verify_code(phone_number, code):
        audit_request(
            request,
            action="reset_code_verify_failed",
            status="failure",
            error_message="Invalid or expired code",
            metadata={"channel": "phone", "phone_last4": phone_number[-4:]},
        )
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="验证码错误或已过期"
        )
    
    # 检查用户是否存在
    user = db.query(User).filter(User.phone_number == phone_number).first()
    if not user:
        audit_request(
            request,
            action="reset_code_verify_failed",
            status="failure",
            error_message="Phone not bound to any account",
            metadata={"channel": "phone", "phone_last4": phone_number[-4:]},
        )
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
    
    audit_request(
        request,
        action="reset_code_verified",
        user_id=user.id,
        metadata={"channel": "phone"},
    )
    
    return {
        "success": True,
        "reset_token": reset_token
    }


@router.post("/api/send-reset-code-email")
def send_reset_code_email(
    request: Request,
    email: str = Form(...),
    db: Session = Depends(get_db)
):
    """发送邮箱密码重置验证码"""
    # 检查邮箱是否已绑定账号
    user = db.query(User).filter(User.email == email).first()
    if not user:
        audit_request(
            request,
            action="reset_code_requested",
            status="failure",
            error_message="Email not bound to any account",
            metadata={"channel": "email", "email": email},
        )
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
            audit_request(
                request,
                action="reset_code_requested",
                user_id=user.id,
                status="failure",
                error_message="Rate limited (60s cooldown)",
                metadata={"channel": "email", "email": email},
            )
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
    
    audit_request(
        request,
        action="reset_code_requested",
        user_id=user.id,
        metadata={"channel": "email", "email": email},
    )
    
    return {
        "success": True,
        "message": "验证码已发送到邮箱",
        "code": code  # 开发环境返回，生产环境删除
    }


@router.post("/api/verify-reset-code-email")
def verify_reset_code_email(
    request: Request,
    email: str = Form(...),
    code: str = Form(...),
    db: Session = Depends(get_db)
):
    """验证邮箱密码重置验证码"""
    from datetime import datetime
    
    # 验证验证码
    if email not in reset_verification_codes:
        audit_request(
            request,
            action="reset_code_verify_failed",
            status="failure",
            error_message="No code requested",
            metadata={"channel": "email", "email": email},
        )
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="请先获取验证码"
        )
    
    stored = reset_verification_codes[email]
    if datetime.now() > stored['expires_at']:
        del reset_verification_codes[email]
        audit_request(
            request,
            action="reset_code_verify_failed",
            status="failure",
            error_message="Code expired",
            metadata={"channel": "email", "email": email},
        )
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="验证码已过期"
        )
    
    if stored['code'] != code:
        audit_request(
            request,
            action="reset_code_verify_failed",
            status="failure",
            error_message="Invalid code",
            metadata={"channel": "email", "email": email},
        )
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="验证码错误"
        )
    
    # 检查用户是否存在
    user = db.query(User).filter(User.email == email).first()
    if not user:
        audit_request(
            request,
            action="reset_code_verify_failed",
            status="failure",
            error_message="Email not bound to any account",
            metadata={"channel": "email", "email": email},
        )
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
    
    audit_request(
        request,
        action="reset_code_verified",
        user_id=user.id,
        metadata={"channel": "email"},
    )
    
    return {
        "success": True,
        "reset_token": reset_token
    }


@router.post("/api/reset-password-with-token")
def reset_password_with_token(
    request: Request,
    reset_token: str = Form(...),
    new_password: str = Form(...),
    db: Session = Depends(get_db)
):
    """使用重置token重置密码"""
    from datetime import datetime
    
    # 验证token
    if reset_token not in reset_tokens:
        audit_request(
            request,
            action="reset_password_failed",
            status="failure",
            error_message="Invalid reset token",
            metadata={"reset_method": "token"},
        )
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="无效的重置令牌"
        )
    
    token_data = reset_tokens[reset_token]
    if datetime.now() > token_data['expires_at']:
        del reset_tokens[reset_token]
        audit_request(
            request,
            action="reset_password_failed",
            user_id=token_data.get('user_id'),
            status="failure",
            error_message="Expired reset token",
            metadata={"reset_method": "token"},
        )
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="重置令牌已过期，请重新验证"
        )
    
    # 获取用户
    user = db.query(User).filter(User.id == token_data['user_id']).first()
    if not user:
        audit_request(
            request,
            action="reset_password_failed",
            user_id=token_data.get('user_id'),
            status="failure",
            error_message="User not found",
            metadata={"reset_method": "token"},
        )
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

    audit_request(
        request,
        action="reset_password",
        user_id=user.id,
        metadata={"reset_method": "token"},
    )
    
    return {
        "success": True,
        "message": "密码重置成功"
    }
