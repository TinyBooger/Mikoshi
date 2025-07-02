from fastapi import APIRouter, Request, Depends, HTTPException, UploadFile, File, Form
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session
from typing import List

from database import get_db
from models import Character, User
from utils.session import verify_session_token, get_current_user
from utils.cloudinary_utils import upload_character_picture

router = APIRouter()

@router.post("/api/create-character")
async def create_character(
    request: Request,
    name: str = Form(...),
    persona: str = Form(...),
    tagline: str = Form(""),
    tags: List[str] = Form([]),
    greeting: str = Form(""),
    sample_dialogue: str = Form(""),
    picture: UploadFile = File(None),
    db: Session = Depends(get_db)
):
    token = request.cookies.get("session_token")
    user_id = verify_session_token(token)
    if not user_id:
        raise HTTPException(status_code=401, detail="Unauthorized")

    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    existing = db.query(Character).filter(Character.name == name).first()
    if existing:
        return JSONResponse(content={"error": "Character already exists"}, status_code=400)

    char = Character(
        name=name,
        persona=persona,
        tagline=tagline.strip(),
        tags=tags,
        greeting=greeting.strip(),
        example_messages=sample_dialogue.strip(),
        creator_id=str(user_id),
        views=0,
        picture=None
    )
    db.add(char)
    db.commit()
    db.refresh(char)

    if picture:
        char.picture = upload_character_picture(picture.file, char.id, name)

    if user.characters_created is None:
        user.characters_created = []
    if char.id not in user.characters_created:
        user.characters_created = user.characters_created + [char.id]

    db.commit()
    db.refresh(user)
    return {"message": f"Character '{name}' created."}

@router.post("/api/update-character")
async def update_character(
    request: Request,
    id: int = Form(...),
    name: str = Form(...),
    persona: str = Form(...),
    tagline: str = Form(""),
    tags: List[str] = Form([]),
    greeting: str = Form(""),
    sample_dialogue: str = Form(""),
    picture: UploadFile = File(None),
    db: Session = Depends(get_db)
):
    token = request.cookies.get("session_token")
    user_id = verify_session_token(token)
    if not user_id:
        raise HTTPException(status_code=401, detail="Unauthorized")

    char = db.query(Character).filter(Character.id == id).first()
    if not char or str(char.creator_id) != str(user_id):
        raise HTTPException(status_code=403, detail="Not allowed")

    char.name = name
    char.persona = persona
    char.tagline = tagline.strip()
    char.tags = tags
    char.greeting = greeting.strip()
    char.example_messages = sample_dialogue.strip()

    if picture:
        char.picture = upload_character_picture(picture.file, char.id, name)

    db.commit()
    return {"message": "Character updated successfully"}

@router.get("/api/characters")
def get_characters(db: Session = Depends(get_db)):
    chars = db.query(Character).all()
    return {
        c.id: {
            "name": c.name,
            "persona": c.persona,
            "example_messages": c.example_messages,
            "creator_id": c.creator_id,
            "tagline": c.tagline,
            "tags": c.tags,
            "greeting": c.greeting
        } for c in chars
    }

@router.get("/api/characters/search")
def search_characters(q: str, db: Session = Depends(get_db)):
    chars = db.query(Character).filter(
        Character.name.ilike(f"%{q}%") | Character.persona.ilike(f"%{q}%")
    ).all()
    return [
        {
            "id": c.id,
            "name": c.name,
            "persona": c.persona,
            "picture": c.picture,
            "views": c.views,
        } for c in chars
    ]

@router.get("/api/character/{character_id}")
def get_character(character_id: int, db: Session = Depends(get_db)):
    c = db.query(Character).filter(Character.id == character_id).first()
    if not c:
        raise HTTPException(status_code=404, detail="Character not found")
    return {
        "id": c.id,
        "name": c.name,
        "persona": c.persona,
        "example_messages": c.example_messages,
        "creator_id": c.creator_id,
        "likes": c.likes,
        "views": c.views,
        "created_time": c.created_time,
        "picture": c.picture,
        "tagline": c.tagline,
        "tags": c.tags,
        "greeting": c.greeting
    }

@router.delete("/api/character/{character_id}/delete")
async def delete_character(character_id: int, request: Request, db: Session = Depends(get_db)):
    user = get_current_user(request, db)
    char = db.query(Character).filter(Character.id == character_id).first()
    if not char:
        raise HTTPException(status_code=404, detail="Character not found")
    if char.creator_id != user.id:
        print("creator id: ", char.creaetor_id)
        print("user id:", user.id)
        raise HTTPException(status_code=403, detail="Not authorized")

    # Remove from user's characters_created list
    if character_id in user.characters_created:
        user.characters_created.remove(character_id)

    db.delete(char)
    db.commit()
    return {"message": "Character deleted successfully"}

@router.post("/api/character/{character_id}/like")
def like_character(request: Request, character_id: int, db: Session = Depends(get_db)):
    get_current_user(request, db)
    char = db.query(Character).filter(Character.id == character_id).first()
    if not char:
        raise HTTPException(status_code=404, detail="Character not found")

    char.likes += 1
    db.commit()
    return {"likes": char.likes}

@router.get("/api/characters/popular")
def get_popular_characters(db: Session = Depends(get_db)):
    chars = db.query(Character).order_by(Character.views.desc()).limit(10).all()
    return [
        {
            "id": c.id,
            "name": c.name,
            "persona": c.persona,
            "picture": c.picture,
            "views": c.views,
            "likes": c.likes,
            "tagline": c.tagline
        } for c in chars
    ]

@router.post("/api/views/increment")
def increment_views(request: Request, payload: dict, db: Session = Depends(get_db)):
    get_current_user(request, db)
    character_id = payload.get("character_id")

    if character_id:
        char = db.query(Character).filter(Character.id == character_id).first()
        if char:
            char.views = (char.views or 0) + 1
            creator = db.query(User).filter(User.id == char.creator_id).first()
            if creator:
                creator.views = (creator.views or 0) + 1

    db.commit()
    return {"message": "views updated"}
