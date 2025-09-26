from fastapi import APIRouter, Request, Depends, HTTPException, UploadFile, File, Form, Query
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session
from sqlalchemy.dialects.postgresql import array, TEXT
from typing import List
from datetime import datetime, UTC

from database import get_db
from models import Character, User, Tag, UserLikedCharacter
from utils.session import get_current_user
from utils.local_storage_utils import save_image
from utils.validators import validate_character_fields
from schemas import CharacterOut

router = APIRouter()

@router.post("/api/create-character")
async def create_character(
    name: str = Form(...),
    persona: str = Form(...),
    tagline: str = Form(""),
    tags: List[str] = Form([]),
    greeting: str = Form(""),
    sample_dialogue: str = Form(""),
    picture: UploadFile = File(None),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    if not current_user:
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
        creator_id=current_user.id,
        creator_name=current_user.name,
        views=0,
        picture=None
    )
    db.add(char)
    db.commit()
    db.refresh(char)

    if picture:
        char.picture = save_image(picture.file, 'character', char.id, picture.filename)


    db.commit()
    db.refresh(current_user)
    return {"message": f"Character '{name}' created."}

@router.post("/api/update-character")
async def update_character(
    id: int = Form(...),
    name: str = Form(...),
    persona: str = Form(...),
    tagline: str = Form(""),
    tags: List[str] = Form([]),
    greeting: str = Form(""),
    sample_dialogue: str = Form(""),
    picture: UploadFile = File(None),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):

    char = db.query(Character).filter(Character.id == id).first()
    if not char or char.creator_id != current_user.id:
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
        char.picture = save_image(picture.file, 'character', char.id, picture.filename)

    db.commit()
    return {"message": "Character updated successfully"}

@router.get("/api/characters", response_model=List[CharacterOut])
def get_characters(search: str = None, db: Session = Depends(get_db)):
    query = db.query(Character)
    if search:
        # Case-insensitive search by name
        query = query.filter(Character.name.ilike(f"%{search}%"))
    chars = query.all()
    return chars


@router.get("/api/character/{character_id}", response_model=CharacterOut)
def get_character(character_id: int, db: Session = Depends(get_db)):
    c = db.query(Character).filter(Character.id == character_id).first()
    if not c:
        raise HTTPException(status_code=404, detail="Character not found")
    return c

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


    db.delete(char)
    db.commit()
    return {"message": "Character deleted successfully"}

@router.get("/api/characters/popular", response_model=List[CharacterOut])
def get_popular_characters(db: Session = Depends(get_db)):
    chars = db.query(Character).order_by(Character.views.desc()).limit(10).all()
    return chars

@router.get("/api/characters/recommended", response_model=List[CharacterOut])
def get_recommended_characters(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
    ):
    if not current_user.liked_tags:
        return []  # no recommendations
    user_tags = current_user.liked_tags or []
    tags_array = array(user_tags, type_=TEXT)
    chars = db.query(Character).filter(Character.tags.overlap(tags_array)).order_by(Character.likes.desc()).limit(12).all()
    return chars

@router.get("/api/characters/by-tag/{tag_name}", response_model=List[CharacterOut])
def get_characters_by_tag(
    tag_name: str,
    db: Session = Depends(get_db),
    limit: int = 12
):
    chars = db.query(Character).filter(
        Character.tags.any(tag_name)
    ).order_by(
        Character.likes.desc()
    ).limit(limit).all()
    return chars

@router.get("/api/characters/recent", response_model=List[CharacterOut])
def get_recent_characters(db: Session = Depends(get_db)):
    chars = db.query(Character).order_by(Character.created_time.desc()).limit(10).all()
    return chars

# ----------------------------------------------------------------

from typing import List

@router.get("/api/characters-created", response_model=List[CharacterOut])
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
        characters = db.query(Character).filter(Character.creator_id == userId).all()
    else:
        if not current_user:
            return []
        characters = db.query(Character).filter(Character.creator_id == current_user.id).all()
    return characters

@router.get("/api/characters-liked", response_model=List[CharacterOut])
def get_user_liked_characters(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    if not current_user:
        return []

    liked = db.query(UserLikedCharacter.character_id).filter_by(user_id=current_user.id).all()
    liked_ids = [row.character_id for row in liked]
    if not liked_ids:
        return []
    characters = db.query(Character).filter(Character.id.in_(liked_ids)).all()
    return characters

@router.get("/api/user/{user_id}/characters", response_model=List[CharacterOut])
def get_user_characters(user_id: str, db: Session = Depends(get_db)):
    characters = db.query(Character).filter(Character.creator_id == user_id).all()
    return characters

@router.get("/api/recent-characters", response_model=List[CharacterOut])
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
    # Return characters in the order of recent char_ids
    char_map = {str(c.id): c for c in characters}
    ordered = [char_map[str(cid)] for cid in char_ids if str(cid) in char_map]
    return ordered

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