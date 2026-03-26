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
- Other SQL/Python migrations as needed

## Chat History Migration
- Split users.chat_history JSONB into chat_histories table for better organization and performance.
- Backend utilities for fetching, updating, and pruning chat history.
