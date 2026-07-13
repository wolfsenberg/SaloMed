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
        # Prefer the live PDAX PHP->USDC rate when PDAX is configured, so the
        # whole app shows a real conversion rather than a hardcoded value.
        import pdax_service as pdax
        fallback = float(settings.php_per_asset_decimal)
        # Quote the configured vault asset (native XLM), NOT USDC. The frontend
        # uses this rate to convert between PHP and the on-chain XLM amount, so
        # it must be PHP-per-XLM for the displayed value to match Freighter and
        # the Stellar Explorer.
        asset = settings.asset_code
        if pdax._PDAX_CONFIGURED:
            quote = await pdax.get_php_to_asset_quote(1000.0, asset, fallback_rate=fallback)
            if quote.get("source") == "pdax_live":
                return {
                    "php_per_usdc": quote["rate"],
                    "php_per_xlm": quote["rate"],
                    "asset_code": asset,
                    "source": "pdax_live",
                    "pdax_enabled": True,
                    "executable": False,
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
