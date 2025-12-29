"""
Migration script to add daily EXP limit tracking fields to the users table.
This enables daily caps and action limits for the EXP system.
"""

import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy import text
from database import engine, SessionLocal
from models import User


def add_daily_exp_limit_fields():
    """Add daily EXP tracking fields to users table."""
    
    with engine.connect() as connection:
        # Start a transaction
        trans = connection.begin()
        
        try:
            # Check if columns already exist
            check_query = text("""
                SELECT column_name 
                FROM information_schema.columns 
                WHERE table_name='users' 
                AND column_name IN ('daily_exp_gained', 'last_exp_reset_date', 'daily_action_counts')
            """)
            result = connection.execute(check_query)
            existing_columns = [row[0] for row in result]
            
            # Add daily_exp_gained column if it doesn't exist
            if 'daily_exp_gained' not in existing_columns:
                print("Adding 'daily_exp_gained' column to users table...")
                connection.execute(text("""
                    ALTER TABLE users 
                    ADD COLUMN daily_exp_gained INTEGER NOT NULL DEFAULT 0
                """))
                print("✓ 'daily_exp_gained' column added successfully")
            else:
                print("'daily_exp_gained' column already exists")
            
            # Add last_exp_reset_date column if it doesn't exist
            if 'last_exp_reset_date' not in existing_columns:
                print("Adding 'last_exp_reset_date' column to users table...")
                connection.execute(text("""
                    ALTER TABLE users 
                    ADD COLUMN last_exp_reset_date TIMESTAMP WITH TIME ZONE
                """))
                print("✓ 'last_exp_reset_date' column added successfully")
            else:
                print("'last_exp_reset_date' column already exists")
            
            # Add daily_action_counts column if it doesn't exist
            if 'daily_action_counts' not in existing_columns:
                print("Adding 'daily_action_counts' column to users table...")
                connection.execute(text("""
                    ALTER TABLE users 
                    ADD COLUMN daily_action_counts JSONB NOT NULL DEFAULT '{}'::jsonb
                """))
                print("✓ 'daily_action_counts' column added successfully")
            else:
                print("'daily_action_counts' column already exists")
            
            # Commit the transaction
            trans.commit()
            print("\n✓ Migration completed successfully!")
            print("Daily EXP caps and action limits are now enabled")
            print("\nDaily limits:")
            print("  - L1-L2: 150 EXP/day")
            print("  - L3-L4: 300 EXP/day")
            print("  - L5-L6: 500 EXP/day")
            print("\nAction limits:")
            print("  - Daily chat: 1/day")
            print("  - Create character: 2/day")
            print("  - Create scene/persona: 2/day each")
            print("  - Character liked: 20/day")
            
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
            print(f"Sample user - Daily EXP: {sample_user.daily_exp_gained}, Action counts: {sample_user.daily_action_counts}")
            
    except Exception as e:
        print(f"Error during verification: {e}")
    finally:
        db.close()


if __name__ == "__main__":
    print("=" * 60)
    print("Daily EXP Limits & Action Caps Migration")
    print("=" * 60)
    print()
    
    try:
        add_daily_exp_limit_fields()
        verify_migration()
    except Exception as e:
        print(f"\nMigration failed: {e}")
        sys.exit(1)
    
    print("\n" + "=" * 60)
