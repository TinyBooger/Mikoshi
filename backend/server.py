from fastapi import FastAPI, Request
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from fastapi.middleware import Middleware
from fastapi.middleware.httpsredirect import HTTPSRedirectMiddleware
from fastapi.middleware.cors import CORSMiddleware
import os
from dotenv import load_dotenv

print(f"Current working directory: {os.getcwd()}")

# Only load .env if it exists (for local dev); skip on Render
if os.path.exists("../secrets/Mikoshi.env"):
    print("Loading environment variables from .env file")
    load_dotenv("../secrets/Mikoshi.env")

from database import engine, Base
from routes import auth, character, chat, user, search, tags, scene, persona
from utils.firebase_admin_setup import initialize_firebase_admin

# Middleware
middleware = []

if os.getenv("ENVIRONMENT") == "production":
    middleware.append(Middleware(HTTPSRedirectMiddleware))  # Only enable in production

# App
app = FastAPI(middleware=middleware)

# Disable HTTPS redirects in development
if os.getenv("ENVIRONMENT") != "production":
    app.force_https = False  # If using FastAPI-HTTPS middleware

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "https://mikoshi-frontend.onrender.com",
    ],  # Your Vite frontend URLs
    allow_credentials=True,
    allow_methods=["*"],  # Allows all methods (GET, POST, etc.)
    allow_headers=["*"],
)

# Initialize Firebase Admin at startup
initialize_firebase_admin()

# Create DB tables
Base.metadata.create_all(bind=engine)

# Always include API routes
app.include_router(auth.router)
app.include_router(user.router)
app.include_router(character.router)
app.include_router(chat.router)
app.include_router(search.router)
app.include_router(tags.router)
app.include_router(scene.router)
app.include_router(persona.router)

# Add this below all your existing code
if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "server:app",
        host="0.0.0.0",
        port=8000,
        reload=True if os.getenv("ENVIRONMENT") != "production" else False
    )