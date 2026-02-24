from sqlalchemy import Column, String, Integer, DateTime, Text, ForeignKey, UniqueConstraint, Boolean, Numeric
from sqlalchemy.orm import relationship
from database import Base
from sqlalchemy.dialects.postgresql import ARRAY, JSONB
from datetime import datetime, UTC

class Character(Base):
    __tablename__ = "characters"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, unique=True, index=True, nullable=False)
    persona = Column(Text, nullable=False)
    example_messages = Column(Text, default="")
    tagline = Column(String(255), default="")  # 50 words fits ~255 chars
    tags = Column(ARRAY(Text), default=[])   # array of strings
    is_public = Column(Boolean, default=True, nullable=False)
    is_forkable = Column(Boolean, default=False, nullable=False)
    is_free = Column(Boolean, default=True, nullable=False)
    price = Column(Numeric(10, 2), default=0, nullable=False)  # Price in CNY

    views = Column(Integer, default=0)
    likes = Column(Integer, default=0)
    picture = Column(String, nullable=True)  # path or URL to the picture
    greeting = Column(String, nullable=True)

    created_time = Column(DateTime(timezone=True), default=lambda: datetime.now(UTC))
    creator_id = Column(String, ForeignKey('users.id', ondelete='SET NULL'), nullable=True)
    creator_name = Column(String, nullable=True)
    
    # Fork tracking - give credit to original creator
    forked_from_id = Column(Integer, ForeignKey('characters.id', ondelete='SET NULL'), nullable=True)
    forked_from_name = Column(String, nullable=True)

class User(Base):
    __tablename__ = "users"

    id = Column(String, primary_key=True, index=True)
    email = Column(String, unique=True, nullable=True)
    phone_number = Column(String(20), unique=True, nullable=True, index=True)
    name = Column(String)
    profile_pic = Column(String, nullable=True)
    bio = Column(Text, nullable=True)  # Short bio, optional
    hashed_password = Column(String, nullable=False)  # Store password hash
    is_admin = Column(Boolean, default=False, nullable=False)  # Admin role flag
    
    # Pro user (paid subscription)
    is_pro = Column(Boolean, default=False, nullable=False)  # Pro user status
    pro_start_date = Column(DateTime(timezone=True), nullable=True)  # When Pro subscription started
    pro_expire_date = Column(DateTime(timezone=True), nullable=True)  # When Pro subscription expires

    views = Column(Integer, default=0)
    likes = Column(Integer, default=0)
    
    # Level and EXP system
    level = Column(Integer, default=1, nullable=False)  # User level (1-6)
    exp = Column(Integer, default=0, nullable=False)  # Current experience points
    last_chat_date = Column(DateTime(timezone=True), nullable=True)  # Track daily chat activity for EXP
    
    # Daily EXP limits and tracking
    daily_exp_gained = Column(Integer, default=0, nullable=False)  # EXP gained today
    last_exp_reset_date = Column(DateTime(timezone=True), nullable=True)  # Last daily reset
    daily_action_counts = Column(JSONB, default={}, nullable=False)  # Track daily action counts

    # liked_characters, liked_scenes, liked_personas removed; now handled by junction tables
    liked_tags = Column(ARRAY(Text), default=[])
    
    # Badge system
    badges = Column(JSONB, default={}, nullable=False)  # Badge data: {badge_name: {awarded_at: timestamp, frame: frame_id}}
    active_badge = Column(String, nullable=True)  # Currently displayed badge key (e.g., "bronze_creator", "gold_creator")
    
    default_persona_id = Column(Integer, ForeignKey('personas.id', ondelete='SET NULL'), nullable=True)

    chat_histories = relationship("ChatHistory", back_populates="user", cascade="all, delete-orphan")


class ChatHistory(Base):
    __tablename__ = "chat_histories"

    id = Column(Integer, primary_key=True, index=True)
    chat_id = Column(String, unique=True, nullable=False, index=True)
    user_id = Column(String, ForeignKey('users.id', ondelete='CASCADE'), nullable=False, index=True)
    character_id = Column(Integer, ForeignKey('characters.id', ondelete='SET NULL'), nullable=True)
    scene_id = Column(Integer, ForeignKey('scenes.id', ondelete='SET NULL'), nullable=True)
    persona_id = Column(Integer, ForeignKey('personas.id', ondelete='SET NULL'), nullable=True)

    character_name = Column(String, nullable=True)
    character_picture = Column(String, nullable=True)
    scene_name = Column(String, nullable=True)
    scene_picture = Column(String, nullable=True)
    title = Column(String(255), nullable=False)
    messages = Column(JSONB, default=[])
    last_updated = Column(DateTime(timezone=True), default=lambda: datetime.now(UTC))
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(UTC))

    user = relationship("User", back_populates="chat_histories")


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
    created_time = Column(DateTime(timezone=True), default=lambda: datetime.now(UTC))
    likes = Column(Integer, default=0)
    views = Column(Integer, default=0)
    is_public = Column(Boolean, default=True, nullable=False)
    is_forkable = Column(Boolean, default=False, nullable=False)
    
    # Fork tracking - give credit to original creator
    forked_from_id = Column(Integer, ForeignKey('personas.id', ondelete='SET NULL'), nullable=True)
    forked_from_name = Column(String, nullable=True)


class SearchTerm(Base):
    __tablename__ = "search_term"
    
    keyword = Column(String, primary_key=True, unique=True, nullable=False)
    search_count = Column(Integer, default=1)
    last_searched = Column(DateTime(timezone=True), default=datetime.now(UTC))

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
    created_time = Column(DateTime(timezone=True), default=lambda: datetime.now(UTC))
    likes = Column(Integer, default=0)
    views = Column(Integer, default=0)
    is_public = Column(Boolean, default=True, nullable=False)
    is_forkable = Column(Boolean, default=False, nullable=False)
    
    # Fork tracking - give credit to original creator
    forked_from_id = Column(Integer, ForeignKey('scenes.id', ondelete='SET NULL'), nullable=True)
    forked_from_name = Column(String, nullable=True)

# Junction table for character likes
class UserLikedCharacter(Base):
    __tablename__ = "user_liked_characters"
    user_id = Column(String, ForeignKey('users.id', ondelete='CASCADE'), primary_key=True)
    character_id = Column(Integer, ForeignKey('characters.id', ondelete='CASCADE'), primary_key=True)
    liked_at = Column(DateTime(timezone=True), default=lambda: datetime.now(UTC))
    __table_args__ = (
        UniqueConstraint('user_id', 'character_id', name='uix_user_character'),
    )

# Junction table for scene likes
class UserLikedScene(Base):
    __tablename__ = "user_liked_scenes"
    user_id = Column(String, ForeignKey('users.id', ondelete='CASCADE'), primary_key=True)
    scene_id = Column(Integer, ForeignKey('scenes.id', ondelete='CASCADE'), primary_key=True)
    liked_at = Column(DateTime(timezone=True), default=lambda: datetime.now(UTC))
    __table_args__ = (
        UniqueConstraint('user_id', 'scene_id', name='uix_user_scene'),
    )

# Junction table for persona likes
class UserLikedPersona(Base):
    __tablename__ = "user_liked_personas"
    user_id = Column(String, ForeignKey('users.id', ondelete='CASCADE'), primary_key=True)
    persona_id = Column(Integer, ForeignKey('personas.id', ondelete='CASCADE'), primary_key=True)
    liked_at = Column(DateTime(timezone=True), default=lambda: datetime.now(UTC))
    __table_args__ = (
        UniqueConstraint('user_id', 'persona_id', name='uix_user_persona'),
    )

# Invitation codes for alpha testing
class InvitationCode(Base):
    __tablename__ = "invitation_codes"
    
    code = Column(String(20), primary_key=True, unique=True, nullable=False)
    created_by = Column(String, ForeignKey('users.id', ondelete='SET NULL'), nullable=True)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(UTC))
    expires_at = Column(DateTime(timezone=True), nullable=True)
    
    used_by = Column(String, ForeignKey('users.id', ondelete='SET NULL'), nullable=True)
    used_at = Column(DateTime(timezone=True), nullable=True)
    is_active = Column(Boolean, default=True, nullable=False)
    max_uses = Column(Integer, default=1)  # How many times this code can be used
    use_count = Column(Integer, default=0)  # How many times it has been used
    notes = Column(Text, nullable=True)  # Admin notes about this code

# Problem Reports
class ProblemReport(Base):
    __tablename__ = "problem_reports"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(String, ForeignKey('users.id', ondelete='SET NULL'), nullable=True)
    user_email = Column(String, nullable=True)  # Store email in case user is deleted
    description = Column(Text, nullable=False)
    screenshot = Column(String, nullable=True)  # URL or path to screenshot
    # Target context of the report (optional)
    target_type = Column(String, nullable=True)  # 'character' | 'scene' | 'persona'
    target_id = Column(Integer, nullable=True)
    target_name = Column(String, nullable=True)
    status = Column(String, default="pending", nullable=False)  # pending, in-progress, resolved, closed
    created_time = Column(DateTime(timezone=True), default=lambda: datetime.now(UTC))
    resolved_time = Column(DateTime(timezone=True), nullable=True)
    admin_notes = Column(Text, nullable=True)

# System Notification (for alpha updates and announcements)
class SystemNotification(Base):
    __tablename__ = "system_notifications"
    
    id = Column(Integer, primary_key=True, index=True)
    title = Column(String(200), nullable=False)
    message = Column(Text, nullable=False)
    features = Column(ARRAY(Text), default=[])  # List of feature bullet points
    is_active = Column(Boolean, default=False, nullable=False)
    created_by = Column(String, ForeignKey('users.id', ondelete='SET NULL'), nullable=True)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(UTC))
    updated_at = Column(DateTime(timezone=True), default=lambda: datetime.now(UTC), onupdate=lambda: datetime.now(UTC))

# Error Log (for tracking application errors)
class ErrorLogModel(Base):
    __tablename__ = "error_logs"
    
    id = Column(Integer, primary_key=True, index=True)
    timestamp = Column(DateTime(timezone=True), default=lambda: datetime.now(UTC), index=True)
    message = Column(Text, nullable=False)
    error_type = Column(String(100), nullable=False, index=True)  # ValueError, HTTPException, etc.
    severity = Column(String(20), default="error", nullable=False, index=True)  # info, warning, error, critical
    source = Column(String(20), default="backend", nullable=False, index=True)  # backend or frontend
    user_id = Column(String, ForeignKey('users.id', ondelete='SET NULL'), nullable=True, index=True)
    endpoint = Column(String(255), nullable=True, index=True)  # API endpoint or page URL
    method = Column(String(10), nullable=True)  # HTTP method (GET, POST, etc.)
    status_code = Column(Integer, nullable=True, index=True)  # HTTP status code
    client_ip = Column(String(45), nullable=True, index=True)  # IPv4 or IPv6
    user_agent = Column(Text, nullable=True)  # Browser/client user agent
    request_body = Column(Text, nullable=True)  # JSON request payload
    stack_trace = Column(Text, nullable=True)  # Full error stack trace
    context = Column(Text, nullable=True)  # Additional JSON context
    resolved = Column(Boolean, default=False, nullable=False, index=True)
    resolved_at = Column(DateTime(timezone=True), nullable=True)
    resolved_by = Column(String, ForeignKey('users.id', ondelete='SET NULL'), nullable=True)


class CharacterPurchase(Base):
    __tablename__ = "character_purchases"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(String, ForeignKey('users.id', ondelete='CASCADE'), nullable=False, index=True)
    character_id = Column(Integer, ForeignKey('characters.id', ondelete='CASCADE'), nullable=False, index=True)
    price_paid = Column(Numeric(10, 2), nullable=False, default=0)
    out_trade_no = Column(String(128), nullable=True, index=True)
    trade_no = Column(String(128), nullable=True, index=True)
    purchased_at = Column(DateTime(timezone=True), default=lambda: datetime.now(UTC), nullable=False)

    __table_args__ = (
        UniqueConstraint('user_id', 'character_id', name='uix_user_character_purchase'),
    )


class PaymentOrder(Base):
    __tablename__ = "payment_orders"

    out_trade_no = Column(String(128), primary_key=True)
    user_id = Column(String, ForeignKey('users.id', ondelete='SET NULL'), nullable=True, index=True)
    order_type = Column(String(50), nullable=False, default="unknown")
    trade_no = Column(String(128), nullable=True, index=True)
    total_amount = Column(String(32), nullable=True)
    target_type = Column(String(50), nullable=True)
    target_id = Column(Integer, nullable=True, index=True)
    source = Column(String(32), nullable=True)
    status = Column(String(20), nullable=False, default="processing", index=True)
    error_message = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(UTC), nullable=False)
    updated_at = Column(DateTime(timezone=True), default=lambda: datetime.now(UTC), onupdate=lambda: datetime.now(UTC), nullable=False)