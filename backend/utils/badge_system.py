"""
Badge system for awarding users achievements based on their activities and milestones.
"""

from datetime import datetime, UTC
from models import User, ChatHistory
from sqlalchemy.orm import Session
from sqlalchemy import func

# Badge definitions with their criteria and frame info
BADGES = {
    "pioneer": {
        "name": "Pioneer",
        "description": "Early adopter of Mikoshi",
        "frame": "pioneer_frame",
        "condition": "manual"  # Awarded by manager
    },
    "bronze_creator": {
        "name": "Bronze Creator",
        "description": "Reached 1,000 views",
        "frame": "bronze_frame",
        "condition": "1k_views",
        "threshold": 1000
    },
    "silver_creator": {
        "name": "Silver Creator",
        "description": "Reached 10,000 views",
        "frame": "silver_frame",
        "condition": "10k_views",
        "threshold": 10000
    },
    "gold_creator": {
        "name": "Gold Creator",
        "description": "Reached 100,000 views",
        "frame": "gold_frame",
        "condition": "100k_views",
        "threshold": 100000
    }
}


def get_user_chat_count(user_id: str, db: Session) -> int:
    """Get total number of chats for a user"""
    count = db.query(func.count(ChatHistory.id)).filter(
        ChatHistory.user_id == user_id
    ).scalar()
    return count or 0


def check_and_award_chat_badges(user: User, db: Session) -> list[str]:
    """
    Check if user qualifies for any view-based badges and award them.
    Returns list of newly awarded badge names.
    """
    newly_awarded = []
    views = user.views or 0
    
    # Check each creator badge based on views
    creator_badges = [
        ("bronze_creator", 1000),
        ("silver_creator", 10000),
        ("gold_creator", 100000)
    ]
    
    for badge_key, threshold in creator_badges:
        if views >= threshold:
            if not has_badge(user, badge_key):
                award_badge(user, badge_key, db)
                newly_awarded.append(badge_key)
    
    return newly_awarded


def award_badge(user: User, badge_key: str, db: Session) -> bool:
    """
    Award a badge to a user if they don't already have it.
    Returns True if badge was awarded, False if user already has it.
    """
    if badge_key not in BADGES:
        return False
    
    if not user.badges:
        user.badges = {}
    
    # Check if user already has this badge
    if badge_key in user.badges:
        return False
    
    badge_info = BADGES[badge_key]
    user.badges[badge_key] = {
        "awarded_at": datetime.now(UTC).isoformat(),
        "frame": badge_info["frame"],
        "name": badge_info["name"],
        "description": badge_info["description"]
    }
    
    db.commit()
    return True


def has_badge(user: User, badge_key: str) -> bool:
    """Check if user has a specific badge"""
    if not user.badges:
        return False
    return badge_key in user.badges


def get_user_badges(user: User) -> dict:
    """Get all badges for a user with their details"""
    return user.badges or {}


def get_badge_info(badge_key: str) -> dict | None:
    """Get badge definition information"""
    return BADGES.get(badge_key)


def remove_badge(user: User, badge_key: str, db: Session) -> bool:
    """
    Remove a badge from a user (for admin operations).
    Returns True if badge was removed, False if user didn't have it.
    """
    if not user.badges or badge_key not in user.badges:
        return False
    
    del user.badges[badge_key]
    db.commit()
    return True


def get_all_badges_info() -> dict:
    """Get information about all available badges"""
    return {
        key: {
            "key": key,
            "name": info["name"],
            "description": info["description"],
            "frame": info["frame"],
            "condition": info["condition"]
        }
        for key, info in BADGES.items()
    }
