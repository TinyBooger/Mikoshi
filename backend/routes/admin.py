from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func, desc
from database import get_db
from models import User, Character, Tag, SearchTerm
from utils.session import get_current_admin_user
from typing import List, Optional
from pydantic import BaseModel

router = APIRouter(prefix="/api/admin", tags=["admin"])


# Pydantic models for request bodies
class UserUpdate(BaseModel):
    name: Optional[str] = None
    bio: Optional[str] = None
    is_admin: Optional[bool] = None


class CharacterUpdate(BaseModel):
    name: Optional[str] = None
    persona: Optional[str] = None
    tagline: Optional[str] = None
    greeting: Optional[str] = None
    example_messages: Optional[str] = None
    tags: Optional[List[str]] = None


class TagUpdate(BaseModel):
    name: Optional[str] = None


@router.get("/users")
def get_all_users(
    db: Session = Depends(get_db),
    current_admin: User = Depends(get_current_admin_user)
):
    """Get all users - Admin only"""
    users = db.query(User).all()
    return [
        {
            "id": user.id,
            "email": user.email,
            "name": user.name,
            "is_admin": user.is_admin,
            "status": "active",  # You can add a status field to User model if needed
            "views": user.views,
            "likes": user.likes,
            "profile_pic": user.profile_pic
        }
        for user in users
    ]


@router.get("/characters")
def get_all_characters(
    db: Session = Depends(get_db),
    current_admin: User = Depends(get_current_admin_user)
):
    """Get all characters - Admin only"""
    characters = db.query(Character).all()
    return [
        {
            "id": char.id,
            "name": char.name,
            "tagline": char.tagline,
            "creator_name": char.creator_name,
            "views": char.views,
            "likes": char.likes,
            "created_time": char.created_time,
            "tags": char.tags
        }
        for char in characters
    ]


@router.get("/tags")
def get_all_tags(
    db: Session = Depends(get_db),
    current_admin: User = Depends(get_current_admin_user)
):
    """Get all tags with usage statistics - Admin only"""
    tags = db.query(Tag).order_by(desc(Tag.count)).all()
    return [
        {
            "id": tag.id,
            "name": tag.name,
            "count": tag.count,
            "likes": tag.likes
        }
        for tag in tags
    ]


@router.get("/search-terms")
def get_search_terms(
    db: Session = Depends(get_db),
    current_admin: User = Depends(get_current_admin_user)
):
    """Get all search terms with statistics - Admin only"""
    terms = db.query(SearchTerm).order_by(desc(SearchTerm.search_count)).all()
    return [
        {
            "keyword": term.keyword,
            "search_count": term.search_count,
            "last_searched": term.last_searched
        }
        for term in terms
    ]


@router.delete("/users/{user_id}")
def delete_user(
    user_id: str,
    db: Session = Depends(get_db),
    current_admin: User = Depends(get_current_admin_user)
):
    """Delete a user - Admin only"""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Prevent admin from deleting themselves
    if user.id == current_admin.id:
        raise HTTPException(status_code=400, detail="Cannot delete your own account")
    
    db.delete(user)
    db.commit()
    return {"message": "User deleted successfully"}


@router.delete("/characters/{character_id}")
def delete_character(
    character_id: int,
    db: Session = Depends(get_db),
    current_admin: User = Depends(get_current_admin_user)
):
    """Delete a character - Admin only"""
    character = db.query(Character).filter(Character.id == character_id).first()
    if not character:
        raise HTTPException(status_code=404, detail="Character not found")
    
    db.delete(character)
    db.commit()
    return {"message": "Character deleted successfully"}


@router.delete("/tags/{tag_id}")
def delete_tag(
    tag_id: int,
    db: Session = Depends(get_db),
    current_admin: User = Depends(get_current_admin_user)
):
    """Delete a tag - Admin only"""
    tag = db.query(Tag).filter(Tag.id == tag_id).first()
    if not tag:
        raise HTTPException(status_code=404, detail="Tag not found")
    
    db.delete(tag)
    db.commit()
    return {"message": "Tag deleted successfully"}


@router.patch("/users/{user_id}/toggle-admin")
def toggle_admin_status(
    user_id: str,
    db: Session = Depends(get_db),
    current_admin: User = Depends(get_current_admin_user)
):
    """Toggle admin status for a user - Admin only"""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Prevent admin from removing their own admin status
    if user.id == current_admin.id:
        raise HTTPException(status_code=400, detail="Cannot modify your own admin status")
    
    user.is_admin = not user.is_admin
    db.commit()
    
    return {
        "message": f"User {'granted' if user.is_admin else 'revoked'} admin privileges",
        "is_admin": user.is_admin
    }


@router.patch("/users/{user_id}")
def update_user(
    user_id: str,
    update_data: UserUpdate,
    db: Session = Depends(get_db),
    current_admin: User = Depends(get_current_admin_user)
):
    """Update user details - Admin only"""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Update only provided fields
    if update_data.name is not None:
        user.name = update_data.name
    if update_data.bio is not None:
        user.bio = update_data.bio
    if update_data.is_admin is not None:
        # Prevent admin from removing their own admin status
        if user.id == current_admin.id and not update_data.is_admin:
            raise HTTPException(status_code=400, detail="Cannot remove your own admin status")
        user.is_admin = update_data.is_admin
    
    db.commit()
    db.refresh(user)
    
    return {
        "message": "User updated successfully",
        "user": {
            "id": user.id,
            "email": user.email,
            "name": user.name,
            "bio": user.bio,
            "is_admin": user.is_admin
        }
    }


@router.patch("/characters/{character_id}")
def update_character(
    character_id: int,
    update_data: CharacterUpdate,
    db: Session = Depends(get_db),
    current_admin: User = Depends(get_current_admin_user)
):
    """Update character details - Admin only"""
    character = db.query(Character).filter(Character.id == character_id).first()
    if not character:
        raise HTTPException(status_code=404, detail="Character not found")
    
    # Update only provided fields
    if update_data.name is not None:
        # Check if name already exists (for another character)
        existing = db.query(Character).filter(
            Character.name == update_data.name,
            Character.id != character_id
        ).first()
        if existing:
            raise HTTPException(status_code=400, detail="Character name already exists")
        character.name = update_data.name
    
    if update_data.persona is not None:
        character.persona = update_data.persona
    if update_data.tagline is not None:
        character.tagline = update_data.tagline
    if update_data.greeting is not None:
        character.greeting = update_data.greeting
    if update_data.example_messages is not None:
        character.example_messages = update_data.example_messages
    if update_data.tags is not None:
        character.tags = update_data.tags
    
    db.commit()
    db.refresh(character)
    
    return {
        "message": "Character updated successfully",
        "character": {
            "id": character.id,
            "name": character.name,
            "tagline": character.tagline,
            "persona": character.persona,
            "greeting": character.greeting,
            "tags": character.tags
        }
    }


@router.patch("/tags/{tag_id}")
def update_tag(
    tag_id: int,
    update_data: TagUpdate,
    db: Session = Depends(get_db),
    current_admin: User = Depends(get_current_admin_user)
):
    """Update tag - Admin only"""
    tag = db.query(Tag).filter(Tag.id == tag_id).first()
    if not tag:
        raise HTTPException(status_code=404, detail="Tag not found")
    
    if update_data.name is not None:
        # Check if name already exists
        existing = db.query(Tag).filter(
            Tag.name == update_data.name,
            Tag.id != tag_id
        ).first()
        if existing:
            raise HTTPException(status_code=400, detail="Tag name already exists")
        tag.name = update_data.name
    
    db.commit()
    db.refresh(tag)
    
    return {
        "message": "Tag updated successfully",
        "tag": {
            "id": tag.id,
            "name": tag.name,
            "count": tag.count,
            "likes": tag.likes
        }
    }


@router.post("/tags")
def create_tag(
    update_data: TagUpdate,
    db: Session = Depends(get_db),
    current_admin: User = Depends(get_current_admin_user)
):
    """Create a new tag - Admin only"""
    if not update_data.name:
        raise HTTPException(status_code=400, detail="Tag name is required")
    
    # Check if tag already exists
    existing = db.query(Tag).filter(Tag.name == update_data.name).first()
    if existing:
        raise HTTPException(status_code=400, detail="Tag already exists")
    
    new_tag = Tag(name=update_data.name, count=0, likes=0)
    db.add(new_tag)
    db.commit()
    db.refresh(new_tag)
    
    return {
        "message": "Tag created successfully",
        "tag": {
            "id": new_tag.id,
            "name": new_tag.name,
            "count": new_tag.count,
            "likes": new_tag.likes
        }
    }


@router.delete("/search-terms/{keyword}")
def delete_search_term(
    keyword: str,
    db: Session = Depends(get_db),
    current_admin: User = Depends(get_current_admin_user)
):
    """Delete a search term - Admin only"""
    term = db.query(SearchTerm).filter(SearchTerm.keyword == keyword).first()
    if not term:
        raise HTTPException(status_code=404, detail="Search term not found")
    
    db.delete(term)
    db.commit()
    return {"message": "Search term deleted successfully"}


