"""
Salo request index for the SaloMed admin console.

Patient-side Salo requests are indexed here so SaloMed reviewers can see and
decide requests across users, browsers, and devices. Storage follows the same
deployment shape as the other indexes: PostgreSQL when DATABASE_URL is set,
else local SQLite.
"""

from __future__ import annotations

import json
import os
import sqlite3
import time
import uuid
from pathlib import Path
from typing import Any


def _db_url() -> str:
    return os.getenv("DATABASE_URL", "").strip()


def _sqlite_path() -> str:
    return os.getenv(
        "SALOMED_DB_PATH",
        str(Path(__file__).resolve().parent / "data" / "salomed.sqlite3"),
    )


_USE_PG = bool(_db_url())
_INITIALIZED = False


def _pg_conn():
    import psycopg

    url = _db_url()
    if url.startswith("postgres://"):
        url = "postgresql://" + url[len("postgres://"):]
    return psycopg.connect(url, autocommit=False)


def _sqlite_conn() -> sqlite3.Connection:
    path = _sqlite_path()
    Path(path).parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(path, timeout=10)
    conn.row_factory = sqlite3.Row
    return conn


def _init() -> None:
    global _INITIALIZED
    if _INITIALIZED:
        return
    try:
        if _USE_PG:
            with _pg_conn() as c:
                with c.cursor() as cur:
                    cur.execute(
                        """
                        CREATE TABLE IF NOT EXISTS salo_requests (
                            id TEXT PRIMARY KEY,
                            patient_address TEXT NOT NULL,
                            amount_asset DOUBLE PRECISION NOT NULL DEFAULT 0,
                            amount_php DOUBLE PRECISION NOT NULL DEFAULT 0,
                            term_months INTEGER NOT NULL,
                            monthly_php DOUBLE PRECISION NOT NULL DEFAULT 0,
                            interest_rate DOUBLE PRECISION NOT NULL DEFAULT 0,
                            salo_points BIGINT NOT NULL DEFAULT 0,
                            credit_tier TEXT NOT NULL,
                            status TEXT NOT NULL DEFAULT 'pending',
                            review_decision TEXT NOT NULL DEFAULT 'salomed_review',
                            reason_codes TEXT NOT NULL DEFAULT '[]',
                            reviewer TEXT,
                            reviewed_at BIGINT,
                            created_at BIGINT NOT NULL,
                            updated_at BIGINT NOT NULL
                        );
                        CREATE INDEX IF NOT EXISTS idx_salo_requests_status_created
                        ON salo_requests(status, created_at DESC);
                        CREATE INDEX IF NOT EXISTS idx_salo_requests_patient_created
                        ON salo_requests(patient_address, created_at DESC);
                        """
                    )
                c.commit()
        else:
            with _sqlite_conn() as c:
                c.executescript(
                    """
                    CREATE TABLE IF NOT EXISTS salo_requests (
                        id TEXT PRIMARY KEY,
                        patient_address TEXT NOT NULL,
                        amount_asset REAL NOT NULL DEFAULT 0,
                        amount_php REAL NOT NULL DEFAULT 0,
                        term_months INTEGER NOT NULL,
                        monthly_php REAL NOT NULL DEFAULT 0,
                        interest_rate REAL NOT NULL DEFAULT 0,
                        salo_points INTEGER NOT NULL DEFAULT 0,
                        credit_tier TEXT NOT NULL,
                        status TEXT NOT NULL DEFAULT 'pending',
                        review_decision TEXT NOT NULL DEFAULT 'salomed_review',
                        reason_codes TEXT NOT NULL DEFAULT '[]',
                        reviewer TEXT,
                        reviewed_at INTEGER,
                        created_at INTEGER NOT NULL,
                        updated_at INTEGER NOT NULL
                    );
                    CREATE INDEX IF NOT EXISTS idx_salo_requests_status_created
                    ON salo_requests(status, created_at DESC);
                    CREATE INDEX IF NOT EXISTS idx_salo_requests_patient_created
                    ON salo_requests(patient_address, created_at DESC);
                    """
                )
        _INITIALIZED = True
    except Exception:
        _INITIALIZED = False


def _normalize_address(value: str) -> str:
    return value.strip().upper()


def _row_from_values(values: dict[str, Any]) -> dict[str, Any]:
    row = dict(values)
    try:
        row["reason_codes"] = json.loads(row.get("reason_codes") or "[]")
    except Exception:
        row["reason_codes"] = []
    return row


def record(
    *,
    patient_address: str,
    amount_asset: float,
    amount_php: float,
    term_months: int,
    monthly_php: float,
    interest_rate: float,
    salo_points: int,
    credit_tier: str,
    review_decision: str,
    reason_codes: list[str],
) -> dict[str, Any]:
    _init()
    now = int(time.time())
    row = {
        "id": f"SALO-{uuid.uuid4().hex[:12].upper()}",
        "patient_address": _normalize_address(patient_address),
        "amount_asset": float(amount_asset or 0),
        "amount_php": float(amount_php or 0),
        "term_months": int(term_months),
        "monthly_php": float(monthly_php or 0),
        "interest_rate": float(interest_rate or 0),
        "salo_points": int(salo_points or 0),
        "credit_tier": credit_tier,
        "status": "pending",
        "review_decision": review_decision,
        "reason_codes": json.dumps(reason_codes),
        "reviewer": None,
        "reviewed_at": None,
        "created_at": now,
        "updated_at": now,
    }
    try:
        if _USE_PG:
            with _pg_conn() as c:
                with c.cursor() as cur:
                    cur.execute(
                        """
                        INSERT INTO salo_requests
                        (id,patient_address,amount_asset,amount_php,term_months,monthly_php,
                         interest_rate,salo_points,credit_tier,status,review_decision,
                         reason_codes,reviewer,reviewed_at,created_at,updated_at)
                        VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)
                        """,
                        (
                            row["id"], row["patient_address"], row["amount_asset"], row["amount_php"],
                            row["term_months"], row["monthly_php"], row["interest_rate"],
                            row["salo_points"], row["credit_tier"], row["status"],
                            row["review_decision"], row["reason_codes"], row["reviewer"],
                            row["reviewed_at"], row["created_at"], row["updated_at"],
                        ),
                    )
                c.commit()
        else:
            with _sqlite_conn() as c:
                c.execute(
                    """
                    INSERT INTO salo_requests
                    (id,patient_address,amount_asset,amount_php,term_months,monthly_php,
                     interest_rate,salo_points,credit_tier,status,review_decision,
                     reason_codes,reviewer,reviewed_at,created_at,updated_at)
                    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
                    """,
                    (
                        row["id"], row["patient_address"], row["amount_asset"], row["amount_php"],
                        row["term_months"], row["monthly_php"], row["interest_rate"],
                        row["salo_points"], row["credit_tier"], row["status"],
                        row["review_decision"], row["reason_codes"], row["reviewer"],
                        row["reviewed_at"], row["created_at"], row["updated_at"],
                    ),
                )
    except Exception:
        pass
    return _row_from_values(row)


def list_requests(status: str | None = None, limit: int = 100) -> list[dict[str, Any]]:
    _init()
    limit = max(1, min(limit, 200))
    try:
        if _USE_PG:
            with _pg_conn() as c:
                with c.cursor() as cur:
                    if status and status != "all":
                        cur.execute(
                            """
                            SELECT id,patient_address,amount_asset,amount_php,term_months,monthly_php,
                                   interest_rate,salo_points,credit_tier,status,review_decision,
                                   reason_codes,reviewer,reviewed_at,created_at,updated_at
                            FROM salo_requests
                            WHERE status=%s
                            ORDER BY created_at DESC
                            LIMIT %s
                            """,
                            (status, limit),
                        )
                    else:
                        cur.execute(
                            """
                            SELECT id,patient_address,amount_asset,amount_php,term_months,monthly_php,
                                   interest_rate,salo_points,credit_tier,status,review_decision,
                                   reason_codes,reviewer,reviewed_at,created_at,updated_at
                            FROM salo_requests
                            ORDER BY created_at DESC
                            LIMIT %s
                            """,
                            (limit,),
                        )
                    rows = cur.fetchall()
                c.commit()
            cols = [
                "id", "patient_address", "amount_asset", "amount_php", "term_months",
                "monthly_php", "interest_rate", "salo_points", "credit_tier", "status",
                "review_decision", "reason_codes", "reviewer", "reviewed_at", "created_at", "updated_at",
            ]
            return [_row_from_values(dict(zip(cols, row))) for row in rows]
        with _sqlite_conn() as c:
            if status and status != "all":
                rows = c.execute(
                    """
                    SELECT id,patient_address,amount_asset,amount_php,term_months,monthly_php,
                           interest_rate,salo_points,credit_tier,status,review_decision,
                           reason_codes,reviewer,reviewed_at,created_at,updated_at
                    FROM salo_requests
                    WHERE status=?
                    ORDER BY created_at DESC
                    LIMIT ?
                    """,
                    (status, limit),
                ).fetchall()
            else:
                rows = c.execute(
                    """
                    SELECT id,patient_address,amount_asset,amount_php,term_months,monthly_php,
                           interest_rate,salo_points,credit_tier,status,review_decision,
                           reason_codes,reviewer,reviewed_at,created_at,updated_at
                    FROM salo_requests
                    ORDER BY created_at DESC
                    LIMIT ?
                    """,
                    (limit,),
                ).fetchall()
        return [_row_from_values(dict(row)) for row in rows]
    except Exception:
        return []


def decide(request_id: str, status: str, reviewer: str = "SaloMed Admin") -> dict[str, Any] | None:
    _init()
    normalized_status = status.strip().lower()
    if normalized_status not in {"approved", "rejected", "pending"}:
        raise ValueError("Unsupported Salo request status")
    now = int(time.time())
    try:
        if _USE_PG:
            with _pg_conn() as c:
                with c.cursor() as cur:
                    cur.execute(
                        """
                        UPDATE salo_requests
                        SET status=%s, reviewer=%s, reviewed_at=%s, updated_at=%s
                        WHERE id=%s
                        RETURNING id,patient_address,amount_asset,amount_php,term_months,monthly_php,
                                  interest_rate,salo_points,credit_tier,status,review_decision,
                                  reason_codes,reviewer,reviewed_at,created_at,updated_at
                        """,
                        (normalized_status, reviewer, now, now, request_id),
                    )
                    row = cur.fetchone()
                c.commit()
            if not row:
                return None
            cols = [
                "id", "patient_address", "amount_asset", "amount_php", "term_months",
                "monthly_php", "interest_rate", "salo_points", "credit_tier", "status",
                "review_decision", "reason_codes", "reviewer", "reviewed_at", "created_at", "updated_at",
            ]
            return _row_from_values(dict(zip(cols, row)))
        with _sqlite_conn() as c:
            c.execute(
                """
                UPDATE salo_requests
                SET status=?, reviewer=?, reviewed_at=?, updated_at=?
                WHERE id=?
                """,
                (normalized_status, reviewer, now, now, request_id),
            )
            row = c.execute(
                """
                SELECT id,patient_address,amount_asset,amount_php,term_months,monthly_php,
                       interest_rate,salo_points,credit_tier,status,review_decision,
                       reason_codes,reviewer,reviewed_at,created_at,updated_at
                FROM salo_requests
                WHERE id=?
                """,
                (request_id,),
            ).fetchone()
        return _row_from_values(dict(row)) if row else None
    except Exception:
        return None
