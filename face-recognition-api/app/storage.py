import json
import re
from contextlib import contextmanager
from datetime import datetime

import pyodbc

from app.config import MAX_SAMPLES, MODEL_NAME, SQL_DATABASE, SQL_PASSWORD, SQL_SERVER, SQL_USER

SAFE_ID = re.compile(r"^[A-Za-z0-9_-]{1,64}$")

_CREATE_TABLE = """
IF OBJECT_ID(N'dbo.FaceVector', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.FaceVector (
        FaceVectorID BIGINT IDENTITY(1,1) NOT NULL PRIMARY KEY,
        ComSerialID INT NOT NULL,
        EESerialID INT NOT NULL,
        EmployeeName NVARCHAR(200) NULL,
        ModelName NVARCHAR(50) NOT NULL,
        SampleNo INT NOT NULL,
        Embedding NVARCHAR(MAX) NOT NULL,
        CreatedDate DATETIME2 NOT NULL CONSTRAINT DF_FaceVector_CreatedDate DEFAULT (SYSDATETIME())
    );
    CREATE UNIQUE INDEX UQ_FaceVector_Sample
        ON dbo.FaceVector (ComSerialID, EESerialID, ModelName, SampleNo);
END
"""


class InvalidIdentity(ValueError):
    pass


def require_id(value: str, label: str) -> str:
    cleaned = value.strip()
    if not SAFE_ID.fullmatch(cleaned):
        raise InvalidIdentity(f"{label} may only contain letters, numbers, _ and -.")
    return cleaned


def init_face_store() -> None:
    if not SQL_PASSWORD:
        raise RuntimeError("SQL_PASSWORD is not set.")
    with _connect() as connection:
        connection.cursor().execute(_CREATE_TABLE)


def load_record(company_id: str, employee_id: str) -> dict | None:
    company_id = require_id(company_id, "company_id")
    employee_id = require_id(employee_id, "employee_id")
    rows = _rows_for_employee(company_id, employee_id)
    if not rows:
        return None
    return _record_from_rows(rows)


def save_embedding(
    company_id: str,
    employee_id: str,
    employee_name: str | None,
    embedding: list[float],
    replace: bool,
) -> dict:
    company_id = require_id(company_id, "company_id")
    employee_id = require_id(employee_id, "employee_id")
    company_serial = _as_int(company_id, "company_id")
    employee_serial = _as_int(employee_id, "employee_id")

    current = None if replace else load_record(company_id, employee_id)
    if current is None or current.get("model") != MODEL_NAME:
        embeddings: list[list[float]] = []
        name = employee_name
    else:
        embeddings = list(current.get("embeddings") or [])
        name = employee_name or current.get("employee_name")

    embeddings.append(embedding)
    embeddings = embeddings[-MAX_SAMPLES:]
    saved_at = datetime.now().replace(microsecond=0)

    with _connect() as connection:
        cursor = connection.cursor()
        cursor.execute(
            """
            DELETE FROM dbo.FaceVector
            WHERE ComSerialID = ? AND EESerialID = ? AND ModelName = ?
            """,
            (company_serial, employee_serial, MODEL_NAME),
        )
        for index, vector in enumerate(embeddings, start=1):
            cursor.execute(
                """
                INSERT INTO dbo.FaceVector (
                    ComSerialID, EESerialID, EmployeeName, ModelName,
                    SampleNo, Embedding, CreatedDate
                ) VALUES (?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    company_serial,
                    employee_serial,
                    name,
                    MODEL_NAME,
                    index,
                    json.dumps(vector),
                    saved_at,
                ),
            )

    return public_record(
        {
            "company_id": company_id,
            "employee_id": employee_id,
            "employee_name": name,
            "model": MODEL_NAME,
            "embeddings": embeddings,
            "updated_at": saved_at.isoformat(timespec="seconds"),
        }
    )


def delete_record(company_id: str, employee_id: str) -> bool:
    company_id = require_id(company_id, "company_id")
    employee_id = require_id(employee_id, "employee_id")
    with _connect() as connection:
        cursor = connection.cursor()
        cursor.execute(
            """
            DELETE FROM dbo.FaceVector
            WHERE ComSerialID = ? AND EESerialID = ? AND ModelName = ?
            """,
            (_as_int(company_id, "company_id"), _as_int(employee_id, "employee_id"), MODEL_NAME),
        )
        return cursor.rowcount > 0


def list_company(company_id: str) -> list[dict]:
    return [public_record(record) for record in iter_company_records(company_id)]


def iter_company_records(company_id: str) -> list[dict]:
    company_id = require_id(company_id, "company_id")
    with _connect() as connection:
        cursor = connection.cursor()
        cursor.execute(
            """
            SELECT ComSerialID, EESerialID, EmployeeName, ModelName, SampleNo, Embedding, CreatedDate
            FROM dbo.FaceVector
            WHERE ComSerialID = ? AND ModelName = ?
            ORDER BY EESerialID, SampleNo
            """,
            (_as_int(company_id, "company_id"), MODEL_NAME),
        )
        rows = _fetch_dicts(cursor)

    grouped: dict[int, list[dict]] = {}
    for row in rows:
        grouped.setdefault(int(row["EESerialID"]), []).append(row)

    return [_record_from_rows(employee_rows) for employee_rows in grouped.values() if employee_rows]


def public_record(record: dict) -> dict:
    embeddings = record.get("embeddings") or []
    return {
        "enrolled": len(embeddings) > 0,
        "company_id": record.get("company_id"),
        "employee_id": record.get("employee_id"),
        "employee_name": record.get("employee_name"),
        "sample_count": len(embeddings),
        "model": record.get("model") or MODEL_NAME,
        "updated_at": record.get("updated_at"),
    }


def _record_from_rows(rows: list[dict]) -> dict:
    latest = max(rows, key=lambda row: row["CreatedDate"] or datetime.min)
    created = latest["CreatedDate"]
    return {
        "company_id": str(latest["ComSerialID"]),
        "employee_id": str(latest["EESerialID"]),
        "employee_name": latest["EmployeeName"],
        "model": latest["ModelName"],
        "embeddings": [json.loads(row["Embedding"]) for row in rows],
        "updated_at": created.isoformat(timespec="seconds") if hasattr(created, "isoformat") else str(created),
    }


def _rows_for_employee(company_id: str, employee_id: str) -> list[dict]:
    with _connect() as connection:
        cursor = connection.cursor()
        cursor.execute(
            """
            SELECT ComSerialID, EESerialID, EmployeeName, ModelName, SampleNo, Embedding, CreatedDate
            FROM dbo.FaceVector
            WHERE ComSerialID = ? AND EESerialID = ? AND ModelName = ?
            ORDER BY SampleNo
            """,
            (
                _as_int(company_id, "company_id"),
                _as_int(employee_id, "employee_id"),
                MODEL_NAME,
            ),
        )
        return _fetch_dicts(cursor)


def _as_int(value: str, label: str) -> int:
    text = str(value).strip()
    if not text.isdigit():
        raise InvalidIdentity(f"{label} must be a number.")
    return int(text)


def _connection_string() -> str:
    return (
        "DRIVER={ODBC Driver 17 for SQL Server};"
        f"SERVER={SQL_SERVER};"
        f"DATABASE={SQL_DATABASE};"
        f"UID={SQL_USER};"
        f"PWD={SQL_PASSWORD};"
        "TrustServerCertificate=yes;"
    )


@contextmanager
def _connect():
    connection = pyodbc.connect(_connection_string(), timeout=15)
    try:
        yield connection
        connection.commit()
    except Exception:
        connection.rollback()
        raise
    finally:
        connection.close()


def _fetch_dicts(cursor) -> list[dict]:
    columns = [column[0] for column in cursor.description]
    return [dict(zip(columns, row)) for row in cursor.fetchall()]
