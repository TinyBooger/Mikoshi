import os
from itsdangerous import URLSafeSerializer

SECRET_KEY = os.getenv("SECRET_KEY")
serializer = URLSafeSerializer(SECRET_KEY)

def create_session_token(user):
    return serializer.dumps({"user_id": user.id})

def verify_session_token(token):
    try:
        data = serializer.loads(token)
        return data["user_id"]
    except Exception:
        return None

def get_current_user(request: Request, db: Session):
    user_id = request.session.get("user_id")
    if not user_id:
        raise HTTPException(status_code=401, detail="Not logged in")
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user