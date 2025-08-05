from fastapi import APIRouter, Request, Depends, HTTPException, Form
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session
from typing import List


from database import get_db
from models import Persona, User, Tag
from utils.session import get_current_user
from datetime import datetime, UTC

router = APIRouter()

# ------------------- PERSONA CRUD ROUTES -------------------

# Create Persona
@router.post("/api/personas/", response_model=None)
def create_persona(
    name: str = Form(...),
    description: str = Form(None),
    intro: str = Form(None),
    tags: List[str] = Form([]),
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    persona = Persona(
        name=name,
        description=description,
        intro=intro,
        tags=tags,
        creator_id=current_user["uid"],
        created_time=datetime.now(UTC)
    )
    db.add(persona)
    db.commit()
    db.refresh(persona)
    return JSONResponse(content={"id": persona.id, "message": "Persona created"})

# Read all Personas
@router.get("/api/personas/", response_model=None)
def get_personas(db: Session = Depends(get_db)):
    personas = db.query(Persona).all()
    return personas

# Read single Persona
@router.get("/api/personas/{persona_id}", response_model=None)
def get_persona(persona_id: int, db: Session = Depends(get_db)):
    persona = db.query(Persona).filter(Persona.id == persona_id).first()
    if not persona:
        raise HTTPException(status_code=404, detail="Persona not found")
    return persona

# Update Persona
@router.put("/api/personas/{persona_id}", response_model=None)
def update_persona(
    persona_id: int,
    name: str = Form(None),
    description: str = Form(None),
    intro: str = Form(None),
    tags: List[str] = Form(None),
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    persona = db.query(Persona).filter(Persona.id == persona_id).first()
    if not persona:
        raise HTTPException(status_code=404, detail="Persona not found")
    if persona.creator_id != current_user["uid"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    if name is not None:
        persona.name = name
    if description is not None:
        persona.description = description
    if intro is not None:
        persona.intro = intro
    if tags is not None:
        persona.tags = tags
    db.commit()
    db.refresh(persona)
    return JSONResponse(content={"id": persona.id, "message": "Persona updated"})

# Delete Persona
@router.delete("/api/personas/{persona_id}", response_model=None)
def delete_persona(persona_id: int, db: Session = Depends(get_db), current_user: dict = Depends(get_current_user)):
    persona = db.query(Persona).filter(Persona.id == persona_id).first()
    if not persona:
        raise HTTPException(status_code=404, detail="Persona not found")
    if persona.creator_id != current_user["uid"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    db.delete(persona)
    db.commit()
    return JSONResponse(content={"id": persona_id, "message": "Persona deleted"})
