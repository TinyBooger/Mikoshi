"""
Migration script to remove recent_characters column from users table

This column is no longer needed as we now derive recent characters from chat_history.
Run this script to drop the column from the database.
"""

from sqlalchemy import create_engine, text
import os
from dotenv import load_dotenv

# Load environment variables
if os.path.exists("../secrets/Mikoshi.env"):
    load_dotenv("../secrets/Mikoshi.env")

def run_migration():
    # Get database URL from environment
    database_url = os.getenv("DATABASE_URL")
    
    if not database_url:
        print("ERROR: DATABASE_URL not found in environment variables")
        return
    
    print(f"Connecting to database...")
    engine = create_engine(database_url)
    
    with engine.connect() as conn:
        print("Dropping recent_characters column from users table...")
        try:
            conn.execute(text("ALTER TABLE users DROP COLUMN IF EXISTS recent_characters;"))
            conn.commit()
            print("✓ Migration completed successfully!")
            print("The recent_characters column has been removed from the users table.")
        except Exception as e:
            print(f"ERROR: Failed to drop column: {e}")
            conn.rollback()

if __name__ == "__main__":
    run_migration()
