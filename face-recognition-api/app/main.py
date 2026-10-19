import logging
from contextlib import asynccontextmanager

from fastapi import Depends, FastAPI, File, Form, Header, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware

from app.attendance import AttendanceError, init_db, list_attendance, mark_attendance
from app.config import (
    ALLOWED_CONTENT_TYPES,
    API_KEY,
    DETECTOR_BACKEND,
    DISTANCE_METRIC,
    MAX_UPLOAD_BYTES,
    MODEL_NAME,
)
from app.recognition import (
    FaceCaptureError,
    best_distance,
    confidence_percent,
    extension_for,
    extract_embedding,
    is_match,
    threshold,
    warmup_model,
)
from app.storage import (
    InvalidIdentity,
    delete_record,
    init_face_store,
    iter_company_records,
    list_company,
    load_record,
    public_record,
    require_id,
    save_embedding,
)

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("face-recognition")


@asynccontextmanager
async def lifespan(_: FastAPI):
    logger.info(
        "Loading %s (%s). The first start downloads model weights.",
        MODEL_NAME,
        DETECTOR_BACKEND,
    )
    init_db()
    init_face_store()
    try:
        warmup_model()
        logger.info("Face model is ready.")
    except Exception:
        logger.exception("Model warmup failed. It will load on the first request.")
    yield


app = FastAPI(
    title="DH Face Recognition API",
    version="1.0.0",
    description="Enroll employee faces and mark attendance from a recognized face.",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


def require_api_key(x_api_key: str | None = Header(default=None)) -> None:
    if API_KEY and x_api_key != API_KEY:
        raise HTTPException(status_code=401, detail="Invalid API key.")


def _identity_error(error: InvalidIdentity) -> HTTPException:
    return HTTPException(status_code=400, detail=str(error))


async def _read_image(image: UploadFile) -> tuple[bytes, str]:
    content_type = (image.content_type or "").lower()
    if content_type and content_type not in ALLOWED_CONTENT_TYPES:
        raise HTTPException(status_code=400, detail="Upload a JPG, PNG, or WEBP photo.")

    payload = await image.read()
    if not payload:
        raise HTTPException(status_code=400, detail="The photo was empty.")
    if len(payload) > MAX_UPLOAD_BYTES:
        raise HTTPException(status_code=400, detail="Photo is larger than 8 MB.")

    return payload, extension_for(content_type, image.filename)


def _match_payload(
    *,
    matched: bool,
    employee_id: str,
    employee_name: str | None,
    company_id: str,
    distance: float,
    message: str,
) -> dict:
    return {
        "matched": matched,
        "employee_id": employee_id,
        "employee_name": employee_name,
        "company_id": company_id,
        "distance": round(distance, 4),
        "threshold": round(threshold(), 4),
        "confidence": confidence_percent(distance),
        "model": MODEL_NAME,
        "metric": DISTANCE_METRIC,
        "message": message,
    }


@app.get("/health")
def health() -> dict:
    return {
        "status": "ok",
        "model": MODEL_NAME,
        "detector": DETECTOR_BACKEND,
        "metric": DISTANCE_METRIC,
    }


@app.get("/api/v1/faces/{company_id}/{employee_id}", dependencies=[Depends(require_api_key)])
def enrollment_status(company_id: str, employee_id: str) -> dict:
    try:
        company_id = require_id(company_id, "company_id")
        employee_id = require_id(employee_id, "employee_id")
    except InvalidIdentity as error:
        raise _identity_error(error) from error

    record = load_record(company_id, employee_id)
    if record is None:
        return {
            "enrolled": False,
            "company_id": company_id,
            "employee_id": employee_id,
            "employee_name": None,
            "sample_count": 0,
            "model": MODEL_NAME,
            "updated_at": None,
        }

    return public_record(record)


@app.get("/api/v1/faces/{company_id}", dependencies=[Depends(require_api_key)])
def enrolled_employees(company_id: str) -> dict:
    try:
        people = list_company(company_id)
    except InvalidIdentity as error:
        raise _identity_error(error) from error

    return {"company_id": company_id, "count": len(people), "employees": people}


@app.delete("/api/v1/faces/{company_id}/{employee_id}", dependencies=[Depends(require_api_key)])
def remove_enrollment(company_id: str, employee_id: str) -> dict:
    try:
        removed = delete_record(company_id, employee_id)
    except InvalidIdentity as error:
        raise _identity_error(error) from error

    if not removed:
        raise HTTPException(status_code=404, detail="No enrolled face for this employee.")

    return {"deleted": True, "company_id": company_id, "employee_id": employee_id}


@app.post("/api/v1/faces/enroll", dependencies=[Depends(require_api_key)])
async def enroll_face(
    image: UploadFile = File(...),
    employee_id: str = Form(...),
    company_id: str = Form(...),
    employee_name: str | None = Form(default=None),
    replace: bool = Form(default=True),
) -> dict:
    payload, suffix = await _read_image(image)
    try:
        embedding = extract_embedding(payload, suffix)
        record = save_embedding(
            company_id=company_id,
            employee_id=employee_id,
            employee_name=employee_name.strip() if employee_name else None,
            embedding=embedding,
            replace=replace,
        )
    except InvalidIdentity as error:
        raise _identity_error(error) from error
    except FaceCaptureError as error:
        raise HTTPException(status_code=400, detail=str(error)) from error
    except Exception as error:
        logger.exception("Enrollment failed")
        raise HTTPException(status_code=500, detail="Could not enroll this face.") from error

    return {
        **record,
        "message": "Face enrolled.",
    }


@app.post("/api/v1/faces/verify", dependencies=[Depends(require_api_key)])
async def verify_face(
    image: UploadFile = File(...),
    employee_id: str = Form(...),
    company_id: str = Form(...),
) -> dict:
    try:
        company_id = require_id(company_id, "company_id")
        employee_id = require_id(employee_id, "employee_id")
    except InvalidIdentity as error:
        raise _identity_error(error) from error

    record = load_record(company_id, employee_id)
    if not record or not record.get("embeddings"):
        raise HTTPException(status_code=404, detail="Enroll this employee before verifying.")

    payload, suffix = await _read_image(image)
    try:
        embedding = extract_embedding(payload, suffix)
        distance = best_distance(embedding, record["embeddings"])
    except FaceCaptureError as error:
        raise HTTPException(status_code=400, detail=str(error)) from error
    except Exception as error:
        logger.exception("Verification failed")
        raise HTTPException(status_code=500, detail="Could not verify this face.") from error

    matched = is_match(distance)
    return _match_payload(
        matched=matched,
        employee_id=employee_id,
        employee_name=record.get("employee_name"),
        company_id=company_id,
        distance=distance,
        message="Face matched." if matched else "Face does not match this employee.",
    )


@app.post("/api/v1/faces/recognize", dependencies=[Depends(require_api_key)])
async def recognize_face(
    image: UploadFile = File(...),
    company_id: str = Form(...),
) -> dict:
    try:
        records = iter_company_records(company_id)
        company_id = require_id(company_id, "company_id")
    except InvalidIdentity as error:
        raise _identity_error(error) from error

    if not records:
        raise HTTPException(status_code=404, detail="No enrolled faces for this company.")

    payload, suffix = await _read_image(image)
    try:
        embedding = extract_embedding(payload, suffix)
        ranked = [
            (
                best_distance(embedding, record["embeddings"]),
                record,
            )
            for record in records
        ]
    except FaceCaptureError as error:
        raise HTTPException(status_code=400, detail=str(error)) from error
    except Exception as error:
        logger.exception("Recognition failed")
        raise HTTPException(status_code=500, detail="Could not recognize this face.") from error

    distance, record = min(ranked, key=lambda item: item[0])
    matched = is_match(distance)
    return _match_payload(
        matched=matched,
        employee_id=str(record.get("employee_id")),
        employee_name=record.get("employee_name"),
        company_id=company_id,
        distance=distance,
        message="Employee recognized." if matched else "No enrolled employee matched this face.",
    )


@app.post("/api/v1/attendance/mark", dependencies=[Depends(require_api_key)])
async def mark_face_attendance(
    image: UploadFile = File(...),
    company_id: str = Form(...),
    punched_at: str | None = Form(default=None),
    latitude: float | None = Form(default=None),
    longitude: float | None = Form(default=None),
    accuracy_meters: float | None = Form(default=None),
) -> dict:
    payload, suffix = await _read_image(image)
    try:
        return mark_attendance(
            company_id,
            payload,
            suffix,
            punched_at,
            latitude,
            longitude,
            accuracy_meters,
        )
    except AttendanceError as error:
        raise HTTPException(status_code=error.status_code, detail=str(error)) from error
    except FaceCaptureError as error:
        raise HTTPException(status_code=400, detail=str(error)) from error
    except Exception as error:
        logger.exception("Attendance mark failed")
        raise HTTPException(status_code=500, detail="Could not mark attendance.") from error


@app.get("/api/v1/attendance", dependencies=[Depends(require_api_key)])
def get_attendance(
    company_id: str,
    employee_id: str | None = None,
    attendance_date: str | None = None,
) -> dict:
    try:
        rows = list_attendance(company_id, employee_id, attendance_date)
    except AttendanceError as error:
        raise HTTPException(status_code=error.status_code, detail=str(error)) from error

    return {"count": len(rows), "records": rows}
