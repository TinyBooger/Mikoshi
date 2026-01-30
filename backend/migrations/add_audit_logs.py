"""
Migration script to add audit_logs table
Run this script to create the audit logging table in the database
"""
from sqlalchemy import create_engine, text
import os
import sys

# Add parent directory to path to import database
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from database import DATABASE_URL

def run_migration():
    engine = create_engine(DATABASE_URL)
    
    create_table_sql = """
    CREATE TABLE IF NOT EXISTS audit_logs (
        id SERIAL PRIMARY KEY,
        user_id VARCHAR,
        action VARCHAR(255) NOT NULL,
        timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
        ip_address VARCHAR(45),
        user_agent TEXT,
        metadata JSONB,
        status VARCHAR(20) DEFAULT 'success',
        error_message TEXT
    );
    
    -- Create indexes for better query performance
    CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit_logs(user_id);
    CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action);
    CREATE INDEX IF NOT EXISTS idx_audit_logs_timestamp ON audit_logs(timestamp);
    """
    
    try:
        with engine.connect() as conn:
            conn.execute(text(create_table_sql))
            conn.commit()
            print("✓ Successfully created audit_logs table and indexes")
    except Exception as e:
        print(f"✗ Error creating audit_logs table: {e}")
        raise

if __name__ == "__main__":
    print("Running audit_logs migration...")
    run_migration()
    print("Migration complete!")
