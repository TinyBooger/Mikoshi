from fastapi import APIRouter, Form, HTTPException, Depends, status, Request, UploadFile, File
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session
from passlib.context import CryptContext
from database import get_db
from models import User
from schemas import UserOut, AuthUserOut, VerifyPhoneOut
from utils.session import create_session_token, verify_session_token
from utils.user_utils import build_user_response, check_and_expire_pro
from utils.validators import validate_account_fields
from utils.sms_utils import send_verification_code, verify_code, create_verified_phone_token, verify_phone_token
from utils.captcha_utils import verify_captcha_param, get_captcha_verifier
from utils.audit_logger import record_audit
from utils.request_utils import get_client_ip, get_user_agent, get_request_metadata, get_device_fingerprint, update_tracking_array
from utils.image_moderation import moderate_image_with_decision
from utils.text_moderation import moderate_form_payload_with_review
from utils.invitation_utils import generate_invitation_code, process_invitation_code, track_invitation
import re
from typing import Optional

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
        "verify_result": true,
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
            "verify_result": result.get("verify_result"),
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
    # Proceed with user registration
    if db.query(User).filter(User.email == email).first():
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Email already registered")

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
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=error)
    hashed_password = pwd_context.hash(password)
    client_ip = get_client_ip(request)
    fingerprint = get_device_fingerprint(request)
    user = User(
        id=email,  # Use email as unique ID for simplicity
        email=email,
        name=name,
        bio=bio,
        profile_pic=None,
        invitation_code=generate_invitation_code(db),
        last_known_ips=update_tracking_array([], client_ip),
        device_fingerprints=update_tracking_array([], fingerprint),
    )
    # Store hashed password in a separate field if you add it to User model
    setattr(user, "hashed_password", hashed_password)
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

    # If an image was uploaded, moderate then save it
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
    # Update tracking arrays
    client_ip = get_client_ip(request)
    fingerprint = get_device_fingerprint(request)
    user.last_known_ips = update_tracking_array(list(user.last_known_ips or []), client_ip)
    user.device_fingerprints = update_tracking_array(list(user.device_fingerprints or []), fingerprint)
    db.commit()
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

