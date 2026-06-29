from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import func
from database import get_db
from models import UserMessage, User, BanAppeal
from utils.session import get_current_user, get_current_admin_user
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime, UTC

router = APIRouter()


# ──────────────────────────────────────────────
# Pydantic schemas
# ──────────────────────────────────────────────

class MessageOut(BaseModel):
    id: int
    msg_type: str
    title: str
    body: str
    is_read: bool
    extra: dict
    created_at: str

    class Config:
        from_attributes = True


class AdminSendMessageRequest(BaseModel):
    user_id: str
    msg_type: str          # warn | ban | unban | advice | system
    title: str
    body: str
    extra: Optional[dict] = {}


# ──────────────────────────────────────────────
# User-facing endpoints
# ──────────────────────────────────────────────

@router.get("/api/me/messages", response_model=List[MessageOut])
def get_my_messages(
    limit: int = Query(default=30, le=100),
    offset: int = Query(default=0, ge=0),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Return inbox messages for the current user, newest first."""
    msgs = (
        db.query(UserMessage)
        .filter(UserMessage.user_id == current_user.id)
        .order_by(UserMessage.created_at.desc())
        .offset(offset)
        .limit(limit)
        .all()
    )
    return [_msg_out(m) for m in msgs]


@router.get("/api/me/messages/unread-count")
def get_unread_count(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    count = (
        db.query(func.count(UserMessage.id))
        .filter(UserMessage.user_id == current_user.id, UserMessage.is_read == False)  # noqa: E712
        .scalar()
    ) or 0
    return {"unread_count": count}


@router.post("/api/me/messages/{message_id}/read")
def mark_read(
    message_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    msg = db.query(UserMessage).filter(
        UserMessage.id == message_id,
        UserMessage.user_id == current_user.id,
    ).first()
    if not msg:
        raise HTTPException(status_code=404, detail="Message not found")
    msg.is_read = True
    db.commit()
    return {"ok": True}


@router.post("/api/me/messages/read-all")
def mark_all_read(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    db.query(UserMessage).filter(
        UserMessage.user_id == current_user.id,
        UserMessage.is_read == False,  # noqa: E712
    ).update({"is_read": True})
    db.commit()
    return {"ok": True}


# ──────────────────────────────────────────────
# Ban appeal endpoints (user-facing)
# ──────────────────────────────────────────────

class BanAppealRequest(BaseModel):
    reason: str


@router.post("/api/me/ban-appeal")
def submit_ban_appeal(
    payload: BanAppealRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Submit a ban appeal. Only allowed when the user is currently banned."""
    if not current_user.ban_type:
        raise HTTPException(status_code=400, detail="Your account is not currently banned.")

    reason = (payload.reason or "").strip()
    if len(reason) > 2000:
        raise HTTPException(status_code=422, detail="Appeal reason is too long (max 2000 characters).")

    # Prevent duplicate pending appeals
    existing = db.query(BanAppeal).filter(
        BanAppeal.user_id == current_user.id,
        BanAppeal.status == "pending",
    ).first()
    if existing:
        raise HTTPException(status_code=409, detail="You already have a pending appeal.")

    appeal = BanAppeal(
        user_id=current_user.id,
        ban_type=current_user.ban_type,
        reason=reason,
    )
    db.add(appeal)
    db.commit()
    db.refresh(appeal)
    return {"id": appeal.id, "status": appeal.status, "ok": True}


@router.get("/api/me/ban-appeal")
def get_my_ban_appeal(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Return the most recent appeal for the current user (if any)."""
    appeal = (
        db.query(BanAppeal)
        .filter(BanAppeal.user_id == current_user.id)
        .order_by(BanAppeal.created_at.desc())
        .first()
    )
    if not appeal:
        return None
    return _appeal_out(appeal)


def _appeal_out(appeal: BanAppeal) -> dict:
    return {
        "id": appeal.id,
        "ban_type": appeal.ban_type,
        "reason": appeal.reason,
        "status": appeal.status,
        "admin_reply": appeal.admin_reply,
        "created_at": appeal.created_at.isoformat(),
        "resolved_at": appeal.resolved_at.isoformat() if appeal.resolved_at else None,
    }




@router.post("/api/admin/messages/send")
def admin_send_message(
    payload: AdminSendMessageRequest,
    current_admin: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db),
):
    valid_types = {"warn", "ban", "unban", "advice", "system"}
    if payload.msg_type not in valid_types:
        raise HTTPException(status_code=400, detail=f"Invalid msg_type. Expected one of: {', '.join(sorted(valid_types))}")

    target = db.query(User).filter(User.id == payload.user_id).first()
    if not target:
        raise HTTPException(status_code=404, detail="Target user not found")

    msg = UserMessage(
        user_id=payload.user_id,
        msg_type=payload.msg_type,
        title=payload.title,
        body=payload.body,
        extra=payload.extra or {},
        created_by=current_admin.id,
    )
    db.add(msg)
    db.commit()
    db.refresh(msg)
    return {"id": msg.id, "ok": True}


# ──────────────────────────────────────────────
# Internal helper (used by admin moderation hook)
# ──────────────────────────────────────────────

def create_moderation_message(
    db: Session,
    user_id: str,
    action: str,
    notes: Optional[str],
    admin_id: str,
    ban_until: Optional[datetime] = None,
    ban_reason: Optional[str] = None,
    target_name: Optional[str] = None,
):
    """Create an inbox message when a moderation action is applied to a user."""

    # Human-readable labels for ban reason categories
    _BAN_REASON_LABELS = {
        "harassment":  "骚扰或霸凌",
        "spam":        "垃圾内容/刷屏",
        "abuse":       "滥用平台功能",
        "underage":    "涉及未成年人不当内容",
        "other":       "其他违规行为",
    }

    # Ban type → scope description
    _BAN_SCOPE = {
        "upload_ban": "您将无法创建或编辑任何内容（角色、场景、人设）",
        "full_ban":   "您将无法发送消息、创建或编辑任何内容",
        "shadow_ban": "您的账号功能已受到限制",
    }

    if action not in {"warn", "upload_ban", "full_ban", "shadow_ban", "unban"}:
        return  # ignore, keep, hide, delete — no message needed

    extra: dict = {}
    if ban_until:
        extra["ban_until"] = ban_until.isoformat()
    if ban_reason:
        extra["ban_reason"] = ban_reason
    if target_name:
        extra["target_name"] = target_name

    # ── build body ──────────────────────────────────────────
    lines: list[str] = []

    if action == "warn":
        lines.append("您的账号已收到一次正式警告。")
        lines.append("")
        if ban_reason:
            label = _BAN_REASON_LABELS.get(ban_reason, ban_reason)
            lines.append(f"违规原因：{label}")
        if notes:
            lines.append(f"管理员说明：{notes}")
        lines.append("")
        lines.append("请认真阅读并遵守社区规范。累计违规将导致内容发布权限限制乃至账号封禁。")

    elif action in {"upload_ban", "full_ban", "shadow_ban"}:
        if action == "upload_ban":
            lines.append("您的内容发布权限已被暂停。")
        elif action == "full_ban":
            lines.append("您的账号已被封禁。")
        else:
            lines.append("您的账号功能已受到限制。")
        lines.append("")

        if ban_reason:
            label = _BAN_REASON_LABELS.get(ban_reason, ban_reason)
            lines.append(f"违规原因：{label}")

        scope = _BAN_SCOPE.get(action)
        if scope:
            lines.append(f"限制范围：{scope}。")

        if ban_until:
            until_str = ban_until.strftime("%Y年%m月%d日 %H:%M")
            lines.append(f"解封时间：{until_str}")
        else:
            lines.append("封禁类型：永久")

        if notes:
            lines.append(f"管理员说明：{notes}")

        lines.append("")
        lines.append("如您认为此处理有误，请通过客服渠道提交申诉。")

    elif action == "unban":
        lines.append("您的账号限制已被解除，现在可以正常使用平台全部功能。")
        if notes:
            lines.append("")
            lines.append(f"管理员说明：{notes}")

    title_map = {
        "warn":       "账号警告通知",
        "upload_ban": "内容发布权限已限制",
        "full_ban":   "账号已封禁",
        "shadow_ban": "账号功能受限通知",
        "unban":      "账号限制已解除",
    }
    msg_type_map = {
        "warn":       "warn",
        "upload_ban": "ban",
        "full_ban":   "ban",
        "shadow_ban": "ban",
        "unban":      "unban",
    }

    msg = UserMessage(
        user_id=user_id,
        msg_type=msg_type_map[action],
        title=title_map[action],
        body="\n".join(lines),
        extra=extra,
        created_by=admin_id,
    )
    db.add(msg)
    # caller must db.commit()
    return


def create_content_moderation_message(
    db: Session,
    user_id: str,
    action: str,                     # restrict | takedown | delete
    entity_type: str,                # character | scene | persona
    entity_name: str,
    entity_id: Optional[int],
    notes: Optional[str],
    admin_id: str,
):
    """Create an inbox message when a moderation action is applied to a user's content."""

    _TYPE_LABELS = {
        "character": "角色",
        "scene": "场景",
        "persona": "人设",
    }

    if action not in {"restrict", "takedown", "delete"}:
        return  # keep / ignore / unban — no message needed

    type_label = _TYPE_LABELS.get(entity_type, entity_type)

    extra: dict = {
        "entity_type": entity_type,
        "entity_name": entity_name,
    }
    if entity_id and action != "delete":
        extra["entity_url"] = f"/{entity_type}/{entity_id}"

    lines: list[str] = []

    if action == "restrict":
        lines.append(f"您创建的{type_label}「{entity_name}」已被限制可见性。")
        lines.append("")
        lines.append("该内容目前不再出现在公开推荐、搜索或浏览列表中，但仍可通过直接链接访问。")
        if notes:
            lines.append("")
            lines.append(f"管理员说明：{notes}")
        lines.append("")
        lines.append("如您认为此处理有误，请通过客服渠道提交申诉。")
        title = f"{type_label}可见性已限制"
        msg_type = "warn"

    elif action == "takedown":
        lines.append(f"您创建的{type_label}「{entity_name}」已被下架。")
        lines.append("")
        lines.append("该内容已从平台所有公开页面移除，其他用户无法再访问。您仍可通过原链接查看该内容。")
        if notes:
            lines.append("")
            lines.append(f"管理员说明：{notes}")
        lines.append("")
        lines.append("如您认为此处理有误，请通过客服渠道提交申诉。")
        title = f"{type_label}已被下架"
        msg_type = "ban"

    elif action == "delete":
        lines.append(f"您创建的{type_label}「{entity_name}」已被删除。")
        lines.append("")
        lines.append("该内容已从平台永久移除。")
        if notes:
            lines.append("")
            lines.append(f"管理员说明：{notes}")
        lines.append("")
        lines.append("如您认为此处理有误，请通过客服渠道提交申诉。")
        title = f"{type_label}已被删除"
        msg_type = "ban"

    msg = UserMessage(
        user_id=user_id,
        msg_type=msg_type,
        title=title,
        body="\n".join(lines),
        extra=extra,
        created_by=admin_id,
    )
    db.add(msg)
    # caller must db.commit()
    return


# ──────────────────────────────────────────────
# Internal serializer
# ──────────────────────────────────────────────

def _msg_out(m: UserMessage) -> dict:
    return {
        "id": m.id,
        "msg_type": m.msg_type,
        "title": m.title,
        "body": m.body,
        "is_read": m.is_read,
        "extra": m.extra or {},
        "created_at": m.created_at.isoformat(),
    }


def _send_appeal_result_message(
    db: Session,
    user_id: str,
    action: str,          # "approve" | "reject"
    reply: str,
    admin_id: str,
) -> None:
    """Create an inbox message to notify the user of their appeal outcome."""
    if action == "approve":
        title = "您的申诉已通过"
        body_lines = [
            "经审核，您提交的封禁申诉已获批准，账号限制现已解除。",
            "",
            f"管理员回复：{reply}",
            "",
            "感谢您的耐心等待，欢迎继续使用平台。",
        ]
        msg_type = "unban"
    else:
        title = "您的申诉未获通过"
        body_lines = [
            "经审核，您提交的封禁申诉未获批准，账号限制将继续生效。",
            "",
            f"管理员回复：{reply}",
            "",
            "如有疑问，请通过客服渠道进一步沟通。",
        ]
        msg_type = "ban"

    msg = UserMessage(
        user_id=user_id,
        msg_type=msg_type,
        title=title,
        body="\n".join(body_lines),
        extra={},
        created_by=admin_id,
    )
    db.add(msg)
    # caller must db.commit()


def _send_content_appeal_result_message(
    db: Session,
    user_id: str,
    action: str,           # "approve" | "reject"
    reply: str,
    entity_type: str,      # character | scene | persona
    entity_name: str,
    entity_id: int,
    admin_id: str,
) -> None:
    """Create an inbox message notifying the creator of their content appeal outcome."""
    entity_url = f"/{entity_type}/{entity_id}"
    if action == "approve":
        title = "您的内容申诉已通过"
        body_lines = [
            f"经审核，您提交的内容申诉已获批准，对「{entity_name}」的限制现已解除。",
            "",
            f"管理员回复：{reply}",
            "",
            "感谢您的耐心等待，内容现已恢复正常状态。",
        ]
        msg_type = "unban"
    else:
        title = "您的内容申诉未获通过"
        body_lines = [
            f"经审核，您提交的内容申诉未获批准，对「{entity_name}」的限制将继续生效。",
            "",
            f"管理员回复：{reply}",
            "",
            "如有疑问，请通过客服渠道进一步沟通。",
        ]
        msg_type = "ban"

    msg = UserMessage(
        user_id=user_id,
        msg_type=msg_type,
        title=title,
        body="\n".join(body_lines),
        extra={"entity_url": entity_url, "entity_name": entity_name},
        created_by=admin_id,
    )
    db.add(msg)
    # caller must db.commit()
