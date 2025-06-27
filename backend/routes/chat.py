from fastapi import APIRouter, Request, Depends, HTTPException
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session
import json

from database import get_db
from models import Character
from utils.session import get_current_user
from utils.llm_client import client

router = APIRouter()

@router.post("/api/chat")
async def chat(request: Request, db: Session = Depends(get_db)):
    get_current_user(request, db)
    data = await request.json()
    character_id = data.get("character_id")
    user_input = data.get("message", "")

    character = db.query(Character).filter(Character.id == character_id).first()
    if not character:
        return JSONResponse(content={"error": "Character not found"}, status_code=404)

    persona = character.persona
    example_messages = json.loads(character.example_messages) if character.example_messages else []
    messages = [{"role": "system", "content": persona}] + example_messages
    messages.append({"role": "user", "content": user_input})

    response = client.chat_completion(
        model="mistralai/Mistral-7B-Instruct-v0.3",
        messages=messages,
        max_tokens=250,
        temperature=0.7,
        top_p=0.9
    )
    reply = response["choices"][0]["message"]["content"].strip()
    return {"response": reply}
