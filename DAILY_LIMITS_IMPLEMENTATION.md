# Daily EXP Caps & Action Limits Implementation

## Overview
Implemented comprehensive daily limits system for EXP gains to prevent gaming and ensure balanced progression. All EXP gains are now managed through a centralized function with automatic daily resets.

## New System Features

### 1. Daily EXP Caps (Level-Based)
| Level Range | Daily EXP Cap |
|-------------|---------------|
| L1-L2 | 150 EXP/day |
| L3-L4 | 300 EXP/day |
| L5-L6 | 500 EXP/day |

### 2. Action-Specific Limits
| Action | EXP | Daily Limit |
|--------|-----|-------------|
| Daily chat (any character) | +20 | 1/day |
| Create character | +30 | 2/day |
| Create scene | +15 | 2/day |
| Create persona | +15 | 2/day |
| Character liked | +5 | 20/day |
| Forked | +10 | No hard cap |
| Paid char sold | +50 | No cap |

### 3. Centralized EXP Management
All EXP gains now go through `award_exp_with_limits()` function which:
- ✅ Checks daily action limits
- ✅ Checks daily EXP caps
- ✅ Tracks action counts per day
- ✅ Automatically resets at midnight UTC
- ✅ Awards partial EXP if cap would be exceeded
- ✅ Returns detailed result with limit info

## Changes Summary

### Backend Changes

#### New Database Fields (User model)
```python
daily_exp_gained = Column(Integer, default=0)  # EXP gained today
last_exp_reset_date = Column(DateTime(timezone=True))  # Last daily reset
daily_action_counts = Column(JSONB, default={})  # Track action counts
```

#### Updated Files
1. **backend/models.py** - Added 3 new fields to User model
2. **backend/utils/level_system.py** - Added centralized EXP system:
   - `award_exp_with_limits()` - Main function for all EXP gains
   - `reset_daily_limits_if_needed()` - Auto-reset helper
   - `DAILY_ACTION_LIMITS` - Action limit configuration
   - `DAILY_EXP_CAPS` - Level-based cap configuration
   - Updated `EXP_REWARDS` - Changed daily_chat from 10 to 20
   - Removed `chat_used_50` action

3. **backend/routes/character.py** - Uses centralized function
4. **backend/routes/scene.py** - Uses centralized function
5. **backend/routes/persona.py** - Uses centralized function
6. **backend/routes/user.py** - Uses centralized function
7. **backend/routes/chat.py** - Uses centralized function, removed milestone tracking
8. **backend/routes/exp.py** - Updated to use centralized function, added `/api/exp/limits` endpoint

#### New Endpoints

**GET /api/exp/limits**
Returns user's current daily limits and usage:
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
    ...
  },
  "exp_rewards": {
    "create_character": 30,
    ...
  }
}
```

#### Updated API Responses

All EXP-awarding endpoints now return:
```json
{
  "success": true,
  "exp_added": 30,
  "total_exp": 130,
  "level": 2,
  "leveled_up": true,
  "daily_exp_gained": 30,
  "daily_exp_cap": 150,
  "action_count": 1,
  "action_limit": 2,
  "progress": { ... }
}
```

If limit reached (HTTP 429):
```json
{
  "detail": "Daily limit reached for create_character (2/day)"
}
```

### Frontend Changes

#### Updated Files
1. **frontend/src/utils/expUtils.js**
   - Updated `EXP_REWARDS` constants
   - Added `DAILY_ACTION_LIMITS` export
   - Removed `chat_used_50` reference

2. **frontend/src/components/LevelProgress.jsx**
   - Updated reward display to show limits
   - Changed daily_chat from 10 to 20 EXP
   - Removed chat_used_50 display

3. **frontend/src/locales/en.json**
   - Updated reward translations with EXP values
   - Added daily_limits translations

4. **frontend/src/locales/zh.json**
   - Updated Chinese translations
   - Added daily_limits translations

### Documentation Changes

1. **EXP_SYSTEM.md** - Complete rewrite with:
   - Daily caps table
   - Action limits table
   - New endpoint documentation
   - Limit error responses
   - Implementation notes

2. **DAILY_LIMITS_IMPLEMENTATION.md** - This file

### Migration Files

Created: **backend/migrations/add_daily_exp_limits.py**
- Adds `daily_exp_gained` column
- Adds `last_exp_reset_date` column
- Adds `daily_action_counts` JSONB column

## How It Works

### Daily Reset Logic
```python
def reset_daily_limits_if_needed(user):
    today = datetime.now(UTC).date()
    last_reset = user.last_exp_reset_date.date() if user.last_exp_reset_date else None
    
    if last_reset != today:
        user.daily_exp_gained = 0
        user.daily_action_counts = {}
        user.last_exp_reset_date = datetime.now(UTC)
```

### EXP Award Flow
1. User performs action (e.g., creates character)
2. Backend calls `award_exp_with_limits(user, "create_character", db)`
3. Function checks if daily reset needed
4. Function validates action exists
5. Function checks action limit (2/day for characters)
6. Function checks daily EXP cap (based on level)
7. Function calculates actual EXP (may be partial if near cap)
8. Function updates user: exp, level, daily_exp_gained, action_count
9. Function commits to database
10. Function returns detailed result

### Example Scenarios

#### Scenario 1: Normal Award
- User level 1 (150 EXP cap/day)
- Daily EXP gained: 0
- Action: Create character (+30 EXP)
- Result: ✅ Award 30 EXP, daily_exp_gained = 30

#### Scenario 2: Partial Award
- User level 1 (150 EXP cap/day)
- Daily EXP gained: 140
- Action: Create character (+30 EXP)
- Result: ✅ Award 10 EXP (partial), daily_exp_gained = 150

#### Scenario 3: Action Limit Reached
- User level 1
- Daily action counts: { "create_character": 2 }
- Action: Create character (+30 EXP)
- Result: ❌ HTTP 429 "Daily limit reached for create_character (2/day)"

#### Scenario 4: Cap Reached
- User level 1 (150 EXP cap/day)
- Daily EXP gained: 150
- Action: Create scene (+15 EXP)
- Result: ❌ HTTP 429 "Daily EXP cap reached (150 EXP/day for level 1)"

## Breaking Changes

### Removed Feature
- ❌ **chat_used_50** action removed
  - Previously: +10 EXP every 50 messages
  - Reason: Too easy to game, replaced by single daily_chat reward
  - Migration: No action needed, just removed from code

### Changed Values
- **daily_chat**: 10 EXP → 20 EXP (doubled to compensate for removal of milestone)

## Migration Steps

### 1. Run Database Migrations
```bash
cd backend

# If not already done:
python migrations/add_level_exp_system.py

# New migration for daily limits:
python migrations/add_daily_exp_limits.py
```

### 2. Deploy Backend
- All routes automatically use new centralized function
- Old EXP awards will be rejected (no limits tracked)
- Users will get 429 errors when limits hit

### 3. Update Frontend (Optional)
- Frontend changes are cosmetic (display only)
- Old frontend will still work, just won't show limits
- Recommended to update for better UX

### 4. Monitor & Adjust
- Check `/api/exp/limits` endpoint to see user patterns
- Adjust caps/limits if needed in `level_system.py`
- No database changes needed for cap adjustments

## Testing Checklist

### Backend Testing
- [ ] Create 2 characters in one day → 3rd should fail
- [ ] Create 2 scenes in one day → 3rd should fail
- [ ] Chat twice in one day → 2nd should not award EXP
- [ ] Like 20 characters in one day → 21st should fail (for creator)
- [ ] Gain 150 EXP at L1 → next action should fail
- [ ] Wait until next day → limits should reset
- [ ] Level up from L2 to L3 → cap should increase to 300
- [ ] GET /api/exp/limits returns correct data
- [ ] Daily reset happens at midnight UTC

### Frontend Testing
- [ ] LevelProgress shows correct EXP values
- [ ] Daily limits display correctly
- [ ] Translations work (EN + ZH)
- [ ] Removed chat_used_50 from UI

### Integration Testing
- [ ] Create character → Response includes exp_result
- [ ] Hit limit → Frontend receives 429 error
- [ ] Refresh user data → Limits update correctly

## Monitoring & Analytics

### Key Metrics to Track
1. **Users hitting daily caps** (by level)
2. **Most commonly hit action limits**
3. **Average daily EXP gained** (by level)
4. **Conversion rate**: Users hitting cap → level up
5. **Churn rate**: Users leaving after hitting caps

### Suggested Adjustments

If users hit caps too early:
- Increase DAILY_EXP_CAPS in level_system.py
- Increase action limits (e.g., 3 characters/day)

If users don't hit caps:
- Current limits are fine
- Consider adding more EXP actions

If specific action is gamed:
- Lower its daily limit
- Lower its EXP reward

## Future Enhancements

1. **Weekly Bonuses**: Extra cap on weekends
2. **Streak Rewards**: Bonus for consecutive days
3. **Premium Tiers**: Higher caps for paid users
4. **Seasonal Events**: Temporary cap increases
5. **Achievement Multipliers**: Bonus EXP for milestones
6. **Referral Bonuses**: Extra EXP for invites
7. **Admin Override**: Manually adjust user limits
8. **Rollover EXP**: Unused cap carries to next day (partial)

## Rollback Plan

If issues arise, rollback steps:

1. **Revert backend code**:
   ```bash
   git revert <commit-hash>
   ```

2. **No database rollback needed**:
   - New columns can remain (default values)
   - Old code will ignore them
   - Or manually drop columns:
   ```sql
   ALTER TABLE users DROP COLUMN daily_exp_gained;
   ALTER TABLE users DROP COLUMN last_exp_reset_date;
   ALTER TABLE users DROP COLUMN daily_action_counts;
   ```

3. **Revert frontend** (optional):
   ```bash
   git revert <commit-hash>
   ```

## Support & Maintenance

### Common Issues

**Issue**: Users complaining about limits
- **Solution**: Explain limits in UI, add tooltips
- **Escalation**: Consider raising caps for higher levels

**Issue**: Limits not resetting
- **Solution**: Check server timezone is UTC
- **Escalation**: Manually reset via SQL:
  ```sql
  UPDATE users SET daily_exp_gained = 0, daily_action_counts = '{}';
  ```

**Issue**: Action limit not enforced
- **Solution**: Check route is calling `award_exp_with_limits()`
- **Escalation**: Review code, ensure centralized function used

### Configuration Updates

All limits are in `backend/utils/level_system.py`:

```python
# To adjust daily caps:
DAILY_EXP_CAPS = {
    1: 200,  # Increased from 150
    ...
}

# To adjust action limits:
DAILY_ACTION_LIMITS = {
    "create_character": 3,  # Increased from 2
    ...
}

# To adjust EXP rewards:
EXP_REWARDS = {
    "create_character": 40,  # Increased from 30
    ...
}
```

After changes: Restart server, no migration needed.

---

**Implementation Date**: December 29, 2024
**Status**: ✅ Complete
**Version**: 2.0
