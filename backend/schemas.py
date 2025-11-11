
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
    is_admin: bool = False

    class Config:
        from_attributes = True