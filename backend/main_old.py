"""
SaloMed FastAPI backend.

Responsibilities:
  - /api/scan-bill   — OCR a hospital bill image, return the gap amount
  - /api/trigger-contract — stub for future Stellar SDK contract invocation
"""

import io
import os
import re
import uuid
from typing import Any, Optional

from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

# ─── app setup ────────────────────────────────────────────────────────────────

app = FastAPI(title="SaloMed API", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",  # Next.js dev server
        os.getenv("FRONTEND_ORIGIN", ""),
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ─── models ───────────────────────────────────────────────────────────────────


class BillScanResult(BaseModel):
    total_bill: float = Field(description="Gross hospital bill in PHP")
    philhealth_deduction: float = Field(description="PhilHealth benefit applied")
    hmo_deduction: float = Field(description="HMO coverage applied")
    out_of_pocket_balance: float = Field(description="Remaining gap the patient must pay")
    ocr_mode: str = Field(description="'real' if Tesseract ran, 'mock' otherwise")
    raw_text: Optional[str] = Field(default=None, description="Raw OCR output for debugging")


class ContractTriggerRequest(BaseModel):
    function_name: str = Field(
        description="Soroban function: deposit_remittance | pay_hospital | award_points"
    )
    patient_address: str
    hospital_address: Optional[str] = None
    ofw_address: Optional[str] = None
    # Amount in USDC (human units). Backend converts to stroops before submitting.
    amount_usdc: Optional[float] = None
    points: Optional[int] = None


class ContractTriggerResponse(BaseModel):
    status: str
    message: str
    transaction_hash: Optional[str] = None
    params_received: dict[str, Any] = {}


# ─── OCR helpers ──────────────────────────────────────────────────────────────

# Regex patterns tuned for common Philippine hospital bill layouts.
# Each pattern looks for the label then captures the first peso amount that follows.
_AMOUNT_RE = r"[\d,]+\.?\d*"

_PATTERNS: dict[str, list[str]] = {
    "total": [
        r"total\s*(hospital\s*bill|bill|amount|due|charges?)[^\d]*(" + _AMOUNT_RE + r")",
        r"gross\s*(total|amount)[^\d]*(" + _AMOUNT_RE + r")",
        r"amount\s*due[^\d]*(" + _AMOUNT_RE + r")",
    ],
    "philhealth": [
        r"phil\s*health\s*(benefit|deduction|coverage|case\s*rate)?[^\d]*(" + _AMOUNT_RE + r")",
        r"phic[^\d]*(" + _AMOUNT_RE + r")",
    ],
    "hmo": [
        r"hmo\s*(coverage|benefit|deduction)?[^\d]*(" + _AMOUNT_RE + r")",
        r"health\s*card[^\d]*(" + _AMOUNT_RE + r")",
    ],
}


def _find_amount(text: str, label: str) -> float:
    for pattern in _PATTERNS[label]:
        m = re.search(pattern, text, re.IGNORECASE)
        if m:
            raw = m.group(m.lastindex)  # last capture group = the number
            return float(raw.replace(",", ""))
    return 0.0


def _run_tesseract(image_bytes: bytes) -> str:
    """Attempt real OCR. Raises ImportError/OSError if Tesseract isn't installed."""
    import pytesseract
    from PIL import Image

    img = Image.open(io.BytesIO(image_bytes))
    # Upscale small images so Tesseract reads them better
    if max(img.size) < 1000:
        scale = 1000 / max(img.size)
        img = img.resize((int(img.width * scale), int(img.height * scale)))
    return pytesseract.image_to_string(img, lang="eng")


def _mock_ocr_text() -> str:
    """
    Simulated bill text — mirrors what Tesseract would return from a real
    Philippine hospital statement of account.
    """
    return (
        "STATEMENT OF ACCOUNT\n"
        "Patient: Juan Dela Cruz\n"
        "Admission Date: 2026-04-15\n\n"
        "CHARGES\n"
        "  Room & Board          8,500.00\n"
        "  Professional Fee      3,200.00\n"
        "  Medicines             2,800.00\n"
        "  Laboratory            1,000.00\n"
        "  ─────────────────────────────\n"
        "  TOTAL HOSPITAL BILL  15,500.00\n\n"
        "DEDUCTIONS\n"
        "  PhilHealth Benefit    3,200.00\n"
        "  HMO Coverage          2,500.00\n"
        "  ─────────────────────────────\n"
        "  AMOUNT DUE            9,800.00\n"
    )


# ─── endpoints ────────────────────────────────────────────────────────────────


@app.post("/api/scan-bill", response_model=BillScanResult)
async def scan_bill(file: UploadFile = File(...)):
    """
    Upload a hospital bill image (PNG / JPG / WEBP).
    Returns the parsed breakdown and the out-of-pocket gap.
    """
    if not (file.content_type or "").startswith("image/"):
        raise HTTPException(status_code=400, detail="File must be an image (PNG, JPG, WEBP).")

    image_bytes = await file.read()
    if len(image_bytes) > 10 * 1024 * 1024:
        raise HTTPException(status_code=413, detail="Image must be under 10 MB.")

    ocr_mode = "real"
    try:
        raw_text = _run_tesseract(image_bytes)
    except Exception:
        # Tesseract not installed → fall back to mock so the API stays usable
        raw_text = _mock_ocr_text()
        ocr_mode = "mock"

    total = _find_amount(raw_text, "total")
    philhealth = _find_amount(raw_text, "philhealth")
    hmo = _find_amount(raw_text, "hmo")

    # If OCR produced no usable numbers, fall back to mock values
    if total == 0 and ocr_mode == "real":
        raw_text = _mock_ocr_text()
        ocr_mode = "mock"
        total = _find_amount(raw_text, "total")
        philhealth = _find_amount(raw_text, "philhealth")
        hmo = _find_amount(raw_text, "hmo")

    gap = max(total - philhealth - hmo, 0.0)

    return BillScanResult(
        total_bill=total,
        philhealth_deduction=philhealth,
        hmo_deduction=hmo,
        out_of_pocket_balance=gap,
        ocr_mode=ocr_mode,
        raw_text=raw_text,
    )


@app.post("/api/trigger-contract", response_model=ContractTriggerResponse)
async def trigger_contract(body: ContractTriggerRequest):
    """
    Invoke a SaloMed Soroban function on behalf of the user.

    TODO (Task 4 — Stellar SDK bridge):
      1. Load server keypair from env: SALOMED_SIGNER_SECRET
      2. Build SorobanServer pointing at RPC_URL
      3. Assemble the ContractInvocation with the correct XDR args
      4. Simulate → sign → submit → return transaction_hash
    """
    allowed = {"deposit_remittance", "pay_hospital", "award_points"}
    if body.function_name not in allowed:
        raise HTTPException(
            status_code=400,
            detail=f"Unknown function '{body.function_name}'. Allowed: {sorted(allowed)}",
        )

    # Convert human USDC to stroops for the contract (1 USDC = 10_000_000 stroops)
    stroops = int((body.amount_usdc or 0) * 10_000_000)

    return ContractTriggerResponse(
        status="pending",
        message=(
            f"'{body.function_name}' queued — "
            "Stellar SDK submission will be wired up in the bridge task."
        ),
        transaction_hash=None,
        params_received={
            "function": body.function_name,
            "patient": body.patient_address,
            "hospital": body.hospital_address,
            "ofw": body.ofw_address,
            "amount_stroops": stroops,
            "points": body.points,
            "contract_id": os.getenv("CONTRACT_ID", "(not set)"),
        },
    )


# ─── GCash integration ───────────────────────────────────────────────────────
#
# Real flow (requires GCash for Business / Mynt developer credentials):
#   1. Call POST https://api.globelabs.com.ph/... (or Maya/PayMongo GCash endpoint)
#      with amount_php → receive a checkout_url + qr_code_data
#   2. User scans QR / opens checkout_url inside GCash app
#   3. GCash sends a webhook to /api/gcash-webhook → verify signature
#   4. On success: call deposit_remittance on Soroban contract
#
# Until you have credentials, the mock below lets you build and test the full UI.

# PHP → USDC conversion rate. In production: fetch from Binance/Kraken/Coingecko.
_PHP_PER_USDC: float = float(os.getenv("PHP_PER_USDC", "56.0"))


class GCashTopUpRequest(BaseModel):
    gcash_number: str = Field(description="Sender's 11-digit GCash number (09XXXXXXXXX)")
    amount_php: float = Field(description="PHP amount to top up")
    beneficiary_address: str = Field(description="Stellar address of the SaloMed Vault owner")


class GCashTopUpResponse(BaseModel):
    reference_id: str
    qr_payload: str          # EMVCo QR string — scan with GCash app in production
    amount_php: float
    amount_usdc: float       # credited to vault after payment confirmed
    exchange_rate: float     # PHP per 1 USDC used for this transaction
    status: str              # "pending" until webhook confirms
    message: str


class GCashWebhookPayload(BaseModel):
    reference_id: str
    status: str              # "SUCCESS" | "FAILED"
    amount: float
    msisdn: str              # GCash number of payer


class GCashCashOutRequest(BaseModel):
    gcash_number: str
    amount_usdc: float
    patient_address: str


@app.post("/api/gcash-topup", response_model=GCashTopUpResponse)
async def gcash_topup(body: GCashTopUpRequest):
    """
    Initiate a GCash → SaloMed Vault top-up.

    TODO (real integration):
      • Call GCash PaymentLink / Maya Checkout API
      • Store pending {reference_id: (beneficiary, amount_usdc)} in Redis/DB
      • Return actual QR code payload from GCash response
    """
    if body.amount_php <= 0:
        raise HTTPException(status_code=400, detail="amount_php must be positive")
    if not body.gcash_number.startswith("09") or len(body.gcash_number) != 11:
        raise HTTPException(status_code=400, detail="GCash number must be 09XXXXXXXXX (11 digits)")

    ref_id = "SM" + uuid.uuid4().hex[:8].upper()
    amount_usdc = round(body.amount_php / _PHP_PER_USDC, 6)

    # Mock EMVCo QR string — replace with real GCash API response in production
    qr_payload = (
        f"00020101021226570011ph.ppmi.www0116{body.gcash_number}"
        f"520400005303608540{body.amount_php:.2f}5802PH"
        f"5916SALOMED VAULT6304{ref_id}"
    )

    return GCashTopUpResponse(
        reference_id=ref_id,
        qr_payload=qr_payload,
        amount_php=body.amount_php,
        amount_usdc=amount_usdc,
        exchange_rate=_PHP_PER_USDC,
        status="pending",
        message=f"[DEMO] Scan QR with GCash to send ₱{body.amount_php:.2f}. Ref: {ref_id}",
    )


@app.post("/api/gcash-confirm")
async def gcash_confirm(reference_id: str, beneficiary_address: str):
    """
    DEMO ONLY — simulate a confirmed GCash payment and trigger vault deposit.

    In production this endpoint is REPLACED by /api/gcash-webhook below,
    which is called by GCash servers and must verify an HMAC signature.
    """
    # TODO: look up pending payment by reference_id, get (beneficiary, amount_usdc)
    # TODO: call deposit_remittance on Soroban via Stellar SDK
    return {
        "status": "confirmed",
        "reference_id": reference_id,
        "message": (
            "Payment confirmed (demo). "
            "In production: Stellar SDK triggers deposit_remittance on-chain."
        ),
    }


@app.post("/api/gcash-webhook")
async def gcash_webhook(payload: GCashWebhookPayload, request_signature: str = ""):
    """
    Real GCash webhook endpoint.

    TODO:
      1. Verify HMAC-SHA256 signature from X-GCash-Signature header
      2. Look up pending payment by payload.reference_id
      3. If payload.status == "SUCCESS": call deposit_remittance on Soroban
      4. Mark payment as complete in DB
    """
    if payload.status != "SUCCESS":
        return {"received": True, "action": "none"}

    return {
        "received": True,
        "action": "deposit_remittance_queued",
        "reference_id": payload.reference_id,
        "note": "Stellar SDK integration pending — see /api/trigger-contract",
    }


@app.get("/api/gcash-rate")
async def gcash_rate():
    """Return the current PHP → USDC rate used by the system."""
    return {
        "php_per_usdc": _PHP_PER_USDC,
        "source": "fixed (set PHP_PER_USDC env var or integrate Coingecko)",
    }


@app.get("/health")
def health():
    return {
        "status": "ok",
        "service": "SaloMed API",
        "contract_id": os.getenv("CONTRACT_ID", "(not configured)"),
        "network": os.getenv("STELLAR_NETWORK", "testnet"),
    }
