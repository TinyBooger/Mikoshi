from fastapi import APIRouter, Form, HTTPException, Depends, Request, UploadFile, File, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from fastapi.responses import JSONResponse
import firebase_admin
from firebase_admin import auth as firebase_auth
from sqlalchemy.orm import Session
from passlib.context import CryptContext

from database import get_db
from models import User
from schemas import UserLogin
from utils.session import create_session_token, verify_session_token
from utils.cloudinary_utils import upload_avatar
from utils.validators import validate_account_fields

router = APIRouter()
security = HTTPBearer()

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

@router.get("/api/users/me")
async def get_current_user(
    db: Session = Depends(get_db),
    credentials: HTTPAuthorizationCredentials = Depends(security)
):
    try:
        # Verify Firebase ID token
        decoded_token = firebase_auth.verify_id_token(credentials.credentials)
        firebase_uid = decoded_token['uid']
        
        # Get user from database
        user = db.query(User).filter(User.id == firebase_uid).first()
        if not user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="User not found in database"
            )
        
        # Return user data (excluding sensitive fields if needed)
        return {
            "id": user.id,
            "email": user.email,
            "name": user.name,
            "profile_pic": user.profile_pic,
            "characters_created": user.characters_created,
            "liked_characters": user.liked_characters,
            "liked_tags": user.liked_tags,
            "chat_history": user.chat_history,
            "personas": user.personas,
            "views": user.views,
            "likes": user.likes,
        }
        
    except firebase_admin.exceptions.FirebaseError as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authentication credentials"
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )

@router.post("/api/users")
async def create_user(
    user_data: dict,
    db: Session = Depends(get_db),
    credentials: HTTPAuthorizationCredentials = Depends(security)
):
    try:
        # Verify Firebase ID token
        decoded_token = firebase_auth.verify_id_token(credentials.credentials)
        firebase_uid = decoded_token['uid']
        
        # Check if email matches the authenticated user
        if user_data.get('email') != decoded_token.get('email'):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Email doesn't match authenticated user"
            )
        
        # Check if user already exists in our database
        existing_user = db.query(User).filter(User.id == firebase_uid).first()
        if existing_user:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="User already exists"
            )
        
        # Create new user record
        db_user = User(
            id=firebase_uid,
            email=user_data['email'],
            name=user_data.get('name', ''),
        )
        
        db.add(db_user)
        db.commit()
        
        return {
            "message": "User created successfully",
            "user_id": firebase_uid
        }
        
    except firebase_admin.exceptions.FirebaseError as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authentication credentials"
        )
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )

@router.post("/api/login")
async def login(user: UserLogin, db: Session = Depends(get_db)):
    db_user = db.query(User).filter(User.email == user.email).first()
    if not db_user or not pwd_context.verify(user.password, db_user.hashed_password):
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

# @router.post("/api/account-setup")
# async def account_setup(
#     email: str = Form(...),
#     password: str = Form(...),
#     name: str = Form(...),
#     profile_pic: UploadFile = File(None),
#     db: Session = Depends(get_db)
# ):
#     if db.query(User).filter(User.email == email).first():
#         raise HTTPException(status_code=400, detail="Email already registered")
    
#     error = validate_account_fields(email=email, password=password, name=name)
#     if error:
#         raise HTTPException(status_code=400, detail=error)


#     hashed = pwd_context.hash(password)
#     db_user = User(email=email, hashed_password=hashed, name=name)
#     db.add(db_user)
#     db.commit()
#     db.refresh(db_user)

#     if profile_pic:
#         db_user.profile_pic = upload_avatar(profile_pic.file, db_user.id)
#         db.commit()

#     return {"message": "Account created successfully"}

# @router.get("/api/current-user")
# def get_current_user_info(request: Request, db: Session = Depends(get_db)):
#     token = request.cookies.get("session_token")
#     user_id = verify_session_token(token)
#     if not user_id:
#         raise HTTPException(status_code=401, detail="Not logged in")

#     user = db.query(User).filter(User.id == user_id).first()
#     return {
#         "id": user.id,
#         "name": user.name,
#         "profile_pic": user.profile_pic,
#         "liked_characters": user.liked_characters,
#         "chat_history": user.chat_history,
#         "personas": user.personas,
#         "views": user.views,
#         "likes": user.likes,
#     }
