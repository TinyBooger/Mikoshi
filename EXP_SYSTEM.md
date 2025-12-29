# EXP and Level System

## Overview
The level system rewards user actions with experience points (EXP). As users gain EXP, they level up and unlock new features.

## Levels (1-6)
- **Level 1 (Newbie)**: 0 EXP - Create chars, scenes, personas
- **Level 2 (Creator)**: 100 EXP - Fork, private chars
- **Level 3 (Advanced)**: 300 EXP - 1 paid char, basic analytics
- **Level 4 (Pro)**: 600 EXP - 2 paid chars, prompt controls
- **Level 5 (Elite)**: 1000 EXP - Featured chance, beta tools
- **Level 6 (Master)**: 1500 EXP - Creator badge, early revenue tools

## EXP Rewards

| Action | EXP | Daily Limit |
|--------|-----|-------------|
| Daily chat (any character) | 20 | 1/day |
| Create character | 30 | 2/day |
| Create scene | 15 | 2/day |
| Create persona | 15 | 2/day |
| Character liked | 5 (awarded to creator) | 20/day |
| Entity forked | 10 (awarded to creator) | No hard cap |
| Paid character sold | 50 (awarded to creator) | No cap |

## Daily EXP Caps

Users can earn a maximum amount of EXP per day based on their level:

| Level Range | Daily EXP Cap |
|-------------|---------------|
| L1-L2 | 150 EXP/day |
| L3-L4 | 300 EXP/day |
| L5-L6 | 500 EXP/day |

## Backend Routes

### `POST /api/exp/gain`
Award EXP for a user action with daily limits and caps.

**Request Body:**
```json
{
  "action": "create_character",
  "target_type": "character",  // Optional, for creator-targeted actions
  "target_id": 123             // Optional, entity ID
}
```

**Success Response:**
```json
{
  "awarded_to": "user_id",
  "action": "create_character",
  "success": true,
  "exp_added": 30,
  "total_exp": 130,
  "level": 2,
  "leveled_up": true,
  "daily_exp_gained": 30,
  "daily_exp_cap": 150,
  "action_count": 1,
  "action_limit": 2,
  "progress": {
    "current_level": 2,
    "level_name": "Creator",
    "total_exp": 130,
    "current_level_exp": 30,
    "exp_needed_for_next": 200,
    "exp_to_next_level": 170,
    "progress_percentage": 15.0,
    "is_max_level": false
  }
}
```

**Limit Reached Response (HTTP 429):**
```json
{
  "detail": "Daily limit reached for create_character (2/day)"
}
```

**Cap Reached Response (HTTP 429):**
```json
{
  "detail": "Daily EXP cap reached (150 EXP/day for level 1)"
}
```

### `GET /api/levels`
Retrieve all level information.

**Response:**
```json
{
  "1": { "name": "Newbie", "unlock": "Create chars, scenes, personas", "exp_required": 0 },
  "2": { "name": "Creator", "unlock": "Fork, private chars", "exp_required": 100 },
  ...
}
```

### `GET /api/exp/limits`
Get current user's daily limits and usage.

**Response:**
```json
{
  "level": 1,
  "daily_exp_gained": 30,
  "daily_exp_cap": 150,
  "remaining_exp": 120,
  "daily_action_counts": {
    "create_character": 1,
    "daily_chat": 1
  },
  "action_limits": {
    "daily_chat": 1,
    "create_character": 2,
    "create_scene": 2,
    "create_persona": 2,
    "character_liked": 20,
    "forked": null,
    "paid_char_sold": null
  },
  "exp_rewards": {
    "create_character": 30,
    "create_scene": 15,
    "create_persona": 15,
    "character_liked": 5,
    "forked": 10,
    "paid_char_sold": 50,
    "daily_chat": 20
  }
}
```

## Frontend Integration

### Client Utility
```javascript
import { silentExpGain } from '../utils/expUtils';

// Award EXP after a user action
await silentExpGain('create_character', null, sessionToken);

// Award EXP to entity creator
await silentExpGain('character_liked', { type: 'character', id: 123 }, sessionToken);
```

### Display Component
The `LevelProgress` component shows current level, EXP, and progress bar:
```jsx
import LevelProgress from '../components/LevelProgress';

<LevelProgress level={user.level} exp={user.exp} />
```

## Implementation

### Backend
- `backend/utils/level_system.py` - Core level/EXP logic
- `backend/routes/exp.py` - EXP award endpoint
- `backend/routes/character.py`, `scene.py`, `persona.py` - Auto-award on creation
- `backend/routes/user.py` - Award on like actions

### Frontend
- `frontend/src/utils/expUtils.js` - Client-side EXP utilities
- `frontend/src/components/LevelProgress.jsx` - Level display component
- Form pages hook into `silentExpGain()` on successful creation

## Notes
- **Centralized EXP System**: All EXP gains are managed through `award_exp_with_limits()` function
- **Daily Limits**: Each action has a daily limit (e.g., 2 character creations per day)
- **Daily Caps**: Total EXP per day is capped based on user level
- **Automatic Reset**: Daily limits reset at midnight UTC
- **Partial Awards**: If daily cap would be exceeded, user receives partial EXP to reach cap
- EXP is automatically awarded server-side for creation and like actions
- Frontend calls are optional; backend handles the actual awarding
- Level changes are reflected immediately in user data after refresh

## Implementation Status

### ✅ Fully Implemented (6/7 actions)
1. **daily_chat** (+20 EXP, 1/day) - Awarded once per day on first chat message
2. **create_character** (+30 EXP, 2/day) - Awarded automatically on character creation
3. **create_scene** (+15 EXP, 2/day) - Awarded automatically on scene creation
4. **create_persona** (+15 EXP, 2/day) - Awarded automatically on persona creation
5. **character_liked** (+5 EXP, 20/day) - Awarded to creator when their character is liked
6. **forked** (+10 EXP, no cap) - ⏳ Backend ready, requires fork feature implementation

### ⏳ Not Yet Implemented (1/7 actions)
1. **paid_char_sold** (+50 EXP, no cap) - Requires payment/marketplace system

## Database Migrations

Run these migrations in order:
```bash
# 1. Add level and exp columns
python backend/migrations/add_level_exp_system.py

# 2. Add last_chat_date column for daily chat tracking
python backend/migrations/add_last_chat_date.py

# 3. Add daily EXP limit tracking fields
python backend/migrations/add_daily_exp_limits.py
```
