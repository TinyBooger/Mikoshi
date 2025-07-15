from fastapi import APIRouter, Request, Depends, HTTPException
from sqlalchemy import func, case
from sqlalchemy.orm import Session
from database import get_db
from models import SearchTerm, Character
from datetime import datetime, UTC

router = APIRouter()

@router.get("/api/characters/search")
def search_characters(q: str, sort: str = "relevance", db: Session = Depends(get_db)):
    # Base query
    query = db.query(Character)
    
    # For relevance sorting, we'll calculate a score
    if sort == "relevance":
        # Define weights for different fields
        NAME_WEIGHT = 3.0
        TAG_WEIGHT = 2.0
        PERSONA_WEIGHT = 1.0
        
        # Create a case-insensitive pattern
        ilike_pattern = f"%{q}%"
        
        # Calculate score for each field using the new case() syntax
        score_case = case(
            (Character.name.ilike(ilike_pattern), NAME_WEIGHT),
            (func.array_to_string(Character.tags, ',').ilike(ilike_pattern), TAG_WEIGHT),
            (Character.persona.ilike(ilike_pattern), PERSONA_WEIGHT),
            else_=0
        ).label("relevance_score")
        
        query = query.add_columns(score_case)
        query = query.group_by(Character.id)
        query = query.order_by(score_case.desc(), Character.views.desc())
        
    elif sort == "popularity":
        query = query.order_by(Character.views.desc())
    elif sort == "recent":
        query = query.order_by(Character.created_time.desc())
    else:
        query = query.order_by(Character.name.asc())
    
    # Execute the query
    if sort == "relevance":
        results = query.all()
        chars = [r[0] for r in results]  # Extract the Character objects
        scores = [r[1] for r in results]  # Extract the scores
    else:
        chars = query.all()
    
    return [
        {
            "id": c.id,
            "name": c.name,
            "persona": c.persona,
            "picture": c.picture,
            "views": c.views,
            "tags": c.tags,
            "created_time": c.created_time.isoformat() if c.created_time else None,
            "score": scores[i] if sort == "relevance" else None  # Include score for debugging
        } for i, c in enumerate(chars)
    ]

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