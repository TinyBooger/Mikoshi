from sqlalchemy import Column, String, Integer, DateTime, Text, ForeignKey, UniqueConstraint
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.dialects.postgresql import ARRAY, JSONB
from datetime import datetime, UTC

Base = declarative_base()

class Character(Base):
    __tablename__ = "characters"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, unique=True, index=True, nullable=False)
    persona = Column(Text, nullable=False)
    example_messages = Column(Text, default="")
    tagline = Column(String(255), default="")  # 50 words fits ~255 chars
    tags = Column(ARRAY(Text), default=[])   # array of strings

    views = Column(Integer, default=0)
    likes = Column(Integer, default=0)
    picture = Column(String, nullable=True)  # path or URL to the picture
    greeting = Column(String, nullable=True)

    created_time = Column(DateTime, default=lambda: datetime.now(UTC))
    creator_id = Column(String, ForeignKey('users.id', ondelete='SET NULL'), nullable=True)
    creator_name = Column(String, nullable=True)

class User(Base):
    __tablename__ = "users"

    id = Column(String, primary_key=True, index=True)
    email = Column(String, unique=True, nullable=False)
    name = Column(String)
    profile_pic = Column(String, nullable=True)
    bio = Column(Text, nullable=True)  # Short bio, optional

    views = Column(Integer, default=0)
    likes = Column(Integer, default=0)
    recent_characters = Column(ARRAY(JSONB), default=[])

    # liked_characters, liked_scenes, liked_personas removed; now handled by junction tables
    liked_tags = Column(ARRAY(Text), default=[])

    chat_history = Column(ARRAY(JSONB), default=[])

class Persona(Base):
    __tablename__ = "personas"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, unique=True, index=True, nullable=False)
    description = Column(Text, nullable=True)
    intro = Column(Text, nullable=True)  # Short intro for display
    tags = Column(ARRAY(Text), default=[])  # array of strings
    picture = Column(String, nullable=True)  # path or URL to the picture
    creator_id = Column(String, ForeignKey('users.id', ondelete='SET NULL'), nullable=True)
    creator_name = Column(String, nullable=True)
    created_time = Column(DateTime, default=lambda: datetime.now(UTC))
    likes = Column(Integer, default=0)
    views = Column(Integer, default=0)


class SearchTerm(Base):
    __tablename__ = "search_term"
    
    keyword = Column(String, primary_key=True, unique=True, nullable=False)
    search_count = Column(Integer, default=1)
    last_searched = Column(DateTime, default=datetime.now(UTC))

class Tag(Base):
    __tablename__ = "tags"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(Text, unique=True, nullable=False)
    count = Column(Integer, default=0)
    likes = Column(Integer, default=0)   

class Scene(Base):
    __tablename__ = "scenes"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    description = Column(Text, nullable=False)
    intro = Column(Text, nullable=True)  # Short intro for display
    tags = Column(ARRAY(Text), default=[])  # array of strings
    picture = Column(String, nullable=True)  # path or URL to the picture
    creator_id = Column(String, ForeignKey('users.id', ondelete='SET NULL'), nullable=True)
    creator_name = Column(String, nullable=True)
    created_time = Column(DateTime, default=lambda: datetime.now(UTC))
    likes = Column(Integer, default=0)
    views = Column(Integer, default=0)

# Junction table for character likes
class UserLikedCharacter(Base):
    __tablename__ = "user_liked_characters"
    user_id = Column(String, ForeignKey('users.id', ondelete='CASCADE'), primary_key=True)
    character_id = Column(Integer, ForeignKey('characters.id', ondelete='CASCADE'), primary_key=True)
    liked_at = Column(DateTime, default=lambda: datetime.now(UTC))
    __table_args__ = (
        UniqueConstraint('user_id', 'character_id', name='uix_user_character'),
    )

# Junction table for scene likes
class UserLikedScene(Base):
    __tablename__ = "user_liked_scenes"
    user_id = Column(String, ForeignKey('users.id', ondelete='CASCADE'), primary_key=True)
    scene_id = Column(Integer, ForeignKey('scenes.id', ondelete='CASCADE'), primary_key=True)
    liked_at = Column(DateTime, default=lambda: datetime.now(UTC))
    __table_args__ = (
        UniqueConstraint('user_id', 'scene_id', name='uix_user_scene'),
    )

# Junction table for persona likes
class UserLikedPersona(Base):
    __tablename__ = "user_liked_personas"
    user_id = Column(String, ForeignKey('users.id', ondelete='CASCADE'), primary_key=True)
    persona_id = Column(Integer, ForeignKey('personas.id', ondelete='CASCADE'), primary_key=True)
    liked_at = Column(DateTime, default=lambda: datetime.now(UTC))
    __table_args__ = (
        UniqueConstraint('user_id', 'persona_id', name='uix_user_persona'),
    )