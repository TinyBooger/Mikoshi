from fastapi import APIRouter, Request, Depends
from fastapi.responses import JSONResponse, StreamingResponse
from sqlalchemy.orm import Session
from database import get_db
from utils.session import get_current_user
from utils.llm_client import client, stream_chat_completion
import uuid
import json
from datetime import datetime, UTC
from models import User

router = APIRouter()

def generate_chat_title(messages, existing_title=None):
    """Generate a title from the first user message if no title exists"""
    if existing_title:
        return existing_title
    user_messages = [m for m in messages if m.get("role") == "user"]
    if user_messages:
        first_msg = user_messages[0].get("content", "")
        return first_msg[:30] + ("..." if len(first_msg) > 30 else "")
    return "New Chat"

@router.post("/api/chat")
async def chat(request: Request, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    data = await request.json()
    messages = data.get("messages")
    character_id = data.get("character_id")
    chat_id = data.get("chat_id")
    scene_id = data.get("scene_id")
    persona_id = data.get("persona_id")
    stream = data.get("stream", True)  # Default to streaming

    if not messages or not isinstance(messages, list):
        return JSONResponse(content={"error": "Invalid or missing messages"}, status_code=400)

    # Get existing title if this is an existing chat
    existing_title = None
    if chat_id and current_user.chat_history:
        for chat in current_user.chat_history:
            if chat.get("chat_id") == chat_id:
                existing_title = chat.get("title")
                break

    # Generate chat_id upfront for new chats
    if not chat_id and character_id:
        chat_id = str(uuid.uuid4())

    if stream:
        # Return streaming response
        async def generate():
            accumulated_reply = ""
            try:
                for chunk in stream_chat_completion(messages):
                    accumulated_reply += chunk
                    # Send each chunk as SSE
                    yield f"data: {json.dumps({'chunk': chunk})}\n\n"
                
                # After streaming completes, save to database
                if character_id:
                    updated_messages = messages + [{"role": "assistant", "content": accumulated_reply}]
                    updated_messages = updated_messages[-50:]

                    new_entry = {
                        "chat_id": chat_id,
                        "character_id": character_id,
                        "title": generate_chat_title(messages, existing_title),
                        "messages": updated_messages,
                        "last_updated": datetime.now(UTC).isoformat(),
                        "created_at": datetime.now(UTC).isoformat() if not existing_title else None
                    }
                    if scene_id:
                        new_entry["scene_id"] = scene_id
                    if persona_id:
                        new_entry["persona_id"] = persona_id

                    filtered = [h for h in (current_user.chat_history or []) if h.get("chat_id") != chat_id]
                    filtered.insert(0, new_entry)
                    current_user.chat_history = filtered[:30]
                    db.commit()

                # Send final metadata
                yield f"data: {json.dumps({'done': True, 'chat_id': chat_id, 'chat_title': generate_chat_title(messages, existing_title)})}\n\n"
            
            except Exception as e:
                yield f"data: {json.dumps({'error': str(e)})}\n\n"

        return StreamingResponse(generate(), media_type="text/event-stream")
    
    else:
        # Non-streaming fallback (original logic)
        try:
            response = client.chat.completions.create(
                model="deepseek-chat",
                messages=messages,
                max_tokens=250,
                temperature=1.3,
                top_p=0.9
            )
            reply = response.choices[0].message.content.strip()
        except Exception:
            return JSONResponse(content={"error": "Server busy, please try again later."}, status_code=503)

        # Update chat history
        if character_id:
            updated_messages = messages + [{"role": "assistant", "content": reply}]
            updated_messages = updated_messages[-50:]

            new_entry = {
                "chat_id": chat_id,
                "character_id": character_id,
                "title": generate_chat_title(messages, existing_title),
                "messages": updated_messages,
                "last_updated": datetime.now(UTC).isoformat(),
                "created_at": datetime.now(UTC).isoformat() if not existing_title else None
            }
            if scene_id:
                new_entry["scene_id"] = scene_id
            if persona_id:
                new_entry["persona_id"] = persona_id

            filtered = [h for h in (current_user.chat_history or []) if h.get("chat_id") != chat_id]
            
            filtered.insert(0, new_entry)
            current_user.chat_history = filtered[:30]
            db.commit()

            return {
                "response": reply,
                "chat_id": new_entry["chat_id"],
                "chat_title": new_entry["title"]
            }

        return {"response": reply}

@router.post("/api/chat/rename")
async def rename_chat(request: Request, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    data = await request.json()
    chat_id = data.get("chat_id")
    new_title = data.get("new_title")

    if not chat_id or not new_title:
        return JSONResponse(content={"error": "Missing chat_id or new_title"}, status_code=400)

    if current_user.chat_history:
        # Create a new list to force SQLAlchemy to detect changes
        updated_history = []
        modified = False
        
        for chat in current_user.chat_history:
            if chat.get("chat_id") == chat_id:
                # Create a new dict instead of modifying in-place
                updated_chat = dict(chat)
                updated_chat["title"] = new_title
                updated_chat["last_updated"] = datetime.now(UTC).isoformat()
                updated_history.append(updated_chat)
                modified = True
            else:
                updated_history.append(chat)
        
        if modified:
            # Assign the new list to trigger change detection
            current_user.chat_history = updated_history
            db.add(current_user)  # Explicitly mark as modified
            db.commit()
            return {"status": "success"}
    
    return JSONResponse(content={"error": "Chat not found"}, status_code=404)

@router.post("/api/chat/delete")
async def delete_chat(request: Request, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    data = await request.json()
    chat_id = data.get("chat_id")

    if not chat_id:
        return JSONResponse(content={"error": "Missing chat_id"}, status_code=400)

    if current_user.chat_history:
        current_user.chat_history = [chat for chat in current_user.chat_history if chat.get("chat_id") != chat_id]
        db.commit()
        return {"status": "success"}
    
    return JSONResponse(content={"error": "Chat not found"}, status_code=404)