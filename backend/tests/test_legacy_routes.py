from __future__ import annotations

import importlib
import sys
from types import ModuleType

from fastapi.testclient import TestClient
import pytest


@pytest.fixture(scope="module")
def main_module(tmp_path_factory: pytest.TempPathFactory) -> ModuleType:
    monkeypatch = pytest.MonkeyPatch()
    monkeypatch.setenv("SALOMED_MODE", "demo")
    monkeypatch.setenv("SALOMED_DB_PATH", str(tmp_path_factory.mktemp("main-app") / "ledger.sqlite3"))
    sys.modules.pop("main", None)
    module = importlib.import_module("main")
    yield module
    sys.modules.pop("main", None)
    monkeypatch.undo()


@pytest.fixture(scope="module")
def client(main_module: ModuleType) -> TestClient:
    return TestClient(main_module.app)


def test_main_exposes_explicit_demo_runtime(client: TestClient) -> None:
    runtime = client.get("/api/runtime")
    providers = client.get("/api/v2/providers")

    assert runtime.status_code == 200
    assert runtime.json()["mode"] == "demo"
    assert runtime.json()["simulated"] is True
    assert runtime.json()["real_money_enabled"] is False
    assert providers.status_code == 200
    assert providers.json()["source"] == "demo_ledger"


def test_legacy_value_creation_route_is_gone(client: TestClient) -> None:
    response = client.post(
        "/api/gcash/cash-in",
        json={"beneficiary_address": "GFAKE", "amount_php": 560, "gcash_reference": "x"},
    )

    assert response.status_code == 410
    assert response.json()["detail"]["error"] == "LEGACY_VALUE_PATH_RETIRED"


@pytest.mark.parametrize(
    "path",
    [
        "/api/qrph/pay",
        "/api/payment/pay-hospital",
        "/api/topup",
        "/api/topup-legacy",
        "/api/simulate-topup",
        "/api/prepare-payment",
        "/api/prepare-padala",
        "/api/prepare-spend",
    ],
)
def test_all_legacy_value_paths_are_retired(path: str, client: TestClient) -> None:
    response = client.post(path, json={})

    assert response.status_code == 410
    assert response.json()["detail"]["error"] == "LEGACY_VALUE_PATH_RETIRED"


def test_retired_paths_are_not_duplicated_in_the_active_router(main_module: ModuleType) -> None:
    retired_paths = {
        "/api/gcash/cash-in",
        "/api/qrph/pay",
        "/api/payment/pay-hospital",
        "/api/topup",
        "/api/topup-legacy",
        "/api/simulate-topup",
        "/api/prepare-payment",
        "/api/prepare-padala",
        "/api/prepare-spend",
    }

    for path in retired_paths:
        matches = [
            route
            for route in main_module.app.routes
            if getattr(route, "path", None) == path and "POST" in getattr(route, "methods", set())
        ]
        assert len(matches) == 1, path


def test_demo_rate_is_truthful_and_not_xlm(
    client: TestClient,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    import pdax_service

    async def _quote(amount_php: float, asset: str = "XLM", fallback_rate: float = 11.34):
        return {
            "success": False,
            "rate": fallback_rate,
            "asset": asset,
            "asset_amount": amount_php / fallback_rate,
            "amount_php": amount_php,
            "source": "indicative",
        }

    monkeypatch.setattr(pdax_service, "get_php_to_asset_quote", _quote)

    response = client.get("/api/gcash-rate")

    assert response.status_code == 200
    assert response.json()["source"] == "configured_indicative"
    assert response.json()["executable"] is False
    assert response.json()["pdax_enabled"] is False


def test_demo_rate_can_use_live_market_xlm(
    client: TestClient,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    import pdax_service

    async def _quote(amount_php: float, asset: str = "XLM", fallback_rate: float = 11.34):
        return {
            "success": True,
            "rate": 11.34,
            "asset": asset,
            "asset_amount": amount_php / 11.34,
            "amount_php": amount_php,
            "source": "coingecko_live",
            "last_updated_at": 123,
        }

    monkeypatch.setattr(pdax_service, "get_php_to_asset_quote", _quote)

    response = client.get("/api/gcash-rate")

    assert response.status_code == 200
    body = response.json()
    assert body["source"] == "coingecko_live"
    assert body["php_per_xlm"] == 11.34
    assert body["pdax_enabled"] is False


def test_pdax_deposit_validates_before_disabled_mode(client: TestClient) -> None:
    response = client.post(
        "/api/pdax/deposit",
        json={"beneficiary_address": "GFAKE", "amount_php": 560, "gcash_reference": "REF-8"},
    )

    assert response.status_code == 422
