from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, Query
from schemas import UserOut
from sqlalchemy.orm import Session
from database import get_db
from models import User, Character, Scene, Persona, Tag, UserLikedCharacter, UserLikedScene, UserLikedPersona
from utils.session import get_current_user
from utils.local_storage_utils import save_image
from utils.user_utils import build_user_response
from utils.validators import validate_account_fields
from utils.level_system import award_exp_with_limits

router = APIRouter()

@router.get("/api/user/{user_id}", response_model=UserOut)
def get_user_by_id(user_id: str, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    return build_user_response(user, db)

# Add alias for plural endpoint for frontend compatibility
@router.get("/api/users/{user_id}", response_model=UserOut)
def get_user_by_id_alias(user_id: str, db: Session = Depends(get_db)):
    return get_user_by_id(user_id, db)

@router.post("/api/update-profile")
async def update_profile(
    name: str = Form(...),
    bio: str = Form(None),
    profile_pic: UploadFile = File(None),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    if not current_user:
        raise HTTPException(status_code=404, detail="User not found")
    
    error = validate_account_fields(name=name)
    if error:
        raise HTTPException(status_code=400, detail=error)

    current_user.name = name
    if bio is not None:
        current_user.bio = bio

    if profile_pic:
        # Save the uploaded profile picture locally and store the relative path
        current_user.profile_pic = save_image(profile_pic.file, 'user', current_user.id, profile_pic.filename)

    db.commit()
    db.refresh(current_user)
    return {"message": "Profile updated"}

# -------------------------- Like/Unlike Endpoints --------------------------

@router.post("/api/like/{entity_type}/{entity_id}")
def like_entity(
    entity_type: str,
    entity_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    entity_map = {
        "character": (Character, UserLikedCharacter, "character_id"),
        "scene": (Scene, UserLikedScene, "scene_id"),
        "persona": (Persona, UserLikedPersona, "persona_id"),
    }
    if entity_type not in entity_map:
        raise HTTPException(status_code=400, detail="Invalid entity type")

    Model, LikeModel, id_field = entity_map[entity_type]
    entity = db.query(Model).filter(getattr(Model, "id") == entity_id).first()
    if not entity:
        raise HTTPException(status_code=404, detail=f"{entity_type.capitalize()} not found")

    # Get the creator of the entity
    creator = db.query(User).filter(User.id == entity.creator_id).first() if getattr(entity, "creator_id", None) else None
    if not creator:
        raise HTTPException(status_code=404, detail=f"{entity_type.capitalize()} creator not found")

    # Check if user already liked this entity
    filter_kwargs = {"user_id": current_user.id, id_field: entity_id}
    existing_like = db.query(LikeModel).filter_by(**filter_kwargs).first()
    if existing_like:
        raise HTTPException(status_code=400, detail=f"Already liked this {entity_type}")

    # Create like record
    like = LikeModel(user_id=current_user.id, **{id_field: entity_id})
    db.add(like)

    # Update entity like count
    entity.likes = (entity.likes or 0) + 1

    # Update creator's total likes count
    creator.likes = (creator.likes or 0) + 1

    # Update user's liked tags (if entity has tags)
    tags = getattr(entity, "tags", [])
    for tag in tags or []:
        db_tag = db.query(Tag).filter(Tag.name == tag).first()
        if db_tag:
            db_tag.likes += 1
        if tag not in current_user.liked_tags:
            current_user.liked_tags = current_user.liked_tags + [tag]

    db.commit()

    # Award EXP to creator when their character is liked
    if entity_type == "character" and creator:
        award_exp_with_limits(creator, "character_liked", db)

    return {"likes": entity.likes}

# Unlike route for character, scene, or persona
@router.post("/api/unlike/{entity_type}/{entity_id}")
def unlike_entity(
    entity_type: str,
    entity_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    entity_map = {
        "character": (Character, UserLikedCharacter, "character_id"),
        "scene": (Scene, UserLikedScene, "scene_id"),
        "persona": (Persona, UserLikedPersona, "persona_id"),
    }
    if entity_type not in entity_map:
        raise HTTPException(status_code=400, detail="Invalid entity type")

    Model, LikeModel, id_field = entity_map[entity_type]
    entity = db.query(Model).filter(getattr(Model, "id") == entity_id).first()
    if not entity:
        raise HTTPException(status_code=404, detail=f"{entity_type.capitalize()} not found")

    creator = db.query(User).filter(User.id == entity.creator_id).first() if getattr(entity, "creator_id", None) else None
    if not creator:
        raise HTTPException(status_code=404, detail=f"{entity_type.capitalize()} creator not found")

    filter_kwargs = {"user_id": current_user.id, id_field: entity_id}
    existing_like = db.query(LikeModel).filter_by(**filter_kwargs).first()
    if not existing_like:
        raise HTTPException(status_code=400, detail=f"You have not liked this {entity_type}")

    db.delete(existing_like)

    # Update entity like count
    if entity.likes and entity.likes > 0:
        entity.likes -= 1

    # Update creator's total likes count
    if creator.likes and creator.likes > 0:
        creator.likes -= 1

    # Update user's liked tags (if entity has tags)
    tags = getattr(entity, "tags", [])
    for tag in tags or []:
        db_tag = db.query(Tag).filter(Tag.name == tag).first()
        if db_tag and db_tag.likes and db_tag.likes > 0:
            db_tag.likes -= 1
        if tag in current_user.liked_tags:
            # Remove tag if user has no more likes for this tag
            # (Optional: check if user still likes any entity with this tag)
            current_user.liked_tags = [t for t in current_user.liked_tags if t != tag]

    db.commit()
    return {"likes": entity.likes}


from typing import Optional

# ...existing code...

# -------------------------- Check Liked Status for Multiple Entities --------------------------

@router.get("/api/is-liked-multi")
def is_liked_multi(
    character_id: Optional[int] = Query(None),
    scene_id: Optional[int] = Query(None),
    persona_id: Optional[int] = Query(None),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    if not current_user:
        raise HTTPException(status_code=401, detail="Not authenticated")

    result = {}

    if character_id is not None:
        like = db.query(UserLikedCharacter).filter_by(user_id=current_user.id, character_id=character_id).first()
        result["character"] = {"id": character_id, "liked": bool(like)}

    if scene_id is not None:
        like = db.query(UserLikedScene).filter_by(user_id=current_user.id, scene_id=scene_id).first()
        result["scene"] = {"id": scene_id, "liked": bool(like)}

    if persona_id is not None:
        like = db.query(UserLikedPersona).filter_by(user_id=current_user.id, persona_id=persona_id).first()
        result["persona"] = {"id": persona_id, "liked": bool(like)}

    return result


# -------------------------- Increment Views for Multiple Entities --------------------------
from fastapi import Body

@router.post("/api/views/increment-multi")
def increment_views_multi(
    payload: dict = Body(...),
    db: Session = Depends(get_db)
):
    character_id = payload.get("character_id")
    scene_id = payload.get("scene_id")
    persona_id = payload.get("persona_id")

    updated = {}

    if character_id is not None:
        char = db.query(Character).filter(Character.id == character_id).first()
        if char:
            char.views = (char.views or 0) + 1
            updated["character"] = {"id": character_id, "views": char.views}
            creator = db.query(User).filter(User.id == char.creator_id).first() if char.creator_id else None
            if creator:
                creator.views = (creator.views or 0) + 1

    if scene_id is not None:
        scene = db.query(Scene).filter(Scene.id == scene_id).first()
        if scene:
            scene.views = (scene.views or 0) + 1
            updated["scene"] = {"id": scene_id, "views": scene.views}
            creator = db.query(User).filter(User.id == scene.creator_id).first() if scene.creator_id else None
            if creator:
                creator.views = (creator.views or 0) + 1

    if persona_id is not None:
        persona = db.query(Persona).filter(Persona.id == persona_id).first()
        if persona:
            persona.views = (persona.views or 0) + 1
            updated["persona"] = {"id": persona_id, "views": persona.views}
            creator = db.query(User).filter(User.id == persona.creator_id).first() if persona.creator_id else None
            if creator:
                creator.views = (creator.views or 0) + 1

    db.commit()
    return {"message": "views updated", "updated": updated}


@router.post('/api/change-email')
def request_change_email(payload: dict = Body(...), current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    # payload expected: { newEmail: '...' }
    new_email = None
    if payload:
        new_email = payload.get('newEmail') or payload.get('new_email') or payload.get('newEmail')
    if not new_email:
        raise HTTPException(status_code=400, detail='Missing new email')
    # ensure not already used
    exists = db.query(User).filter(User.email == new_email).first()
    if exists:
        raise HTTPException(status_code=400, detail='Email already in use')
    # Directly replace user's email (no confirmation)
    current_user.email = new_email
    db.commit()
    return {"message": "Email updated"}


@router.post('/api/delete-account')
def delete_account(payload: dict = Body(...), current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    # payload must include { confirm: true }
    confirm = payload.get('confirm') is True
    if not confirm:
        raise HTTPException(status_code=400, detail='Missing confirmation')
    # Attempt to delete user's profile image from local storage
    try:
        from utils.local_storage_utils import delete_image
        try:
            delete_image('user', current_user.id)
        except Exception:
            # non-fatal - continue
            pass
    except Exception:
        # utils may not be available; continue
        pass

    # Hard delete the user row (this should cascade deletes for related junction tables)
    db.delete(current_user)
    db.commit()
    return {"message": "Account deleted"}

