# Design: PDAX InstaPay Fiat On-Ramp

## Overview

Add a real PHP -> USDC on-ramp using the PDAX Institutional API, bridging a
confirmed InstaPay payment into on-chain USDC in the user's Stellar vault. All
PDAX endpoint shapes below are verified live against the UAT sandbox.

Flow:

```
User enters PHP amount
   -> backend gets LIVE PDAX rate (PHP->USDC)          [Req 0]
   -> user confirms, backend creates PDAX InstaPay deposit
   -> app shows real PDAX payment_checkout_url          [Req 2]
   -> user pays on PDAX/UPAY page
   -> backend polls /fiat/transactions?identifier=...   [Req 3.2]
      (or webhook in prod)                              [Req 3.3]
   -> on "completed": admin-signs deposit_remittance,
      crediting USDC into the user's Stellar vault      [Req 3.1]
   -> vault balance updates; tx verifiable on Explorer  [Req 3.4]
```

## Verified PDAX contract (UAT)

- Auth: `POST /pdax-institution/v1/login` {username,password} -> tokens.
- Balances: `GET /pdax-institution/v1/balances` -> {data:[{currency,available,...}]}.
- Live rate: `GET /pdax-institution/v1/trade/price`
  `?base_currency=PHP&quote_currency=USDC&base_quantity=<php>&side=buy`
  -> `{data:{price, total_amount}}`. `price` = PHP per 1 USDC (~62.26),
  `total_amount` = USDC received for that PHP. PHP->XLM works identically.
- Deposit: `POST /pdax-institution/v1/fiat/deposit` with fields:
  `amount, currency=PHP, identifier, method=instapay_upay_cashin,
  sender_first_name, sender_middle_name, sender_last_name, sender_email,
  sender_country_origin='Philippines', source_of_funds='Compensation',
  beneficiary_first_name, beneficiary_middle_name, beneficiary_last_name,
  purpose='Family Support', relationship_of_sender_to_beneficiary`
  -> `{request_id, identifier, reference_number, payment_checkout_url, status:'PENDING'}`.
  (No `channel`/`sender_mobile` fields; they are rejected.)
- Status: `GET /pdax-institution/v1/fiat/transactions?identifier=<id>`
  -> `{data:[{request_id, transaction_id, amount, method, status, reference_number,...}]}`.

## Architecture / Components

### Backend

`pdax_service.py` (fix + extend)
- `get_php_to_asset_quote(amount_php, asset='USDC')` -> uses the verified
  PHP-base price call; returns `{rate, asset_amount, source:'pdax_live'}` or a
  fallback `{rate:56, source:'indicative'}` on failure.
- `initiate_instapay_deposit(...)` -> rewrite payload to the verified shape,
  return `{checkout_url, identifier, reference_number, status}`.
- `get_deposit_status(identifier)` -> calls `/fiat/transactions`, returns
  normalized `{status, amount, reference_number}`.
- Keep balances + webhook verification as-is.

`stellar_bridge.py` (NEW)
- Python-native admin-signed Soroban invoke (works on Render; no CLI needed).
  Uses `SorobanServer`, builds `deposit_remittance(admin, beneficiary, amount)`,
  signs with `SALOMED_SIGNER_SECRET`, submits, waits for success, returns txHash.
- Network-agnostic: reads `RPC_URL` + `NETWORK_PASSPHRASE`, so it works on
  testnet or mainnet purely by env (satisfies "must work testnet or mainnet").

`pdax_api.py` (rewrite the router)
- Gating changes so PDAX works ALONGSIDE stellar_testnet / stellar_mainnet, not
  only in the old pdax_uat mode. New rule: PDAX endpoints are enabled whenever
  PDAX credentials are configured AND the mode is a Stellar mode or a PDAX mode.
- Endpoints:
  - `GET /api/pdax/status` -> live connectivity + balances (authed call).
  - `GET /api/pdax/quote?amount_php=&asset=` -> live rate + converted amount.
  - `POST /api/pdax/deposit` -> create InstaPay deposit, return checkout_url.
  - `POST /api/pdax/confirm` -> poll status; if completed and not yet credited,
    call the stellar bridge to credit USDC on-chain; idempotent per identifier.
  - `POST /api/pdax/webhook` -> verify HMAC, then same credit path.

Idempotency: a small persisted set of credited `identifier`s (reuse the demo DB
`operations` table or a dedicated `pdax_credits` table) so a deposit is credited
at most once, whether via poll or webhook.

### Frontend

`lib/api.ts`
- `pdaxStatus()`, `pdaxQuote(amountPhp)`, `pdaxInitiateDeposit(...)`,
  `pdaxConfirm(identifier)` typed wrappers.

`components/InstaPayTopUpModal.tsx` (rewrite to the real flow)
- Step 1: enter PHP amount; show live conversion "You receive X USDC" with a
  "Live PDAX rate" badge (rate value shown). Falls back to "Indicative rate".
- Step 2: submit -> call `/api/pdax/deposit` -> show real checkout link (open in
  new tab) + reference number.
- Step 3: "I've paid" -> poll `/api/pdax/confirm` until completed -> show the
  on-chain USDC credit + Stellar Explorer link -> refresh vault.

`components/VaultCard.tsx`
- The PHP display and top-up use the live PDAX rate from `/api/pdax/quote` (or
  `/api/pdax/status`), and show the "Live PDAX rate" badge (Req 0.3). If PDAX is
  down, badge switches to "Indicative rate".

## Rate wiring (Req 0)

- Replace the hardcoded 56 / `fixed_demo` path: the rate source becomes the live
  PDAX PHP->USDC price when PDAX is reachable.
- Backend exposes rate + source; frontend renders the badge from `source`.
- All converted amounts use the shared 2-decimal `fmtAsset` / `fmtPhp` helpers.

## Testnet / Mainnet support (explicit requirement)

- The stellar bridge and the frontend explorer links are network-driven by env
  (`STELLAR_NETWORK`, `NETWORK_PASSPHRASE`, `RPC_URL`, explorer kind). Switching
  from testnet to mainnet is configuration only; no code change. PDAX itself is
  environment-driven via `PDAX_BASE_URL` (UAT vs prod).

## Error Handling

- Every PDAX call returns a normalized dict; router maps failures to truthful
  HTTP errors, never a fake success.
- On-chain credit failure after a confirmed PDAX payment SHALL be surfaced
  clearly and remain retriable (idempotent), so funds are never silently lost.
- PDAX responses treated as untrusted; amounts validated before on-chain use.

## Security

- Secrets only in env (`backend/.env` is gitignored and untracked; verified).
- Webhook HMAC-SHA256 verified; reject on mismatch when secret is set.
- Admin signer secret used only server-side for the credit bridge.
- No secrets or full tokens in logs.

## Testing Strategy

- Backend unit tests with PDAX calls mocked: quote math, deposit payload shape,
  status normalization, idempotent credit.
- A gated live smoke script (manual, uses real UAT creds) to reconfirm endpoints.
- Idempotency test: confirming the same identifier twice credits once.
- Frontend build passes; manual walkthrough of the 3-step modal.

## Correctness Properties

1. Converted USDC always derived from the live PDAX quote when source='pdax_live'.
2. A given PDAX `identifier` credits the vault at most once.
3. No on-chain credit occurs unless PDAX status is 'completed'.
4. Displayed monetary values have exactly 2 decimals.
5. Explorer links match the active network (testnet vs mainnet).
