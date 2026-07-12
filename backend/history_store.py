"""
Address-keyed transaction history store.

Records every SaloMed transaction (top-up, payment, padala, loan) keyed by the
user's Stellar address, so history follows the WALLET, not the browser. Any
device that connects the same address sees the same history.

This is a backend read-cache of on-chain activity (the standard "indexer/cache"
pattern): each row carries the real Stellar tx hash so it stays independently
verifiable on Stellar Explorer.

Storage: PostgreSQL when DATABASE_URL is set (deployed), else SQLite (local).
Both share the same interface; the app never needs to know which is active.
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


_INITIALIZED = False


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
                        CREATE TABLE IF NOT EXISTS tx_history (
                            id TEXT PRIMARY KEY,
                            address TEXT NOT NULL,
                            type TEXT NOT NULL,
                            direction TEXT,
                            amount_asset DOUBLE PRECISION NOT NULL DEFAULT 0,
                            amount_php DOUBLE PRECISION NOT NULL DEFAULT 0,
                            counterparty TEXT,
                            tx_hash TEXT,
                            status TEXT NOT NULL DEFAULT 'success',
                            created_at BIGINT NOT NULL
                        );
                        CREATE INDEX IF NOT EXISTS idx_txhist_addr_created
                        ON tx_history(address, created_at DESC);
                        """
                    )
                c.commit()
        else:
            with _sqlite_conn() as c:
                c.executescript(
                    """
                    CREATE TABLE IF NOT EXISTS tx_history (
                        id TEXT PRIMARY KEY,
                        address TEXT NOT NULL,
                        type TEXT NOT NULL,
                        direction TEXT,
                        amount_asset REAL NOT NULL DEFAULT 0,
                        amount_php REAL NOT NULL DEFAULT 0,
                        counterparty TEXT,
                        tx_hash TEXT,
                        status TEXT NOT NULL DEFAULT 'success',
                        created_at INTEGER NOT NULL
                    );
                    CREATE INDEX IF NOT EXISTS idx_txhist_addr_created
                    ON tx_history(address, created_at DESC);
                    """
                )
        _INITIALIZED = True
    except Exception:
        # Non-fatal: history recording should never break a transaction.
        _INITIALIZED = False


def record(
    address: str,
    tx_type: str,
    amount_asset: float,
    amount_php: float,
    direction: str | None = None,
    counterparty: str | None = None,
    tx_hash: str | None = None,
    status: str = "success",
) -> dict[str, Any]:
    """Persist one transaction for `address`. Returns the stored row (best effort)."""
    _init()
    addr = address.strip().upper()
    row = {
        "id": uuid.uuid4().hex,
        "address": addr,
        "type": tx_type,
        "direction": direction,
        "amount_asset": float(amount_asset or 0),
        "amount_php": float(amount_php or 0),
        "counterparty": counterparty,
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
                        INSERT INTO tx_history
                        (id,address,type,direction,amount_asset,amount_php,counterparty,tx_hash,status,created_at)
                        VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)
                        """,
                        (row["id"], row["address"], row["type"], row["direction"],
                         row["amount_asset"], row["amount_php"], row["counterparty"],
                         row["tx_hash"], row["status"], row["created_at"]),
                    )
                c.commit()
        else:
            with _sqlite_conn() as c:
                c.execute(
                    """
                    INSERT INTO tx_history
                    (id,address,type,direction,amount_asset,amount_php,counterparty,tx_hash,status,created_at)
                    VALUES (?,?,?,?,?,?,?,?,?,?)
                    """,
                    (row["id"], row["address"], row["type"], row["direction"],
                     row["amount_asset"], row["amount_php"], row["counterparty"],
                     row["tx_hash"], row["status"], row["created_at"]),
                )
    except Exception:
        pass
    return row


def history(address: str, limit: int = 50) -> list[dict[str, Any]]:
    """Return transactions for `address`, newest first."""
    _init()
    addr = address.strip().upper()
    limit = max(1, min(limit, 200))
    try:
        if _USE_PG:
            with _pg_conn() as c:
                with c.cursor() as cur:
                    cur.execute(
                        """
                        SELECT id,type,direction,amount_asset,amount_php,counterparty,tx_hash,status,created_at
                        FROM tx_history WHERE address=%s ORDER BY created_at DESC LIMIT %s
                        """,
                        (addr, limit),
                    )
                    rows = cur.fetchall()
                c.commit()
            cols = ["id", "type", "direction", "amount_asset", "amount_php",
                    "counterparty", "tx_hash", "status", "created_at"]
            return [dict(zip(cols, r)) for r in rows]
        else:
            with _sqlite_conn() as c:
                rows = c.execute(
                    """
                    SELECT id,type,direction,amount_asset,amount_php,counterparty,tx_hash,status,created_at
                    FROM tx_history WHERE address=? ORDER BY created_at DESC LIMIT ?
                    """,
                    (addr, limit),
                ).fetchall()
            return [dict(r) for r in rows]
    except Exception:
        return []
