from fastapi import APIRouter, Form, HTTPException, Depends, Request, UploadFile, File
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session
from passlib.context import CryptContext

from database import get_db
from models import User
from utils.session import create_session_token, verify_session_token
from utils.cloudinary_utils import upload_avatar

router = APIRouter()
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

@router.post("/api/login")
async def login(user_email: str = Form(...), user_password: str = Form(...), db: Session = Depends(get_db)):
    db_user = db.query(User).filter(User.email == user_email).first()
    if not db_user or not pwd_context.verify(user_password, db_user.hashed_password):
        raise HTTPException(status_code=401, detail="Invalid credentials")

    response = JSONResponse(content={"message": "Login successful"})
    response.set_cookie(
        key="session_token",
        value=create_session_token(db_user),
        httponly=True,
        secure=True,
        samesite="None"
    )
    return response

@router.post("/api/logout")
def logout():
    response = JSONResponse(content={"message": "Logged out"})
    response.delete_cookie("session_token")
    return response

@router.post("/api/account-setup")
async def account_setup(
    email: str = Form(...),
    password: str = Form(...),
    name: str = Form(...),
    profile_pic: UploadFile = File(None),
    db: Session = Depends(get_db)
):
    if db.query(User).filter(User.email == email).first():
        raise HTTPException(status_code=400, detail="Email already registered")

    hashed = pwd_context.hash(password)
    db_user = User(email=email, hashed_password=hashed, name=name)
    db.add(db_user)
    db.commit()
    db.refresh(db_user)

    if profile_pic:
        db_user.profile_pic = upload_avatar(profile_pic.file, db_user.id)
        db.commit()

    return {"message": "Account created successfully"}

@router.get("/api/current-user")
def get_current_user_info(request: Request, db: Session = Depends(get_db)):
    token = request.cookies.get("session_token")
    user_id = verify_session_token(token)
    if not user_id:
        raise HTTPException(status_code=401, detail="Not logged in")

    user = db.query(User).filter(User.id == user_id).first()
    return {
        "id": user.id,
        "name": user.name,
        "profile_pic": user.profile_pic
    }
