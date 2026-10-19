import os
from pathlib import Path

from dotenv import load_dotenv

load_dotenv()

BASE_DIR = Path(__file__).resolve().parent.parent
DATA_DIR = Path(os.getenv("FACE_DATA_DIR", str(BASE_DIR / "data")))
MODEL_NAME = os.getenv("FACE_MODEL", "ArcFace")
DETECTOR_BACKEND = os.getenv("FACE_DETECTOR", "opencv")
DISTANCE_METRIC = os.getenv("FACE_DISTANCE_METRIC", "cosine")
MATCH_DISTANCE = float(os.getenv("FACE_MATCH_DISTANCE", "0.75"))
API_KEY = os.getenv("FACE_API_KEY", "dev-face-key")
HOST = os.getenv("FACE_HOST", "0.0.0.0")
PORT = int(os.getenv("FACE_PORT", "8000"))
MAX_SAMPLES = int(os.getenv("FACE_MAX_SAMPLES", "5"))
MAX_UPLOAD_BYTES = int(os.getenv("FACE_MAX_UPLOAD_BYTES", str(8 * 1024 * 1024)))
SQL_SERVER = os.getenv("SQL_SERVER", "2.24.130.171,1433")
SQL_DATABASE = os.getenv("SQL_DATABASE", "MobileAppDB")
SQL_USER = os.getenv("SQL_USER", "sa")
SQL_PASSWORD = os.getenv("SQL_PASSWORD", "")

ALLOWED_CONTENT_TYPES = {
    "image/jpeg",
    "image/jpg",
    "image/png",
    "image/webp",
}
