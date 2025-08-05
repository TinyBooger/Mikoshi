from fastapi import APIRouter, Request, Depends, HTTPException, UploadFile, File, Form, Query
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
import firebase_admin
from firebase_admin import auth as firebase_auth
from sqlalchemy.orm import Session
from datetime import datetime, UTC

from database import get_db
from models import User, Character
from utils.session import verify_session_token, get_current_user
from utils.cloudinary_utils import upload_avatar
from utils.validators import validate_account_fields

router = APIRouter()
security = HTTPBearer()

@router.get("/api/user/{user_id}")
def get_user_by_id(user_id: str, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return {
        "id": user.id,
        "name": user.name,
        "profile_pic": user.profile_pic,
        "bio": getattr(user, "bio", None),
    }

# Add alias for plural endpoint for frontend compatibility
@router.get("/api/users/{user_id}")
def get_user_by_id_alias(user_id: str, db: Session = Depends(get_db)):
    # Just call the original function
    return get_user_by_id(user_id, db)

@router.post("/api/update-profile")
async def update_profile(
    name: str = Form(...),
    bio: str = Form(None),
    profile_pic: UploadFile = File(None),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    if not current_user:
        raise HTTPException(status_code=404, detail="User not found")
    
    error = validate_account_fields(name=name)
    if error:
        raise HTTPException(status_code=400, detail=error)

    current_user.name = name
    if bio is not None:
        current_user.bio = bio

    if profile_pic:
        current_user.profile_pic = upload_avatar(profile_pic.file, current_user.id)

    db.commit()
    db.refresh(current_user)
    return {"message": "Profile updated"}

@router.get("/api/characters-created")
def get_user_created_characters(
    userId: str = Query(None),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    If userId is provided, fetch that user's created characters (public).
    Otherwise, fetch current user's created characters.
    """
    if userId:
        user = db.query(User).filter(User.id == userId).first()
        if not user or not user.characters_created:
            return []
        characters = db.query(Character).filter(Character.id.in_(user.characters_created)).all()
    else:
        if not current_user or not current_user.characters_created:
            return []
        characters = db.query(Character).filter(Character.id.in_(current_user.characters_created)).all()
    return [{
        "id": c.id,
        "name": c.name,
        "picture": c.picture,
        "tagline": c.tagline,
        "likes": c.likes,
        "views": c.views,
        "creator": db.query(User).filter(User.id == c.creator_id).first().name if c.creator_id else None
    } for c in characters]

@router.get("/api/characters-liked")
def get_user_liked_characters(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    if not current_user or not current_user.liked_characters:
        return []

    characters = db.query(Character).filter(Character.id.in_(current_user.liked_characters)).all()
    return [{
        "id": c.id,
        "name": c.name,
        "picture": c.picture,
        "tagline": c.tagline,
        "likes": c.likes,
        "views": c.views,
        "creator": db.query(User).filter(User.id == c.creator_id).first().name if c.creator_id else None
    } for c in characters]

@router.get("/api/user/{user_id}/characters")
def get_user_characters(user_id: str, db: Session = Depends(get_db)):
    characters = db.query(Character).filter(Character.creator_id == user_id).all()
    return [{"id": c.id, "name": c.name, "picture": c.avatar_url} for c in characters]

@router.get("/api/recent-characters")
def get_recent_characters(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    
    if not current_user or not current_user.recent_characters:
        return []

    # Extract recent characters
    recent = current_user.recent_characters
    char_ids = [entry["id"] for entry in recent]

    # Fetch characters from database
    characters = db.query(Character).filter(Character.id.in_(char_ids)).all()
    char_map = {str(c.id): c for c in characters}

    # Return formatted response
    return [
        {
            "id": entry["id"],
            "name": char_map[entry["id"]].name if entry["id"] in char_map else "Unknown",
            "picture": char_map[entry["id"]].picture if entry["id"] in char_map else None,
            "timestamp": entry["timestamp"],
        }
        for entry in recent if entry["id"] in char_map
    ]

@router.post("/api/recent-characters/update")
async def update_recent_characters(request: Request, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    data = await request.json()
    char_id = data.get("character_id")
    if not char_id:
        raise HTTPException(status_code=400, detail="Missing character_id")

    if not current_user:
        raise HTTPException(status_code=404, detail="User not found")

    now_str = datetime.now(UTC).isoformat()
    recent = current_user.recent_characters or []
    recent = [entry for entry in recent if entry.get("id") != char_id]
    recent.insert(0, {"id": char_id, "timestamp": now_str})
    current_user.recent_characters = recent[:10]

    db.commit()
    return {"status": "success"}

