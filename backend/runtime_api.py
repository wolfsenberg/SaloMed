from __future__ import annotations

from decimal import Decimal

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel, Field

from salomed_runtime import DemoLedger, LedgerError, PostgresLedger, RuntimeMode, RuntimeSettings


class TopUpRequest(BaseModel):
    beneficiary_address: str
    amount_php: Decimal = Field(gt=0, max_digits=12, decimal_places=2)
    idempotency_key: str = Field(min_length=8, max_length=128)
    # Top-up method label: gcash | instapay | freighter. Unknown values are
    # coerced to None so a bad label can never block a real credit.
    source: str | None = Field(default=None, max_length=16)


class PaymentRequest(BaseModel):
    patient_address: str
    provider_id: str = Field(min_length=1, max_length=128)
    amount_asset: Decimal = Field(gt=0, max_digits=18, decimal_places=7)
    idempotency_key: str = Field(min_length=8, max_length=128)


class RemittanceRequest(BaseModel):
    sender_address: str
    beneficiary_address: str
    amount_asset: Decimal = Field(gt=0, max_digits=18, decimal_places=7)
    idempotency_key: str = Field(min_length=8, max_length=128)


class EnsureFeesRequest(BaseModel):
    address: str = Field(min_length=56, max_length=56)


class HistoryRecordRequest(BaseModel):
    address: str = Field(min_length=56, max_length=56)
    type: str = Field(min_length=1, max_length=32)
    amount_asset: Decimal = Field(ge=0, max_digits=20, decimal_places=7)
    amount_php: Decimal = Field(ge=0, max_digits=20, decimal_places=2)
    direction: str | None = Field(default=None, max_length=16)
    counterparty: str | None = Field(default=None, max_length=128)
    tx_hash: str | None = Field(default=None, max_length=128)
    status: str = Field(default="success", max_length=16)
    source: str | None = Field(default=None, max_length=16)


# Allowed top-up method labels. Anything else is stored as NULL (generic top-up).
_ALLOWED_TOPUP_SOURCES = {"gcash", "instapay", "freighter"}


def _normalize_topup_source(value: str | None) -> str | None:
    """Coerce a top-up method label to the allow-list, else None."""
    if not value:
        return None
    normalized = value.strip().lower()
    return normalized if normalized in _ALLOWED_TOPUP_SOURCES else None


def _ledger_call(function, *args):
    try:
        return function(*args)
    except LedgerError as exc:
        raise HTTPException(
            status_code=exc.status_code,
            detail={"error": exc.code, "message": exc.message},
        ) from exc


def create_runtime_router(settings: RuntimeSettings, demo_ledger: "DemoLedger | PostgresLedger") -> APIRouter:
    router = APIRouter()

    @router.post("/api/v2/ensure-fees", tags=["Runtime"])
    async def ensure_fees(body: EnsureFeesRequest):
        """
        Ensure a user's wallet can pay transaction fees for payment/padala.
        In Stellar modes this creates/tops-up the account with a little XLM from
        the admin. In demo mode it is a no-op (no on-chain fees).
        """
        if settings.mode is RuntimeMode.DEMO:
            return {"funded": True, "mode": "demo", "note": "no on-chain fees in demo mode"}
        import stellar_bridge
        result = stellar_bridge.ensure_fee_funds(body.address)
        return {"mode": settings.mode.value, **result}

    @router.get("/api/runtime", tags=["Runtime"])
    async def runtime_status():
        simulated = settings.mode is RuntimeMode.DEMO
        stellar_tracking_enabled = not simulated
        return {
            "mode": settings.mode.value,
            "asset_code": settings.asset_code,
            "contract_id": settings.contract_id,
            "network": settings.network,
            "expected_token_id": settings.expected_token_id,
            "admin_address": settings.admin_address,
            "php_per_asset": f"{settings.php_per_asset_decimal:.2f}",
            "simulated": simulated,
            "real_money_enabled": False,
            "history_source": "demo_ledger" if simulated else "soroban_contract_events",
            "stellar_tracking_enabled": stellar_tracking_enabled,
        }

    @router.get("/api/v2/providers", tags=["Runtime"])
    async def providers():
        if settings.mode is not RuntimeMode.DEMO:
            return {"providers": [], "source": "contract_configuration"}
        return {"providers": demo_ledger.list_providers(), "source": "demo_ledger"}

    @router.get("/api/v2/vaults/{address}", tags=["Vault v2"])
    async def vault(address: str):
        if settings.mode is not RuntimeMode.DEMO:
            raise HTTPException(
                status_code=501,
                detail={
                    "error": "USE_STELLAR_CONTRACT",
                    "message": "Non-demo vault state must be read from the configured Soroban contract",
                },
            )
        return _ledger_call(demo_ledger.get_vault, address)

    @router.get("/api/v2/vaults/{address}/transactions", tags=["Vault v2"])
    async def transactions(address: str, limit: int = Query(50, ge=1, le=100)):
        # Address-keyed history follows the wallet across devices. In demo mode
        # this is the durable demo ledger; in Stellar modes it is the backend
        # history index (a read-cache of on-chain activity; each row keeps its
        # real tx hash for Explorer verification).
        if settings.mode is RuntimeMode.DEMO:
            return {"transactions": _ledger_call(demo_ledger.history, address, limit)}
        import history_store
        return {"transactions": history_store.history(address, limit), "source": "backend_index"}

    @router.post("/api/v2/history/record", tags=["Vault v2"])
    async def record_history(body: HistoryRecordRequest):
        """Record a transaction against a Stellar address so it follows the wallet."""
        import history_store
        row = history_store.record(
            address=body.address,
            tx_type=body.type,
            amount_asset=float(body.amount_asset),
            amount_php=float(body.amount_php),
            direction=body.direction,
            counterparty=body.counterparty,
            tx_hash=body.tx_hash,
            status=body.status,
            source=body.source,
        )
        return {"recorded": True, "id": row["id"]}

    @router.post("/api/v2/topups", tags=["Vault v2"])
    async def topup(body: TopUpRequest):
        # Stellar modes: fund the vault on-chain via the admin bridge, so the
        # user does not need to pre-hold the asset or a trustline (admin is the
        # on-ramp float). This is the fiat on-ramp credit path used by GCash /
        # InstaPay / Freighter top-ups. The method label is recorded on the row.
        method = _normalize_topup_source(body.source)
        if settings.mode is not RuntimeMode.DEMO:
            import stellar_bridge
            import pdax_service as pdax

            if not stellar_bridge.is_bridge_configured():
                raise HTTPException(
                    status_code=503,
                    detail={"error": "BRIDGE_NOT_CONFIGURED",
                            "message": "On-chain on-ramp requires SALOMED_SIGNER_SECRET + CONTRACT_ID."},
                )
            # Strict live rate (Req 10.3): the credited amount MUST come from a
            # live PDAX quote. No fixed/indicative fallback is allowed to settle
            # a real credit; when the live rate is unavailable we reject the
            # top-up and leave the vault unchanged.
            quote = await pdax.get_php_to_asset_quote(
                float(body.amount_php),
                settings.asset_code,
                fallback_rate=float(settings.php_per_asset_decimal),
            )
            asset_amount = float(quote.get("asset_amount") or 0)
            if quote.get("source") != "pdax_live" or asset_amount <= 0:
                raise HTTPException(
                    status_code=503,
                    detail={"error": "RATE_UNAVAILABLE",
                            "message": "Live PDAX rate unavailable; top-up cannot be completed."},
                )
            try:
                tx_hash = stellar_bridge.credit_vault_usdc(body.beneficiary_address, asset_amount)
            except stellar_bridge.BridgeError as exc:
                raise HTTPException(status_code=502,
                                    detail={"error": "ONCHAIN_CREDIT_FAILED", "message": str(exc)}) from exc
            import history_store
            history_store.record(
                address=body.beneficiary_address, tx_type="topup",
                amount_asset=asset_amount, amount_php=float(body.amount_php),
                direction="received", tx_hash=tx_hash, source=method,
            )
            return {
                "success": True,
                "mode": settings.mode.value,
                "simulated": False,
                "transaction_id": tx_hash,
                "status": "completed",
                "beneficiary_address": body.beneficiary_address,
                "amount_php": f"{body.amount_php:.2f}",
                "amount_asset": f"{asset_amount:.7f}",
                "asset_code": settings.asset_code,
                "source": method,
            }
        return _ledger_call(
            demo_ledger.topup,
            body.beneficiary_address,
            body.amount_php,
            body.idempotency_key,
            method,
        )

    @router.post("/api/v2/payments", tags=["Vault v2"])
    async def payment(body: PaymentRequest):
        if settings.mode is not RuntimeMode.DEMO:
            raise HTTPException(
                status_code=409,
                detail={
                    "error": "WRONG_RUNTIME_MODE",
                    "message": "Use a patient-signed Soroban payment in Stellar mode",
                },
            )
        return _ledger_call(
            demo_ledger.payment,
            body.patient_address,
            body.provider_id,
            body.amount_asset,
            body.idempotency_key,
        )

    @router.post("/api/v2/remittances", tags=["Vault v2"])
    async def remittance(body: RemittanceRequest):
        if settings.mode is not RuntimeMode.DEMO:
            raise HTTPException(
                status_code=409,
                detail={
                    "error": "WRONG_RUNTIME_MODE",
                    "message": "Use a sender-signed Soroban deposit_remittance in Stellar mode",
                },
            )
        return _ledger_call(
            demo_ledger.remittance,
            body.sender_address,
            body.beneficiary_address,
            body.amount_asset,
            body.idempotency_key,
        )

    return router
