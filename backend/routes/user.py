from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, Query, Body
from schemas import UserOut, UserListOut
from sqlalchemy.orm import Session
from database import get_db
from models import User, Character, Scene, Persona, Tag, UserLikedCharacter, UserLikedScene, UserLikedPersona
from utils.session import get_current_user
from utils.local_storage_utils import save_image
from utils.user_utils import build_user_response, enrich_user_with_character_count
from utils.validators import validate_account_fields
from utils.level_system import award_exp_with_limits
from utils.badge_system import check_and_award_chat_badges, award_badge
from utils.sms_utils import send_verification_code, verify_code
import re

router = APIRouter()

# --- Browse Users Endpoints (MUST come before {user_id} route) ---

@router.get("/api/users/browse", response_model=UserListOut)
def browse_users(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db)
):
    """Get users sorted by views (descending)"""
    query = db.query(User).order_by(User.views.desc(), User.level.desc())
    total = query.count()
    users = query.offset((page - 1) * page_size).limit(page_size).all()
    items = [enrich_user_with_character_count(user, db) for user in users]
    return UserListOut(items=items, total=total, page=page, page_size=page_size)

@router.get("/api/users/popular", response_model=UserListOut)
def get_popular_users(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db)
):
    """Get popular users sorted by views and level"""
    query = db.query(User).order_by(User.views.desc(), User.level.desc())
    total = query.count()
    users = query.offset((page - 1) * page_size).limit(page_size).all()
    items = [enrich_user_with_character_count(user, db) for user in users]
    return UserListOut(items=items, total=total, page=page, page_size=page_size)

@router.get("/api/users/recent", response_model=UserListOut)
def get_recent_users(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db)
):
    """Get recently active users sorted by level and experience"""
    query = db.query(User).order_by(User.level.desc(), User.exp.desc())
    total = query.count()
    users = query.offset((page - 1) * page_size).limit(page_size).all()
    items = [enrich_user_with_character_count(user, db) for user in users]
    return UserListOut(items=items, total=total, page=page, page_size=page_size)

@router.get("/api/users/recommended", response_model=UserListOut)
def get_recommended_users(
    current_user: User = Depends(get_current_user),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db)
):
    """Get recommended users based on liked tags and level"""
    if not current_user:
        # Return popular users if not authenticated
        query = db.query(User).order_by(User.views.desc(), User.level.desc())
        total = query.count()
        users = query.offset((page - 1) * page_size).limit(page_size).all()
        items = [enrich_user_with_character_count(user, db) for user in users]
        return UserListOut(items=items, total=total, page=page, page_size=page_size)
    
    # Recommend users with similar level or high engagement
    # Exclude current user
    query = db.query(User).filter(User.id != current_user.id)
    
    # Order by level proximity and views
    query = query.order_by(User.views.desc(), User.level.desc())
    total = query.count()
    users = query.offset((page - 1) * page_size).limit(page_size).all()
    items = [enrich_user_with_character_count(user, db) for user in users]
    return UserListOut(items=items, total=total, page=page, page_size=page_size)

# --- Single User Endpoints (comes AFTER specific routes above) ---

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
    # Exclude current user
    query = db.query(User).filter(User.id != current_user.id)
    
    # Order by level proximity and views
    query = query.order_by(User.views.desc(), User.level.desc())
    total = query.count()
    users = query.offset((page - 1) * page_size).limit(page_size).all()
    return UserListOut(items=users, total=total, page=page, page_size=page_size)

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


@router.post('/api/change-phone/send-current-code')
async def send_code_to_current_phone(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    步骤1：发送验证码到当前手机号
    """
    if not current_user.phone_number:
        raise HTTPException(status_code=400, detail='当前账号未绑定手机号')
    
    # 发送验证码到当前手机号
    result = await send_verification_code(current_user.phone_number)
    
    if not result.get('success'):
        raise HTTPException(status_code=400, detail=result.get('message', '发送验证码失败'))
    
    return {
        "message": "验证码已发送到当前手机号",
        "phone_hint": current_user.phone_number[-4:]  # 只返回后4位
    }


@router.post('/api/change-phone/verify-current')
async def verify_current_phone(
    payload: dict = Body(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    步骤2：验证当前手机号的验证码
    """
    code = payload.get('code')
    if not code:
        raise HTTPException(status_code=400, detail='请输入验证码')
    
    if not current_user.phone_number:
        raise HTTPException(status_code=400, detail='当前账号未绑定手机号')
    
    # 验证验证码
    if not verify_code(current_user.phone_number, code):
        raise HTTPException(status_code=400, detail='验证码错误或已过期')
    
    return {"message": "当前手机号验证成功", "verified": True}


@router.post('/api/change-phone/send-new-code')
async def send_code_to_new_phone(
    payload: dict = Body(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    步骤3：发送验证码到新手机号
    """
    new_phone = payload.get('newPhone')
    if not new_phone:
        raise HTTPException(status_code=400, detail='请输入新手机号')
    
    # 验证手机号格式
    if not re.match(r'^1[3-9]\d{9}$', new_phone):
        raise HTTPException(status_code=400, detail='手机号格式不正确')
    
    # 检查新手机号是否已被使用
    existing_user = db.query(User).filter(User.phone_number == new_phone).first()
    if existing_user:
        raise HTTPException(status_code=400, detail='该手机号已被其他账号使用')
    
    # 发送验证码到新手机号
    result = await send_verification_code(new_phone)
    
    if not result.get('success'):
        raise HTTPException(status_code=400, detail=result.get('message', '发送验证码失败'))
    
    return {
        "message": "验证码已发送到新手机号",
        "phone_hint": new_phone[-4:]
    }


@router.post('/api/change-phone/confirm')
async def confirm_phone_change(
    payload: dict = Body(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    步骤4：验证新手机号验证码并完成更换
    """
    new_phone = payload.get('newPhone')
    code = payload.get('code')
    
    if not new_phone or not code:
        raise HTTPException(status_code=400, detail='缺少必要参数')
    
    # 验证手机号格式
    if not re.match(r'^1[3-9]\d{9}$', new_phone):
        raise HTTPException(status_code=400, detail='手机号格式不正确')
    
    # 再次检查新手机号是否已被使用
    existing_user = db.query(User).filter(User.phone_number == new_phone).first()
    if existing_user:
        raise HTTPException(status_code=400, detail='该手机号已被其他账号使用')
    
    # 验证新手机号的验证码
    if not verify_code(new_phone, code):
        raise HTTPException(status_code=400, detail='验证码错误或已过期')
    
    # 更新手机号
    old_phone = current_user.phone_number
    current_user.phone_number = new_phone
    db.commit()
    
    return {
        "message": "手机号更换成功",
        "old_phone_hint": old_phone[-4:] if old_phone else "",
        "new_phone_hint": new_phone[-4:]
    }


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


# ----------------------- Badge Endpoints -----------------------

@router.get("/api/badges")
def get_all_badges():
    """Get information about all available badges"""
    from utils.badge_system import get_all_badges_info
    return get_all_badges_info()


@router.get("/api/user/{user_id}/badges")
def get_user_badges(user_id: str, db: Session = Depends(get_db)):
    """Get all badges for a user"""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return {"badges": user.badges or {}}


@router.post("/api/user/badges/check-and-award")
def check_and_award_badges(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Check if current user qualifies for any new badges and award them.
    Returns list of newly awarded badges.
    Called when user visits their own profile.
    """
    if not current_user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    newly_awarded = check_and_award_chat_badges(current_user, db)
    
    # Return newly awarded badges with their details
    awarded_badges = {}
    if newly_awarded:
        for badge_key in newly_awarded:
            if badge_key in current_user.badges:
                awarded_badges[badge_key] = current_user.badges[badge_key]
    
    return {
        "newly_awarded": newly_awarded,
        "badges": awarded_badges,
        "message": f"Congratulations! You earned {len(newly_awarded)} new badge(s)!" if newly_awarded else "No new badges earned"
    }


@router.post("/api/admin/badges/{user_id}/award")
def admin_award_badge(
    user_id: str,
    badge_key: str = Form(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Admin endpoint to manually award a badge to a user (e.g., Pioneer badge)"""
    if not current_user or not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Only admins can award badges")
    
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    success = award_badge(user, badge_key, db)
    if success:
        return {"message": f"Badge {badge_key} awarded to user {user_id}"}
    else:
        raise HTTPException(status_code=400, detail=f"User already has badge {badge_key} or badge doesn't exist")


@router.post("/api/admin/badges/{user_id}/remove")
def admin_remove_badge(
    user_id: str,
    badge_key: str = Form(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Admin endpoint to remove a badge from a user"""
    if not current_user or not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Only admins can remove badges")
    
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    from utils.badge_system import remove_badge
    success = remove_badge(user, badge_key, db)
    if success:
        return {"message": f"Badge {badge_key} removed from user {user_id}"}
    else:
        raise HTTPException(status_code=400, detail=f"User doesn't have badge {badge_key}")


@router.post("/api/user/active-badge")
def set_active_badge(
    payload: dict = Body(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Set the active/displayed badge for current user.
    Payload: { "badge_key": "bronze_creator" } or { "badge_key": null } to remove
    """
    if not current_user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    badge_key = payload.get("badge_key")
    
    # If badge_key is None, allow removing active badge
    if badge_key is None:
        current_user.active_badge = None
        db.commit()
        return {"message": "Active badge removed", "active_badge": None}
    
    # Validate user has this badge
    if badge_key not in (current_user.badges or {}):
        raise HTTPException(status_code=400, detail=f"You don't have badge {badge_key}")
    
    current_user.active_badge = badge_key
    db.commit()
    
    return {
        "message": f"Active badge set to {badge_key}",
        "active_badge": badge_key,
        "badge_info": current_user.badges[badge_key]
    }
