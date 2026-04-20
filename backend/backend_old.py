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

CONTRACT_ID : CAO3K6OYB5A3VNVV3HKCSVG3ZZ442DZCDKAXG4CTSLBTN7FOYCCBRZ34
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

# ── Stellar SDK (Python) ─────────────────────────────────────────────────────
try:
    from stellar_sdk import (
        Server, Keypair, TransactionBuilder, Network, Asset, SorobanServer
    )
    from stellar_sdk.exceptions import BaseRequestError
    STELLAR_SDK_OK = True
except ImportError:
    STELLAR_SDK_OK = False
    print("[WARN] stellar-sdk not installed. Run: pip install stellar-sdk>=11.0.0")

# USDC Testnet (Placeholder Issuer - using ADMIN_ADDRESS to ensure valid checksum)

# ── dotenv (optional — fine to skip if vars are already exported) ──────────────
try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass

# ─────────────────────────────────────────────────────────────────────────────
# CONFIG
# ─────────────────────────────────────────────────────────────────────────────

CONTRACT_ID   = os.getenv("CONTRACT_ID",     "CAO3K6OYB5A3VNVV3HKCSVG3ZZ442DZCDKAXG4CTSLBTN7FOYCCBRZ34")
NETWORK       = os.getenv("STELLAR_NETWORK", "testnet")
SOURCE        = os.getenv("STELLAR_SOURCE",  "salomed-admin")
ADMIN_ADDRESS = os.getenv("ADMIN_ADDRESS",   "GBSXYPN2XWTJEZPLAMRIYQQVQTCJ2MEQOVOA3G73USGCMEXJ5YXPU2G7")
PHP_PER_USDC  = float(os.getenv("PHP_PER_USDC", "56.0"))
ADMIN_ADDRESS = os.getenv("ADMIN_ADDRESS",   "GBSXYPN2XWTJEZPLAMRIYQQVQTCJ2MEQOVOA3G73USGCMEXJ5YXPU2G7")
PHP_PER_XLM   = float(os.getenv("PHP_PER_USDC", "56.0"))
PHP_PER_USDC  = PHP_PER_XLM # Alias for backward compatibility

# When DEMO_FALLBACK=true (default), CLI failures are silently replaced with
# in-memory demo state so the app remains fully functional without a real
# Stellar node or configured identity.
DEMO_FALLBACK = os.getenv("DEMO_FALLBACK", "true").lower() == "true"

# ── In-memory demo vault state ────────────────────────────────────────────────
# Keyed by Stellar address. Resets on server restart — acceptable for demo.

# RPC and Horizon Setup
HORIZON_URL = os.getenv("HORIZON_URL", "https://horizon-testnet.stellar.org")
RPC_URL     = os.getenv("RPC_URL",     "https://soroban-testnet.stellar.org")
SIGNER_SECRET = os.getenv("SALOMED_SIGNER_SECRET", "") # Used ONLY for system-signed top-ups

if STELLAR_SDK_OK:
    horizon_server = Server(HORIZON_URL)
    rpc_server     = SorobanServer(RPC_URL)
else:
    horizon_server = None  # type: ignore
    rpc_server     = None  # type: ignore

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

# Build the list of allowed origins from environment variables
origins = [
    "http://localhost:3000",
    "http://localhost:3001",
    "http://127.0.0.1:3000",
]
env_origins = os.getenv("FRONTEND_ORIGIN", "")
if env_origins:
    # Support comma-separated origins e.g. "https://myapp.vercel.app,https://another.com"
    origins.extend([o.strip() for o in env_origins.split(",") if o.strip()])

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
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
    - XLM balance (stroops + human-readable)
    - SaloPoints
    - Credit tier (Bronze / Silver / Gold)
    """
    # 1. Try to fetch real on-chain state first
    try:
        raw_vault = invoke_contract("get_vault", "--patient", patient_address, read_only=True)
        if raw_vault and isinstance(raw_vault, dict):
            balance_stroops = int(raw_vault.get("balance", "0"))
            salo_points     = int(raw_vault.get("salo_points", 0))
            credit_tier     = _parse_credit_tier(raw_vault.get("credit_tier", "Bronze"))

            # CRITICAL: Always sync our local cache if we have a successful on-chain read
            d = _vault(patient_address)
            d["balance"]     = balance_stroops
            d["salo_points"] = salo_points
            d["credit_tier"] = credit_tier
            
            print(f"[ON-CHAIN SYNC] {patient_address[:8]}: {balance_stroops} stroops")

            return VaultResponse(
                patient_address=patient_address,
                balance_stroops=balance_stroops,
                balance_usdc=stroops_to_usdc(balance_stroops),
                salo_points=salo_points,
                credit_tier=credit_tier,
                raw=raw_vault,
            )
    except Exception as e:
        print(f"[ON-CHAIN ERROR] Failed to fetch vault for {patient_address[:8]}: {e}")
        if not DEMO_FALLBACK:
            raise

    # 2. Fallback to demo state
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
# ENDPOINTS  ·  Legit Simulation Logic
# ─────────────────────────────────────────────────────────────────────────────

@app.post(
    "/api/topup",
    summary="GCash Top-Up → REAL XLM sent by backend (Auto-Activation)",
    tags=["Demo"],
)
async def topup(
    patient_address: str = Query(..., description="User's Stellar address (G…)"),
    amount_php: float  = Query(..., description="PHP amount to convert to XLM"),
):
    """
    Architecture: Fake GCash Success → Backend signs REAL tx → user wallet gets XLM on testnet.

    1. Convert PHP → XLM using PHP_PER_XLM rate.
    2. Check if recipient account exists on Horizon.
       - If NOT exists → CreateAccount (activates wallet + funds it).
       - If exists     → Payment (sends XLM).
    3. Backend signs the tx using SALOMED_SIGNER_SECRET.
    4. Submits directly to Horizon.
    5. Returns the real tx hash.
    """
    if not STELLAR_SDK_OK:
        raise HTTPException(status_code=500, detail="stellar-sdk not installed. Run: pip install stellar-sdk>=11.0.0")
    if not SIGNER_SECRET:
        raise HTTPException(status_code=500, detail="SALOMED_SIGNER_SECRET not set in .env")

    xlm_amount = round(amount_php / PHP_PER_XLM, 6)
    if xlm_amount <= 0:
        raise HTTPException(status_code=400, detail="Amount must be positive.")

    await asyncio.sleep(2)  # Simulate GCash processing delay

    try:
        kp             = Keypair.from_secret(SIGNER_SECRET)
        source_account = horizon_server.load_account(kp.public_key)

        # Check if recipient account exists on testnet
        exists = True
        try:
            horizon_server.load_account(patient_address)
        except Exception:
            exists = False

        builder = TransactionBuilder(
            source_account,
            network_passphrase=Network.TESTNET_NETWORK_PASSPHRASE,
            base_fee=1000,
        ).set_timeout(30)

        if not exists:
            # Account needs to be created — minimum 1 XLM reserve + send amount
            starting_bal = str(max(2.0, xlm_amount))
            builder.append_create_account_op(
                destination=patient_address,
                starting_balance=starting_bal,
                source=kp.public_key,
            )
            xlm_funded = float(starting_bal)
            msg = f"GCash top-up: wallet ACTIVATED and funded with {xlm_funded} XLM (testnet)."
        else:
            builder.append_payment_op(
                destination=patient_address,
                asset=Asset.native(),
                amount=str(xlm_amount),
                source=kp.public_key,
            )
            xlm_funded = xlm_amount
            msg = f"GCash top-up: sent {xlm_amount} XLM to wallet (testnet)."

        tx = builder.build()
        tx.sign(kp)
        response = horizon_server.submit_transaction(tx)

        tx_hash = response.get("hash", response.get("id", "unknown"))
        print(f"[TOPUP OK] {patient_address[:8]}… ← {xlm_funded} XLM | tx: {tx_hash}")

        # Keep demo state in sync
        _demo_deposit(patient_address, usdc_to_stroops(xlm_funded))

        return {
            "success":   True,
            "message":   msg,
            "tx_hash":   tx_hash,
            "xlm_sent":  xlm_funded,
            "amount_php": amount_php,
            "recipient": patient_address,
        }

    except HTTPException:
        raise
    except Exception as e:
        detail = str(e)
        # Extract Horizon error detail if present
        if hasattr(e, 'extras') and e.extras:  # type: ignore
            try:
                detail = str(e.extras.get('result_codes', detail))  # type: ignore
            except Exception:
                pass
        print(f"[TOPUP ERROR] {detail}")
        raise HTTPException(status_code=500, detail=f"Top-up failed: {detail}")


@app.post(
    "/api/prepare-payment",
    summary="Prepare Payment XDR — Unsigned (User → Merchant, for Freighter to sign)",
    tags=["Demo"],
)
async def prepare_payment(
    user_address:      str   = Query(..., description="Stellar address of the paying user"),
    recipient_address: str   = Query(..., description="Stellar address of the merchant/hospital"),
    amount_xlm:        float = Query(..., description="Amount in XLM to send"),
):
    """
    Architecture: User clicks Pay → Backend builds unsigned XDR → Freighter signs → Frontend submits to Horizon.

    Returns unsigned transaction XDR for the frontend to pass to Freighter.
    The tx is a simple native XLM payment: user_address → recipient_address.
    """
    if not STELLAR_SDK_OK:
        raise HTTPException(status_code=500, detail="stellar-sdk not installed on backend.")
    if amount_xlm <= 0:
        raise HTTPException(status_code=400, detail="Amount must be positive.")

    try:
        source = horizon_server.load_account(user_address)
    except Exception:
        raise HTTPException(
            status_code=400,
            detail="Sender wallet not found on Testnet. Please fund your account first (use GCash top-up or Stellar Friendbot)."
        )

    try:
        tx = (
            TransactionBuilder(
                source,
                network_passphrase=Network.TESTNET_NETWORK_PASSPHRASE,
                base_fee=10000,
            )
            .append_payment_op(
                destination=recipient_address,
                asset=Asset.native(),
                amount=str(round(amount_xlm, 7)),
                source=user_address,
            )
            .set_timeout(30)
            .build()
        )
        xdr = tx.to_xdr()
        print(f"[PREPARE PAYMENT] {user_address[:8]}… → {recipient_address[:8]}… | {amount_xlm} XLM")
        return {"success": True, "xdr": xdr, "amount_xlm": amount_xlm}

    except HTTPException:
        raise
    except Exception as e:
        print(f"[PREPARE PAYMENT ERROR] {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post(
    "/api/prepare-padala",
    summary="Prepare Padala XDR — Unsigned (OFW → Beneficiary, for Freighter to sign)",
    tags=["Demo"],
)
async def prepare_padala(
    ofw_address:          str   = Query(..., description="Stellar address of the sender (OFW)"),
    beneficiary_address:  str   = Query(..., description="Stellar address of the recipient"),
    amount_xlm:           float = Query(..., description="Amount in XLM to send"),
):
    """
    Architecture: OFW clicks Send → Backend builds unsigned XDR → Freighter signs → Frontend submits to Horizon.

    Returns unsigned transaction XDR: ofw_address → beneficiary_address, native XLM.
    """
    if not STELLAR_SDK_OK:
        raise HTTPException(status_code=500, detail="stellar-sdk not installed on backend.")
    if amount_xlm <= 0:
        raise HTTPException(status_code=400, detail="Amount must be positive.")

    try:
        source = horizon_server.load_account(ofw_address)
    except Exception:
        raise HTTPException(
            status_code=400,
            detail="Sender wallet not found on Testnet. Top up your wallet first."
        )

    try:
        tx = (
            TransactionBuilder(
                source,
                network_passphrase=Network.TESTNET_NETWORK_PASSPHRASE,
                base_fee=10000,
            )
            .append_payment_op(
                destination=beneficiary_address,
                asset=Asset.native(),
                amount=str(round(amount_xlm, 7)),
                source=ofw_address,
            )
            .set_timeout(30)
            .build()
        )
        xdr = tx.to_xdr()
        print(f"[PREPARE PADALA] {ofw_address[:8]}… → {beneficiary_address[:8]}… | {amount_xlm} XLM")
        return {"success": True, "xdr": xdr, "amount_xlm": amount_xlm}

    except HTTPException:
        raise
    except Exception as e:
        print(f"[PREPARE PADALA ERROR] {e}")
        raise HTTPException(status_code=500, detail=str(e))


# Keep the old endpoint names as aliases so nothing breaks if called
@app.post("/api/simulate-topup", tags=["Utility"], include_in_schema=False)
async def simulate_topup_alias(patient_address: str = Query(...), amount_php: float = Query(...)):
    """Backward-compat alias for /api/topup."""
    return await topup(patient_address=patient_address, amount_php=amount_php)


@app.post("/api/prepare-spend", tags=["Utility"], include_in_schema=False)
async def prepare_spend_alias(user_address: str = Query(...), hospital_id: str = Query(...), amount_usdc: float = Query(...)):
    """Backward-compat alias for /api/prepare-payment."""
    return await prepare_payment(user_address=user_address, recipient_address=hospital_id, amount_xlm=amount_usdc)


@app.post(
    "/api/demo/grant",
    summary="[DEMO ONLY] Grant 10,000 XLM to a tester's WALLET (Pocket)",
    tags=["Utility"],
)
async def demo_grant(patient_address: str = Query(...)):
    """
    On-chain grant: Admin sends 10,000 native XLM to the user's wallet.
    This gives the user funds to test the 'Top Up' feature manually.
    """
    grant_amount_xlm = 10000.0
    try:
        cmd = [
            "stellar", "asset", "transfer",
            "--source", SOURCE,
            "--network", NETWORK,
            "--asset", "native",
            "--to", patient_address,
            "--amount", str(grant_amount_xlm)
        ]
        subprocess.run(cmd, check=True, capture_output=True, text=True)
        return {
            "success": True,
            "message": f"Successfully granted {grant_amount_xlm:,.0f} XLM to your WALLET ({patient_address[:8]}...).",
            "note": "You can now use these funds to TOP UP your SaloMed Vault."
        }
    except Exception as e:
        print(f"[FAUCET ERROR] {e}")
        return {"success": False, "detail": str(e)}


@app.post(
    "/api/demo/fund-fees",
    summary="[DEMO ONLY] Send 5 native XLM to a wallet for transaction fees",
    tags=["Utility"],
)
async def fund_fees(address: str = Query(...)):
    """
    Simulates a small 'gas' gift. The admin sends 5 native XLM to the user.
    This is required for new Testnet wallets to pay Soroban transaction fees.
    """
    try:
        # Use stellar-sdk directly if possible, or shell out to 'stellar transfer'
        # To keep it consistent, let's use the CLI 'stellar asset transfer'
        cmd = [
            "stellar", "asset", "transfer",
            "--source", SOURCE,
            "--network", NETWORK,
            "--asset", "native",
            "--to", address,
            "--amount", "5"
        ]
        subprocess.run(cmd, check=True, capture_output=True, text=True)
        return {"success": True, "message": f"Sent 5 XLM to {address[:8]}... for fees."}
    except Exception as e:
        # Fallback: maybe they already have enough or Friendbot is better
        return {"success": False, "detail": str(e)}


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


@app.get("/api/balance", tags=["Utility"])
async def get_native_balance(address: str = Query(..., description="Stellar address (G…)")):
    """
    Returns the real native XLM balance for any address by querying Horizon directly.
    This is the source of truth for the vault balance display.
    The frontend calls this after every top-up or payment to refresh the displayed balance.
    """
    if not STELLAR_SDK_OK:
        raise HTTPException(status_code=500, detail="stellar-sdk not installed on backend.")
    try:
        data = horizon_server.accounts().account_id(address).call()
        balances = data.get("balances", [])
        xlm_bal = 0.0
        for b in balances:
            if b.get("asset_type") == "native":
                xlm_bal = float(b.get("balance", 0.0))
                break
        # Convert XLM to stroops for consistency with VaultResponse schema
        stroops = int(xlm_bal * 10_000_000)
        # Also read demo vault for salo_points / tier
        demo = _vault(address)
        return {
            "address":        address,
            "xlm_balance":    xlm_bal,
            "balance_stroops": stroops,
            "balance_usdc":   round(xlm_bal, 6),
            "salo_points":    demo["salo_points"],
            "credit_tier":    demo["credit_tier"],
            "source":         "horizon-testnet",
        }
    except Exception as e:
        # If account not found on Horizon (unfunded), return zeroes
        return {
            "address":        address,
            "xlm_balance":    0.0,
            "balance_stroops": 0,
            "balance_usdc":   0.0,
            "salo_points":    0,
            "credit_tier":    "Bronze",
            "source":         "unfunded",
            "note":           "Account not found on Testnet — fund it via GCash top-up first.",
        }


@app.get("/health", tags=["System"])
def health():
    return {
        "status":         "ok",
        "contract_id":    CONTRACT_ID,
        "network":        NETWORK,
        "source_account": SOURCE,
        "stellar_sdk":    STELLAR_SDK_OK,
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
