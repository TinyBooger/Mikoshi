from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from database import get_db
from models import SystemNotification, User
from pydantic import BaseModel
from typing import List, Optional
from utils.session import get_current_user

router = APIRouter()


class NotificationCreate(BaseModel):
    title: str
    message: str
    features: List[str]


class NotificationUpdate(BaseModel):
    title: Optional[str] = None
    message: Optional[str] = None
    features: Optional[List[str]] = None
    is_active: Optional[bool] = None


class NotificationResponse(BaseModel):
    id: int
    title: str
    message: str
    features: List[str]
    is_active: bool
    created_at: str
    updated_at: str

    class Config:
        from_attributes = True


@router.get("/api/notification/active")
async def get_active_notification(db: Session = Depends(get_db)):
    """Get the active notification (public endpoint)"""
    notification = db.query(SystemNotification).filter(
        SystemNotification.is_active == True
    ).first()
    
    if not notification:
        return None
    
    return {
        "id": notification.id,
        "title": notification.title,
        "message": notification.message,
        "features": notification.features,
        "created_at": notification.created_at.isoformat(),
        "updated_at": notification.updated_at.isoformat()
    }


@router.get("/api/admin/notifications")
async def get_all_notifications(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get all notifications (admin only)"""
    if not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Admin access required")
    
    notifications = db.query(SystemNotification).order_by(
        SystemNotification.created_at.desc()
    ).all()
    
    return [
        {
            "id": n.id,
            "title": n.title,
            "message": n.message,
            "features": n.features,
            "is_active": n.is_active,
            "created_at": n.created_at.isoformat(),
            "updated_at": n.updated_at.isoformat()
        }
        for n in notifications
    ]


@router.post("/api/admin/notifications")
async def create_notification(
    notification: NotificationCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Create a new notification (admin only)"""
    if not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Admin access required")
    
    new_notification = SystemNotification(
        title=notification.title,
        message=notification.message,
        features=notification.features,
        created_by=current_user.id,
        is_active=False  # Start as inactive
    )
    
    db.add(new_notification)
    db.commit()
    db.refresh(new_notification)
    
    return {
        "id": new_notification.id,
        "title": new_notification.title,
        "message": new_notification.message,
        "features": new_notification.features,
        "is_active": new_notification.is_active,
        "created_at": new_notification.created_at.isoformat(),
        "updated_at": new_notification.updated_at.isoformat()
    }


@router.put("/api/admin/notifications/{notification_id}")
async def update_notification(
    notification_id: int,
    notification: NotificationUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Update a notification (admin only)"""
    if not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Admin access required")
    
    db_notification = db.query(SystemNotification).filter(
        SystemNotification.id == notification_id
    ).first()
    
    if not db_notification:
        raise HTTPException(status_code=404, detail="Notification not found")
    
    # If activating this notification, deactivate all others
    if notification.is_active is True:
        db.query(SystemNotification).update({"is_active": False})
    
    # Update fields
    if notification.title is not None:
        db_notification.title = notification.title
    if notification.message is not None:
        db_notification.message = notification.message
    if notification.features is not None:
        db_notification.features = notification.features
    if notification.is_active is not None:
        db_notification.is_active = notification.is_active
    
    db.commit()
    db.refresh(db_notification)
    
    return {
        "id": db_notification.id,
        "title": db_notification.title,
        "message": db_notification.message,
        "features": db_notification.features,
        "is_active": db_notification.is_active,
        "created_at": db_notification.created_at.isoformat(),
        "updated_at": db_notification.updated_at.isoformat()
    }


@router.delete("/api/admin/notifications/{notification_id}")
async def delete_notification(
    notification_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Delete a notification (admin only)"""
    if not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Admin access required")
    
    db_notification = db.query(SystemNotification).filter(
        SystemNotification.id == notification_id
    ).first()
    
    if not db_notification:
        raise HTTPException(status_code=404, detail="Notification not found")
    
    db.delete(db_notification)
    db.commit()
    
    return {"message": "Notification deleted successfully"}
