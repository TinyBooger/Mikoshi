from fastapi import APIRouter, Form, HTTPException, Depends, Request, UploadFile, File, Header
from fastapi.responses import JSONResponse
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session
import firebase_admin
from firebase_admin import auth as firebase_auth
from firebase_admin import credentials
from typing import Optional
import logging
import os

from database import get_db
from models import User
from schemas import UserLogin
from utils.cloudinary_utils import upload_avatar
from utils.validators import validate_account_fields

router = APIRouter()
security = HTTPBearer()

# Initialize Firebase Admin SDK (should be done only once)
try:
    firebase_admin.get_app()
except ValueError:
    cred = credentials.Certificate("/etc/secrets/mikoshi-135c9-firebase-adminsdk-fbsvc-bdf3c22105.json")
    firebase_admin.initialize_app(cred)

async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: Session = Depends(get_db)
) -> User:
    """Verify Firebase ID token and return corresponding user from database"""
    try:
        id_token = credentials.credentials
        decoded_token = firebase_auth.verify_id_token(id_token)
        firebase_uid = decoded_token['uid']
        
        # Find user in database by firebase_uid
        db_user = db.query(User).filter(User.firebase_uid == firebase_uid).first()
        if not db_user:
            raise HTTPException(status_code=404, detail="User not found in database")
            
        return db_user
        
    except Exception as e:
        raise HTTPException(status_code=401, detail=f"Invalid authentication: {str(e)}")
    except firebase_auth.InvalidIdTokenError as e:
        logging.error(f"Invalid token: {str(e)}")
        raise HTTPException(status_code=401, detail="Invalid authentication token")
    except firebase_auth.ExpiredIdTokenError as e:
        logging.error(f"Expired token: {str(e)}")
        raise HTTPException(status_code=401, detail="Authentication token expired")
    except Exception as e:
        logging.error(f"Authentication error: {str(e)}")
        raise HTTPException(status_code=401, detail="Authentication failed")
    
@router.get("/api/config/firebase")
async def get_firebase_config():
    return {
        "apiKey": os.getenv("FIREBASE_API_KEY"),
        "authDomain": os.getenv("FIREBASE_AUTH_DOMAIN"),
        "projectId": os.getenv("FIREBASE_PROJECT_ID"),
        "storageBucket": os.getenv("FIREBASE_STORAGE_BUCKET"),
        "messagingSenderId": os.getenv("FIREBASE_MESSAGING_SENDER_ID"),
        "appId": os.getenv("FIREBASE_APP_ID"),
        "measurementId": os.getenv("FIREBASE_MEASUREMENT_ID")
    }

@router.post("/api/login")
async def login(user: UserLogin):
    """This endpoint is now just for compatibility - actual auth happens client-side with Firebase"""
    return JSONResponse(
        content={"message": "Please use Firebase client-side authentication"},
        status_code=200
    )

@router.post("/api/logout")
async def logout():
    """This endpoint is now just for compatibility - logout happens client-side with Firebase"""
    return JSONResponse(content={"message": "Please use Firebase client-side logout"})

@router.post("/api/account-setup")
async def account_setup(
    firebase_uid: str = Form(...),
    email: str = Form(...),
    name: str = Form(...),
    profile_pic: UploadFile = File(None),
    db: Session = Depends(get_db)
):
    """Create a new user in our database after Firebase auth is complete"""
    # Check if user already exists
    if db.query(User).filter(User.email == email).first():
        raise HTTPException(status_code=400, detail="Email already registered")
    
    if db.query(User).filter(User.firebase_uid == firebase_uid).first():
        raise HTTPException(status_code=400, detail="User already registered")

    # Validate fields (excluding password since Firebase handles that)
    error = validate_account_fields(email=email, name=name, skip_password=True)
    if error:
        raise HTTPException(status_code=400, detail=error)

    # Create user in our database
    db_user = User(
        firebase_uid=firebase_uid,
        email=email,
        name=name,
        hashed_password=None  # We don't store passwords anymore
    )
    
    db.add(db_user)
    db.commit()
    db.refresh(db_user)

    # Handle profile picture upload if provided
    if profile_pic:
        db_user.profile_pic = upload_avatar(profile_pic.file, db_user.id)
        db.commit()

    return {
        "message": "Account created successfully",
        "user": {
            "id": db_user.id,
            "name": db_user.name,
            "email": db_user.email,
            "profile_pic": db_user.profile_pic
        }
    }

@router.get("/api/current-user")
async def get_current_user_info(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get current user info from our database"""
    return {
        "id": user.id,
        "name": user.name,
        "email": user.email,
        "profile_pic": user.profile_pic,
        "liked_characters": user.liked_characters,
        "chat_history": user.chat_history,
        "personas": user.personas,
        "views": user.views,
        "likes": user.likes,
    }

@router.post("/api/verify-firebase-token")
async def verify_firebase_token(
    user: User = Depends(get_current_user)
):
    """Endpoint for client to verify token and get user data"""
    return {
        "message": "Token verified",
        "user": {
            "id": user.id,
            "name": user.name,
            "email": user.email,
            "profile_pic": user.profile_pic
        }
    }