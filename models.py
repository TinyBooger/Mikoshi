from sqlalchemy import Column, String, Integer, JSON, DateTime
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.dialects.postgresql import ARRAY, JSONB
from datetime import datetime

Base = declarative_base()

class Character(Base):
    __tablename__ = "characters"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, unique=True, index=True, nullable=False)
    persona = Column(String, nullable=False)
    example_messages = Column(JSON, default=[])

    views = Column(Integer, default=0)
    likes = Column(Integer, default=0)
    picture = Column(String, nullable=True)  # path or URL to the picture

    created_time = Column(DateTime, default=datetime.utcnow)
    creator_id = Column(String, nullable=False)  # store creator email or id

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, nullable=False)
    phone = Column(String, unique=False)
    hashed_password = Column(String, nullable=False)
    name = Column(String)  # Add this
    profile_pic = Column(String, nullable=True)  # Also add for storing file path if needed

    views = Column(Integer, default=0)
    likes = Column(Integer, default=0)
    characters_created = Column(ARRAY(Integer), default=[])
    recent_characters = Column(ARRAY(JSONB), default=[])