from fastapi import APIRouter, Request, Depends
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session
from database import get_db
from utils.session import get_current_user
from utils.llm_client import client
import uuid
from datetime import datetime, UTC

router = APIRouter()

def generate_chat_title(messages):
    """Generate a title from the first user message"""
    user_messages = [m for m in messages if m.get("role") == "user"]
    if user_messages:
        first_msg = user_messages[0].get("content", "")
        return first_msg[:30] + ("..." if len(first_msg) > 30 else "")
    return "New Chat"

@router.post("/api/chat")
async def chat(request: Request, db: Session = Depends(get_db)):
    user = get_current_user(request, db)
    data = await request.json()
    messages = data.get("messages")
    character_id = data.get("character_id")
    chat_id = data.get("chat_id")  # Will be None for new chats

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
        updated_messages = messages + [{"role": "assistant", "content": reply}]
        updated_messages = updated_messages[-5:]  # Keep last 5 messages

        new_entry = {
            "chat_id": chat_id if chat_id else str(uuid.uuid4()),  # Use existing or new ID
            "character_id": character_id,
            "title": generate_chat_title(messages),
            "messages": updated_messages,
            "last_updated": datetime.now(UTC),
            "created_at": datetime.now(UTC) if not chat_id else None  # Preserve original creation time
        }

        # Initialize if null
        if user.chat_history is None:
            user.chat_history = []
            db.add(user)  # Explicitly add to session if new
            db.flush()   # Ensure user is persisted

        if chat_id:
            # Update existing chat
            updated = False
            for i, chat in enumerate(user.chat_history):
                if chat.get("chat_id") == chat_id:
                    user.chat_history[i] = new_entry
                    updated = True
                    break
            
            if not updated:
                # If chat_id was provided but not found, treat as new chat
                user.chat_history.insert(0, new_entry)
        else:
            # Add new chat
            user.chat_history.insert(0, new_entry)
        
        # Trim to keep only the 30 most recent chats (across all characters)
        user.chat_history = user.chat_history[:30]
        db.add(user)  # Explicitly mark as modified
        db.commit()   # Commit the changes

        # Return the chat_id so frontend can track it
        return {
            "response": reply,
            "chat_id": new_entry["chat_id"],
            "chat_title": new_entry["title"]
        }

    return {"response": reply}