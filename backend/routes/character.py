from fastapi import APIRouter, Request, Depends, HTTPException, UploadFile, File, Form, Query
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session
from sqlalchemy.dialects.postgresql import array, TEXT
from typing import List, Optional
from datetime import datetime, UTC

from database import get_db
from models import Character, User, Tag, UserLikedCharacter
from utils.session import get_current_user
from utils.local_storage_utils import save_image
from utils.validators import validate_character_fields
from schemas import CharacterOut, CharacterListOut

router = APIRouter()

@router.post("/api/create-character")
async def create_character(
    name: str = Form(...),
    persona: str = Form(...),
    tagline: str = Form(""),
    tags: List[str] = Form([]),
    greeting: str = Form(""),
    sample_dialogue: str = Form(""),
    is_public: bool = Form(False),
    is_forkable: bool = Form(False),
    is_free: bool = Form(True),
    price: float = Form(0),
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
    
    # Enforce: paid characters cannot be forkable
    if not is_free and is_forkable:
        raise HTTPException(status_code=400, detail="Paid characters cannot be forkable")
    
    # Validate price consistency
    if is_free and price > 0:
        price = 0
    elif not is_free:
        if price < 0.1:
            raise HTTPException(status_code=400, detail="Paid characters must have a price of at least ¥0.1")
        if price > 100:
            raise HTTPException(status_code=400, detail="Price cannot exceed ¥100")
        # Round to 2 decimals
        price = round(price, 2)

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
        is_public=is_public,
        is_forkable=is_forkable,
        is_free=is_free,
        price=price,
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
    is_public: Optional[bool] = Form(None),
    is_forkable: Optional[bool] = Form(None),
    is_free: Optional[bool] = Form(None),
    price: Optional[float] = Form(None),
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
    
    # Enforce: paid characters cannot be forkable
    final_is_free = is_free if is_free is not None else char.is_free
    final_is_forkable = is_forkable if is_forkable is not None else char.is_forkable
    final_price = price if price is not None else char.price
    
    if not final_is_free and final_is_forkable:
        raise HTTPException(status_code=400, detail="Paid characters cannot be forkable")
    
    # Validate price consistency
    if final_is_free and final_price > 0:
        final_price = 0
    elif not final_is_free:
        if final_price < 0.1:
            raise HTTPException(status_code=400, detail="Paid characters must have a price of at least ¥0.1")
        if final_price > 100:
            raise HTTPException(status_code=400, detail="Price cannot exceed ¥100")
        # Round to 2 decimals
        final_price = round(final_price, 2)

    char.name = name
    char.persona = persona
    char.tagline = tagline.strip()
    char.tags = tags
    char.greeting = greeting.strip()
    char.example_messages = sample_dialogue.strip()

    if is_public is not None:
        char.is_public = is_public
    if is_forkable is not None:
        char.is_forkable = is_forkable
    if is_free is not None:
        char.is_free = is_free
    if price is not None:
        char.price = final_price

    if picture:
        char.picture = save_image(picture.file, 'character', char.id, picture.filename)

    db.commit()
    return {"message": "Character updated successfully"}

@router.get("/api/characters", response_model=List[CharacterOut])
def get_characters(search: str = None, db: Session = Depends(get_db)):
    query = db.query(Character).filter(Character.is_public == True)
    if search:
        # Case-insensitive search by name
        query = query.filter(Character.name.ilike(f"%{search}%"))
    chars = query.all()
    return chars


@router.get("/api/character/{character_id}", response_model=CharacterOut)
def get_character(character_id: int, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    c = db.query(Character).filter(Character.id == character_id).first()
    if not c:
        raise HTTPException(status_code=404, detail="Character not found")
    if not c.is_public:
        if not current_user or c.creator_id != current_user.id:
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

@router.get("/api/characters/popular", response_model=CharacterListOut)
def get_popular_characters(
    short: bool = Query(True),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db)
):
    base_query = db.query(Character).filter(Character.is_public == True).order_by(Character.views.desc())
    total = base_query.count()
    if short:
        items = base_query.limit(10).all()
        return CharacterListOut(items=items, total=total, page=1, page_size=len(items), short=True)
    items = base_query.offset((page - 1) * page_size).limit(page_size).all()
    return CharacterListOut(items=items, total=total, page=page, page_size=page_size, short=False)

@router.get("/api/characters/recommended", response_model=CharacterListOut)
def get_recommended_characters(
    short: bool = Query(True),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
    ):
    if not current_user.liked_tags:
        return CharacterListOut(items=[], total=0, page=1, page_size=0, short=short)
    
    # Collect character IDs to exclude (already viewed or chatted with)
    excluded_ids = set()
    
    # Add character IDs from chat_history
    if current_user.chat_history:
        for chat in current_user.chat_history:
            if "character_id" in chat:
                excluded_ids.add(chat["character_id"])
    
    user_tags = current_user.liked_tags or []
    tags_array = array(user_tags, type_=TEXT)
    
    # Query characters matching user tags, excluding already viewed ones
    query = db.query(Character).filter(Character.is_public == True).filter(Character.tags.overlap(tags_array))
    
    if excluded_ids:
        query = query.filter(~Character.id.in_(excluded_ids))
    
    query = query.order_by(Character.views.desc())
    total = query.count()
    if short:
        items = query.limit(10).all()
        return CharacterListOut(items=items, total=total, page=1, page_size=len(items), short=True)
    items = query.offset((page - 1) * page_size).limit(page_size).all()
    return CharacterListOut(items=items, total=total, page=page, page_size=page_size, short=False)

@router.get("/api/characters/by-tag/{tag_name}", response_model=List[CharacterOut])
def get_characters_by_tag(
    tag_name: str,
    db: Session = Depends(get_db),
    limit: int = 12
):
    chars = db.query(Character).filter(
        Character.is_public == True,
        Character.tags.any(tag_name)
    ).order_by(
        Character.views.desc()
    ).limit(limit).all()
    return chars

@router.get("/api/characters/recent", response_model=CharacterListOut)
def get_recent_characters(
    short: bool = Query(True),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db)
):
    base_query = db.query(Character).filter(Character.is_public == True).order_by(Character.created_time.desc())
    total = base_query.count()
    if short:
        items = base_query.limit(10).all()
        return CharacterListOut(items=items, total=total, page=1, page_size=len(items), short=True)
    items = base_query.offset((page - 1) * page_size).limit(page_size).all()
    return CharacterListOut(items=items, total=total, page=page, page_size=page_size, short=False)

# ----------------------------------------------------------------

from typing import List

@router.get("/api/characters-created", response_model=CharacterListOut)
def get_user_created_characters(
    userId: str = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    If userId is provided, fetch that user's created characters (public).
    Otherwise, fetch current user's created characters.
    """
    if userId:
        query = db.query(Character).filter(Character.creator_id == userId)
        # If viewing another user's creations, show only public
        if not current_user or current_user.id != userId:
            query = query.filter(Character.is_public == True)
    else:
        if not current_user:
            return CharacterListOut(items=[], total=0, page=1, page_size=0, short=False)
        query = db.query(Character).filter(Character.creator_id == current_user.id)
    
    total = query.count()
    characters = query.offset((page - 1) * page_size).limit(page_size).all()
    return CharacterListOut(items=characters, total=total, page=page, page_size=page_size, short=False)

@router.get("/api/characters-liked", response_model=CharacterListOut)
def get_user_liked_characters(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    if not current_user:
        return CharacterListOut(items=[], total=0, page=1, page_size=0, short=False)

    liked = db.query(UserLikedCharacter.character_id).filter_by(user_id=current_user.id)
    total = liked.count()
    liked_ids = [row.character_id for row in liked.offset((page - 1) * page_size).limit(page_size).all()]
    if not liked_ids:
        return CharacterListOut(items=[], total=total, page=page, page_size=page_size, short=False)
    characters = db.query(Character).filter(Character.id.in_(liked_ids), Character.is_public == True).all()
    return CharacterListOut(items=characters, total=total, page=page, page_size=page_size, short=False)

@router.get("/api/user/{user_id}/characters", response_model=List[CharacterOut])
def get_user_characters(user_id: str, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    query = db.query(Character).filter(Character.creator_id == user_id)
    if not current_user or current_user.id != user_id:
        query = query.filter(Character.is_public == True)
    characters = query.all()
    return characters