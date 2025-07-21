from fastapi import APIRouter, Request, Depends, HTTPException, UploadFile, File, Form
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session
from sqlalchemy.dialects.postgresql import array, TEXT
from typing import List

from database import get_db
from models import Character, User, Tag
from utils.session import verify_session_token, get_current_user
from utils.cloudinary_utils import upload_character_picture
from utils.validators import validate_character_fields

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
    
    error = validate_character_fields(name, persona, tagline, greeting, sample_dialogue, tags)
    if error:
        raise HTTPException(status_code=400, detail=error)

    for tag_name in tags:  # update tags
        tag = db.query(Tag).filter(Tag.name == tag_name).first()
        if tag:
            tag.count += 1
        else:
            db.add(Tag(name=tag_name, count=1))

    char = Character(
        name=name,
        persona=persona,
        tagline=tagline.strip(),
        tags=tags,
        greeting=greeting.strip(),
        example_messages=sample_dialogue.strip(),
        creator_id=user_id,
        views=0,
        picture=None
    )
    db.add(char)
    db.commit()
    db.refresh(char)

    if picture:
        char.picture = upload_character_picture(picture.file, char.id)

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
    if not char or char.creator_id != user_id:
        raise HTTPException(status_code=403, detail="Not allowed")
    
    error = validate_character_fields(name, persona, tagline, greeting, sample_dialogue, tags)
    if error:
        raise HTTPException(status_code=400, detail=error)

    char.name = name
    char.persona = persona
    char.tagline = tagline.strip()
    char.tags = tags
    char.greeting = greeting.strip()
    char.example_messages = sample_dialogue.strip()

    if picture:
        char.picture = upload_character_picture(picture.file, char.id)

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
async def delete_character(
    character_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
    ):
    char = db.query(Character).filter(Character.id == character_id).first()
    if not char:
        raise HTTPException(status_code=404, detail="Character not found")
    if char.creator_id != current_user.id:
        print("creator id:", char.creator_id)
        print("user id:", current_user.id)
        raise HTTPException(status_code=403, detail="Not authorized")

    # Remove from user's characters_created list
    if character_id in current_user.characters_created:
        current_user.characters_created.remove(character_id)

    db.delete(char)
    db.commit()
    return {"message": "Character deleted successfully"}

@router.post("/api/character/{character_id}/like")
def like_character(
    character_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
    ):
    char = db.query(Character).filter(Character.id == character_id).first()
    if not char:
        raise HTTPException(status_code=404, detail="Character not found")
    
    # Get the creator of the character
    creator = db.query(User).filter(User.id == char.creator_id).first()
    if not creator:
        raise HTTPException(status_code=404, detail="Character creator not found")

    # Update character like count
    char.likes += 1

    # Update creator's total likes count
    creator.likes = (creator.likes or 0) + 1

    # Update user's liked characters
    if character_id not in current_user.liked_characters:
        current_user.liked_characters = current_user.liked_characters + [character_id]

    # Update user's liked tags
    for tag in char.tags or []:
        # Increment the likes count for each tag
        db_tag = db.query(Tag).filter(Tag.name == tag).first()
        if db_tag:
            db_tag.likes += 1
            
        if tag not in current_user.liked_tags:
            current_user.liked_tags = current_user.liked_tags + [tag]

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

@router.get("/api/characters/recommended")
def get_recommended_characters(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
    ):
    if not current_user.liked_tags:
        return []  # no recommendations
    
    user_tags = current_user.liked_tags or []
    tags_array = array(user_tags, type_=TEXT)

    chars = db.query(Character).filter(Character.tags.overlap(tags_array)).order_by(Character.likes.desc()).limit(12).all()

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

@router.get("/api/characters/by-tag/{tag_name}")
def get_characters_by_tag(
    tag_name: str,
    db: Session = Depends(get_db),
    limit: int = 12
):
    # Find characters that have this tag
    chars = db.query(Character).filter(
        Character.tags.any(tag_name)
    ).order_by(
        Character.likes.desc()
    ).limit(limit).all()

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

@router.get("/api/characters/recent")
def get_recent_characters(db: Session = Depends(get_db)):
    chars = db.query(Character).order_by(Character.created_time.desc()).limit(10).all()
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
def increment_views(payload: dict, db: Session = Depends(get_db)):
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
