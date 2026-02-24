
from fastapi import Request, Depends, HTTPException, Header
from sqlalchemy.orm import Session
from database import get_db
from models import User
from utils.user_utils import check_and_expire_pro
import os
from itsdangerous import URLSafeSerializer

SECRET_KEY = os.getenv("SECRET_KEY")
serializer = URLSafeSerializer(SECRET_KEY)

def create_session_token(user):
    return serializer.dumps({"user_id": user.id})

def verify_session_token(token):
    try:
        data = serializer.loads(token)
        return data["user_id"]
    except Exception:
        return None


def get_current_user(
    db: Session = Depends(get_db),
    session_token: str = Header(None, alias="Authorization")
):
    user_id = verify_session_token(session_token)
    if not user_id:
        raise HTTPException(status_code=401, detail="Invalid or missing session token")
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    user = check_and_expire_pro(user, db)
    return user


def get_current_admin_user(
    current_user: User = Depends(get_current_user)
):
    """Verify that the current user has admin privileges"""
    if not current_user.is_admin:
        raise HTTPException(
            status_code=403, 
            detail="Access forbidden: Admin privileges required"
        )
    return current_user

# def get_current_user(request: Request, db: Session = Depends(get_db)):
#     token = request.cookies.get("session_token")
#     user_id = verify_session_token(token)
#     if not user_id:
#         raise HTTPException(status_code=401, detail="Not logged in")
#     user = db.query(User).filter(User.id == user_id).first()
#     if not user:
#         raise HTTPException(status_code=404, detail="User not found")
#     return user