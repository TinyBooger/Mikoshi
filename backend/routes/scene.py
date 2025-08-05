from fastapi import APIRouter, Depends, HTTPException, Form
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session
from typing import List
from database import get_db
from models import Scene
from utils.session import get_current_user
from datetime import datetime, UTC


router = APIRouter()

# ------------------- SCENE CRUD ROUTES -------------------

# Create Scene
@router.post("/api/scenes/", response_model=None)
def create_scene(
    name: str = Form(...),
    description: str = Form(...),
    intro: str = Form(None),
    tags: List[str] = Form([]),
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    scene = Scene(
        name=name,
        description=description,
        intro=intro,
        tags=tags,
        creator_id=current_user["uid"],
        created_time=datetime.now(UTC)
    )
    db.add(scene)
    db.commit()
    db.refresh(scene)
    return JSONResponse(content={"id": scene.id, "message": "Scene created"})

# Read all Scenes
@router.get("/api/scenes/", response_model=None)
def get_scenes(db: Session = Depends(get_db)):
    scenes = db.query(Scene).all()
    return scenes

# Read single Scene
@router.get("/api/scenes/{scene_id}", response_model=None)
def get_scene(scene_id: int, db: Session = Depends(get_db)):
    scene = db.query(Scene).filter(Scene.id == scene_id).first()
    if not scene:
        raise HTTPException(status_code=404, detail="Scene not found")
    return scene

# Update Scene
@router.put("/api/scenes/{scene_id}", response_model=None)
def update_scene(
    scene_id: int,
    name: str = Form(None),
    description: str = Form(None),
    intro: str = Form(None),
    tags: List[str] = Form(None),
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    scene = db.query(Scene).filter(Scene.id == scene_id).first()
    if not scene:
        raise HTTPException(status_code=404, detail="Scene not found")
    if scene.creator_id != current_user["uid"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    if name is not None:
        scene.name = name
    if description is not None:
        scene.description = description
    if intro is not None:
        scene.intro = intro
    if tags is not None:
        scene.tags = tags
    db.commit()
    db.refresh(scene)
    return JSONResponse(content={"id": scene.id, "message": "Scene updated"})

# Delete Scene
@router.delete("/api/scenes/{scene_id}", response_model=None)
def delete_scene(scene_id: int, db: Session = Depends(get_db), current_user: dict = Depends(get_current_user)):
    scene = db.query(Scene).filter(Scene.id == scene_id).first()
    if not scene:
        raise HTTPException(status_code=404, detail="Scene not found")
    if scene.creator_id != current_user["uid"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    db.delete(scene)
    db.commit()
    return JSONResponse(content={"id": scene_id, "message": "Scene deleted"})

