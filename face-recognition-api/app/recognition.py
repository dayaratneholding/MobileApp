import io
import logging
import tempfile
from pathlib import Path

import numpy as np
from PIL import Image, ImageOps

from app.config import DETECTOR_BACKEND, DISTANCE_METRIC, MATCH_DISTANCE, MODEL_NAME

logger = logging.getLogger("face-recognition")

_THRESHOLDS = {
    ("ArcFace", "cosine"): 0.68,
    ("ArcFace", "euclidean"): 4.15,
    ("ArcFace", "euclidean_l2"): 1.13,
    ("Facenet", "cosine"): 0.40,
    ("Facenet", "euclidean_l2"): 0.80,
    ("Facenet512", "cosine"): 0.30,
    ("Facenet512", "euclidean_l2"): 1.04,
    ("VGG-Face", "cosine"): 0.40,
    ("VGG-Face", "euclidean_l2"): 0.86,
    ("SFace", "cosine"): 0.593,
    ("SFace", "euclidean_l2"): 1.055,
}


class FaceCaptureError(ValueError):
    pass


def warmup_model() -> None:
    from deepface import DeepFace

    try:
        DeepFace.build_model(MODEL_NAME)
    except TypeError:
        DeepFace.build_model(model_name=MODEL_NAME, task="facial_recognition")


def threshold() -> float:
    if MATCH_DISTANCE > 0:
        return MATCH_DISTANCE

    return _THRESHOLDS.get((MODEL_NAME, DISTANCE_METRIC), 0.68)


def extract_embedding(image_bytes: bytes, suffix: str = ".jpg") -> list[float]:
    from deepface import DeepFace

    prepared = _prepare_image(image_bytes)
    temp_path = _write_temp_image(prepared, ".jpg")
    faces = None
    last_error: Exception | None = None
    try:
        for detector in _detectors():
            try:
                found = DeepFace.represent(
                    img_path=temp_path,
                    model_name=MODEL_NAME,
                    detector_backend=detector,
                    enforce_detection=True,
                    align=True,
                )
            except Exception as error:
                last_error = error
                logger.info("Detector %s missed the face: %s", detector, error)
                continue

            if found:
                faces = found
                break
    finally:
        Path(temp_path).unlink(missing_ok=True)

    if not faces:
        raise FaceCaptureError(
            "No face detected. Look straight at the camera and hold still."
        ) from last_error

    embedding = _primary_face(faces).get("embedding")
    if not embedding:
        raise FaceCaptureError("Could not create a face signature from this photo.")

    return [float(value) for value in embedding]


def flip_image_bytes(image_bytes: bytes) -> bytes:
    image = Image.open(io.BytesIO(_prepare_image(image_bytes)))
    flipped = ImageOps.mirror(image)
    buffer = io.BytesIO()
    flipped.save(buffer, format="JPEG", quality=92)
    return buffer.getvalue()


def _detectors() -> list[str]:
    order = [DETECTOR_BACKEND, "yunet"]
    unique: list[str] = []
    for name in order:
        if name and name not in unique:
            unique.append(name)
    return unique


def _prepare_image(image_bytes: bytes) -> bytes:
    try:
        image = Image.open(io.BytesIO(image_bytes))
        image = ImageOps.exif_transpose(image)
        image = image.convert("RGB")
    except Exception as error:
        raise FaceCaptureError("This photo could not be read. Try again.") from error

    if max(image.size) > 960:
        image.thumbnail((960, 960), Image.Resampling.LANCZOS)

    buffer = io.BytesIO()
    image.save(buffer, format="JPEG", quality=92)
    return buffer.getvalue()


def _primary_face(faces: list[dict]) -> dict:
    if len(faces) == 1:
        return faces[0]

    ranked = sorted(faces, key=_face_area, reverse=True)
    largest = _face_area(ranked[0])
    second = _face_area(ranked[1])
    if largest > 0 and second > largest * 0.65:
        raise FaceCaptureError(
            "More than one face is close to the camera. Capture one person only."
        )

    return ranked[0]


def _face_area(face: dict) -> int:
    region = face.get("facial_area") or face.get("region") or {}
    width = region.get("w") or region.get("width") or 0
    height = region.get("h") or region.get("height") or 0
    return int(width) * int(height)


def best_distance(probe: list[float], stored: list[list[float]]) -> float:
    if not stored:
        raise FaceCaptureError("This employee has no enrolled face.")

    probe_vector = np.asarray(probe, dtype=np.float64)
    distances = [
        _distance(probe_vector, np.asarray(candidate, dtype=np.float64))
        for candidate in stored
    ]
    return float(min(distances))


def is_match(distance: float) -> bool:
    return distance <= threshold()


def confidence_percent(distance: float) -> float:
    limit = threshold()
    if limit <= 0:
        return 0.0

    if distance <= limit:
        score = 100.0 - (distance / limit) * 40.0
    else:
        score = 60.0 - ((distance - limit) / limit) * 60.0

    return round(max(0.0, min(100.0, score)), 1)


def _distance(left: np.ndarray, right: np.ndarray) -> float:
    if DISTANCE_METRIC == "cosine":
        left_norm = np.linalg.norm(left)
        right_norm = np.linalg.norm(right)
        if left_norm == 0 or right_norm == 0:
            return 1.0
        similarity = float(np.dot(left, right) / (left_norm * right_norm))
        similarity = max(-1.0, min(1.0, similarity))
        return 1.0 - similarity

    if DISTANCE_METRIC == "euclidean_l2":
        left = left / (np.linalg.norm(left) or 1.0)
        right = right / (np.linalg.norm(right) or 1.0)

    return float(np.linalg.norm(left - right))


def _write_temp_image(image_bytes: bytes, suffix: str) -> str:
    handle = tempfile.NamedTemporaryFile(delete=False, suffix=suffix)
    try:
        handle.write(image_bytes)
        handle.flush()
        return handle.name
    finally:
        handle.close()


def extension_for(content_type: str | None, filename: str | None) -> str:
    if filename:
        suffix = Path(filename).suffix.lower()
        if suffix in {".jpg", ".jpeg", ".png", ".webp"}:
            return suffix

    mapping = {
        "image/jpeg": ".jpg",
        "image/jpg": ".jpg",
        "image/png": ".png",
        "image/webp": ".webp",
    }
    return mapping.get((content_type or "").lower(), ".jpg")
