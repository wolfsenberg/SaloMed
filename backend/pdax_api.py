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


_credits = _CreditStore()

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
    async def quote(amount_php: float = Query(..., gt=0), asset: str = Query("USDC")):
        require_pdax()
        return await pdax.get_php_to_asset_quote(amount_php, asset,
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
        # quote the USDC the user will receive for display/credit
        quote = await pdax.get_php_to_asset_quote(float(body.amount_php), "USDC",
                                                  fallback_rate=float(settings.php_per_asset_decimal))
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
            return {"credited": False, "pdax_status": "pending"}
        pdax_status = status_info.get("status", "")
        if pdax_status not in _COMPLETED_STATUSES:
            return {"credited": False, "pdax_status": pdax_status}

        # Completed on PDAX -> credit USDC on-chain
        quote = await pdax.get_php_to_asset_quote(status_info.get("amount", 0), "USDC",
                                                  fallback_rate=float(settings.php_per_asset_decimal))
        usdc_amount = quote.get("asset_amount", 0)
        if usdc_amount <= 0:
            raise HTTPException(status_code=502, detail={"error": "QUOTE_FAILED",
                                "message": "Could not determine USDC amount to credit"})
        try:
            tx_hash = stellar_bridge.credit_vault_usdc(beneficiary, usdc_amount)
        except stellar_bridge.BridgeError as exc:
            raise HTTPException(status_code=502, detail={"error": "ONCHAIN_CREDIT_FAILED",
                                "message": str(exc)}) from exc
        _credits.put(identifier, tx_hash)
        return {"credited": True, "already": False, "tx_hash": tx_hash,
                "usdc_amount": usdc_amount, "pdax_status": pdax_status}

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
        identifier = event.get("reference") or payload.get("identifier", "")
        beneficiary = payload.get("beneficiary_address") or payload.get("metadata", {}).get("beneficiary_address", "")
        if not identifier or not beneficiary:
            return {"received": True, "credited": False, "note": "missing identifier/beneficiary"}
        return await _credit_if_completed(identifier, beneficiary)

    return router
