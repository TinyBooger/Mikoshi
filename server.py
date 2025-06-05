from fastapi import FastAPI, Request, Depends
from fastapi.responses import JSONResponse, FileResponse
from fastapi.staticfiles import StaticFiles
from huggingface_hub import InferenceClient
from sqlalchemy.orm import Session
import os
from database import SessionLocal, engine
from models import Base, Character
import json

app = FastAPI()
app.mount("/static", StaticFiles(directory="static"), name="static")

HF_TOKEN = os.getenv("HF_API_KEY")
client = InferenceClient(token=HF_TOKEN)

# Create tables
Base.metadata.create_all(bind=engine)

# Dependency for DB session
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

def parse_sample_dialogue(text):
    lines = text.strip().splitlines()
    messages = []
    for line in lines:
        if line.startswith("<user>:"):
            messages.append({"role": "user", "content": line[len("<user>:"):].strip()})
        elif line.startswith("<bot>:"):
            messages.append({"role": "assistant", "content": line[len("<bot>:"):].strip()})
    return messages

@app.get("/")
async def root():
    return FileResponse("static/index.html")

@app.get("/chat")
async def chat_page():
    return FileResponse("static/chat.html")

@app.post("/api/create-character")
async def create_character(request: Request, db: Session = Depends(get_db)):
    data = await request.json()
    name = data.get("name")
    persona = data.get("persona")
    sample_dialogue = data.get("sample_dialogue", "")  # Now treated as raw text

    if not name or not persona:
        return JSONResponse(content={"error": "Missing name or persona"}, status_code=400)

    # Check if character exists
    existing = db.query(Character).filter(Character.name == name).first()
    if existing:
        return JSONResponse(content={"error": "Character already exists"}, status_code=400)

    # Parse sample dialogue
    example_messages = parse_sample_dialogue(sample_dialogue)

    # Save to DB
    char = Character(
        name=name,
        persona=persona,
        example_messages=json.dumps(example_messages)
    )
    db.add(char)
    db.commit()
    return JSONResponse(content={"message": f"Character '{name}' created."})

@app.get("/api/characters")
async def get_characters(db: Session = Depends(get_db)):
    chars = db.query(Character).all()
    result = {}
    for c in chars:
        result[c.name] = {
            "persona": c.persona,
            "example_messages": json.loads(c.example_messages)
        }
    return JSONResponse(content=result)

@app.post("/api/chat")
async def chat(request: Request, db: Session = Depends(get_db)):
    data = await request.json()
    character_name = data.get("character")
    user_input = data.get("message", "")
    character = db.query(Character).filter(Character.name == character_name).first()
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
    return JSONResponse(content={"response": reply})
