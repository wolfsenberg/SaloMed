from __future__ import annotations

from fastapi import APIRouter, HTTPException

from salomed_runtime import RuntimeMode, RuntimeSettings


def create_legacy_compatibility_router(settings: RuntimeSettings) -> APIRouter:
    """Keep read-only compatibility while retiring split-brain value paths."""
    router = APIRouter()

    async def retired_value_path() -> None:
        raise HTTPException(
            status_code=410,
            detail={
                "error": "LEGACY_VALUE_PATH_RETIRED",
                "message": (
                    "Use the /api/v2 ledger interfaces in demo mode or a signed Soroban "
                    "contract call in Stellar mode."
                ),
            },
        )

    for path in (
        "/api/gcash/cash-in",
        "/api/qrph/pay",
        "/api/payment/pay-hospital",
        "/api/topup",
        "/api/topup-legacy",
        "/api/simulate-topup",
        "/api/prepare-payment",
        "/api/prepare-padala",
        "/api/prepare-spend",
    ):
        router.add_api_route(
            path,
            retired_value_path,
            methods=["POST"],
            tags=["Legacy"],
            include_in_schema=False,
        )

    @router.get("/api/gcash-rate", tags=["Utility"])
    async def indicative_asset_rate():
        pdax_enabled = settings.mode in {RuntimeMode.PDAX_UAT, RuntimeMode.PDAX_PROD}
        return {
            "php_per_usdc": float(settings.php_per_asset_decimal),
            "php_per_xlm": None,
            "source": "configured_indicative" if pdax_enabled else "fixed_demo",
            "pdax_enabled": pdax_enabled,
            "executable": False,
        }

    return router
