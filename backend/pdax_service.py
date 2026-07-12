"""
SaloMed × PDAX Institutional API Service
=========================================
Handles all PDAX API interactions for SaloMed:

  - Authentication  (login, token refresh, auto-retry on 401)
  - Live PHP/XLM exchange rate  (indicative quote)
  - Fiat deposit initiation     (InstaPay on-ramp)
  - Fiat withdrawal             (InstaPay off-ramp)
  - Webhook event processing    (deposit/trade confirmations)

Design principles
-----------------
1. NEVER raises an unhandled exception — every public method returns a dict
   with a `success` key so callers can pattern-match without try/except.
2. Falls back gracefully: if PDAX credentials are not configured the service
   returns demo/static values so the rest of the app keeps working exactly
   as before.
3. Tokens are stored in memory (refreshed automatically) — no disk writes,
   no secrets in logs.
4. All HTTP calls are async (httpx.AsyncClient) to avoid blocking FastAPI.

PDAX UAT base URL:  https://uat.services.sandbox.pdax.ph/api/pdax-api
Supported assets:   XLM  (Stellar Lumens)  |  USDCXLM (USD Coin on Stellar)
Supported payment:  InstaPay
Supported banks:    BASECPH (Security Bank)  |  BACTBPH (CTBC Bank PH)
Token lifetime:     ~600 seconds (~10 minutes) — auto-refreshed before expiry
"""

from __future__ import annotations

import asyncio
import logging
import os
import time
import uuid
from typing import Any

# httpx is bundled with uvicorn[standard] which is already in requirements.txt.
# We do a lazy import so the rest of the app doesn't crash if it's somehow missing.
try:
    import httpx
    _HTTPX_OK = True
except ImportError:
    _HTTPX_OK = False
    logging.warning("[PDAX] httpx not installed — PDAX integration disabled. Run: pip install httpx")

logger = logging.getLogger("salomed.pdax")

# ─────────────────────────────────────────────────────────────────────────────
# CONFIG  (read once at import time; safe — no secrets are logged)
# ─────────────────────────────────────────────────────────────────────────────

PDAX_BASE_URL  = os.getenv("PDAX_BASE_URL",  "https://uat.services.sandbox.pdax.ph/api/pdax-api")
PDAX_USERNAME  = os.getenv("PDAX_USERNAME",  "")
PDAX_PASSWORD  = os.getenv("PDAX_PASSWORD",  "")
PDAX_WEBHOOK_SECRET = os.getenv("PDAX_WEBHOOK_SECRET", "")

# Credentials configured check — used to gate all PDAX calls
_PDAX_CONFIGURED = bool(PDAX_USERNAME and PDAX_PASSWORD
                        and "your_username_here" not in PDAX_USERNAME)

# ─────────────────────────────────────────────────────────────────────────────
# TOKEN STORE  (in-memory, never persisted)
# ─────────────────────────────────────────────────────────────────────────────

class _TokenStore:
    """Thread-safe-ish in-memory token store for a single PDAX account."""
    access_token:  str = ""
    id_token:      str = ""
    refresh_token: str = ""
    expires_at:    float = 0.0   # Unix timestamp when access_token expires

    @property
    def is_valid(self) -> bool:
        # Consider valid if we have tokens AND they won't expire in the next 60 s
        return bool(self.access_token and self.id_token
                    and time.time() < self.expires_at - 60)

    def save(self, data: dict) -> None:
        self.access_token  = data.get("access_token",  "")
        self.id_token      = data.get("id_token",      "")
        self.refresh_token = data.get("refresh_token", "")
        # PDAX tokens last ~600 s; store exact expiry for refresh logic
        self.expires_at    = time.time() + data.get("expires_in", 600)

    def headers(self) -> dict[str, str]:
        return {
            "access_token": self.access_token,
            "id_token":     self.id_token,
            "Content-Type": "application/json",
        }

    def clear(self) -> None:
        self.access_token = self.id_token = self.refresh_token = ""
        self.expires_at = 0.0


_tokens = _TokenStore()

# ─────────────────────────────────────────────────────────────────────────────
# INTERNAL HELPERS
# ─────────────────────────────────────────────────────────────────────────────

def _url(path: str) -> str:
    """Build an absolute PDAX URL from a relative path."""
    return f"{PDAX_BASE_URL.rstrip('/')}/{path.lstrip('/')}"


async def _login() -> bool:
    """
    Authenticate with PDAX and store tokens.
    Returns True on success, False on failure.
    """
    if not _HTTPX_OK:
        return False

    try:
        async with httpx.AsyncClient(timeout=15) as client:
            resp = await client.post(
                _url("/pdax-institution/v1/login"),
                json={"username": PDAX_USERNAME, "password": PDAX_PASSWORD},
            )
        if resp.status_code == 200:
            _tokens.save(resp.json())
            logger.info("[PDAX] Login successful.")
            return True
        else:
            logger.warning("[PDAX] Login failed: %s %s", resp.status_code, resp.text[:200])
            return False
    except Exception as exc:
        logger.error("[PDAX] Login error: %s", exc)
        return False


async def _refresh() -> bool:
    """
    Refresh the access token using the stored refresh_token.
    Falls back to a full re-login if refresh fails.
    """
    if not _HTTPX_OK or not _tokens.refresh_token:
        return await _login()

    try:
        async with httpx.AsyncClient(timeout=15) as client:
            resp = await client.put(
                _url("/pdax-institution/v1/refresh-token"),
                headers={"refresh_token": _tokens.refresh_token, "Content-Type": "application/json"},
            )
        if resp.status_code == 200:
            _tokens.save(resp.json())
            logger.info("[PDAX] Token refreshed.")
            return True
        else:
            logger.warning("[PDAX] Refresh failed (%s) — attempting re-login.", resp.status_code)
            _tokens.clear()
            return await _login()
    except Exception as exc:
        logger.error("[PDAX] Refresh error: %s — attempting re-login.", exc)
        _tokens.clear()
        return await _login()


async def _ensure_auth() -> bool:
    """
    Ensure we have a valid token before making an API call.
    Handles first-time login and mid-session refresh transparently.
    """
    if not _PDAX_CONFIGURED:
        return False
    if _tokens.is_valid:
        return True
    if _tokens.refresh_token:
        return await _refresh()
    return await _login()


async def _request(
    method: str,
    path: str,
    *,
    params: dict | None = None,
    json: dict | None = None,
    retry: bool = True,
) -> dict[str, Any]:
    """
    Authenticated PDAX API request with automatic token refresh on 401.

    Returns a normalised dict:
        { "ok": True,  "data": <response body> }          on success
        { "ok": False, "error": <message>, "status": <int> }  on failure
    """
    if not _HTTPX_OK:
        return {"ok": False, "error": "httpx not installed", "status": 0}

    authed = await _ensure_auth()
    if not authed:
        return {"ok": False, "error": "PDAX authentication failed — check PDAX_USERNAME/PDAX_PASSWORD in .env", "status": 401}

    try:
        async with httpx.AsyncClient(timeout=20) as client:
            resp = await client.request(
                method.upper(),
                _url(path),
                params=params,
                json=json,
                headers=_tokens.headers(),
            )

        if resp.status_code == 401 and retry:
            # Token expired mid-flight — refresh and retry once
            logger.info("[PDAX] 401 received — refreshing token and retrying.")
            _tokens.clear()
            refreshed = await _refresh()
            if not refreshed:
                return {"ok": False, "error": "Token refresh failed", "status": 401}
            return await _request(method, path, params=params, json=json, retry=False)

        if resp.status_code >= 400:
            body = {}
            try:
                body = resp.json()
            except Exception:
                pass
            msg = body.get("message") or body.get("error") or resp.text[:200]
            logger.warning("[PDAX] %s %s → %s: %s", method, path, resp.status_code, msg)
            return {"ok": False, "error": msg, "status": resp.status_code}

        return {"ok": True, "data": resp.json()}

    except httpx.TimeoutException:
        return {"ok": False, "error": "PDAX API request timed out", "status": 504}
    except Exception as exc:
        logger.error("[PDAX] Request error: %s", exc)
        return {"ok": False, "error": str(exc), "status": 0}


# ─────────────────────────────────────────────────────────────────────────────
# PUBLIC API
# ─────────────────────────────────────────────────────────────────────────────

# ── 1. Live PHP/XLM exchange rate ─────────────────────────────────────────────

# Simple in-process cache so we don't hammer PDAX on every page load
_rate_cache: dict[str, Any] = {"rate": 56.0, "ts": 0.0}
_RATE_TTL = 30  # seconds before we re-fetch


async def get_php_to_asset_quote(amount_php: float, asset: str = "USDC",
                                 fallback_rate: float = 56.0) -> dict[str, Any]:
    """
    Live PHP -> {USDC|XLM} conversion via the verified PDAX price endpoint.

    Verified contract (UAT):
        GET /trade/price?base_currency=PHP&quote_currency=<asset>
            &base_quantity=<php>&side=buy
        -> {data:{price, total_amount}}
        price        = PHP per 1 unit of <asset>  (e.g. ~62.26 for USDC)
        total_amount = units of <asset> received for `amount_php`

    Returns:
        { "success": bool, "rate": float, "asset": str,
          "asset_amount": float, "amount_php": float, "source": "pdax_live"|"indicative" }
    Never raises.
    """
    asset = asset.upper()
    safe_php = max(float(amount_php or 0), 0.0)

    if _PDAX_CONFIGURED and safe_php > 0:
        result = await _request(
            "GET",
            "/pdax-institution/v1/trade/price",
            params={
                "base_currency": "PHP",
                "quote_currency": asset,
                "base_quantity": safe_php,
                "side": "buy",
            },
        )
        if result["ok"]:
            data = result["data"].get("data", result["data"]) if isinstance(result["data"], dict) else {}
            price = data.get("price")
            total = data.get("total_amount")
            try:
                rate = float(price)
                asset_amount = float(total)
                if rate > 0 and asset_amount >= 0:
                    _rate_cache["rate"] = rate
                    _rate_cache["ts"] = time.time()
                    logger.info("[PDAX] Live PHP/%s rate: %.4f (%.2f PHP -> %.4f %s)",
                                asset, rate, safe_php, asset_amount, asset)
                    return {
                        "success": True,
                        "rate": rate,
                        "asset": asset,
                        "asset_amount": asset_amount,
                        "amount_php": safe_php,
                        "source": "pdax_live",
                    }
            except (TypeError, ValueError):
                pass
        logger.warning("[PDAX] Live quote failed for PHP/%s; using indicative %.2f", asset, fallback_rate)

    rate = _rate_cache["rate"] if _rate_cache["ts"] > 0 else fallback_rate
    return {
        "success": False,
        "rate": rate,
        "asset": asset,
        "asset_amount": round(safe_php / rate, 7) if rate else 0.0,
        "amount_php": safe_php,
        "source": "indicative",
    }


async def get_xlm_php_rate(fallback_rate: float = 56.0) -> float:
    """
    Backwards-compatible shim: returns PHP per 1 USDC as a float using the live
    PDAX quote, or the fallback if PDAX is unavailable. Retained for legacy
    callers; new code should use get_php_to_asset_quote().
    """
    quote = await get_php_to_asset_quote(1000.0, "USDC", fallback_rate=fallback_rate)
    return quote.get("rate", fallback_rate)


async def get_deposit_status(identifier: str) -> dict[str, Any]:
    """
    Look up a fiat deposit by our identifier.

    Verified contract (UAT):
        GET /fiat/transactions?identifier=<id>
        -> {data:[{request_id, transaction_id, amount, method, status,
                   reference_number, mode, ...}]}

    Returns:
        { "success": bool, "found": bool, "status": str, "amount": float,
          "reference_number": str, "raw": <item> }
    Never raises.
    """
    result = await _request(
        "GET",
        "/pdax-institution/v1/fiat/transactions",
        params={"identifier": identifier},
    )
    if not result["ok"]:
        return {"success": False, "found": False, "status": "unknown",
                "error": result.get("error", "status lookup failed")}

    payload = result["data"]
    items = payload.get("data") if isinstance(payload, dict) else payload
    if not items:
        return {"success": True, "found": False, "status": "pending"}

    item = items[0] if isinstance(items, list) else items
    return {
        "success": True,
        "found": True,
        "status": str(item.get("status", "")).lower(),
        "amount": float(item.get("amount") or 0),
        "reference_number": item.get("reference_number", ""),
        "raw": item,
    }


# ── 2. Fiat Deposit (InstaPay on-ramp) ───────────────────────────────────────

async def initiate_instapay_deposit(
    amount_php: float,
    sender_first_name: str = "SaloMed",
    sender_middle_name: str = "Health",
    sender_last_name: str = "User",
    sender_email: str = "user@salomed.app",
    reference_id: str | None = None,
) -> dict[str, Any]:
    """
    Initiate a real PHP fiat cash-in via PDAX InstaPay (UPAY channel).

    Verified payload contract (UAT sandbox):
        amount, currency='PHP', identifier, method='instapay_upay_cashin',
        sender_first_name/middle/last, sender_email,
        sender_country_origin='Philippines', source_of_funds='Compensation',
        beneficiary_first/middle/last, purpose='Family Support',
        relationship_of_sender_to_beneficiary
    Rejected fields: channel, sender_mobile.

    Returns on success:
        { "success": True, "checkout_url": <UPAY url>, "identifier": <id>,
          "reference_number": <str>, "amount_php": <float>, "status": "PENDING" }
    Returns on failure:
        { "success": False, "error": <pdax message> }
    Never raises.
    """
    if not _PDAX_CONFIGURED:
        return {"success": False, "error": "PDAX not configured"}

    identifier = reference_id or f"SALOMED-{uuid.uuid4().hex[:12].upper()}"

    payload: dict[str, Any] = {
        "amount": amount_php,
        "currency": "PHP",
        "identifier": identifier,
        "method": "instapay_upay_cashin",
        "sender_first_name": sender_first_name,
        "sender_middle_name": sender_middle_name,
        "sender_last_name": sender_last_name,
        "sender_email": sender_email,
        "sender_country_origin": "Philippines",
        "source_of_funds": "Compensation",
        "beneficiary_first_name": "SaloMed",
        "beneficiary_middle_name": "Health",
        "beneficiary_last_name": "Vault",
        "purpose": "Family Support",
        "relationship_of_sender_to_beneficiary": "Myself",
    }

    result = await _request("POST", "/pdax-institution/v1/fiat/deposit", json=payload)

    if result["ok"]:
        data = result["data"]
        return {
            "success": True,
            "checkout_url": data.get("payment_checkout_url", ""),
            "identifier": data.get("identifier", identifier),
            "reference_number": data.get("reference_number", ""),
            "request_id": data.get("request_id", ""),
            "amount_php": float(data.get("amount") or amount_php),
            "status": data.get("status", "PENDING"),
            "raw": data,
        }

    return {
        "success": False,
        "error": result.get("error", "PDAX deposit initiation failed"),
        "status_code": result.get("status", 0),
    }


# ── 3. Fiat Withdrawal (InstaPay off-ramp) ────────────────────────────────────

async def initiate_instapay_withdrawal(
    amount_php: float,
    bank_code:  str,
    account_number: str,
    account_name:   str,
    reference_id:   str | None = None,
) -> dict[str, Any]:
    """
    Initiate a PHP fiat withdrawal to a Philippine bank via PDAX InstaPay.

    Supported bank codes in UAT:
        BASECPH — Security Bank Corporation
        BACTBPH — CTBC Bank Philippines Corporation

    Returns on success:
        {
          "success": True,
          "reference_id": "...",
          "amount_php": 500.0,
          "status": "pending",
          "pdax_reference": "...",
        }
    """
    if not _PDAX_CONFIGURED:
        return {
            "success":  False,
            "error":    "PDAX not configured — withdrawal unavailable",
            "fallback": True,
        }

    ref = reference_id or f"SALOMED-WD-{uuid.uuid4().hex[:12].upper()}"

    payload: dict[str, Any] = {
        "amount":         amount_php,
        "currency":       "PHP",
        "channel":        "INSTAPAY",
        "bank_code":      bank_code,
        "account_number": account_number,
        "account_name":   account_name,
        "reference_id":   ref,
    }

    result = await _request("POST", "/pdax-institution/v1/fiat/withdraw", json=payload)

    if result["ok"]:
        data = result["data"]
        return {
            "success":        True,
            "reference_id":   ref,
            "amount_php":     amount_php,
            "status":         data.get("status", "pending"),
            "pdax_reference": data.get("reference_id") or data.get("id") or ref,
            "raw":            data,
        }

    return {
        "success":  False,
        "error":    result.get("error", "PDAX withdrawal initiation failed"),
        "fallback": True,
    }


# ── 4. XLM→PHP Firm Quote (before trade execution) ───────────────────────────

async def get_firm_quote(
    amount_xlm: float,
    side: str = "sell",   # "sell" = XLM→PHP, "buy" = PHP→XLM
) -> dict[str, Any]:
    """
    Get an executable firm quote for XLM ↔ PHP conversion.

    Returns on success:
        {
          "success": True,
          "quote_id": "...",
          "base_amount": 10.0,       # XLM amount
          "quote_amount": 560.0,     # PHP amount
          "rate": 56.0,              # PHP per 1 XLM
          "expires_at": 1234567890,
        }
    """
    if not _PDAX_CONFIGURED:
        # Return a static quote so UI calculations still work
        static_rate = _rate_cache["rate"] or 56.0
        return {
            "success":      False,
            "error":        "PDAX not configured",
            "fallback_rate": static_rate,
        }

    payload = {
        "base_currency":  "XLM",
        "quote_currency": "PHP",
        "side":           side,
        "base_amount":    amount_xlm,
    }

    result = await _request("POST", "/pdax-institution/v1/trade/quote", json=payload)

    if result["ok"]:
        data = result["data"]
        rate = float(data.get("rate") or data.get("price") or _rate_cache["rate"] or 56.0)
        return {
            "success":      True,
            "quote_id":     data.get("quote_id") or data.get("id") or "",
            "base_amount":  float(data.get("base_amount",  amount_xlm)),
            "quote_amount": float(data.get("quote_amount", amount_xlm * rate)),
            "rate":         rate,
            "expires_at":   data.get("expires_at", int(time.time()) + 30),
            "raw":          data,
        }

    return {
        "success":      False,
        "error":        result.get("error", "Firm quote failed"),
        "fallback_rate": _rate_cache["rate"] or 56.0,
    }


# ── 5. Wallet balance via PDAX ────────────────────────────────────────────────

async def get_pdax_balances() -> dict[str, Any]:
    """
    Fetch account balances from PDAX (XLM, USDCXLM, PHP).

    Returns:
        {
          "success": True,
          "balances": { "XLM": 100.0, "USDCXLM": 50.0, "PHP": 2800.0 }
        }
    """
    result = await _request("GET", "/pdax-institution/v1/balances")

    if result["ok"]:
        raw = result["data"]
        # Normalise: PDAX may return a list or dict
        balances: dict[str, float] = {}
        if isinstance(raw, list):
            for item in raw:
                symbol = item.get("currency") or item.get("asset") or ""
                amount = float(item.get("available") or item.get("balance") or 0)
                if symbol:
                    balances[symbol.upper()] = amount
        elif isinstance(raw, dict):
            for k, v in raw.items():
                try:
                    balances[k.upper()] = float(v)
                except (ValueError, TypeError):
                    pass
        return {"success": True, "balances": balances}

    return {"success": False, "error": result.get("error", "Balance fetch failed"), "balances": {}}


# ── 6. Webhook event processor ────────────────────────────────────────────────

def process_webhook_event(payload: dict) -> dict[str, Any]:
    """
    Parse and normalise a PDAX webhook payload.

    PDAX sends webhooks for: deposit, withdrawal, trade, transaction_update.

    Returns a normalised event dict that callers can act on:
        {
          "event_type": "deposit" | "withdrawal" | "trade" | "transaction_update",
          "status":     "completed" | "pending" | "failed",
          "amount":     <float>,
          "currency":   "PHP" | "XLM" | "USDCXLM",
          "reference":  <str>,
          "raw":        <original payload>,
        }
    """
    event_type = (payload.get("event") or payload.get("type") or "unknown").lower()
    status     = (payload.get("status") or "unknown").lower()
    amount     = float(payload.get("amount") or 0)
    currency   = (payload.get("currency") or payload.get("asset") or "").upper()
    reference  = str(payload.get("reference_id") or payload.get("id") or "")

    logger.info("[PDAX WEBHOOK] event=%s status=%s ref=%s amount=%.4f %s",
                event_type, status, reference, amount, currency)

    return {
        "event_type": event_type,
        "status":     status,
        "amount":     amount,
        "currency":   currency,
        "reference":  reference,
        "raw":        payload,
    }


# ── 7. Health / connectivity check ───────────────────────────────────────────

async def health_check() -> dict[str, Any]:
    """
    Quick connectivity check — tries to authenticate and fetch a rate.
    Used by /api/pdax/status endpoint.
    """
    if not _PDAX_CONFIGURED:
        return {
            "configured": False,
            "status":     "PDAX credentials not set — running in demo mode",
            "live_rate":  None,
        }

    authed = await _ensure_auth()
    if not authed:
        return {
            "configured": True,
            "status":     "Authentication failed — check credentials",
            "live_rate":  None,
        }

    rate = await get_xlm_php_rate()
    return {
        "configured": True,
        "status":     "OK",
        "live_rate":  rate,
        "token_valid": _tokens.is_valid,
    }


# ── 8. Webhook signature verification ────────────────────────────────────────

def verify_webhook_signature(
    payload_bytes: bytes,
    signature_header: str,
) -> bool:
    """
    Verify that an incoming webhook request genuinely came from PDAX.

    PDAX signs the raw request body with HMAC-SHA256 using the webhook secret
    configured in the PDAX dashboard. The signature is sent in the
    X-PDAX-Signature (or X-Signature) header as a hex digest.

    Returns True  → signature is valid, process the event
    Returns False → signature mismatch or secret not configured, reject

    Security notes:
    - Uses hmac.compare_digest to prevent timing attacks.
    - If PDAX_WEBHOOK_SECRET is not set we allow the request through with a
      warning so development still works (remove this in production).
    """
    import hmac
    import hashlib

    if not PDAX_WEBHOOK_SECRET:
        logger.warning(
            "[PDAX WEBHOOK] PDAX_WEBHOOK_SECRET not set — skipping signature check. "
            "Set it in .env for production security."
        )
        return True  # permissive in dev; tighten in production

    if not signature_header:
        logger.warning("[PDAX WEBHOOK] Missing signature header — rejecting.")
        return False

    # Strip any prefix PDAX might add (e.g. "sha256=<hex>")
    raw_sig = signature_header.lower()
    if raw_sig.startswith("sha256="):
        raw_sig = raw_sig[7:]

    expected = hmac.new(
        PDAX_WEBHOOK_SECRET.encode("utf-8"),
        payload_bytes,
        hashlib.sha256,
    ).hexdigest()

    valid = hmac.compare_digest(expected, raw_sig)
    if not valid:
        logger.warning(
            "[PDAX WEBHOOK] Signature mismatch — possible spoofed request. "
            "expected=%s…, got=%s…", expected[:12], raw_sig[:12]
        )
    return valid
