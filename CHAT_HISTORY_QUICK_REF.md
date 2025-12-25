# Chat History Migration - Quick Reference

## What Changed?
- **Before:** `users.chat_history` was a JSONB array column storing all user chats
- **After:** Chats are stored in a separate `chat_histories` table with proper relationships
- **Frontend:** No changes needed! API response format is identical

## For Backend Developers

### Accessing User's Chat History
```python
# OLD (DON'T USE):
chat_list = current_user.chat_history  # ❌ No longer exists

# NEW (USE):
from utils.chat_history_utils import fetch_user_chat_history
chat_list = fetch_user_chat_history(db, current_user.id)  # ✅
```

### Creating/Updating a Chat
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
        "scene_id": 456,  # optional
        "persona_id": 789,  # optional
        "title": "Generated title",
        "messages": [...],
        "last_updated": datetime.now(UTC),
        "created_at": datetime.now(UTC),
    }
)
# Entry is automatically pruned to keep only 30 most recent
```

### Building User Response
```python
from utils.user_utils import build_user_response

user_response = build_user_response(user, db)
# Returns: dict with all user fields + chat_history array fetched from DB
```

### Getting a Specific Chat
```python
from utils.chat_history_utils import fetch_chat_history_entry

entry = fetch_chat_history_entry(db, user_id, chat_id)
if entry:
    entry.title = "New Title"
    db.commit()
```

### Deleting a Chat
```python
from utils.chat_history_utils import fetch_chat_history_entry

entry = fetch_chat_history_entry(db, user_id, chat_id)
if entry:
    db.delete(entry)
    db.commit()
```

## For Frontend Developers

### No Changes Needed! 🎉
The API response format is identical:
```javascript
// Still works exactly the same
userData.chat_history.forEach(chat => {
  console.log(chat.chat_id);
  console.log(chat.character_name);
  console.log(chat.messages);
  // ... all fields available
});
```

All existing code continues to work:
- Filtering by character_id ✅
- Sorting by last_updated ✅
- Accessing messages array ✅
- Setting chat_history in state ✅

## Running the Migration

After deploying the code changes:

```bash
cd backend
python migrations/split_chat_history.py
```

This script:
1. ✅ Creates new `chat_histories` table
2. ✅ Migrates existing data from `users.chat_history`
3. ✅ Drops old column from users table

## Verification

After migration, verify with:
```sql
-- Check table exists and has data
SELECT COUNT(*) FROM chat_histories;

-- Check users table no longer has chat_history column
SELECT * FROM information_schema.columns 
WHERE table_name='users' AND column_name='chat_history';
-- Should return 0 rows

-- Check relationships work
SELECT ch.chat_id, u.email, ch.title 
FROM chat_histories ch
JOIN users u ON ch.user_id = u.id
LIMIT 5;
```

## API Endpoints (Unchanged)

```
GET  /api/users/me                    # Returns user with chat_history
GET  /api/user/{user_id}              # Returns user with chat_history
POST /api/login                        # Returns user with chat_history
POST /api/users                        # Register user (empty chat_history)
POST /api/chat                         # Create/update chat
POST /api/chat/rename                  # Rename chat
POST /api/chat/delete                  # Delete chat
GET  /api/characters/recommended       # Excludes chatted characters
```

## Database Schema

```sql
CREATE TABLE chat_histories (
    id SERIAL PRIMARY KEY,
    chat_id VARCHAR UNIQUE NOT NULL,
    user_id VARCHAR NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    character_id INTEGER REFERENCES characters(id) ON DELETE SET NULL,
    scene_id INTEGER REFERENCES scenes(id) ON DELETE SET NULL,
    persona_id INTEGER REFERENCES personas(id) ON DELETE SET NULL,
    character_name VARCHAR,
    character_picture VARCHAR,
    scene_name VARCHAR,
    scene_picture VARCHAR,
    title VARCHAR(255) NOT NULL,
    messages JSONB DEFAULT '[]',
    last_updated TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for common queries
CREATE INDEX idx_chat_histories_user_id ON chat_histories(user_id);
CREATE INDEX idx_chat_histories_chat_id ON chat_histories(chat_id);
```

## Common Issues & Solutions

### Issue: "AttributeError: 'User' object has no attribute 'chat_history'"
**Solution:** Use `fetch_user_chat_history(db, user_id)` instead

### Issue: Chat not updating
**Solution:** Use `upsert_chat_history_entry()` which handles updates AND creates

### Issue: More than 30 chats per user
**Solution:** This is intentional - `upsert_chat_history_entry()` auto-prunes to 30

### Issue: Frontend showing old chat data
**Solution:** Refresh `userData` by calling `refreshUserData()` from AuthContext

## Files Location Reference

```
backend/
  models.py                      # ChatHistory model definition
  utils/
    chat_history_utils.py        # ✅ NEW - Core utilities
    user_utils.py                # ✅ NEW - User response builder
  routes/
    chat.py                       # Updated to use new utilities
    auth.py                       # Updated to use new utilities
    user.py                       # Updated to use new utilities
    character.py                  # Updated to use new utilities
  migrations/
    split_chat_history.py         # ✅ NEW - Run this after deploying

frontend/
  (No changes needed)
```

## Rollback Plan (If Needed)

If you need to revert:
1. Revert git commits to restore old code
2. Drop `chat_histories` table
3. Add `chat_history` column back to users table
4. Restore data (requires backup)

This is why we keep the migration separate - easy to reverse if needed.
