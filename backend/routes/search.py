from typing import List
from fastapi import APIRouter, Request, Depends, HTTPException
from sqlalchemy import func, case
from sqlalchemy.orm import Session
from database import get_db
from models import SearchTerm, Character, User, Scene, Persona
from schemas import CharacterOut, SceneOut, PersonaOut

from datetime import datetime, UTC

router = APIRouter()


@router.get("/api/characters/search", response_model=List[CharacterOut])
def search_characters(q: str, sort: str = "relevance", db: Session = Depends(get_db)):

    # Create a case-insensitive pattern
    ilike_pattern = f"%{q}%"
    
    # Base query with filtering
    query = db.query(Character).filter(
        Character.name.ilike(ilike_pattern) | 
        Character.persona.ilike(ilike_pattern) |
        func.array_to_string(Character.tags, ',').ilike(ilike_pattern)
    )

    # For relevance sorting, we'll calculate a score
    if sort == "relevance":
        # Define weights for different fields
        NAME_WEIGHT = 3.0
        TAG_WEIGHT = 2.0
        PERSONA_WEIGHT = 1.0
        
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
    
    return chars

# --- Scene Search Endpoint ---
@router.get("/api/scenes/search", response_model=List[SceneOut])
def search_scenes(q: str, sort: str = "relevance", db: Session = Depends(get_db)):
    ilike_pattern = f"%{q}%"
    query = db.query(Scene).filter(
        Scene.name.ilike(ilike_pattern) |
        Scene.description.ilike(ilike_pattern) |
        func.array_to_string(Scene.tags, ',').ilike(ilike_pattern)
    )
    if sort == "relevance":
        NAME_WEIGHT = 3.0
        TAG_WEIGHT = 2.0
        DESC_WEIGHT = 1.0
        score_case = case(
            (Scene.name.ilike(ilike_pattern), NAME_WEIGHT),
            (func.array_to_string(Scene.tags, ',').ilike(ilike_pattern), TAG_WEIGHT),
            (Scene.description.ilike(ilike_pattern), DESC_WEIGHT),
            else_=0
        ).label("relevance_score")
        query = query.add_columns(score_case)
        query = query.group_by(Scene.id)
        query = query.order_by(score_case.desc(), Scene.views.desc())
        results = query.all()
        scenes = [r[0] for r in results]
    elif sort == "popularity":
        query = query.order_by(Scene.views.desc())
        scenes = query.all()
    elif sort == "recent":
        query = query.order_by(Scene.created_time.desc())
        scenes = query.all()
    else:
        query = query.order_by(Scene.name.asc())
        scenes = query.all()
    return scenes

# --- Persona Search Endpoint ---
@router.get("/api/personas/search", response_model=List[PersonaOut])
def search_personas(q: str, sort: str = "relevance", db: Session = Depends(get_db)):
    ilike_pattern = f"%{q}%"
    query = db.query(Persona).filter(
        Persona.name.ilike(ilike_pattern) |
        Persona.description.ilike(ilike_pattern) |
        func.array_to_string(Persona.tags, ',').ilike(ilike_pattern)
    )
    if sort == "relevance":
        NAME_WEIGHT = 3.0
        TAG_WEIGHT = 2.0
        DESC_WEIGHT = 1.0
        score_case = case(
            (Persona.name.ilike(ilike_pattern), NAME_WEIGHT),
            (func.array_to_string(Persona.tags, ',').ilike(ilike_pattern), TAG_WEIGHT),
            (Persona.description.ilike(ilike_pattern), DESC_WEIGHT),
            else_=0
        ).label("relevance_score")
        query = query.add_columns(score_case)
        query = query.group_by(Persona.id)
        query = query.order_by(score_case.desc(), Persona.views.desc())
        results = query.all()
        personas = [r[0] for r in results]
    elif sort == "popularity":
        query = query.order_by(Persona.views.desc())
        personas = query.all()
    elif sort == "recent":
        query = query.order_by(Persona.created_time.desc())
        personas = query.all()
    else:
        query = query.order_by(Persona.name.asc())
        personas = query.all()
    return personas

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