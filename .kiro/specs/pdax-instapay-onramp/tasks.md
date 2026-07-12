# Implementation Plan

- [x] 1. Fix and extend pdax_service.py with verified contracts
  - Rewrite `initiate_instapay_deposit` to the verified payload shape
    (method `instapay_upay_cashin`, sender/beneficiary/purpose fields, no
    channel/sender_mobile).
  - Add `get_php_to_asset_quote(amount_php, asset)` using the working PHP-base
    `/trade/price` call; return rate + asset_amount + source.
  - Add `get_deposit_status(identifier)` via `/fiat/transactions`.
  - Keep balances + webhook verification.
  - _Requirements: 0.1, 0.2, 2.1, 2.2, 2.3, 3.2_

- [x] 2. Create stellar_bridge.py (Python-native admin-signed invoke)
  - Build/sign/submit `deposit_remittance(admin, beneficiary, amount)` via
    SorobanServer using SALOMED_SIGNER_SECRET; return txHash.
  - Network-driven by env so testnet and mainnet both work with no code change.
  - _Requirements: 3.1, 3.4, 4.1_

- [ ]* 2.1 Unit test the bridge argument/scval construction
  - Verify stroops conversion and scval address/i128 encoding (mock submit).
  - _Requirements: 3.1_

- [x] 3. Rewrite pdax_api.py router
  - Enable PDAX when credentials configured AND mode is a Stellar or PDAX mode
    (works alongside stellar_testnet, not only pdax_uat).
  - `GET /api/pdax/status` (live balances), `GET /api/pdax/quote`,
    `POST /api/pdax/deposit`, `POST /api/pdax/confirm`, `POST /api/pdax/webhook`.
  - Idempotent credit via a persisted credited-identifier set.
  - _Requirements: 1.1, 1.2, 1.3, 2.1, 2.4, 3.1, 3.3, 3.5, 4.1, 4.2_

- [ ]* 3.1 Unit tests for router (PDAX + bridge mocked)
  - Quote passthrough, deposit shape, confirm-not-completed vs completed,
    idempotent double-confirm credits once.
  - _Requirements: 0.1, 2.1, 3.5_

- [x] 4. Live rate wiring (replace hardcoded 56)
  - Backend rate source becomes live PDAX PHP->USDC when reachable; expose
    rate + source. Fall back to indicative on failure.
  - _Requirements: 0.1, 0.2, 0.4_

- [x] 5. Frontend api.ts wrappers
  - `pdaxStatus`, `pdaxQuote`, `pdaxInitiateDeposit`, `pdaxConfirm` typed.
  - _Requirements: 1.1, 2.1, 2.2, 3.2_

- [x] 6. Rewrite InstaPayTopUpModal.tsx to the real 3-step flow
  - Amount + live conversion ("You receive X USDC") with "Live PDAX rate" badge;
    real checkout link; poll confirm; show on-chain credit + Explorer link.
  - 2-decimal formatting via shared helpers.
  - _Requirements: 0.3, 0.5, 2.2, 2.3, 3.4_

- [x] 7. VaultCard live-rate indicator
  - PHP display + top-up use live PDAX rate; show "Live PDAX rate" badge that
    truthfully switches to "Indicative rate" on fallback.
  - _Requirements: 0.3, 0.4_

- [x] 8. Config + docs
  - Ensure env vars documented (PDAX_*, SALOMED_SIGNER_SECRET); render.yaml notes;
    confirm secrets stay out of the repo.
  - _Requirements: 4.3_

- [x] 9. Verify
  - Backend py_compile + unit tests; frontend build; gated live smoke check of
    quote + deposit; confirm idempotency; confirm testnet explorer links.
  - _Requirements: 0.1, 2.1, 3.1, 3.5, 5 (properties)_
