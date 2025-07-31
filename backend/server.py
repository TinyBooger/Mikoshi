from fastapi import FastAPI, Request
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from fastapi.middleware import Middleware
from fastapi.middleware.httpsredirect import HTTPSRedirectMiddleware
import os
from dotenv import load_dotenv

print(f"Current working directory: {os.getcwd()}")

# Only load .env if it exists (for local dev); skip on Render
if os.path.exists("../secrets/Mikoshi.env"):
    print("Loading environment variables from .env file")
    load_dotenv("../secrets/Mikoshi.env")

from database import engine, Base
from routes import auth, character, chat, user, search, tags, scene
from utils.firebase_admin_setup import initialize_firebase_admin

# Middleware
middleware = [
    Middleware(HTTPSRedirectMiddleware),  # Optional but recommended for production
]

# App
app = FastAPI(middleware=middleware)

# Initialize Firebase Admin at startup
initialize_firebase_admin()

# Only mount static files in production (Render)
if os.getenv("ENVIRONMENT") == "production":
    # Serve static files from React build
    app.mount("/assets", StaticFiles(directory="static/assets"), name="assets")
    app.mount("/static", StaticFiles(directory="static"), name="static")

# Create DB tables
Base.metadata.create_all(bind=engine)

# Include API routes
app.include_router(auth.router)
app.include_router(user.router)
app.include_router(character.router)
app.include_router(chat.router)
app.include_router(search.router)
app.include_router(tags.router)
app.include_router(scene.router)

# Catch-all route for client-side routing
@app.get("/{full_path:path}")
async def serve_spa(request: Request):
    full_path = request.path_params['full_path']
    file_path = os.path.join("static", full_path)
    
    # If the requested file exists, serve it
    if os.path.exists(file_path) and os.path.isfile(file_path) and not full_path.startswith('api/'):
        return FileResponse(file_path)
    
    # Otherwise serve index.html for client-side routing
    return FileResponse("static/index.html")

# Add this below all your existing code
if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "server:app",
        host="0.0.0.0",
        port=8000,
        reload=True if os.getenv("ENVIRONMENT") != "production" else False
    )