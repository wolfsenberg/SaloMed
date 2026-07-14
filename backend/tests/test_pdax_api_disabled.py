from __future__ import annotations

from fastapi import FastAPI
from fastapi.testclient import TestClient

import pdax_api
import pdax_service
import stellar_bridge
from pdax_api import create_pdax_router
from salomed_runtime import RuntimeMode, RuntimeSettings


BENEFICIARY = "GAXXWLECCE644QVYLKRHCDWDH5V7KMYG3GZEDPEB7C7LIQFPQ43ZBFEK"


def test_pdax_pending_deposit_does_not_credit_vault(tmp_path, monkeypatch) -> None:
    monkeypatch.setenv("SALOMED_DB_PATH", str(tmp_path / "pdax.sqlite3"))
    monkeypatch.setattr(pdax_api, "_deposits", pdax_api._DepositStore())
    monkeypatch.setattr(pdax_api, "_credits", pdax_api._CreditStore())
    monkeypatch.setattr(pdax_service, "_PDAX_CONFIGURED", True)

    async def _deposit(**kwargs):
        return {
            "success": True,
            "checkout_url": "https://pdax.test/checkout",
            "identifier": "SALOMED-PENDING-1",
            "reference_number": "PDAX-REF-1",
            "request_id": "REQ-1",
            "amount_php": kwargs["amount_php"],
            "status": "PENDING",
        }

    async def _quote(amount_php, asset="USDC", fallback_rate=56.0):
        return {
            "success": True,
            "rate": 56.0,
            "asset": asset,
            "asset_amount": 10.0,
            "amount_php": amount_php,
            "source": "pdax_live",
        }

    async def _pending(identifier):
        return {"success": True, "found": True, "status": "pending", "amount": 560.0}

    called = {"credit": False}

    def _credit(*args):
        called["credit"] = True
        return "a" * 64

    monkeypatch.setattr(pdax_service, "initiate_instapay_deposit", _deposit)
    monkeypatch.setattr(pdax_service, "get_php_to_asset_quote", _quote)
    monkeypatch.setattr(pdax_service, "get_deposit_status", _pending)
    monkeypatch.setattr(stellar_bridge, "credit_vault_usdc", _credit)

    settings = RuntimeSettings(
        mode=RuntimeMode.STELLAR_TESTNET,
        asset_code="USDC",
        contract_id="CAO3K6OYB5A3VNVV3HKCSVG3ZZ442DZCDKAXG4CTSLBTN7FOYCCBRZ34",
        network="testnet",
        expected_token_id="CAO3K6OYB5A3VNVV3HKCSVG3ZZ442DZCDKAXG4CTSLBTN7FOYCCBRZ34",
        admin_address=BENEFICIARY,
        php_per_asset="56.00",
        admin_api_key="",
        database_path=str(tmp_path / "runtime.sqlite3"),
        database_url="",
    )
    app = FastAPI()
    app.include_router(create_pdax_router(settings))
    client = TestClient(app)

    deposit = client.post(
        "/api/pdax/deposit",
        json={
            "beneficiary_address": BENEFICIARY,
            "amount_php": "560.00",
        },
    )
    assert deposit.status_code == 200
    assert deposit.json()["identifier"] == "SALOMED-PENDING-1"

    status = client.get("/api/pdax/deposits/SALOMED-PENDING-1")
    assert status.status_code == 200
    assert status.json()["beneficiary_address"] == BENEFICIARY
    assert status.json()["pdax_status"] == "pending"
    assert status.json()["credited"] is False

    confirm = client.post(
        "/api/pdax/confirm",
        json={"identifier": "SALOMED-PENDING-1", "beneficiary_address": BENEFICIARY},
    )
    assert confirm.status_code == 200
    assert confirm.json()["credited"] is False
    assert confirm.json()["pdax_status"] == "pending"
    assert confirm.json()["settlement_status"] == "pending"
    assert called["credit"] is False


def test_pdax_completed_deposit_records_failed_settlement_for_retry(tmp_path, monkeypatch) -> None:
    monkeypatch.setenv("SALOMED_DB_PATH", str(tmp_path / "pdax.sqlite3"))
    monkeypatch.setattr(pdax_api, "_deposits", pdax_api._DepositStore())
    monkeypatch.setattr(pdax_api, "_credits", pdax_api._CreditStore())
    monkeypatch.setattr(pdax_service, "_PDAX_CONFIGURED", True)

    async def _deposit(**kwargs):
        return {
            "success": True,
            "checkout_url": "https://pdax.test/checkout",
            "identifier": "SALOMED-FAILED-1",
            "reference_number": "PDAX-REF-FAILED",
            "request_id": "REQ-FAILED",
            "amount_php": kwargs["amount_php"],
            "status": "PENDING",
        }

    async def _quote(amount_php, asset="USDC", fallback_rate=56.0):
        return {
            "success": True,
            "rate": 56.0,
            "asset": asset,
            "asset_amount": 10.0,
            "amount_php": amount_php,
            "source": "pdax_live",
        }

    async def _completed(identifier):
        return {"success": True, "found": True, "status": "completed", "amount": 560.0}

    def _credit(*args):
        raise stellar_bridge.BridgeError("contract submit failed")

    monkeypatch.setattr(pdax_service, "initiate_instapay_deposit", _deposit)
    monkeypatch.setattr(pdax_service, "get_php_to_asset_quote", _quote)
    monkeypatch.setattr(pdax_service, "get_deposit_status", _completed)
    monkeypatch.setattr(stellar_bridge, "credit_vault_usdc", _credit)

    settings = RuntimeSettings(
        mode=RuntimeMode.STELLAR_TESTNET,
        asset_code="USDC",
        contract_id="CAO3K6OYB5A3VNVV3HKCSVG3ZZ442DZCDKAXG4CTSLBTN7FOYCCBRZ34",
        network="testnet",
        expected_token_id="CAO3K6OYB5A3VNVV3HKCSVG3ZZ442DZCDKAXG4CTSLBTN7FOYCCBRZ34",
        admin_address=BENEFICIARY,
        php_per_asset="56.00",
        admin_api_key="",
        database_path=str(tmp_path / "runtime.sqlite3"),
        database_url="",
    )
    app = FastAPI()
    app.include_router(create_pdax_router(settings))
    client = TestClient(app)

    client.post(
        "/api/pdax/deposit",
        json={"beneficiary_address": BENEFICIARY, "amount_php": "560.00"},
    )
    confirm = client.post(
        "/api/pdax/confirm",
        json={"identifier": "SALOMED-FAILED-1", "beneficiary_address": BENEFICIARY},
    )
    status = client.get("/api/pdax/deposits/SALOMED-FAILED-1")
    reconciliation = client.get("/api/pdax/reconciliation")

    assert confirm.status_code == 502
    assert confirm.json()["detail"]["settlement_status"] == "failed"
    assert confirm.json()["detail"]["retryable"] is True
    assert status.json()["settlement_status"] == "failed"
    assert status.json()["retry_count"] == 1
    assert status.json()["last_error"] == "contract submit failed"
    assert reconciliation.json()["failed"] == 1
