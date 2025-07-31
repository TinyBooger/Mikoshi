import firebase_admin
from firebase_admin import credentials
import json
import os

def initialize_firebase_admin():
    try:
        # Check if Firebase app is already initialized
        if not firebase_admin._apps:
            # File name for the service account key
            secret_filename = 'mikoshi-135c9-firebase-adminsdk-fbsvc-bdf3c22105.json'
            # Render path
            render_secret_path = f'/etc/secrets/{secret_filename}'
            # Local path
            local_secret_path = f'../secrets/{secret_filename}'

            if os.path.exists(render_secret_path):
                cred = credentials.Certificate(render_secret_path)
                print(f"Firebase Admin using secret from: {render_secret_path}")
            elif os.path.exists(local_secret_path):
                cred = credentials.Certificate(local_secret_path)
                print(f"Firebase Admin using secret from: {local_secret_path}")
            else:
                raise RuntimeError("Firebase service account key not found in either Render or local secrets folder")

            firebase_admin.initialize_app(cred)
            print("Firebase Admin initialized successfully")
    except Exception as e:
        print(f"Error initializing Firebase Admin: {e}")
        raise

# Call this function when your app starts
initialize_firebase_admin()