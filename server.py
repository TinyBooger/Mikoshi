from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse, FileResponse
from fastapi.staticfiles import StaticFiles
from huggingface_hub import InferenceClient
import os
import json

app = FastAPI()
app.mount("/static", StaticFiles(directory="static"), name="static")

HF_TOKEN = os.getenv("HF_API_KEY")
client = InferenceClient(token=HF_TOKEN)

CHARACTERS_FILE = "characters.json"

def load_characters():
    if not os.path.exists(CHARACTERS_FILE):
        with open(CHARACTERS_FILE, "w") as f:
            json.dump({}, f)
    with open(CHARACTERS_FILE, "r") as f:
        return json.load(f)

def save_characters(characters):
    with open(CHARACTERS_FILE, "w") as f:
        json.dump(characters, f, indent=2)

@app.get("/")
async def root():
    return FileResponse("static/index.html")

@app.post("/api/create-character")
async def create_character(request: Request):
    data = await request.json()
    name = data.get("name")
    persona = data.get("persona")
    sample_dialogue = data.get("sample_dialogue", "")
    if not name or not persona:
        return JSONResponse(content={"error": "Missing name or persona"}, status_code=400)
    characters = load_characters()
    characters[name] = {
        "persona": persona,
        "sample_dialogue": sample_dialogue
    }
    save_characters(characters)
    return JSONResponse(content={"message": f"Character '{name}' created."})

@app.get("/api/characters")
async def get_characters():
    characters = load_characters()
    return JSONResponse(content=characters)

@app.post("/api/chat")
async def chat(request: Request):
    data = await request.json()
    character_name = data.get("character")
    user_input = data.get("message", "")
    characters = load_characters()
    character = characters.get(character_name)
    if not character:
        return JSONResponse(content={"error": "Character not found"}, status_code=404)
    persona = character["persona"]
    sample_dialogue = character.get("sample_dialogue", "")
    system_content = f"{persona}\n\nSample Conversation:\n{sample_dialogue}"
    response = client.chat_completion(
        model="mistralai/Mistral-7B-Instruct-v0.3",
        messages=[
            {"role": "system", "content": system_content},
            {"role": "user", "content": user_input}
        ],
        max_tokens=250,
        temperature=0.7,
        top_p=0.9
    )
    generated_text = response[0]['generated_text']
    reply = generated_text[len(prompt):].strip()
    return JSONResponse(content={"response": reply})
