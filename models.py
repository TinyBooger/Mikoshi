from sqlalchemy import Column, String, Integer, JSON
from sqlalchemy.ext.declarative import declarative_base

Base = declarative_base()

class Character(Base):
    __tablename__ = "characters"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, unique=True, index=True, nullable=False)
    persona = Column(String, nullable=False)
    example_messages = Column(JSON, default=[])

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, nullable=False)
    phone = Column(String, unique=False)
    hashed_password = Column(String, nullable=False)