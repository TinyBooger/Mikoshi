"""
Migration script to add visibility (is_public), forkable (is_forkable) flags
and pricing flag (is_free for characters) to existing tables.

- characters: add columns is_public BOOLEAN NOT NULL DEFAULT FALSE,
              is_forkable BOOLEAN NOT NULL DEFAULT FALSE,
              is_free BOOLEAN NOT NULL DEFAULT TRUE
- scenes:     add columns is_public BOOLEAN NOT NULL DEFAULT FALSE,
              is_forkable BOOLEAN NOT NULL DEFAULT FALSE
- personas:   add columns is_public BOOLEAN NOT NULL DEFAULT FALSE,
              is_forkable BOOLEAN NOT NULL DEFAULT FALSE

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
            # Characters
            "ALTER TABLE characters ADD COLUMN IF NOT EXISTS is_public BOOLEAN NOT NULL DEFAULT FALSE;",
            "ALTER TABLE characters ADD COLUMN IF NOT EXISTS is_forkable BOOLEAN NOT NULL DEFAULT FALSE;",
            "ALTER TABLE characters ADD COLUMN IF NOT EXISTS is_free BOOLEAN NOT NULL DEFAULT TRUE;",
            "ALTER TABLE characters ADD COLUMN IF NOT EXISTS price NUMERIC(10, 2) NOT NULL DEFAULT 0;",
            # Scenes
            "ALTER TABLE scenes ADD COLUMN IF NOT EXISTS is_public BOOLEAN NOT NULL DEFAULT FALSE;",
            "ALTER TABLE scenes ADD COLUMN IF NOT EXISTS is_forkable BOOLEAN NOT NULL DEFAULT FALSE;",
            # Personas
            "ALTER TABLE personas ADD COLUMN IF NOT EXISTS is_public BOOLEAN NOT NULL DEFAULT FALSE;",
            "ALTER TABLE personas ADD COLUMN IF NOT EXISTS is_forkable BOOLEAN NOT NULL DEFAULT FALSE;",
        ]
        for sql in statements:
            try:
                conn.execute(text(sql))
                print(f"\u2713 Executed: {sql.strip()}")
            except ProgrammingError as e:
                msg = str(e).lower()
                if "duplicate column" in msg or "already exists" in msg:
                    print(f"- Skipped (exists): {sql.strip()}")
                else:
                    raise

    print("\u2713 Migration completed successfully!")


if __name__ == "__main__":
    run_migration()
