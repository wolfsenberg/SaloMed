"""
Provider-keyed payment index.

This complements address-keyed patient history. A payment is still settled by
the existing SaloMed flow, then indexed here by whitelisted provider address so
the provider portal can work across users, browsers, and devices.

Storage follows history_store: PostgreSQL when DATABASE_URL is set, else local
SQLite.
"""

from __future__ import annotations

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
                        CREATE TABLE IF NOT EXISTS provider_payments (
                            id TEXT PRIMARY KEY,
                            patient_address TEXT NOT NULL,
                            provider_address TEXT NOT NULL,
                            provider_name TEXT NOT NULL,
                            provider_type TEXT NOT NULL,
                            amount_asset DOUBLE PRECISION NOT NULL DEFAULT 0,
                            amount_php DOUBLE PRECISION NOT NULL DEFAULT 0,
                            tx_hash TEXT,
                            status TEXT NOT NULL DEFAULT 'success',
                            created_at BIGINT NOT NULL
                        );
                        CREATE INDEX IF NOT EXISTS idx_provider_payments_provider_created
                        ON provider_payments(provider_address, created_at DESC);
                        CREATE UNIQUE INDEX IF NOT EXISTS idx_provider_payments_tx_hash_unique
                        ON provider_payments(tx_hash)
                        WHERE tx_hash IS NOT NULL;
                        """
                    )
                c.commit()
        else:
            with _sqlite_conn() as c:
                c.executescript(
                    """
                    CREATE TABLE IF NOT EXISTS provider_payments (
                        id TEXT PRIMARY KEY,
                        patient_address TEXT NOT NULL,
                        provider_address TEXT NOT NULL,
                        provider_name TEXT NOT NULL,
                        provider_type TEXT NOT NULL,
                        amount_asset REAL NOT NULL DEFAULT 0,
                        amount_php REAL NOT NULL DEFAULT 0,
                        tx_hash TEXT,
                        status TEXT NOT NULL DEFAULT 'success',
                        created_at INTEGER NOT NULL
                    );
                    CREATE INDEX IF NOT EXISTS idx_provider_payments_provider_created
                    ON provider_payments(provider_address, created_at DESC);
                    CREATE UNIQUE INDEX IF NOT EXISTS idx_provider_payments_tx_hash_unique
                    ON provider_payments(tx_hash)
                    WHERE tx_hash IS NOT NULL;
                    """
                )
        _INITIALIZED = True
    except Exception:
        _INITIALIZED = False


def _normalize_address(value: str) -> str:
    return value.strip().upper()


def record(
    *,
    patient_address: str,
    provider_address: str,
    provider_name: str,
    provider_type: str,
    amount_asset: float,
    amount_php: float,
    tx_hash: str | None,
    status: str = "success",
) -> dict[str, Any]:
    _init()
    row = {
        "id": uuid.uuid4().hex,
        "patient_address": _normalize_address(patient_address),
        "provider_address": _normalize_address(provider_address),
        "provider_name": provider_name.strip() or "Whitelisted provider",
        "provider_type": provider_type.strip().lower() or "provider",
        "amount_asset": float(amount_asset or 0),
        "amount_php": float(amount_php or 0),
        "tx_hash": tx_hash,
        "status": status,
        "created_at": int(time.time()),
    }
    try:
        if _USE_PG:
            with _pg_conn() as c:
                with c.cursor() as cur:
                    cur.execute(
                        """
                        INSERT INTO provider_payments
                        (id,patient_address,provider_address,provider_name,provider_type,
                         amount_asset,amount_php,tx_hash,status,created_at)
                        VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)
                        ON CONFLICT (tx_hash) WHERE tx_hash IS NOT NULL DO UPDATE SET
                            patient_address=EXCLUDED.patient_address,
                            provider_address=EXCLUDED.provider_address,
                            provider_name=EXCLUDED.provider_name,
                            provider_type=EXCLUDED.provider_type,
                            amount_asset=EXCLUDED.amount_asset,
                            amount_php=EXCLUDED.amount_php,
                            status=EXCLUDED.status
                        RETURNING id,patient_address,provider_address,provider_name,provider_type,
                                  amount_asset,amount_php,tx_hash,status,created_at
                        """,
                        (
                            row["id"], row["patient_address"], row["provider_address"],
                            row["provider_name"], row["provider_type"], row["amount_asset"],
                            row["amount_php"], row["tx_hash"], row["status"], row["created_at"],
                        ),
                    )
                    returned = cur.fetchone()
                c.commit()
            cols = [
                "id", "patient_address", "provider_address", "provider_name", "provider_type",
                "amount_asset", "amount_php", "tx_hash", "status", "created_at",
            ]
            return dict(zip(cols, returned)) if returned else row
        with _sqlite_conn() as c:
            c.execute(
                """
                INSERT INTO provider_payments
                (id,patient_address,provider_address,provider_name,provider_type,
                 amount_asset,amount_php,tx_hash,status,created_at)
                VALUES (?,?,?,?,?,?,?,?,?,?)
                ON CONFLICT(tx_hash) WHERE tx_hash IS NOT NULL DO UPDATE SET
                    patient_address=excluded.patient_address,
                    provider_address=excluded.provider_address,
                    provider_name=excluded.provider_name,
                    provider_type=excluded.provider_type,
                    amount_asset=excluded.amount_asset,
                    amount_php=excluded.amount_php,
                    status=excluded.status
                """,
                (
                    row["id"], row["patient_address"], row["provider_address"],
                    row["provider_name"], row["provider_type"], row["amount_asset"],
                    row["amount_php"], row["tx_hash"], row["status"], row["created_at"],
                ),
            )
    except Exception:
        pass
    return row


def payments_for_provider(provider_address: str, limit: int = 100) -> list[dict[str, Any]]:
    _init()
    address = _normalize_address(provider_address)
    limit = max(1, min(limit, 200))
    try:
        if _USE_PG:
            with _pg_conn() as c:
                with c.cursor() as cur:
                    cur.execute(
                        """
                        SELECT id,patient_address,provider_address,provider_name,provider_type,
                               amount_asset,amount_php,tx_hash,status,created_at
                        FROM provider_payments
                        WHERE provider_address=%s
                        ORDER BY created_at DESC
                        LIMIT %s
                        """,
                        (address, limit),
                    )
                    rows = cur.fetchall()
                c.commit()
            cols = [
                "id", "patient_address", "provider_address", "provider_name", "provider_type",
                "amount_asset", "amount_php", "tx_hash", "status", "created_at",
            ]
            return [dict(zip(cols, row)) for row in rows]
        with _sqlite_conn() as c:
            rows = c.execute(
                """
                SELECT id,patient_address,provider_address,provider_name,provider_type,
                       amount_asset,amount_php,tx_hash,status,created_at
                FROM provider_payments
                WHERE provider_address=?
                ORDER BY created_at DESC
                LIMIT ?
                """,
                (address, limit),
            ).fetchall()
        return [dict(row) for row in rows]
    except Exception:
        return []
