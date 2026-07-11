from __future__ import annotations

from fastapi import FastAPI
from fastapi.testclient import TestClient

from pdax_api import create_pdax_router
from salomed_runtime import RuntimeMode, RuntimeSettings


def test_pdax_transaction_endpoints_stay_disabled_without_settlement(tmp_path) -> None:
    settings = RuntimeSettings(
        mode=RuntimeMode.PDAX_UAT,
        asset_code="USDC",
        contract_id="CAO3K6OYB5A3VNVV3HKCSVG3ZZ442DZCDKAXG4CTSLBTN7FOYCCBRZ34",
        network="testnet",
        expected_token_id="CAO3K6OYB5A3VNVV3HKCSVG3ZZ442DZCDKAXG4CTSLBTN7FOYCCBRZ34",
        admin_address="GAXXWLECCE644QVYLKRHCDWDH5V7KMYG3GZEDPEB7C7LIQFPQ43ZBFEK",
        php_per_asset="56.00",
        admin_api_key="",
        database_path=str(tmp_path / "pdax.sqlite3"),
    )
    app = FastAPI()
    app.include_router(create_pdax_router(settings))
    client = TestClient(app)

    response = client.post(
        "/api/pdax/deposit",
        json={
            "beneficiary_address": settings.admin_address,
            "amount_php": "560.00",
            "gcash_reference": "PDAX-BLOCKED-1",
        },
    )

    assert response.status_code == 501
    assert response.json()["detail"]["error"] == "PDAX_SETTLEMENT_NOT_IMPLEMENTED"
    assert client.post("/api/pdax/webhook", content=b"{}").status_code == 501
