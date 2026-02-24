from sqlalchemy.orm import Session

from models import Character, CharacterPurchase


def has_character_purchase(db: Session, user_id: str, character_id: int) -> bool:
    if not user_id or not character_id:
        return False
    purchase = db.query(CharacterPurchase).filter(
        CharacterPurchase.user_id == user_id,
        CharacterPurchase.character_id == character_id
    ).first()
    return purchase is not None


def can_access_character(db: Session, user_id: str, character: Character) -> bool:
    if not character:
        return False
    if character.is_free:
        return True
    if user_id and character.creator_id == user_id:
        return True
    return has_character_purchase(db, user_id, character.id)
