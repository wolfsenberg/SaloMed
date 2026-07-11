from __future__ import annotations

import pytest

from salomed_runtime import RuntimeSettings


def test_pdax_uat_requires_private_spec_approval(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("SALOMED_MODE", "pdax_uat")
    monkeypatch.setenv("PDAX_USERNAME", "actual-user")
    monkeypatch.setenv("PDAX_PASSWORD", "actual-password")
    monkeypatch.setenv("PDAX_WEBHOOK_SECRET", "actual-webhook-secret")
    monkeypatch.setenv("CONTRACT_ID", "CAO3K6OYB5A3VNVV3HKCSVG3ZZ442DZCDKAXG4CTSLBTN7FOYCCBRZ34")
    monkeypatch.setenv("STELLAR_NETWORK", "testnet")
    monkeypatch.setenv("SALOMED_CONTRACT_CONFIG_VERIFIED", "true")
    monkeypatch.setenv("SALOMED_EXPECTED_TOKEN_ID", "CAO3K6OYB5A3VNVV3HKCSVG3ZZ442DZCDKAXG4CTSLBTN7FOYCCBRZ34")
    monkeypatch.setenv("ADMIN_ADDRESS", "GAXXWLECCE644QVYLKRHCDWDH5V7KMYG3GZEDPEB7C7LIQFPQ43ZBFEK")
    monkeypatch.delenv("PDAX_PRIVATE_SPEC_VERIFIED", raising=False)

    with pytest.raises(RuntimeError, match="PDAX_PRIVATE_SPEC_VERIFIED"):
        RuntimeSettings.from_env()


def test_placeholder_credentials_are_rejected(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("SALOMED_MODE", "pdax_uat")
    monkeypatch.setenv("PDAX_USERNAME", "REDACTED_REPLACE_WITH_SECRET_MANAGER")
    monkeypatch.setenv("PDAX_PASSWORD", "REDACTED_REPLACE_WITH_SECRET_MANAGER")
    monkeypatch.setenv("PDAX_WEBHOOK_SECRET", "REDACTED_REPLACE_WITH_SECRET_MANAGER")
    monkeypatch.setenv("PDAX_PRIVATE_SPEC_VERIFIED", "true")
    monkeypatch.setenv("CONTRACT_ID", "CAO3K6OYB5A3VNVV3HKCSVG3ZZ442DZCDKAXG4CTSLBTN7FOYCCBRZ34")
    monkeypatch.setenv("STELLAR_NETWORK", "testnet")
    monkeypatch.setenv("SALOMED_CONTRACT_CONFIG_VERIFIED", "true")
    monkeypatch.setenv("SALOMED_EXPECTED_TOKEN_ID", "CAO3K6OYB5A3VNVV3HKCSVG3ZZ442DZCDKAXG4CTSLBTN7FOYCCBRZ34")
    monkeypatch.setenv("ADMIN_ADDRESS", "GAXXWLECCE644QVYLKRHCDWDH5V7KMYG3GZEDPEB7C7LIQFPQ43ZBFEK")

    with pytest.raises(RuntimeError, match="requires real values"):
        RuntimeSettings.from_env()


def test_stellar_mode_requires_verified_contract_asset(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("SALOMED_MODE", "stellar_testnet")
    monkeypatch.setenv("CONTRACT_ID", "CAO3K6OYB5A3VNVV3HKCSVG3ZZ442DZCDKAXG4CTSLBTN7FOYCCBRZ34")
    monkeypatch.setenv("STELLAR_NETWORK", "testnet")
    monkeypatch.setenv("SALOMED_EXPECTED_TOKEN_ID", "CAO3K6OYB5A3VNVV3HKCSVG3ZZ442DZCDKAXG4CTSLBTN7FOYCCBRZ34")
    monkeypatch.setenv("ADMIN_ADDRESS", "GAXXWLECCE644QVYLKRHCDWDH5V7KMYG3GZEDPEB7C7LIQFPQ43ZBFEK")
    monkeypatch.delenv("SALOMED_CONTRACT_CONFIG_VERIFIED", raising=False)

    with pytest.raises(RuntimeError, match="get_token_id/get_admin"):
        RuntimeSettings.from_env()
