from pydantic import BaseModel, EmailStr
from typing import Optional

class UserCreate(BaseModel):
    email: EmailStr
    phone: Optional[str]
    password: str

class UserLogin(BaseModel):
    email: EmailStr
    password: str
