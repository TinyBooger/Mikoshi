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
# Import models so that all SQLAlchemy mappers are registered before create_all
import models  # noqa: F401
from routes import auth, character, chat, user, search, tags, scene, persona, admin, invitation, problem_report, notification

# Middleware
middleware = []

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
        "http://localhost",
        "http://localhost:80",
        "https://localhost",
        "https://localhost:443",
        "https://mikoshi-frontend.onrender.com",
        "http://43.138.173.199",           # Add this
        "http://43.138.173.199:80",        # Add this
        "https://43.138.173.199",          # Add this (for future SSL)
        "https://43.138.173.199:443",      # Add this (for future SSL)
    ],  # Your Vite frontend URLs
    allow_credentials=True,
    allow_methods=["*"],  # Allows all methods (GET, POST, etc.)
    allow_headers=["*"],
    expose_headers=["*"]  # Expose all headers to the frontend
)

# Wake up PostgreSQL database and wait for it to be available
import time
from sqlalchemy.exc import OperationalError
from sqlalchemy import text

def wait_for_neon_db(max_retries=20, delay=3):
    for attempt in range(1, max_retries + 1):
        try:
            with engine.connect() as conn:
                conn.execute(text("SELECT 1"))
            print(f"Database is available (attempt {attempt}).")
            return True
        except OperationalError as e:
            print(f"Attempt {attempt}: Database not available yet: {e}")
            time.sleep(delay)
    print("Failed to connect to database after retries. Exiting.")
    exit(1)

wait_for_neon_db()

# Create DB tables after confirming DB is up (models must be imported first)
Base.metadata.create_all(bind=engine)



# Serve static files (images, etc.) at /static
app.mount(
    "/static",
    StaticFiles(directory=os.path.join(os.path.dirname(__file__), "static")),
    name="static",
)

# Always include API routes
app.include_router(auth.router)
app.include_router(user.router)
app.include_router(character.router)
app.include_router(chat.router)
app.include_router(search.router)
app.include_router(tags.router)
app.include_router(scene.router)
app.include_router(persona.router)
app.include_router(admin.router)
app.include_router(invitation.router)
app.include_router(problem_report.router)
app.include_router(notification.router)


# (Optional) You can still keep the async wake-up for later pings if needed

# Add this below all your existing code
if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "server:app",
        host="0.0.0.0",
        port=8000,
        reload=True if os.getenv("ENVIRONMENT") != "production" else False
    )