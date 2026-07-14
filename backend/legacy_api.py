from __future__ import annotations

from fastapi import APIRouter, HTTPException

from salomed_runtime import RuntimeSettings


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
        # Prefer live XLM/PHP from PDAX or market data. Only fall back to the
        # configured env value when every live provider is unavailable.
        import pdax_service as pdax
        fallback = float(settings.php_per_asset_decimal)
        asset = settings.asset_code
        quote = await pdax.get_php_to_asset_quote(1000.0, asset, fallback_rate=fallback)
        if quote.get("source") in {"pdax_live", "coingecko_live"}:
            return {
                "php_per_usdc": quote["rate"],
                "php_per_xlm": quote["rate"],
                "asset_code": asset,
                "source": quote["source"],
                "pdax_enabled": pdax._PDAX_CONFIGURED,
                "executable": False,
                "last_updated_at": quote.get("last_updated_at"),
            }
        return {
            "php_per_usdc": fallback,
            "php_per_xlm": fallback,
            "asset_code": asset,
            "source": "configured_indicative",
            "pdax_enabled": pdax._PDAX_CONFIGURED,
            "executable": False,
        }

    return router
