from __future__ import annotations

from decimal import Decimal

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel, Field

from salomed_runtime import DemoLedger, LedgerError, RuntimeMode, RuntimeSettings


class TopUpRequest(BaseModel):
    beneficiary_address: str
    amount_php: Decimal = Field(gt=0, max_digits=12, decimal_places=2)
    idempotency_key: str = Field(min_length=8, max_length=128)


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


def _ledger_call(function, *args):
    try:
        return function(*args)
    except LedgerError as exc:
        raise HTTPException(
            status_code=exc.status_code,
            detail={"error": exc.code, "message": exc.message},
        ) from exc


def create_runtime_router(settings: RuntimeSettings, demo_ledger: DemoLedger) -> APIRouter:
    router = APIRouter()

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
        if settings.mode is not RuntimeMode.DEMO:
            raise HTTPException(
                status_code=501,
                detail={
                    "error": "EVENT_INDEXER_REQUIRED",
                    "message": "Contract history requires the deployed event-enabled contract and indexer",
                },
            )
        return {"transactions": _ledger_call(demo_ledger.history, address, limit)}

    @router.post("/api/v2/topups", tags=["Vault v2"])
    async def topup(body: TopUpRequest):
        if settings.mode is not RuntimeMode.DEMO:
            raise HTTPException(
                status_code=409,
                detail={
                    "error": "WRONG_RUNTIME_MODE",
                    "message": "Use a signed Soroban deposit in Stellar mode; demo value cannot be created",
                },
            )
        return _ledger_call(
            demo_ledger.topup,
            body.beneficiary_address,
            body.amount_php,
            body.idempotency_key,
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
