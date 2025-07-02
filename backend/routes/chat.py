from fastapi import APIRouter, Request, Depends
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session
from database import get_db
from models import Character
from utils.session import get_current_user
from utils.llm_client import client
from utils.chat_utils import parse_sample_dialogue

router = APIRouter()

@router.post("/api/chat-greeting")
async def chat_greeting(request: Request, db: Session = Depends(get_db)):
    get_current_user(request, db)
    data = await request.json()
    character_id = data.get("character_id")

    if not character_id:
        return JSONResponse(content={"error": "Missing character_id"}, status_code=400)

    character = db.query(Character).filter(Character.id == character_id).first()
    if not character:
        return JSONResponse(content={"error": "Character not found"}, status_code=404)

    example_messages = parse_sample_dialogue(character.example_messages)
    messages = [{"role": "system", "content": character.persona}] + example_messages
    if character.greeting:
        messages.append({"role": "assistant", "content": character.greeting})

    try:
        response = client.chat_completion(
            model="mistralai/Mistral-7B-Instruct-v0.3",
            messages=messages,
            max_tokens=250,
            temperature=0.7,
            top_p=0.9
        )
        reply = response["choices"][0]["message"]["content"].strip()
        return {"greeting": reply}
    except Exception:
        return JSONResponse(content={"error": "Server busy, please try again later."}, status_code=503)


@router.post("/api/chat")
async def chat(request: Request, db: Session = Depends(get_db)):
    get_current_user(request, db)
    data = await request.json()
    messages = data.get("messages")

    if not messages or not isinstance(messages, list):
        return JSONResponse(content={"error": "Invalid or missing messages"}, status_code=400)

    try:
        response = client.chat_completion(
            model="mistralai/Mistral-7B-Instruct-v0.3",
            messages=messages,
            max_tokens=250,
            temperature=0.7,
            top_p=0.9
        )
        reply = response["choices"][0]["message"]["content"].strip()
        return {"response": reply}
    except Exception:
        return JSONResponse(content={"error": "Server busy, please try again later."}, status_code=503)
