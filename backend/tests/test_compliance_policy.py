from __future__ import annotations

from fastapi import FastAPI
from fastapi.testclient import TestClient

from runtime_api import create_runtime_router
from salomed_runtime import DemoLedger, RuntimeMode, RuntimeSettings


PATIENT = "GAXXWLECCE644QVYLKRHCDWDH5V7KMYG3GZEDPEB7C7LIQFPQ43ZBFEK"


def _client(tmp_path) -> TestClient:
    settings = RuntimeSettings(
        mode=RuntimeMode.DEMO,
        asset_code="XLM",
        contract_id="CAO3K6OYB5A3VNVV3HKCSVG3ZZ442DZCDKAXG4CTSLBTN7FOYCCBRZ34",
        network="testnet",
        expected_token_id="",
        admin_address="",
        php_per_asset="56.00",
        admin_api_key="test-admin-key",
        database_path=str(tmp_path / "runtime.sqlite3"),
        database_url="",
    )
    ledger = DemoLedger(settings.database_path, settings.php_per_asset_decimal)
    app = FastAPI()
    app.include_router(create_runtime_router(settings, ledger))
    return TestClient(app)


def test_wallet_compliance_status_is_demo_scoped(tmp_path) -> None:
    client = _client(tmp_path)

    response = client.get(f"/api/v2/compliance/{PATIENT}")

    assert response.status_code == 200
    body = response.json()
    assert body["kyc_status"] == "demo_verified"
    assert body["aml_status"] == "clear"
    assert body["real_money_enabled"] is False


def test_topup_policy_blocks_amounts_above_mvp_limit(tmp_path) -> None:
    client = _client(tmp_path)

    response = client.post(
        "/api/v2/topups",
        json={
            "beneficiary_address": PATIENT,
            "amount_php": "50000.01",
            "idempotency_key": "topup-too-large",
            "source": "gcash",
        },
    )

    assert response.status_code == 409
    assert response.json()["detail"]["error"] == "POLICY_REVIEW_BLOCKED"
    assert "AMOUNT_ABOVE_MVP_LIMIT" in response.json()["detail"]["review"]["reason_codes"]


def test_salo_underwriting_returns_salomed_review_reason_codes(tmp_path) -> None:
    client = _client(tmp_path)

    response = client.post(
        "/api/v2/salo/underwrite",
        json={
            "address": PATIENT,
            "amount_php": "2500.00",
            "salo_points": 3,
            "pending_requests": 1,
            "term_months": 6,
        },
    )

    assert response.status_code == 200
    body = response.json()
    assert body["decision"] == "salomed_review"
    assert "LIMITED_PAYMENT_HISTORY" in body["reason_codes"]
    assert body["underwriting"]["release_status"] == "not_enabled_for_real_funds"
