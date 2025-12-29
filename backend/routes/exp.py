from fastapi import APIRouter, Depends, HTTPException, Body
from sqlalchemy.orm import Session
from database import get_db
from models import User, Character
from utils.session import get_current_user
from utils.level_system import EXP_REWARDS, award_exp_with_limits, get_level_progress, DAILY_ACTION_LIMITS, DAILY_EXP_CAPS

router = APIRouter()

@router.get("/api/levels")
def get_levels_info():
    """Optional: expose level table to frontend if needed."""
    from utils.level_system import get_all_levels_info
    return get_all_levels_info()

@router.get("/api/exp/limits")
def get_exp_limits(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get current user's daily EXP limits and usage."""
    from utils.level_system import reset_daily_limits_if_needed
    
    if not current_user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    # Reset if needed
    reset_daily_limits_if_needed(current_user)
    db.commit()
    
    daily_cap = DAILY_EXP_CAPS.get(current_user.level or 1, 150)
    
    return {
        "level": current_user.level,
        "daily_exp_gained": current_user.daily_exp_gained or 0,
        "daily_exp_cap": daily_cap,
        "remaining_exp": max(0, daily_cap - (current_user.daily_exp_gained or 0)),
        "daily_action_counts": current_user.daily_action_counts or {},
        "action_limits": DAILY_ACTION_LIMITS,
        "exp_rewards": EXP_REWARDS
    }

@router.post("/api/exp/gain")
def gain_exp(
    payload: dict = Body(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Generic endpoint for awarding EXP for supported actions.
    Now includes daily limits and caps.
    payload: { action: string, target_type?: 'character', target_id?: int }
    - For creator-targeted actions (e.g., 'character_liked'), EXP goes to the entity's creator.
    - For user actions (e.g., 'daily_chat'), EXP goes to current_user.
    """
    if not current_user:
        raise HTTPException(status_code=401, detail="Not authenticated")

    action = payload.get("action")
    target_type = payload.get("target_type")
    target_id = payload.get("target_id")

    if not action or action not in EXP_REWARDS:
        raise HTTPException(status_code=400, detail="Invalid or unsupported action")

    # Decide recipient
    recipient: User = current_user

    # Actions that award the creator of a target entity
    creator_targeted_actions = {"character_liked", "forked", "paid_char_sold"}
    if action in creator_targeted_actions:
        if target_type != "character" or not target_id:
            raise HTTPException(status_code=400, detail="Missing character target for creator award")
        character = db.query(Character).filter(Character.id == target_id).first()
        if not character or not character.creator_id:
            raise HTTPException(status_code=404, detail="Character or creator not found")
        recipient = db.query(User).filter(User.id == character.creator_id).first()
        if not recipient:
            raise HTTPException(status_code=404, detail="Creator user not found")

    # Use centralized function with limits
    result = award_exp_with_limits(recipient, action, db)
    
    if not result["success"]:
        raise HTTPException(status_code=429, detail=result["reason"])
    
    return {
        "awarded_to": recipient.id,
        "action": action,
        **result
    }
