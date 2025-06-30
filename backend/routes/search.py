from fastapi import APIRouter, Request, Depends, HTTPException
from sqlalchemy.orm import Session
from database import get_db
from models import SearchTerm
from datetime import datetime, UTC

router = APIRouter()

@router.post("/api/update-search-term")
async def update_search_term(request: Request, db: Session = Depends(get_db)):
    data = await request.json()
    keyword = data.get("keyword")
    if not keyword:
        raise HTTPException(status_code=400, detail="Missing keyword")

    term = db.query(SearchTerm).filter(SearchTerm.keyword == keyword).first()
    now = datetime.now(UTC)
    if term:
        term.search_count += 1
        term.last_searched = now
    else:
        term = SearchTerm(keyword=keyword, search_count=1, last_searched=now)
        db.add(term)
    db.commit()
    return {"message": "Search term updated"}

@router.get("/api/search-suggestions/popular")
def get_popular_search_terms(db: Session = Depends(get_db)):
    terms = (
        db.query(SearchTerm)
        .order_by(SearchTerm.search_count.desc())
        .limit(5)
        .all()
    )
    return [{"keyword": t.keyword, "count": t.search_count} for t in terms]

@router.get("/api/search-suggestions")
def get_search_suggestions(q: str, db: Session = Depends(get_db)):
    terms = (
        db.query(SearchTerm)
        .filter(SearchTerm.keyword.ilike(f"%{q}%"))
        .order_by(SearchTerm.search_count.desc())
        .limit(5)
        .all()
    )
    return [{"keyword": t.keyword, "count": t.search_count} for t in terms]