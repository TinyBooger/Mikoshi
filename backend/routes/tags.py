from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from database import get_db
from models import Tag

router = APIRouter()

@router.get("/api/tag-suggestions")
def tag_suggestions(q: str = "", db: Session = Depends(get_db)):
    if q.strip() == "":
        tags = db.query(Tag).order_by(Tag.count.desc()).limit(10).all()
    else:
        tags = db.query(Tag).filter(Tag.name.ilike(f"%{q}%")).order_by(Tag.count.desc()).limit(10).all()
    return [{"name": t.name, "count": t.count} for t in tags]
