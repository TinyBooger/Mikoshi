"""
Migration script to add default_persona_id column to users table

Run this script to add the following column to the users table:
- default_persona_id INTEGER NULL (Foreign Key to personas.id)

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
        # Add the default_persona_id column with foreign key constraint
        statements = [
            "ALTER TABLE users ADD COLUMN IF NOT EXISTS default_persona_id INTEGER;",
            """ALTER TABLE users 
               ADD CONSTRAINT IF NOT EXISTS fk_default_persona_id 
               FOREIGN KEY (default_persona_id) 
               REFERENCES personas(id) ON DELETE SET NULL;""",
        ]
        for sql in statements:
            try:
                conn.execute(text(sql))
                print(f"✓ Executed: {sql.strip()}")
            except ProgrammingError as e:
                # As a fallback, ignore if the column already exists or constraint exists
                msg = str(e).lower()
                if "duplicate column" in msg or "already exists" in msg or "constraint" in msg:
                    print(f"- Skipped (exists): {sql.strip()}")
                else:
                    raise

    print("✓ Migration completed successfully!")


if __name__ == "__main__":
    run_migration()
