import os
import shutil
from typing import BinaryIO, Optional


# Directory for storing images
BASE_IMAGE_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'static', 'images')
os.makedirs(BASE_IMAGE_DIR, exist_ok=True)

def _get_category_folder(category: str) -> str:
    """
    Returns the folder name for a given image category.
    """
    valid_categories = {'user', 'character', 'scene', 'persona'}
    if category not in valid_categories:
        raise ValueError(f"Invalid category: {category}. Must be one of {valid_categories}")
    return os.path.join(BASE_IMAGE_DIR, category + 's')  # e.g., 'users', 'characters', etc.



def save_image(file: BinaryIO, category: str, id_value, original_filename: str) -> str:
    """
    Save an uploaded image file to the local storage under the appropriate category and id.
    category: 'user', 'character', 'scene', or 'persona'
    id_value: user_id (str) or other ids (int)
    original_filename: the original filename of the uploaded file (used to extract extension)
    Returns the relative path to the saved image.
    """
    folder = _get_category_folder(category)
    os.makedirs(folder, exist_ok=True)
    id_str = str(id_value)
    _, ext = os.path.splitext(original_filename)
    if not ext:
        ext = ".img"  # fallback if no extension
    file_path = os.path.join(folder, f"{category}_{id_str}{ext}")
    with open(file_path, 'wb') as out_file:
        shutil.copyfileobj(file, out_file)
    return os.path.relpath(file_path, os.path.dirname(os.path.dirname(__file__)))



def get_image_path(category: str, id_value) -> Optional[str]:
    """
    Get the relative path to an image if it exists, else None.
    Tries common image extensions.
    """
    folder = _get_category_folder(category)
    id_str = str(id_value)
    for ext in [".png", ".jpg", ".jpeg", ".gif", ".webp", ".bmp", ".tiff", ".img"]:
        file_path = os.path.join(folder, f"{category}_{id_str}{ext}")
        if os.path.exists(file_path):
            return os.path.relpath(file_path, os.path.dirname(os.path.dirname(__file__)))
    return None



def delete_image(category: str, id_value) -> bool:
    """
    Delete an image from local storage. Returns True if deleted, False if not found.
    Tries common image extensions.
    """
    folder = _get_category_folder(category)
    id_str = str(id_value)
    for ext in [".png", ".jpg", ".jpeg", ".gif", ".webp", ".bmp", ".tiff", ".img"]:
        file_path = os.path.join(folder, f"{category}_{id_str}{ext}")
        if os.path.exists(file_path):
            os.remove(file_path)
            return True
    return False
