"""
Migration script to add fork tracking fields to existing tables.
This allows entities to reference their original source when forked,
giving credit to the original character/scene/persona.

- characters: add columns forked_from_id INTEGER, forked_from_name VARCHAR
- scenes:     add columns forked_from_id INTEGER, forked_from_name VARCHAR
- personas:   add columns forked_from_id INTEGER, forked_from_name VARCHAR

PostgreSQL is expected. The script is idempotent.
"""

import os
from sqlalchemy import create_engine, text
from sqlalchemy.exc import ProgrammingError
from dotenv import load_dotenv

# Attempt to load env from possible locations
for candidate in ("../secrets/Mikoshi.env", "../../secrets/Mikoshi.env", ".env"):
    if os.path.exists(candidate):
        load_dotenv(candidate)


def run_migration():
    database_url = os.getenv("DATABASE_URL")
    if not database_url:
        print("ERROR: DATABASE_URL not found in environment variables")
        return

    engine = create_engine(database_url)
    with engine.begin() as conn:
        statements = [
            # Characters - add fork tracking
            "ALTER TABLE characters ADD COLUMN IF NOT EXISTS forked_from_id INTEGER;",
            "ALTER TABLE characters ADD COLUMN IF NOT EXISTS forked_from_name VARCHAR;",
            # Add foreign key constraint if it doesn't exist
            """
            DO $$
            BEGIN
                IF NOT EXISTS (
                    SELECT 1 FROM pg_constraint WHERE conname = 'characters_forked_from_id_fkey'
                ) THEN
                    ALTER TABLE characters 
                    ADD CONSTRAINT characters_forked_from_id_fkey 
                    FOREIGN KEY (forked_from_id) REFERENCES characters(id) ON DELETE SET NULL;
                END IF;
            END $$;
            """,
            
            # Scenes - add fork tracking
            "ALTER TABLE scenes ADD COLUMN IF NOT EXISTS forked_from_id INTEGER;",
            "ALTER TABLE scenes ADD COLUMN IF NOT EXISTS forked_from_name VARCHAR;",
            # Add foreign key constraint if it doesn't exist
            """
            DO $$
            BEGIN
                IF NOT EXISTS (
                    SELECT 1 FROM pg_constraint WHERE conname = 'scenes_forked_from_id_fkey'
                ) THEN
                    ALTER TABLE scenes 
                    ADD CONSTRAINT scenes_forked_from_id_fkey 
                    FOREIGN KEY (forked_from_id) REFERENCES scenes(id) ON DELETE SET NULL;
                END IF;
            END $$;
            """,
            
            # Personas - add fork tracking
            "ALTER TABLE personas ADD COLUMN IF NOT EXISTS forked_from_id INTEGER;",
            "ALTER TABLE personas ADD COLUMN IF NOT EXISTS forked_from_name VARCHAR;",
            # Add foreign key constraint if it doesn't exist
            """
            DO $$
            BEGIN
                IF NOT EXISTS (
                    SELECT 1 FROM pg_constraint WHERE conname = 'personas_forked_from_id_fkey'
                ) THEN
                    ALTER TABLE personas 
                    ADD CONSTRAINT personas_forked_from_id_fkey 
                    FOREIGN KEY (forked_from_id) REFERENCES personas(id) ON DELETE SET NULL;
                END IF;
            END $$;
            """,
        ]
        
        for sql in statements:
            try:
                conn.execute(text(sql))
                print(f"✓ Executed: {sql[:80]}...")
            except ProgrammingError as e:
                print(f"⚠ Skipped (likely already exists): {e}")
        
        print("\n✓ Migration complete: Added forked_from fields to characters, scenes, and personas")


if __name__ == "__main__":
    run_migration()
