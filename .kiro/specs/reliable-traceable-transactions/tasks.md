# Implementation Plan: Reliable & Traceable Transactions

## Overview

This plan restores and hardens every money movement in SaloMed (GCash, InstaPay/PDAX, Freighter XLM deposit, hospital payment, and remittance/padala) so each flow reliably settles, carries a real Stellar transaction hash and network indicator, and records the method behind every top-up. The work is logic and reliability only — no UI redesign.

Tasks are ordered to build incrementally from the storage layer outward: backend store + migration first, then endpoint threading, then the frontend lib layer, then the modals, then rendering, then the pre-sign guards, then the property/regression test suite. Each task references the design symbols it touches and the requirements it satisfies. Property-based tests use Hypothesis (backend) and fast-check (frontend), run a **minimum of 100 iterations**, and are placed immediately after the code they validate.

## Tasks

- [x] 1. Add append-only `source` column and idempotent migration to `history_store.py`
  - In `backend/history_store.py`, add `source TEXT NULL` to the `CREATE TABLE IF NOT EXISTS tx_history` definition for fresh databases
  - Add an idempotent migration: for SQLite check `PRAGMA table_info(tx_history)` and `ALTER TABLE tx_history ADD COLUMN source TEXT` if absent; for PostgreSQL run `ALTER TABLE tx_history ADD COLUMN IF NOT EXISTS source TEXT`
  - Thread `source` through `record(...)` (INSERT-only, never UPDATE/DELETE/upsert) and include it in the row returned by `history(...)`; existing rows read back with `source = NULL`
  - _Requirements: 4.1, 9.1_

  - [x]* 1.1 Write property test P2 for append-only, address-partitioned, field-preserving history
    - Create `backend/tests/test_history_store.py`; use Hypothesis over sequences of recorded transactions across multiple addresses against a temp SQLite DB
    - Assert reading an address returns exactly its rows (never another address's), count matches, and every prior row's `id`, `tx_hash`, and `source` are preserved and never deleted/overwritten
    - Also assert the idempotent migration path: create a table without `source`, run init/migration, insert and read back
    - **Property 2: History is append-only, address-partitioned, and field-preserving** — minimum 100 iterations
    - **Validates: Requirements 4.1, 5.2, 6.2, 9.1, 9.2**

  - [x]* 1.2 Write property test P5 for ledger balance arithmetic and non-negativity
    - In `backend/tests/test_history_store.py`, use Hypothesis over sequences of top-up/payment/remittance operations against the demo ledger
    - Assert each successful op changes the affected balance by exactly its amount (top-up up, payment/padala down), balance never goes negative, and any over-balance op is rejected without mutating any balance
    - **Property 5: Ledger balance arithmetic and non-negativity** — minimum 100 iterations
    - **Validates: Requirements 5.3, 6.3, 11.3**

- [x] 2. Add additive `source` column to the demo ledger in `salomed_runtime.py`
  - In `backend/salomed_runtime.py`, add `source TEXT` to the demo ledger `transactions` table (and `PostgresLedger` equivalent)
  - Change the positional `INSERT INTO transactions VALUES (...)` to an explicit column list so it stays correct after the addition
  - Thread `source` through `DemoLedger.topup(...)` / `PostgresLedger.topup(...)` and return it from `history(...)`
  - _Requirements: 4.1_

- [x] 3. Thread `source` and strict live-rate credit conversion through `runtime_api.py`
  - In `backend/runtime_api.py`, add `source: str | None = Field(default=None, max_length=16)` to `TopUpRequest`; validate against allow-list `{gcash, instapay, freighter}` and coerce unknown/out-of-range values to `null` (never reject a real credit for a bad label)
  - Add `source: str | None` to `HistoryRecordRequest`
  - In `POST /api/v2/topups`, pass `source` into `history_store.record(...)` (Stellar modes) and into `demo_ledger.topup(...)` (demo mode)
  - Make the credited PHP→asset conversion require a live rate (`source == 'pdax_live'` from `pdax_service`); raise `HTTPException(503, {error: "RATE_UNAVAILABLE", ...})` with no bridge call and no vault mutation when unavailable. Remove the silent fallback to `settings.php_per_asset_decimal` for the credited amount
  - _Requirements: 1.1, 1.3, 2.1, 2.3, 4.1, 7.3, 10.3_

  - [x]* 3.1 Write backend tests for the admin-funded top-up credit path
    - Create `backend/tests/test_topup_source.py` following the `TestClient` + `RuntimeSettings` + `DemoLedger(tmp_path)` pattern, with `stellar_bridge` mocked
    - Cases: bridge success → returns `transaction_id` = mocked hash and records a row with `source` + `tx_hash`; `BridgeError` → `502 ONCHAIN_CREDIT_FAILED`, no row, balance unchanged; bridge not configured → `503 BRIDGE_NOT_CONFIGURED`, no mutation; rate not live → `503 RATE_UNAVAILABLE`, no bridge call, no mutation
    - _Requirements: 1.1, 1.3, 2.1, 2.3, 3.4, 7.3, 10.3_

  - [x]* 3.2 Write property test P1 for idempotent top-up credit
    - In `backend/tests/test_topup_source.py` (or `test_runtime_api.py`), use Hypothesis over valid address, positive PHP amount, and idempotency key
    - Assert submitting the same request with an identical key credits the vault exactly once and every replay returns the original result (including `source`)
    - **Property 1: Idempotent top-up credit** — minimum 100 iterations
    - **Validates: Requirements 1.4, 2.4**

  - [x]* 3.3 Write property test P7 for live-rate conversion (backend helper)
    - Add a Hypothesis test for the backend rate helper over positive PHP amounts and positive live PHP-per-asset rates
    - Assert PHP→asset equals amount divided by rate (within asset rounding) and equals the input only when the rate is exactly 1 (never fixed 1:1)
    - **Property 7: Live-rate conversion is proportional and never fixed 1:1** — minimum 100 iterations
    - **Validates: Requirements 10.1, 10.2**

- [x] 4. Checkpoint - backend store and endpoint
  - Ensure all backend tests pass, ask the user if questions arise.

- [x] 5. Thread `source` and add strict live-rate helpers in `frontend/lib/runtime.ts`
  - Add `source` to the `demoTopUp(address, amountPhp, source)` `POST /api/v2/topups` request body
  - Add `source: string | null` to `HistoryRow` and map it from the backend row in `getAddressHistory`
  - Add optional `source` to `recordHistory(row)` and pass it through to `POST /api/v2/history/record`
  - Add `convertPhpToAssetLive(amountPhp)` and `convertAssetToPhpLive(amountAsset)` that call the live-rate endpoint and **throw** a descriptive error when the result is not a live rate (`source !== 'pdax_live'`)
  - _Requirements: 4.1, 10.1, 10.3_

- [x] 6. Forward `source` through `depositToVault` in `frontend/lib/contract.ts`
  - Add a `source: 'gcash' | 'instapay' | 'freighter'` parameter to `depositToVault(userAddress, amountAsset, source)` and forward it to `demoTopUp(...)`; keep the settlement id / tx hash return value
  - Leave `payHospital` and `sendPadala` signatures unchanged
  - _Requirements: 4.1_

- [x] 7. Pass method constants from the top-up modals and label the InstaPay real-settlement branch
  - `GCashModal.handleSimulatePayment` → `depositToVault(beneficiaryAddress, result.amount_xlm, 'gcash')`
  - `InstaPayTopUpModal.handleConfirm` fallback branch → `depositToVault(beneficiaryAddress, usdcOut, 'instapay')` (keep the two-branch behavior: `pdaxConfirm` real settlement first, else `depositToVault`)
  - `FreighterTopUpModal.handleTopUp` → `depositToVault(address, parsedXlm, 'freighter')`
  - In `backend/pdax_api.py`, set `source='instapay'` on the `history_store.record(...)` call in the InstaPay real-settlement branch so both InstaPay branches label identically
  - No layout changes to any modal
  - _Requirements: 1.1, 2.1, 3.1, 4.2, 4.3, 4.4_

- [x] 8. Add the top-up label map helper and render it in `TransactionsTab`
  - Add a pure label-map helper (in `frontend/lib/stellar-links.ts` or `format.ts`) mapping `gcash`→"Top-up via GCash", `instapay`→"Top-up via InstaPay", `freighter`→"Top-up via Freighter Wallet", and null/unknown→"Vault top-up"; never emit "simulated", "fake", "mock", or "demo"
  - In `TransactionsTab`, map `topUpSource: r.source ?? undefined` and render "Top-up via {label}" for `type === 'topup'`, falling back to "Vault top-up" when `source` is null
  - _Requirements: 4.2, 4.3, 4.4, 4.5_

  - [x]* 8.1 Write property test P3 for the top-up label map
    - Create `frontend/lib/__tests__/topup-label.test.ts` using vitest + fast-check over `gcash`, `instapay`, `freighter`, `null`, and arbitrary unknown strings
    - Assert the three known sources map to their exact labels, everything else maps to the generic top-up label, and no returned label contains "simulated"/"fake"/"mock"/"demo" (case-insensitive)
    - **Property 3: Top-up method label is total and safe** — minimum 100 iterations
    - **Validates: Requirements 4.2, 4.3, 4.4, 4.5**

- [x] 9. Confirm Verify-on-Stellar link and per-row network badge in `TransactionsTab`
  - Confirm `explorerTxUrl`/`networkBadgeLabel` from `frontend/lib/stellar-links.ts` build the `stellar.expert/explorer/{testnet|public}/tx/{hash}` URL from `STELLAR_NETWORK_KIND` and return `''` for non-hash identifiers (plain text, no dead link)
  - Confirm `TransactionsTab` renders the Verify link only for rows with a real hash and shows the per-row `Stellar {networkBadgeLabel()}` pill
  - _Requirements: 7.2, 8.1, 8.2, 8.3, 8.4_

  - [x]* 9.1 Write property test P4 for verify-link validity and network correctness
    - Create `frontend/lib/__tests__/stellar-links.test.ts` using vitest + fast-check
    - Assert `explorerTxUrl` returns a non-empty URL iff the input is a real 64-char hex Stellar hash, and for any real hash and network kind in `{testnet, public}` the URL contains the segment `/explorer/{kind}/tx/{hash}` matching that kind
    - **Property 4: Verify link validity and network correctness** — minimum 100 iterations
    - **Validates: Requirements 7.2, 8.1, 8.2, 8.3**

- [x] 10. Add the pre-sign live-balance guard to `RemittanceForm`
  - Extract the insufficient-balance check as a pure predicate (e.g. `blocksForInsufficientBalance(amount, liveBalance)`), shared/aligned with `PaymentTab`
  - In `RemittanceForm.handleSend`, re-read the live on-chain balance via `getVault()` (matching `PaymentTab`) before `sendPadala`; block before any signing call and show a descriptive "Insufficient locked vault balance." message when the amount exceeds the live balance
  - _Requirements: 11.1, 11.2, 11.3_

  - [x]* 10.1 Write property test P6 for the pre-sign insufficient-balance guard
    - Create `frontend/lib/__tests__/balance-guard.test.ts` using vitest + fast-check over live balance B and requested amount A
    - Assert the guard blocks iff A exceeds B, and when blocked it does not invoke the signing path and leaves the balance unchanged
    - **Property 6: Pre-sign insufficient-balance guard** — minimum 100 iterations
    - **Validates: Requirements 11.1, 11.2**

- [x] 11. Checkpoint - frontend threading, rendering, and guards
  - Ensure all frontend tests pass, ask the user if questions arise.

- [x] 12. Extend the durable-restart persistence test across all five flows
  - In `backend/tests/test_runtime_api.py`, extend the durable-restart test so a store restart restores both history rows and vault balance for all five flows (GCash top-up, InstaPay top-up, Freighter top-up, hospital payment, padala), including two-sided padala rows
  - Assert address-keyed history returns the complete set after restart and balances are re-read correctly
  - _Requirements: 9.2, 9.3, 9.4_

- [x] 13. Final regression task - run all suites across the five flows
  - Run backend `pytest` (asserting topup source persistence, idempotency, bridge/rate error paths, store properties, and durable restart cover all five flows)
  - Run the frontend single-run checks: `npx tsc --noEmit`, `npm run lint`, and `vitest run` (label map, stellar-links, balance-guard property tests)
  - Verify all three top-up methods plus payment and padala remain functional and no forbidden words appear in any label
  - _Requirements: 12.1, 12.2, 12.3_

## Notes

- Tasks marked with `*` are optional test sub-tasks and can be skipped for a faster MVP; core implementation tasks are never optional.
- Each task references specific requirements for traceability and names the design symbols/files it touches.
- Property tests (P1–P7) are placed immediately after the code they validate, tagged with `# Feature: reliable-traceable-transactions, Property <n>` (backend) or an equivalent comment (frontend), and each runs a minimum of 100 iterations.
- Property tests use Hypothesis (backend) and fast-check + vitest (frontend); they are configured, not implemented from scratch.
- Checkpoints ensure incremental validation at natural boundaries (backend, frontend, final).
- The Soroban contract behaviors (`pay_hospital`/`transfer_vault`/`deposit_remittance`) are already covered in `contracts/salomed/src/tests.rs` and are referenced, not duplicated.

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1"] },
    { "id": 1, "tasks": ["1.1", "1.2", "2"] },
    { "id": 2, "tasks": ["3"] },
    { "id": 3, "tasks": ["3.1", "3.2", "3.3"] },
    { "id": 4, "tasks": ["5", "6"] },
    { "id": 5, "tasks": ["7", "8", "9", "10"] },
    { "id": 6, "tasks": ["8.1", "9.1", "10.1"] },
    { "id": 7, "tasks": ["12"] },
    { "id": 8, "tasks": ["13"] }
  ]
}
```
