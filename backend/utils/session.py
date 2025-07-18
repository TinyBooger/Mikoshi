from fastapi import Request, Depends, HTTPException
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session
import firebase_admin
from firebase_admin import auth as firebase_auth

from database import get_db
from models import User

import os
from itsdangerous import URLSafeSerializer

security = HTTPBearer()

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

async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: Session = Depends(get_db)
):
    try:
        decoded_token = firebase_auth.verify_id_token(credentials.credentials)
        firebase_uid = decoded_token['uid']
        user = db.query(User).filter(User.id == firebase_uid).first()
        
        if not user:
            raise HTTPException(status_code=404, detail="User not found in database")
            
        return user
        
    except firebase_admin.exceptions.FirebaseError as e:
        raise HTTPException(
            status_code=401,
            detail=f"Invalid authentication credentials: {str(e)}"
        )

# def get_current_user(request: Request, db: Session = Depends(get_db)):
#     token = request.cookies.get("session_token")
#     user_id = verify_session_token(token)
#     if not user_id:
#         raise HTTPException(status_code=401, detail="Not logged in")
#     user = db.query(User).filter(User.id == user_id).first()
#     if not user:
#         raise HTTPException(status_code=404, detail="User not found")
#     return user