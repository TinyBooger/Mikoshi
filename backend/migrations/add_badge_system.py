"""
Migration: Add badges field and active_badge field to users table
Adds JSONB column to store user badges with their awarded timestamps and frames,
and a String column to track which badge is actively displayed.
"""

def upgrade():
    """Add badges and active_badge columns to users table"""
    from sqlalchemy import text
    from database import engine
    
    with engine.begin() as connection:
        # Add badges column as JSONB with default empty object
        connection.execute(text("""
            ALTER TABLE users
            ADD COLUMN IF NOT EXISTS badges JSONB DEFAULT '{}'::jsonb NOT NULL;
        """))
        
        # Add active_badge column as String (nullable - can be null if no badge displayed)
        connection.execute(text("""
            ALTER TABLE users
            ADD COLUMN IF NOT EXISTS active_badge VARCHAR(100) DEFAULT NULL;
        """))
    
    print("✓ Added badges and active_badge columns to users table")


def downgrade():
    """Remove badges and active_badge columns from users table"""
    from sqlalchemy import text
    from database import engine
    
    with engine.begin() as connection:
        connection.execute(text("""
            ALTER TABLE users
            DROP COLUMN IF EXISTS badges;
        """))
        
        connection.execute(text("""
            ALTER TABLE users
            DROP COLUMN IF EXISTS active_badge;
        """))
    
    print("✓ Removed badges and active_badge columns from users table")
