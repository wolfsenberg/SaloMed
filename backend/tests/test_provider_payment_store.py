from __future__ import annotations

import os

from fastapi import FastAPI
from fastapi.testclient import TestClient

import provider_payment_store
from runtime_api import create_runtime_router
from salomed_runtime import DemoLedger, RuntimeMode, RuntimeSettings


PATIENT = "GAXXWLECCE644QVYLKRHCDWDH5V7KMYG3GZEDPEB7C7LIQFPQ43ZBFEK"
PROVIDER = "GDGXGJTIGCXMQTAG362YFKCBZ4FARG33SDOKCZ4DOTFP4J63EPCYMRKH"


def _reset_store(tmp_path) -> None:
    os.environ["SALOMED_DB_PATH"] = str(tmp_path / "provider_payments.sqlite3")
    os.environ.pop("DATABASE_URL", None)
    provider_payment_store._USE_PG = False
    provider_payment_store._INITIALIZED = False


def _client(tmp_path) -> TestClient:
    _reset_store(tmp_path)
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


def test_provider_payment_store_is_provider_keyed_and_idempotent_by_tx_hash(tmp_path) -> None:
    _reset_store(tmp_path)

    first = provider_payment_store.record(
        patient_address=PATIENT,
        provider_address=PROVIDER,
        provider_name="Philippine General Hospital",
        provider_type="hospital",
        amount_asset=1.25,
        amount_php=70,
        tx_hash="a" * 64,
        status="success",
    )
    second = provider_payment_store.record(
        patient_address=PATIENT,
        provider_address=PROVIDER,
        provider_name="Philippine General Hospital",
        provider_type="hospital",
        amount_asset=1.25,
        amount_php=70,
        tx_hash="a" * 64,
        status="success",
    )
    rows = provider_payment_store.payments_for_provider(PROVIDER)

    assert first["provider_address"] == PROVIDER
    assert second["tx_hash"] == "a" * 64
    assert len(rows) == 1
    assert rows[0]["patient_address"] == PATIENT


def test_provider_payment_endpoints_expose_cross_user_provider_history(tmp_path) -> None:
    client = _client(tmp_path)

    record = client.post(
        "/api/v2/provider-payments/record",
        json={
            "patient_address": PATIENT,
            "provider_address": PROVIDER,
            "provider_name": "Philippine General Hospital",
            "provider_type": "hospital",
            "amount_asset": "2.0000000",
            "amount_php": "112.00",
            "tx_hash": "b" * 64,
            "status": "success",
        },
    )
    history = client.get(f"/api/v2/providers/{PROVIDER}/transactions")

    assert record.status_code == 200
    assert history.status_code == 200
    rows = history.json()["transactions"]
    assert len(rows) == 1
    assert rows[0]["provider_address"] == PROVIDER
    assert rows[0]["amount_php"] == 112.0


def test_demo_runtime_payment_is_indexed_for_provider_portal(tmp_path) -> None:
    client = _client(tmp_path)
    client.post(
        "/api/v2/topups",
        json={
            "beneficiary_address": PATIENT,
            "amount_php": "560.00",
            "idempotency_key": "provider-index-topup",
            "source": "gcash",
        },
    )

    payment = client.post(
        "/api/v2/payments",
        json={
            "patient_address": PATIENT,
            "provider_id": PROVIDER,
            "amount_asset": "2.0000000",
            "idempotency_key": "provider-index-payment",
        },
    )
    history = client.get(f"/api/v2/providers/{PROVIDER}/transactions")

    assert payment.status_code == 200
    assert history.status_code == 200
    assert history.json()["transactions"][0]["patient_address"] == PATIENT
