#!/bin/bash

# Exit immediately on error
set -e

echo "==> Installing backend dependencies..."
cd backend
pip install -r requirements.txt

echo "==> Backend build complete. Starting server..."
echo "uvicorn server:app --host 0.0.0.0 --port 10000"