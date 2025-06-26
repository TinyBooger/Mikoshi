#!/bin/bash

# Exit immediately on error
set -e

echo "==> Installing frontend dependencies..."
cd frontend
npm install

echo "==> Building frontend..."
npm run build

cd ..

echo "==> Copying build files to backend static folder..."
rm -rf backend/static/*
mkdir -p backend/static
cp -r frontend/dist/* backend/static/

cd backend

echo "==> Installing backend dependencies..."
pip install -r requirements.txt

echo "==> Build complete. You can now start the server with:"
echo "uvicorn server:app --host 0.0.0.0 --port 10000"
