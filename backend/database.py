from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base
import os

DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://characterdb_user:kqkAuypa3xeMpNn73OkjLjfHep632yPy@dpg-d10f6eq4d50c73anu130-a.oregon-postgres.render.com/characterdb")

engine = create_engine(DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()
