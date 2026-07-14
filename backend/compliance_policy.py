from __future__ import annotations

from dataclasses import dataclass
from decimal import Decimal, InvalidOperation
from typing import Any

from salomed_runtime import validate_stellar_address


class PolicyError(Exception):
    def __init__(self, code: str, message: str, status_code: int = 409) -> None:
        super().__init__(message)
        self.code = code
        self.message = message
        self.status_code = status_code


@dataclass(frozen=True)
class PolicyLimits:
    single_topup_php: Decimal = Decimal("50000.00")
    single_payment_php: Decimal = Decimal("50000.00")
    single_remittance_php: Decimal = Decimal("25000.00")
    single_salo_php: Decimal = Decimal("10000.00")
    review_php: Decimal = Decimal("10000.00")
    min_salo_points_for_auto_review: int = 25
    max_pending_salo_requests: int = 2


LIMITS = PolicyLimits()


def _money(value: Any) -> Decimal:
    try:
        amount = Decimal(str(value)).quantize(Decimal("0.01"))
    except (InvalidOperation, ValueError) as exc:
        raise PolicyError("INVALID_AMOUNT", "Amount could not be reviewed", 422) from exc
    if amount <= 0:
        raise PolicyError("INVALID_AMOUNT", "Amount must be positive", 422)
    return amount


def wallet_review(address: str) -> dict[str, Any]:
    """
    Demo KYC/AML stance for the MVP. This is intentionally not a real identity
    verification result; it gives the product a production-shaped review object
    without blocking testnet/simulated flows.
    """
    normalized = validate_stellar_address(address)
    return {
        "address": normalized,
        "kyc_status": "demo_verified",
        "aml_status": "clear",
        "sanctions_screen": "not_matched",
        "real_money_enabled": False,
        "review_mode": "simulated_controls",
        "note": "Demo review only. Production requires provider KYC, sanctions screening, and AML monitoring.",
    }


def transaction_review(
    *,
    kind: str,
    address: str,
    amount_php: Any,
    counterparty: str | None = None,
    source: str | None = None,
    pending_salo_requests: int = 0,
) -> dict[str, Any]:
    normalized = validate_stellar_address(address)
    php = _money(amount_php)
    reason_codes: list[str] = []
    checks = wallet_review(normalized)

    max_php = {
        "topup": LIMITS.single_topup_php,
        "payment": LIMITS.single_payment_php,
        "remittance": LIMITS.single_remittance_php,
        "salo": LIMITS.single_salo_php,
    }.get(kind, LIMITS.single_payment_php)

    if php > max_php:
        reason_codes.append("AMOUNT_ABOVE_MVP_LIMIT")
    if php >= LIMITS.review_php:
        reason_codes.append("MANUAL_REVIEW_AMOUNT")
    if pending_salo_requests >= LIMITS.max_pending_salo_requests:
        reason_codes.append("PENDING_SALO_LIMIT")
    if kind == "topup" and source not in {None, "gcash", "instapay", "freighter"}:
        reason_codes.append("UNKNOWN_TOPUP_SOURCE")
    if counterparty and counterparty == normalized:
        reason_codes.append("SELF_TRANSFER")

    hard_block = any(code in reason_codes for code in {
        "AMOUNT_ABOVE_MVP_LIMIT",
        "PENDING_SALO_LIMIT",
        "SELF_TRANSFER",
    })
    decision = "reject" if hard_block else ("manual_review" if reason_codes else "approve")

    return {
        **checks,
        "kind": kind,
        "amount_php": f"{php:.2f}",
        "counterparty": counterparty,
        "decision": decision,
        "fraud_status": "review" if reason_codes else "clear",
        "reason_codes": reason_codes,
        "checks": {
            "kyc": checks["kyc_status"],
            "aml": checks["aml_status"],
            "amount_limit": "blocked" if "AMOUNT_ABOVE_MVP_LIMIT" in reason_codes else "passed",
            "velocity": "demo_tracked",
            "idempotency": "required",
        },
    }


def salo_underwriting_review(
    *,
    address: str,
    amount_php: Any,
    salo_points: int,
    pending_requests: int,
    term_months: int,
) -> dict[str, Any]:
    base = transaction_review(
        kind="salo",
        address=address,
        amount_php=amount_php,
        pending_salo_requests=pending_requests,
    )
    reason_codes = list(base["reason_codes"])
    if salo_points < LIMITS.min_salo_points_for_auto_review:
        reason_codes.append("LIMITED_PAYMENT_HISTORY")
    if term_months not in {3, 6, 12}:
        reason_codes.append("UNSUPPORTED_TERM")

    hard_block = any(code in reason_codes for code in {
        "AMOUNT_ABOVE_MVP_LIMIT",
        "PENDING_SALO_LIMIT",
        "UNSUPPORTED_TERM",
    })
    decision = "reject" if hard_block else "salomed_review"

    return {
        **base,
        "decision": decision,
        "fraud_status": "review" if reason_codes else "clear",
        "reason_codes": reason_codes,
        "salo_points": salo_points,
        "pending_requests": pending_requests,
        "term_months": term_months,
        "underwriting": {
            "payment_history": "established" if salo_points >= LIMITS.min_salo_points_for_auto_review else "limited",
            "open_request_limit": "passed" if pending_requests < LIMITS.max_pending_salo_requests else "blocked",
            "affordability": "salomed_review_required",
            "release_status": "not_enabled_for_real_funds",
        },
    }
