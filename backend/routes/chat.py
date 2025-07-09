from fastapi import APIRouter, Request, Depends
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session
from database import get_db
from utils.session import get_current_user
from utils.llm_client import client

router = APIRouter()

@router.post("/api/chat")
async def chat(request: Request, db: Session = Depends(get_db)):
    user = get_current_user(request, db)
    data = await request.json()
    messages = data.get("messages")
    character_id = data.get("character_id")

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
    except Exception:
        return JSONResponse(content={"error": "Server busy, please try again later."}, status_code=503)

    # Update chat history
    if character_id:
        from datetime import datetime

        updated_messages = messages + [{"role": "assistant", "content": reply}]
        updated_messages = updated_messages[-5:]  # Keep last 5 messages

        new_entry = {
            "character_id": character_id,
            "messages": updated_messages,
            "last_updated": datetime.utcnow().isoformat()
        }

        # Remove old entry for the character
        filtered = [h for h in user.chat_history if h["character_id"] != character_id]

        # Insert new one and trim to 30 entries
        filtered.insert(0, new_entry)
        filtered = filtered[:30]

        user.chat_history = filtered
        db.commit()

    return {"response": reply}

