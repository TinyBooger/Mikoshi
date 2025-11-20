"""
Migration script to add target context fields to problem_reports

Run this script to add the following columns to the problem_reports table:
- target_type VARCHAR NULL
- target_id INTEGER NULL
- target_name VARCHAR NULL

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
        # Use IF NOT EXISTS to be safe; for older PG, fallback to information_schema checks
        statements = [
            "ALTER TABLE problem_reports ADD COLUMN IF NOT EXISTS target_type VARCHAR;",
            "ALTER TABLE problem_reports ADD COLUMN IF NOT EXISTS target_id INTEGER;",
            "ALTER TABLE problem_reports ADD COLUMN IF NOT EXISTS target_name VARCHAR;",
        ]
        for sql in statements:
            try:
                conn.execute(text(sql))
                print(f"✓ Executed: {sql}")
            except ProgrammingError as e:
                # As a fallback, ignore if the column already exists
                msg = str(e).lower()
                if "duplicate column" in msg or "already exists" in msg:
                    print(f"- Skipped (exists): {sql}")
                else:
                    raise

    print("✓ Migration completed successfully!")


if __name__ == "__main__":
    run_migration()
