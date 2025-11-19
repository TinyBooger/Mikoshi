"""
Migration script to add system_notifications table

Run this script to add the notifications table to your database.
You can also just restart the backend server as it will auto-create tables.
"""

from sqlalchemy import create_engine, Column, String, Integer, DateTime, Text, Boolean, ARRAY
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
import os
from dotenv import load_dotenv

# Load environment variables
if os.path.exists("../secrets/Mikoshi.env"):
    load_dotenv("../secrets/Mikoshi.env")

Base = declarative_base()

class SystemNotification(Base):
    __tablename__ = "system_notifications"
    
    id = Column(Integer, primary_key=True, index=True)
    title = Column(String(200), nullable=False)
    message = Column(Text, nullable=False)
    features = Column(ARRAY(Text), default=[])
    is_active = Column(Boolean, default=False, nullable=False)
    created_by = Column(String, nullable=True)
    created_at = Column(DateTime(timezone=True), nullable=False)
    updated_at = Column(DateTime(timezone=True), nullable=False)

def run_migration():
    # Get database URL from environment
    database_url = os.getenv("DATABASE_URL")
    
    if not database_url:
        print("ERROR: DATABASE_URL not found in environment variables")
        return
    
    print(f"Connecting to database...")
    engine = create_engine(database_url)
    
    print("Creating system_notifications table...")
    Base.metadata.create_all(bind=engine)
    
    print("✓ Migration completed successfully!")
    print("The system_notifications table has been created.")

if __name__ == "__main__":
    run_migration()
