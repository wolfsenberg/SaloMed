from __future__ import annotations

from pathlib import Path

from fastapi import FastAPI
from fastapi.testclient import TestClient

from runtime_api import create_runtime_router
from salomed_runtime import DemoLedger, RuntimeMode, RuntimeSettings


PATIENT = "GAXXWLECCE644QVYLKRHCDWDH5V7KMYG3GZEDPEB7C7LIQFPQ43ZBFEK"
BENEFICIARY = "GCOHD2WKIEY4IP7AIWBIMAID2RFJ4E7ZXSM446EJWN46IBHFYTWQIGCJ"


def make_client(tmp_path: Path) -> TestClient:
    settings = RuntimeSettings(
        mode=RuntimeMode.DEMO,
        asset_code="USDC",
        contract_id="CAO3K6OYB5A3VNVV3HKCSVG3ZZ442DZCDKAXG4CTSLBTN7FOYCCBRZ34",
        network="testnet",
        expected_token_id="",
        admin_address="",
        php_per_asset="56.00",
        admin_api_key="test-admin-key",
        database_path=str(tmp_path / "runtime.sqlite3"),
    )
    ledger = DemoLedger(settings.database_path, settings.php_per_asset_decimal)
    app = FastAPI()
    app.include_router(create_runtime_router(settings, ledger))
    return TestClient(app)


def test_runtime_status_is_explicitly_simulated(tmp_path: Path) -> None:
    client = make_client(tmp_path)

    response = client.get("/api/runtime")

    assert response.status_code == 200
    assert response.json() == {
        "mode": "demo",
        "asset_code": "USDC",
        "contract_id": "CAO3K6OYB5A3VNVV3HKCSVG3ZZ442DZCDKAXG4CTSLBTN7FOYCCBRZ34",
        "network": "testnet",
        "expected_token_id": "",
        "admin_address": "",
        "php_per_asset": "56.00",
        "simulated": True,
        "real_money_enabled": False,
        "history_source": "demo_ledger",
        "stellar_tracking_enabled": False,
    }


def test_demo_topup_is_idempotent_and_updates_the_same_vault(tmp_path: Path) -> None:
    client = make_client(tmp_path)
    payload = {
        "beneficiary_address": PATIENT,
        "amount_php": "560.00",
        "idempotency_key": "topup-001",
    }

    first = client.post("/api/v2/topups", json=payload)
    replay = client.post("/api/v2/topups", json=payload)
    vault = client.get(f"/api/v2/vaults/{PATIENT}")

    assert first.status_code == 200
    assert replay.status_code == 200
    assert replay.json()["transaction_id"] == first.json()["transaction_id"]
    assert replay.json()["replayed"] is True
    assert vault.json()["balance_stroops"] == 100_000_000
    assert vault.json()["balance_asset"] == "10.0000000"


def test_demo_payment_requires_whitelist_and_is_atomic(tmp_path: Path) -> None:
    client = make_client(tmp_path)
    client.post(
        "/api/v2/topups",
        json={
            "beneficiary_address": PATIENT,
            "amount_php": "560.00",
            "idempotency_key": "topup-001",
        },
    )

    blocked = client.post(
        "/api/v2/payments",
        json={
            "patient_address": PATIENT,
            "provider_id": "not-a-provider",
            "amount_asset": "4.0000000",
            "idempotency_key": "pay-blocked",
        },
    )
    paid = client.post(
        "/api/v2/payments",
        json={
            "patient_address": PATIENT,
            "provider_id": "demo-pgh",
            "amount_asset": "4.0000000",
            "idempotency_key": "pay-0001",
        },
    )
    vault = client.get(f"/api/v2/vaults/{PATIENT}").json()

    assert blocked.status_code == 403
    assert paid.status_code == 200
    assert paid.json()["points_earned"] == 4
    assert vault["balance_stroops"] == 60_000_000
    assert vault["salo_points"] == 4


def test_demo_payment_rejects_insufficient_balance_without_mutation(tmp_path: Path) -> None:
    client = make_client(tmp_path)
    client.post(
        "/api/v2/topups",
        json={
            "beneficiary_address": PATIENT,
            "amount_php": "56.00",
            "idempotency_key": "topup-small",
        },
    )

    response = client.post(
        "/api/v2/payments",
        json={
            "patient_address": PATIENT,
            "provider_id": "demo-pgh",
            "amount_asset": "2.0000000",
            "idempotency_key": "pay-too-large",
        },
    )

    assert response.status_code == 409
    assert client.get(f"/api/v2/vaults/{PATIENT}").json()["balance_stroops"] == 10_000_000


def test_demo_padala_moves_locked_value_between_vaults(tmp_path: Path) -> None:
    client = make_client(tmp_path)
    client.post(
        "/api/v2/topups",
        json={
            "beneficiary_address": PATIENT,
            "amount_php": "560.00",
            "idempotency_key": "topup-001",
        },
    )

    response = client.post(
        "/api/v2/remittances",
        json={
            "sender_address": PATIENT,
            "beneficiary_address": BENEFICIARY,
            "amount_asset": "3.5000000",
            "idempotency_key": "padala-001",
        },
    )

    assert response.status_code == 200
    assert client.get(f"/api/v2/vaults/{PATIENT}").json()["balance_stroops"] == 65_000_000
    assert client.get(f"/api/v2/vaults/{BENEFICIARY}").json()["balance_stroops"] == 35_000_000


def test_demo_history_comes_from_the_ledger(tmp_path: Path) -> None:
    client = make_client(tmp_path)
    client.post(
        "/api/v2/topups",
        json={
            "beneficiary_address": PATIENT,
            "amount_php": "112.00",
            "idempotency_key": "topup-history",
        },
    )

    response = client.get(f"/api/v2/vaults/{PATIENT}/transactions")

    assert response.status_code == 200
    assert len(response.json()["transactions"]) == 1
    assert response.json()["transactions"][0]["type"] == "topup"
    assert response.json()["transactions"][0]["status"] == "success"


def test_demo_balance_and_two_sided_history_survive_app_restart(tmp_path: Path) -> None:
    first_client = make_client(tmp_path)
    first_client.post(
        "/api/v2/topups",
        json={
            "beneficiary_address": PATIENT,
            "amount_php": "560.00",
            "idempotency_key": "topup-durable",
        },
    )
    first_client.post(
        "/api/v2/payments",
        json={
            "patient_address": PATIENT,
            "provider_id": "demo-pgh",
            "amount_asset": "2.0000000",
            "idempotency_key": "payment-durable",
        },
    )
    first_client.post(
        "/api/v2/remittances",
        json={
            "sender_address": PATIENT,
            "beneficiary_address": BENEFICIARY,
            "amount_asset": "3.0000000",
            "idempotency_key": "padala-durable",
        },
    )

    restarted_client = make_client(tmp_path)
    patient_vault = restarted_client.get(f"/api/v2/vaults/{PATIENT}").json()
    beneficiary_vault = restarted_client.get(f"/api/v2/vaults/{BENEFICIARY}").json()
    patient_history = restarted_client.get(
        f"/api/v2/vaults/{PATIENT}/transactions"
    ).json()["transactions"]
    beneficiary_history = restarted_client.get(
        f"/api/v2/vaults/{BENEFICIARY}/transactions"
    ).json()["transactions"]

    assert patient_vault["balance_asset"] == "5.0000000"
    assert beneficiary_vault["balance_asset"] == "3.0000000"
    assert {(row["type"], row["direction"]) for row in patient_history} == {
        ("topup", "received"),
        ("payment", "sent"),
        ("padala", "sent"),
    }
    assert [(row["type"], row["direction"]) for row in beneficiary_history] == [
        ("padala", "received")
    ]
