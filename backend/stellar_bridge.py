"""
SaloMed Stellar bridge
======================

Python-native admin-signed Soroban contract invocation. Used to credit a user's
vault with USDC on-chain after a PDAX fiat payment is confirmed.

Why not the Stellar CLI: the deployed backend (Render) has no CLI installed.
This module builds, signs, and submits the contract call using stellar-sdk
directly, so it works identically in local dev and in production containers.

Network-agnostic: everything is driven by environment variables, so switching
between testnet and mainnet is configuration only, no code change:
    RPC_URL, NETWORK_PASSPHRASE, CONTRACT_ID, SALOMED_SIGNER_SECRET
"""

from __future__ import annotations

import logging
import os
import time
from decimal import Decimal, ROUND_DOWN
from typing import Any

logger = logging.getLogger("salomed.bridge")

STROOPS_PER_ASSET = 10_000_000

try:
    from stellar_sdk import Keypair, SorobanServer, TransactionBuilder, scval
    from stellar_sdk import Address
    from stellar_sdk.exceptions import BaseRequestError  # noqa: F401
    _SDK_OK = True
except ImportError:  # pragma: no cover
    _SDK_OK = False
    logger.warning("[BRIDGE] stellar-sdk not installed; on-chain credit disabled.")


class BridgeError(Exception):
    """Raised when an on-chain credit cannot be completed."""


def _env(name: str, default: str = "") -> str:
    return os.getenv(name, default).strip()


def is_bridge_configured() -> bool:
    """True only if we can actually sign and submit a contract call."""
    return bool(
        _SDK_OK
        and _env("SALOMED_SIGNER_SECRET")
        and "REDACTED" not in _env("SALOMED_SIGNER_SECRET")
        and _env("CONTRACT_ID")
    )


def _asset_to_stroops(amount_asset: float | str | Decimal) -> int:
    dec = Decimal(str(amount_asset)).quantize(Decimal("0.0000001"), rounding=ROUND_DOWN)
    if dec <= 0:
        raise BridgeError("amount must be positive")
    return int(dec * STROOPS_PER_ASSET)


def credit_vault_usdc(beneficiary_address: str, amount_usdc: float | str | Decimal) -> str:
    """
    Admin-signed `deposit_remittance(admin, beneficiary, amount)` that moves USDC
    from the admin (institutional on-ramp float) into the beneficiary's locked
    vault. Returns the Stellar transaction hash on success.

    Raises BridgeError on any failure so callers can keep the credit retriable.
    """
    if not is_bridge_configured():
        raise BridgeError(
            "Stellar bridge not configured (need SALOMED_SIGNER_SECRET + CONTRACT_ID)."
        )

    rpc_url = _env("RPC_URL", "https://soroban-testnet.stellar.org")
    passphrase = _env("NETWORK_PASSPHRASE", "Test SDF Network ; September 2015")
    contract_id = _env("CONTRACT_ID")
    signer_secret = _env("SALOMED_SIGNER_SECRET")

    stroops = _asset_to_stroops(amount_usdc)

    try:
        signer = Keypair.from_secret(signer_secret)
    except Exception as exc:
        raise BridgeError(f"invalid SALOMED_SIGNER_SECRET: {exc}") from exc

    server = SorobanServer(rpc_url)

    try:
        source = server.load_account(signer.public_key)
    except Exception as exc:
        raise BridgeError(f"cannot load signer account (funded on this network?): {exc}") from exc

    args = [
        scval.to_address(signer.public_key),        # ofw / funder = admin
        scval.to_address(beneficiary_address),       # beneficiary vault
        scval.to_int128(stroops),                    # amount in stroops
    ]

    tx = (
        TransactionBuilder(source, passphrase, base_fee=1_000_000)
        .add_time_bounds(0, int(time.time()) + 120)
        .append_invoke_contract_function_op(
            contract_id=contract_id,
            function_name="deposit_remittance",
            parameters=args,
        )
        .build()
    )

    try:
        tx = server.prepare_transaction(tx)
    except Exception as exc:
        raise BridgeError(f"simulation/prepare failed: {exc}") from exc

    tx.sign(signer)

    try:
        sent = server.send_transaction(tx)
    except Exception as exc:
        raise BridgeError(f"submit failed: {exc}") from exc

    if getattr(sent, "status", "") == "ERROR":
        raise BridgeError(f"transaction rejected by network: {getattr(sent, 'error_result_xdr', '')}")

    tx_hash = sent.hash
    deadline = time.time() + 60
    while time.time() < deadline:
        try:
            result = server.get_transaction(tx_hash)
        except Exception:
            time.sleep(2)
            continue
        status = getattr(result, "status", None)
        status_name = getattr(status, "name", str(status))
        if status_name == "SUCCESS":
            logger.info("[BRIDGE] Credited %s USDC to %s (tx %s)", amount_usdc, beneficiary_address, tx_hash)
            return tx_hash
        if status_name == "FAILED":
            raise BridgeError(f"contract execution failed for tx {tx_hash}")
        time.sleep(2)

    raise BridgeError(f"transaction {tx_hash} still pending after timeout")


def ensure_fee_funds(address: str, minimum_xlm: float = 5.0) -> dict:
    """
    Make sure a user wallet can pay transaction fees for payment/padala.

    - If the account does not exist yet, create + fund it from the admin.
    - If it exists but holds less than `minimum_xlm`, top it up from the admin.
    - If it already has enough, do nothing.

    Uses classic Stellar operations (create_account / payment) via Horizon, so
    it works on testnet and mainnet purely by env. Returns a small status dict;
    never raises (funding failure should not block the app).
    """
    if not _SDK_OK:
        return {"funded": False, "reason": "sdk_unavailable"}

    signer_secret = _env("SALOMED_SIGNER_SECRET")
    if not signer_secret or "REDACTED" in signer_secret:
        return {"funded": False, "reason": "signer_not_configured"}

    from stellar_sdk import Server, TransactionBuilder as ClassicTB, Asset

    horizon_url = _env("HORIZON_URL", "https://horizon-testnet.stellar.org")
    passphrase = _env("NETWORK_PASSPHRASE", "Test SDF Network ; September 2015")

    try:
        signer = Keypair.from_secret(signer_secret)
    except Exception as exc:
        return {"funded": False, "reason": f"bad_signer: {exc}"}

    server = Server(horizon_url)

    # Does the target account already exist, and with how much XLM?
    exists = True
    native_balance = 0.0
    try:
        acct = server.accounts().account_id(address).call()
        for b in acct.get("balances", []):
            if b.get("asset_type") == "native":
                native_balance = float(b.get("balance", "0"))
    except Exception:
        exists = False

    if exists and native_balance >= minimum_xlm:
        return {"funded": True, "already": True, "balance_xlm": native_balance}

    try:
        source = server.load_account(signer.public_key)
        builder = (
            ClassicTB(source_account=source, network_passphrase=passphrase, base_fee=1000)
            .add_time_bounds(0, int(time.time()) + 120)
        )
        if not exists:
            builder.append_create_account_op(destination=address, starting_balance=str(minimum_xlm))
        else:
            topup = max(minimum_xlm - native_balance, 1.0)
            builder.append_payment_op(destination=address, asset=Asset.native(), amount=str(round(topup, 4)))
        tx = builder.build()
        tx.sign(signer)
        resp = server.submit_transaction(tx)
        return {"funded": True, "already": False, "tx_hash": resp.get("hash", ""), "created": not exists}
    except Exception as exc:
        logger.warning("[BRIDGE] fee funding failed for %s: %s", address, exc)
        return {"funded": False, "reason": str(exc)}
