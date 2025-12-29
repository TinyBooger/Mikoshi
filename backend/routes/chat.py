from fastapi import APIRouter, Request, Depends
from fastapi.responses import JSONResponse, StreamingResponse
from sqlalchemy.orm import Session
from database import get_db
from utils.session import get_current_user
from utils.llm_client import client, stream_chat_completion
from utils.chat_history_utils import fetch_chat_history_entry, upsert_chat_history_entry, serialize_chat_history_entry
import uuid
import json
from datetime import datetime, UTC
from models import User, Character, Scene, ChatHistory
from utils.level_system import award_exp_with_limits

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

    # Award daily chat EXP (handled by centralized function with limits)
    exp_result = award_exp_with_limits(current_user, "daily_chat", db)

    # Get existing chat info if this is an existing chat
    existing_entry = None
    if chat_id:
        existing_entry = fetch_chat_history_entry(db, current_user.id, chat_id)

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
                    # Create new DB session for generator context
                    from database import SessionLocal
                    db_session = SessionLocal()
                    try:
                        updated_messages = messages + [{"role": "assistant", "content": accumulated_reply}]
                        updated_messages = updated_messages[-50:]

                        # Fetch character details for sidebar display
                        character = db_session.query(Character).filter(Character.id == character_id).first()

                        payload = {
                            "character_id": character_id,
                            "character_name": character.name if character else None,
                            "character_picture": character.picture if character else None,
                            "title": generate_chat_title(messages, existing_entry.title if existing_entry else None),
                            "messages": updated_messages,
                            "last_updated": datetime.now(UTC),
                            "created_at": existing_entry.created_at if existing_entry else datetime.now(UTC),
                        }
                        if scene_id:
                            payload["scene_id"] = scene_id
                            # Fetch scene details for sidebar display
                            scene = db_session.query(Scene).filter(Scene.id == scene_id).first()
                            if scene:
                                payload["scene_name"] = scene.name
                                payload["scene_picture"] = scene.picture
                        if persona_id:
                            payload["persona_id"] = persona_id

                        entry = upsert_chat_history_entry(
                            db_session,
                            user_id=current_user.id,
                            chat_id=chat_id,
                            payload=payload,
                        )
                    finally:
                        db_session.close()

                # Send final metadata
                yield f"data: {json.dumps({'done': True, 'chat_id': chat_id, 'chat_title': generate_chat_title(messages, existing_entry.title if existing_entry else None)})}\n\n"
            
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

            # Fetch character details for sidebar display
            character = db.query(Character).filter(Character.id == character_id).first()

            payload = {
                "character_id": character_id,
                "character_name": character.name if character else None,
                "character_picture": character.picture if character else None,
                "title": generate_chat_title(messages, existing_entry.title if existing_entry else None),
                "messages": updated_messages,
                "last_updated": datetime.now(UTC),
                "created_at": existing_entry.created_at if existing_entry else datetime.now(UTC),
            }
            if scene_id:
                payload["scene_id"] = scene_id
                # Fetch scene details for sidebar display
                scene = db.query(Scene).filter(Scene.id == scene_id).first()
                if scene:
                    payload["scene_name"] = scene.name
                    payload["scene_picture"] = scene.picture
            if persona_id:
                payload["persona_id"] = persona_id

            entry = upsert_chat_history_entry(
                db,
                user_id=current_user.id,
                chat_id=chat_id,
                payload=payload,
            )

            return {
                "response": reply,
                "chat_id": entry.chat_id,
                "chat_title": entry.title
            }

        return {"response": reply}

@router.post("/api/chat/rename")
async def rename_chat(request: Request, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    data = await request.json()
    chat_id = data.get("chat_id")
    new_title = data.get("new_title")

    if not chat_id or not new_title:
        return JSONResponse(content={"error": "Missing chat_id or new_title"}, status_code=400)

    entry = fetch_chat_history_entry(db, current_user.id, chat_id)
    if not entry:
        return JSONResponse(content={"error": "Chat not found"}, status_code=404)

    entry.title = new_title
    entry.last_updated = datetime.now(UTC)
    db.commit()
    return {"status": "success"}

@router.post("/api/chat/delete")
async def delete_chat(request: Request, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    data = await request.json()
    chat_id = data.get("chat_id")

    if not chat_id:
        return JSONResponse(content={"error": "Missing chat_id"}, status_code=400)

    entry = fetch_chat_history_entry(db, current_user.id, chat_id)
    if not entry:
        return JSONResponse(content={"error": "Chat not found"}, status_code=404)

    db.delete(entry)
    db.commit()
    return {"status": "success"}