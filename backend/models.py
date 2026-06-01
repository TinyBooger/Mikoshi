from sqlalchemy import Column, String, Integer, DateTime, Date, Text, ForeignKey, ForeignKeyConstraint, UniqueConstraint, Boolean, Float, BigInteger
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
    long_description = Column(Text, default="", nullable=True)
    long_description_chunks = Column(JSONB, default=list, nullable=False)
    context_label = Column(String(20), nullable=False, default="standard")
    tagline = Column(String(255), default="")  # 50 words fits ~255 chars
    tags = Column(ARRAY(Text), default=[])   # array of strings
    is_public = Column(Boolean, default=True, nullable=False)
    is_forkable = Column(Boolean, default=False, nullable=False)

    views = Column(Integer, default=0)
    likes = Column(Integer, default=0)
    picture = Column(String, nullable=True)  # path or URL to the picture
    avatar_picture = Column(String, nullable=True)  # separate head/avatar image
    greeting = Column(String, nullable=True)
    model = Column(String, nullable=False, default="deepseek-chat")
    temperature = Column(Float, nullable=False, default=1.3)
    top_p = Column(Float, nullable=False, default=0.9)
    max_tokens = Column(Integer, nullable=False, default=250)
    presence_penalty = Column(Float, nullable=False, default=0)
    frequency_penalty = Column(Float, nullable=False, default=0)

    created_time = Column(DateTime(timezone=True), default=lambda: datetime.now(UTC))
    creator_id = Column(String, ForeignKey('users.id', ondelete='SET NULL'), nullable=True)
    creator_name = Column(String, nullable=True)
    
    # Fork tracking - give credit to original creator
    forked_from_id = Column(Integer, ForeignKey('characters.id', ondelete='SET NULL'), nullable=True)
    forked_from_name = Column(String, nullable=True)

    # Content moderation status: null = normal | 'restricted' | 'takedown'
    moderation_status = Column(String(20), nullable=True)
    appeal_under_review = Column(Boolean, default=False, nullable=False)

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
    
    # Purchased token wallet
    purchased_token_balance = Column(Integer, default=0, nullable=False)
    purchased_tokens_bought_total = Column(Integer, default=0, nullable=False)
    purchased_tokens_consumed_total = Column(Integer, default=0, nullable=False)

    # liked_characters, liked_scenes, liked_personas removed; now handled by junction tables
    liked_tags = Column(ARRAY(Text), default=[])
    
    default_persona_id = Column(Integer, ForeignKey('personas.id', ondelete='SET NULL'), nullable=True)

    # IP / device tracking (last 5 unique values, most-recent first)
    last_known_ips = Column(ARRAY(Text), nullable=False, default=list)
    device_fingerprints = Column(ARRAY(Text), nullable=False, default=list)

    # Moderation / ban fields
    # ban_type: null = no ban | 'upload_ban' | 'full_ban' | 'shadow_ban'
    ban_type = Column(String(20), nullable=True)
    ban_until = Column(DateTime(timezone=True), nullable=True)
    ban_reason = Column(String(50), nullable=True)  # categorical tag: harassment/spam/abuse/underage/other
    ban_note = Column(Text, nullable=True)  # moderator-visible free text

    chat_histories = relationship("ChatHistory", back_populates="user", cascade="all, delete-orphan")


class UserTokenUsageLedger(Base):
    __tablename__ = "user_token_usage_ledger"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(String, ForeignKey('users.id', ondelete='CASCADE'), nullable=False, index=True)
    usage_date = Column(Date, nullable=False, index=True)
    prompt_tokens = Column(Integer, default=0, nullable=False)
    completion_tokens = Column(Integer, default=0, nullable=False)
    total_tokens = Column(Integer, default=0, nullable=False)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(UTC), nullable=False)
    updated_at = Column(DateTime(timezone=True), default=lambda: datetime.now(UTC), onupdate=lambda: datetime.now(UTC), nullable=False)

    __table_args__ = (
        UniqueConstraint('user_id', 'usage_date', name='uix_user_token_usage_ledger_user_date'),
    )


class UserTokenWalletLedger(Base):
    __tablename__ = "user_token_wallet_ledger"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(String, ForeignKey('users.id', ondelete='CASCADE'), nullable=False, index=True)
    transaction_type = Column(String(20), nullable=False, index=True)
    token_amount = Column(Integer, nullable=False)
    balance_after = Column(Integer, nullable=False)
    source = Column(String(50), nullable=True)
    source_order_no = Column(String(128), nullable=True, index=True)
    idempotency_key = Column(String(160), nullable=True, unique=True, index=True)
    wallet_meta = Column(JSONB, default={}, nullable=False)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(UTC), nullable=False)


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
    active_branch_id = Column(String, nullable=True)
    messages = Column(JSONB, default=[])
    chat_config = Column(JSONB, nullable=False, default={})
    is_pinned = Column(Boolean, default=False, nullable=False)
    hidden_from_recent = Column(Boolean, default=False, nullable=False)
    last_updated = Column(DateTime(timezone=True), default=lambda: datetime.now(UTC))
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(UTC))

    user = relationship("User", back_populates="chat_histories")
    branches = relationship("ChatHistoryBranch", back_populates="chat", cascade="all, delete-orphan")
    messages_rel = relationship("ChatHistoryMessage", back_populates="chat", cascade="all, delete-orphan")


class ChatHistoryBranch(Base):
    __tablename__ = "chat_history_branches"

    id = Column(Integer, primary_key=True, index=True)
    chat_id = Column(String, ForeignKey('chat_histories.chat_id', ondelete='CASCADE'), nullable=False, index=True)
    branch_id = Column(String, nullable=False)
    parent_branch_id = Column(String, nullable=True)
    parent_message_id = Column(String, nullable=True)
    label = Column(String(255), nullable=False, default="Main")
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(UTC), nullable=False)
    last_updated = Column(DateTime(timezone=True), default=lambda: datetime.now(UTC), nullable=False)

    chat = relationship("ChatHistory", back_populates="branches")
    messages = relationship("ChatHistoryMessage", back_populates="branch", cascade="all, delete-orphan")

    __table_args__ = (
        UniqueConstraint('chat_id', 'branch_id', name='uix_chat_history_branches_chat_branch'),
    )


class ChatHistoryMessage(Base):
    __tablename__ = "chat_history_messages"

    id = Column(Integer, primary_key=True, index=True)
    chat_id = Column(String, ForeignKey('chat_histories.chat_id', ondelete='CASCADE'), nullable=False, index=True)
    branch_id = Column(String, nullable=False, index=True)
    message_id = Column(String, nullable=True, index=True)
    role = Column(String(20), nullable=False)
    content = Column(Text, nullable=False)
    usage = Column(JSONB, nullable=True)
    is_pinned = Column(Boolean, default=False, nullable=False)
    created_seq = Column(BigInteger, nullable=False)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(UTC), nullable=False)

    chat = relationship("ChatHistory", back_populates="messages_rel")
    branch = relationship("ChatHistoryBranch", back_populates="messages")

    __table_args__ = (
        ForeignKeyConstraint(
            ['chat_id', 'branch_id'],
            ['chat_history_branches.chat_id', 'chat_history_branches.branch_id'],
            ondelete='CASCADE',
            name='fk_chat_history_messages_branch',
        ),
        UniqueConstraint('chat_id', 'branch_id', 'created_seq', name='uix_chat_history_messages_chat_branch_seq'),
    )


class Persona(Base):
    __tablename__ = "personas"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, unique=True, index=True, nullable=False)
    description = Column(Text, nullable=True)
    intro = Column(Text, nullable=True)  # Short intro for display
    tags = Column(ARRAY(Text), default=[])  # array of strings
    picture = Column(String, nullable=True)  # path or URL to the picture
    avatar_picture = Column(String, nullable=True)  # cropped square avatar derived from picture
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

    # Content moderation status: null = normal | 'restricted' | 'takedown'
    moderation_status = Column(String(20), nullable=True)
    appeal_under_review = Column(Boolean, default=False, nullable=False)


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
    greeting = Column(String, nullable=True)
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

    # Content moderation status: null = normal | 'restricted' | 'takedown'
    moderation_status = Column(String(20), nullable=True)
    appeal_under_review = Column(Boolean, default=False, nullable=False)

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

# Junction table for creator follows
class UserFollow(Base):
    __tablename__ = "user_follows"
    follower_id = Column(String, ForeignKey('users.id', ondelete='CASCADE'), primary_key=True)
    creator_id = Column(String, ForeignKey('users.id', ondelete='CASCADE'), primary_key=True)
    followed_at = Column(DateTime(timezone=True), default=lambda: datetime.now(UTC))
    __table_args__ = (
        UniqueConstraint('follower_id', 'creator_id', name='uix_user_follows'),
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
    target_type = Column(String, nullable=True)  # 'character' | 'scene' | 'persona' | 'user'
    target_id = Column(Integer, nullable=True)
    target_name = Column(String, nullable=True)
    target_string_id = Column(String, nullable=True)  # For string IDs (e.g. user Firebase UIDs)
    reason = Column(String, nullable=True)  # Report reason category
    status = Column(String, default="pending", nullable=False)  # pending, in-progress, resolved, closed
    created_time = Column(DateTime(timezone=True), default=lambda: datetime.now(UTC))
    resolved_time = Column(DateTime(timezone=True), nullable=True)
    admin_notes = Column(Text, nullable=True)
    action_taken = Column(String(30), nullable=True)  # warn | upload_ban | full_ban | shadow_ban | unban | ignore | keep | hide | delete
    resolved_by = Column(String, ForeignKey('users.id', ondelete='SET NULL'), nullable=True)


class ContentReviewQueue(Base):
    __tablename__ = "content_review_queue"

    id = Column(Integer, primary_key=True, index=True)
    character_id = Column(Integer, ForeignKey('characters.id', ondelete='SET NULL'), nullable=True, index=True)
    character_name = Column(String, nullable=True)
    source = Column(String(50), nullable=False, index=True)  # moderation_review | user_report
    reason = Column(Text, nullable=True)
    status = Column(String(30), default="pending", nullable=False, index=True)
    triggered_by_report_id = Column(Integer, ForeignKey('problem_reports.id', ondelete='SET NULL'), nullable=True, index=True)
    created_time = Column(DateTime(timezone=True), default=lambda: datetime.now(UTC), nullable=False)
    updated_time = Column(DateTime(timezone=True), default=lambda: datetime.now(UTC), onupdate=lambda: datetime.now(UTC), nullable=False)
    resolved_time = Column(DateTime(timezone=True), nullable=True)
    resolved_by = Column(String, ForeignKey('users.id', ondelete='SET NULL'), nullable=True)
    resolution_notes = Column(Text, nullable=True)

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


class PaymentOrder(Base):
    __tablename__ = "payment_orders"

    out_trade_no = Column(String(128), primary_key=True)
    user_id = Column(String, ForeignKey('users.id', ondelete='SET NULL'), nullable=True, index=True)
    order_type = Column(String(50), nullable=False, default="unknown")
    trade_no = Column(String(128), nullable=True, index=True)
    total_amount = Column(String(32), nullable=True)
    source = Column(String(32), nullable=True)
    status = Column(String(20), nullable=False, default="processing", index=True)
    refund_status = Column(String(20), nullable=True, default=None, index=True)  # "pending", "success", "failed", etc.
    error_message = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(UTC), nullable=False)
    updated_at = Column(DateTime(timezone=True), default=lambda: datetime.now(UTC), onupdate=lambda: datetime.now(UTC), nullable=False)


class SystemSettings(Base):
    __tablename__ = "system_settings"

    key = Column(String(100), primary_key=True)
    value = Column(Text, nullable=False)
    updated_at = Column(DateTime(timezone=True), default=lambda: datetime.now(UTC), onupdate=lambda: datetime.now(UTC))
    updated_by = Column(String, ForeignKey('users.id', ondelete='SET NULL'), nullable=True)


class UserMessage(Base):
    """User inbox messages: warn/ban notices, edit advice, or generic system messages."""
    __tablename__ = "user_messages"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(String, ForeignKey('users.id', ondelete='CASCADE'), nullable=False, index=True)
    # type: warn | ban | unban | advice | system
    msg_type = Column(String(20), nullable=False, default='system', index=True)
    title = Column(String(200), nullable=False)
    body = Column(Text, nullable=False)
    is_read = Column(Boolean, default=False, nullable=False, index=True)
    extra = Column(JSONB, default={}, nullable=False)  # e.g. ban_until, ban_reason, target info
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(UTC), nullable=False, index=True)
    created_by = Column(String, ForeignKey('users.id', ondelete='SET NULL'), nullable=True)  # admin who sent it


class BanAppeal(Base):
    """User-submitted appeal for a ban. One pending appeal per user at a time."""
    __tablename__ = "ban_appeals"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(String, ForeignKey('users.id', ondelete='CASCADE'), nullable=False, index=True)
    ban_type = Column(String(20), nullable=False)   # ban type at time of submission
    reason = Column(Text, nullable=False)            # user's appeal message
    # status: pending | approved | rejected
    status = Column(String(20), nullable=False, default='pending', index=True)
    admin_reply = Column(Text, nullable=True)        # moderator reply sent to user
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(UTC), nullable=False, index=True)
    resolved_at = Column(DateTime(timezone=True), nullable=True)
    resolved_by = Column(String, ForeignKey('users.id', ondelete='SET NULL'), nullable=True)


class ContentBanAppeal(Base):
    """Creator-submitted appeal for a restricted or taken-down content item."""
    __tablename__ = "content_ban_appeals"

    id = Column(Integer, primary_key=True, index=True)
    entity_type = Column(String(20), nullable=False)    # character | scene | persona
    entity_id = Column(Integer, nullable=False, index=True)
    creator_id = Column(String, ForeignKey('users.id', ondelete='CASCADE'), nullable=False, index=True)
    appeal_reason = Column(Text, nullable=False)         # creator's explanation
    # status: pending | approved | rejected
    status = Column(String(20), nullable=False, default='pending', index=True)
    snapshot = Column(JSONB, nullable=True)              # entity field values at submission time
    admin_reply = Column(Text, nullable=True)            # moderator reply sent to creator
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(UTC), nullable=False, index=True)
    resolved_at = Column(DateTime(timezone=True), nullable=True)
    resolved_by = Column(String, ForeignKey('users.id', ondelete='SET NULL'), nullable=True)


class UserModerationLog(Base):
    """Permanent record of every account-level moderation action taken against a user."""
    __tablename__ = "user_moderation_logs"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(String, ForeignKey('users.id', ondelete='CASCADE'), nullable=False, index=True)
    action = Column(String(30), nullable=False)          # warn | upload_ban | full_ban | shadow_ban | unban
    ban_reason = Column(String(50), nullable=True)       # harassment/spam/abuse/underage/other
    ban_note = Column(Text, nullable=True)               # moderator-visible note
    ban_until = Column(DateTime(timezone=True), nullable=True)
    admin_id = Column(String, ForeignKey('users.id', ondelete='SET NULL'), nullable=True)
    admin_name = Column(String, nullable=True)           # denormalised so record survives admin deletion
    source = Column(String(20), nullable=False, default='direct')  # direct | report
    source_report_id = Column(Integer, ForeignKey('problem_reports.id', ondelete='SET NULL'), nullable=True)
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(UTC), nullable=False, index=True)


class ContentModerationLog(Base):
    """Permanent record of every content-level moderation action taken on user-created content."""
    __tablename__ = "content_moderation_logs"

    id = Column(Integer, primary_key=True, index=True)
    creator_id = Column(String, ForeignKey('users.id', ondelete='CASCADE'), nullable=False, index=True)
    entity_type = Column(String(20), nullable=False)     # character | scene | persona
    entity_id = Column(Integer, nullable=False)
    entity_name = Column(String, nullable=True)          # denormalised for retention after deletion
    action = Column(String(20), nullable=False)          # restrict | takedown | unban | delete | hide
    admin_id = Column(String, ForeignKey('users.id', ondelete='SET NULL'), nullable=True)
    admin_name = Column(String, nullable=True)
    source = Column(String(20), nullable=False, default='direct')  # direct | report | content_review
    source_report_id = Column(Integer, ForeignKey('problem_reports.id', ondelete='SET NULL'), nullable=True)
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(UTC), nullable=False, index=True)