"""
Level and EXP System for Mikoshi
Manages user progression through levels and experience points.
"""

from typing import Dict, Tuple

# Level configuration
LEVELS = {
    1: {
        "name": "Newbie",
        "unlock": "Create chars, scenes, personas",
        "exp_required": 0
    },
    2: {
        "name": "Creator",
        "unlock": "Fork, private chars",
        "exp_required": 100
    },
    3: {
        "name": "Advanced",
        "unlock": "1 paid char, basic analytics",
        "exp_required": 300
    },
    4: {
        "name": "Pro",
        "unlock": "2 paid chars, prompt controls",
        "exp_required": 700
    },
    5: {
        "name": "Elite",
        "unlock": "Featured chance, beta tools",
        "exp_required": 1500
    },
    6: {
        "name": "Master",
        "unlock": "Creator badge, early revenue tools",
        "exp_required": 3000
    }
}

# EXP rewards for different actions
EXP_REWARDS = {
    "create_character": 30,
    "create_scene": 15,
    "create_persona": 15,
    "character_liked": 5,
    "forked": 10,
    "chat_used_50": 10,  # Removed - replaced by daily_chat
    "paid_char_sold": 50,
    "daily_chat": 20  # Updated from 10 to 20
}

# Daily action limits (actions per day)
DAILY_ACTION_LIMITS = {
    "daily_chat": 1,
    "create_character": 2,
    "create_scene": 2,
    "create_persona": 2,
    "character_liked": 20,
    "forked": None,  # No hard cap
    "paid_char_sold": None,  # No cap
    "chat_used_50": None,  # Removed action
}

# Daily EXP caps by level range
DAILY_EXP_CAPS = {
    1: 150,  # L1-L2
    2: 150,
    3: 300,  # L3-L4
    4: 300,
    5: 500,  # L5-L6
    6: 500,
}

MAX_LEVEL = 6


def calculate_level_from_exp(exp: int) -> int:
    """
    Calculate the level based on total experience points.
    
    Args:
        exp: Total experience points
        
    Returns:
        Level (1-6)
    """
    level = 1
    for lvl in range(MAX_LEVEL, 0, -1):
        if exp >= LEVELS[lvl]["exp_required"]:
            level = lvl
            break
    return level


def get_exp_for_next_level(current_level: int) -> int:
    """
    Get the total EXP required to reach the next level.
    
    Args:
        current_level: Current user level
        
    Returns:
        Total EXP required for next level, or -1 if at max level
    """
    if current_level >= MAX_LEVEL:
        return -1
    return LEVELS[current_level + 1]["exp_required"]


def get_level_progress(exp: int, level: int) -> Dict[str, any]:
    """
    Get detailed progress information for a user's level.
    
    Args:
        exp: Current experience points
        level: Current level
        
    Returns:
        Dictionary containing level progress information
    """
    current_level_exp = LEVELS[level]["exp_required"]
    next_level_exp = get_exp_for_next_level(level)
    
    if next_level_exp == -1:
        # Max level reached
        return {
            "current_level": level,
            "level_name": LEVELS[level]["name"],
            "total_exp": exp,
            "progress_percentage": 100.0,
            "exp_to_next_level": 0,
            "is_max_level": True
        }
    
    exp_in_current_level = exp - current_level_exp
    exp_needed_for_next = next_level_exp - current_level_exp
    progress_percentage = (exp_in_current_level / exp_needed_for_next) * 100 if exp_needed_for_next > 0 else 0
    
    return {
        "current_level": level,
        "level_name": LEVELS[level]["name"],
        "total_exp": exp,
        "current_level_exp": exp_in_current_level,
        "exp_needed_for_next": exp_needed_for_next,
        "exp_to_next_level": next_level_exp - exp,
        "progress_percentage": round(progress_percentage, 1),
        "is_max_level": False
    }


def get_level_info(level: int) -> Dict[str, str]:
    """
    Get information about a specific level.
    
    Args:
        level: Level number (1-6)
        
    Returns:
        Dictionary with level name and unlock information
    """
    if level not in LEVELS:
        return {"name": "Unknown", "unlock": "Unknown"}
    return {
        "name": LEVELS[level]["name"],
        "unlock": LEVELS[level]["unlock"]
    }


def add_exp(current_exp: int, current_level: int, exp_to_add: int) -> Tuple[int, int, bool]:
    """
    Add experience points and calculate if user leveled up.
    
    Args:
        current_exp: Current total EXP
        current_level: Current level
        exp_to_add: EXP to add
        
    Returns:
        Tuple of (new_exp, new_level, leveled_up)
    """
    new_exp = current_exp + exp_to_add
    new_level = calculate_level_from_exp(new_exp)
    leveled_up = new_level > current_level
    
    return new_exp, new_level, leveled_up


def get_all_levels_info() -> Dict[int, Dict[str, any]]:
    """
    Get information about all levels.
    
    Returns:
        Dictionary mapping level numbers to their information
    """
    return LEVELS.copy()


def can_perform_action(level: int, action: str) -> bool:
    """
    Check if a user at a given level can perform a specific action.
    
    Args:
        level: User's current level
        action: Action to check (e.g., 'fork', 'private_chars', 'paid_char')
        
    Returns:
        Boolean indicating if action is allowed
    """
    action_requirements = {
        "create_character": 1,
        "create_scene": 1,
        "create_persona": 1,
        "fork": 2,
        "private_chars": 2,
        "paid_char_1": 3,
        "basic_analytics": 3,
        "paid_char_2": 4,
        "prompt_controls": 4,
        "featured_chance": 5,
        "beta_tools": 5,
        "creator_badge": 6,
        "revenue_tools": 6
    }
    
    required_level = action_requirements.get(action, 1)
    return level >= required_level


def reset_daily_limits_if_needed(user) -> None:
    from datetime import datetime, UTC
    
    today = datetime.now(UTC).date()
    last_reset = user.last_exp_reset_date.date() if user.last_exp_reset_date else None
    
    if last_reset != today:
        user.daily_exp_gained = 0
        
        # Only reset counts to 0, don't create new empty dict
        if user.daily_action_counts is not None:
            # Reset all counters to 0 but keep the keys
            for key in user.daily_action_counts:
                user.daily_action_counts[key] = 0
        
        user.last_exp_reset_date = datetime.now(UTC)


def award_exp_with_limits(user, action: str, db_session) -> Dict[str, any]:
    """
    Centralized function to award EXP with daily limits and caps.
    
    Args:
        user: User SQLAlchemy model instance
        action: Action type (e.g., 'create_character', 'daily_chat')
        db_session: Database session for committing changes
        
    Returns:
        Dictionary with award result:
        {
            "success": bool,
            "reason": str,  # If failed
            "exp_added": int,
            "total_exp": int,
            "level": int,
            "leveled_up": bool,
            "daily_exp_gained": int,
            "daily_exp_cap": int,
            "action_count": int,
            "action_limit": int or None
        }
    """
    from datetime import datetime, UTC

    # Initialize daily_action_counts if None
    if user.daily_action_counts is None:
        user.daily_action_counts = {}

    # Ensure the current action has an initialized counter to avoid KeyError when accessed later
    if action not in user.daily_action_counts:
        user.daily_action_counts[action] = 0
    
    # Reset daily limits if needed
    reset_daily_limits_if_needed(user)
    
    # Validate action
    if action not in EXP_REWARDS:
        return {
            "success": False,
            "reason": f"Invalid action: {action}",
            "exp_added": 0
        }
    
    exp_value = EXP_REWARDS[action]
    action_limit = DAILY_ACTION_LIMITS.get(action)
    daily_cap = DAILY_EXP_CAPS.get(user.level or 1, 150)
    
    # Check action limit
    current_action_count = user.daily_action_counts.get(action, 0)
    if action_limit is not None and current_action_count >= action_limit:
        return {
            "success": False,
            "reason": f"Daily limit reached for {action} ({action_limit}/day)",
            "exp_added": 0,
            "action_count": current_action_count,
            "action_limit": action_limit
        }
    
    # Check daily EXP cap
    if user.daily_exp_gained >= daily_cap:
        return {
            "success": False,
            "reason": f"Daily EXP cap reached ({daily_cap} EXP/day for level {user.level})",
            "exp_added": 0,
            "daily_exp_gained": user.daily_exp_gained,
            "daily_exp_cap": daily_cap
        }
    
    # Calculate actual EXP to award (might be capped)
    remaining_daily_exp = daily_cap - user.daily_exp_gained
    actual_exp = min(exp_value, remaining_daily_exp)
    
    # Award EXP
    new_exp, new_level, leveled_up = add_exp(user.exp or 0, user.level or 1, actual_exp)
    user.exp = new_exp
    user.level = new_level
    user.daily_exp_gained += actual_exp
    
    # Increment action count
    user.daily_action_counts[action] = current_action_count + 1
    
    # Commit changes
    try:
        db_session.commit()
    except Exception as e:
        db_session.rollback()
        return {
            "success": False,
            "reason": f"Database error: {str(e)}",
            "exp_added": 0
        }
    
    print(f"Awarded {actual_exp} EXP to user {user.id} for action {action}. New EXP: {user.exp}, Level: {user.level}")
    print(user.daily_action_counts)
    
    return {
        "success": True,
        "exp_added": actual_exp,
        "total_exp": user.exp,
        "level": user.level,
        "leveled_up": leveled_up,
        "daily_exp_gained": user.daily_exp_gained,
        "daily_exp_cap": daily_cap,
        "action_count": user.daily_action_counts.get(action, 0),
        "action_limit": action_limit,
        "progress": get_level_progress(user.exp, user.level)
    }
