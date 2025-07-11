from fastapi import APIRouter, Request, Depends, HTTPException, UploadFile, File, Form
from sqlalchemy.orm import Session
from datetime import datetime

from database import get_db
from models import User, Character
from utils.session import verify_session_token
from utils.cloudinary_utils import upload_avatar
from utils.validators import validate_account_fields

router = APIRouter()

@router.get("/api/user/{user_id}")
def get_user_by_id(user_id: int, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return {
        "id": user.id,
        "name": user.name,
        "profile_pic": user.profile_pic,
    }

@router.post("/api/update-profile")
async def update_profile(
    request: Request,
    name: str = Form(...),
    profile_pic: UploadFile = File(None),
    db: Session = Depends(get_db)
):
    token = request.cookies.get("session_token")
    user_id = verify_session_token(token)
    if not user_id:
        raise HTTPException(status_code=401, detail="Not logged in")

    user = db.query(User).get(user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    error = validate_account_fields(name=name)
    if error:
        raise HTTPException(status_code=400, detail=error)

    user.name = name

    if profile_pic:
        user.profile_pic = upload_avatar(profile_pic.file, user.id)

    db.commit()
    db.refresh(user)
    return {"message": "Profile updated"}

@router.get("/api/characters-created")
def get_user_created_characters(request: Request, user_id: int = None, db: Session = Depends(get_db)):
    if user_id is None:
        token = request.cookies.get("session_token")
        user_id = verify_session_token(token)
        if not user_id:
            raise HTTPException(status_code=401, detail="Not logged in")

    user = db.query(User).filter(User.id == user_id).first()
    if not user or not user.characters_created:
        return []

    characters = db.query(Character).filter(Character.id.in_(user.characters_created)).all()
    return [{"id": c.id, "name": c.name, "picture": c.picture, "likes":c.likes, "views": c.views} for c in characters]

@router.get("/api/characters-liked")
def get_user_liked_characters(request: Request, user_id: int = None, db: Session = Depends(get_db)):
    if user_id is None:
        token = request.cookies.get("session_token")
        user_id = verify_session_token(token)
        if not user_id:
            raise HTTPException(status_code=401, detail="Not logged in")

    user = db.query(User).filter(User.id == user_id).first()
    if not user or not user.liked_characters:
        return []

    characters = db.query(Character).filter(Character.id.in_(user.liked_characters)).all()
    return [{"id": c.id, "name": c.name, "picture": c.picture, "likes":c.likes, "views": c.views} for c in characters]

@router.get("/api/user/{user_id}/characters")
def get_user_characters(user_id: int, db: Session = Depends(get_db)):
    characters = db.query(Character).filter(Character.creator_id == user_id).all()
    return [{"id": c.id, "name": c.name, "picture": c.avatar_url} for c in characters]

@router.get("/api/recent-characters")
def get_recent_characters(request: Request, db: Session = Depends(get_db)):
    token = request.cookies.get("session_token")
    user_id = verify_session_token(token)
    if not user_id:
        return []

    user = db.query(User).filter(User.id == user_id).first()
    if not user or not user.recent_characters:
        return []

    recent = user.recent_characters
    char_ids = [entry["id"] for entry in recent]

    characters = db.query(Character).filter(Character.id.in_(char_ids)).all()
    char_map = {str(c.id): c for c in characters}

    return [
        {
            "id": entry["id"],
            "name": char_map.get(entry["id"], None).name if char_map.get(entry["id"]) else "Unknown",
            "picture": char_map.get(entry["id"], None).picture if char_map.get(entry["id"]) else None,
            "timestamp": entry["timestamp"],
        }
        for entry in recent if entry["id"] in char_map
    ]

@router.post("/api/recent-characters/update")
async def update_recent_characters(request: Request, db: Session = Depends(get_db)):
    token = request.cookies.get("session_token")
    user_id = verify_session_token(token)
    if not user_id:
        raise HTTPException(status_code=401, detail="Not logged in")

    data = await request.json()
    char_id = data.get("character_id")
    if not char_id:
        raise HTTPException(status_code=400, detail="Missing character_id")

    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    now_str = datetime.utcnow().isoformat()
    recent = user.recent_characters or []
    recent = [entry for entry in recent if entry.get("id") != char_id]
    recent.insert(0, {"id": char_id, "timestamp": now_str})
    user.recent_characters = recent[:10]

    db.commit()
    return {"status": "success"}
