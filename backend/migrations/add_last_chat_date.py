"""
Migration script to add last_chat_date column to the users table.
This column tracks when a user last chatted for daily EXP awards.
"""

import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy import text
from database import engine

def add_last_chat_date_column():
    """Add last_chat_date column to users table."""
    
    with engine.connect() as connection:
        # Start a transaction
        trans = connection.begin()
        
        try:
            # Check if column already exists
            check_query = text("""
                SELECT column_name 
                FROM information_schema.columns 
                WHERE table_name='users' 
                AND column_name='last_chat_date'
            """)
            result = connection.execute(check_query)
            existing_columns = [row[0] for row in result]
            
            # Add last_chat_date column if it doesn't exist
            if 'last_chat_date' not in existing_columns:
                print("Adding 'last_chat_date' column to users table...")
                connection.execute(text("""
                    ALTER TABLE users 
                    ADD COLUMN last_chat_date TIMESTAMP WITH TIME ZONE
                """))
                print("✓ 'last_chat_date' column added successfully")
            else:
                print("'last_chat_date' column already exists")
            
            # Commit the transaction
            trans.commit()
            print("\n✓ Migration completed successfully!")
            print("Users can now earn daily chat EXP rewards")
            
        except Exception as e:
            # Rollback on error
            trans.rollback()
            print(f"\n✗ Error during migration: {e}")
            raise


if __name__ == "__main__":
    print("=" * 50)
    print("Daily Chat Date Tracking Migration")
    print("=" * 50)
    print()
    
    try:
        add_last_chat_date_column()
    except Exception as e:
        print(f"\nMigration failed: {e}")
        sys.exit(1)
    
    print("\n" + "=" * 50)
