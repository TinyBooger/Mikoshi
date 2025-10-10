from fastapi import APIRouter, Form, HTTPException, Depends, status, Request
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session
from passlib.context import CryptContext
from database import get_db
from models import User
from schemas import UserOut
from utils.session import create_session_token, verify_session_token
from utils.validators import validate_account_fields

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
    return user


# Registration endpoint
@router.post("/api/users")
def register_user(
    email: str = Form(...),
    name: str = Form(...),
    password: str = Form(...),
    bio: str = Form(None),
    db: Session = Depends(get_db)
):
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
    token = create_session_token(user)
    return {"message": "User registered successfully", "token": token, "user": user}

# Login endpoint
@router.post("/api/login")
def login_user(
    email: str = Form(...),
    password: str = Form(...),
    db: Session = Depends(get_db)
):
    user = db.query(User).filter(User.email == email).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid email or password")
    hashed_password = getattr(user, "hashed_password", None)
    if not hashed_password or not pwd_context.verify(password, hashed_password):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid email or password")
    token = create_session_token(user)
    return {"message": "Login successful", "token": token, "user": user}

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
