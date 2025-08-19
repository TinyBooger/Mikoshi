
import os
import cloudinary
import cloudinary.uploader

cloudinary.config(
    cloud_name=os.getenv("CLOUDINARY_CLOUD_NAME"),
    api_key=os.getenv("CLOUDINARY_API_KEY"),
    api_secret=os.getenv("CLOUDINARY_API_SECRET"),
    secure=True
)

def upload_avatar(file, user_id):
    upload_res = cloudinary.uploader.upload(
        file,
        folder="avatars",
        public_id=f"user_{user_id}"
    )
    return upload_res.get("secure_url")


def upload_scene_image(file, char_id):
    upload_res = cloudinary.uploader.upload(
        file,
        folder="characters",
        public_id=f"char_{char_id}",
        overwrite=True
    )
    return upload_res.get("secure_url")

def upload_scene_picture(file, scene_id):
    upload_res = cloudinary.uploader.upload(
        file,
        folder="scenes",
        public_id=f"scene_{scene_id}",
        overwrite=True
    )
    return upload_res.get("secure_url")
def upload_persona_picture(file, persona_id):
    upload_res = cloudinary.uploader.upload(
        file,
        folder="personas",
        public_id=f"persona_{persona_id}",
        overwrite=True
    )
    return upload_res.get("secure_url")