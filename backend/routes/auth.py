from fastapi import APIRouter, Form, HTTPException, Depends, status, Request, UploadFile, File
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session
from passlib.context import CryptContext
from database import get_db
from models import User
from schemas import UserOut
from utils.session import create_session_token, verify_session_token
from utils.user_utils import build_user_response
from utils.validators import validate_account_fields
from utils.sms_utils import send_verification_code, verify_code, create_verified_phone_token, verify_phone_token
import re

router = APIRouter()
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


# Simple session token-based authentication
from fastapi import Header

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
    
    return build_user_response(user, db)


# Registration endpoint
@router.post("/api/users")
def register_user(
    email: str = Form(...),
    name: str = Form(...),
    password: str = Form(...),
    invitation_code: str = Form(...),
    bio: str = Form(None),
    profile_pic: UploadFile = File(None),
    db: Session = Depends(get_db)
):
    # Validate invitation code first
    from models import InvitationCode
    from datetime import datetime, UTC
    
    invitation = db.query(InvitationCode).filter(
        InvitationCode.code == invitation_code.upper()
    ).first()
    
    if not invitation:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid invitation code")
    
    if not invitation.is_active:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="This invitation code has been revoked")
    
    if invitation.use_count >= invitation.max_uses:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="This invitation code has reached its usage limit")
    
    print(f"expires_at type: {type(invitation.expires_at)}")
    print(f"expires_at tzinfo: {invitation.expires_at.tzinfo}")
    print(f"expires_at value: {invitation.expires_at}")
    print(f"now(UTC) type: {type(datetime.now(UTC))}")
    
    if invitation.expires_at and datetime.now(UTC) > invitation.expires_at:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="This invitation code has expired")
    
    # Proceed with user registration
    if db.query(User).filter(User.email == email).first():
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Email already registered")
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
    
    # Mark invitation code as used
    invitation.use_count += 1
    if invitation.use_count == 1:  # First use
        invitation.used_by = user.id
        invitation.used_at = datetime.now(UTC)
    db.commit()
    
    # If an image was uploaded, save it and update the user record
    if profile_pic:
        try:
            from utils.local_storage_utils import save_image
            # Need to refresh user to ensure id exists (id is email here)
            user.profile_pic = save_image(profile_pic.file, 'user', user.id, profile_pic.filename)
            db.commit()
            db.refresh(user)
        except Exception:
            # Non-fatal: registration succeeded but image saving failed
            pass
    token = create_session_token(user)
    user_response = build_user_response(user, db)
    return {"message": "User registered successfully", "token": token, "user": user_response}

# Login endpoint
@router.post("/api/login")
def login_user(
    email: str = Form(...),
    password: str = Form(...),
    db: Session = Depends(get_db)
):
    # Accept either email or phone number in the same field
    account = email.strip()
    user = None
    if '@' in account:
        user = db.query(User).filter(User.email == account).first()
    else:
        # treat as phone number
        user = db.query(User).filter(User.phone_number == account).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid email or password")
    hashed_password = getattr(user, "hashed_password", None)
    if not hashed_password or not pwd_context.verify(password, hashed_password):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid email or password")
    token = create_session_token(user)
    user_response = build_user_response(user, db)
    return {"message": "Login successful", "token": token, "user": user_response}

# Password reset endpoint
@router.post("/api/reset-password")
def reset_password(
    email: str = Form(...),
    new_password: str = Form(...),
    db: Session = Depends(get_db)
):
    user = db.query(User).filter(User.email == email).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    # If user has no hashed_password, allow reset (legacy Firebase user)
    # Or allow reset for any user (with proper frontend flow)
    hashed_password = pwd_context.hash(new_password)
    setattr(user, "hashed_password", hashed_password)
    db.commit()
    return {"message": "Password reset successful"}


# Change password for current user (requires Authorization header)
@router.post("/api/change-password")
def change_password(payload: dict = None, db: Session = Depends(get_db), session_token: str = Header(None, alias="Authorization")):
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
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Current password incorrect")
    user.hashed_password = pwd_context.hash(newPassword)
    db.commit()
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
@router.post("/api/verify-phone")
def verify_phone(
    phone_number: str = Form(...),
    verification_code: str = Form(...),
    db: Session = Depends(get_db)
):
    """
    验证手机号验证码
    - 如果手机号已存在，直接登录返回session token
    - 如果手机号不存在，返回verified_phone_token用于注册
    """
    # 验证验证码
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
@router.post("/api/register-with-phone")
def register_with_phone(
    verified_phone_token: str = Form(...),
    name: str = Form(...),
    invitation_code: str = Form(...),
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
    
    # 验证邀请码
    from models import InvitationCode
    from datetime import datetime, UTC
    
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
    
    # 如果上传了头像，保存它
    if profile_pic:
        try:
            from utils.local_storage_utils import save_image
            user.profile_pic = save_image(profile_pic.file, 'user', user.id, profile_pic.filename)
            db.commit()
            db.refresh(user)
        except Exception:
            pass
    
    # 更新邀请码使用记录
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


