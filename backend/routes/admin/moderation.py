"""Admin API: moderation workflows - content review queue, entity reports,
batch actions and direct content moderation.
"""

from datetime import datetime, UTC
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import desc, func
from sqlalchemy.orm import Session

from database import get_db
from models import (
    User,
    Character,
    Scene,
    Persona,
    ProblemReport,
    ContentReviewQueue,
    UserModerationLog,
    ContentModerationLog,
)
from routes.user_messages import create_moderation_message, create_content_moderation_message
from utils.local_storage_utils import delete_stored_image
from utils.session import get_current_admin_user
from .common import _log_user_moderation, _log_content_moderation

router = APIRouter(tags=["admin"])


# Pydantic models for request bodies
class ContentModerationRequest(BaseModel):
    action: str               # restrict | takedown | unban | delete
    notes: Optional[str] = None


class ContentReviewResolveRequest(BaseModel):
    action: str
    notes: Optional[str] = None


class UserModerationActionRequest(BaseModel):
    action: str  # warn | upload_ban | full_ban | shadow_ban | unban | ignore | keep | hide | delete
    notes: Optional[str] = None          # saved as admin_notes on the report
    ban_until: Optional[datetime] = None  # optional expiry for any ban type
    ban_reason: Optional[str] = None      # categorical tag: harassment/spam/abuse/underage/other
    ban_note: Optional[str] = None        # moderator-visible free text note on the ban


class BatchModerationActionRequest(BaseModel):
    report_ids: List[int]
    action: str
    notes: Optional[str] = None
    ban_until: Optional[datetime] = None
    ban_reason: Optional[str] = None
    ban_note: Optional[str] = None


@router.get("/review-queue")
def get_content_review_queue(
    status: str = "pending",
    db: Session = Depends(get_db),
    current_admin: User = Depends(get_current_admin_user)
):
    """Get content review queue entries - Admin only"""
    query = db.query(ContentReviewQueue)
    if status and status != "all":
        query = query.filter(ContentReviewQueue.status == status)

    items = query.order_by(desc(ContentReviewQueue.created_time)).all()
    result = []

    for item in items:
        character = None
        if item.character_id:
            character = db.query(Character).filter(Character.id == item.character_id).first()

        linked_report = None
        if item.triggered_by_report_id:
            linked_report = db.query(ProblemReport).filter(ProblemReport.id == item.triggered_by_report_id).first()

        result.append({
            "id": item.id,
            "character_id": item.character_id,
            "character_name": (character.name if character else item.character_name),
            "character_exists": bool(character),
            "character_is_public": character.is_public if character else None,
            "character_creator_name": character.creator_name if character else None,
            "source": item.source,
            "reason": item.reason,
            "status": item.status,
            "triggered_by_report_id": item.triggered_by_report_id,
            "report_description": linked_report.description if linked_report else None,
            "created_time": item.created_time,
            "updated_time": item.updated_time,
            "resolved_time": item.resolved_time,
            "resolved_by": item.resolved_by,
            "resolution_notes": item.resolution_notes,
        })

    return result


@router.patch("/review-queue/{queue_id}")
def resolve_content_review_queue_item(
    queue_id: int,
    payload: ContentReviewResolveRequest,
    db: Session = Depends(get_db),
    current_admin: User = Depends(get_current_admin_user)
):
    """Resolve review queue entries with an explicit admin action - Admin only"""
    item = db.query(ContentReviewQueue).filter(ContentReviewQueue.id == queue_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Review queue item not found")

    action = (payload.action or "").strip().lower()
    if action not in {"keep", "hide", "delete"}:
        raise HTTPException(status_code=400, detail="Invalid action. Expected keep, hide, or delete")

    character = None
    if item.character_id:
        character = db.query(Character).filter(Character.id == item.character_id).first()

    now = datetime.now(UTC)

    if action == "hide" and character:
        character.is_public = False
    elif action == "delete" and character:
        db.delete(character)

    # Log the action if it affects the content
    if action in {"hide", "delete"} and character:
        _log_content_moderation(
            db,
            creator_id=character.creator_id,
            entity_type="character",
            entity_id=item.character_id,
            entity_name=item.character_name,
            action=action,
            admin=current_admin,
            notes=payload.notes,
            source="content_review",
        )

    item.status = f"resolved_{action}"
    item.resolved_time = now
    item.resolved_by = current_admin.id
    item.resolution_notes = payload.notes
    item.updated_time = now

    db.commit()
    db.refresh(item)

    return {
        "message": f"Review queue item resolved with action: {action}",
        "item": {
            "id": item.id,
            "status": item.status,
            "resolved_time": item.resolved_time,
            "resolution_notes": item.resolution_notes,
        }
    }


@router.get("/moderation/reports")
def get_moderation_reports(
    status: str = "pending",
    db: Session = Depends(get_db),
    current_admin: User = Depends(get_current_admin_user)
):
    """Get entity reports (character/scene/persona/user) for moderation - Admin only"""
    query = db.query(ProblemReport).filter(ProblemReport.target_type.isnot(None))
    if status and status != "all":
        query = query.filter(ProblemReport.status == status)

    reports = query.order_by(desc(ProblemReport.created_time)).all()
    result = []

    def _violation_snapshot(user_id: str) -> dict:
        """Return lightweight violation counts + last action for a given user."""
        acct_count = db.query(func.count(UserModerationLog.id)).filter(
            UserModerationLog.user_id == user_id,
            UserModerationLog.action.in_(["warn", "upload_ban", "full_ban", "shadow_ban"]),
        ).scalar() or 0
        content_count = db.query(func.count(ContentModerationLog.id)).filter(
            ContentModerationLog.creator_id == user_id,
            ContentModerationLog.action.in_(["restrict", "takedown", "delete", "hide"]),
        ).scalar() or 0
        last_log = (
            db.query(UserModerationLog)
            .filter(UserModerationLog.user_id == user_id)
            .order_by(desc(UserModerationLog.created_at))
            .first()
        )
        return {
            "account_action_count": acct_count,
            "content_action_count": content_count,
            "last_action": last_log.action if last_log else None,
            "last_action_at": last_log.created_at.isoformat() if last_log else None,
        }

    for report in reports:
        reporter = None
        if report.user_id:
            reporter = db.query(User).filter(User.id == report.user_id).first()

        target_info = {}
        if report.target_type == "user":
            target_user = None
            if report.target_string_id:
                target_user = db.query(User).filter(User.id == report.target_string_id).first()
            if target_user:
                target_info = {
                    "exists": True,
                    "name": target_user.name,
                    "email": target_user.email,
                    "ban_type": target_user.ban_type,
                    "ban_until": target_user.ban_until.isoformat() if target_user.ban_until else None,
                    "ban_reason": target_user.ban_reason,
                    "ban_note": target_user.ban_note,
                    "violation_snapshot": _violation_snapshot(target_user.id),
                }
            else:
                target_info = {"exists": False, "name": report.target_name}
        elif report.target_type == "character" and report.target_id:
            character = db.query(Character).filter(Character.id == report.target_id).first()
            if character:
                target_info = {
                    "exists": True,
                    "name": character.name,
                    "is_public": character.is_public,
                    "creator_name": character.creator_name,
                    "creator_id": character.creator_id,
                    "moderation_status": character.moderation_status,
                    "violation_snapshot": _violation_snapshot(character.creator_id) if character.creator_id else None,
                }
            else:
                target_info = {"exists": False, "name": report.target_name}
        elif report.target_type in ("scene", "persona") and report.target_id:
            model_cls = Scene if report.target_type == "scene" else Persona
            entity = db.query(model_cls).filter(model_cls.id == report.target_id).first()
            if entity:
                target_info = {
                    "exists": True,
                    "name": entity.name,
                    "is_public": entity.is_public,
                    "creator_name": entity.creator_name,
                    "creator_id": entity.creator_id,
                    "moderation_status": entity.moderation_status,
                    "violation_snapshot": _violation_snapshot(entity.creator_id) if entity.creator_id else None,
                }
            else:
                target_info = {"exists": False, "name": report.target_name}

        resolver = None
        if report.resolved_by:
            resolver = db.query(User).filter(User.id == report.resolved_by).first()

        result.append({
            "id": report.id,
            "reporter_id": report.user_id,
            "reporter_name": reporter.name if reporter else None,
            "reporter_email": report.user_email,
            "target_type": report.target_type,
            "target_id": report.target_id,
            "target_string_id": report.target_string_id,
            "target_name": report.target_name,
            "target_info": target_info,
            "reason": report.reason,
            "description": report.description,
            "status": report.status,
            "action_taken": report.action_taken,
            "created_time": report.created_time,
            "resolved_time": report.resolved_time,
            "resolved_by_name": resolver.name if resolver else None,
            "admin_notes": report.admin_notes,
        })

    return result


@router.post("/moderation/reports/{report_id}/action")
def take_moderation_action(
    report_id: int,
    payload: UserModerationActionRequest,
    db: Session = Depends(get_db),
    current_admin: User = Depends(get_current_admin_user)
):
    """Take a moderation action on an entity report - Admin only"""
    report = db.query(ProblemReport).filter(ProblemReport.id == report_id).first()
    if not report:
        raise HTTPException(status_code=404, detail="Report not found")

    if report.target_type is None:
        raise HTTPException(status_code=400, detail="This report is a bug report, not an entity report")

    action = (payload.action or "").strip().lower()
    now = datetime.now(UTC)

    if report.target_type == "user":
        valid_actions = {"warn", "upload_ban", "full_ban", "shadow_ban", "unban", "ignore"}
        if action not in valid_actions:
            raise HTTPException(status_code=400, detail=f"Invalid action for user report. Expected one of: {', '.join(sorted(valid_actions))}")

        target_user = None
        if report.target_string_id:
            target_user = db.query(User).filter(User.id == report.target_string_id).first()

        if action in {"upload_ban", "full_ban", "shadow_ban"}:
            if target_user:
                target_user.ban_type = action
                target_user.ban_until = payload.ban_until
                target_user.ban_reason = payload.ban_reason
                target_user.ban_note = payload.ban_note
        elif action == "unban":
            if target_user:
                target_user.ban_type = None
                target_user.ban_until = None
                target_user.ban_reason = None
                target_user.ban_note = None
        # warn/ignore: no user model changes - report is resolved with notes only

        # Log this user moderation action
        if report.target_string_id and action != "ignore":
            _log_user_moderation(
                db,
                user_id=report.target_string_id,
                action=action,
                admin=current_admin,
                ban_reason=payload.ban_reason,
                ban_note=payload.ban_note,
                ban_until=payload.ban_until,
                notes=payload.notes,
                source="report",
                source_report_id=report_id,
            )

    else:
        valid_actions = {"keep", "restrict", "takedown", "delete", "unban", "ignore"}
        if action not in valid_actions:
            raise HTTPException(status_code=400, detail=f"Invalid action for content report. Expected one of: {', '.join(sorted(valid_actions))}")

        model_map = {
            "character": Character,
            "scene": Scene,
            "persona": Persona,
        }

        if report.target_type in model_map and report.target_id:
            model_cls = model_map[report.target_type]
            entity = db.query(model_cls).filter(model_cls.id == report.target_id).first()
            if entity:
                if action == "restrict":
                    entity.moderation_status = "restricted"
                    entity.is_public = False
                elif action == "takedown":
                    entity.moderation_status = "takedown"
                    entity.is_public = False
                elif action == "unban":
                    entity.moderation_status = None
                    entity.is_public = True  # restore visibility after ban is lifted
                elif action == "delete":
                    creator_id = entity.creator_id
                    entity_name = entity.name
                    db.delete(entity)
                    db.flush()
                    if creator_id:
                        create_content_moderation_message(
                            db=db,
                            user_id=creator_id,
                            action="delete",
                            entity_type=report.target_type,
                            entity_name=entity_name,
                            entity_id=report.target_id,
                            notes=payload.notes,
                            admin_id=current_admin.id,
                        )
                        _log_content_moderation(
                            db,
                            creator_id=creator_id,
                            entity_type=report.target_type,
                            entity_id=report.target_id,
                            entity_name=entity_name,
                            action="delete",
                            admin=current_admin,
                            notes=payload.notes,
                            source="report",
                            source_report_id=report_id,
                        )
                    report.status = "resolved"
                    report.action_taken = action
                    report.resolved_time = now
                    report.resolved_by = current_admin.id
                    report.admin_notes = payload.notes
                    db.commit()
                    return {"message": f"Action '{action}' applied to report #{report_id}"}

                # Send message for restrict / takedown / unban
                if action in {"restrict", "takedown"} and entity.creator_id:
                    create_content_moderation_message(
                        db=db,
                        user_id=entity.creator_id,
                        action=action,
                        entity_type=report.target_type,
                        entity_name=entity.name,
                        entity_id=report.target_id,
                        notes=payload.notes,
                        admin_id=current_admin.id,
                    )

                # Log the content moderation action
                if action != "keep" and action != "ignore" and entity.creator_id:
                    _log_content_moderation(
                        db,
                        creator_id=entity.creator_id,
                        entity_type=report.target_type,
                        entity_id=report.target_id,
                        entity_name=entity.name,
                        action=action,
                        admin=current_admin,
                        notes=payload.notes,
                        source="report",
                        source_report_id=report_id,
                    )

    report.status = "resolved"
    report.action_taken = action
    report.resolved_time = now
    report.resolved_by = current_admin.id
    report.admin_notes = payload.notes

    # Send an inbox message to the affected user for user-targeted moderation actions
    if report.target_type == "user" and report.target_string_id:
        create_moderation_message(
            db=db,
            user_id=report.target_string_id,
            action=action,
            notes=payload.notes,
            admin_id=current_admin.id,
            ban_until=payload.ban_until,
            ban_reason=payload.ban_reason,
        )

    db.commit()

    return {"message": f"Action '{action}' applied to report #{report_id}"}


@router.post("/moderation/batch-action")
def take_batch_moderation_action(
    payload: BatchModerationActionRequest,
    db: Session = Depends(get_db),
    current_admin: User = Depends(get_current_admin_user)
):
    """Apply a moderation action to multiple pending entity reports - Admin only"""
    reports = db.query(ProblemReport).filter(
        ProblemReport.id.in_(payload.report_ids),
        ProblemReport.target_type.isnot(None),
        ProblemReport.status == "pending",
    ).all()

    if not reports:
        raise HTTPException(status_code=404, detail="No matching pending reports found")

    action = (payload.action or "").strip().lower()
    now = datetime.now(UTC)
    model_map = {"character": Character, "scene": Scene, "persona": Persona}
    applied = 0

    for report in reports:
        if report.target_type == "user":
            if action not in {"warn", "upload_ban", "full_ban", "shadow_ban", "unban", "ignore"}:
                continue
            target_user = None
            if report.target_string_id:
                target_user = db.query(User).filter(User.id == report.target_string_id).first()
            if action in {"upload_ban", "full_ban", "shadow_ban"} and target_user:
                target_user.ban_type = action
                target_user.ban_until = payload.ban_until
                target_user.ban_reason = payload.ban_reason
                target_user.ban_note = payload.ban_note
            elif action == "unban" and target_user:
                target_user.ban_type = None
                target_user.ban_until = None
                target_user.ban_reason = None
                target_user.ban_note = None
            if report.target_string_id and action != "ignore":
                _log_user_moderation(
                    db,
                    user_id=report.target_string_id,
                    action=action,
                    admin=current_admin,
                    ban_reason=payload.ban_reason,
                    ban_note=payload.ban_note,
                    ban_until=payload.ban_until,
                    notes=payload.notes,
                    source="report",
                    source_report_id=report.id,
                )
        else:
            if action not in {"keep", "restrict", "takedown", "delete", "unban", "ignore"}:
                continue
            if report.target_type in model_map and report.target_id:
                model_cls = model_map[report.target_type]
                entity = db.query(model_cls).filter(model_cls.id == report.target_id).first()
                if entity:
                    if action == "restrict":
                        entity.moderation_status = "restricted"
                        entity.is_public = False
                    elif action == "takedown":
                        entity.moderation_status = "takedown"
                        entity.is_public = False
                    elif action == "unban":
                        entity.moderation_status = None
                        entity.is_public = True  # restore visibility after ban is lifted
                    elif action == "delete":
                        _creator_id = entity.creator_id
                        _entity_name = entity.name
                        db.delete(entity)
                        if _creator_id:
                            create_content_moderation_message(
                                db=db,
                                user_id=_creator_id,
                                action="delete",
                                entity_type=report.target_type,
                                entity_name=_entity_name,
                                entity_id=report.target_id,
                                notes=payload.notes,
                                admin_id=current_admin.id,
                            )
                    if action in {"restrict", "takedown"} and entity.creator_id:
                        create_content_moderation_message(
                            db=db,
                            user_id=entity.creator_id,
                            action=action,
                            entity_type=report.target_type,
                            entity_name=entity.name,
                            entity_id=report.target_id,
                            notes=payload.notes,
                            admin_id=current_admin.id,
                        )
                    # Log content action
                    if action not in {"keep", "ignore"}:
                        _creator_id_for_log = entity.creator_id if action != "delete" else _creator_id
                        _name_for_log = entity.name if action != "delete" else _entity_name
                        if _creator_id_for_log:
                            _log_content_moderation(
                                db,
                                creator_id=_creator_id_for_log,
                                entity_type=report.target_type,
                                entity_id=report.target_id,
                                entity_name=_name_for_log,
                                action=action,
                                admin=current_admin,
                                notes=payload.notes,
                                source="report",
                                source_report_id=report.id,
                            )

        report.status = "resolved"
        report.action_taken = action
        report.resolved_time = now
        report.resolved_by = current_admin.id
        report.admin_notes = payload.notes
        applied += 1

    db.commit()
    return {"message": f"Action '{action}' applied to {applied} reports", "count": applied}


@router.post("/content/{content_type}/{item_id}/moderate")
def moderate_content_item(
    content_type: str,
    item_id: int,
    payload: ContentModerationRequest,
    db: Session = Depends(get_db),
    current_admin: User = Depends(get_current_admin_user)
):
    """Apply a direct moderation action to a character, scene, or persona - Admin only"""
    model_map = {"character": Character, "scene": Scene, "persona": Persona}
    if content_type not in model_map:
        raise HTTPException(status_code=400, detail="Invalid content type. Expected character, scene, or persona")

    valid_actions = {"restrict", "takedown", "unban", "delete"}
    action = (payload.action or "").strip().lower()
    if action not in valid_actions:
        raise HTTPException(status_code=400, detail=f"Invalid action. Expected one of: {', '.join(sorted(valid_actions))}")

    model_cls = model_map[content_type]
    entity = db.query(model_cls).filter(model_cls.id == item_id).first()
    if not entity:
        raise HTTPException(status_code=404, detail=f"{content_type.capitalize()} not found")

    if action == "restrict":
        entity.moderation_status = "restricted"
        entity.is_public = False
    elif action == "takedown":
        entity.moderation_status = "takedown"
        entity.is_public = False
    elif action == "unban":
        entity.moderation_status = None
        entity.is_public = True
    elif action == "delete":
        picture_path = getattr(entity, 'picture', None)
        avatar_path = getattr(entity, 'avatar_picture', None)
        creator_id = entity.creator_id
        entity_name = entity.name
        db.delete(entity)
        db.flush()
        if creator_id:
            create_content_moderation_message(
                db=db,
                user_id=creator_id,
                action="delete",
                entity_type=content_type,
                entity_name=entity_name,
                entity_id=item_id,
                notes=payload.notes,
                admin_id=current_admin.id,
            )
        db.commit()
        # Clean up stored images after the DB commit
        delete_stored_image(picture_path)
        delete_stored_image(avatar_path)
        return {"message": f"{content_type.capitalize()} deleted successfully"}

    if action in {"restrict", "takedown"} and entity.creator_id:
        create_content_moderation_message(
            db=db,
            user_id=entity.creator_id,
            action=action,
            entity_type=content_type,
            entity_name=entity.name,
            entity_id=item_id,
            notes=payload.notes,
            admin_id=current_admin.id,
        )

    db.commit()
    return {"message": f"Action '{action}' applied to {content_type} #{item_id}"}
