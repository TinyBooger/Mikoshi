from database import Base, engine
from models import User  # Add other models as needed


def init_db():
    try:
        Base.metadata.create_all(bind=engine)
        print("Database tables created!")
    except Exception as e:
        print(f"Error creating tables: {e}")

if __name__ == "__main__":
    init_db()
