from fastapi import APIRouter, Request, Depends, HTTPException, UploadFile, File, Form, Query
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session
from sqlalchemy.dialects.postgresql import array, TEXT
from typing import List, Optional
from datetime import datetime, UTC
import json

from database import get_db
from models import Character, User, Tag, UserLikedCharacter
from utils.session import get_current_user
from utils.local_storage_utils import save_image
from utils.image_moderation import moderate_image_with_decision
from utils.chat_history_utils import fetch_user_chat_history
from utils.validators import validate_character_fields
from utils.content_censor import censor_form_payload
from utils.text_moderation import moderate_form_payload_with_review
from schemas import CharacterOut, CharacterListOut
from utils.level_system import award_exp_with_limits
from utils.llm_client import client
from utils.content_review_queue import enqueue_character_review

router = APIRouter()

LONG_DESCRIPTION_CHUNK_PROMPT = """Split the following character description into semantic chunks for an AI roleplay system.

Rules:

* Each chunk should contain one coherent idea or topic.
* Each chunk must be understandable on its own.
* Maximum 120 words per chunk.
* Maximum 50 chunks total.
* Preserve important roleplay information.
* Avoid repeating information across chunks.
* Rewrite content into dense instruction-style text.
* Use short phrases and compact wording.

Order the chunks by importance for roleplay:

* Most important character traits, behavior rules, and personality first.
* Then relationships or motivations.
* Then background or lore.
* Least important details last.

Output JSON only:

{
"chunks": [
{"content": "..."},
{"content": "..."}
]
}"""


def _extract_json_payload(raw: str) -> dict:
    content = (raw or "").strip()
    if "```json" in content:
        content = content.split("```json", 1)[1].split("```", 1)[0].strip()
    elif "```" in content:
        content = content.split("```", 1)[1].split("```", 1)[0].strip()
    return json.loads(content)


def _sanitize_chunks(payload: dict) -> list[dict[str, str]]:
    chunks = payload.get("chunks") if isinstance(payload, dict) else []
    if not isinstance(chunks, list):
        return []
    cleaned: list[dict[str, str]] = []
    for chunk in chunks[:50]:
        if not isinstance(chunk, dict):
            continue
        text = str(chunk.get("content", "")).strip()
        if not text:
            continue
        words = text.split()
        if len(words) > 120:
            text = " ".join(words[:120]).strip()
        cleaned.append({"content": text})
    return cleaned


def _fallback_split_chunks(long_description: str) -> list[dict[str, str]]:
    words = (long_description or "").split()
    if not words:
        return []
    chunks = []
    for i in range(0, len(words), 120):
        piece = " ".join(words[i:i + 120]).strip()
        if piece:
            chunks.append({"content": piece})
        if len(chunks) >= 50:
            break
    return chunks


def split_long_description_chunks(long_description: str) -> tuple[list[dict[str, str]], bool]:
    source = (long_description or "").strip()
    if not source:
        return [], True
    try:
        response = client.chat.completions.create(
            model="deepseek-chat",
            messages=[
                {"role": "system", "content": LONG_DESCRIPTION_CHUNK_PROMPT},
                {"role": "user", "content": source},
            ],
            max_tokens=1800,
            temperature=0.2,
            top_p=0.9,
        )
        raw = response.choices[0].message.content if response and response.choices else ""
        parsed = _extract_json_payload(raw or "")
        chunks = _sanitize_chunks(parsed)
        if chunks:
            return chunks, True
        return _fallback_split_chunks(source), False
    except Exception:
        return _fallback_split_chunks(source), False


def normalize_context_label(value: Optional[str]) -> str:
    return "advanced" if value == "advanced" else "standard"


def parse_character_chat_config(
    model: str,
    temperature: float,
    top_p: float,
    max_tokens: int,
    presence_penalty: float,
    frequency_penalty: float,
):
    allowed_models = {"deepseek-chat", "deepseek-reasoner"}
    safe_model = model if model in allowed_models else "deepseek-chat"
    safe_temperature = max(0.0, min(2.0, float(temperature)))
    safe_top_p = max(0.0, min(1.0, float(top_p)))
    safe_max_tokens = max(1, min(8192, int(max_tokens)))
    safe_presence_penalty = max(-2.0, min(2.0, float(presence_penalty)))
    safe_frequency_penalty = max(-2.0, min(2.0, float(frequency_penalty)))
    return {
        "model": safe_model,
        "temperature": safe_temperature,
        "top_p": safe_top_p,
        "max_tokens": safe_max_tokens,
        "presence_penalty": safe_presence_penalty,
        "frequency_penalty": safe_frequency_penalty,
    }


def default_character_chat_config():
    return {
        "model": "deepseek-chat",
        "temperature": 1.3,
        "top_p": 0.9,
        "max_tokens": 250,
        "presence_penalty": 0.0,
        "frequency_penalty": 0.0,
    }

@router.post("/api/create-character")
async def create_character(
    name: str = Form(...),
    persona: str = Form(...),
    tagline: str = Form(""),
    tags: List[str] = Form([]),
    greeting: str = Form(""),
    sample_dialogue: str = Form(""),
    long_description: str = Form(""),
    context_label: str = Form("standard"),
    model: str = Form("deepseek-chat"),
    temperature: float = Form(1.3),
    top_p: float = Form(0.9),
    max_tokens: int = Form(250),
    presence_penalty: float = Form(0),
    frequency_penalty: float = Form(0),
    is_public: bool = Form(False),
    is_forkable: bool = Form(False),
    forked_from_id: Optional[int] = Form(None),
    forked_from_name: Optional[str] = Form(None),
    picture: UploadFile = File(None),
    avatar_picture: UploadFile = File(None),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    if not current_user:
        raise HTTPException(status_code=404, detail="User not found")

    text_safe, needs_text_review, blocked_field, blocked_label, review_field, review_label = moderate_form_payload_with_review({
        "name": name,
        "persona": persona,
        "tagline": tagline,
        "tags": tags,
        "greeting": greeting,
        "sample_dialogue": sample_dialogue,
        "long_description": long_description,
        "forked_from_name": forked_from_name,
    })
    if not text_safe:
        raise HTTPException(
            status_code=400,
            detail=f"Text rejected by content moderation ({blocked_field}: {blocked_label})"
        )

    censored_payload, content_censored = censor_form_payload({
        "name": name,
        "persona": persona,
        "tagline": tagline,
        "tags": tags,
        "greeting": greeting,
        "sample_dialogue": sample_dialogue,
        "long_description": long_description,
        "forked_from_name": forked_from_name,
    })
    name = (censored_payload.get("name") or "").strip()
    persona = (censored_payload.get("persona") or "").strip()
    tagline = (censored_payload.get("tagline") or "")
    tags = censored_payload.get("tags") or []
    greeting = (censored_payload.get("greeting") or "")
    sample_dialogue = (censored_payload.get("sample_dialogue") or "")
    long_description = (censored_payload.get("long_description") or "")
    forked_from_name = censored_payload.get("forked_from_name")
    context_label = normalize_context_label(context_label)

    existing = db.query(Character).filter(Character.name == name).first()
    if existing:
        return JSONResponse(content={"error": "Character already exists"}, status_code=400)
    
    error = validate_character_fields(name, persona, tagline, greeting, sample_dialogue, tags, context_label, long_description)
    if error:
        raise HTTPException(status_code=400, detail=error)

    is_pro_user = bool(current_user.is_pro)
    can_create_private = is_pro_user or (current_user.level or 1) >= 2
    can_use_fork_features = is_pro_user or (current_user.level or 1) >= 2

    if context_label == "advanced" and not is_pro_user:
        raise HTTPException(status_code=403, detail="Advanced characters require Pro user")

    # Enforce private character capability by level or Pro
    if not is_public and not can_create_private:
        raise HTTPException(status_code=403, detail="Private characters require level 2 or higher")
    
    # Enforce: forking requires level 2 or higher
    if forked_from_id and not can_use_fork_features:
        raise HTTPException(status_code=403, detail="Forking requires level 2 or higher")

    # Enforce: open-source/forkable characters require level 2+ or Pro
    if is_forkable and not can_use_fork_features:
        raise HTTPException(status_code=403, detail="Forkable characters require level 2 or higher")

    for tag_name in tags:  # update tags
        tag = db.query(Tag).filter(Tag.name == tag_name).first()
        if tag:
            tag.count += 1
        else:
            db.add(Tag(name=tag_name, count=1))

    normalized_long_description = long_description.strip()
    can_use_advanced_config = is_pro_user or (current_user.level or 1) >= 3
    chat_config = parse_character_chat_config(
        model=model,
        temperature=temperature,
        top_p=top_p,
        max_tokens=max_tokens,
        presence_penalty=presence_penalty,
        frequency_penalty=frequency_penalty,
    ) if can_use_advanced_config else default_character_chat_config()
    long_description_chunks = []
    if context_label == "advanced" and normalized_long_description:
        long_description_chunks, split_ok = split_long_description_chunks(normalized_long_description)
        if not split_ok:
            raise HTTPException(status_code=502, detail="Failed to split long description into chunks")

    char = Character(
        name=name,
        persona=persona,
        tagline=tagline.strip(),
        tags=tags,
        greeting=greeting.strip(),
        example_messages=sample_dialogue.strip(),
        long_description=normalized_long_description,
        long_description_chunks=long_description_chunks,
        context_label=context_label,
        model=chat_config["model"],
        temperature=chat_config["temperature"],
        top_p=chat_config["top_p"],
        max_tokens=chat_config["max_tokens"],
        presence_penalty=chat_config["presence_penalty"],
        frequency_penalty=chat_config["frequency_penalty"],
        creator_id=current_user.id,
        creator_name=current_user.name,
        is_public=is_public,
        is_forkable=is_forkable,
        views=0,
        picture=None,
        avatar_picture=None,
        forked_from_id=forked_from_id,
        forked_from_name=forked_from_name,
    )
    db.add(char)
    db.commit()
    db.refresh(char)

    if needs_text_review:
        reason = f"Text moderation suggested REVIEW ({review_field}: {review_label or 'Unknown'})"
        enqueue_character_review(
            db,
            character_id=char.id,
            source="moderation_review",
            reason=reason,
        )

    if picture:
        image_bytes = await picture.read()
        is_safe, label, suggestion = moderate_image_with_decision(image_bytes)
        if not is_safe:
            raise HTTPException(status_code=400, detail=f"Image rejected by content moderation ({label})")
        if suggestion == "Review":
            enqueue_character_review(
                db,
                character_id=char.id,
                source="moderation_review",
                reason=f"Main image moderation suggested REVIEW ({label or 'Unknown'})",
            )
        import io
        char.picture = save_image(io.BytesIO(image_bytes), 'character', char.id, picture.filename)
    if avatar_picture:
        avatar_bytes = await avatar_picture.read()
        is_safe, label, suggestion = moderate_image_with_decision(avatar_bytes)
        if not is_safe:
            raise HTTPException(status_code=400, detail=f"Avatar image rejected by content moderation ({label})")
        if suggestion == "Review":
            enqueue_character_review(
                db,
                character_id=char.id,
                source="moderation_review",
                reason=f"Avatar image moderation suggested REVIEW ({label or 'Unknown'})",
            )
        import io
        char.avatar_picture = save_image(
            io.BytesIO(avatar_bytes),
            'character',
            char.id,
            avatar_picture.filename,
            filename_prefix=f"character_avatar_{char.id}",
        )

    db.commit()
    db.refresh(char)

    # Award EXP to creator for creating a character
    exp_result = award_exp_with_limits(current_user, "create_character", db)
    
    # Award EXP to original creator if this is a fork (only if forked by someone else)
    if forked_from_id:
        original_char = db.query(Character).filter(Character.id == forked_from_id).first()
        if original_char and original_char.creator_id:
            original_creator = db.query(User).filter(User.id == original_char.creator_id).first()
            # Only award EXP if the forker is not the original creator
            if original_creator and original_creator.id != current_user.id:
                award_exp_with_limits(original_creator, "forked", db)
    
    return {
        "message": f"Character '{name}' created.",
        "exp": current_user.exp,
        "level": current_user.level,
        "exp_result": exp_result,
        "content_censored": content_censored
    }

@router.post("/api/update-character")
async def update_character(
    id: int = Form(...),
    name: str = Form(...),
    persona: str = Form(...),
    tagline: str = Form(""),
    tags: List[str] = Form([]),
    greeting: str = Form(""),
    sample_dialogue: str = Form(""),
    long_description: str = Form(""),
    context_label: Optional[str] = Form(None),
    model: str = Form("deepseek-chat"),
    temperature: float = Form(1.3),
    top_p: float = Form(0.9),
    max_tokens: int = Form(250),
    presence_penalty: float = Form(0),
    frequency_penalty: float = Form(0),
    is_public: Optional[bool] = Form(None),
    is_forkable: Optional[bool] = Form(None),
    picture: UploadFile = File(None),
    avatar_picture: UploadFile = File(None),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):

    char = db.query(Character).filter(Character.id == id).first()
    if not char or char.creator_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not allowed")

    text_safe, needs_text_review, blocked_field, blocked_label, review_field, review_label = moderate_form_payload_with_review({
        "name": name,
        "persona": persona,
        "tagline": tagline,
        "tags": tags,
        "greeting": greeting,
        "sample_dialogue": sample_dialogue,
        "long_description": long_description,
    })
    if not text_safe:
        raise HTTPException(
            status_code=400,
            detail=f"Text rejected by content moderation ({blocked_field}: {blocked_label})"
        )

    censored_payload, content_censored = censor_form_payload({
        "name": name,
        "persona": persona,
        "tagline": tagline,
        "tags": tags,
        "greeting": greeting,
        "sample_dialogue": sample_dialogue,
        "long_description": long_description,
    })
    name = (censored_payload.get("name") or "").strip()
    persona = (censored_payload.get("persona") or "").strip()
    tagline = (censored_payload.get("tagline") or "")
    tags = censored_payload.get("tags") or []
    greeting = (censored_payload.get("greeting") or "")
    sample_dialogue = (censored_payload.get("sample_dialogue") or "")
    long_description = (censored_payload.get("long_description") or "")
    context_label = normalize_context_label(context_label if context_label is not None else char.context_label)
    
    error = validate_character_fields(name, persona, tagline, greeting, sample_dialogue, tags, context_label, long_description)
    if error:
        raise HTTPException(status_code=400, detail=error)
    
    is_pro_user = bool(current_user.is_pro)
    can_create_private = is_pro_user or (current_user.level or 1) >= 2
    can_use_fork_features = is_pro_user or (current_user.level or 1) >= 2

    if context_label == "advanced" and not is_pro_user:
        raise HTTPException(status_code=403, detail="Advanced characters require Pro user")

    # Enforce level-based private character access (L2+)
    final_is_public = is_public if is_public is not None else char.is_public
    if not final_is_public and not can_create_private:
        raise HTTPException(status_code=403, detail="Private characters require level 2 or higher")

    final_is_forkable = is_forkable if is_forkable is not None else char.is_forkable

    # Enforce open-source/forkable character capability by level or Pro
    if final_is_forkable and not can_use_fork_features:
        raise HTTPException(status_code=403, detail="Forkable characters require level 2 or higher")

    normalized_long_description = long_description.strip()
    existing_long_description = (char.long_description or "").strip()
    long_description_changed = normalized_long_description != existing_long_description

    if context_label == "advanced":
        if not normalized_long_description:
            long_description_chunks = []
        elif long_description_changed:
            long_description_chunks, split_ok = split_long_description_chunks(normalized_long_description)
            if not split_ok:
                raise HTTPException(status_code=502, detail="Failed to split long description into chunks")
        else:
            long_description_chunks = char.long_description_chunks or []
    else:
        long_description_chunks = []

    char.name = name
    char.persona = persona
    char.tagline = tagline.strip()
    char.tags = tags
    char.greeting = greeting.strip()
    char.example_messages = sample_dialogue.strip()
    char.long_description = normalized_long_description
    char.long_description_chunks = long_description_chunks
    char.context_label = context_label
    can_use_advanced_config = is_pro_user or (current_user.level or 1) >= 3
    chat_config = parse_character_chat_config(
        model=model,
        temperature=temperature,
        top_p=top_p,
        max_tokens=max_tokens,
        presence_penalty=presence_penalty,
        frequency_penalty=frequency_penalty,
    ) if can_use_advanced_config else default_character_chat_config()
    char.model = chat_config["model"]
    char.temperature = chat_config["temperature"]
    char.top_p = chat_config["top_p"]
    char.max_tokens = chat_config["max_tokens"]
    char.presence_penalty = chat_config["presence_penalty"]
    char.frequency_penalty = chat_config["frequency_penalty"]

    if is_public is not None:
        char.is_public = is_public
    if is_forkable is not None:
        char.is_forkable = is_forkable

    if picture:
        image_bytes = await picture.read()
        is_safe, label, suggestion = moderate_image_with_decision(image_bytes)
        if not is_safe:
            raise HTTPException(status_code=400, detail=f"Image rejected by content moderation ({label})")
        if suggestion == "Review":
            enqueue_character_review(
                db,
                character_id=char.id,
                source="moderation_review",
                reason=f"Main image moderation suggested REVIEW ({label or 'Unknown'})",
            )
        import io
        char.picture = save_image(io.BytesIO(image_bytes), 'character', char.id, picture.filename)
    if avatar_picture:
        avatar_bytes = await avatar_picture.read()
        is_safe, label, suggestion = moderate_image_with_decision(avatar_bytes)
        if not is_safe:
            raise HTTPException(status_code=400, detail=f"Avatar image rejected by content moderation ({label})")
        if suggestion == "Review":
            enqueue_character_review(
                db,
                character_id=char.id,
                source="moderation_review",
                reason=f"Avatar image moderation suggested REVIEW ({label or 'Unknown'})",
            )
        import io
        char.avatar_picture = save_image(
            io.BytesIO(avatar_bytes),
            'character',
            char.id,
            avatar_picture.filename,
            filename_prefix=f"character_avatar_{char.id}",
        )

    if needs_text_review:
        reason = f"Text moderation suggested REVIEW ({review_field}: {review_label or 'Unknown'})"
        enqueue_character_review(
            db,
            character_id=char.id,
            source="moderation_review",
            reason=reason,
        )

    db.commit()
    return {
        "message": "Character updated successfully",
        "content_censored": content_censored
    }

@router.get("/api/characters", response_model=List[CharacterOut])
def get_characters(search: str = None, db: Session = Depends(get_db)):
    query = db.query(Character).filter(Character.is_public == True)
    if search:
        # Case-insensitive search by name
        query = query.filter(Character.name.ilike(f"%{search}%"))
    chars = query.all()
    return chars


@router.get("/api/character/{character_id}", response_model=CharacterOut)
def get_character(character_id: int, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    c = db.query(Character).filter(Character.id == character_id).first()
    if not c:
        raise HTTPException(status_code=404, detail="Character not found")

    if not c.is_public:
        if not current_user or (c.creator_id != current_user.id and not current_user.is_admin):
            raise HTTPException(status_code=404, detail="Character not found")
    return c

@router.delete("/api/character/{character_id}/delete")
async def delete_character(
    character_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
    ):
    char = db.query(Character).filter(Character.id == character_id).first()
    if not char:
        raise HTTPException(status_code=404, detail="Character not found")
    if char.creator_id != current_user.id:
        print("creator id:", char.creator_id)
        print("user id:", current_user.id)
        raise HTTPException(status_code=403, detail="Not authorized")


    db.delete(char)
    db.commit()
    return {"message": "Character deleted successfully"}

@router.get("/api/characters/popular", response_model=CharacterListOut)
def get_popular_characters(
    short: bool = Query(True),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db)
):
    total = db.query(Character).filter(Character.is_public == True).count()
    base_query = (
        db.query(Character, User.profile_pic.label("creator_profile_pic"))
        .outerjoin(User, Character.creator_id == User.id)
        .filter(Character.is_public == True)
        .order_by(Character.views.desc())
    )
    if short:
        rows = base_query.limit(10).all()
        items = []
        for char, creator_profile_pic in rows:
            char.creator_profile_pic = creator_profile_pic
            items.append(char)
        return CharacterListOut(items=items, total=total, page=1, page_size=len(items), short=True)
    rows = base_query.offset((page - 1) * page_size).limit(page_size).all()
    items = []
    for char, creator_profile_pic in rows:
        char.creator_profile_pic = creator_profile_pic
        items.append(char)
    return CharacterListOut(items=items, total=total, page=page, page_size=page_size, short=False)

@router.get("/api/characters/recommended", response_model=CharacterListOut)
def get_recommended_characters(
    short: bool = Query(True),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
    ):
    if not current_user.liked_tags:
        return CharacterListOut(items=[], total=0, page=1, page_size=0, short=short)
    
    # Collect character IDs to exclude (already viewed or chatted with)
    excluded_ids = set()
    
    # Add character IDs from chat history
    chat_history = fetch_user_chat_history(db, current_user.id)
    for chat in chat_history:
        if chat.get("character_id"):
            excluded_ids.add(chat["character_id"])
    
    user_tags = current_user.liked_tags or []
    tags_array = array(user_tags, type_=TEXT)
    
    # Query characters matching user tags, excluding already viewed ones
    query = (
        db.query(Character, User.profile_pic.label("creator_profile_pic"))
        .outerjoin(User, Character.creator_id == User.id)
        .filter(Character.is_public == True)
        .filter(Character.tags.overlap(tags_array))
    )
    
    if excluded_ids:
        query = query.filter(~Character.id.in_(excluded_ids))
    
    query = query.order_by(Character.views.desc())
    total = query.count()
    if short:
        rows = query.limit(10).all()
        items = []
        for char, creator_profile_pic in rows:
            char.creator_profile_pic = creator_profile_pic
            items.append(char)
        return CharacterListOut(items=items, total=total, page=1, page_size=len(items), short=True)
    rows = query.offset((page - 1) * page_size).limit(page_size).all()
    items = []
    for char, creator_profile_pic in rows:
        char.creator_profile_pic = creator_profile_pic
        items.append(char)
    return CharacterListOut(items=items, total=total, page=page, page_size=page_size, short=False)

@router.get("/api/characters/by-tag/{tag_name}", response_model=List[CharacterOut])
def get_characters_by_tag(
    tag_name: str,
    db: Session = Depends(get_db),
    limit: int = 12
):
    chars = db.query(Character).filter(
        Character.is_public == True,
        Character.tags.any(tag_name)
    ).order_by(
        Character.views.desc()
    ).limit(limit).all()
    return chars

@router.get("/api/characters/recent", response_model=CharacterListOut)
def get_recent_characters(
    short: bool = Query(True),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db)
):
    total = db.query(Character).filter(Character.is_public == True).count()
    base_query = (
        db.query(Character, User.profile_pic.label("creator_profile_pic"))
        .outerjoin(User, Character.creator_id == User.id)
        .filter(Character.is_public == True)
        .order_by(Character.created_time.desc())
    )
    if short:
        rows = base_query.limit(10).all()
        items = []
        for char, creator_profile_pic in rows:
            char.creator_profile_pic = creator_profile_pic
            items.append(char)
        return CharacterListOut(items=items, total=total, page=1, page_size=len(items), short=True)
    rows = base_query.offset((page - 1) * page_size).limit(page_size).all()
    items = []
    for char, creator_profile_pic in rows:
        char.creator_profile_pic = creator_profile_pic
        items.append(char)
    return CharacterListOut(items=items, total=total, page=page, page_size=page_size, short=False)

# ----------------------------------------------------------------

from typing import List

@router.get("/api/characters-created", response_model=CharacterListOut)
def get_user_created_characters(
    userId: str = Query(None),
    sort: str = Query("recent"),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    If userId is provided, fetch that user's created characters (public).
    Otherwise, fetch current user's created characters.
    """
    if userId:
        query = db.query(Character).filter(Character.creator_id == userId)
        # If viewing another user's creations, show only public
        if not current_user or current_user.id != userId:
            query = query.filter(Character.is_public == True)
    else:
        if not current_user:
            return CharacterListOut(items=[], total=0, page=1, page_size=0, short=False)
        query = db.query(Character).filter(Character.creator_id == current_user.id)

    if sort == "popular":
        query = query.order_by(Character.views.desc(), Character.created_time.desc())
    else:
        query = query.order_by(Character.created_time.desc())
    
    total = query.count()
    characters = query.offset((page - 1) * page_size).limit(page_size).all()
    return CharacterListOut(items=characters, total=total, page=page, page_size=page_size, short=False)

@router.get("/api/characters-liked", response_model=CharacterListOut)
def get_user_liked_characters(
    sort: str = Query("recent"),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    if not current_user:
        return CharacterListOut(items=[], total=0, page=1, page_size=0, short=False)

    query = (
        db.query(Character)
        .join(UserLikedCharacter, UserLikedCharacter.character_id == Character.id)
        .filter(UserLikedCharacter.user_id == current_user.id, Character.is_public == True)
    )

    if sort == "popular":
        query = query.order_by(Character.views.desc(), Character.created_time.desc())
    else:
        query = query.order_by(Character.created_time.desc())

    total = query.count()
    characters = query.offset((page - 1) * page_size).limit(page_size).all()
    return CharacterListOut(items=characters, total=total, page=page, page_size=page_size, short=False)


@router.get("/api/user/{user_id}/characters", response_model=List[CharacterOut])
def get_user_characters(user_id: str, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    query = db.query(Character).filter(Character.creator_id == user_id)
    if not current_user or current_user.id != user_id:
        query = query.filter(Character.is_public == True)
    characters = query.all()
    return characters
