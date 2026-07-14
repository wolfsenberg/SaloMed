from __future__ import annotations

import os
from pathlib import Path

from fastapi import FastAPI
from fastapi.testclient import TestClient

import salo_request_store
from runtime_api import create_runtime_router
from salomed_runtime import DemoLedger, RuntimeMode, RuntimeSettings


PATIENT = "GAXXWLECCE644QVYLKRHCDWDH5V7KMYG3GZEDPEB7C7LIQFPQ43ZBFEK"


def _reset_store(tmp_path: Path) -> None:
    os.environ["SALOMED_DB_PATH"] = str(tmp_path / "salo_requests.sqlite3")
    os.environ.pop("DATABASE_URL", None)
    salo_request_store._USE_PG = False
    salo_request_store._INITIALIZED = False


def _client(tmp_path: Path) -> TestClient:
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


def test_salo_request_store_records_and_decides_requests(tmp_path: Path) -> None:
    _reset_store(tmp_path)

    row = salo_request_store.record(
        patient_address=PATIENT.lower(),
        amount_asset=45.25,
        amount_php=500,
        term_months=6,
        monthly_php=85.60,
        interest_rate=9,
        salo_points=61,
        credit_tier="Bronze",
        review_decision="salomed_review",
        reason_codes=["LIMITED_PAYMENT_HISTORY"],
    )
    listed = salo_request_store.list_requests("pending")
    decided = salo_request_store.decide(row["id"], "approved", "SaloMed Admin")

    assert row["id"].startswith("SALO-")
    assert listed[0]["patient_address"] == PATIENT
    assert listed[0]["reason_codes"] == ["LIMITED_PAYMENT_HISTORY"]
    assert decided is not None
    assert decided["status"] == "approved"
    assert decided["reviewer"] == "SaloMed Admin"
    assert decided["audit_trail"][-1]["action"] == "admin_approved"


def test_salo_request_store_tracks_terms_release_and_schedule(tmp_path: Path) -> None:
    _reset_store(tmp_path)

    row = salo_request_store.record(
        patient_address=PATIENT,
        amount_asset=45.25,
        amount_php=500,
        term_months=3,
        monthly_php=170.50,
        interest_rate=9,
        salo_points=61,
        credit_tier="Bronze",
        review_decision="salomed_review",
        reason_codes=[],
    )
    salo_request_store.decide(row["id"], "approved", "SaloMed Admin")
    accepted = salo_request_store.accept_terms(row["id"], PATIENT)
    released = salo_request_store.release(row["id"], "SaloMed Admin")

    assert accepted is not None
    assert accepted["status"] == "terms_accepted"
    assert accepted["accepted_at"] is not None
    assert released is not None
    assert released["status"] == "released"
    assert released["released_at"] is not None
    assert released["audit_trail"][-1]["action"] == "released"
    assert len(released["repayment_schedule"]) == 3
    assert released["repayment_schedule"][0]["amount_php"] == 170.50


def test_salo_request_endpoints_expose_cross_user_admin_queue(tmp_path: Path) -> None:
    client = _client(tmp_path)
    login = client.post(
        "/api/v2/admin/login",
        json={"username": "salomed_admin", "password": "salomed_admin_123"},
    )
    token = login.json()["token"]

    record = client.post(
        "/api/v2/salo/requests",
        json={
            "patient_address": PATIENT,
            "amount_asset": "45.2500000",
            "amount_php": "500.00",
            "term_months": 6,
            "monthly_php": "85.60",
            "interest_rate": "9.00",
            "salo_points": 61,
            "credit_tier": "Bronze",
            "pending_requests": 0,
        },
    )
    blocked_queue = client.get("/api/v2/salo/requests")
    queue = client.get("/api/v2/salo/requests", headers={"Authorization": f"Bearer {token}"})
    request_id = queue.json()["requests"][0]["id"]
    decision = client.post(
        f"/api/v2/salo/requests/{request_id}/decision",
        json={"status": "rejected", "reviewer": "SaloMed Admin"},
        headers={"Authorization": f"Bearer {token}"},
    )

    assert login.status_code == 200
    assert record.status_code == 200
    assert record.json()["request"]["status"] == "pending"
    assert blocked_queue.status_code == 401
    assert queue.status_code == 200
    assert queue.json()["requests"][0]["patient_address"] == PATIENT
    assert decision.status_code == 200
    assert decision.json()["request"]["status"] == "rejected"


def test_salo_request_terms_and_release_endpoints(tmp_path: Path) -> None:
    client = _client(tmp_path)
    login = client.post(
        "/api/v2/admin/login",
        json={"username": "salomed_admin", "password": "salomed_admin_123"},
    )
    token = login.json()["token"]
    record = client.post(
        "/api/v2/salo/requests",
        json={
            "patient_address": PATIENT,
            "amount_asset": "45.2500000",
            "amount_php": "500.00",
            "term_months": 3,
            "monthly_php": "170.50",
            "interest_rate": "9.00",
            "salo_points": 61,
            "credit_tier": "Bronze",
            "pending_requests": 0,
        },
    )
    request_id = record.json()["request"]["id"]
    release_too_early = client.post(
        f"/api/v2/salo/requests/{request_id}/release",
        json={"reviewer": "SaloMed Admin"},
        headers={"Authorization": f"Bearer {token}"},
    )
    client.post(
        f"/api/v2/salo/requests/{request_id}/decision",
        json={"status": "approved", "reviewer": "SaloMed Admin"},
        headers={"Authorization": f"Bearer {token}"},
    )
    accepted = client.post(
        f"/api/v2/salo/requests/{request_id}/accept-terms",
        json={"patient_address": PATIENT},
    )
    released = client.post(
        f"/api/v2/salo/requests/{request_id}/release",
        json={"reviewer": "SaloMed Admin"},
        headers={"Authorization": f"Bearer {token}"},
    )
    patient_rows = client.get(f"/api/v2/salo/requests/patient/{PATIENT}")

    assert release_too_early.status_code == 409
    assert accepted.status_code == 200
    assert accepted.json()["request"]["status"] == "terms_accepted"
    assert released.status_code == 200
    assert released.json()["request"]["status"] == "released"
    assert len(released.json()["request"]["repayment_schedule"]) == 3
    assert patient_rows.json()["requests"][0]["status"] == "released"


def test_admin_login_rejects_wrong_credentials(tmp_path: Path) -> None:
    client = _client(tmp_path)

    response = client.post(
        "/api/v2/admin/login",
        json={"username": "salomed_admin", "password": "wrong"},
    )

    assert response.status_code == 401


def test_salo_request_endpoint_rejects_blocked_underwriting(tmp_path: Path) -> None:
    client = _client(tmp_path)

    response = client.post(
        "/api/v2/salo/requests",
        json={
            "patient_address": PATIENT,
            "amount_asset": "1000.0000000",
            "amount_php": "12000.00",
            "term_months": 6,
            "monthly_php": "2050.00",
            "interest_rate": "9.00",
            "salo_points": 61,
            "credit_tier": "Bronze",
            "pending_requests": 0,
        },
    )

    assert response.status_code == 409
    assert salo_request_store.list_requests("all") == []
