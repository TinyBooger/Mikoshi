from fastapi import APIRouter, Request, Depends, HTTPException, Form, UploadFile, File, Query
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session
from typing import List

from database import get_db
from models import Persona, User, Tag, UserLikedPersona
from utils.cloudinary_utils import upload_persona_picture
from utils.session import get_current_user
from datetime import datetime, UTC
from schemas import PersonaOut

router = APIRouter()


# Popular Personas
@router.get("/api/personas/popular", response_model=List[PersonaOut])
def get_popular_personas(db: Session = Depends(get_db)):
    personas = db.query(Persona).order_by(Persona.likes.desc()).limit(12).all()
    return personas

# Recent Personas
@router.get("/api/personas/recent", response_model=List[PersonaOut])
def get_recent_personas(db: Session = Depends(get_db)):
    personas = db.query(Persona).order_by(Persona.created_time.desc()).limit(12).all()
    return personas

# Recommended Personas (simple: most liked, fallback to recent)
@router.get("/api/personas/recommended", response_model=List[PersonaOut])
def get_recommended_personas(db: Session = Depends(get_db)):
    personas = db.query(Persona).order_by(Persona.likes.desc(), Persona.created_time.desc()).limit(12).all()
    return personas

# ------------------- PERSONA CRUD ROUTES -------------------

# Create Persona
@router.post("/api/personas/", response_model=None)
async def create_persona(
    name: str = Form(...),
    description: str = Form(None),
    intro: str = Form(None),
    tags: List[str] = Form([]),
    picture: UploadFile = File(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    persona = Persona(
        name=name,
        description=description,
        intro=intro,
        tags=tags,
        creator_id=current_user.id,
        creator_name=current_user.name,
        created_time=datetime.now(UTC),
        picture=None
    )
    db.add(persona)
    db.commit()
    db.refresh(persona)
    db.commit()
    if picture:
        persona.picture = upload_persona_picture(picture.file, persona.id)
        db.commit()
        db.refresh(persona)
    return JSONResponse(content={"id": persona.id, "message": "Persona created"})



# Read all Personas or search by name
@router.get("/api/personas/", response_model=List[PersonaOut])
def get_personas(search: str = None, db: Session = Depends(get_db)):
    query = db.query(Persona)
    if search:
        # Case-insensitive search by name
        query = query.filter(Persona.name.ilike(f"%{search}%"))
    personas = query.all()
    return personas

# Read single Persona
@router.get("/api/personas/{persona_id}", response_model=PersonaOut)
def get_persona(persona_id: int, db: Session = Depends(get_db)):
    persona = db.query(Persona).filter(Persona.id == persona_id).first()
    if not persona:
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
    picture: UploadFile = File(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    persona = db.query(Persona).filter(Persona.id == persona_id).first()
    if not persona:
        raise HTTPException(status_code=404, detail="Persona not found")
    if persona.creator_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized")
    if name is not None:
        persona.name = name
    if description is not None:
        persona.description = description
    if intro is not None:
        persona.intro = intro
    if tags is not None:
        persona.tags = tags
    if picture:
        persona.picture = upload_persona_picture(picture.file, persona.id)
    db.commit()
    db.refresh(persona)
    return JSONResponse(content={"id": persona.id, "message": "Persona updated"})

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

# ------------------- ADDITIONAL ROUTES -------------------
# Get personas created by a specific user (for profile page)
@router.get("/api/personas-created", response_model=List[PersonaOut])
def get_personas_created(userId: str = Query(None), current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """
    If userId is provided, fetch that user's created personas (public).
    Otherwise, fetch current user's created personas.
    """
    if userId:
        personas = db.query(Persona).filter(Persona.creator_id == userId).order_by(Persona.created_time.desc()).all()
    else:
        if not current_user:
            return []
        personas = db.query(Persona).filter(Persona.creator_id == current_user.id).order_by(Persona.created_time.desc()).all()
    return personas

# Get personas liked by a user
@router.get("/api/personas-liked", response_model=List[PersonaOut])
def get_personas_liked(userId: str = Query(None), current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """
    If userId is provided, fetch that user's liked personas.
    Otherwise, fetch current user's liked personas.
    """
    if userId:
        liked_persona_ids = db.query(UserLikedPersona.persona_id).filter(UserLikedPersona.user_id == userId).all()
    else:
        if not current_user:
            return []
        liked_persona_ids = db.query(UserLikedPersona.persona_id).filter(UserLikedPersona.user_id == current_user.id).all()
    persona_ids = [pid for (pid,) in liked_persona_ids]
    if not persona_ids:
        return []
    personas = db.query(Persona).filter(Persona.id.in_(persona_ids)).all()
    return personas