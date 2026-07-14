from __future__ import annotations

import base64
import hashlib
import hmac
import json
import os
import time
from decimal import Decimal

from fastapi import APIRouter, Depends, Header, HTTPException, Query
from pydantic import BaseModel, Field

from compliance_policy import PolicyError, salo_underwriting_review, transaction_review, wallet_review
from salomed_runtime import DemoLedger, LedgerError, PostgresLedger, RuntimeMode, RuntimeSettings


class TopUpRequest(BaseModel):
    beneficiary_address: str
    amount_php: Decimal = Field(gt=0, max_digits=12, decimal_places=2)
    idempotency_key: str = Field(min_length=8, max_length=128)
    # Top-up method label: gcash | instapay | freighter. Unknown values are
    # coerced to None so a bad label can never block a real credit.
    source: str | None = Field(default=None, max_length=16)


class PaymentRequest(BaseModel):
    patient_address: str
    provider_id: str = Field(min_length=1, max_length=128)
    amount_asset: Decimal = Field(gt=0, max_digits=18, decimal_places=7)
    idempotency_key: str = Field(min_length=8, max_length=128)


class RemittanceRequest(BaseModel):
    sender_address: str
    beneficiary_address: str
    amount_asset: Decimal = Field(gt=0, max_digits=18, decimal_places=7)
    idempotency_key: str = Field(min_length=8, max_length=128)


class EnsureFeesRequest(BaseModel):
    address: str = Field(min_length=56, max_length=56)


class HistoryRecordRequest(BaseModel):
    address: str = Field(min_length=56, max_length=56)
    type: str = Field(min_length=1, max_length=32)
    amount_asset: Decimal = Field(ge=0, max_digits=20, decimal_places=7)
    amount_php: Decimal = Field(ge=0, max_digits=20, decimal_places=2)
    direction: str | None = Field(default=None, max_length=16)
    counterparty: str | None = Field(default=None, max_length=128)
    tx_hash: str | None = Field(default=None, max_length=128)
    status: str = Field(default="success", max_length=16)
    source: str | None = Field(default=None, max_length=16)


class ProviderPaymentRecordRequest(BaseModel):
    patient_address: str = Field(min_length=56, max_length=56)
    provider_address: str = Field(min_length=56, max_length=56)
    provider_name: str = Field(min_length=1, max_length=128)
    provider_type: str = Field(min_length=1, max_length=32)
    amount_asset: Decimal = Field(ge=0, max_digits=20, decimal_places=7)
    amount_php: Decimal = Field(ge=0, max_digits=20, decimal_places=2)
    tx_hash: str | None = Field(default=None, max_length=128)
    status: str = Field(default="success", max_length=16)


class SaloUnderwriteRequest(BaseModel):
    address: str = Field(min_length=56, max_length=56)
    amount_php: Decimal = Field(gt=0, max_digits=12, decimal_places=2)
    salo_points: int = Field(default=0, ge=0)
    pending_requests: int = Field(default=0, ge=0, le=10)
    term_months: int = Field(default=6, ge=1, le=36)


class SaloRequestRecordRequest(BaseModel):
    patient_address: str = Field(min_length=56, max_length=56)
    amount_asset: Decimal = Field(gt=0, max_digits=20, decimal_places=7)
    amount_php: Decimal = Field(gt=0, max_digits=20, decimal_places=2)
    term_months: int = Field(ge=1, le=36)
    monthly_php: Decimal = Field(ge=0, max_digits=20, decimal_places=2)
    interest_rate: Decimal = Field(ge=0, max_digits=5, decimal_places=2)
    salo_points: int = Field(default=0, ge=0)
    credit_tier: str = Field(min_length=1, max_length=16)
    pending_requests: int = Field(default=0, ge=0, le=10)


class SaloRequestDecisionRequest(BaseModel):
    status: str = Field(min_length=1, max_length=16)
    reviewer: str = Field(default="SaloMed Admin", max_length=64)


class SaloTermsAcceptRequest(BaseModel):
    patient_address: str = Field(min_length=56, max_length=56)


class SaloReleaseRequest(BaseModel):
    reviewer: str = Field(default="SaloMed Admin", max_length=64)


class AdminLoginRequest(BaseModel):
    username: str = Field(min_length=1, max_length=64)
    password: str = Field(min_length=1, max_length=128)


# Allowed top-up method labels. Anything else is stored as NULL (generic top-up).
_ALLOWED_TOPUP_SOURCES = {"gcash", "instapay", "freighter"}


def _normalize_topup_source(value: str | None) -> str | None:
    """Coerce a top-up method label to the allow-list, else None."""
    if not value:
        return None
    normalized = value.strip().lower()
    return normalized if normalized in _ALLOWED_TOPUP_SOURCES else None


def _ledger_call(function, *args):
    try:
        return function(*args)
    except LedgerError as exc:
        raise HTTPException(
            status_code=exc.status_code,
            detail={"error": exc.code, "message": exc.message},
        ) from exc


def _policy_call(function, *args, **kwargs):
    try:
        review = function(*args, **kwargs)
    except PolicyError as exc:
        raise HTTPException(
            status_code=exc.status_code,
            detail={"error": exc.code, "message": exc.message},
        ) from exc
    if review.get("decision") == "reject":
        raise HTTPException(
            status_code=409,
            detail={
                "error": "POLICY_REVIEW_BLOCKED",
                "message": "This request needs manual review before it can continue.",
                "review": review,
            },
        )
    return review


def _admin_username() -> str:
    return os.getenv("SALOMED_ADMIN_USERNAME", "salomed_admin").strip().lower()


def _admin_password() -> str:
    return os.getenv("SALOMED_ADMIN_PASSWORD", "salomed_admin_123")


def _admin_secret() -> bytes:
    return os.getenv("SALOMED_ADMIN_SESSION_SECRET", _admin_password()).encode("utf-8")


def _b64_json(payload: dict) -> str:
    raw = json.dumps(payload, separators=(",", ":")).encode("utf-8")
    return base64.urlsafe_b64encode(raw).decode("ascii").rstrip("=")


def _load_b64_json(value: str) -> dict:
    padded = value + "=" * (-len(value) % 4)
    return json.loads(base64.urlsafe_b64decode(padded.encode("ascii")))


def _admin_token(username: str) -> str:
    body = _b64_json({"sub": username, "exp": int(time.time()) + 60 * 60 * 12})
    signature = hmac.new(_admin_secret(), body.encode("ascii"), hashlib.sha256).hexdigest()
    return f"{body}.{signature}"


def _require_admin(authorization: str | None = Header(default=None)) -> dict:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail={"error": "ADMIN_AUTH_REQUIRED"})
    token = authorization.removeprefix("Bearer ").strip()
    try:
        body, signature = token.split(".", 1)
        expected = hmac.new(_admin_secret(), body.encode("ascii"), hashlib.sha256).hexdigest()
        if not hmac.compare_digest(signature, expected):
            raise ValueError("bad signature")
        payload = _load_b64_json(body)
        if payload.get("sub") != _admin_username() or int(payload.get("exp", 0)) < int(time.time()):
            raise ValueError("expired or wrong subject")
        return payload
    except Exception as exc:
        raise HTTPException(status_code=401, detail={"error": "ADMIN_AUTH_INVALID"}) from exc


def create_runtime_router(settings: RuntimeSettings, demo_ledger: "DemoLedger | PostgresLedger") -> APIRouter:
    router = APIRouter()

    @router.post("/api/v2/ensure-fees", tags=["Runtime"])
    async def ensure_fees(body: EnsureFeesRequest):
        """
        Ensure a user's wallet can pay transaction fees for payment/padala.
        In Stellar modes this creates/tops-up the account with a little XLM from
        the admin. In demo mode it is a no-op (no on-chain fees).
        """
        if settings.mode is RuntimeMode.DEMO:
            return {"funded": True, "mode": "demo", "note": "no on-chain fees in demo mode"}
        import stellar_bridge
        result = stellar_bridge.ensure_fee_funds(body.address)
        return {"mode": settings.mode.value, **result}

    @router.get("/api/runtime", tags=["Runtime"])
    async def runtime_status():
        simulated = settings.mode is RuntimeMode.DEMO
        stellar_tracking_enabled = not simulated
        return {
            "mode": settings.mode.value,
            "asset_code": settings.asset_code,
            "contract_id": settings.contract_id,
            "network": settings.network,
            "expected_token_id": settings.expected_token_id,
            "admin_address": settings.admin_address,
            "php_per_asset": f"{settings.php_per_asset_decimal:.2f}",
            "simulated": simulated,
            "real_money_enabled": False,
            "history_source": "demo_ledger" if simulated else "soroban_contract_events",
            "stellar_tracking_enabled": stellar_tracking_enabled,
        }

    @router.get("/api/v2/compliance/{address}", tags=["Runtime"])
    async def compliance_status(address: str):
        return _policy_call(wallet_review, address)

    @router.post("/api/v2/salo/underwrite", tags=["Runtime"])
    async def salo_underwrite(body: SaloUnderwriteRequest):
        return _policy_call(
            salo_underwriting_review,
            address=body.address,
            amount_php=body.amount_php,
            salo_points=body.salo_points,
            pending_requests=body.pending_requests,
            term_months=body.term_months,
        )

    @router.post("/api/v2/admin/login", tags=["Runtime"])
    async def admin_login(body: AdminLoginRequest):
        username = body.username.strip().lower()
        if username != _admin_username() or not hmac.compare_digest(body.password, _admin_password()):
            raise HTTPException(status_code=401, detail={"error": "INVALID_ADMIN_CREDENTIALS"})
        return {"token": _admin_token(username), "username": username}

    @router.post("/api/v2/salo/requests", tags=["Runtime"])
    async def record_salo_request(body: SaloRequestRecordRequest):
        review = _policy_call(
            salo_underwriting_review,
            address=body.patient_address,
            amount_php=body.amount_php,
            salo_points=body.salo_points,
            pending_requests=body.pending_requests,
            term_months=body.term_months,
        )
        import salo_request_store
        row = salo_request_store.record(
            patient_address=body.patient_address,
            amount_asset=float(body.amount_asset),
            amount_php=float(body.amount_php),
            term_months=body.term_months,
            monthly_php=float(body.monthly_php),
            interest_rate=float(body.interest_rate),
            salo_points=body.salo_points,
            credit_tier=body.credit_tier,
            review_decision=review.get("decision", "salomed_review"),
            reason_codes=list(review.get("reason_codes") or []),
        )
        return {"recorded": True, "request": row, "review": review}

    @router.get("/api/v2/salo/requests", tags=["Runtime"])
    async def salo_requests(
        _admin: dict = Depends(_require_admin),
        status: str = Query("all", max_length=16),
        limit: int = Query(100, ge=1, le=200),
    ):
        import salo_request_store
        return {"requests": salo_request_store.list_requests(status, limit)}

    @router.get("/api/v2/salo/requests/patient/{patient_address}", tags=["Runtime"])
    async def patient_salo_requests(patient_address: str, limit: int = Query(20, ge=1, le=50)):
        import salo_request_store
        return {"requests": salo_request_store.requests_for_patient(patient_address, limit)}

    @router.post("/api/v2/salo/requests/{request_id}/decision", tags=["Runtime"])
    async def decide_salo_request(
        request_id: str,
        body: SaloRequestDecisionRequest,
        _admin: dict = Depends(_require_admin),
    ):
        import salo_request_store
        try:
            row = salo_request_store.decide(request_id, body.status, body.reviewer)
        except ValueError as exc:
            raise HTTPException(
                status_code=422,
                detail={"error": "INVALID_SALO_STATUS", "message": str(exc)},
            ) from exc
        if not row:
            raise HTTPException(
                status_code=404,
                detail={"error": "SALO_REQUEST_NOT_FOUND", "message": "Salo request not found"},
            )
        return {"updated": True, "request": row}

    @router.post("/api/v2/salo/requests/{request_id}/accept-terms", tags=["Runtime"])
    async def accept_salo_terms(request_id: str, body: SaloTermsAcceptRequest):
        import salo_request_store
        try:
            row = salo_request_store.accept_terms(request_id, body.patient_address)
        except ValueError as exc:
            raise HTTPException(
                status_code=409,
                detail={"error": "SALO_TERMS_NOT_READY", "message": str(exc)},
            ) from exc
        if not row:
            raise HTTPException(
                status_code=404,
                detail={"error": "SALO_REQUEST_NOT_FOUND", "message": "Salo request not found"},
            )
        return {"updated": True, "request": row}

    @router.post("/api/v2/salo/requests/{request_id}/release", tags=["Runtime"])
    async def release_salo_request(
        request_id: str,
        body: SaloReleaseRequest,
        _admin: dict = Depends(_require_admin),
    ):
        import salo_request_store
        try:
            row = salo_request_store.release(request_id, body.reviewer)
        except ValueError as exc:
            raise HTTPException(
                status_code=409,
                detail={"error": "SALO_RELEASE_NOT_READY", "message": str(exc)},
            ) from exc
        if not row:
            raise HTTPException(
                status_code=404,
                detail={"error": "SALO_REQUEST_NOT_FOUND", "message": "Salo request not found"},
            )
        return {"updated": True, "request": row}

    @router.get("/api/v2/providers", tags=["Runtime"])
    async def providers():
        if settings.mode is not RuntimeMode.DEMO:
            return {"providers": [], "source": "contract_configuration"}
        return {"providers": demo_ledger.list_providers(), "source": "demo_ledger"}

    @router.get("/api/v2/vaults/{address}", tags=["Vault v2"])
    async def vault(address: str):
        if settings.mode is not RuntimeMode.DEMO:
            raise HTTPException(
                status_code=501,
                detail={
                    "error": "USE_STELLAR_CONTRACT",
                    "message": "Non-demo vault state must be read from the configured Soroban contract",
                },
            )
        return _ledger_call(demo_ledger.get_vault, address)

    @router.get("/api/v2/vaults/{address}/transactions", tags=["Vault v2"])
    async def transactions(address: str, limit: int = Query(50, ge=1, le=100)):
        # Address-keyed history follows the wallet across devices. In demo mode
        # this is the durable demo ledger; in Stellar modes it is the backend
        # history index (a read-cache of on-chain activity; each row keeps its
        # real tx hash for Explorer verification).
        if settings.mode is RuntimeMode.DEMO:
            return {"transactions": _ledger_call(demo_ledger.history, address, limit)}
        import history_store
        return {"transactions": history_store.history(address, limit), "source": "backend_index"}

    @router.post("/api/v2/history/record", tags=["Vault v2"])
    async def record_history(body: HistoryRecordRequest):
        """Record a transaction against a Stellar address so it follows the wallet."""
        import history_store
        row = history_store.record(
            address=body.address,
            tx_type=body.type,
            amount_asset=float(body.amount_asset),
            amount_php=float(body.amount_php),
            direction=body.direction,
            counterparty=body.counterparty,
            tx_hash=body.tx_hash,
            status=body.status,
            source=body.source,
        )
        return {"recorded": True, "id": row["id"]}

    @router.post("/api/v2/provider-payments/record", tags=["Vault v2"])
    async def record_provider_payment(body: ProviderPaymentRecordRequest):
        """Record a provider-keyed payment so provider portals work across users."""
        import provider_payment_store
        row = provider_payment_store.record(
            patient_address=body.patient_address,
            provider_address=body.provider_address,
            provider_name=body.provider_name,
            provider_type=body.provider_type,
            amount_asset=float(body.amount_asset),
            amount_php=float(body.amount_php),
            tx_hash=body.tx_hash,
            status=body.status,
        )
        return {"recorded": True, "payment": row}

    @router.get("/api/v2/providers/{provider_address}/transactions", tags=["Runtime"])
    async def provider_transactions(provider_address: str, limit: int = Query(100, ge=1, le=200)):
        import provider_payment_store
        return {
            "provider_address": provider_address.strip().upper(),
            "transactions": provider_payment_store.payments_for_provider(provider_address, limit),
        }

    @router.post("/api/v2/topups", tags=["Vault v2"])
    async def topup(body: TopUpRequest):
        # Stellar modes: fund the vault on-chain via the admin bridge, so the
        # user does not need to pre-hold the asset or a trustline (admin is the
        # on-ramp float). This is the fiat on-ramp credit path used by GCash /
        # InstaPay / Freighter top-ups. The method label is recorded on the row.
        method = _normalize_topup_source(body.source)
        review = _policy_call(
            transaction_review,
            kind="topup",
            address=body.beneficiary_address,
            amount_php=body.amount_php,
            source=method,
        )
        if settings.mode is not RuntimeMode.DEMO:
            import stellar_bridge
            import pdax_service as pdax

            if not stellar_bridge.is_bridge_configured():
                raise HTTPException(
                    status_code=503,
                    detail={"error": "BRIDGE_NOT_CONFIGURED",
                            "message": "On-chain on-ramp requires SALOMED_SIGNER_SECRET + CONTRACT_ID."},
                )
            # Strict live rate (Req 10.3): the credited amount MUST come from a
            # live executable/market quote. No fixed/indicative fallback is
            # allowed to settle a real credit; when the live rate is unavailable
            # we reject the top-up and leave the vault unchanged.
            quote = await pdax.get_php_to_asset_quote(
                float(body.amount_php),
                settings.asset_code,
                fallback_rate=float(settings.php_per_asset_decimal),
            )
            asset_amount = float(quote.get("asset_amount") or 0)
            if quote.get("source") not in {"pdax_live", "coingecko_live"} or asset_amount <= 0:
                raise HTTPException(
                    status_code=503,
                    detail={"error": "RATE_UNAVAILABLE",
                            "message": "Live PHP/XLM rate unavailable; top-up cannot be completed."},
                )
            try:
                tx_hash = stellar_bridge.credit_vault_usdc(body.beneficiary_address, asset_amount)
            except stellar_bridge.BridgeError as exc:
                raise HTTPException(status_code=502,
                                    detail={"error": "ONCHAIN_CREDIT_FAILED", "message": str(exc)}) from exc
            import history_store
            history_store.record(
                address=body.beneficiary_address, tx_type="topup",
                amount_asset=asset_amount, amount_php=float(body.amount_php),
                direction="received", tx_hash=tx_hash, source=method,
            )
            return {
                "success": True,
                "mode": settings.mode.value,
                "simulated": False,
                "transaction_id": tx_hash,
                "status": "completed",
                "beneficiary_address": body.beneficiary_address,
                "amount_php": f"{body.amount_php:.2f}",
                "amount_asset": f"{asset_amount:.7f}",
                "asset_code": settings.asset_code,
                "source": method,
                "review": review,
            }
        response = _ledger_call(
            demo_ledger.topup,
            body.beneficiary_address,
            body.amount_php,
            body.idempotency_key,
            method,
        )
        response["review"] = review
        return response

    @router.post("/api/v2/payments", tags=["Vault v2"])
    async def payment(body: PaymentRequest):
        amount_php = body.amount_asset * settings.php_per_asset_decimal
        review = _policy_call(
            transaction_review,
            kind="payment",
            address=body.patient_address,
            amount_php=amount_php,
            counterparty=body.provider_id,
        )
        if settings.mode is not RuntimeMode.DEMO:
            raise HTTPException(
                status_code=409,
                detail={
                    "error": "WRONG_RUNTIME_MODE",
                    "message": "Use a patient-signed Soroban payment in Stellar mode",
                },
            )
        response = _ledger_call(
            demo_ledger.payment,
            body.patient_address,
            body.provider_id,
            body.amount_asset,
            body.idempotency_key,
        )
        try:
            import provider_payment_store
            provider_payment_store.record(
                patient_address=body.patient_address,
                provider_address=body.provider_id,
                provider_name=response.get("provider_name") or "Whitelisted provider",
                provider_type=response.get("provider_type") or "provider",
                amount_asset=float(body.amount_asset),
                amount_php=float(amount_php),
                tx_hash=response.get("transaction_id"),
                status=response.get("status", "success"),
            )
        except Exception:
            pass
        response["review"] = review
        return response

    @router.post("/api/v2/remittances", tags=["Vault v2"])
    async def remittance(body: RemittanceRequest):
        amount_php = body.amount_asset * settings.php_per_asset_decimal
        review = _policy_call(
            transaction_review,
            kind="remittance",
            address=body.sender_address,
            amount_php=amount_php,
            counterparty=body.beneficiary_address,
        )
        if settings.mode is not RuntimeMode.DEMO:
            raise HTTPException(
                status_code=409,
                detail={
                    "error": "WRONG_RUNTIME_MODE",
                    "message": "Use a sender-signed Soroban deposit_remittance in Stellar mode",
                },
            )
        response = _ledger_call(
            demo_ledger.remittance,
            body.sender_address,
            body.beneficiary_address,
            body.amount_asset,
            body.idempotency_key,
        )
        response["review"] = review
        return response

    return router
