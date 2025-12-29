"""
Migration script to add level and exp columns to the users table.
Run this script to update existing users with the new level and exp fields.
"""

import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy import text
from database import engine, SessionLocal
from models import User


def add_level_exp_columns():
    """Add level and exp columns to users table."""
    
    with engine.connect() as connection:
        # Start a transaction
        trans = connection.begin()
        
        try:
            # Check if columns already exist
            check_query = text("""
                SELECT column_name 
                FROM information_schema.columns 
                WHERE table_name='users' 
                AND column_name IN ('level', 'exp')
            """)
            result = connection.execute(check_query)
            existing_columns = [row[0] for row in result]
            
            # Add level column if it doesn't exist
            if 'level' not in existing_columns:
                print("Adding 'level' column to users table...")
                connection.execute(text("""
                    ALTER TABLE users 
                    ADD COLUMN level INTEGER NOT NULL DEFAULT 1
                """))
                print("✓ 'level' column added successfully")
            else:
                print("'level' column already exists")
            
            # Add exp column if it doesn't exist
            if 'exp' not in existing_columns:
                print("Adding 'exp' column to users table...")
                connection.execute(text("""
                    ALTER TABLE users 
                    ADD COLUMN exp INTEGER NOT NULL DEFAULT 0
                """))
                print("✓ 'exp' column added successfully")
            else:
                print("'exp' column already exists")
            
            # Commit the transaction
            trans.commit()
            print("\n✓ Migration completed successfully!")
            print("All existing users now have level=1 and exp=0")
            
        except Exception as e:
            # Rollback on error
            trans.rollback()
            print(f"\n✗ Error during migration: {e}")
            raise


def verify_migration():
    """Verify the migration was successful."""
    
    db = SessionLocal()
    try:
        # Get a count of users
        user_count = db.query(User).count()
        print(f"\nVerification: Found {user_count} users in the database")
        
        if user_count > 0:
            # Get a sample user to verify columns
            sample_user = db.query(User).first()
            print(f"Sample user - Level: {sample_user.level}, EXP: {sample_user.exp}")
            
    except Exception as e:
        print(f"Error during verification: {e}")
    finally:
        db.close()


if __name__ == "__main__":
    print("=" * 50)
    print("Level & EXP System Migration")
    print("=" * 50)
    print()
    
    try:
        add_level_exp_columns()
        verify_migration()
    except Exception as e:
        print(f"\nMigration failed: {e}")
        sys.exit(1)
    
    print("\n" + "=" * 50)
