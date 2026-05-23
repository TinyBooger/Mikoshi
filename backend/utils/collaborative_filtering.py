"""
User-user collaborative filtering for BrowsePage recommendations.

Signals:
  - Characters: explicit likes (weight 1.0) + implicit chat-history starts (weight 0.5)
  - Scenes:     explicit likes only (weight 1.0)
  - Personas:   explicit likes only (weight 1.0)

Cold-start fallback (no CF candidates found): time-decay popularity score
  (views + likes * 3) / (days_since_created + 2)
"""

from typing import Optional
from sqlalchemy.orm import Session
from sqlalchemy import func, text

from models import Character, Scene, Persona, User

# ── Tunable constants ─────────────────────────────────────────────────────────
SIMILAR_USER_LIMIT = 100   # how many "nearest neighbours" to consider
MAX_CF_CANDIDATES  = 500   # cap on candidate pool before pagination
# ─────────────────────────────────────────────────────────────────────────────

# ---------- pre-compiled SQL templates ----------

_CHAR_CF_SQL = text("""
WITH user_interactions AS (
    SELECT user_id, character_id, 1.0 AS weight
      FROM user_liked_characters
     UNION ALL
    SELECT user_id, character_id, 0.5 AS weight
      FROM chat_histories
     WHERE character_id IS NOT NULL
),
user_item_weights AS (
    SELECT user_id, character_id, MAX(weight) AS weight
      FROM user_interactions
     GROUP BY user_id, character_id
),
target_items AS (
    SELECT character_id
      FROM user_item_weights
     WHERE user_id = :user_id
),
similar_users AS (
    SELECT uiw.user_id, SUM(uiw.weight) AS similarity
      FROM user_item_weights uiw
     WHERE uiw.character_id IN (SELECT character_id FROM target_items)
       AND uiw.user_id != :user_id
     GROUP BY uiw.user_id
     ORDER BY similarity DESC
     LIMIT :similar_user_limit
),
candidate_scores AS (
    SELECT uiw.character_id, SUM(su.similarity * uiw.weight) AS cf_score
      FROM user_item_weights uiw
      JOIN similar_users su ON uiw.user_id = su.user_id
     WHERE uiw.character_id NOT IN (SELECT character_id FROM target_items)
     GROUP BY uiw.character_id
)
SELECT c.id, cs.cf_score
  FROM characters c
  JOIN candidate_scores cs ON c.id = cs.character_id
 WHERE c.is_public = TRUE
   AND (c.moderation_status IS NULL OR c.moderation_status != 'takedown')
 ORDER BY cs.cf_score DESC, c.views DESC
 LIMIT :max_candidates
""")

_SCENE_CF_SQL = text("""
WITH target_items AS (
    SELECT scene_id
      FROM user_liked_scenes
     WHERE user_id = :user_id
),
similar_users AS (
    SELECT uls.user_id, COUNT(*) AS similarity
      FROM user_liked_scenes uls
     WHERE uls.scene_id IN (SELECT scene_id FROM target_items)
       AND uls.user_id != :user_id
     GROUP BY uls.user_id
     ORDER BY similarity DESC
     LIMIT :similar_user_limit
),
candidate_scores AS (
    SELECT uls.scene_id, SUM(CAST(su.similarity AS FLOAT)) AS cf_score
      FROM user_liked_scenes uls
      JOIN similar_users su ON uls.user_id = su.user_id
     WHERE uls.scene_id NOT IN (SELECT scene_id FROM target_items)
     GROUP BY uls.scene_id
)
SELECT s.id, cs.cf_score
  FROM scenes s
  JOIN candidate_scores cs ON s.id = cs.scene_id
 WHERE s.is_public = TRUE
   AND (s.moderation_status IS NULL OR s.moderation_status != 'takedown')
 ORDER BY cs.cf_score DESC, s.views DESC
 LIMIT :max_candidates
""")

_PERSONA_CF_SQL = text("""
WITH target_items AS (
    SELECT persona_id
      FROM user_liked_personas
     WHERE user_id = :user_id
),
similar_users AS (
    SELECT ulp.user_id, COUNT(*) AS similarity
      FROM user_liked_personas ulp
     WHERE ulp.persona_id IN (SELECT persona_id FROM target_items)
       AND ulp.user_id != :user_id
     GROUP BY ulp.user_id
     ORDER BY similarity DESC
     LIMIT :similar_user_limit
),
candidate_scores AS (
    SELECT ulp.persona_id, SUM(CAST(su.similarity AS FLOAT)) AS cf_score
      FROM user_liked_personas ulp
      JOIN similar_users su ON ulp.user_id = su.user_id
     WHERE ulp.persona_id NOT IN (SELECT persona_id FROM target_items)
     GROUP BY ulp.persona_id
)
SELECT p.id, cs.cf_score
  FROM personas p
  JOIN candidate_scores cs ON p.id = cs.persona_id
 WHERE p.is_public = TRUE
   AND (p.moderation_status IS NULL OR p.moderation_status != 'takedown')
 ORDER BY cs.cf_score DESC, p.views DESC
 LIMIT :max_candidates
""")

# ---------- helpers ----------

def _paginate_rows(rows: list, page: int, page_size: int, short: bool) -> list:
    if short:
        return rows[:10]
    offset = (page - 1) * page_size
    return rows[offset : offset + page_size]


def _popular_order(model):
    """Time-decay popularity expression shared across fallbacks."""
    return (
        (model.views + model.likes * 3)
        / (func.extract("epoch", func.now() - model.created_time) / 86400.0 + 2)
    ).desc()


# ---------- characters ----------

def get_cf_characters(
    db: Session,
    user_id: str,
    page: int,
    page_size: int,
    short: bool,
) -> tuple[list, int]:
    """
    Returns (items: list[Character ORM], total: int).
    Falls back to time-decay popular when no CF candidates exist.
    """
    rows = db.execute(
        _CHAR_CF_SQL,
        {
            "user_id": user_id,
            "similar_user_limit": SIMILAR_USER_LIMIT,
            "max_candidates": MAX_CF_CANDIDATES,
        },
    ).fetchall()

    if not rows:
        return _fallback_characters(db, page, page_size, short)

    total = len(rows)
    page_rows = _paginate_rows(rows, page, page_size, short)
    char_ids = [r[0] for r in page_rows]

    orm_rows = (
        db.query(Character, User.profile_pic.label("creator_profile_pic"))
        .outerjoin(User, Character.creator_id == User.id)
        .filter(Character.id.in_(char_ids))
        .all()
    )
    char_map = {char.id: (char, cp) for char, cp in orm_rows}

    items = []
    for cid in char_ids:
        if cid in char_map:
            char, cp = char_map[cid]
            char.creator_profile_pic = cp
            items.append(char)
    return items, total


def _fallback_characters(db: Session, page: int, page_size: int, short: bool) -> tuple[list, int]:
    base = (
        db.query(Character, User.profile_pic.label("creator_profile_pic"))
        .outerjoin(User, Character.creator_id == User.id)
        .filter(Character.is_public == True)
        .order_by(_popular_order(Character))
    )
    total = base.count()
    limit = 10 if short else page_size
    offset = 0 if short else (page - 1) * page_size
    items = []
    for char, cp in base.offset(offset).limit(limit).all():
        char.creator_profile_pic = cp
        items.append(char)
    return items, total


# ---------- scenes ----------

def get_cf_scenes(
    db: Session,
    user_id: str,
    page: int,
    page_size: int,
    short: bool,
) -> tuple[list, int]:
    """
    Returns (items: list[Scene ORM], total: int).
    Falls back to time-decay popular when no CF candidates exist.
    """
    rows = db.execute(
        _SCENE_CF_SQL,
        {
            "user_id": user_id,
            "similar_user_limit": SIMILAR_USER_LIMIT,
            "max_candidates": MAX_CF_CANDIDATES,
        },
    ).fetchall()

    if not rows:
        return _fallback_scenes(db, page, page_size, short)

    total = len(rows)
    page_rows = _paginate_rows(rows, page, page_size, short)
    scene_ids = [r[0] for r in page_rows]

    orm_rows = (
        db.query(Scene, User.profile_pic.label("creator_profile_pic"))
        .outerjoin(User, Scene.creator_id == User.id)
        .filter(Scene.id.in_(scene_ids))
        .all()
    )
    scene_map = {scene.id: (scene, cp) for scene, cp in orm_rows}

    items = []
    for sid in scene_ids:
        if sid in scene_map:
            scene, cp = scene_map[sid]
            scene.creator_profile_pic = cp
            items.append(scene)
    return items, total


def _fallback_scenes(db: Session, page: int, page_size: int, short: bool) -> tuple[list, int]:
    base = (
        db.query(Scene, User.profile_pic.label("creator_profile_pic"))
        .outerjoin(User, Scene.creator_id == User.id)
        .filter(Scene.is_public == True)
        .order_by(_popular_order(Scene))
    )
    total = base.count()
    limit = 10 if short else page_size
    offset = 0 if short else (page - 1) * page_size
    items = []
    for scene, cp in base.offset(offset).limit(limit).all():
        scene.creator_profile_pic = cp
        items.append(scene)
    return items, total


# ---------- personas ----------

def get_cf_personas(
    db: Session,
    user_id: Optional[str],
    page: int,
    page_size: int,
    short: bool,
) -> tuple[list, int]:
    """
    Returns (items: list[Persona ORM], total: int).
    Accepts user_id=None (unauthenticated) and falls back to popular.
    """
    if not user_id:
        return _fallback_personas(db, page, page_size, short)

    rows = db.execute(
        _PERSONA_CF_SQL,
        {
            "user_id": user_id,
            "similar_user_limit": SIMILAR_USER_LIMIT,
            "max_candidates": MAX_CF_CANDIDATES,
        },
    ).fetchall()

    if not rows:
        return _fallback_personas(db, page, page_size, short)

    total = len(rows)
    page_rows = _paginate_rows(rows, page, page_size, short)
    persona_ids = [r[0] for r in page_rows]

    orm_rows = (
        db.query(Persona, User.profile_pic.label("creator_profile_pic"))
        .outerjoin(User, Persona.creator_id == User.id)
        .filter(Persona.id.in_(persona_ids))
        .all()
    )
    persona_map = {persona.id: (persona, cp) for persona, cp in orm_rows}

    items = []
    for pid in persona_ids:
        if pid in persona_map:
            persona, cp = persona_map[pid]
            persona.creator_profile_pic = cp
            items.append(persona)
    return items, total


def _fallback_personas(db: Session, page: int, page_size: int, short: bool) -> tuple[list, int]:
    base = (
        db.query(Persona, User.profile_pic.label("creator_profile_pic"))
        .outerjoin(User, Persona.creator_id == User.id)
        .filter(Persona.is_public == True)
        .order_by(_popular_order(Persona))
    )
    total = base.count()
    limit = 10 if short else page_size
    offset = 0 if short else (page - 1) * page_size
    items = []
    for persona, cp in base.offset(offset).limit(limit).all():
        persona.creator_profile_pic = cp
        items.append(persona)
    return items, total
