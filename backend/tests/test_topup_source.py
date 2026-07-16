"""
Feature: reliable-traceable-transactions

Covers the admin-funded (Stellar mode) top-up credit path in
POST /api/v2/topups with stellar_bridge and pdax_service mocked, plus the
strict live-rate rule and the P7 rate-conversion property.
"""
from __future__ import annotations

from pathlib import Path
import time

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from hypothesis import given, settings as hyp_settings, strategies as st

import history_store
import pdax_service
import stellar_bridge
from runtime_api import create_runtime_router
from salomed_runtime import DemoLedger, RuntimeMode, RuntimeSettings


BENEFICIARY = "GAXXWLECCE644QVYLKRHCDWDH5V7KMYG3GZEDPEB7C7LIQFPQ43ZBFEK"
HASH = "a" * 64


def _runtime_settings(tmp_path: Path, mode: RuntimeMode = RuntimeMode.STELLAR_TESTNET) -> RuntimeSettings:
    # Construct the dataclass directly to bypass from_env() validation.
    return RuntimeSettings(
        mode=mode,
        asset_code="XLM",
        contract_id="CA6X5ZJ24LBJBCRHSAJK5EXB7CMEED2X2JTDLTPBOZC3SM4ABZYNIRCG",
        network="testnet",
        expected_token_id="CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC",
        admin_address="GBSXYPN2XWTJEZPLAMRIYQQVQTCJ2MEQOVOA3G73USGCMEXJ5YXPU2G7",
        php_per_asset="56.00",
        admin_api_key="",
        database_path=str(tmp_path / "runtime.sqlite3"),
        database_url="",
    )


def _make_client(tmp_path, monkeypatch, mode: RuntimeMode = RuntimeMode.STELLAR_TESTNET) -> TestClient:
    # Point the address-keyed history index at a fresh temp SQLite DB.
    monkeypatch.setenv("SALOMED_DB_PATH", str(tmp_path / "history.sqlite3"))
    monkeypatch.delenv("DATABASE_URL", raising=False)
    history_store._USE_PG = False
    history_store._INITIALIZED = False
    settings = _runtime_settings(tmp_path, mode)
    ledger = DemoLedger(str(tmp_path / "demo.sqlite3"), settings.php_per_asset_decimal)
    app = FastAPI()
    app.include_router(create_runtime_router(settings, ledger))
    return TestClient(app)


@pytest.fixture
def client(tmp_path, monkeypatch):
    return _make_client(tmp_path, monkeypatch)


def _mock_quote(source: str = "pdax_live", asset_amount: float = 66.44, rate: float = 7.526):
    async def _q(amount_php, asset="USDC", fallback_rate=56.0):
        return {
            "success": source == "pdax_live",
            "rate": rate,
            "asset": asset,
            "asset_amount": asset_amount,
            "amount_php": amount_php,
            "source": source,
        }
    return _q


def test_topup_success_records_source_and_hash(client, monkeypatch):
    monkeypatch.setattr(stellar_bridge, "is_bridge_configured", lambda: True)
    monkeypatch.setattr(stellar_bridge, "credit_vault_usdc", lambda addr, amt: HASH)
    monkeypatch.setattr(pdax_service, "get_php_to_asset_quote", _mock_quote())

    resp = client.post("/api/v2/topups", json={
        "beneficiary_address": BENEFICIARY, "amount_php": "500.00",
        "idempotency_key": "topup-live-1", "source": "gcash"})

    assert resp.status_code == 200
    body = resp.json()
    assert body["transaction_id"] == HASH
    assert body["source"] == "gcash"
    assert body["asset_code"] == "XLM"
    assert float(body["amount_asset"]) == pytest.approx(66.44)
    rows = history_store.history(BENEFICIARY)
    assert len(rows) == 1
    assert rows[0]["source"] == "gcash"
    assert rows[0]["tx_hash"] == HASH


def test_topup_accepts_live_market_xlm_rate(client, monkeypatch):
    monkeypatch.setattr(stellar_bridge, "is_bridge_configured", lambda: True)
    monkeypatch.setattr(stellar_bridge, "credit_vault_usdc", lambda addr, amt: HASH)
    monkeypatch.setattr(pdax_service, "get_php_to_asset_quote", _mock_quote(source="coingecko_live", rate=11.34))

    resp = client.post("/api/v2/topups", json={
        "beneficiary_address": BENEFICIARY, "amount_php": "500.00",
        "idempotency_key": "topup-market-live", "source": "instapay"})

    assert resp.status_code == 200
    body = resp.json()
    assert body["transaction_id"] == HASH
    assert body["source"] == "instapay"
    assert float(body["amount_asset"]) == pytest.approx(66.44)


def test_topup_bridge_error_leaves_no_row(client, monkeypatch):
    monkeypatch.setattr(stellar_bridge, "is_bridge_configured", lambda: True)

    def _boom(addr, amt):
        raise stellar_bridge.BridgeError("network down")

    monkeypatch.setattr(stellar_bridge, "credit_vault_usdc", _boom)
    monkeypatch.setattr(pdax_service, "get_php_to_asset_quote", _mock_quote())

    resp = client.post("/api/v2/topups", json={
        "beneficiary_address": BENEFICIARY, "amount_php": "500.00",
        "idempotency_key": "topup-err", "source": "gcash"})

    assert resp.status_code == 502
    assert resp.json()["detail"]["error"] == "ONCHAIN_CREDIT_FAILED"
    assert history_store.history(BENEFICIARY) == []


def test_topup_bridge_not_configured_leaves_no_row(client, monkeypatch):
    monkeypatch.setattr(stellar_bridge, "is_bridge_configured", lambda: False)
    monkeypatch.setattr(pdax_service, "get_php_to_asset_quote", _mock_quote())

    resp = client.post("/api/v2/topups", json={
        "beneficiary_address": BENEFICIARY, "amount_php": "500.00",
        "idempotency_key": "topup-nocfg"})

    assert resp.status_code == 503
    assert resp.json()["detail"]["error"] == "BRIDGE_NOT_CONFIGURED"
    assert history_store.history(BENEFICIARY) == []


def test_stellar_testnet_indicative_rate_can_credit_demo_deploy(client, monkeypatch):
    monkeypatch.setattr(stellar_bridge, "is_bridge_configured", lambda: True)
    credited = {"amount": None}

    def _credit(addr, amt):
        credited["amount"] = amt
        return HASH

    monkeypatch.setattr(stellar_bridge, "credit_vault_usdc", _credit)
    monkeypatch.setattr(pdax_service, "get_php_to_asset_quote",
                        _mock_quote(source="configured_indicative", asset_amount=44.6428571, rate=11.20))

    resp = client.post("/api/v2/topups", json={
        "beneficiary_address": BENEFICIARY, "amount_php": "500.00",
        "idempotency_key": "topup-testnet-indicative", "source": "instapay"})

    assert resp.status_code == 200
    body = resp.json()
    assert body["transaction_id"] == HASH
    assert body["rate_source"] == "configured_indicative"
    assert credited["amount"] == pytest.approx(44.6428571)


def test_pdax_mode_rate_unavailable_blocks_and_never_credits(tmp_path, monkeypatch):
    client = _make_client(tmp_path, monkeypatch, RuntimeMode.PDAX_UAT)
    monkeypatch.setattr(stellar_bridge, "is_bridge_configured", lambda: True)
    called = {"credited": False}

    def _credit(addr, amt):
        called["credited"] = True
        return HASH

    monkeypatch.setattr(stellar_bridge, "credit_vault_usdc", _credit)
    monkeypatch.setattr(pdax_service, "get_php_to_asset_quote", _mock_quote(source="indicative"))

    resp = client.post("/api/v2/topups", json={
        "beneficiary_address": BENEFICIARY, "amount_php": "500.00",
        "idempotency_key": "topup-norate"})

    assert resp.status_code == 503
    assert resp.json()["detail"]["error"] == "RATE_UNAVAILABLE"
    assert called["credited"] is False
    assert history_store.history(BENEFICIARY) == []


def test_xlm_quote_prefers_market_rate_even_when_pdax_is_configured(monkeypatch):
    import asyncio

    called = {"pdax": False}

    async def _market(asset="XLM"):
        return {
            "success": True,
            "asset": asset,
            "rate": 11.34,
            "source": "coingecko_live",
            "last_updated_at": 123,
        }

    async def _pdax(*args, **kwargs):
        called["pdax"] = True
        return {"ok": True, "data": {"data": {"price": 7.53, "total_amount": 132.8}}}

    orig_configured = pdax_service._PDAX_CONFIGURED
    pdax_service._PDAX_CONFIGURED = True
    monkeypatch.setattr(pdax_service, "get_market_php_rate", _market)
    monkeypatch.setattr(pdax_service, "_request", _pdax)
    try:
        quote = asyncio.run(pdax_service.get_php_to_asset_quote(1000.0, "XLM", fallback_rate=11.34))
    finally:
        pdax_service._PDAX_CONFIGURED = orig_configured

    assert quote["source"] == "coingecko_live"
    assert quote["rate"] == 11.34
    assert called["pdax"] is False


# Feature: reliable-traceable-transactions, Property 7: Live-rate conversion is
# proportional and never fixed 1:1.
@hyp_settings(max_examples=100, deadline=None)
@given(
    amount_php=st.floats(min_value=1.0, max_value=1_000_000.0,
                         allow_nan=False, allow_infinity=False),
    rate=st.floats(min_value=0.01, max_value=1000.0,
                   allow_nan=False, allow_infinity=False),
)
def test_php_to_asset_is_proportional_and_never_fixed_one_to_one(amount_php, rate):
    import asyncio

    # Force the indicative branch (no PDAX network) so we exercise the pure
    # arithmetic: asset_amount = round(amount_php / rate, 7). The patched values
    # are constant across all generated inputs, so a manual save/restore is used
    # instead of the function-scoped monkeypatch fixture.
    orig_configured = pdax_service._PDAX_CONFIGURED
    orig_cache = pdax_service._rate_cache
    pdax_service._PDAX_CONFIGURED = False
    pdax_service._rate_cache = {"XLM": {"rate": rate, "ts": time.time(), "source": "coingecko_live"}}
    try:
        quote = asyncio.run(pdax_service.get_php_to_asset_quote(amount_php, "XLM", fallback_rate=rate))
    finally:
        pdax_service._PDAX_CONFIGURED = orig_configured
        pdax_service._rate_cache = orig_cache

    expected = round(amount_php / rate, 7)
    assert quote["asset_amount"] == pytest.approx(expected, rel=1e-9, abs=1e-7)
    if abs(rate - 1.0) > 1e-9:
        # A proportional conversion equals the input only at rate == 1.
        assert quote["asset_amount"] != pytest.approx(amount_php, rel=1e-9, abs=1e-7) \
            or abs(amount_php) < 1e-6
