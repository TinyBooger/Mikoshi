from fastapi import APIRouter, Request, Depends, HTTPException, Form, UploadFile, File, Query
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session
from typing import List, Optional

from database import get_db
from models import Persona, User, Tag, UserLikedPersona
from utils.local_storage_utils import save_image
from utils.image_moderation import moderate_image
from utils.session import get_current_user
from datetime import datetime, UTC
from schemas import PersonaOut, PersonaListOut
from utils.level_system import award_exp_with_limits
from utils.content_censor import censor_form_payload

router = APIRouter()

MAX_DESCRIPTION_LENGTH = 400


# Popular Personas
@router.get("/api/personas/popular", response_model=PersonaListOut)
def get_popular_personas(
    short: bool = Query(True),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db)
):
    total = db.query(Persona).filter(Persona.is_public == True).count()
    base_query = (
        db.query(Persona, User.profile_pic.label("creator_profile_pic"))
        .outerjoin(User, Persona.creator_id == User.id)
        .filter(Persona.is_public == True)
        .order_by(Persona.views.desc())
    )
    if short:
        rows = base_query.limit(10).all()
        items = []
        for persona, creator_profile_pic in rows:
            persona.creator_profile_pic = creator_profile_pic
            items.append(persona)
        return PersonaListOut(items=items, total=total, page=1, page_size=len(items), short=True)
    rows = base_query.offset((page - 1) * page_size).limit(page_size).all()
    items = []
    for persona, creator_profile_pic in rows:
        persona.creator_profile_pic = creator_profile_pic
        items.append(persona)
    return PersonaListOut(items=items, total=total, page=page, page_size=page_size, short=False)

# Recent Personas
@router.get("/api/personas/recent", response_model=PersonaListOut)
def get_recent_personas(
    short: bool = Query(True),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db)
):
    total = db.query(Persona).filter(Persona.is_public == True).count()
    base_query = (
        db.query(Persona, User.profile_pic.label("creator_profile_pic"))
        .outerjoin(User, Persona.creator_id == User.id)
        .filter(Persona.is_public == True)
        .order_by(Persona.created_time.desc())
    )
    if short:
        rows = base_query.limit(10).all()
        items = []
        for persona, creator_profile_pic in rows:
            persona.creator_profile_pic = creator_profile_pic
            items.append(persona)
        return PersonaListOut(items=items, total=total, page=1, page_size=len(items), short=True)
    rows = base_query.offset((page - 1) * page_size).limit(page_size).all()
    items = []
    for persona, creator_profile_pic in rows:
        persona.creator_profile_pic = creator_profile_pic
        items.append(persona)
    return PersonaListOut(items=items, total=total, page=page, page_size=page_size, short=False)

# Recommended Personas (simple: most liked, fallback to recent)
@router.get("/api/personas/recommended", response_model=PersonaListOut)
def get_recommended_personas(
    short: bool = Query(True),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db)
):
    base_query = (
        db.query(Persona, User.profile_pic.label("creator_profile_pic"))
        .outerjoin(User, Persona.creator_id == User.id)
        .filter(Persona.is_public == True)
        .order_by(Persona.views.desc(), Persona.created_time.desc())
    )
    total = base_query.count()
    if short:
        rows = base_query.limit(10).all()
        items = []
        for persona, creator_profile_pic in rows:
            persona.creator_profile_pic = creator_profile_pic
            items.append(persona)
        return PersonaListOut(items=items, total=total, page=1, page_size=len(items), short=True)
    rows = base_query.offset((page - 1) * page_size).limit(page_size).all()
    items = []
    for persona, creator_profile_pic in rows:
        persona.creator_profile_pic = creator_profile_pic
        items.append(persona)
    return PersonaListOut(items=items, total=total, page=page, page_size=page_size, short=False)

# ------------------- PERSONA CRUD ROUTES -------------------

# Create Persona
@router.post("/api/personas/", response_model=None)
async def create_persona(
    name: str = Form(...),
    description: str = Form(None),
    intro: str = Form(None),
    tags: List[str] = Form([]),
    is_public: bool = Form(False),
    is_forkable: bool = Form(False),
    forked_from_id: Optional[int] = Form(None),
    forked_from_name: Optional[str] = Form(None),
    picture: UploadFile = File(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    censored_payload, content_censored = censor_form_payload({
        "name": name,
        "description": description,
        "intro": intro,
        "tags": tags,
        "forked_from_name": forked_from_name,
    })
    name = (censored_payload.get("name") or "").strip()
    description = censored_payload.get("description")
    if description is not None:
        description = description.strip()
    intro = censored_payload.get("intro")
    tags = censored_payload.get("tags") or []
    forked_from_name = censored_payload.get("forked_from_name")

    if description and len(description) > MAX_DESCRIPTION_LENGTH:
        raise HTTPException(status_code=400, detail=f"Description too long (max {MAX_DESCRIPTION_LENGTH})")

    # Enforce: forking requires level 2 or higher
    if forked_from_id and current_user.level < 2:
        raise HTTPException(status_code=403, detail="Forking requires level 2 or higher")
    
    # Enforce level-based private persona access (L2+)
    if not is_public and current_user.level < 2:
        raise HTTPException(status_code=403, detail="Private personas require level 2 or higher")
    
    persona = Persona(
        name=name,
        description=description,
        intro=intro,
        tags=tags,
        creator_id=current_user.id,
        creator_name=current_user.name,
        created_time=datetime.now(UTC),
        is_public=is_public,
        is_forkable=is_forkable,
        picture=None,
        forked_from_id=forked_from_id,
        forked_from_name=forked_from_name,
    )
    db.add(persona)
    db.commit()
    db.refresh(persona)
    if picture:
        image_bytes = await picture.read()
        is_safe, label = moderate_image(image_bytes)
        if not is_safe:
            raise HTTPException(status_code=400, detail=f"Image rejected by content moderation ({label})")
        import io
        persona.picture = save_image(io.BytesIO(image_bytes), 'persona', persona.id, picture.filename)
        db.commit()
        db.refresh(persona)
    
    # Award EXP to creator for creating a persona
    exp_result = award_exp_with_limits(current_user, "create_persona", db)
    
    # Award EXP to original creator if this is a fork
    if forked_from_id:
        original_persona = db.query(Persona).filter(Persona.id == forked_from_id).first()
        if original_persona and original_persona.creator_id:
            original_creator = db.query(User).filter(User.id == original_persona.creator_id).first()
            if original_creator:
                award_exp_with_limits(original_creator, "forked", db)
    
    return JSONResponse(content={
        "id": persona.id,
        "message": "Persona created",
        "exp": current_user.exp,
        "level": current_user.level,
        "exp_result": exp_result,
        "content_censored": content_censored
    })



# Read all Personas or search by name
@router.get("/api/personas/", response_model=List[PersonaOut])
def get_personas(search: str = None, db: Session = Depends(get_db)):
    query = db.query(Persona).filter(Persona.is_public == True)
    if search:
        # Case-insensitive search by name
        query = query.filter(Persona.name.ilike(f"%{search}%"))
    personas = query.all()
    return personas

# Read single Persona
@router.get("/api/personas/{persona_id}", response_model=PersonaOut)
def get_persona(persona_id: int, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    persona = db.query(Persona).filter(Persona.id == persona_id).first()
    if not persona:
        raise HTTPException(status_code=404, detail="Persona not found")
    if not persona.is_public:
        if not current_user or persona.creator_id != current_user.id:
            raise HTTPException(status_code=404, detail="Persona not found")
    return persona

# Update Persona
@router.put("/api/personas/{persona_id}", response_model=None)
async def update_persona(
    persona_id: int,
    name: str = Form(None),
    description: str = Form(None),
    intro: str = Form(None),
    tags: List[str] = Form(None),
    is_public: Optional[bool] = Form(None),
    is_forkable: Optional[bool] = Form(None),
    picture: UploadFile = File(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    persona = db.query(Persona).filter(Persona.id == persona_id).first()
    if not persona:
        raise HTTPException(status_code=404, detail="Persona not found")
    if persona.creator_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized")

    censored_payload, content_censored = censor_form_payload({
        "name": name,
        "description": description,
        "intro": intro,
        "tags": tags,
    })
    name = censored_payload.get("name")
    description = censored_payload.get("description")
    if description is not None:
        description = description.strip()
    intro = censored_payload.get("intro")
    tags = censored_payload.get("tags")
    
    # Enforce level-based private persona access (L2+)
    final_is_public = is_public if is_public is not None else persona.is_public
    if not final_is_public and current_user.level < 2:
        raise HTTPException(status_code=403, detail="Private personas require level 2 or higher")
    
    if name is not None:
        persona.name = name
    if description is not None:
        if len(description) > MAX_DESCRIPTION_LENGTH:
            raise HTTPException(status_code=400, detail=f"Description too long (max {MAX_DESCRIPTION_LENGTH})")
        persona.description = description
    if intro is not None:
        persona.intro = intro
    if tags is not None:
        persona.tags = tags
    if is_public is not None:
        persona.is_public = is_public
    if is_forkable is not None:
        persona.is_forkable = is_forkable
    if picture:
        image_bytes = await picture.read()
        is_safe, label = moderate_image(image_bytes)
        if not is_safe:
            raise HTTPException(status_code=400, detail=f"Image rejected by content moderation ({label})")
        import io
        persona.picture = save_image(io.BytesIO(image_bytes), 'persona', persona.id, picture.filename)
    db.commit()
    db.refresh(persona)
    return JSONResponse(content={
        "id": persona.id,
        "message": "Persona updated",
        "content_censored": content_censored
    })

# Delete Persona
@router.delete("/api/personas/{persona_id}", response_model=None)
def delete_persona(persona_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    persona = db.query(Persona).filter(Persona.id == persona_id).first()
    if not persona:
        raise HTTPException(status_code=404, detail="Persona not found")
    if persona.creator_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized")
    db.delete(persona)
    db.commit()
    return JSONResponse(content={"id": persona_id, "message": "Persona deleted"})

# Set persona as default
@router.post("/api/personas/{persona_id}/set-default", response_model=None)
def set_persona_as_default(
    persona_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    persona = db.query(Persona).filter(Persona.id == persona_id).first()
    if not persona:
        raise HTTPException(status_code=404, detail="Persona not found")
    
    # Check if the persona belongs to the current user
    if persona.creator_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    user = db.query(User).filter(User.id == current_user.id).first()
    user.default_persona_id = persona_id
    db.commit()
    return JSONResponse(content={"id": persona_id, "message": "Persona set as default"})

# Unset default persona
@router.post("/api/personas/unset-default", response_model=None)
def unset_default_persona(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    user = db.query(User).filter(User.id == current_user.id).first()
    user.default_persona_id = None
    db.commit()
    return JSONResponse(content={"message": "Default persona unset"})

# ------------------- ADDITIONAL ROUTES -------------------
# Get personas created by a specific user (for profile page)
@router.get("/api/personas-created", response_model=PersonaListOut)
def get_personas_created(
    userId: str = Query(None),
    sort: str = Query("recent"),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    If userId is provided, fetch that user's created personas (public).
    Otherwise, fetch current user's created personas.
    """
    if userId:
        query = db.query(Persona).filter(Persona.creator_id == userId)
        if not current_user or current_user.id != userId:
            query = query.filter(Persona.is_public == True)
    else:
        if not current_user:
            return PersonaListOut(items=[], total=0, page=1, page_size=0, short=False)
        query = db.query(Persona).filter(Persona.creator_id == current_user.id)

    if sort == "popular":
        query = query.order_by(Persona.views.desc(), Persona.created_time.desc())
    else:
        query = query.order_by(Persona.created_time.desc())
    
    total = query.count()
    personas = query.offset((page - 1) * page_size).limit(page_size).all()
    return PersonaListOut(items=personas, total=total, page=page, page_size=page_size, short=False)

# Get personas liked by a user
@router.get("/api/personas-liked", response_model=PersonaListOut)
def get_personas_liked(
    userId: str = Query(None),
    sort: str = Query("recent"),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    If userId is provided, fetch that user's liked personas.
    Otherwise, fetch current user's liked personas.
    """
    target_user_id = userId
    if userId:
        target_user_id = userId
    else:
        if not current_user:
            return PersonaListOut(items=[], total=0, page=1, page_size=0, short=False)
        target_user_id = current_user.id

    query = (
        db.query(Persona)
        .join(UserLikedPersona, UserLikedPersona.persona_id == Persona.id)
        .filter(UserLikedPersona.user_id == target_user_id, Persona.is_public == True)
    )

    if sort == "popular":
        query = query.order_by(Persona.views.desc(), Persona.created_time.desc())
    else:
        query = query.order_by(Persona.created_time.desc())

    total = query.count()
    personas = query.offset((page - 1) * page_size).limit(page_size).all()
    return PersonaListOut(items=personas, total=total, page=page, page_size=page_size, short=False)