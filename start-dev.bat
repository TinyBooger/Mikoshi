@echo off

:: Start backend in one window
start "Backend" cmd /k "cd backend && call venv\Scripts\activate && python server.py"

:: Start frontend in another window
start "Frontend" cmd /k "cd frontend && npm run dev"