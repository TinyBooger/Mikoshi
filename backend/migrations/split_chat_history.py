"""
Migration script to split chat_history from users table into a separate chat_histories table.

This script:
1. Creates the new chat_histories table
2. Migrates existing chat_history data from the users table
3. Removes the chat_history column from users table
"""

from sqlalchemy import create_engine, text, Integer, String, DateTime, JSONB, ForeignKey, Column
from sqlalchemy.ext.declarative import declarative_base
import os
from dotenv import load_dotenv
from datetime import datetime, UTC

# Load environment variables
if os.path.exists("../secrets/Mikoshi.env"):
    load_dotenv("../secrets/Mikoshi.env")

Base = declarative_base()

def run_migration():
    # Get database URL from environment
    database_url = os.getenv("DATABASE_URL")
    
    if not database_url:
        print("ERROR: DATABASE_URL not found in environment variables")
        return
    
    print(f"Connecting to database...")
    engine = create_engine(database_url)
    
    with engine.connect() as conn:
        # Step 1: Create chat_histories table if it doesn't exist
        print("Creating chat_histories table...")
        try:
            conn.execute(text("""
                CREATE TABLE IF NOT EXISTS chat_histories (
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
                )
            """))
            conn.commit()
            print("✓ chat_histories table created")
        except Exception as e:
            print(f"ERROR creating chat_histories table: {e}")
            conn.rollback()
            return
        
        # Step 2: Migrate data from users.chat_history to chat_histories
        print("Migrating chat history data...")
        try:
            # Get all users with chat_history data
            result = conn.execute(text("""
                SELECT id, chat_history 
                FROM users 
                WHERE chat_history IS NOT NULL AND chat_history != '[]'::jsonb
            """))
            
            users_data = result.fetchall()
            migrated_count = 0
            
            for user_id, chat_history_array in users_data:
                # chat_history_array is a JSONB array of chat objects
                if not chat_history_array:
                    continue
                
                for chat_obj in chat_history_array:
                    try:
                        # Extract fields from the chat object
                        chat_id = chat_obj.get('chat_id')
                        if not chat_id:
                            continue
                        
                        # Insert into chat_histories table
                        conn.execute(text("""
                            INSERT INTO chat_histories (
                                chat_id, user_id, character_id, scene_id, persona_id,
                                character_name, character_picture, scene_name, scene_picture,
                                title, messages, last_updated, created_at
                            ) VALUES (
                                :chat_id, :user_id, :character_id, :scene_id, :persona_id,
                                :character_name, :character_picture, :scene_name, :scene_picture,
                                :title, :messages, :last_updated, :created_at
                            )
                            ON CONFLICT (chat_id) DO NOTHING
                        """), {
                            'chat_id': chat_id,
                            'user_id': user_id,
                            'character_id': chat_obj.get('character_id'),
                            'scene_id': chat_obj.get('scene_id'),
                            'persona_id': chat_obj.get('persona_id'),
                            'character_name': chat_obj.get('character_name'),
                            'character_picture': chat_obj.get('character_picture'),
                            'scene_name': chat_obj.get('scene_name'),
                            'scene_picture': chat_obj.get('scene_picture'),
                            'title': chat_obj.get('title', 'Chat'),
                            'messages': chat_obj.get('messages', []),
                            'last_updated': chat_obj.get('last_updated') or datetime.now(UTC).isoformat(),
                            'created_at': chat_obj.get('created_at') or datetime.now(UTC).isoformat(),
                        })
                        migrated_count += 1
                    except Exception as e:
                        print(f"  Warning: Failed to migrate chat {chat_id} for user {user_id}: {e}")
            
            conn.commit()
            print(f"✓ Migrated {migrated_count} chat history entries")
        except Exception as e:
            print(f"ERROR migrating data: {e}")
            conn.rollback()
            return
        
        # Step 3: Drop the chat_history column from users table
        print("Dropping chat_history column from users table...")
        try:
            conn.execute(text("ALTER TABLE users DROP COLUMN IF EXISTS chat_history"))
            conn.commit()
            print("✓ chat_history column removed from users table")
        except Exception as e:
            print(f"ERROR dropping column: {e}")
            conn.rollback()
            return
        
        print("\n✅ Migration completed successfully!")
        print("The chat_history column has been migrated to a separate chat_histories table.")

if __name__ == "__main__":
    run_migration()
