from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session
from typing import Optional
from utils.session import get_current_user
from utils.llm_client import client
from utils.usage_utils import normalize_usage
from utils.token_usage_ledger import record_token_usage
from utils.token_cap import can_consume_tokens, build_token_cap_reached_payload
from database import get_db
from models import User
import json

router = APIRouter(tags=["character_assistant"])


class CharacterAssistantRequest(BaseModel):
    prompt: str
    current_character: Optional[dict] = None


class CharacterAssistantResponse(BaseModel):
    name: str
    persona: str
    tagline: str
    greeting: str
    sample_dialogue: str
    long_description: str = ""


ASSISTANT_FIELD_LIMITS = {
    "name": 50,
    "persona": 400,
    "tagline": 100,
    "greeting": 200,
    "sample_dialogue": 200,
    "advanced_long_description": 10000,
}


def _as_trimmed_text(value) -> str:
    if value is None:
        return ""
    return str(value).strip()


def _trim_to_limit(value: str, max_length: int) -> str:
    if max_length <= 0:
        return ""
    return value[:max_length]


def _sanitize_character_output(character_data: dict, context_label: str) -> dict:
    sanitized = {
        "name": _trim_to_limit(_as_trimmed_text(character_data.get("name")), ASSISTANT_FIELD_LIMITS["name"]),
        "persona": _trim_to_limit(_as_trimmed_text(character_data.get("persona")), ASSISTANT_FIELD_LIMITS["persona"]),
        "tagline": _trim_to_limit(_as_trimmed_text(character_data.get("tagline")), ASSISTANT_FIELD_LIMITS["tagline"]),
        "greeting": _trim_to_limit(_as_trimmed_text(character_data.get("greeting")), ASSISTANT_FIELD_LIMITS["greeting"]),
        "sample_dialogue": _trim_to_limit(_as_trimmed_text(character_data.get("sample_dialogue")), ASSISTANT_FIELD_LIMITS["sample_dialogue"]),
    }

    if context_label == "advanced":
        sanitized["long_description"] = _trim_to_limit(
            _as_trimmed_text(character_data.get("long_description")),
            ASSISTANT_FIELD_LIMITS["advanced_long_description"],
        )
    else:
        sanitized["long_description"] = ""

    return sanitized


def _normalize_context_label(value: Optional[str]) -> str:
    return "advanced" if value == "advanced" else "standard"


def _build_system_prompt(context_label: str) -> str:
    if context_label == "advanced":
        return """You are a creative character designer for a roleplay chat application.
Generate or refine character information based on the user's request and current character state.

IMPORTANT: Always respond in the same language as the user's prompt.

Current character mode: advanced.
This mode includes all basic fields plus an extended long-form setting field.

Editing behavior rules:
- If current character data is provided, treat this as an edit request by default.
- Keep unchanged fields consistent unless the user explicitly asks to rewrite them.
- Do NOT restart from scratch when existing context is present.
- Improve and extend details while preserving established character identity and tone.

Return ONLY a valid JSON object with these exact fields:
{
    "name": "Character's name (max 50 characters)",
    "persona": "Detailed character description including personality, background, speaking style, and behavior (max 400 characters)",
    "tagline": "A short, catchy tagline (max 100 characters)",
    "greeting": "The character's first message to the user (max 200 characters)",
    "sample_dialogue": "2-3 example conversation lines showing the character's tone (max 200 characters total), formatted as:\nYou: [user message]\nCharacter: [character response]",
    "long_description": "Detailed long-form character setting and lore for advanced mode (max 10000 characters)."
}

Hard limits (must never be exceeded):
- name <= 50 chars
- persona <= 400 chars
- tagline <= 100 chars
- greeting <= 200 chars
- sample_dialogue <= 200 chars total
- long_description <= 10000 chars

Make the character engaging, consistent, and appropriate. Be creative but stay true to the user's request and current character context."""

    return """You are a creative character designer for a roleplay chat application.
Generate or refine character information based on the user's request and current character state.

IMPORTANT: Always respond in the same language as the user's prompt.

Current character mode: standard.
This mode does NOT use long-form setting fields.

Editing behavior rules:
- If current character data is provided, treat this as an edit request by default.
- Keep unchanged fields consistent unless the user explicitly asks to rewrite them.
- Do NOT restart from scratch when existing context is present.
- Improve and extend details while preserving established character identity and tone.

Return ONLY a valid JSON object with these exact fields:
{
    "name": "Character's name (max 50 characters)",
    "persona": "Detailed character description including personality, background, speaking style, and behavior (max 400 characters)",
    "tagline": "A short, catchy tagline (max 100 characters)",
    "greeting": "The character's first message to the user (max 200 characters)",
    "sample_dialogue": "2-3 example conversation lines showing the character's tone (max 200 characters total), formatted as:\nYou: [user message]\nCharacter: [character response]",
    "long_description": ""
}

For standard mode, always keep long_description as an empty string.

Hard limits (must never be exceeded):
- name <= 50 chars
- persona <= 400 chars
- tagline <= 100 chars
- greeting <= 200 chars
- sample_dialogue <= 200 chars total
- long_description must be ""

Make the character engaging, consistent, and appropriate. Be creative but stay true to the user's request and current character context."""


@router.post("/api/character-assistant", response_model=CharacterAssistantResponse)
async def generate_character(
    request: CharacterAssistantRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Generate character details based on a user's prompt using AI.
    Returns structured character data for name, persona, tagline, greeting, sample dialogue, and long description.
    """
    if not request.prompt or not request.prompt.strip():
        raise HTTPException(status_code=400, detail="Prompt cannot be empty")

    context_label = _normalize_context_label((request.current_character or {}).get("context_label"))
    system_prompt = _build_system_prompt(context_label)

    token_check = can_consume_tokens(current_user, db)
    if token_check["blocked"]:
        raise HTTPException(status_code=429, detail=build_token_cap_reached_payload(token_check.get("limit") or {}))

    user_payload = {
        "user_request": request.prompt,
        "current_character": request.current_character or {},
        "context_label": context_label,
    }

    try:
        response = client.chat.completions.create(
            model="deepseek-chat",
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": json.dumps(user_payload, ensure_ascii=False)}
            ],
            max_tokens=1500,
            temperature=1.2,
            top_p=0.95
        )

        usage = normalize_usage(getattr(response, "usage", None))
        if usage["total_tokens"] > 0:
            record_token_usage(
                db,
                user_id=current_user.id,
                usage=usage,
            )
            db.commit()

        content = response.choices[0].message.content.strip()
        
        # Try to extract JSON from markdown code blocks if present
        if "```json" in content:
            content = content.split("```json")[1].split("```")[0].strip()
        elif "```" in content:
            content = content.split("```")[1].split("```")[0].strip()
        
        # Parse the JSON response
        character_data = json.loads(content)
        
        # Validate required fields
        required_fields = ["name", "persona", "tagline", "greeting", "sample_dialogue", "long_description"]
        for field in required_fields:
            if field not in character_data:
                raise ValueError(f"Missing required field: {field}")

        sanitized_data = _sanitize_character_output(character_data, context_label)

        return CharacterAssistantResponse(**sanitized_data)
    
    except json.JSONDecodeError as e:
        raise HTTPException(
            status_code=500, 
            detail=f"Failed to parse AI response. Please try again."
        )
    except Exception as e:
        raise HTTPException(
            status_code=500, 
            detail=f"Error generating character: {str(e)}"
        )
