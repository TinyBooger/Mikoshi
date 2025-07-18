import firebase_admin
from firebase_admin import credentials
import json
import os

def initialize_firebase_admin():
    try:
        # Check if Firebase app is already initialized
        if not firebase_admin._apps:
            # Path to the service account key in Render's secret files
            secret_path = '/etc/secrets/mikoshi-135c9-firebase-adminsdk-fbsvc-bdf3c22105.json'
            
            # Determine which path to use
            if os.path.exists(secret_path):
                # Running in Render - use the secret file path
                cred = credentials.Certificate(secret_path)
            else:
                raise RuntimeError("Firebase service account key not found")
            
            firebase_admin.initialize_app(cred)
            print("Firebase Admin initialized successfully")
    except Exception as e:
        print(f"Error initializing Firebase Admin: {e}")
        raise

# Call this function when your app starts
initialize_firebase_admin()