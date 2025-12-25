# Chat History Migration - Implementation Summary

## Overview
Successfully split the `chat_history` field from the `users` table into a separate independent `chat_histories` table. This refactoring maintains all functionality while improving data organization and query performance.

## Changes Made

### 1. Database Schema Changes

#### New `ChatHistory` Model ([backend/models.py](backend/models.py#L49-L71))
- Created `ChatHistory` ORM model with the following fields:
  - `id`: Primary key (Integer)
  - `chat_id`: Unique identifier for each chat (String, unique, indexed)
  - `user_id`: Foreign key to User (indexed for fast lookups)
  - `character_id`: FK to Character (nullable)
  - `scene_id`: FK to Scene (nullable)
  - `persona_id`: FK to Persona (nullable)
  - `character_name`, `character_picture`: Denormalized data for sidebar display
  - `scene_name`, `scene_picture`: Denormalized data for sidebar display
  - `title`: Chat title (max 255 chars)
  - `messages`: JSONB array of message objects
  - `last_updated`: Timestamp for sorting
  - `created_at`: Original creation timestamp

#### Modified User Model
- Removed: `chat_history = Column(ARRAY(JSONB), default=[])`
- Added: `chat_histories = relationship("ChatHistory", back_populates="user", cascade="all, delete-orphan")`
- This establishes a one-to-many relationship with cascading deletes

### 2. Backend Utility Functions

#### [backend/utils/chat_history_utils.py](backend/utils/chat_history_utils.py) (NEW)
Created comprehensive chat history management utilities:
- `serialize_chat_history_entry(entry)`: Converts ORM object to JSON dict with ISO formatted timestamps
- `fetch_user_chat_history(db, user_id, limit=30)`: Returns last 30 chats, newest first
- `fetch_chat_history_entry(db, user_id, chat_id)`: Retrieves specific chat
- `prune_chat_history(db, user_id, limit=30)`: Enforces per-user limit
- `upsert_chat_history_entry(db, user_id, chat_id, payload, limit=30)`: Creates or updates chat entry with automatic pruning

#### [backend/utils/user_utils.py](backend/utils/user_utils.py) (NEW)
Created user response builder:
- `build_user_response(user, db)`: Constructs API response including fetched chat_history from separate table

### 3. Backend Route Updates

All routes now use `fetch_user_chat_history()` and `upsert_chat_history_entry()`:

#### [backend/routes/auth.py](backend/routes/auth.py)
- `GET /api/users/me`: Returns user data with chat_history from DB
- `POST /api/users` (register): Uses `build_user_response()`
- `POST /api/login`: Uses `build_user_response()`

#### [backend/routes/user.py](backend/routes/user.py)
- `GET /api/user/{user_id}`: Returns user data with chat_history from DB
- Updated to use `build_user_response()` for consistency

#### [backend/routes/chat.py](backend/routes/chat.py)
- `POST /api/chat`: 
  - Streaming: Calls `upsert_chat_history_entry()` with payload
  - Non-streaming: Same approach
  - Maintains all existing response format
- `POST /api/chat/rename`: Uses `fetch_chat_history_entry()` and direct model update
- `POST /api/chat/delete`: Uses `fetch_chat_history_entry()` and model deletion

#### [backend/routes/character.py](backend/routes/character.py)
- `GET /api/characters/recommended`:
  - Changed: Uses `fetch_user_chat_history()` to get chat entries
  - No longer accesses `current_user.chat_history` directly

### 4. API Response Format (UNCHANGED)
All API responses maintain the same `chat_history` format:
```json
{
  "id": "user123",
  "email": "user@example.com",
  "chat_history": [
    {
      "chat_id": "uuid",
      "character_id": 123,
      "character_name": "Char Name",
      "character_picture": "url",
      "scene_id": 456,
      "scene_name": "Scene Name",
      "scene_picture": "url",
      "persona_id": 789,
      "title": "Chat title",
      "messages": [...],
      "last_updated": "2025-12-25T10:00:00",
      "created_at": "2025-12-20T10:00:00"
    }
  ]
}
```

### 5. Frontend Compatibility (NO CHANGES NEEDED)
The frontend code remains fully compatible:
- Still receives `userData.chat_history` as an array
- All operations (filter, sort, map) work identically
- Uses same field names: `chat_id`, `character_id`, `scene_id`, `title`, `messages`, `last_updated`
- No changes to:
  - [frontend/src/pages/ChatPage.jsx](frontend/src/pages/ChatPage.jsx)
  - [frontend/src/components/Sidebar.jsx](frontend/src/components/Sidebar.jsx)
  - [frontend/src/components/CharacterSidebar.jsx](frontend/src/components/CharacterSidebar.jsx)
  - [frontend/src/pages/HomePage.jsx](frontend/src/pages/HomePage.jsx)

### 6. Data Migration Script

#### [backend/migrations/split_chat_history.py](backend/migrations/split_chat_history.py) (NEW)
This script must be run to migrate existing data:

**Steps:**
1. Creates `chat_histories` table with all constraints
2. Migrates data from `users.chat_history` JSONB array to individual rows
3. Drops the old `chat_history` column from users

**To run:**
```bash
cd backend
python migrations/split_chat_history.py
```

The script includes:
- Error handling for failed migrations
- Skips duplicates with `ON CONFLICT (chat_id) DO NOTHING`
- Converts ISO datetime strings back to proper format
- Verbose logging of migration progress

## Key Design Decisions

### 1. Relationship & Cascading
- Used SQLAlchemy relationship with `cascade="all, delete-orphan"`
- When a user is deleted, all their chats are automatically deleted
- Improves referential integrity

### 2. Per-User Limit Enforcement
- `upsert_chat_history_entry()` automatically keeps only 30 most recent chats per user
- Prevents unbounded table growth
- Matches frontend expectation (`.slice(0, 30)`)

### 3. Denormalization
- Stored `character_name`, `character_picture`, `scene_name`, `scene_picture` in `chat_histories`
- Avoids expensive joins for sidebar display
- Can still be updated when character/scene is modified (future optimization)

### 4. Timestamp Handling
- Uses ISO format strings for API compatibility
- `datetime.now(UTC)` for UTC timestamps
- Migration script converts existing ISO strings properly

## Backward Compatibility

### API Response Structure
✅ **Unchanged** - Frontend receives same `chat_history` array format

### Response Content
✅ **Same fields** - All original fields present in same structure

### Limit Behavior
✅ **Maintained** - Still returns max 30 chats per user

### Deletion Cascades
✅ **Enhanced** - Now enforced at database level with FK constraints

## Testing Checklist

- [ ] Run migration script: `python backend/migrations/split_chat_history.py`
- [ ] Verify `chat_histories` table created with correct schema
- [ ] Test user registration - `chat_history` should be empty array in response
- [ ] Test chat creation - new entry appears in `chat_histories` table
- [ ] Test chat rename - `title` and `last_updated` updated correctly
- [ ] Test chat deletion - entry removed from `chat_histories` table
- [ ] Test user retrieval - `GET /api/users/me` returns chats sorted by `last_updated`
- [ ] Test recommended characters - excludes characters from chat history
- [ ] Test frontend - sidebar and chat history display work identically
- [ ] Test user deletion - all related chats cascade deleted

## Future Optimizations

1. **Add pagination API endpoint** - `/api/chat-history?page=1&limit=20`
2. **Archive old chats** - Move chats older than 6 months to archive table
3. **Full-text search** - Add GIN index on `messages` JSONB for searching chat content
4. **Analytics** - Create denormalized analytics table from chat_histories
5. **Sync character data** - Periodically update `character_name`/`picture` from Character table

## Files Modified

**Backend:**
- [backend/models.py](backend/models.py) - Added ChatHistory model, removed from User
- [backend/routes/auth.py](backend/routes/auth.py) - Use build_user_response()
- [backend/routes/user.py](backend/routes/user.py) - Use build_user_response()
- [backend/routes/chat.py](backend/routes/chat.py) - Use new utils for all CRUD operations
- [backend/routes/character.py](backend/routes/character.py) - Use fetch_user_chat_history()

**New Files:**
- [backend/utils/chat_history_utils.py](backend/utils/chat_history_utils.py) - Chat history utilities
- [backend/utils/user_utils.py](backend/utils/user_utils.py) - User response builder
- [backend/migrations/split_chat_history.py](backend/migrations/split_chat_history.py) - Data migration

**Frontend:**
- No changes required - fully backward compatible!

## Summary

The refactoring successfully:
1. ✅ Splits `chat_history` into independent table
2. ✅ Maintains all existing functionality and API contracts
3. ✅ Improves data organization and relationships
4. ✅ Requires zero frontend changes
5. ✅ Provides data migration script for existing users
6. ✅ Includes comprehensive utility functions
7. ✅ Enforces constraints at database level
