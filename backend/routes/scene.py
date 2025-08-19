from fastapi import APIRouter, Depends, HTTPException, Form, UploadFile, File
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session
from typing import List
from database import get_db
from models import Scene, User
from utils.cloudinary_utils import upload_scene_image
from utils.session import get_current_user
from datetime import datetime, UTC
from schemas import SceneOut


router = APIRouter()

# ------------------- SCENE CRUD ROUTES -------------------

# Create Scene
@router.post("/api/scenes/", response_model=None)
async def create_scene(
    name: str = Form(...),
    description: str = Form(...),
    intro: str = Form(None),
    tags: List[str] = Form([]),
    picture: UploadFile = File(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    scene = Scene(
        name=name,
        description=description,
        intro=intro,
        tags=tags,
        creator_id=current_user.id,
        creator_name=current_user.name,
        created_time=datetime.now(UTC),
        picture=None
    )
    db.add(scene)
    db.commit()
    db.refresh(scene)
    if picture:
        scene.picture = upload_scene_image(picture.file, scene.id)
        db.commit()
        db.refresh(scene)
    return JSONResponse(content={"id": scene.id, "message": "Scene created"})




# Read all Scenes or search by name
@router.get("/api/scenes/", response_model=None)
def get_scenes(search: str = None, db: Session = Depends(get_db)):
    query = db.query(Scene)
    if search:
        # Case-insensitive search by name
        query = query.filter(Scene.name.ilike(f"%{search}%"))
    scenes = query.all()
    return scenes

# Get scenes created by a specific user (for profile page)
@router.get("/api/scenes-created", response_model=List[SceneOut])
def get_scenes_created(userId: int = None, db: Session = Depends(get_db)):
    query = db.query(Scene)
    if userId is not None:
        query = query.filter(Scene.creator_id == userId)
    scenes = query.order_by(Scene.created_time.desc()).all()
    return [SceneOut.from_orm(s) for s in scenes]

@router.get("/api/scenes/popular", response_model=List[SceneOut])
def get_popular_scenes(db: Session = Depends(get_db)):
    if hasattr(Scene, 'likes'):
        scenes = db.query(Scene).order_by(Scene.likes.desc()).limit(12).all()
    else:
        scenes = db.query(Scene).order_by(Scene.created_time.desc()).limit(12).all()
    return [SceneOut.from_orm(s) for s in scenes]

# Read single Scene
@router.get("/api/scenes/{scene_id}", response_model=None)
def get_scene(scene_id: int, db: Session = Depends(get_db)):
    scene = db.query(Scene).filter(Scene.id == scene_id).first()
    if not scene:
        raise HTTPException(status_code=404, detail="Scene not found")
    return scene

# Update Scene
@router.put("/api/scenes/{scene_id}", response_model=None)
async def update_scene(
    scene_id: int,
    name: str = Form(None),
    description: str = Form(None),
    intro: str = Form(None),
    tags: List[str] = Form(None),
    picture: UploadFile = File(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    scene = db.query(Scene).filter(Scene.id == scene_id).first()
    if not scene:
        raise HTTPException(status_code=404, detail="Scene not found")
    if scene.creator_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized")
    if name is not None:
        scene.name = name
    if description is not None:
        scene.description = description
    if intro is not None:
        scene.intro = intro
    if tags is not None:
        scene.tags = tags
    if picture:
        scene.picture = upload_scene_image(picture.file, scene.id)
    db.commit()
    db.refresh(scene)
    return JSONResponse(content={"id": scene.id, "message": "Scene updated"})

# Delete Scene
@router.delete("/api/scenes/{scene_id}", response_model=None)
def delete_scene(scene_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    scene = db.query(Scene).filter(Scene.id == scene_id).first()
    if not scene:
        raise HTTPException(status_code=404, detail="Scene not found")
    if scene.creator_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized")
    db.delete(scene)
    db.commit()
    return JSONResponse(content={"id": scene_id, "message": "Scene deleted"})

