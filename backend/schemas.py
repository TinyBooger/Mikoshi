
from pydantic import BaseModel, EmailStr
from typing import Optional, List, Any

class SceneOut(BaseModel):
    id: int
    name: str
    description: str
    intro: Optional[str] = None
    tags: List[str] = []
    creator_id: str
    creator_name: str
    created_time: Any
    likes: int = 0
    views: int = 0
    picture: Optional[str] = None
    is_public: bool = False
    is_forkable: bool = False
    forked_from_id: Optional[int] = None
    forked_from_name: Optional[str] = None

    class Config:
        from_attributes = True

class PersonaOut(BaseModel):
    id: int
    name: str
    description: Optional[str] = None
    intro: Optional[str] = None
    tags: list[str] = []
    creator_id: str
    creator_name: str
    created_time: Any
    picture: Optional[str] = None
    likes: int = 0
    views: int = 0
    is_public: bool = False
    is_forkable: bool = False
    forked_from_id: Optional[int] = None
    forked_from_name: Optional[str] = None

    class Config:
        from_attributes = True
        
class CharacterOut(BaseModel):
    id: int
    name: str
    persona: str
    example_messages: Optional[str] = ""
    tagline: Optional[str] = ""
    tags: list[str] = []
    views: int = 0
    likes: int = 0
    picture: Optional[str] = None
    greeting: Optional[str] = None
    created_time: Any
    creator_id: str
    creator_name: Optional[str] = None
    is_public: bool = False
    is_forkable: bool = False
    is_free: bool = True
    price: float = 0
    forked_from_id: Optional[int] = None
    forked_from_name: Optional[str] = None

    class Config:
        from_attributes = True

class CharacterListOut(BaseModel):
    items: List[CharacterOut]
    total: int
    page: int
    page_size: int
    short: bool

    class Config:
        from_attributes = True

# CharacterOut model
class UserOut(BaseModel):
    id: str
    email: Optional[EmailStr] = None
    name: Optional[str] = None
    profile_pic: Optional[str] = None
    bio: Optional[str] = None
    liked_tags: list[str] = []
    chat_history: list[Any] = []
    views: int = 0
    likes: int = 0
    characters_created: int = 0
    is_admin: bool = False
    default_persona_id: Optional[int] = None
    default_persona: Optional[PersonaOut] = None
    level: int = 1
    exp: int = 0
    badges: dict[str, Any] = {}
    active_badge: Optional[str] = None
    
    class Config:
        from_attributes = True
class SceneListOut(BaseModel):
    items: List[SceneOut]
    total: int
    page: int
    page_size: int
    short: bool

    class Config:
        from_attributes = True

class PersonaListOut(BaseModel):
    items: List[PersonaOut]
    total: int
    page: int
    page_size: int
    short: bool

    class Config:
        from_attributes = True

class UserListOut(BaseModel):
    items: List[UserOut]
    total: int
    page: int
    page_size: int

    class Config:
        from_attributes = True

class ProblemReportCreate(BaseModel):
    description: str
    screenshot: Optional[str] = None
    target_type: Optional[str] = None
    target_id: Optional[int] = None
    target_name: Optional[str] = None

class ProblemReportOut(BaseModel):
    id: int
    user_id: Optional[str] = None
    user_email: Optional[str] = None
    description: str
    screenshot: Optional[str] = None
    target_type: Optional[str] = None
    target_id: Optional[int] = None
    target_name: Optional[str] = None
    status: str
    created_time: Any
    resolved_time: Optional[Any] = None
    admin_notes: Optional[str] = None

    class Config:
        from_attributes = True
    
    class Config:
        from_attributes = True