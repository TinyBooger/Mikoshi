"""
Migration script to add Pro user fields to the users table.
Run this script to add is_pro, pro_start_date, and pro_expire_date columns.
"""

import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy import text
from database import engine, SessionLocal
from models import User


def add_pro_user_columns():
    """Add Pro user columns to users table."""
    
    with engine.connect() as connection:
        # Start a transaction
        trans = connection.begin()
        
        try:
            # Check if columns already exist
            check_query = text("""
                SELECT column_name 
                FROM information_schema.columns 
                WHERE table_name='users' 
                AND column_name IN ('is_pro', 'pro_start_date', 'pro_expire_date')
            """)
            result = connection.execute(check_query)
            existing_columns = [row[0] for row in result]
            
            # Add is_pro column if it doesn't exist
            if 'is_pro' not in existing_columns:
                print("Adding 'is_pro' column to users table...")
                connection.execute(text("""
                    ALTER TABLE users 
                    ADD COLUMN is_pro BOOLEAN NOT NULL DEFAULT FALSE
                """))
                print("✓ 'is_pro' column added successfully")
            else:
                print("'is_pro' column already exists")
            
            # Add pro_start_date column if it doesn't exist
            if 'pro_start_date' not in existing_columns:
                print("Adding 'pro_start_date' column to users table...")
                connection.execute(text("""
                    ALTER TABLE users 
                    ADD COLUMN pro_start_date TIMESTAMP WITH TIME ZONE
                """))
                print("✓ 'pro_start_date' column added successfully")
            else:
                print("'pro_start_date' column already exists")
            
            # Add pro_expire_date column if it doesn't exist
            if 'pro_expire_date' not in existing_columns:
                print("Adding 'pro_expire_date' column to users table...")
                connection.execute(text("""
                    ALTER TABLE users 
                    ADD COLUMN pro_expire_date TIMESTAMP WITH TIME ZONE
                """))
                print("✓ 'pro_expire_date' column added successfully")
            else:
                print("'pro_expire_date' column already exists")
            
            # Commit the transaction
            trans.commit()
            print("\n✅ Pro user migration completed successfully!")
            
        except Exception as e:
            # Rollback on error
            trans.rollback()
            print(f"\n❌ Error during migration: {e}")
            raise


def verify_migration():
    """Verify the migration was successful."""
    
    with engine.connect() as connection:
        # Check if all columns exist
        check_query = text("""
            SELECT column_name, data_type, is_nullable, column_default
            FROM information_schema.columns 
            WHERE table_name='users' 
            AND column_name IN ('is_pro', 'pro_start_date', 'pro_expire_date')
            ORDER BY column_name
        """)
        result = connection.execute(check_query)
        
        print("\n📊 Pro User Column Details:")
        print("-" * 80)
        for row in result:
            col_name, data_type, is_nullable, col_default = row
            print(f"Column: {col_name}")
            print(f"  Type: {data_type}")
            print(f"  Nullable: {is_nullable}")
            print(f"  Default: {col_default}")
            print()


if __name__ == "__main__":
    print("🚀 Starting Pro user fields migration...")
    print("=" * 80)
    
    try:
        add_pro_user_columns()
        verify_migration()
        
        print("\n" + "=" * 80)
        print("✅ Migration script completed successfully!")
        print("\nNext steps:")
        print("  1. Test Pro user functionality")
        print("  2. Implement Pro user upgrade/downgrade logic")
        print("  3. Add payment integration for Pro subscriptions")
        
    except Exception as e:
        print("\n" + "=" * 80)
        print(f"❌ Migration failed: {e}")
        sys.exit(1)
