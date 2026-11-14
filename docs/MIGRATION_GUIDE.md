# Migration Guide

Major database migrations and implementation changes for Mikoshi. Run migrations in order for new setups or upgrades.

## Required Migrations
- Level & EXP system
- Daily chat tracking
- Daily EXP limits
- Chat history table split
- Badge system
- Admin column
- System notifications
- Invitation codes
- Character setting merge (`characters.persona` + `characters.long_description` → `characters.description`, see `backend/migrations/migration5.sql`)
- Non-unique character and persona names (see `backend/migrations/migration6.sql`)
- Reporter-facing problem report replies (`backend/migrations/add_problem_report_user_note.sql`)
- Other SQL/Python migrations as needed

## Chat History Migration
- Split users.chat_history JSONB into chat_histories table for better organization and performance.
- Backend utilities for fetching, updating, and pruning chat history.

## Chat Message Store (one row per message)
- Transcripts live in `chat_history_messages` (`chat_id`, `branch_id`, `created_seq`, `message_id`, `role`, `content`, `usage`, `is_pinned`, `created_at`), one row per message, with branches in `chat_history_branches`. `chat_histories` holds chat metadata only.
- `created_seq` is the per-branch order and the unique key `(chat_id, branch_id, created_seq)` — timestamps are never used for ordering because imported messages may not have meaningful ones.
- Step 1 — `backend/migrations/add_chat_history_message_tables.sql` creates the tables and backfills them while keeping `chat_histories.messages` for rollback.
- Step 2 — `backend/migrations/drop_chat_history_messages_blob.sql` backfills anything still blob-only, verifies every message has a row, then drops `chat_histories.messages`. Deploy the backend that no longer maps `ChatHistory.messages` before running it; the script is a no-op on a second run.
- Runtime reads only fetch the newest slice of a branch (`fetch_chat_history_branch_context`, bounded by `HISTORY_CONTEXT_MESSAGE_WINDOW` / `HISTORY_TOKEN_BUDGET`); `serialize_chat_history_entry(message_limit=…)` ships only the newest N messages of each branch plus its full `message_count`.
- Every read path is bounded. `GET /api/chat/history/{chat_id}` returns the newest `limit` messages per branch (default `CHAT_OPEN_MESSAGE_LIMIT` = 50, matching the chat page's first paint) with `oldest_seq`, `has_more` and the branch's `pinned_messages`; `GET /api/chat/history/{chat_id}/messages?branch_id=…&before_seq=…&limit=…` pages backwards from `oldest_seq`, so scrollback never loads a whole transcript. Branch switching and pinning use the same window.
- Writes append rows: a turn is two inserts, and an import is chunked executemany inserts (`MESSAGE_INSERT_CHUNK_SIZE`) inside one transaction.
