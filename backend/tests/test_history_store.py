"""
Feature: reliable-traceable-transactions

Store-level tests for the append-only, address-keyed history index and the demo
ledger, plus the idempotent `source` migration.
"""
from __future__ import annotations

import os
import sqlite3
import tempfile
from decimal import Decimal

import pytest
from hypothesis import given, settings as hyp_settings, strategies as st

import history_store
from salomed_runtime import DemoLedger, LedgerError


PROVIDER = "GDGXGJTIGCXMQTAG362YFKCBZ4FARG33SDOKCZ4DOTFP4J63EPCYMRKH"
PATIENT = "GAXXWLECCE644QVYLKRHCDWDH5V7KMYG3GZEDPEB7C7LIQFPQ43ZBFEK"
STROOPS = 10_000_000


def _use_temp_history_db() -> str:
    d = tempfile.mkdtemp()
    os.environ["SALOMED_DB_PATH"] = os.path.join(d, "history.sqlite3")
    os.environ.pop("DATABASE_URL", None)
    history_store._USE_PG = False
    history_store._INITIALIZED = False
    return d


# ── Migration ────────────────────────────────────────────────────────────────

def test_idempotent_source_migration_on_legacy_table(tmp_path):
    db = str(tmp_path / "legacy.sqlite3")
    # Create a pre-`source` schema and one legacy row.
    with sqlite3.connect(db) as c:
        c.execute(
            """
            CREATE TABLE tx_history (
                id TEXT PRIMARY KEY, address TEXT NOT NULL, type TEXT NOT NULL,
                direction TEXT, amount_asset REAL NOT NULL DEFAULT 0,
                amount_php REAL NOT NULL DEFAULT 0, counterparty TEXT, tx_hash TEXT,
                status TEXT NOT NULL DEFAULT 'success', created_at INTEGER NOT NULL
            )
            """
        )
        c.execute(
            "INSERT INTO tx_history (id,address,type,amount_asset,amount_php,created_at) "
            "VALUES ('legacy1',?,?,1,1,1)",
            (PATIENT, "topup"),
        )

    os.environ["SALOMED_DB_PATH"] = db
    os.environ.pop("DATABASE_URL", None)
    history_store._USE_PG = False
    history_store._INITIALIZED = False

    # Recording must not fail and legacy rows read back with source = None.
    history_store.record(address=PATIENT, tx_type="topup", amount_asset=2.0,
                         amount_php=2.0, tx_hash="b" * 64, source="gcash")
    rows = history_store.history(PATIENT, limit=200)
    assert len(rows) == 2
    sources = {r["source"] for r in rows}
    assert sources == {None, "gcash"}


# ── Property 2: append-only, address-partitioned, field-preserving ────────────

_addr = st.text(alphabet="ABCDEFGH", min_size=3, max_size=6)
_src = st.sampled_from(["gcash", "instapay", "freighter", None, "unknown"])
_hash = st.one_of(st.none(), st.text(alphabet="0123456789abcdef", min_size=64, max_size=64))


# Feature: reliable-traceable-transactions, Property 2: History is append-only,
# address-partitioned, and field-preserving.
@hyp_settings(max_examples=100, deadline=None)
@given(scenario=st.lists(st.tuples(_addr, _src, _hash), min_size=0, max_size=25))
def test_history_is_append_only_address_partitioned_field_preserving(scenario):
    d = _use_temp_history_db()
    try:
        recorded: dict[str, list[dict]] = {}
        for addr, source, txh in scenario:
            row = history_store.record(
                address=addr, tx_type="topup", amount_asset=1.0, amount_php=1.0,
                tx_hash=txh, source=source,
            )
            recorded.setdefault(addr.strip().upper(), []).append(row)

        for addr, rows in recorded.items():
            hist = history_store.history(addr, limit=200)
            # Only this address's rows, and every one of them.
            assert len(hist) == len(rows)
            assert {r["id"] for r in hist} == {r["id"] for r in rows}
            by_id = {r["id"]: r for r in hist}
            for r in rows:
                assert by_id[r["id"]]["tx_hash"] == r["tx_hash"]
                assert by_id[r["id"]]["source"] == r["source"]
    finally:
        import shutil
        shutil.rmtree(d, ignore_errors=True)


# ── Property 5: ledger balance arithmetic and non-negativity ──────────────────

# Feature: reliable-traceable-transactions, Property 5: Ledger balance
# arithmetic and non-negativity.
@hyp_settings(max_examples=100, deadline=None)
@given(payments=st.lists(st.integers(min_value=1, max_value=15), min_size=0, max_size=20))
def test_demo_ledger_balance_arithmetic_and_non_negativity(payments):
    d = tempfile.mkdtemp()
    try:
        ledger = DemoLedger(os.path.join(d, "ledger.sqlite3"), Decimal("56.00"))
        # Seed with 100 XLM (5600 PHP at 56 PHP/asset).
        ledger.topup(PATIENT, Decimal("5600.00"), "seed-topup")
        expected = 100 * STROOPS

        for i, xlm in enumerate(payments):
            amount_stroops = xlm * STROOPS
            if amount_stroops <= expected:
                ledger.payment(PATIENT, PROVIDER, Decimal(xlm), f"pay-{i}")
                expected -= amount_stroops
            else:
                with pytest.raises(LedgerError):
                    ledger.payment(PATIENT, PROVIDER, Decimal(xlm), f"pay-{i}")
            vault = ledger.get_vault(PATIENT)
            assert vault["balance_stroops"] == expected
            assert vault["balance_stroops"] >= 0
    finally:
        import shutil
        shutil.rmtree(d, ignore_errors=True)


# ── Property 1: idempotent top-up credit (demo ledger) ────────────────────────

# Feature: reliable-traceable-transactions, Property 1: Idempotent top-up credit.
@hyp_settings(max_examples=100, deadline=None)
@given(
    php=st.integers(min_value=1, max_value=100000).map(lambda n: Decimal(n)),
    key=st.text(alphabet="abcdef0123456789", min_size=8, max_size=24),
    replays=st.integers(min_value=1, max_value=5),
)
def test_demo_topup_is_idempotent(php, key, replays):
    d = tempfile.mkdtemp()
    try:
        ledger = DemoLedger(os.path.join(d, "ledger.sqlite3"), Decimal("56.00"))
        first = ledger.topup(PATIENT, php, key, source="gcash")
        for _ in range(replays):
            again = ledger.topup(PATIENT, php, key, source="gcash")
            assert again["transaction_id"] == first["transaction_id"]
            assert again.get("replayed") is True
        # Credited exactly once regardless of the number of replays.
        vault = ledger.get_vault(PATIENT)
        expected_stroops = int((php / Decimal("56.00") * STROOPS))
        # Allow for ROUND_DOWN quantisation in asset_to_stroops.
        assert abs(vault["balance_stroops"] - expected_stroops) <= 1
    finally:
        import shutil
        shutil.rmtree(d, ignore_errors=True)
