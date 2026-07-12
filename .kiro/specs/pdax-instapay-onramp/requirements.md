# Requirements: PDAX InstaPay Fiat On-Ramp

## Introduction

Activate a real, working PDAX Institutional API integration so a user can fund
their SaloMed vault with Philippine Pesos via InstaPay, and have that fiat
payment bridge into on-chain USDC in their Stellar vault. This makes SaloMed's
"PHP in, purpose-locked USDC on-chain" story genuinely end to end.

All PDAX behavior below was verified live against the PDAX UAT sandbox with the
project's real credentials:
- Auth (login + refresh): working.
- Account balances (`/balances`): working, returns PHP/USDC/XLM.
- InstaPay deposit (`/fiat/deposit`): working, returns a real `payment_checkout_url`,
  `reference_number`, `request_id`, and `status: PENDING`.
- Deposit status lookup (`/fiat/transactions?identifier=...`): working, returns
  the transaction with current status. Enables polling (no public webhook needed
  for the demo).
- Live conversion rate: WORKING via
  `GET /trade/price?base_currency=PHP&quote_currency=USDC&base_quantity=<php>&side=buy`.
  Returns `price` (PHP per 1 USDC, e.g. 62.255) and `total_amount` (exact USDC
  the user receives). PHP->XLM works the same way (price ~7.526). The earlier
  failure was only the USDC-base direction; the PHP-base direction quotes fine.
  The sandbox balances (PHP 100k / USDC 10k / XLM 10k) are the institutional
  account's holdings, NOT a 1:1 conversion.

## Requirements

### Requirement 0: Live PDAX conversion rate (not 1:1, not hardcoded)

**User Story:** As a user, I want the PHP-to-USDC conversion to use PDAX's real
live rate, so the amount credited to my vault reflects the actual market, and I
can see that a live rate is being used.

#### Acceptance Criteria

1. WHEN the app computes how much USDC a PHP amount buys THEN it SHALL use the
   live PDAX price from `GET /trade/price` (base_currency=PHP, quote_currency=USDC,
   side=buy), NOT a hardcoded 56 and NOT a 1:1 assumption.
2. WHEN PDAX returns a price THEN the backend SHALL expose it to the frontend
   (rate + source) so conversions everywhere use the same live value.
3. WHEN the vault / top-up UI shows a converted amount THEN it SHALL display a
   clear indicator that the conversion uses a live PDAX rate (e.g. a "Live PDAX
   rate" badge), with the rate value visible.
4. WHEN PDAX rate lookup fails THEN the app SHALL fall back to the configured
   indicative rate and the indicator SHALL truthfully change to "Indicative
   rate", never falsely claim "live".
5. THE displayed converted amounts SHALL follow the 2-decimal formatting rule.

### Requirement 1: Live PDAX connectivity is visible in the app

**User Story:** As a judge or user, I want to see that SaloMed is genuinely
connected to PDAX, so that the integration is credible, not simulated.

#### Acceptance Criteria

1. WHEN the app loads the top-up area THEN it SHALL show a real PDAX connection
   status derived from an authenticated PDAX call.
2. WHEN PDAX auth succeeds THEN the UI SHALL indicate "Connected".
3. WHEN PDAX is unreachable or unauthenticated THEN the UI SHALL show a truthful
   degraded state, not a fake "connected".

### Requirement 2: Real InstaPay deposit initiation

**User Story:** As a user, I want to top up my vault with pesos through InstaPay,
so that I can fund my health savings without buying crypto myself.

#### Acceptance Criteria

1. WHEN a user enters a PHP amount and submits an InstaPay top-up THEN the backend
   SHALL call the real PDAX `/fiat/deposit` endpoint with the verified payload
   shape and method `instapay_upay_cashin`.
2. WHEN PDAX returns a deposit THEN the app SHALL present the real
   `payment_checkout_url` so the user can complete payment on PDAX/UPAY.
3. WHEN the deposit is created THEN the app SHALL retain the PDAX `identifier`
   and `reference_number` to track it.
4. WHEN the amount is outside PDAX limits THEN the app SHALL surface PDAX's real
   validation error, not a generic message.

### Requirement 3: Payment confirmation bridges to on-chain USDC

**User Story:** As a user, once my pesos are received, I want my vault credited
with USDC on-chain, so that my health fund is real and verifiable on Stellar.

#### Acceptance Criteria

1. WHEN a deposit's PDAX status becomes completed THEN the backend SHALL credit
   the user's Stellar vault by invoking the SaloMed contract's
   `deposit_remittance` with the admin as source, moving USDC into the
   beneficiary's vault.
2. WHEN running locally (no public webhook) THEN the app SHALL determine
   completion by polling `/fiat/transactions?identifier=...`.
3. WHEN deployed with a public URL THEN the PDAX webhook MAY also trigger the
   same crediting path, with HMAC signature verification.
4. WHEN a deposit is credited on-chain THEN the resulting Stellar transaction
   SHALL be verifiable on Stellar Explorer, consistent with the app's
   transparency model.
5. WHEN a deposit has already been credited THEN re-processing the same
   `identifier` SHALL NOT double-credit the vault (idempotency).

### Requirement 4: Do not break the existing Stellar-testnet experience

**User Story:** As the operator, I want PDAX enabled without disabling the
working on-chain flow, so both function together.

#### Acceptance Criteria

1. WHEN PDAX on-ramp is enabled THEN the existing Freighter USDC deposit,
   payment, and padala flows SHALL continue to work unchanged.
2. WHEN PDAX credentials are absent THEN the app SHALL degrade gracefully and the
   rest of the app SHALL keep working.
3. THE PDAX secret credentials SHALL only ever live in environment variables,
   never committed to the repo.

## Out of Scope

- Fiat withdrawal / off-ramp (contradicts the purpose-bound lock; deposits only).
- Live PDAX trade execution for rate quoting (sandbox pair currently unavailable;
  use indicative rate).
- Real (mainnet) money movement.

## Security & Brand Constraints

- Blue/white dominant UI; green only for success, amber for warnings.
- No em dashes in user-facing copy.
- Treat PDAX responses as untrusted input; validate before acting.
- Never log secrets or full tokens.
