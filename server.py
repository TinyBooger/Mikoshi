from fastapi import FastAPI, Request, Depends, HTTPException, Form,  UploadFile, File
from fastapi.responses import JSONResponse, FileResponse
from fastapi.staticfiles import StaticFiles
from huggingface_hub import InferenceClient
from sqlalchemy.orm import Session
from itsdangerous import URLSafeSerializer
import os

from database import SessionLocal, engine
from models import Base, Character, User
from schemas import UserCreate, UserLogin
from passlib.context import CryptContext
import shutil
import json

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

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

# ================Session Token====================
SECRET_KEY = os.getenv("SECRET_KEY")
serializer = URLSafeSerializer(SECRET_KEY)

def create_session_token(user):
    return serializer.dumps({"user_id": user.id})

def verify_session_token(token):
    try:
        data = serializer.loads(token)
        return data["user_id"]
    except:
        return None

@app.get("/")
async def root():
    return FileResponse("static/index.html")

@app.get("/chat")
async def chat_page():
    return FileResponse("static/chat.html")

# ========== Character APIs ==========

@app.get("/character-create")
async def character_create_page():
    return FileResponse("static/character_create.html")

@app.post("/api/create-character")
async def create_character(
    name: str = Form(...),
    persona: str = Form(...),
    sample_dialogue: str = Form(""),
    picture: UploadFile = File(None),
    db: Session = Depends(get_db),
    user: dict = Depends(get_current_user)
):
    if not user:
        raise HTTPException(status_code=401, detail="Unauthorized")

    existing = db.query(Character).filter(Character.name == name).first()
    if existing:
        return JSONResponse(content={"error": "Character already exists"}, status_code=400)

    messages = parse_sample_dialogue(sample_dialogue)

    # Save picture if provided
    pic_path = None
    if picture:
        ext = picture.filename.split(".")[-1]
        filename = f"char_{name}.{ext}"
        pic_path = f"static/uploads/{filename}"
        with open(pic_path, "wb") as f:
            shutil.copyfileobj(picture.file, f)

    # Create character with creator
    char = Character(
        name=name,
        persona=persona,
        example_messages=json.dumps(messages),
        creator_id=str(user["id"]),
        popularity=0,
        picture=pic_path
    )
    db.add(char)

    # Update user's character_created field
    db_user = db.query(User).filter(User.id == user["id"]).first()
    if db_user.character_created is None:
        db_user.character_created = []
    db_user.character_created.append(name)

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

# ===============Profile Page==================
@app.get("/profile")
def profile_page():
    return FileResponse("static/profile.html")

@app.post("/api/update-profile")
async def update_profile(
        request: Request,
        name: str = Form(...),
        profile_pic: UploadFile = File(None),
        db: Session = Depends(get_db)
    ):
        token = request.cookies.get("session_token")
        user_id = verify_session_token(token)
        if not user_id:
            raise HTTPException(status_code=401, detail="Not logged in")

        user = db.query(User).get(user_id)
        print("user_id:", user_id)
        print("user:", user)
        if name:
            user.name = name
        if profile_pic:
            user.profile_pic = profile_pic.filename  # Or save the file if needed
        db.commit()
        db.refresh(user)
        return {"message": "Profile updated"}

# ========== Auth APIs ==========

@app.post("/api/login")
async def login(user: UserLogin, db: Session = Depends(get_db)):
    db_user = db.query(User).filter(User.email == user.email).first()
    if not db_user or not pwd_context.verify(user.password, db_user.hashed_password):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    response = JSONResponse(content={"message": "Login successful"})
    response.set_cookie(
        key="session_token",
        value=create_session_token(db_user),
        httponly=True,
        secure=True,
        samesite="Lax"
    )
    return response

@app.post("/api/account-setup")
async def account_setup(
        email: str = Form(...),
        password: str = Form(...),
        name: str = Form(...),
        profile_pic: UploadFile = File(None),
        db: Session = Depends(get_db)
    ):
        existing = db.query(User).filter(User.email == email).first()
        if existing:
            raise HTTPException(status_code=400, detail="Email already registered")

        hashed = pwd_context.hash(password)

        # Optional: Save the file or store just the filename
        filename = profile_pic.filename if profile_pic else None

        db_user = User(
            email=email,
            hashed_password=hashed,
            name=name,
            profile_pic=filename
        )
        db.add(db_user)
        db.commit()
        return {"message": "Account created successfully"}

@app.get("/api/current-user")
def get_current_user(request: Request, db: Session = Depends(get_db)):
    token = request.cookies.get("session_token")
    user_id = verify_session_token(token)
    if not user_id:
        raise HTTPException(status_code=401, detail="Not logged in")
    user = db.query(User).filter(User.id == user_id).first()
    return {
        "id": user.id,
        "name": user.name,
        "profile_pic": user.profile_pic
    }

@app.post("/api/logout")
def logout():
    response = JSONResponse(content={"message": "Logged out"})
    response.delete_cookie("session_token")
    return response
