from fastapi import FastAPI
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from fastapi.middleware import Middleware
from fastapi.middleware.httpsredirect import HTTPSRedirectMiddleware
from starlette.middleware.sessions import SessionMiddleware
import os

from database import engine, Base
from routes import auth, character, chat, user

# Middleware
middleware = [
    Middleware(HTTPSRedirectMiddleware),  # Optional but recommended for production
]

# App
app = FastAPI(middleware=middleware)
app.mount("/assets", StaticFiles(directory="static/assets"), name="assets")
app.add_middleware(SessionMiddleware, secret_key=os.getenv("SECRET_KEY"))

# Create DB tables
Base.metadata.create_all(bind=engine)

# Root route
@app.get("/")
async def root():
    return FileResponse("static/index.html")

# Include routes
app.include_router(auth.router)
app.include_router(user.router)
app.include_router(character.router)
app.include_router(chat.router)
