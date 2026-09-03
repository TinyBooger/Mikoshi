"""Admin API: ban appeal and content ban appeal queues."""

from datetime import datetime, UTC

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import desc
from sqlalchemy.orm import Session

from database import get_db
from models import (
    User,
    Character,
    Scene,
    Persona,
    BanAppeal,
    ContentBanAppeal,
)
from utils.session import get_current_admin_user

router = APIRouter(tags=["admin"])


class AppealActionRequest(BaseModel):
    action: str           # "approve" | "reject"
    reply: str            # required reply message sent to user


@router.get("/moderation/appeals")
def get_appeals(
    status: str = "pending",
    db: Session = Depends(get_db),
    current_admin: User = Depends(get_current_admin_user),
):
    """List ban appeals. status=pending|approved|rejected|all - Admin only."""
    query = db.query(BanAppeal)
    if status and status != "all":
        query = query.filter(BanAppeal.status == status)

    appeals = query.order_by(desc(BanAppeal.created_at)).all()
    result = []
    for appeal in appeals:
        appellant = db.query(User).filter(User.id == appeal.user_id).first()
        resolver = None
        if appeal.resolved_by:
            resolver = db.query(User).filter(User.id == appeal.resolved_by).first()
        result.append({
            "id": appeal.id,
            "user_id": appeal.user_id,
            "user_name": appellant.name if appellant else None,
            "user_email": appellant.email if appellant else None,
            "ban_type": appeal.ban_type,
            "ban_reason": appellant.ban_reason if appellant else None,
            "ban_note": appellant.ban_note if appellant else None,
            "ban_until": appellant.ban_until.isoformat() if appellant and appellant.ban_until else None,
            "current_ban_type": appellant.ban_type if appellant else None,
            "reason": appeal.reason,
            "status": appeal.status,
            "admin_reply": appeal.admin_reply,
            "created_at": appeal.created_at.isoformat(),
            "resolved_at": appeal.resolved_at.isoformat() if appeal.resolved_at else None,
            "resolved_by_name": resolver.name if resolver else None,
        })
    return result


@router.post("/moderation/appeals/{appeal_id}/action")
def resolve_appeal(
    appeal_id: int,
    payload: AppealActionRequest,
    db: Session = Depends(get_db),
    current_admin: User = Depends(get_current_admin_user),
):
    """Approve or reject a ban appeal with a required reply message - Admin only."""
    appeal = db.query(BanAppeal).filter(BanAppeal.id == appeal_id).first()
    if not appeal:
        raise HTTPException(status_code=404, detail="Appeal not found")
    if appeal.status != "pending":
        raise HTTPException(status_code=400, detail="Appeal has already been resolved")

    action = (payload.action or "").strip().lower()
    if action not in {"approve", "reject"}:
        raise HTTPException(status_code=400, detail="action must be 'approve' or 'reject'")

    reply = (payload.reply or "").strip()

    now = datetime.now(UTC)
    appeal.status = "approved" if action == "approve" else "rejected"
    appeal.admin_reply = reply or None
    appeal.resolved_at = now
    appeal.resolved_by = current_admin.id

    if action == "approve":
        user = db.query(User).filter(User.id == appeal.user_id).first()
        if user:
            user.ban_type = None
            user.ban_until = None
            user.ban_reason = None
            user.ban_note = None

    # Send inbox message to the user (only if a reply was provided)
    if reply:
        from routes.user_messages import _send_appeal_result_message
        _send_appeal_result_message(
            db=db,
            user_id=appeal.user_id,
            action=action,
            reply=reply,
            admin_id=current_admin.id,
        )

    db.commit()
    return {"message": f"Appeal #{appeal_id} {appeal.status}", "ok": True}


def _get_entity_for_appeal(entity_type: str, entity_id: int, db: Session):
    if entity_type == "character":
        return db.query(Character).filter(Character.id == entity_id).first()
    if entity_type == "scene":
        return db.query(Scene).filter(Scene.id == entity_id).first()
    if entity_type == "persona":
        return db.query(Persona).filter(Persona.id == entity_id).first()
    return None


@router.get("/moderation/content-appeals")
def get_content_appeals(
    status: str = "pending",
    db: Session = Depends(get_db),
    current_admin: User = Depends(get_current_admin_user),
):
    """List content ban appeals. status=pending|approved|rejected|all - Admin only."""
    query = db.query(ContentBanAppeal)
    if status and status != "all":
        query = query.filter(ContentBanAppeal.status == status)

    appeals = query.order_by(desc(ContentBanAppeal.created_at)).all()
    result = []
    for appeal in appeals:
        creator = db.query(User).filter(User.id == appeal.creator_id).first()
        resolver = None
        if appeal.resolved_by:
            resolver = db.query(User).filter(User.id == appeal.resolved_by).first()
        entity = _get_entity_for_appeal(appeal.entity_type, appeal.entity_id, db)
        result.append({
            "id": appeal.id,
            "entity_type": appeal.entity_type,
            "entity_id": appeal.entity_id,
            "entity_name": entity.name if entity else None,
            "entity_moderation_status": entity.moderation_status if entity else None,
            "creator_id": appeal.creator_id,
            "creator_name": creator.name if creator else None,
            "creator_email": creator.email if creator else None,
            "appeal_reason": appeal.appeal_reason,
            "status": appeal.status,
            "snapshot": appeal.snapshot,
            "admin_reply": appeal.admin_reply,
            "created_at": appeal.created_at.isoformat(),
            "resolved_at": appeal.resolved_at.isoformat() if appeal.resolved_at else None,
            "resolved_by_name": resolver.name if resolver else None,
        })
    return result


@router.post("/moderation/content-appeals/{appeal_id}/action")
def resolve_content_appeal(
    appeal_id: int,
    payload: AppealActionRequest,
    db: Session = Depends(get_db),
    current_admin: User = Depends(get_current_admin_user),
):
    """Approve or reject a content ban appeal with a required reply message - Admin only."""
    appeal = db.query(ContentBanAppeal).filter(ContentBanAppeal.id == appeal_id).first()
    if not appeal:
        raise HTTPException(status_code=404, detail="Content appeal not found")
    if appeal.status != "pending":
        raise HTTPException(status_code=400, detail="Appeal has already been resolved")

    action = (payload.action or "").strip().lower()
    if action not in {"approve", "reject"}:
        raise HTTPException(status_code=400, detail="action must be 'approve' or 'reject'")

    reply = (payload.reply or "").strip()

    now = datetime.now(UTC)
    appeal.status = "approved" if action == "approve" else "rejected"
    appeal.admin_reply = reply or None
    appeal.resolved_at = now
    appeal.resolved_by = current_admin.id

    entity = _get_entity_for_appeal(appeal.entity_type, appeal.entity_id, db)
    entity_name = entity.name if entity else f"{appeal.entity_type} #{appeal.entity_id}"

    if entity:
        entity.appeal_under_review = False

    if action == "approve" and entity:
        entity.moderation_status = None
        entity.is_public = True  # snapshot is taken after ban so is_public=False there; always restore on approval

    # Send inbox message to the creator (only if a reply was provided)
    if reply:
        from routes.user_messages import _send_content_appeal_result_message
        _send_content_appeal_result_message(
            db=db,
            user_id=appeal.creator_id,
            action=action,
            reply=reply,
            entity_type=appeal.entity_type,
            entity_name=entity_name,
            entity_id=appeal.entity_id,
            admin_id=current_admin.id,
        )

    db.commit()
    return {"message": f"Content appeal #{appeal_id} {appeal.status}", "ok": True}
