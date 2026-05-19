from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import func
from database import get_db
from models import UserMessage, User
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
# Admin endpoint: send a message to any user
# ──────────────────────────────────────────────

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
