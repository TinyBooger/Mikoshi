from fastapi import APIRouter, Depends, HTTPException, Form
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session
from typing import List
from database import get_db
from models import User
from utils.session import get_current_user
from datetime import datetime, UTC


router = APIRouter()

from models import Scene

# --- Create Scene Route ---
@router.post("/api/scenes")
def create_scene(
    name: str = Form(...),
    description: str = Form(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    if not current_user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    scene = Scene(
        name=name.strip(),
        description=description.strip(),
        creator_id=current_user.id
    )
    db.add(scene)
    db.commit()
    db.refresh(scene)
    return {
        "id": scene.id,
        "name": scene.name,
        "description": scene.description,
        "creator_id": scene.creator_id,
        "likes": scene.likes,
        "views": scene.views
    }

# --- Get All Scenes for User ---
@router.get("/api/scenes")
def get_scenes(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    scenes = db.query(Scene).filter(Scene.creator_id == current_user.id).all()
    return [
        {
            "id": s.id,
            "name": s.name,
            "description": s.description,
            "creator_id": s.creator_id,
            "likes": s.likes,
            "views": s.views
        } for s in scenes
    ]

# --- Delete Scene ---
@router.delete("/api/scenes/{scene_id}")
def delete_scene(scene_id: int, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    scene = db.query(Scene).filter(Scene.id == scene_id).first()
    if not scene:
        raise HTTPException(status_code=404, detail="Scene not found")
    if scene.creator_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized")
    db.delete(scene)
    db.commit()
    return {"message": "Scene deleted"}

# --- Update Scene ---
@router.put("/api/scenes/{scene_id}")
def update_scene(
    scene_id: int,
    name: str = Form(...),
    description: str = Form(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    scene = db.query(Scene).filter(Scene.id == scene_id).first()
    if not scene:
        raise HTTPException(status_code=404, detail="Scene not found")
    if scene.creator_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized")
    scene.name = name.strip()
    scene.description = description.strip()
    db.commit()
    db.refresh(scene)
    return {
        "id": scene.id,
        "name": scene.name,
        "description": scene.description,
        "creator_id": scene.creator_id,
        "likes": scene.likes,
        "views": scene.views
    }
