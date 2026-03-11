
from fastapi import APIRouter, Depends, HTTPException, Form, UploadFile, File, Query
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session
from typing import List, Optional
from database import get_db
from models import Scene, User, UserLikedScene
from utils.local_storage_utils import save_image
from utils.session import get_current_user
from datetime import datetime, UTC
from schemas import SceneOut, SceneListOut
from sqlalchemy.dialects.postgresql import array, TEXT
from utils.level_system import award_exp_with_limits
from utils.content_censor import censor_form_payload


router = APIRouter()

MAX_DESCRIPTION_LENGTH = 400

# ------------------- SCENE CRUD ROUTES -------------------

# Create Scene
@router.post("/api/scenes/", response_model=None)
async def create_scene(
    name: str = Form(...),
    description: str = Form(...),
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
    description = (censored_payload.get("description") or "").strip()
    intro = censored_payload.get("intro")
    tags = censored_payload.get("tags") or []
    forked_from_name = censored_payload.get("forked_from_name")

    if len(description) > MAX_DESCRIPTION_LENGTH:
        raise HTTPException(status_code=400, detail=f"Description too long (max {MAX_DESCRIPTION_LENGTH})")

    # Enforce: forking requires level 2 or higher
    if forked_from_id and current_user.level < 2:
        raise HTTPException(status_code=403, detail="Forking requires level 2 or higher")
    
    # Enforce level-based private scene access (L2+)
    if not is_public and current_user.level < 2:
        raise HTTPException(status_code=403, detail="Private scenes require level 2 or higher")
    
    scene = Scene(
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
    db.add(scene)
    db.commit()
    db.refresh(scene)
    if picture:
        scene.picture = save_image(picture.file, 'scene', scene.id, picture.filename)
        db.commit()
        db.refresh(scene)
    
    # Award EXP to creator for creating a scene
    exp_result = award_exp_with_limits(current_user, "create_scene", db)
    
    # Award EXP to original creator if this is a fork
    if forked_from_id:
        original_scene = db.query(Scene).filter(Scene.id == forked_from_id).first()
        if original_scene and original_scene.creator_id:
            original_creator = db.query(User).filter(User.id == original_scene.creator_id).first()
            if original_creator:
                award_exp_with_limits(original_creator, "forked", db)
    
    return JSONResponse(content={
        "id": scene.id,
        "message": "Scene created",
        "exp": current_user.exp,
        "level": current_user.level,
        "exp_result": exp_result,
        "content_censored": content_censored
    })





# Read all Scenes or search by name
@router.get("/api/scenes/", response_model=List[SceneOut])
def get_scenes(search: str = None, db: Session = Depends(get_db)):
    query = db.query(Scene).filter(Scene.is_public == True)
    if search:
        # Case-insensitive search by name
        query = query.filter(Scene.name.ilike(f"%{search}%"))
    scenes = query.all()
    return scenes

# Get scenes created by a specific user (for profile page)
@router.get("/api/scenes-created", response_model=SceneListOut)
def get_scenes_created(
    userId: str = Query(None),
    sort: str = Query("recent"),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    If userId is provided, fetch that user's created scenes (public).
    Otherwise, fetch current user's created scenes.
    """
    if userId:
        query = db.query(Scene).filter(Scene.creator_id == userId)
        if not current_user or current_user.id != userId:
            query = query.filter(Scene.is_public == True)
    else:
        if not current_user:
            return SceneListOut(items=[], total=0, page=1, page_size=0, short=False)
        query = db.query(Scene).filter(Scene.creator_id == current_user.id)

    if sort == "popular":
        query = query.order_by(Scene.views.desc(), Scene.created_time.desc())
    else:
        query = query.order_by(Scene.created_time.desc())
    
    total = query.count()
    scenes = query.offset((page - 1) * page_size).limit(page_size).all()
    return SceneListOut(items=[SceneOut.from_orm(s) for s in scenes], total=total, page=page, page_size=page_size, short=False)


# Popular Scenes
@router.get("/api/scenes/popular", response_model=SceneListOut)
def get_popular_scenes(
    short: bool = Query(True),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db)
):
    total = db.query(Scene).filter(Scene.is_public == True).count()
    base_query = (
        db.query(Scene, User.profile_pic.label("creator_profile_pic"))
        .outerjoin(User, Scene.creator_id == User.id)
        .filter(Scene.is_public == True)
        .order_by(Scene.views.desc())
    )
    if short:
        rows = base_query.limit(10).all()
        items = []
        for scene, creator_profile_pic in rows:
            scene.creator_profile_pic = creator_profile_pic
            items.append(SceneOut.from_orm(scene))
        return SceneListOut(items=items, total=total, page=1, page_size=len(items), short=True)
    rows = base_query.offset((page - 1) * page_size).limit(page_size).all()
    items = []
    for scene, creator_profile_pic in rows:
        scene.creator_profile_pic = creator_profile_pic
        items.append(SceneOut.from_orm(scene))
    return SceneListOut(items=items, total=total, page=page, page_size=page_size, short=False)

# Recent Scenes
@router.get("/api/scenes/recent", response_model=SceneListOut)
def get_recent_scenes(
    short: bool = Query(True),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db)
):
    total = db.query(Scene).filter(Scene.is_public == True).count()
    base_query = (
        db.query(Scene, User.profile_pic.label("creator_profile_pic"))
        .outerjoin(User, Scene.creator_id == User.id)
        .filter(Scene.is_public == True)
        .order_by(Scene.created_time.desc())
    )
    if short:
        rows = base_query.limit(10).all()
        items = []
        for scene, creator_profile_pic in rows:
            scene.creator_profile_pic = creator_profile_pic
            items.append(SceneOut.from_orm(scene))
        return SceneListOut(items=items, total=total, page=1, page_size=len(items), short=True)
    rows = base_query.offset((page - 1) * page_size).limit(page_size).all()
    items = []
    for scene, creator_profile_pic in rows:
        scene.creator_profile_pic = creator_profile_pic
        items.append(SceneOut.from_orm(scene))
    return SceneListOut(items=items, total=total, page=page, page_size=page_size, short=False)


# Recommended Scenes (personalized by liked_tags)
@router.get("/api/scenes/recommended", response_model=SceneListOut)
def get_recommended_scenes(
    short: bool = Query(True),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    if not current_user.liked_tags:
        return SceneListOut(items=[], total=0, page=1, page_size=0, short=short)
    user_tags = current_user.liked_tags or []
    tags_array = array(user_tags, type_=TEXT)
    base_query = (
        db.query(Scene, User.profile_pic.label("creator_profile_pic"))
        .outerjoin(User, Scene.creator_id == User.id)
        .filter(Scene.is_public == True)
        .filter(Scene.tags.overlap(tags_array))
        .order_by(Scene.views.desc())
    )
    total = base_query.count()
    if short:
        rows = base_query.limit(10).all()
        items = []
        for scene, creator_profile_pic in rows:
            scene.creator_profile_pic = creator_profile_pic
            items.append(SceneOut.from_orm(scene))
        return SceneListOut(items=items, total=total, page=1, page_size=len(items), short=True)
    rows = base_query.offset((page - 1) * page_size).limit(page_size).all()
    items = []
    for scene, creator_profile_pic in rows:
        scene.creator_profile_pic = creator_profile_pic
        items.append(SceneOut.from_orm(scene))
    return SceneListOut(items=items, total=total, page=page, page_size=page_size, short=False)

# Read single Scene
@router.get("/api/scenes/{scene_id}", response_model=SceneOut)
def get_scene(scene_id: int, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    scene = db.query(Scene).filter(Scene.id == scene_id).first()
    if not scene:
        raise HTTPException(status_code=404, detail="Scene not found")
    if not scene.is_public:
        if not current_user or scene.creator_id != current_user.id:
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
    is_public: Optional[bool] = Form(None),
    is_forkable: Optional[bool] = Form(None),
    picture: UploadFile = File(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    scene = db.query(Scene).filter(Scene.id == scene_id).first()
    if not scene:
        raise HTTPException(status_code=404, detail="Scene not found")
    if scene.creator_id != current_user.id:
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
    
    # Enforce level-based private scene access (L2+)
    final_is_public = is_public if is_public is not None else scene.is_public
    if not final_is_public and current_user.level < 2:
        raise HTTPException(status_code=403, detail="Private scenes require level 2 or higher")
    
    if name is not None:
        scene.name = name
    if description is not None:
        if len(description) > MAX_DESCRIPTION_LENGTH:
            raise HTTPException(status_code=400, detail=f"Description too long (max {MAX_DESCRIPTION_LENGTH})")
        scene.description = description
    if intro is not None:
        scene.intro = intro
    if tags is not None:
        scene.tags = tags
    if is_public is not None:
        scene.is_public = is_public
    if is_forkable is not None:
        scene.is_forkable = is_forkable
    if picture:
        scene.picture = save_image(picture.file, 'scene', scene.id, picture.filename)
    db.commit()
    db.refresh(scene)
    return JSONResponse(content={
        "id": scene.id,
        "message": "Scene updated",
        "content_censored": content_censored
    })

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
@router.get("/api/scenes-liked", response_model=SceneListOut)
def get_scenes_liked(
    userId: str = Query(None),
    sort: str = Query("recent"),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    If userId is provided, fetch that user's liked scenes.
    Otherwise, fetch current user's liked scenes.
    """
    target_user_id = userId
    if userId:
        target_user_id = userId
    else:
        if not current_user:
            return SceneListOut(items=[], total=0, page=1, page_size=0, short=False)
        target_user_id = current_user.id

    query = (
        db.query(Scene)
        .join(UserLikedScene, UserLikedScene.scene_id == Scene.id)
        .filter(UserLikedScene.user_id == target_user_id, Scene.is_public == True)
    )

    if sort == "popular":
        query = query.order_by(Scene.views.desc(), Scene.created_time.desc())
    else:
        query = query.order_by(Scene.created_time.desc())

    total = query.count()
    scenes = query.offset((page - 1) * page_size).limit(page_size).all()
    return SceneListOut(items=scenes, total=total, page=page, page_size=page_size, short=False)