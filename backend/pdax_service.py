"""
SaloMed Ã— PDAX Institutional API Service
=========================================
Handles all PDAX API interactions for SaloMed:

  - Authentication  (login, token refresh, auto-retry on 401)
  - Live PHP/XLM exchange rate  (indicative quote)
  - Fiat deposit initiation     (InstaPay on-ramp)
  - Fiat withdrawal             (InstaPay off-ramp)
  - Webhook event processing    (deposit/trade confirmations)

Design principles
-----------------
1. NEVER raises an unhandled exception â€” every public method returns a dict
   with a `success` key so callers can pattern-match without try/except.
2. Falls back gracefully: if PDAX credentials are not configured the service
   returns demo/static values so the rest of the app keeps working exactly
   as before.
3. Tokens are stored in memory (refreshed automatically) â€” no disk writes,
   no secrets in logs.
4. All HTTP calls are async (httpx.AsyncClient) to avoid blocking FastAPI.

PDAX UAT base URL:  https://uat.services.sandbox.pdax.ph/api/pdax-api
Supported assets:   XLM  (Stellar Lumens)  |  USDCXLM (USD Coin on Stellar)
Supported payment:  InstaPay
Supported banks:    BASECPH (Security Bank)  |  BACTBPH (CTBC Bank PH)
Token lifetime:     ~600 seconds (~10 minutes) â€” auto-refreshed before expiry
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
    logging.warning("[PDAX] httpx not installed â€” PDAX integration disabled. Run: pip install httpx")

logger = logging.getLogger("salomed.pdax")

# â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
# CONFIG  (read once at import time; safe â€” no secrets are logged)
# â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

PDAX_BASE_URL  = os.getenv("PDAX_BASE_URL",  "https://uat.services.sandbox.pdax.ph/api/pdax-api")
PDAX_USERNAME  = os.getenv("PDAX_USERNAME",  "")
PDAX_PASSWORD  = os.getenv("PDAX_PASSWORD",  "")
PDAX_WEBHOOK_SECRET = os.getenv("PDAX_WEBHOOK_SECRET", "")

# Credentials configured check â€” used to gate all PDAX calls
_PDAX_CONFIGURED = bool(PDAX_USERNAME and PDAX_PASSWORD
                        and "your_username_here" not in PDAX_USERNAME)

# â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
# TOKEN STORE  (in-memory, never persisted)
# â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

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

# â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
# INTERNAL HELPERS
# â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

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
            logger.warning("[PDAX] Refresh failed (%s) â€” attempting re-login.", resp.status_code)
            _tokens.clear()
            return await _login()
    except Exception as exc:
        logger.error("[PDAX] Refresh error: %s â€” attempting re-login.", exc)
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
        return {"ok": False, "error": "PDAX authentication failed â€” check PDAX_USERNAME/PDAX_PASSWORD in .env", "status": 401}

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
            # Token expired mid-flight â€” refresh and retry once
            logger.info("[PDAX] 401 received â€” refreshing token and retrying.")
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
            logger.warning("[PDAX] %s %s â†’ %s: %s", method, path, resp.status_code, msg)
            return {"ok": False, "error": msg, "status": resp.status_code}

        return {"ok": True, "data": resp.json()}

    except httpx.TimeoutException:
        return {"ok": False, "error": "PDAX API request timed out", "status": 504}
    except Exception as exc:
        logger.error("[PDAX] Request error: %s", exc)
        return {"ok": False, "error": str(exc), "status": 0}


# â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
# PUBLIC API
# â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

# â”€â”€ 1. Live PHP/XLM exchange rate â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

# Simple in-process cache so we don't hammer PDAX on every page load
_rate_cache: dict[str, Any] = {"rate": 56.0, "ts": 0.0}
_RATE_TTL = 30  # seconds before we re-fetch


async def get_xlm_php_rate(fallback_rate: float = 56.0) -> float:
    """
    Fetch live XLM â†’ PHP rate from PDAX indicative price endpoint.
    Returns the cached/fallback rate if PDAX is unavailable.

    PDAX pair: XLM/PHP  (buy = PHP you pay per 1 XLM)
    """
    now = time.time()
    if now - _rate_cache["ts"] < _RATE_TTL:
        return _rate_cache["rate"]

    if not _PDAX_CONFIGURED:
        return fallback_rate

    result = await _request(
        "GET",
        "/pdax-institution/v1/trade/price",
        params={"base_currency": "XLM", "quote_currency": "PHP"},
    )

    if result["ok"]:
        data = result["data"]
        # PDAX returns price in various shapes â€” handle both list and dict
        price = None
        if isinstance(data, dict):
            # Try common field names
            price = (data.get("ask") or data.get("price")
                     or data.get("ask_price") or data.get("rate"))
        elif isinstance(data, list) and data:
            item = data[0]
            price = (item.get("ask") or item.get("price")
                     or item.get("ask_price") or item.get("rate"))

        if price:
            try:
                rate = float(price)
                _rate_cache["rate"] = rate
                _rate_cache["ts"]   = now
                logger.info("[PDAX] Live XLM/PHP rate: %.4f", rate)
                return rate
            except (ValueError, TypeError):
                pass

    # Cache miss / parse failure â€” return stale cache or fallback
    logger.warning("[PDAX] Could not parse live rate â€” using fallback %.2f", fallback_rate)
    return _rate_cache["rate"] if _rate_cache["ts"] > 0 else fallback_rate


# â”€â”€ 2. Fiat Deposit (InstaPay on-ramp) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

async def initiate_instapay_deposit(
    amount_php: float,
    reference_id: str | None = None,
    metadata: dict | None = None,
) -> dict[str, Any]:
    """
    Initiate a real PHP fiat deposit via PDAX InstaPay.

    Returns on success:
        {
          "success": True,
          "checkout_url": "https://...",   # redirect user here to pay
          "reference_id": "...",
          "amount_php": 500.0,
          "status": "pending",
          "pdax_reference": "...",
        }

    Returns on failure (PDAX unavailable or not configured):
        {
          "success": False,
          "error": "...",
          "fallback": True,   # tells caller to use demo flow
        }
    """
    if not _PDAX_CONFIGURED:
        return {
            "success":  False,
            "error":    "PDAX not configured â€” using demo flow",
            "fallback": True,
        }

    ref = reference_id or f"SALOMED-{uuid.uuid4().hex[:12].upper()}"

    payload: dict[str, Any] = {
        "amount":       amount_php,
        "currency":     "PHP",
        "channel":      "INSTAPAY",
        "reference_id": ref,
    }
    if metadata:
        payload["metadata"] = metadata

    result = await _request("POST", "/pdax-institution/v1/fiat/deposit", json=payload)

    if result["ok"]:
        data = result["data"]
        checkout_url = (data.get("checkout_url") or data.get("payment_url")
                        or data.get("redirect_url") or data.get("url") or "")
        return {
            "success":       True,
            "checkout_url":  checkout_url,
            "reference_id":  ref,
            "amount_php":    amount_php,
            "status":        data.get("status", "pending"),
            "pdax_reference": data.get("reference_id") or data.get("id") or ref,
            "raw":           data,
        }

    # PDAX call failed â€” signal caller to fall back to demo flow
    return {
        "success":  False,
        "error":    result.get("error", "PDAX deposit initiation failed"),
        "fallback": True,
    }


# â”€â”€ 3. Fiat Withdrawal (InstaPay off-ramp) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

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
        BASECPH â€” Security Bank Corporation
        BACTBPH â€” CTBC Bank Philippines Corporation

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
            "error":    "PDAX not configured â€” withdrawal unavailable",
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


# â”€â”€ 4. XLMâ†’PHP Firm Quote (before trade execution) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

async def get_firm_quote(
    amount_xlm: float,
    side: str = "sell",   # "sell" = XLMâ†’PHP, "buy" = PHPâ†’XLM
) -> dict[str, Any]:
    """
    Get an executable firm quote for XLM â†” PHP conversion.

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


# â”€â”€ 5. Wallet balance via PDAX â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

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


# â”€â”€ 6. Webhook event processor â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

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


# â”€â”€ 7. Health / connectivity check â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

async def health_check() -> dict[str, Any]:
    """
    Quick connectivity check â€” tries to authenticate and fetch a rate.
    Used by /api/pdax/status endpoint.
    """
    if not _PDAX_CONFIGURED:
        return {
            "configured": False,
            "status":     "PDAX credentials not set â€” running in demo mode",
            "live_rate":  None,
        }

    authed = await _ensure_auth()
    if not authed:
        return {
            "configured": True,
            "status":     "Authentication failed â€” check credentials",
            "live_rate":  None,
        }

    rate = await get_xlm_php_rate()
    return {
        "configured": True,
        "status":     "OK",
        "live_rate":  rate,
        "token_valid": _tokens.is_valid,
    }


# â”€â”€ 8. Webhook signature verification â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

def verify_webhook_signature(
    payload_bytes: bytes,
    signature_header: str,
) -> bool:
    """
    Verify that an incoming webhook request genuinely came from PDAX.

    PDAX signs the raw request body with HMAC-SHA256 using the webhook secret
    configured in the PDAX dashboard. The signature is sent in the
    X-PDAX-Signature (or X-Signature) header as a hex digest.

    Returns True  â†’ signature is valid, process the event
    Returns False â†’ signature mismatch or secret not configured, reject

    Security notes:
    - Uses hmac.compare_digest to prevent timing attacks.
    - If PDAX_WEBHOOK_SECRET is not set we allow the request through with a
      warning so development still works (remove this in production).
    """
    import hmac
    import hashlib

    if not PDAX_WEBHOOK_SECRET:
        logger.warning(
            "[PDAX WEBHOOK] PDAX_WEBHOOK_SECRET not set â€” skipping signature check. "
            "Set it in .env for production security."
        )
        return True  # permissive in dev; tighten in production

    if not signature_header:
        logger.warning("[PDAX WEBHOOK] Missing signature header â€” rejecting.")
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
            "[PDAX WEBHOOK] Signature mismatch â€” possible spoofed request. "
            "expected=%sâ€¦, got=%sâ€¦", expected[:12], raw_sig[:12]
        )
    return valid
