from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from database import get_db
from models import Tag

router = APIRouter()

@router.get("/api/tag-suggestions")
def tag_suggestions(q: str = "", db: Session = Depends(get_db)):
    if q.strip() == "":
        tags = db.query(Tag).order_by(Tag.likes.desc()).limit(10).all()
    else:
        tags = db.query(Tag).filter(Tag.name.ilike(f"%{q}%")).order_by(Tag.likes.desc()).limit(10).all()
    return [{"name": t.name, "likes": t.likes} for t in tags]

@router.get("/api/tags/all")
def get_all_tags(db: Session = Depends(get_db)):
    tags = db.query(Tag).order_by(Tag.name).all()
    return [{"name": t.name, "likes": t.likes} for t in tags]