"""Admin API: content management (characters, scenes, personas, tags, search
terms) - listing, editing and deletion.
"""

from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import desc
from sqlalchemy.orm import Session

from database import get_db
from models import User, Character, Scene, Persona, Tag, SearchTerm
from utils.session import get_current_admin_user
from utils.local_storage_utils import delete_stored_image

router = APIRouter(tags=["admin"])


# Pydantic models for request bodies
class CharacterUpdate(BaseModel):
    name: Optional[str] = None
    persona: Optional[str] = None
    tagline: Optional[str] = None
    greetings: Optional[List[str]] = None
    example_messages: Optional[str] = None
    tags: Optional[List[str]] = None
    is_public: Optional[bool] = None
    is_forkable: Optional[bool] = None


class SceneUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    intro: Optional[str] = None
    greeting: Optional[str] = None
    tags: Optional[List[str]] = None
    is_public: Optional[bool] = None
    is_forkable: Optional[bool] = None


class PersonaUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    intro: Optional[str] = None
    tags: Optional[List[str]] = None
    is_public: Optional[bool] = None
    is_forkable: Optional[bool] = None


class TagUpdate(BaseModel):
    name: Optional[str] = None


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
            "is_public": char.is_public,
            "is_forkable": char.is_forkable,
            "views": char.views,
            "likes": char.likes,
            "created_time": char.created_time,
            "tags": char.tags
        }
        for char in characters
    ]


@router.get("/scenes")
def get_all_scenes(
    db: Session = Depends(get_db),
    current_admin: User = Depends(get_current_admin_user)
):
    """Get all scenes - Admin only"""
    scenes = db.query(Scene).all()
    return [
        {
            "id": s.id,
            "name": s.name,
            "intro": s.intro,
            "creator_name": s.creator_name,
            "is_public": s.is_public,
            "is_forkable": s.is_forkable,
            "views": s.views,
            "likes": s.likes,
            "moderation_status": s.moderation_status,
            "created_time": s.created_time,
            "tags": s.tags,
        }
        for s in scenes
    ]


@router.get("/personas")
def get_all_personas(
    db: Session = Depends(get_db),
    current_admin: User = Depends(get_current_admin_user)
):
    """Get all personas - Admin only"""
    personas = db.query(Persona).all()
    return [
        {
            "id": p.id,
            "name": p.name,
            "intro": p.intro,
            "creator_name": p.creator_name,
            "is_public": p.is_public,
            "is_forkable": p.is_forkable,
            "views": p.views,
            "likes": p.likes,
            "moderation_status": p.moderation_status,
            "created_time": p.created_time,
            "tags": p.tags,
        }
        for p in personas
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

    picture_path = character.picture
    avatar_path = character.avatar_picture
    db.delete(character)
    db.commit()
    delete_stored_image(picture_path)
    delete_stored_image(avatar_path)
    return {"message": "角色已删除"}


@router.delete("/scenes/{scene_id}")
def delete_scene(
    scene_id: int,
    db: Session = Depends(get_db),
    current_admin: User = Depends(get_current_admin_user)
):
    """Delete a scene - Admin only"""
    scene = db.query(Scene).filter(Scene.id == scene_id).first()
    if not scene:
        raise HTTPException(status_code=404, detail="Scene not found")
    picture_path = scene.picture
    db.delete(scene)
    db.commit()
    delete_stored_image(picture_path)
    return {"message": "Scene deleted successfully"}


@router.delete("/personas/{persona_id}")
def delete_persona(
    persona_id: int,
    db: Session = Depends(get_db),
    current_admin: User = Depends(get_current_admin_user)
):
    """Delete a persona - Admin only"""
    persona = db.query(Persona).filter(Persona.id == persona_id).first()
    if not persona:
        raise HTTPException(status_code=404, detail="Persona not found")
    picture_path = persona.picture
    avatar_path = persona.avatar_picture
    db.delete(persona)
    db.commit()
    delete_stored_image(picture_path)
    delete_stored_image(avatar_path)
    return {"message": "Persona deleted successfully"}


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
    if update_data.greetings is not None:
        character.greetings = update_data.greetings
    if update_data.example_messages is not None:
        character.example_messages = update_data.example_messages
    if update_data.tags is not None:
        character.tags = update_data.tags
    if update_data.is_public is not None:
        character.is_public = update_data.is_public
    if update_data.is_forkable is not None:
        character.is_forkable = update_data.is_forkable

    db.commit()
    db.refresh(character)

    return {
        "message": "Character updated successfully",
        "character": {
            "id": character.id,
            "name": character.name,
            "tagline": character.tagline,
            "persona": character.persona,
            "greetings": character.greetings,
            "tags": character.tags,
            "is_public": character.is_public,
            "is_forkable": character.is_forkable,
        }
    }


@router.patch("/scenes/{scene_id}")
def update_scene(
    scene_id: int,
    update_data: SceneUpdate,
    db: Session = Depends(get_db),
    current_admin: User = Depends(get_current_admin_user)
):
    """Update scene details - Admin only"""
    scene = db.query(Scene).filter(Scene.id == scene_id).first()
    if not scene:
        raise HTTPException(status_code=404, detail="Scene not found")

    if update_data.name is not None:
        scene.name = update_data.name
    if update_data.description is not None:
        scene.description = update_data.description
    if update_data.intro is not None:
        scene.intro = update_data.intro
    if update_data.greeting is not None:
        scene.greeting = update_data.greeting
    if update_data.tags is not None:
        scene.tags = update_data.tags
    if update_data.is_public is not None:
        scene.is_public = update_data.is_public
    if update_data.is_forkable is not None:
        scene.is_forkable = update_data.is_forkable

    db.commit()
    db.refresh(scene)
    return {
        "message": "Scene updated successfully",
        "scene": {
            "id": scene.id,
            "name": scene.name,
            "intro": scene.intro,
            "tags": scene.tags,
            "is_public": scene.is_public,
            "is_forkable": scene.is_forkable,
        }
    }


@router.patch("/personas/{persona_id}")
def update_persona(
    persona_id: int,
    update_data: PersonaUpdate,
    db: Session = Depends(get_db),
    current_admin: User = Depends(get_current_admin_user)
):
    """Update persona details - Admin only"""
    persona = db.query(Persona).filter(Persona.id == persona_id).first()
    if not persona:
        raise HTTPException(status_code=404, detail="Persona not found")

    if update_data.name is not None:
        persona.name = update_data.name
    if update_data.description is not None:
        persona.description = update_data.description
    if update_data.intro is not None:
        persona.intro = update_data.intro
    if update_data.tags is not None:
        persona.tags = update_data.tags
    if update_data.is_public is not None:
        persona.is_public = update_data.is_public
    if update_data.is_forkable is not None:
        persona.is_forkable = update_data.is_forkable

    db.commit()
    db.refresh(persona)
    return {
        "message": "Persona updated successfully",
        "persona": {
            "id": persona.id,
            "name": persona.name,
            "intro": persona.intro,
            "tags": persona.tags,
            "is_public": persona.is_public,
            "is_forkable": persona.is_forkable,
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
