from fastapi import APIRouter, Request, Depends
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session
from database import get_db
from utils.session import get_current_user
from utils.llm_client import client

router = APIRouter()

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
