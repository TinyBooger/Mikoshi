# Badge System Implementation

## Overview
The badge system allows users to earn achievements based on their activities and milestones. Each badge has an associated avatar frame with metal textures and can be displayed on their profile. Users can select which badge to display or hide it completely.

## Features

### Visual Design
- **Avatar Frames**: Metal-textured circular frames around profile pictures
  - Bronze: Bronze metal with warm brown tones
  - Silver: Silver/chrome with reflective highlights  
  - Gold: Gold with radiant glow effects
  - Pioneer: Red with distinctive special coloring

- **Text Badges**: Colored text labels next to username on profile
  - Shows active badge name with matching color scheme
  - Automatically translated

### User Controls
- **Badge Selection**: Users can choose which badge to display via "Manage Badges" button
- **Toggle Display**: Option to show no badge at all
- **One-Click Switch**: Instant activation of earned badges

## Badges

### Current Badges

1. **Pioneer** ⭐
   - Description: Early adopter of Mikoshi
   - Condition: Manual award by admin
   - Frame: `pioneer_frame`
   - Color: Red (#FF6B6B)

2. **Bronze Creator** 🥉
   - Description: Reached 1,000 chats
   - Condition: Automatic (chat-based)
   - Threshold: 1,000 chats
   - Frame: `bronze_frame`
   - Color: Bronze (#CD7F32)

3. **Silver Creator** 🥈
   - Description: Reached 10,000 chats
   - Condition: Automatic (chat-based)
   - Threshold: 10,000 chats
   - Frame: `silver_frame`
   - Color: Silver (#C0C0C0)

4. **Gold Creator** 🥇
   - Description: Reached 100,000 chats
   - Condition: Automatic (chat-based)
   - Threshold: 100,000 chats
   - Frame: `gold_frame`
   - Color: Gold (#FFD700)

## Technical Architecture

### Backend

#### Models (`backend/models.py`)
- **User.badges**: JSONB field storing badge data
  - Structure: `{badge_key: {awarded_at: timestamp, frame: frame_id, name: str, description: str}}`
- **User.active_badge**: String field tracking which badge is currently displayed (nullable)

#### Badge System Utility (`backend/utils/badge_system.py`)
Main functions:
- `check_and_award_chat_badges(user, db)`: Automatically check and award chat-based badges
- `award_badge(user, badge_key, db)`: Award a specific badge to a user
- `has_badge(user, badge_key)`: Check if user has a badge
- `get_user_badges(user)`: Get all badges for a user
- `remove_badge(user, badge_key, db)`: Remove a badge (admin only)
- `get_all_badges_info()`: Get badge definitions
- `get_user_chat_count(user_id, db)`: Count total chats for a user

#### Routes (`backend/routes/user.py`)
- `GET /api/badges`: Get all badge definitions
- `GET /api/user/{user_id}/badges`: Get badges for specific user
- `POST /api/user/badges/check-and-award`: Check and award badges for current user
- `POST /api/user/active-badge`: Set which badge to display (or null to hide)
- `POST /api/admin/badges/{user_id}/award`: Admin endpoint to award badges
- `POST /api/admin/badges/{user_id}/remove`: Admin endpoint to remove badges

#### Chat Routes (`backend/routes/chat.py`)
- Badge checks are automatically triggered after each chat completion
- Calls `check_and_award_chat_badges()` to verify and award applicable badges

#### Schema (`backend/schemas.py`)
- Updated `UserOut` model with `badges` and `active_badge` fields

#### Migration (`backend/migrations/add_badge_system.py`)
- Adds `badges` JSONB column to `users` table
- Adds `active_badge` VARCHAR column to `users` table
- Can be run with: `python -m migrations.add_badge_system`

### Frontend

#### AvatarFrame Component (`frontend/src/components/AvatarFrame.jsx`)
- Renders metal-textured circular frames for badge display
- Supports bronze, silver, gold, and pioneer badges
- Scalable design (size prop controls dimensions)
- Includes inner decorative rings and gradient effects
- Wraps any avatar image with the frame

#### UserCard Component (`frontend/src/components/UserCard.jsx`)
- Displays badges as small circular icons with emojis
- Shows active badge frame around user avatar
- Tooltip on hover with badge name and description
- Color-coded by badge type
- Uses `getBadgeColor()` and `getBadgeEmoji()` helper functions

#### ProfilePage Component (`frontend/src/pages/ProfilePage.jsx`)
- **Badge Frame Display**: Avatar wrapped in active badge frame
- **Text Badge**: Colored badge name next to username
- **Badge Management Button**: "Manage Badges" opens selection modal
- **Badge Selector Modal**: 
  - Grid of earned badges
  - "No Badge" option to hide display
  - Visual selection indicator
  - Instant activation on click
- **Badge Award Modal**: Celebration popup for newly earned badges
- Uses helper functions for colors and emojis

## How Badges Are Awarded

### Automatic Badges (Chat-based)
1. After every chat completion, `check_and_award_chat_badges()` is called
2. Function counts total chats for the user via `get_user_chat_count()`
3. If chat count reaches a threshold and user doesn't already have the badge:
   - Badge is awarded automatically
   - Badge data is stored with timestamp
4. This happens in both streaming and non-streaming chat endpoints

### Manual Badges (Admin-awarded)
1. Admin calls `POST /api/admin/badges/{user_id}/award` with badge key (e.g., "pioneer")
2. `award_badge()` function:
   - Validates badge exists
   - Checks user doesn't already have it
   - Adds badge with current timestamp
3. Admin can also remove badges via `POST /api/admin/badges/{user_id}/remove`

## Adding New Badges

To add a new badge, follow these steps:

1. **Update badge definitions** in `backend/utils/badge_system.py`:
   ```python
   BADGES = {
       "new_badge": {
           "name": "Badge Display Name",
           "description": "Badge description",
           "frame": "frame_id",
           "condition": "condition_type"  # "manual", "1k_chats", etc.
       }
   }
   ```

2. **Add condition checking** in `backend/utils/badge_system.py`:
   - If automatic: Add logic to `check_and_award_chat_badges()` or create new check function
   - If manual: No additional code needed

3. **Update frontend** in `frontend/src/components/UserCard.jsx` and `frontend/src/pages/ProfilePage.jsx`:
   ```javascript
   function getBadgeColor(badgeKey) {
       const colors = {
           new_badge: '#HEX_COLOR'
       };
   }
   
   function getBadgeEmoji(badgeKey) {
       const emojis = {
           new_badge: '😊'
       };
   }
   ```

4. **Add translation** (if using i18n):
   - Update locale files for badge names and descriptions

## Data Structure Example

```json
{
  "user_id": "user123",
  "badges": {
    "pioneer": {
      "awarded_at": "2024-01-15T10:30:00Z",
      "frame": "pioneer_frame",
      "name": "Pioneer",
      "description": "Early adopter of Mikoshi"
    },
    "gold_creator": {
      "awarded_at": "2024-02-20T15:45:00Z",
      "frame": "gold_frame",
      "name": "Gold Creator",
      "description": "Reached 100,000 chats"
    }
  }
}
```

## Future Enhancements

Potential badges to add:
- Achievement badges (e.g., "Popular Creator", "Community Helper")
- Limited-time event badges
- Special event badges (anniversaries, milestones)
- User-to-user recognition badges
- Activity streaks (consecutive days of chatting)
- Collaboration badges (multiple co-creators)
