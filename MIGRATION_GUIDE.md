# Migration Guide

This guide documents all major database migrations and implementation changes for the Mikoshi platform. Follow the order listed when setting up a new environment.

## Table of Contents
- [Required Migrations (In Order)](#required-migrations-in-order)
- [Chat History Migration](#chat-history-migration)
- [EXP & Level System](#exp--level-system)
- [Daily Limits Implementation](#daily-limits-implementation)
- [Quick Reference](#quick-reference)

---

## Required Migrations (In Order)

Run these migrations in sequence when setting up a new environment or upgrading:

```bash
cd backend

# 1. Level & EXP system
python migrations/add_level_exp_system.py

# 2. Daily chat tracking
python migrations/add_last_chat_date.py

# 3. Daily EXP limits
python migrations/add_daily_exp_limits.py

# 4. Chat history table split
python migrations/split_chat_history.py

# 5. Badge system
python migrations/add_badge_system.py

# 6. Admin column
python migrations/add_is_admin_column.py

# 7. System notifications
python migrations/add_system_notifications.py

# 8. Invitation codes
python migrations/create_invitation_codes_table.py

# Other migrations (as needed)
# SQL migrations (run with psql)
psql "$DATABASE_URL" -f migrations/add_phone_authentication.sql
psql "$DATABASE_URL" -f migrations/add_error_logging.sql
psql "$DATABASE_URL" -f migrations/add_payment_orders.sql

# PowerShell example
psql "$env:DATABASE_URL" -f migrations/add_payment_orders.sql

# Python migrations
python migrations/add_default_persona.py
python migrations/add_forked_from_fields.py
python migrations/add_visibility_and_fork_flags.py
python migrations/add_problem_report_target.py
python migrations/remove_recent_characters.py
```

---

## Chat History Migration

### Overview
Split `users.chat_history` JSONB array into separate `chat_histories` table for better data organization and query performance.

### What Changed
- **Before:** `users.chat_history` was a JSONB array storing all chats
- **After:** Separate `chat_histories` table with proper relationships
- **Frontend:** No changes needed - API response format identical

### Database Changes

**New `ChatHistory` Model:**
```python
class ChatHistory(Base):
    __tablename__ = "chat_histories"
    
    id = Column(Integer, primary_key=True)
    chat_id = Column(String, unique=True, nullable=False, index=True)
    user_id = Column(String, ForeignKey('users.id', ondelete='CASCADE'), nullable=False, index=True)
    character_id = Column(Integer, ForeignKey('characters.id', ondelete='SET NULL'))
    scene_id = Column(Integer, ForeignKey('scenes.id', ondelete='SET NULL'))
    persona_id = Column(Integer, ForeignKey('personas.id', ondelete='SET NULL'))
    character_name = Column(String)
    character_picture = Column(String)
    scene_name = Column(String)
    scene_picture = Column(String)
    title = Column(String(255), nullable=False)
    messages = Column(JSONB, default=[])
    last_updated = Column(DateTime(timezone=True), default=datetime.now(UTC))
    created_at = Column(DateTime(timezone=True), default=datetime.now(UTC))
```

**Modified User Model:**
- Removed: `chat_history = Column(ARRAY(JSONB), default=[])`
- Added: `chat_histories = relationship("ChatHistory", back_populates="user", cascade="all, delete-orphan")`

### Backend Utilities

**Created `backend/utils/chat_history_utils.py`:**
```python
# Fetch user's chat history
fetch_user_chat_history(db, user_id, limit=30)

# Get specific chat
fetch_chat_history_entry(db, user_id, chat_id)

# Create or update chat
upsert_chat_history_entry(db, user_id, chat_id, payload, limit=30)

# Prune old chats
prune_chat_history(db, user_id, limit=30)

# Serialize to JSON
serialize_chat_history_entry(entry)
```

**Created `backend/utils/user_utils.py`:**
```python
# Build user response with chat_history
build_user_response(user, db)
```

### For Backend Developers

**OLD (Don't use):**
```python
chat_list = current_user.chat_history  # ❌ No longer exists
```

**NEW (Use instead):**
```python
from utils.chat_history_utils import fetch_user_chat_history
chat_list = fetch_user_chat_history(db, current_user.id)  # ✅
```

**Creating/Updating a Chat:**
```python
from utils.chat_history_utils import upsert_chat_history_entry
from datetime import datetime, UTC

entry = upsert_chat_history_entry(
    db,
    user_id=current_user.id,
    chat_id=str(uuid.uuid4()),
    payload={
        "character_id": 123,
        "character_name": "Character Name",
        "character_picture": "url",
        "title": "Generated title",
        "messages": [...],
        "last_updated": datetime.now(UTC),
        "created_at": datetime.now(UTC),
    }
)
```

### For Frontend Developers

**No changes needed!** API response format is identical:
```javascript
// Still works exactly the same
userData.chat_history.forEach(chat => {
  console.log(chat.chat_id);
  console.log(chat.character_name);
  console.log(chat.messages);
});
```

### Running the Migration

```bash
cd backend
python migrations/split_chat_history.py
```

This script:
1. Creates new `chat_histories` table
2. Migrates existing data from `users.chat_history`
3. Drops old column from users table

### Verification

```sql
-- Check table exists and has data
SELECT COUNT(*) FROM chat_histories;

-- Verify users table no longer has chat_history column
SELECT * FROM information_schema.columns 
WHERE table_name='users' AND column_name='chat_history';

-- Check relationships work
SELECT ch.chat_id, u.email, ch.title 
FROM chat_histories ch
JOIN users u ON ch.user_id = u.id
LIMIT 5;
```

---

## EXP & Level System

### Overview
Comprehensive level system that rewards user actions with experience points (EXP).

### Implementation Status

**✅ Fully Implemented (6/7 actions):**
1. **daily_chat** (+20 EXP, 1/day) - Awarded once per day on first chat
2. **create_character** (+30 EXP, 2/day) - Auto-awarded on creation
3. **create_scene** (+15 EXP, 2/day) - Auto-awarded on creation
4. **create_persona** (+15 EXP, 2/day) - Auto-awarded on creation
5. **character_liked** (+5 EXP, 20/day) - Awarded to creator when liked
6. **forked** (+10 EXP, no cap) - Backend ready, requires fork feature

**⏳ Not Yet Implemented:**
1. **paid_char_sold** (+50 EXP, no cap) - Requires payment system

### Database Changes

**Added to User Model:**
```python
level = Column(Integer, default=1)
exp = Column(Integer, default=0)
last_chat_date = Column(Date)  # For daily_chat tracking
```

### Files Created

**Backend:**
- `backend/routes/exp.py` - EXP award endpoint
- `backend/utils/level_system.py` - Core EXP/level logic
- `backend/migrations/add_level_exp_system.py` - Migration
- `backend/migrations/add_last_chat_date.py` - Daily chat migration

**Frontend:**
- `frontend/src/utils/expUtils.js` - Client utilities
- `frontend/src/components/LevelProgress.jsx` - Display component

### Files Modified

**Backend:**
- `backend/models.py` - Added level, exp, last_chat_date
- `backend/schemas.py` - Added to UserOut schema
- `backend/routes/character.py` - Award EXP on creation
- `backend/routes/scene.py` - Award EXP on creation
- `backend/routes/persona.py` - Award EXP on creation
- `backend/routes/user.py` - Award EXP to creator on like
- `backend/routes/chat.py` - Award daily_chat EXP

**Frontend:**
- `frontend/src/pages/CharacterFormPage.jsx` - Silent EXP gain
- `frontend/src/pages/SceneFormPage.jsx` - Silent EXP gain
- `frontend/src/pages/PersonaFormPage.jsx` - Silent EXP gain
- `frontend/src/pages/ProfilePage.jsx` - Display LevelProgress

### Running the Migration

```bash
cd backend
python migrations/add_level_exp_system.py
python migrations/add_last_chat_date.py
```

### API Endpoints

**Award EXP:**
```http
POST /api/exp/gain
Body: { "action": "create_character" }

Response: {
  "success": true,
  "exp_added": 30,
  "total_exp": 130,
  "level": 2,
  "leveled_up": true
}
```

**Get Levels:**
```http
GET /api/levels

Response: {
  "1": {"name": "Newbie", "unlock": "...", "exp_required": 0},
  "2": {"name": "Creator", "unlock": "...", "exp_required": 100}
}
```

---

## Daily Limits Implementation

### Overview
Comprehensive daily limits system for EXP gains to prevent gaming and ensure balanced progression.

### Features

**1. Daily EXP Caps (Level-Based):**
| Level Range | Daily EXP Cap |
|-------------|---------------|
| L1-L2 | 150 EXP/day |
| L3-L4 | 300 EXP/day |
| L5-L6 | 500 EXP/day |

**2. Action-Specific Limits:**
| Action | EXP | Daily Limit |
|--------|-----|-------------|
| Daily chat | +20 | 1/day |
| Create character | +30 | 2/day |
| Create scene | +15 | 2/day |
| Create persona | +15 | 2/day |
| Character liked | +5 | 20/day |
| Forked | +10 | No cap |
| Paid char sold | +50 | No cap |

### Database Changes

**Added to User Model:**
```python
daily_exp_gained = Column(Integer, default=0)  # EXP gained today
last_exp_reset_date = Column(DateTime(timezone=True))  # Last reset
daily_action_counts = Column(JSONB, default={})  # Action tracking
```

### Centralized EXP Management

All EXP gains now go through `award_exp_with_limits()` function:
- ✅ Checks daily action limits
- ✅ Checks daily EXP caps
- ✅ Tracks action counts per day
- ✅ Automatically resets at midnight UTC
- ✅ Awards partial EXP if cap would be exceeded
- ✅ Returns detailed result with limit info

### Running the Migration

```bash
cd backend
python migrations/add_daily_exp_limits.py
```

### API Endpoints

**Check Limits:**
```http
GET /api/exp/limits

Response: {
  "level": 1,
  "daily_exp_gained": 30,
  "daily_exp_cap": 150,
  "remaining_exp": 120,
  "daily_action_counts": {"create_character": 1},
  "action_limits": {...},
  "exp_rewards": {...}
}
```

### Response Codes

- **200**: EXP awarded successfully
- **429**: Daily limit reached (action limit or EXP cap)
- **400**: Invalid action
- **401**: Not authenticated

### Limit Error Messages

- `"Daily limit reached for create_character (2/day)"`
- `"Daily EXP cap reached (150 EXP/day for level 1)"`

### Configuration

All limits are in `backend/utils/level_system.py`:

```python
# Daily EXP caps by level
DAILY_EXP_CAPS = {
    1: 150, 2: 150,
    3: 300, 4: 300,
    5: 500, 6: 500
}

# Daily action limits
DAILY_ACTION_LIMITS = {
    "daily_chat": 1,
    "create_character": 2,
    "create_scene": 2,
    "create_persona": 2,
    "character_liked": 20,
    "forked": None,
    "paid_char_sold": None
}
```

---

## Quick Reference

### Common Tasks

**Check if migrations are needed:**
```sql
-- Check for level/exp columns
SELECT column_name FROM information_schema.columns 
WHERE table_name='users' AND column_name IN ('level', 'exp', 'daily_exp_gained');

-- Check for chat_histories table
SELECT table_name FROM information_schema.tables WHERE table_name='chat_histories';

-- Check for badges column
SELECT column_name FROM information_schema.columns 
WHERE table_name='users' AND column_name='badges';
```

**Manually reset user limits:**
```sql
UPDATE users 
SET daily_exp_gained = 0, 
    daily_action_counts = '{}'::jsonb 
WHERE id = 'user_id';
```

**Grant admin access:**
```sql
UPDATE users SET is_admin = TRUE WHERE email = 'admin@example.com';
```

### Monitoring Queries

**Users hitting daily cap:**
```sql
SELECT id, name, level, daily_exp_gained 
FROM users 
WHERE daily_exp_gained >= (CASE WHEN level <= 2 THEN 150 WHEN level <= 4 THEN 300 ELSE 500 END)
ORDER BY daily_exp_gained DESC;
```

**Most active users today:**
```sql
SELECT id, name, daily_exp_gained, daily_action_counts
FROM users
ORDER BY daily_exp_gained DESC
LIMIT 10;
```

**Chat history statistics:**
```sql
SELECT user_id, COUNT(*) as chat_count
FROM chat_histories
GROUP BY user_id
ORDER BY chat_count DESC
LIMIT 10;
```

### Rollback Procedures

If you need to rollback changes:

**1. Revert Code:**
```bash
git revert <commit-hash>
```

**2. Rollback Database (if needed):**
```sql
-- For level system (if needed)
ALTER TABLE users DROP COLUMN IF EXISTS level;
ALTER TABLE users DROP COLUMN IF EXISTS exp;
ALTER TABLE users DROP COLUMN IF EXISTS last_chat_date;
ALTER TABLE users DROP COLUMN IF EXISTS daily_exp_gained;
ALTER TABLE users DROP COLUMN IF EXISTS last_exp_reset_date;
ALTER TABLE users DROP COLUMN IF EXISTS daily_action_counts;

-- For chat history (requires backup to restore data)
DROP TABLE IF EXISTS chat_histories CASCADE;
ALTER TABLE users ADD COLUMN chat_history JSONB[] DEFAULT '{}';

-- For badges
ALTER TABLE users DROP COLUMN IF EXISTS badges;
ALTER TABLE users DROP COLUMN IF EXISTS active_badge;
```

### Testing Checklist

**After Running Migrations:**
- [ ] All migrations completed without errors
- [ ] Database schema matches expected structure
- [ ] Backend server starts successfully
- [ ] User registration works
- [ ] User login works
- [ ] Chat creation/updates work
- [ ] EXP is awarded for actions
- [ ] Daily limits enforce correctly
- [ ] Frontend displays correctly

---

## Troubleshooting

### Migration Fails

**Problem:** Migration script fails with error

**Solutions:**
1. Check database connection string
2. Verify database user has proper permissions
3. Check for conflicting columns/tables
4. Review migration script output for specific error
5. Try running migration steps manually in psql

### Missing Columns

**Problem:** Backend crashes with "column does not exist"

**Solutions:**
1. Verify migration ran successfully
2. Check migration was committed to database
3. Restart backend server after migration
4. Run migration again (most are idempotent)

### Data Migration Issues

**Problem:** Existing data not migrated correctly

**Solutions:**
1. Check source data format matches expected
2. Review migration script logic
3. Run data verification queries
4. Manually fix inconsistent data
5. Restore from backup if needed

### Frontend Not Working After Migration

**Problem:** Frontend throws errors after backend changes

**Solutions:**
1. Clear browser cache
2. Refresh frontend dependencies: `npm install`
3. Check API response format matches frontend expectations
4. Review browser console for specific errors
5. Verify session token is still valid

---

## Best Practices

### Before Running Migrations

1. **Backup Database:**
   ```bash
   pg_dump database_name > backup_$(date +%Y%m%d_%H%M%S).sql
   ```

2. **Test in Development:**
   - Run migrations in dev environment first
   - Verify all functionality works
   - Test rollback procedures

3. **Review Migration Script:**
   - Understand what each migration does
   - Check for potential data loss
   - Verify idempotency where possible

### During Migration

1. **Monitor Progress:**
   - Watch for errors in migration output
   - Check database logs
   - Verify data integrity during migration

2. **Have Rollback Ready:**
   - Keep backup accessible
   - Know rollback SQL commands
   - Have previous code version ready

### After Migration

1. **Verify Changes:**
   - Run verification queries
   - Test affected functionality
   - Check API responses

2. **Monitor Application:**
   - Watch backend logs for errors
   - Monitor frontend for issues
   - Check user reports

3. **Document:**
   - Update this guide with any issues encountered
   - Document any manual steps taken
   - Note any deviations from standard process

---

**Last Updated:** January 2026
