from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session
from utils.session import get_current_user
from utils.llm_client import client
from database import get_db
from models import User
import json

router = APIRouter(tags=["character_assistant"])


class CharacterAssistantRequest(BaseModel):
    prompt: str


class CharacterAssistantResponse(BaseModel):
    name: str
    persona: str
    tagline: str
    greeting: str
    sample_dialogue: str


@router.post("/api/character-assistant", response_model=CharacterAssistantResponse)
async def generate_character(
    request: CharacterAssistantRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Generate character details based on a user's prompt using AI.
    Returns structured character data for name, persona, tagline, greeting, and sample dialogue.
    """
    if not request.prompt or not request.prompt.strip():
        raise HTTPException(status_code=400, detail="Prompt cannot be empty")

    system_prompt = """You are a creative character designer for a roleplay chat application. 
Generate detailed character information based on the user's request.

IMPORTANT: Always respond in the same language as the user's prompt.

Return ONLY a valid JSON object with these exact fields:
{
    "name": "Character's name",
    "persona": "Detailed character description including personality, background, speaking style, and behavior (200-800 characters)",
    "tagline": "A short, catchy tagline (under 100 characters)",
    "greeting": "The character's first message to the user (under 200 characters)",
    "sample_dialogue": "2-3 example conversation lines showing the character's tone, formatted as:\\nYou: [user message]\\nCharacter: [character response]"
}

Make the character engaging, consistent, and appropriate. Be creative but stay true to the user's request."""

    try:
        response = client.chat.completions.create(
            model="deepseek-chat",
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": request.prompt}
            ],
            max_tokens=1500,
            temperature=1.2,
            top_p=0.95
        )

        content = response.choices[0].message.content.strip()
        
        # Try to extract JSON from markdown code blocks if present
        if "```json" in content:
            content = content.split("```json")[1].split("```")[0].strip()
        elif "```" in content:
            content = content.split("```")[1].split("```")[0].strip()
        
        # Parse the JSON response
        character_data = json.loads(content)
        
        # Validate required fields
        required_fields = ["name", "persona", "tagline", "greeting", "sample_dialogue"]
        for field in required_fields:
            if field not in character_data:
                raise ValueError(f"Missing required field: {field}")
        
        return CharacterAssistantResponse(**character_data)
    
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
