from fastapi import FastAPI, Request, Depends, HTTPException, Form,  UploadFile, File
from fastapi.responses import JSONResponse, FileResponse, RedirectResponse
from fastapi.staticfiles import StaticFiles
from huggingface_hub import InferenceClient
from sqlalchemy.orm import Session
from itsdangerous import URLSafeSerializer
import os

from database import SessionLocal, engine
from models import Base, Character, User
from schemas import UserCreate, UserLogin
from passlib.context import CryptContext
from datetime import datetime
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

def get_current_user(request: Request, db: Session):
    user_id = request.session.get("user_id")
    if not user_id:
        raise HTTPException(status_code=401, detail="Not logged in")
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user

# ============================= Login Check =============================
@app.middleware("http")
async def require_login(request: Request, call_next):
    # Check session cookie or auth
    user = get_current_user()
    if not user:
        return RedirectResponse(url="/static/index.html")  # Your welcome/login page

    return await call_next(request)

# ============================= User =================================
@app.get("/api/user/{user_id}")
def get_user_by_id(user_id: int, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return {
        "id": user.id,
        "name": user.name,
        "profile_pic": user.profile_pic,
    }

@app.get("/api/user/{user_id}/characters")
def get_user_characters(user_id: int, db: Session = Depends(get_db)):
    characters = db.query(Character).filter(Character.creator_id == user_id).all()
    return [
        {
            "id": c.id,
            "name": c.name,
            "picture": c.avatar_url
        }
        for c in characters
    ]

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

# ========== Character APIs ==========

@app.get("/character-create")
async def character_create_page():
    return FileResponse("static/character_create.html")

@app.post("/api/create-character")
async def create_character(
    request: Request,
    name: str = Form(...),
    persona: str = Form(...),
    sample_dialogue: str = Form(""),
    picture: UploadFile = File(None),
    db: Session = Depends(get_db)
):
    # Get user from session
    token = request.cookies.get("session_token")
    user_id = verify_session_token(token)
    if not user_id:
        raise HTTPException(status_code=401, detail="Unauthorized")

    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    # Check if character already exists
    existing = db.query(Character).filter(Character.name == name).first()
    if existing:
        return JSONResponse(content={"error": "Character already exists"}, status_code=400)

    # Parse sample dialogue
    messages = parse_sample_dialogue(sample_dialogue)

    # Save picture if provided
    pic_path = None
    if picture:
        ext = picture.filename.split(".")[-1]
        filename = f"char_{name}.{ext}"
        pic_path = f"static/uploads/{filename}"
        with open(pic_path, "wb") as f:
            shutil.copyfileobj(picture.file, f)

    # Create and save character
    char = Character(
        name=name,
        persona=persona,
        example_messages=json.dumps(messages),
        creator_id=str(user_id),
        views=0,
        picture=pic_path
    )
    db.add(char)

    # Update user's characters_created list
    if user.characters_created is None:
        user.characters_created = []
    db.commit()  # Commit first to get char.id
    db.refresh(char)
    user.characters_created.append(str(char.id))

    db.commit()
    return JSONResponse(content={"message": f"Character '{name}' created."})

@app.get("/api/characters")
async def get_characters(db: Session = Depends(get_db)):
    chars = db.query(Character).all()
    result = {}
    for c in chars:
        result[c.id] = {
            "name": c.name,
            "persona": c.persona,
            "example_messages": json.loads(c.example_messages),
            "creator_id": c.creator_id
        }
    return JSONResponse(content=result)

@app.get("/api/character/{character_id}")
def get_character(character_id: int, db: Session = Depends(get_db)):
    c = db.query(Character).filter(Character.id == character_id).first()
    if not c:
        raise HTTPException(status_code=404, detail="Character not found")
    return {
        "id": c.id,
        "name": c.name,
        "persona": c.persona,
        "example_messages": json.loads(c.example_messages),
        "creator_id": c.creator_id,
        "likes": c.likes,
        "views": c.views,
        "created_time": c.created_time
    }

@app.post("/api/character/{character_id}/like")
def like_character(character_id: int, db: Session = Depends(get_db)):
    char = db.query(Character).filter(Character.id == character_id).first()
    if not char:
        raise HTTPException(status_code=404, detail="Character not found")

    char.likes += 1
    db.commit()
    return JSONResponse(content={"likes": char.likes})

# @app.get("/api/my-characters")
# async def get_my_characters(request: Request, db: Session = Depends(get_db)):
#     token = request.cookies.get("session_token")
#     user_id = verify_session_token(token)
#     if not user_id:
#         raise HTTPException(status_code=401, detail="Not logged in")

#     user = db.query(User).filter(User.id == user_id).first()
#     if not user or not user.characters_created:
#         return []

#     characters = db.query(Character).filter(Character.id.in_(user.characters_created)).all()
#     print("Characters found:", [c.name for c in characters])
#     return [{"id": c.id, "name": c.name, "picture": c.picture} for c in characters]

@app.post("/api/recent-characters/update")
async def update_recent_characters(request: Request, db: Session = Depends(get_db)):
    token = request.cookies.get("session_token")
    user_id = verify_session_token(token)
    if not user_id:
        raise HTTPException(status_code=401, detail="Not logged in")

    data = await request.json()
    char_id = data.get("character_id")
    if not char_id:
        raise HTTPException(status_code=400, detail="Missing character_id")

    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    now_str = datetime.utcnow().isoformat()
    recent = user.recent_characters or []

    # Remove existing entry for this character
    recent = [entry for entry in recent if entry.get("id") != char_id]

    # Insert new entry at front
    recent.insert(0, {"id": char_id, "timestamp": now_str})

    # Limit to last 10 entries (optional)
    user.recent_characters = recent[:10]

    db.commit()
    return {"status": "success"}

@app.get("/api/recent-characters")
async def get_recent_characters(request: Request, db: Session = Depends(get_db)):
    token = request.cookies.get("session_token")
    user_id = verify_session_token(token)
    if not user_id:
        # Return empty list if not logged in
        return []

    user = db.query(User).filter(User.id == user_id).first()
    if not user or not user.recent_characters:
        return []

    recent = user.recent_characters
    # Extract character IDs maintaining order
    char_ids = [entry["id"] for entry in recent]

    characters = db.query(Character).filter(Character.id.in_(char_ids)).all()
    char_map = {str(c.id): c for c in characters}

    # Return list preserving order with id, name, picture, and timestamp
    return [
        {
            "id": entry["id"],
            "name": char_map.get(entry["id"], None).name if char_map.get(entry["id"]) else "Unknown",
            "picture": char_map.get(entry["id"], None).picture if char_map.get(entry["id"]) else None,
            "timestamp": entry["timestamp"],
        }
        for entry in recent if entry["id"] in char_map
    ]

@app.get("/api/characters/popular")
def get_popular_characters(db: Session = Depends(get_db)):
    chars = db.query(Character).order_by(Character.views.desc()).limit(10).all()
    result = []
    for c in chars:
        result.append({
            "id": c.id,
            "name": c.name,
            "persona": c.persona,
            "picture": c.picture,
            "views": c.views,
        })
    return result

@app.post("/api/views/increment")
def increment_views(payload: dict, db: Session = Depends(get_db)):
    character_id = payload.get("character_id")

    if character_id:
        char = db.query(Character).filter(Character.id == character_id).first()
        if char:
            char.views = (char.views or 0) + 1

            creator = db.query(User).filter(User.id == char.creator_id).first()
            if creator:
                creator.views = (creator.views or 0) + 1

    db.commit()
    return {"message": "views updated"}

#======================== Chat API =======================

@app.get("/chat")
async def chat_page():
    return FileResponse("static/chat.html")

@app.post("/api/chat")
async def chat(request: Request, db: Session = Depends(get_db)):
    data = await request.json()
    character_id = data.get("id")
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
    return JSONResponse(content={"response": reply})


# ===============Profile Page==================
@app.get("/profile")
def profile_page():
    return FileResponse("static/profile.html")

@app.get("/profile/{user_id}")
async def public_profile_page(user_id: str):
    return FileResponse("static/public_profile.html")

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

@app.get("/api/characters-created")
def get_user_created_characters(request: Request, user_id: int = None, db: Session = Depends(get_db)):
    if user_id is None:
        token = request.cookies.get("session_token")
        user_id = verify_session_token(token)
        if not user_id:
            raise HTTPException(status_code=401, detail="Not logged in")

    user = db.query(User).filter(User.id == user_id).first()
    if not user or not user.characters_created:
        return []

    characters = db.query(Character).filter(Character.id.in_(user.characters_created)).all()
    return [{"id": c.id, "name": c.name, "picture": c.picture} for c in characters]


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
