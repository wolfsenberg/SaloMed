from __future__ import annotations

import os
import sqlite3
import time
from decimal import Decimal
from pathlib import Path

from fastapi import APIRouter, HTTPException, Query, Request
from pydantic import BaseModel, Field

from salomed_runtime import RuntimeMode, RuntimeSettings

import pdax_service as pdax
import stellar_bridge


class PdaxDepositRequest(BaseModel):
    amount_php: Decimal = Field(gt=0, le=50_000, max_digits=12, decimal_places=2)
    beneficiary_address: str = Field(min_length=56, max_length=56)
    sender_first_name: str = Field(default="SaloMed", max_length=64)
    sender_last_name: str = Field(default="User", max_length=64)


class PdaxConfirmRequest(BaseModel):
    identifier: str = Field(min_length=4, max_length=128)
    beneficiary_address: str = Field(min_length=56, max_length=56)


class _CreditStore:
    """
    Idempotency store: records which PDAX deposit identifiers have already been
    credited on-chain, so poll and webhook cannot double-credit. Best-effort
    SQLite persistence; degrades to in-memory if the file is unavailable.
    """

    def __init__(self) -> None:
        self._mem: dict[str, str] = {}
        self._path = os.getenv(
            "SALOMED_DB_PATH",
            str(Path(__file__).resolve().parent / "data" / "salomed.sqlite3"),
        )
        try:
            Path(self._path).parent.mkdir(parents=True, exist_ok=True)
            with sqlite3.connect(self._path, timeout=10) as c:
                c.execute(
                    "CREATE TABLE IF NOT EXISTS pdax_credits ("
                    "identifier TEXT PRIMARY KEY, tx_hash TEXT NOT NULL, created_at INTEGER NOT NULL)"
                )
            self._db_ok = True
        except Exception:
            self._db_ok = False

    def get(self, identifier: str) -> str | None:
        if identifier in self._mem:
            return self._mem[identifier]
        if self._db_ok:
            try:
                with sqlite3.connect(self._path, timeout=10) as c:
                    row = c.execute(
                        "SELECT tx_hash FROM pdax_credits WHERE identifier=?", (identifier,)
                    ).fetchone()
                if row:
                    self._mem[identifier] = row[0]
                    return row[0]
            except Exception:
                pass
        return None

    def put(self, identifier: str, tx_hash: str) -> None:
        self._mem[identifier] = tx_hash
        if self._db_ok:
            try:
                with sqlite3.connect(self._path, timeout=10) as c:
                    c.execute(
                        "INSERT OR IGNORE INTO pdax_credits(identifier, tx_hash, created_at) VALUES (?,?,?)",
                        (identifier, tx_hash, int(time.time())),
                    )
            except Exception:
                pass


class _DepositStore:
    """
    Tracks PDAX deposit intent separately from credit idempotency. This lets a
    webhook map a PDAX identifier back to the vault beneficiary without trusting
    callback-only metadata.
    """

    def __init__(self) -> None:
        self._mem: dict[str, dict] = {}
        self._path = os.getenv(
            "SALOMED_DB_PATH",
            str(Path(__file__).resolve().parent / "data" / "salomed.sqlite3"),
        )
        try:
            Path(self._path).parent.mkdir(parents=True, exist_ok=True)
            with sqlite3.connect(self._path, timeout=10) as c:
                c.execute(
                    """
                    CREATE TABLE IF NOT EXISTS pdax_deposits (
                        identifier TEXT PRIMARY KEY,
                        beneficiary_address TEXT NOT NULL,
                        amount_php TEXT NOT NULL,
                        pdax_status TEXT NOT NULL,
                        reference_number TEXT,
                        checkout_url TEXT,
                        request_id TEXT,
                        created_at INTEGER NOT NULL,
                        updated_at INTEGER NOT NULL
                    )
                    """
                )
            self._db_ok = True
        except Exception:
            self._db_ok = False

    def put(
        self,
        *,
        identifier: str,
        beneficiary_address: str,
        amount_php: Decimal | float | str,
        pdax_status: str,
        reference_number: str = "",
        checkout_url: str = "",
        request_id: str = "",
    ) -> None:
        now = int(time.time())
        row = {
            "identifier": identifier,
            "beneficiary_address": beneficiary_address,
            "amount_php": f"{Decimal(str(amount_php)):.2f}",
            "pdax_status": pdax_status.lower() or "pending",
            "reference_number": reference_number,
            "checkout_url": checkout_url,
            "request_id": request_id,
            "created_at": now,
            "updated_at": now,
        }
        self._mem[identifier] = row
        if self._db_ok:
            try:
                with sqlite3.connect(self._path, timeout=10) as c:
                    c.execute(
                        """
                        INSERT INTO pdax_deposits(
                            identifier, beneficiary_address, amount_php, pdax_status,
                            reference_number, checkout_url, request_id, created_at, updated_at
                        )
                        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                        ON CONFLICT(identifier) DO UPDATE SET
                            beneficiary_address=excluded.beneficiary_address,
                            amount_php=excluded.amount_php,
                            pdax_status=excluded.pdax_status,
                            reference_number=excluded.reference_number,
                            checkout_url=excluded.checkout_url,
                            request_id=excluded.request_id,
                            updated_at=excluded.updated_at
                        """,
                        (
                            row["identifier"],
                            row["beneficiary_address"],
                            row["amount_php"],
                            row["pdax_status"],
                            row["reference_number"],
                            row["checkout_url"],
                            row["request_id"],
                            row["created_at"],
                            row["updated_at"],
                        ),
                    )
            except Exception:
                pass

    def get(self, identifier: str) -> dict | None:
        if identifier in self._mem:
            return self._mem[identifier]
        if self._db_ok:
            try:
                with sqlite3.connect(self._path, timeout=10) as c:
                    c.row_factory = sqlite3.Row
                    row = c.execute(
                        "SELECT * FROM pdax_deposits WHERE identifier=?", (identifier,)
                    ).fetchone()
                if row:
                    stored = dict(row)
                    self._mem[identifier] = stored
                    return stored
            except Exception:
                pass
        return None

    def update_status(self, identifier: str, pdax_status: str) -> None:
        stored = self.get(identifier)
        if stored:
            stored["pdax_status"] = pdax_status.lower() or stored["pdax_status"]
            stored["updated_at"] = int(time.time())
            self._mem[identifier] = stored
        if self._db_ok:
            try:
                with sqlite3.connect(self._path, timeout=10) as c:
                    c.execute(
                        "UPDATE pdax_deposits SET pdax_status=?, updated_at=? WHERE identifier=?",
                        (pdax_status.lower(), int(time.time()), identifier),
                    )
            except Exception:
                pass


_credits = _CreditStore()
_deposits = _DepositStore()

_COMPLETED_STATUSES = {"completed", "success", "successful", "settled", "done"}


def create_pdax_router(settings: RuntimeSettings) -> APIRouter:
    """
    PDAX InstaPay on-ramp. Enabled whenever PDAX credentials are configured and
    the runtime is a Stellar or PDAX mode, so it works alongside stellar_testnet
    / stellar mainnet without disabling the on-chain flow.
    """
    router = APIRouter()

    stellar_modes = {RuntimeMode.STELLAR_TESTNET, RuntimeMode.PDAX_UAT, RuntimeMode.PDAX_PROD}

    def pdax_enabled() -> bool:
        return pdax._PDAX_CONFIGURED and settings.mode in stellar_modes

    def require_pdax() -> None:
        if not pdax_enabled():
            raise HTTPException(
                status_code=409,
                detail={
                    "error": "PDAX_DISABLED",
                    "message": "PDAX on-ramp is not enabled in this runtime configuration.",
                },
            )

    @router.get("/api/pdax/status", tags=["PDAX"])
    async def status():
        if not pdax_enabled():
            return {"configured": False, "mode": settings.mode.value, "connected": False,
                    "message": "PDAX on-ramp not enabled in this mode"}
        health = await pdax.health_check()
        balances = await pdax.get_pdax_balances()
        return {
            "configured": True,
            "mode": settings.mode.value,
            "connected": health.get("status") == "OK",
            "status": health.get("status"),
            "balances": balances.get("balances", {}) if balances.get("success") else {},
        }

    @router.get("/api/pdax/quote", tags=["PDAX"])
    async def quote(amount_php: float = Query(..., gt=0), asset: str | None = Query(None)):
        require_pdax()
        vault_asset = (asset or settings.asset_code).upper()
        return await pdax.get_php_to_asset_quote(amount_php, vault_asset,
                                                 fallback_rate=float(settings.php_per_asset_decimal))

    @router.post("/api/pdax/deposit", tags=["PDAX"])
    async def create_deposit(body: PdaxDepositRequest):
        require_pdax()
        result = await pdax.initiate_instapay_deposit(
            amount_php=float(body.amount_php),
            sender_first_name=body.sender_first_name,
            sender_last_name=body.sender_last_name,
        )
        if not result["success"]:
            raise HTTPException(
                status_code=502,
                detail={"error": "PDAX_DEPOSIT_FAILED", "message": result.get("error", "deposit failed")},
            )
        # Quote the configured vault asset (XLM by default), so the PDAX display
        # matches the amount credited to the SaloMed contract.
        vault_asset = settings.asset_code
        quote = await pdax.get_php_to_asset_quote(float(body.amount_php), vault_asset,
                                                  fallback_rate=float(settings.php_per_asset_decimal))
        _deposits.put(
            identifier=result["identifier"],
            beneficiary_address=body.beneficiary_address,
            amount_php=body.amount_php,
            pdax_status=result.get("status", "pending"),
            reference_number=result.get("reference_number", ""),
            checkout_url=result.get("checkout_url", ""),
            request_id=result.get("request_id", ""),
        )
        result["asset_code"] = vault_asset
        result["asset_amount"] = quote.get("asset_amount")
        result["usdc_amount"] = quote.get("asset_amount")
        result["rate"] = quote.get("rate")
        result["rate_source"] = quote.get("source")
        return result

    async def _credit_if_completed(identifier: str, beneficiary: str) -> dict:
        # Idempotency: already credited?
        existing = _credits.get(identifier)
        if existing:
            return {"credited": True, "already": True, "tx_hash": existing}

        status_info = await pdax.get_deposit_status(identifier)
        if not status_info.get("found"):
            _deposits.update_status(identifier, "pending")
            return {"credited": False, "pdax_status": "pending"}
        pdax_status = status_info.get("status", "")
        _deposits.update_status(identifier, pdax_status)
        if pdax_status not in _COMPLETED_STATUSES:
            return {"credited": False, "pdax_status": pdax_status}

        # Completed on PDAX -> credit the configured vault asset on-chain.
        vault_asset = settings.asset_code
        quote = await pdax.get_php_to_asset_quote(status_info.get("amount", 0), vault_asset,
                                                  fallback_rate=float(settings.php_per_asset_decimal))
        asset_amount = quote.get("asset_amount", 0)
        if asset_amount <= 0:
            raise HTTPException(status_code=502, detail={"error": "QUOTE_FAILED",
                                "message": f"Could not determine {vault_asset} amount to credit"})
        try:
            tx_hash = stellar_bridge.credit_vault_usdc(beneficiary, asset_amount)
        except stellar_bridge.BridgeError as exc:
            raise HTTPException(status_code=502, detail={"error": "ONCHAIN_CREDIT_FAILED",
                                "message": str(exc)}) from exc
        _credits.put(identifier, tx_hash)
        # Record the InstaPay top-up in the address-keyed history index so both
        # InstaPay branches (real PDAX settlement and admin-credit fallback)
        # label identically as "Top-up via InstaPay" and stay Explorer-traceable.
        try:
            import history_store
            history_store.record(
                address=beneficiary, tx_type="topup",
                amount_asset=float(asset_amount),
                amount_php=float(status_info.get("amount", 0) or 0),
                direction="received", tx_hash=tx_hash, source="instapay",
            )
        except Exception:
            pass
        return {"credited": True, "already": False, "tx_hash": tx_hash,
                "asset_code": vault_asset, "asset_amount": asset_amount,
                "usdc_amount": asset_amount, "pdax_status": pdax_status}

    @router.get("/api/pdax/deposits/{identifier}", tags=["PDAX"])
    async def deposit_status(identifier: str):
        require_pdax()
        stored = _deposits.get(identifier)
        status_info = await pdax.get_deposit_status(identifier)
        pdax_status = status_info.get("status", stored.get("pdax_status") if stored else "pending")
        if stored and pdax_status:
            _deposits.update_status(identifier, pdax_status)
            stored = _deposits.get(identifier) or stored
        return {
            "identifier": identifier,
            "found": bool(stored or status_info.get("found")),
            "pdax_status": pdax_status,
            "beneficiary_address": stored.get("beneficiary_address") if stored else None,
            "amount_php": stored.get("amount_php") if stored else status_info.get("amount"),
            "credited": _credits.get(identifier) is not None,
            "tx_hash": _credits.get(identifier),
        }

    @router.post("/api/pdax/confirm", tags=["PDAX"])
    async def confirm(body: PdaxConfirmRequest):
        require_pdax()
        return await _credit_if_completed(body.identifier, body.beneficiary_address)

    @router.post("/api/pdax/webhook", tags=["PDAX"])
    async def webhook(request: Request):
        require_pdax()
        raw = await request.body()
        sig = request.headers.get("x-pdax-signature") or request.headers.get("x-signature", "")
        if not pdax.verify_webhook_signature(raw, sig):
            raise HTTPException(status_code=401, detail={"error": "BAD_SIGNATURE"})
        import json
        try:
            payload = json.loads(raw.decode("utf-8"))
        except Exception:
            raise HTTPException(status_code=400, detail={"error": "BAD_PAYLOAD"})
        event = pdax.process_webhook_event(payload)
        metadata = payload.get("metadata", {}) if isinstance(payload.get("metadata"), dict) else {}
        identifier = payload.get("identifier") or metadata.get("identifier") or event.get("reference") or ""
        stored = _deposits.get(identifier) if identifier else None
        beneficiary = (
            payload.get("beneficiary_address")
            or metadata.get("beneficiary_address")
            or (stored.get("beneficiary_address") if stored else "")
        )
        if not identifier or not beneficiary:
            return {"received": True, "credited": False, "note": "missing identifier/beneficiary"}
        return await _credit_if_completed(identifier, beneficiary)

    return router
