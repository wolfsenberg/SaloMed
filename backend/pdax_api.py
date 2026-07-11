from __future__ import annotations

from decimal import Decimal

from fastapi import APIRouter, HTTPException, Query, Request
from pydantic import BaseModel, Field

from salomed_runtime import RuntimeMode, RuntimeSettings


class PdaxDepositRequest(BaseModel):
    beneficiary_address: str
    amount_php: Decimal = Field(gt=0, le=50_000, max_digits=12, decimal_places=2)
    gcash_reference: str = Field(default="", max_length=128)


def create_pdax_router(settings: RuntimeSettings) -> APIRouter:
    """Expose truthful PDAX readiness without activating speculative money movement."""
    router = APIRouter()

    def require_pdax() -> None:
        if settings.mode not in {RuntimeMode.PDAX_UAT, RuntimeMode.PDAX_PROD}:
            raise HTTPException(
                status_code=409,
                detail={
                    "error": "PDAX_DISABLED",
                    "message": "PDAX is disabled in this runtime mode; demo never acts as a fallback.",
                },
            )

    def settlement_blocked() -> None:
        raise HTTPException(
            status_code=501,
            detail={
                "error": "PDAX_SETTLEMENT_NOT_IMPLEMENTED",
                "message": (
                    "PDAX cash-in, conversion, withdrawal, and Stellar reconciliation must be "
                    "implemented from the issued private specification before transactions are enabled."
                ),
            },
        )

    @router.get("/api/pdax/status", tags=["PDAX"])
    async def status():
        enabled_mode = settings.mode in {RuntimeMode.PDAX_UAT, RuntimeMode.PDAX_PROD}
        return {
            "configured": enabled_mode,
            "mode": settings.mode.value,
            "status": "settlement_not_implemented" if enabled_mode else "PDAX is disabled in this runtime mode",
            "settlement_enabled": False,
        }

    @router.get("/api/pdax/rate", tags=["PDAX"])
    async def rate(base: str = Query("USDCXLM"), quote: str = Query("PHP")):
        require_pdax()
        if base.upper() != "USDCXLM" or quote.upper() != "PHP":
            raise HTTPException(status_code=422, detail="SaloMed only supports USDCXLM/PHP")
        return {
            "base": "USDCXLM",
            "quote": "PHP",
            "rate": float(settings.php_per_asset_decimal),
            "source": "configured_indicative",
            "pdax_enabled": True,
            "executable": False,
        }

    @router.post("/api/pdax/deposit", tags=["PDAX"])
    async def create_deposit(_body: PdaxDepositRequest):
        require_pdax()
        settlement_blocked()

    @router.post("/api/pdax/webhook", tags=["PDAX"])
    async def webhook(_request: Request):
        require_pdax()
        settlement_blocked()

    @router.get("/api/pdax/quote", tags=["PDAX"])
    async def quote(_amount_usdc: Decimal = Query(..., alias="amount_usdc", gt=0)):
        require_pdax()
        settlement_blocked()

    return router
