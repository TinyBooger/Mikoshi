"""
Routes for content ban appeals (restricted / taken-down characters, scenes, personas).

Creator flow:
  POST  /api/content-ban-appeal
        Submit an appeal after editing banned content.  Body: { entity_type, entity_id, appeal_reason }
  GET   /api/content-ban-appeal/{entity_type}/{entity_id}
        List all appeals for a specific content item (creator or admin).

Admin flow — see admin.py which imports helpers from this module.
"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import desc
from datetime import datetime, UTC
from typing import Optional
from pydantic import BaseModel

from database import get_db
from models import User, Character, Scene, Persona, ContentBanAppeal
from utils.session import get_current_user

router = APIRouter(tags=["content_ban_appeals"])


# ─── helpers ──────────────────────────────────────────────────────────────────

def _get_entity(entity_type: str, entity_id: int, db: Session):
    """Return the ORM object for the given entity type/id, or None."""
    if entity_type == "character":
        return db.query(Character).filter(Character.id == entity_id).first()
    if entity_type == "scene":
        return db.query(Scene).filter(Scene.id == entity_id).first()
    if entity_type == "persona":
        return db.query(Persona).filter(Persona.id == entity_id).first()
    return None


def _build_snapshot(entity, entity_type: str) -> dict:
    """Capture a lightweight snapshot of the current entity fields."""
    if entity_type == "character":
        return {
            "name": entity.name,
            "tagline": getattr(entity, "tagline", None),
            "persona": entity.persona,
            "greeting": entity.greeting,
            "example_messages": getattr(entity, "example_messages", None),
            "tags": entity.tags or [],
            "is_public": entity.is_public,
            "moderation_status": entity.moderation_status,
        }
    if entity_type == "scene":
        return {
            "name": entity.name,
            "tagline": getattr(entity, "tagline", None),
            "description": getattr(entity, "description", None),
            "tags": entity.tags or [],
            "is_public": entity.is_public,
            "moderation_status": entity.moderation_status,
        }
    if entity_type == "persona":
        return {
            "name": entity.name,
            "description": getattr(entity, "description", None),
            "tags": entity.tags or [],
            "is_public": entity.is_public,
            "moderation_status": entity.moderation_status,
        }
    return {}


# ─── request bodies ───────────────────────────────────────────────────────────

class ContentAppealRequest(BaseModel):
    entity_type: str        # character | scene | persona
    entity_id: int
    appeal_reason: str


# ─── creator endpoints ────────────────────────────────────────────────────────

@router.post("/api/content-ban-appeal")
def submit_content_appeal(
    payload: ContentAppealRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Submit an appeal for a restricted or taken-down content item."""
    entity_type = (payload.entity_type or "").strip().lower()
    if entity_type not in {"character", "scene", "persona"}:
        raise HTTPException(status_code=400, detail="entity_type must be character, scene, or persona")

    reason = (payload.appeal_reason or "").strip()
    if not reason:
        raise HTTPException(status_code=422, detail="appeal_reason is required")

    entity = _get_entity(entity_type, payload.entity_id, db)
    if not entity:
        raise HTTPException(status_code=404, detail="Content not found")

    # Only the creator can appeal their own content
    creator_id = getattr(entity, "creator_id", None)
    if creator_id != current_user.id:
        raise HTTPException(status_code=403, detail="You are not the creator of this content")

    # Content must actually be banned
    if not entity.moderation_status:
        raise HTTPException(status_code=400, detail="This content is not currently restricted or taken down")

    # Block duplicate pending appeals
    existing = (
        db.query(ContentBanAppeal)
        .filter(
            ContentBanAppeal.entity_type == entity_type,
            ContentBanAppeal.entity_id == payload.entity_id,
            ContentBanAppeal.status == "pending",
        )
        .first()
    )
    if existing:
        raise HTTPException(status_code=409, detail="A pending appeal already exists for this content")

    snapshot = _build_snapshot(entity, entity_type)

    appeal = ContentBanAppeal(
        entity_type=entity_type,
        entity_id=payload.entity_id,
        creator_id=current_user.id,
        appeal_reason=reason,
        status="pending",
        snapshot=snapshot,
    )
    db.add(appeal)
    db.commit()
    db.refresh(appeal)
    return {
        "id": appeal.id,
        "status": appeal.status,
        "created_at": appeal.created_at.isoformat(),
        "message": "Appeal submitted successfully",
    }


@router.get("/api/content-ban-appeal/{entity_type}/{entity_id}")
def get_content_appeals(
    entity_type: str,
    entity_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Return all appeals for a content item. Accessible by the creator or any admin."""
    entity_type = entity_type.strip().lower()
    if entity_type not in {"character", "scene", "persona"}:
        raise HTTPException(status_code=400, detail="entity_type must be character, scene, or persona")

    entity = _get_entity(entity_type, entity_id, db)
    if not entity:
        raise HTTPException(status_code=404, detail="Content not found")

    creator_id = getattr(entity, "creator_id", None)
    if creator_id != current_user.id and not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Access denied")

    appeals = (
        db.query(ContentBanAppeal)
        .filter(
            ContentBanAppeal.entity_type == entity_type,
            ContentBanAppeal.entity_id == entity_id,
        )
        .order_by(desc(ContentBanAppeal.created_at))
        .all()
    )

    result = []
    for a in appeals:
        resolver = None
        if a.resolved_by:
            resolver = db.query(User).filter(User.id == a.resolved_by).first()
        result.append({
            "id": a.id,
            "entity_type": a.entity_type,
            "entity_id": a.entity_id,
            "appeal_reason": a.appeal_reason,
            "status": a.status,
            "snapshot": a.snapshot,
            "admin_reply": a.admin_reply,
            "created_at": a.created_at.isoformat(),
            "resolved_at": a.resolved_at.isoformat() if a.resolved_at else None,
            "resolved_by_name": resolver.name if resolver else None,
        })
    return result
