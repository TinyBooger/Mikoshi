
from fastapi import APIRouter, Depends, HTTPException, Form, UploadFile, File, Query
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session
from typing import List
from database import get_db
from models import Scene, User, UserLikedScene
from utils.local_storage_utils import save_image
from utils.session import get_current_user
from datetime import datetime, UTC
from schemas import SceneOut
from sqlalchemy.dialects.postgresql import array, TEXT


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
    db.commit()
    if picture:
        scene.picture = save_image(picture.file, 'scene', scene.id, picture.filename)
        db.commit()
        db.refresh(scene)
    return JSONResponse(content={"id": scene.id, "message": "Scene created"})





# Read all Scenes or search by name
@router.get("/api/scenes/", response_model=List[SceneOut])
def get_scenes(search: str = None, db: Session = Depends(get_db)):
    query = db.query(Scene)
    if search:
        # Case-insensitive search by name
        query = query.filter(Scene.name.ilike(f"%{search}%"))
    scenes = query.all()
    return scenes

# Get scenes created by a specific user (for profile page)
@router.get("/api/scenes-created", response_model=List[SceneOut])
def get_scenes_created(userId: str = Query(None), current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """
    If userId is provided, fetch that user's created scenes (public).
    Otherwise, fetch current user's created scenes.
    """
    if userId:
        scenes = db.query(Scene).filter(Scene.creator_id == userId).order_by(Scene.created_time.desc()).all()
    else:
        if not current_user:
            return []
        scenes = db.query(Scene).filter(Scene.creator_id == current_user.id).order_by(Scene.created_time.desc()).all()
    return [SceneOut.from_orm(s) for s in scenes]


# Popular Scenes
@router.get("/api/scenes/popular", response_model=List[SceneOut])
def get_popular_scenes(db: Session = Depends(get_db)):
    scenes = db.query(Scene).order_by(Scene.likes.desc()).limit(12).all()
    return [SceneOut.from_orm(s) for s in scenes]

# Recent Scenes
@router.get("/api/scenes/recent", response_model=List[SceneOut])
def get_recent_scenes(db: Session = Depends(get_db)):
    scenes = db.query(Scene).order_by(Scene.created_time.desc()).limit(12).all()
    return [SceneOut.from_orm(s) for s in scenes]


# Recommended Scenes (personalized by liked_tags)
@router.get("/api/scenes/recommended", response_model=List[SceneOut])
def get_recommended_scenes(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    if not current_user.liked_tags:
        return []  # no recommendations
    user_tags = current_user.liked_tags or []
    tags_array = array(user_tags, type_=TEXT)
    scenes = db.query(Scene).filter(Scene.tags.overlap(tags_array)).order_by(Scene.likes.desc()).limit(12).all()
    return [SceneOut.from_orm(s) for s in scenes]

# Read single Scene
@router.get("/api/scenes/{scene_id}", response_model=SceneOut)
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
        scene.picture = save_image(picture.file, 'scene', scene.id, picture.filename)
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

# ----------------------- END SCENE CRUD ROUTES -------------------

# Get scenes liked by a user
@router.get("/api/scenes-liked", response_model=List[SceneOut])
def get_scenes_liked(userId: str = Query(None), current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """
    If userId is provided, fetch that user's liked scenes.
    Otherwise, fetch current user's liked scenes.
    """
    if userId:
        liked_scene_ids = db.query(UserLikedScene.scene_id).filter(UserLikedScene.user_id == userId).all()
    else:
        if not current_user:
            return []
        liked_scene_ids = db.query(UserLikedScene.scene_id).filter(UserLikedScene.user_id == current_user.id).all()
    scene_ids = [sid for (sid,) in liked_scene_ids]
    if not scene_ids:
        return []
    scenes = db.query(Scene).filter(Scene.id.in_(scene_ids)).all()
    return scenes