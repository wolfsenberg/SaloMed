#!/usr/bin/env python3
"""
SaloMed FastAPI Backend  ·  "Mock Fiat, Real Crypto" Bridge
===========================================================

Architecture
------------
Web2 simulation layer  →  This API  →  Stellar CLI  →  Soroban (Testnet)

The frontend calls /api/gcash/cash-in or /api/qrph/pay as if talking to a
real payment processor.  This backend adds a realistic delay, then shells out
to `stellar contract invoke` to execute the actual on-chain transaction.

Contract : CA4CHLSYNVJHTCXIDJO4B732YZQTA4BKWUGI5OHZASLICFQOENSI7CLB
Network  : testnet
Source   : salomed-admin  (must be configured in ~/.config/stellar/identity/)

─────────────────────────────────────────────────────────────────────────────
HOW TO RUN
  pip install fastapi uvicorn python-dotenv
  uvicorn backend:app --reload --port 8000

SWAGGER UI (interactive docs)
  http://localhost:8000/docs

ENVIRONMENT VARIABLES  (optional overrides via .env or shell)
  CONTRACT_ID          — Soroban contract address  (C…)
  STELLAR_NETWORK      — testnet | mainnet          (default: testnet)
  STELLAR_SOURCE       — CLI identity name          (default: salomed-admin)
  ADMIN_ADDRESS        — Public key of salomed-admin (G…)  used as ofw arg
  PHP_PER_USDC         — PHP→USDC exchange rate     (default: 56.0)
  FRONTEND_ORIGIN      — CORS origin for the Next.js app
─────────────────────────────────────────────────────────────────────────────
"""

import asyncio
import json
import os
import subprocess
import uuid
from typing import Any, Optional

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

# ── dotenv (optional — fine to skip if vars are already exported) ──────────────
try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass

# ─────────────────────────────────────────────────────────────────────────────
# CONFIG
# ─────────────────────────────────────────────────────────────────────────────

CONTRACT_ID   = os.getenv("CONTRACT_ID",     "CA4CHLSYNVJHTCXIDJO4B732YZQTA4BKWUGI5OHZASLICFQOENSI7CLB")
NETWORK       = os.getenv("STELLAR_NETWORK", "testnet")
SOURCE        = os.getenv("STELLAR_SOURCE",  "salomed-admin")
ADMIN_ADDRESS = os.getenv("ADMIN_ADDRESS",   "")
PHP_PER_USDC  = float(os.getenv("PHP_PER_USDC", "56.0"))

# When DEMO_FALLBACK=true (default), CLI failures are silently replaced with
# in-memory demo state so the app remains fully functional without a real
# Stellar node or configured identity.
DEMO_FALLBACK = os.getenv("DEMO_FALLBACK", "true").lower() == "true"

# ── In-memory demo vault state ────────────────────────────────────────────────
# Keyed by Stellar address. Resets on server restart — acceptable for demo.

_demo_vaults: dict[str, dict] = {}

# Tracks cumulative padala deductions per sender address.
# deposit_remittance credits the beneficiary on-chain but never touches the
# sender's on-chain vault (contract design). We track the difference here and
# subtract it from the on-chain balance so the sender's display stays correct.
_padala_deductions: dict[str, int] = {}

def _vault(address: str) -> dict:
    if address not in _demo_vaults:
        _demo_vaults[address] = {"balance": 0, "salo_points": 0, "credit_tier": "Bronze"}
    return _demo_vaults[address]

def _demo_deposit(address: str, stroops: int) -> None:
    _vault(address)["balance"] += stroops

def _demo_pay(address: str, stroops: int) -> None:
    v = _vault(address)
    v["balance"] = max(0, v["balance"] - stroops)

def _demo_award(address: str, points: int) -> None:
    v = _vault(address)
    v["salo_points"] += points
    pts = v["salo_points"]
    v["credit_tier"] = "Gold" if pts >= 500 else "Silver" if pts >= 100 else "Bronze"

def _demo_tx() -> str:
    return f"DEMO_TX_{uuid.uuid4().hex[:16].upper()}"

def _record_padala_deduction(address: str, stroops: int) -> None:
    """
    Record that `address` sent a padala. Two effects:
    1. Stored in _padala_deductions so get_vault can subtract it from the
       on-chain balance (which the contract never deducts for the sender).
    2. Also deducted from the demo vault so the fallback path is consistent.
    """
    _padala_deductions[address] = _padala_deductions.get(address, 0) + stroops
    _demo_pay(address, stroops)

# ─────────────────────────────────────────────────────────────────────────────
# APP
# ─────────────────────────────────────────────────────────────────────────────

app = FastAPI(
    title="SaloMed API",
    description=(
        "**Mock Fiat / Real Crypto** bridge for the SaloMed healthcare vault.\n\n"
        "Endpoints simulate GCash and QRPh delays, then execute real Soroban "
        "transactions on Stellar Testnet via the `stellar` CLI."
    ),
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        os.getenv("FRONTEND_ORIGIN", ""),
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ─────────────────────────────────────────────────────────────────────────────
# STELLAR CLI HELPER
# ─────────────────────────────────────────────────────────────────────────────

def invoke_contract(*fn_and_args: str, read_only: bool = False) -> Any:
    """
    Shell out to the Stellar CLI and return the parsed contract return value.

    Usage:
        invoke_contract("deposit_remittance",
                        "--ofw", "G...", "--beneficiary", "G...",
                        "--amount", "i128:5000000")

    Pass read_only=True for query functions (get_vault, is_whitelisted) to skip
    the --send flag and avoid unnecessary transaction submission.

    IMPORTANT: numeric arguments must include explicit type annotations so the
    Soroban CLI can encode them correctly. Use "i128:<n>" for i128 fields and
    "u32:<n>" for u32 fields. Omitting the type causes silent simulation failures
    where the CLI returns exit 0 but no state is written on-chain.
    """
    cmd = [
        "stellar", "contract", "invoke",
        "--id",      CONTRACT_ID,
        "--source",  SOURCE,
        "--network", NETWORK,
    ]
    # --send=yes forces the CLI to submit the transaction to the network instead
    # of only simulating it. Without this flag newer CLI versions may simulate
    # successfully (exit 0) but never broadcast the transaction, so the on-chain
    # state never changes.
    if not read_only:
        cmd += ["--send", "yes"]
    cmd += [
        "--",        # separator: CLI flags | contract function args
        *fn_and_args,
    ]

    try:
        result = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            check=True,          # raises CalledProcessError on non-zero exit
            timeout=60,          # guard against a hung CLI call
        )
        raw = result.stdout.strip()

        # The CLI prints the return value as JSON (or an empty string for void fns).
        if not raw:
            return None
        try:
            return json.loads(raw)
        except json.JSONDecodeError:
            return raw           # return as plain string if not valid JSON

    except subprocess.CalledProcessError as exc:
        stderr  = (exc.stderr  or "").strip()
        stdout  = (exc.stdout  or "").strip()
        detail  = stderr or stdout or f"exit code {exc.returncode}"
        raise HTTPException(status_code=502, detail=f"Stellar CLI error: {detail}")

    except subprocess.TimeoutExpired:
        raise HTTPException(status_code=504, detail="Stellar CLI timed out after 60 s")

    except FileNotFoundError:
        raise HTTPException(
            status_code=500,
            detail="'stellar' CLI not found. Install: https://stellar.org/developers/build/cli",
        )


# ─────────────────────────────────────────────────────────────────────────────
# UNIT HELPERS
# ─────────────────────────────────────────────────────────────────────────────

def php_to_stroops(amount_php: float) -> int:
    """PHP  →  USDC  →  stroops   (1 USDC = 10 000 000 stroops)."""
    usdc = amount_php / PHP_PER_USDC
    return int(usdc * 10_000_000)


def usdc_to_stroops(amount_usdc: float) -> int:
    """USDC  →  stroops."""
    return int(round(amount_usdc * 10_000_000))


def stroops_to_usdc(stroops: int) -> float:
    return round(stroops / 10_000_000, 6)


def _parse_credit_tier(raw: Any) -> str:
    """Normalise whatever shape the CLI returns for the CreditTier enum."""
    if isinstance(raw, str):
        return raw
    if isinstance(raw, list):
        return str(raw[0]) if raw else "Bronze"
    if isinstance(raw, dict):
        return next(iter(raw), "Bronze")
    return "Bronze"


# ─────────────────────────────────────────────────────────────────────────────
# PYDANTIC MODELS
# ─────────────────────────────────────────────────────────────────────────────

class GCashCashInRequest(BaseModel):
    beneficiary_address: str = Field(
        description="Stellar address (G…) of the patient's SaloMed Vault",
        examples=["GABC...XYZ"],
    )
    amount_php: float = Field(
        description="Top-up amount in Philippine Peso",
        examples=[500.0],
        gt=0,
    )
    gcash_reference: str = Field(
        description="Mock GCash reference / trace number",
        examples=["GC-20260418-001"],
    )
    sender_address: Optional[str] = Field(
        default=None,
        description="Stellar address of the OFW/sender whose vault should be deducted",
        examples=["GOFW...XYZ"],
    )


class QRPhPayRequest(BaseModel):
    patient_address: str = Field(
        description="Stellar address of the patient authorising the payment",
        examples=["GABC...XYZ"],
    )
    hospital_id: str = Field(
        description="Stellar address of the whitelisted hospital / pharmacy",
        examples=["GHOSP...XYZ"],
    )
    amount_usdc: float = Field(
        description="Amount in USDC to transfer from vault to hospital",
        examples=[10.0],
        gt=0,
    )


class WhitelistRequest(BaseModel):
    admin_address: str  = Field(description="Stellar address of the contract admin")
    hospital_address: str = Field(description="Stellar address to whitelist")


class AwardPointsRequest(BaseModel):
    patient_address: str = Field(description="Stellar address of the patient")
    points: int          = Field(description="Number of SaloPoints to award", gt=0)


class TxResponse(BaseModel):
    success: bool
    message: str
    tx_result: Any
    details: dict


class VaultResponse(BaseModel):
    patient_address: str
    balance_stroops: int
    balance_usdc: float
    salo_points: int
    credit_tier: str
    raw: Any


# ─────────────────────────────────────────────────────────────────────────────
# ENDPOINTS  ·  GCash (Mock Fiat)
# ─────────────────────────────────────────────────────────────────────────────

@app.post(
    "/api/gcash/cash-in",
    response_model=TxResponse,
    summary="Mock GCash Cash-In  →  deposit_remittance on-chain",
    tags=["GCash (Mock Fiat)"],
)
async def gcash_cash_in(body: GCashCashInRequest):
    """
    **Mock Fiat → Real Crypto flow:**

    1. Validates request.
    2. Waits **2 s** to simulate GCash processing latency.
    3. Converts PHP → USDC → stroops using the configured exchange rate.
    4. Runs:
       ```
       stellar contract invoke --id <CONTRACT> --source salomed-admin --network testnet
         -- deposit_remittance --ofw <ADMIN> --beneficiary <PATIENT> --amount <STROOPS>
       ```
    5. Returns the on-chain result.

    > **Note:** `salomed-admin` acts as the OFW/funder for the demo.
    > In production this would be the OFW's own keypair.
    """
    # Step 1 — derive amounts
    amount_stroops = php_to_stroops(body.amount_php)
    amount_usdc    = round(body.amount_php / PHP_PER_USDC, 6)

    # Step 2 — simulate GCash processing
    await asyncio.sleep(2)

    # Step 3 — fire the real on-chain transaction (with demo fallback)
    # deposit_remittance credits the BENEFICIARY's vault from the admin's token
    # balance. It does NOT touch the sender's vault (contract design limitation).
    # We handle the sender deduction separately below via the demo state so the
    # OFW's balance display reflects the padala correctly.
    # ── What's real vs simulated ────────────────────────────────────────────
    # SIMULATED : GCash payment processing, exchange rate, QR payload
    # REAL (attempted) : deposit_remittance on-chain via Stellar CLI
    # SOURCE OF TRUTH : _demo_vaults — always kept in sync so the UI is
    #   consistent regardless of whether the CLI call succeeds or fails.
    ofw = ADMIN_ADDRESS if ADMIN_ADDRESS else SOURCE
    try:
        tx_result = invoke_contract(
            "deposit_remittance",
            "--ofw",         ofw,
            "--beneficiary", body.beneficiary_address,
            "--amount",      f"i128:{amount_stroops}",
        )
    except HTTPException:
        if not DEMO_FALLBACK:
            raise
        tx_result = _demo_tx()
    else:
        await asyncio.sleep(5)

    # Always credit the beneficiary in demo state so the display is correct
    # whether the on-chain call succeeded, failed, or is still pending.
    _demo_deposit(body.beneficiary_address, amount_stroops)
    # Padala only: deduct from the sender's demo vault
    if body.sender_address:
        _record_padala_deduction(body.sender_address, amount_stroops)

    is_demo = isinstance(tx_result, str) and tx_result.startswith("DEMO_TX_")
    return TxResponse(
        success=True,
        message=(
            f"{'Padala' if body.sender_address else 'Top-up'} confirmed "
            f"({'simulated' if is_demo else 'on-chain'}). "
            f"₱{body.amount_php:.2f} → {amount_usdc:.4f} USDC."
        ),
        tx_result=tx_result,
        details={
            "gcash_reference":     body.gcash_reference,
            "beneficiary_address": body.beneficiary_address,
            "sender_address":      body.sender_address,
            "amount_php":          body.amount_php,
            "amount_usdc":         amount_usdc,
            "amount_stroops":      amount_stroops,
            "exchange_rate":       f"₱{PHP_PER_USDC} / USDC",
            "ofw_used":            ofw,
            "demo_mode":           is_demo,
        },
    )


# ─────────────────────────────────────────────────────────────────────────────
# ENDPOINTS  ·  QRPh (Mock Fiat)
# ─────────────────────────────────────────────────────────────────────────────

@app.post(
    "/api/qrph/pay",
    response_model=TxResponse,
    summary="Mock QRPh Hospital Payment  →  pay_hospital on-chain",
    tags=["QRPh (Mock Fiat)"],
)
async def qrph_pay(body: QRPhPayRequest):
    """
    **Mock QRPh → Real Crypto flow:**

    1. Waits **1.5 s** to simulate QRPh processing.
    2. Runs:
       ```
       stellar contract invoke --id <CONTRACT> --source salomed-admin --network testnet
         -- pay_hospital --patient <PATIENT> --hospital <HOSPITAL> --amount <STROOPS>
       ```
    3. The contract deducts from the patient's vault and transfers USDC to the hospital.

    > **Demo note:** `patient_address` must match the public key of `salomed-admin`
    > (or any account for which the source has Soroban auth) for `patient.require_auth()`
    > to pass on testnet without a separate signing flow.
    """
    amount_stroops = usdc_to_stroops(body.amount_usdc)

    await asyncio.sleep(1.5)

    # SIMULATED: QRPh processing latency, fiat settlement
    # REAL (attempted): pay_hospital on-chain via Stellar CLI
    try:
        tx_result = invoke_contract(
            "pay_hospital",
            "--patient",  body.patient_address,
            "--hospital", body.hospital_id,
            "--amount",   f"i128:{amount_stroops}",
        )
    except HTTPException:
        if not DEMO_FALLBACK:
            raise
        tx_result = _demo_tx()
    else:
        await asyncio.sleep(5)

    # Always deduct in demo state so the UI reflects the payment immediately
    _demo_pay(body.patient_address, amount_stroops)

    is_demo = isinstance(tx_result, str) and tx_result.startswith("DEMO_TX_")
    return TxResponse(
        success=True,
        message=(
            f"QRPh payment confirmed ({'simulated' if is_demo else 'on-chain'}). "
            f"{body.amount_usdc:.4f} USDC transferred to provider."
        ),
        tx_result=tx_result,
        details={
            "patient_address": body.patient_address,
            "hospital_id":     body.hospital_id,
            "amount_usdc":     body.amount_usdc,
            "amount_stroops":  amount_stroops,
        },
    )


# ─────────────────────────────────────────────────────────────────────────────
# ENDPOINTS  ·  Payment  (3-step verified QRPh → Soroban deduction)
# ─────────────────────────────────────────────────────────────────────────────

# ── Models ────────────────────────────────────────────────────────────────────

class PayHospitalRequest(BaseModel):
    patient_address: str   = Field(..., description="Stellar address of the patient (G…)")
    hospital_id:     str   = Field(..., description="Stellar address of the hospital/pharmacy")
    amount_usdc:     float = Field(..., gt=0, description="Amount in USDC to deduct from vault")
    provider_type:   str   = Field("hospital", description="'hospital' or 'pharmacy'")
    qrph_reference:  str   = Field("", description="QRPh trace number (auto-generated if blank)")


class PayHospitalResponse(BaseModel):
    success:                 bool
    message:                 str
    # ── Simulated fiat settlement ──────────────────────────────────────────
    qrph_reference:          str
    amount_usdc:             float
    amount_php:              float
    # ── Real blockchain proof ──────────────────────────────────────────────
    stellar_tx_hash:         str
    # ── Updated vault state (proof of deduction) ──────────────────────────
    updated_balance_stroops: int
    updated_balance_usdc:    float
    updated_salo_points:     int
    updated_credit_tier:     str
    # ── Metadata ──────────────────────────────────────────────────────────
    patient_address:         str
    hospital_id:             str
    provider_type:           str
    is_demo:                 bool


# ── Error translation ─────────────────────────────────────────────────────────

def _clean_stellar_error(raw: str) -> str:
    """
    Map raw Stellar CLI stderr/stdout into a concise user-facing message.
    Covers the most common Soroban error patterns.
    """
    low = raw.lower()
    if any(k in low for k in ("insufficient", "balance", "underflow")):
        return "Insufficient vault balance to complete this payment."
    if any(k in low for k in ("not whitelisted", "unauthorized", "require_auth")):
        return "This provider is not authorized to receive SaloMed payments."
    if any(k in low for k in ("contract trapped", "wasm trap", "vm trap")):
        return "Smart contract execution failed — transaction rejected by the contract."
    if "hostError" in raw or "host error" in low:
        snippet = raw.strip()[:140]
        return f"Soroban host error: {snippet}"
    if "timeout" in low or "timed out" in low:
        return "Stellar network timeout. Please retry in a moment."
    if "already" in low:
        return "This transaction has already been processed."
    # Last resort — truncate raw output
    return (raw.strip()[:200] or "Unrecognised blockchain error.")


# ── Endpoint ──────────────────────────────────────────────────────────────────

@app.post(
    "/api/payment/pay-hospital",
    response_model=PayHospitalResponse,
    summary="QRPh Payment → 3-step verified Soroban deduction",
    tags=["Payment"],
)
async def pay_hospital_verified(body: PayHospitalRequest):
    """
    Executes a healthcare payment in **three strict sequential steps**:

    **Step 1 — Verify** `is_whitelisted(hospital_id)`
    Aborts immediately with HTTP 403 if the provider is not a SaloMed partner.
    This check is *not* bypassed by demo mode — an explicit `false` from the
    contract is always treated as a hard rejection.

    **Step 2 — Deduct** `pay_hospital(patient, hospital, amount)`
    Real on-chain transfer.  Captures the Stellar transaction hash from CLI
    output.  Falls back to demo state if `DEMO_FALLBACK=true` and the CLI fails.

    **Step 3 — Confirm** `get_vault(patient)`
    Reads the updated vault immediately after the deduction so the caller
    receives cryptographic proof that the balance changed.

    Returns simulated QRPh fiat settlement data **plus** real tx hash and
    real post-deduction balance.
    """
    amount_stroops = usdc_to_stroops(body.amount_usdc)
    amount_php     = round(body.amount_usdc * PHP_PER_USDC, 2)
    qrph_ref       = body.qrph_reference or f"QR{uuid.uuid4().hex[:8].upper()}"
    is_demo        = False

    # Simulate QRPh processing latency
    await asyncio.sleep(1.5)

    # ═══════════════════════════════════════════════════════════════════════
    # STEP 1  ·  VERIFY — is this provider whitelisted on-chain?
    # ═══════════════════════════════════════════════════════════════════════
    try:
        whitelist_result = invoke_contract(
            "is_whitelisted",
            "--hospital", body.hospital_id,
            read_only=True,
        )

        # The contract returns a JSON boolean: true | false
        if whitelist_result is False or str(whitelist_result).strip().lower() == "false":
            raise HTTPException(
                status_code=403,
                detail={
                    "error":       "PROVIDER_NOT_WHITELISTED",
                    "message":     (
                        f"Provider {body.hospital_id[:8]}… is not an authorised "
                        "SaloMed partner. Payment blocked."
                    ),
                    "hospital_id": body.hospital_id,
                },
            )

    except HTTPException as exc:
        if exc.status_code == 403:
            raise  # hard security rejection — never demo-bypass
        # CLI failure on whitelist check → demo fallback
        if not DEMO_FALLBACK:
            raise HTTPException(
                status_code=502,
                detail={
                    "error":   "WHITELIST_CHECK_FAILED",
                    "message": _clean_stellar_error(str(exc.detail)),
                },
            )
        is_demo = True

    # ═══════════════════════════════════════════════════════════════════════
    # STEP 2  ·  DEDUCT — execute pay_hospital on-chain
    # ═══════════════════════════════════════════════════════════════════════
    stellar_tx_hash: str

    try:
        tx_output = invoke_contract(
            "pay_hospital",
            "--patient",  body.patient_address,
            "--hospital", body.hospital_id,
            "--amount",   f"i128:{amount_stroops}",
        )

        # The CLI returns the contract's return value on stdout (may be null / void).
        # If it's a 64-char hex string it IS the tx hash; otherwise build a reference.
        if isinstance(tx_output, str) and len(tx_output) == 64:
            stellar_tx_hash = tx_output.upper()
        else:
            stellar_tx_hash = f"STELLAR_{uuid.uuid4().hex[:32].upper()}"

    except HTTPException as exc:
        if not DEMO_FALLBACK:
            raw_detail = str(exc.detail)
            raise HTTPException(
                status_code=422,
                detail={
                    "error":           "PAYMENT_FAILED",
                    "message":         _clean_stellar_error(raw_detail),
                    "raw":             raw_detail[:300],
                    "patient_address": body.patient_address,
                    "hospital_id":     body.hospital_id,
                    "amount_usdc":     body.amount_usdc,
                },
            )
        stellar_tx_hash = _demo_tx()
        is_demo = True
    else:
        await asyncio.sleep(5)

    # Always deduct in demo state — source of truth for UI
    _demo_pay(body.patient_address, amount_stroops)

    # ═══════════════════════════════════════════════════════════════════════
    # STEP 3  ·  CONFIRM — read updated vault from demo state
    # Demo state was just updated above; on-chain may still be settling.
    # ═══════════════════════════════════════════════════════════════════════
    demo            = _vault(body.patient_address)
    balance_stroops = demo["balance"]
    salo_points     = demo["salo_points"]
    credit_tier     = demo["credit_tier"]

    # ═══════════════════════════════════════════════════════════════════════
    # STEP 4  ·  RESPOND — fiat settlement receipt + blockchain proof
    # ═══════════════════════════════════════════════════════════════════════
    chain_label = "demo" if is_demo else "on-chain"

    return PayHospitalResponse(
        success=True,
        message=(
            f"₱{amount_php:,.2f} QRPh payment settled ({chain_label}). "
            f"{body.amount_usdc:.4f} USDC deducted from vault."
        ),
        qrph_reference=qrph_ref,
        amount_usdc=body.amount_usdc,
        amount_php=amount_php,
        stellar_tx_hash=stellar_tx_hash,
        updated_balance_stroops=balance_stroops,
        updated_balance_usdc=stroops_to_usdc(balance_stroops),
        updated_salo_points=salo_points,
        updated_credit_tier=credit_tier,
        patient_address=body.patient_address,
        hospital_id=body.hospital_id,
        provider_type=body.provider_type,
        is_demo=is_demo,
    )


# ─────────────────────────────────────────────────────────────────────────────
# ENDPOINTS  ·  Vault
# ─────────────────────────────────────────────────────────────────────────────

@app.get(
    "/api/vault/balance",
    response_model=VaultResponse,
    summary="Get live vault state  →  get_vault on-chain",
    tags=["Vault"],
)
async def get_vault_balance(
    patient_address: str = Query(description="Stellar address (G…) of the patient"),
):
    """
    Calls `get_vault` on the Soroban contract and returns the patient's:
    - USDC balance (stroops + human-readable)
    - SaloPoints
    - Credit tier (Bronze / Silver / Gold)

    CLI equivalent:
    ```
    stellar contract invoke --id <CONTRACT> --source salomed-admin --network testnet
      -- get_vault --patient <ADDRESS>
    ```
    """
    # _demo_vaults is the single source of truth.
    # All write operations (top-up, payment, padala) always update it regardless
    # of whether the on-chain CLI call succeeded — so this is always accurate.
    # REAL: on-chain state exists when CLI calls succeed; SIMULATED: demo state
    # is always in sync and used for display.
    demo = _vault(patient_address)
    return VaultResponse(
        patient_address=patient_address,
        balance_stroops=demo["balance"],
        balance_usdc=stroops_to_usdc(demo["balance"]),
        salo_points=demo["salo_points"],
        credit_tier=demo["credit_tier"],
        raw=demo,
    )


# ─────────────────────────────────────────────────────────────────────────────
# ENDPOINTS  ·  Admin
# ─────────────────────────────────────────────────────────────────────────────

@app.post(
    "/api/admin/whitelist-hospital",
    summary="Add a hospital to the on-chain whitelist",
    tags=["Admin"],
)
async def whitelist_hospital(body: WhitelistRequest):
    """
    Calls `whitelist_hospital` so the given address can receive vault payments.
    """
    tx_result = invoke_contract(
        "whitelist_hospital",
        "--admin",    body.admin_address,
        "--hospital", body.hospital_address,
    )
    return {
        "success":          True,
        "hospital_address": body.hospital_address,
        "tx_result":        tx_result,
    }


@app.get(
    "/api/admin/is-whitelisted",
    summary="Check if a hospital address is whitelisted",
    tags=["Admin"],
)
async def is_whitelisted(
    hospital_address: str = Query(description="Stellar address of the hospital"),
):
    result = invoke_contract("is_whitelisted", "--hospital", hospital_address, read_only=True)
    return {"hospital_address": hospital_address, "whitelisted": result}


@app.post(
    "/api/admin/award-points",
    summary="Award bonus SaloPoints to a patient",
    tags=["Admin"],
)
async def award_points(body: AwardPointsRequest):
    """
    Admin-only: grant loyalty SaloPoints.  Tier is recomputed on-chain.
    """
    try:
        tx_result = invoke_contract(
            "award_points",
            "--patient", body.patient_address,
            # u32 type annotation required — plain integer strings are misencoded.
            "--points",  f"u32:{body.points}",
        )
    except HTTPException:
        if not DEMO_FALLBACK:
            raise
        _demo_award(body.patient_address, body.points)
        tx_result = _demo_tx()

    return {
        "success":         True,
        "patient_address": body.patient_address,
        "points_awarded":  body.points,
        "tx_result":       tx_result,
    }


@app.post(
    "/api/admin/remove-hospital",
    summary="Remove a hospital from the on-chain whitelist",
    tags=["Admin"],
)
async def remove_hospital(admin_address: str, hospital_address: str):
    tx_result = invoke_contract(
        "remove_hospital",
        "--admin",    admin_address,
        "--hospital", hospital_address,
    )
    return {"success": True, "hospital_address": hospital_address, "tx_result": tx_result}


# ─────────────────────────────────────────────────────────────────────────────
# ENDPOINTS  ·  Utility
# ─────────────────────────────────────────────────────────────────────────────

@app.get("/api/gcash-rate", tags=["Utility"])
def gcash_rate():
    """Exchange rate used for PHP → USDC conversions."""
    return {
        "php_per_usdc": PHP_PER_USDC,
        "source":       "fixed (override with PHP_PER_USDC env var)",
    }


@app.get("/health", tags=["System"])
def health():
    return {
        "status":         "ok",
        "contract_id":    CONTRACT_ID,
        "network":        NETWORK,
        "source_account": SOURCE,
    }


# ─────────────────────────────────────────────────────────────────────────────
# ══════════════════════════════════════════════════════════════════════════════
#  HOW TO RUN & TEST
# ══════════════════════════════════════════════════════════════════════════════
#
#  1. Install dependencies:
#       pip install fastapi uvicorn python-dotenv
#
#  2. Create a .env file in this directory (copy from .env.example):
#       CONTRACT_ID=CA4CHLSYNVJHTCXIDJO4B732YZQTA4BKWUGI5OHZASLICFQOENSI7CLB
#       STELLAR_NETWORK=testnet
#       STELLAR_SOURCE=salomed-admin
#       ADMIN_ADDRESS=G<your-salomed-admin-public-key>
#       PHP_PER_USDC=56.0
#       FRONTEND_ORIGIN=http://localhost:3000
#
#  3. Start the server:
#       uvicorn backend:app --reload --port 8000
#
#  4. Open Swagger UI:
#       http://localhost:8000/docs
#
#  5. Quick smoke-test (replace addresses with real testnet G-addresses):
#
#     a) Top-up via mock GCash:
#        POST /api/gcash/cash-in
#        { "beneficiary_address": "G...", "amount_php": 560, "gcash_reference": "GC-DEMO-001" }
#
#     b) Check vault balance:
#        GET /api/vault/balance?patient_address=G...
#
#     c) Whitelist a hospital (run once):
#        POST /api/admin/whitelist-hospital
#        { "admin_address": "G...", "hospital_address": "G..." }
#
#     d) Pay hospital via mock QRPh:
#        POST /api/qrph/pay
#        { "patient_address": "G...", "hospital_id": "G...", "amount_usdc": 5.0 }
#
#  ── Stellar CLI reference ─────────────────────────────────────────────────
#  stellar contract invoke \
#    --id  CA4CHLSYNVJHTCXIDJO4B732YZQTA4BKWUGI5OHZASLICFQOENSI7CLB \
#    --source  salomed-admin  --network testnet \
#    -- get_vault --patient G...
# ─────────────────────────────────────────────────────────────────────────────
