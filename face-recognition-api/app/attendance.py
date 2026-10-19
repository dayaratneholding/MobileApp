from contextlib import contextmanager
from datetime import datetime, timedelta

import re

import pyodbc

from app.config import SQL_DATABASE, SQL_PASSWORD, SQL_SERVER, SQL_USER
from app.recognition import (
    FaceCaptureError,
    best_distance,
    confidence_percent,
    extract_embedding,
    flip_image_bytes,
    is_match,
    threshold,
)
from app.storage import InvalidIdentity, iter_company_records, require_id

MIN_OUT_GAP = timedelta(minutes=1)

_CREATE_TABLE = """
IF OBJECT_ID(N'dbo.Attendance', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.Attendance (
        AttendanceSerialID BIGINT IDENTITY(1,1) NOT NULL PRIMARY KEY,
        ComSerialID INT NOT NULL,
        EESerialID INT NOT NULL,
        EEID INT NULL,
        EmployeeName NVARCHAR(200) NULL,
        ShiftSerialID INT NULL,
        DateIn DATE NOT NULL,
        TimeIn TIME(0) NULL,
        DateOut DATE NULL,
        TimeOut TIME(0) NULL,
        Confidence DECIMAL(5,1) NULL,
        Distance DECIMAL(8,4) NULL,
        Source NVARCHAR(20) NOT NULL CONSTRAINT DF_Attendance_Source DEFAULT (N'face'),
        OTAdjust SMALLINT NOT NULL CONSTRAINT DF_Attendance_OTAdjust DEFAULT (0),
        PostOT SMALLINT NOT NULL CONSTRAINT DF_Attendance_PostOT DEFAULT (0),
        PreOT SMALLINT NOT NULL CONSTRAINT DF_Attendance_PreOT DEFAULT (0),
        CreatedDate DATETIME2 NOT NULL CONSTRAINT DF_Attendance_CreatedDate DEFAULT (SYSDATETIME()),
        ModifiedDate DATETIME2 NULL,
        Active BIT NOT NULL CONSTRAINT DF_Attendance_Active DEFAULT (1),
        IsDeleted BIT NOT NULL CONSTRAINT DF_Attendance_IsDeleted DEFAULT (0),
        Latitude DECIMAL(9, 6) NULL,
        Longitude DECIMAL(9, 6) NULL,
        AccuracyMeters DECIMAL(8, 1) NULL,
        OutLatitude DECIMAL(9, 6) NULL,
        OutLongitude DECIMAL(9, 6) NULL,
        OutAccuracyMeters DECIMAL(8, 1) NULL,
        CONSTRAINT UQ_Attendance_EmployeeDay UNIQUE (ComSerialID, EESerialID, DateIn)
    );
END
"""

_LOCATION_COLUMNS = (
    ("Latitude", "DECIMAL(9, 6) NULL"),
    ("Longitude", "DECIMAL(9, 6) NULL"),
    ("AccuracyMeters", "DECIMAL(8, 1) NULL"),
    ("OutLatitude", "DECIMAL(9, 6) NULL"),
    ("OutLongitude", "DECIMAL(9, 6) NULL"),
    ("OutAccuracyMeters", "DECIMAL(8, 1) NULL"),
)


class AttendanceError(Exception):
    def __init__(self, message: str, status_code: int = 400) -> None:
        super().__init__(message)
        self.status_code = status_code


def init_db() -> None:
    if not SQL_PASSWORD:
        raise AttendanceError("SQL_PASSWORD is not set.", 500)
    if not re.fullmatch(r"[A-Za-z0-9_]+", SQL_DATABASE):
        raise AttendanceError("SQL_DATABASE name is not valid.", 500)

    master = _open(database="master", autocommit=True)
    try:
        master.cursor().execute(
            f"IF DB_ID(N'{SQL_DATABASE}') IS NULL CREATE DATABASE [{SQL_DATABASE}]"
        )
    finally:
        master.close()

    with _connect() as connection:
        cursor = connection.cursor()
        cursor.execute(_CREATE_TABLE)
        for column_name, column_type in _LOCATION_COLUMNS:
            cursor.execute(
                f"""
                IF COL_LENGTH('dbo.Attendance', '{column_name}') IS NULL
                    ALTER TABLE dbo.Attendance ADD {column_name} {column_type}
                """
            )
        cursor.execute(
            """
            IF EXISTS (
                SELECT 1
                FROM sys.key_constraints
                WHERE name = N'UQ_Attendance_EmployeeDay'
                  AND parent_object_id = OBJECT_ID(N'dbo.Attendance')
            )
                ALTER TABLE dbo.Attendance DROP CONSTRAINT UQ_Attendance_EmployeeDay
            """
        )


def mark_attendance(
    company_id: str,
    image_bytes: bytes,
    suffix: str,
    punched_at: str | None = None,
    latitude: float | None = None,
    longitude: float | None = None,
    accuracy_meters: float | None = None,
) -> dict:
    try:
        company_id = require_id(company_id, "company_id")
    except InvalidIdentity as error:
        raise AttendanceError(str(error), 400) from error

    company_serial = _as_int(company_id, "company_id")
    records = iter_company_records(company_id)
    if not records:
        raise AttendanceError("No enrolled faces for this company.", 404)

    try:
        embedding = extract_embedding(image_bytes, suffix)
    except FaceCaptureError:
        raise

    distance, record = _closest(embedding, records)
    if not is_match(distance) and distance < 0.95:
        try:
            flipped = extract_embedding(flip_image_bytes(image_bytes), suffix)
        except FaceCaptureError:
            flipped = None
        if flipped is not None:
            flipped_distance, flipped_record = _closest(flipped, records)
            if flipped_distance < distance:
                distance, record = flipped_distance, flipped_record

    if not is_match(distance):
        raise AttendanceError("No enrolled employee matched this face.", 404)

    attendance_date, punch_time = _phone_clock(punched_at)
    return _punch(
        company_serial=company_serial,
        employee_serial=_as_int(str(record.get("employee_id")), "employee_id"),
        employee_name=record.get("employee_name"),
        attendance_date=attendance_date,
        punch_time=punch_time,
        confidence=confidence_percent(distance),
        distance=round(distance, 4),
        latitude=_coordinate(latitude, "latitude", -90, 90),
        longitude=_coordinate(longitude, "longitude", -180, 180),
        accuracy_meters=None if accuracy_meters is None else round(float(accuracy_meters), 1),
    )


def _closest(embedding: list[float], records: list[dict]) -> tuple[float, dict]:
    ranked = [
        (best_distance(embedding, record["embeddings"]), record)
        for record in records
    ]
    return min(ranked, key=lambda item: item[0])


def list_attendance(
    company_id: str,
    employee_id: str | None = None,
    attendance_date: str | None = None,
) -> list[dict]:
    try:
        company_id = require_id(company_id, "company_id")
        if employee_id:
            employee_id = require_id(employee_id, "employee_id")
    except InvalidIdentity as error:
        raise AttendanceError(str(error), 400) from error

    query = """
        SELECT *
        FROM dbo.Attendance
        WHERE ComSerialID = ? AND IsDeleted = 0
    """
    params: list[object] = [_as_int(company_id, "company_id")]
    if employee_id:
        query += " AND EESerialID = ?"
        params.append(_as_int(employee_id, "employee_id"))
    if attendance_date:
        query += " AND DateIn = ?"
        params.append(attendance_date)
    query += " ORDER BY DateIn DESC, TimeIn DESC, AttendanceSerialID DESC"

    with _connect() as connection:
        cursor = connection.cursor()
        cursor.execute(query, params)
        return [_row_to_dict(row) for row in _fetch_dicts(cursor)]


def _punch(
    *,
    company_serial: int,
    employee_serial: int,
    employee_name: str | None,
    attendance_date: str,
    punch_time: str,
    confidence: float,
    distance: float,
    latitude: float,
    longitude: float,
    accuracy_meters: float | None,
) -> dict:
    stamp = f"{attendance_date} {punch_time}"
    with _connect() as connection:
        cursor = connection.cursor()
        cursor.execute(
            """
            SET NOCOUNT ON;
            INSERT INTO dbo.Attendance (
                ComSerialID, EESerialID, EmployeeName, DateIn, TimeIn,
                Confidence, Distance, Source, CreatedDate, Active, IsDeleted,
                Latitude, Longitude, AccuracyMeters
            )
            OUTPUT INSERTED.AttendanceSerialID
            VALUES (
                ?, ?, ?, CONVERT(date, ?, 23), CONVERT(time, ?, 108),
                ?, ?, N'face', CONVERT(datetime2, ?, 120), 1, 0,
                ?, ?, ?
            );
            """,
            (
                company_serial,
                employee_serial,
                employee_name,
                attendance_date,
                punch_time,
                confidence,
                distance,
                stamp,
                latitude,
                longitude,
                accuracy_meters,
            ),
        )
        inserted = cursor.fetchone()
        new_id = int(inserted[0]) if inserted and inserted[0] is not None else None
        saved = None
        if new_id is not None:
            cursor.execute(
                "SELECT * FROM dbo.Attendance WHERE AttendanceSerialID = ?",
                (new_id,),
            )
            saved = _fetch_dict(cursor)

    if saved is None:
        return {
            "id": new_id or 0,
            "company_id": str(company_serial),
            "employee_id": str(employee_serial),
            "employee_name": employee_name,
            "attendance_date": attendance_date,
            "time_in": punch_time,
            "time_out": None,
            "confidence": confidence,
            "distance": distance,
            "source": "face",
            "latitude": latitude,
            "longitude": longitude,
            "accuracy_meters": accuracy_meters,
            "out_latitude": None,
            "out_longitude": None,
            "out_accuracy_meters": None,
            "created_at": stamp.replace(" ", "T"),
            "updated_at": stamp.replace(" ", "T"),
            "action": "punch",
            "message": f"Saved at {punch_time}.",
            "punched_at": stamp,
            "threshold": round(threshold(), 4),
        }

    result = _row_to_dict(saved)
    result["attendance_date"] = attendance_date
    result["time_in"] = punch_time
    result["latitude"] = latitude
    result["longitude"] = longitude
    result["accuracy_meters"] = accuracy_meters
    result["action"] = "punch"
    result["message"] = f"Saved at {punch_time}."
    result["punched_at"] = stamp
    result["threshold"] = round(threshold(), 4)
    return result


def _connection_string(database: str) -> str:
    return (
        "DRIVER={ODBC Driver 17 for SQL Server};"
        f"SERVER={SQL_SERVER};"
        f"DATABASE={database};"
        f"UID={SQL_USER};"
        f"PWD={SQL_PASSWORD};"
        "TrustServerCertificate=yes;"
    )


def _open(database: str | None = None, autocommit: bool = False) -> pyodbc.Connection:
    return pyodbc.connect(
        _connection_string(database or SQL_DATABASE),
        autocommit=autocommit,
        timeout=15,
    )


@contextmanager
def _connect(database: str | None = None):
    connection = _open(database)
    try:
        yield connection
        connection.commit()
    except Exception:
        connection.rollback()
        raise
    finally:
        connection.close()


def _fetch_dict(cursor) -> dict | None:
    row = cursor.fetchone()
    if row is None:
        return None
    columns = [column[0] for column in cursor.description]
    return dict(zip(columns, row))


def _fetch_dicts(cursor) -> list[dict]:
    columns = [column[0] for column in cursor.description]
    return [dict(zip(columns, row)) for row in cursor.fetchall()]


def _phone_clock(value: str | None) -> tuple[str, str]:
    if not value or not value.strip():
        raise AttendanceError("Phone date and time was not sent.", 400)

    text = value.strip().replace("Z", "").replace("z", "")
    if len(text) < 19 or text[10] not in {"T", " "}:
        raise AttendanceError("Phone date and time is not valid.", 400)

    attendance_date = text[:10]
    punch_time = text[11:19]
    try:
        datetime.strptime(f"{attendance_date} {punch_time}", "%Y-%m-%d %H:%M:%S")
    except ValueError as error:
        raise AttendanceError("Phone date and time is not valid.", 400) from error
    return attendance_date, punch_time


def _clock_text(value) -> str | None:
    if value is None:
        return None
    if isinstance(value, str):
        match = value.strip().replace("T", " ")
        if len(match) >= 8 and ":" in match:
            return match[-8:]
        return None
    if hasattr(value, "strftime"):
        return value.strftime("%H:%M:%S")
    total_seconds = int(getattr(value, "total_seconds", lambda: -1)())
    if total_seconds >= 0:
        hours, remainder = divmod(total_seconds, 3600)
        minutes, seconds = divmod(remainder, 60)
        return f"{hours:02d}:{minutes:02d}:{seconds:02d}"
    return None


def _coordinate(value: float | None, label: str, low: float, high: float) -> float:
    if value is None:
        raise AttendanceError("Phone location was not sent.", 400)
    number = float(value)
    if number < low or number > high:
        raise AttendanceError(f"Phone {label} is not valid.", 400)
    return round(number, 6)


def _as_int(value: str, label: str) -> int:
    text = str(value).strip()
    if not text.isdigit():
        raise AttendanceError(f"{label} must be a number.", 400)
    return int(text)


def _optional_float(value) -> float | None:
    if value is None:
        return None
    return float(value)


def _fmt_date(value) -> str | None:
    if value is None:
        return None
    if hasattr(value, "strftime"):
        return value.strftime("%Y-%m-%d")
    return str(value)[:10]


def _fmt_time(value) -> str | None:
    if value is None:
        return None
    if hasattr(value, "strftime"):
        return value.strftime("%H:%M:%S")
    return str(value)


def _fmt_stamp(value) -> str | None:
    if value is None:
        return None
    if hasattr(value, "isoformat"):
        return value.isoformat(timespec="seconds")
    return str(value)


def _row_to_dict(row: dict) -> dict:
    confidence = row["Confidence"]
    distance = row["Distance"]
    return {
        "id": int(row["AttendanceSerialID"]),
        "company_id": str(row["ComSerialID"]),
        "employee_id": str(row["EESerialID"]),
        "employee_name": row["EmployeeName"],
        "attendance_date": _fmt_date(row["DateIn"]),
        "time_in": _fmt_time(row["TimeIn"]),
        "time_out": _fmt_time(row["TimeOut"]),
        "confidence": float(confidence) if confidence is not None else None,
        "distance": float(distance) if distance is not None else None,
        "source": row["Source"],
        "latitude": _optional_float(row.get("Latitude")),
        "longitude": _optional_float(row.get("Longitude")),
        "accuracy_meters": _optional_float(row.get("AccuracyMeters")),
        "out_latitude": _optional_float(row.get("OutLatitude")),
        "out_longitude": _optional_float(row.get("OutLongitude")),
        "out_accuracy_meters": _optional_float(row.get("OutAccuracyMeters")),
        "created_at": _fmt_stamp(row["CreatedDate"]),
        "updated_at": _fmt_stamp(row["ModifiedDate"] or row["CreatedDate"]),
    }
