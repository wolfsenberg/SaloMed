# Implementation Plan

- [x] 1. Create shared formatting helper
  - Add `frontend/lib/format.ts` with `fmtPhp`, `fmtAsset`, `fmtXlm`,
    `fmtAssetWithCode`; guard NaN/Infinity to "0.00"; PHP uses en-PH locale.
  - _Requirements: 3.1, 3.2, 3.3, 3.5, 3.6_

- [ ]* 1.1 Unit tests for format helpers
  - Table tests for rounding, zero, NaN, string inputs, thousands separators.
  - _Requirements: 3.1, 3.2, 3.6_

- [x] 2. Create Stellar explorer link helper
  - Add `frontend/lib/stellar-links.ts` with `NETWORK_KIND`, `explorerTxUrl`,
    `explorerAccountUrl`, `explorerContractUrl`, `networkBadgeLabel`.
  - Non-64-hex ids return empty string (guard against `DEMO-...`).
  - Export `STELLAR_NETWORK_KIND` derivation from `config.ts`.
  - _Requirements: 2.2, 2.3, 2.4, 2.5_

- [ ]* 2.1 Unit tests for link helper
  - Real hash -> correct testnet/public URL; DEMO id -> empty; badge labels.
  - _Requirements: 2.2, 2.5_

- [x] 3. Update TransactionsTab
  - Remove "Off-chain pilot ledger / Test funds / Not submitted to Stellar"
    labels (header + per-row badge).
  - Add per-row clickable "Verify on Stellar" link via `explorerTxUrl` and a
    network badge; neutral header source label.
  - Route all amounts through `fmtAsset` / `fmtPhp`.
  - _Requirements: 1.1, 2.2, 2.3, 2.4, 2.6, 3.2_

- [x] 4. Update RemittanceForm success screen
  - Drop `simulated` pilot copy and "Pilot reference / Pilot ledger transfer".
  - Render `txHash` as clickable explorer link + network badge; label
    "Transaction hash".
  - Amounts (balance, fee, receives, confirmation) via `fmtAsset`.
  - _Requirements: 1.1, 2.2, 2.3, 2.4, 3.2, 3.5_

- [x] 5. Update VaultCard
  - Replace connect-screen "Pilot environment · Test funds only" and the
    `simulated` purpose-lock copy with neutral "Secured on Stellar {network}"
    copy + network badge.
  - Change "Add GCash test funds" -> "Add funds via GCash".
  - Replace "pilot reference" tip with "indicative rate".
  - Explorer links (account + contract) via helper (network-correct).
  - Hero amounts via `fmtXlm` / `fmtPhp`.
  - _Requirements: 1.1, 1.4, 2.2, 2.4, 3.2, 3.3_

- [x] 6. Update remaining amount displays to 2 decimals
  - `QRPaymentConfirmModal.tsx`, `PaymentTab.tsx`, `LoanTab.tsx`,
    `FreighterTopUpModal.tsx`, `LoanModal.tsx`: replace `toFixed(4)`/`toFixed(7)`
    display calls with `fmtAsset` / `fmtPhp`.
  - Do NOT touch `amountVal()` stroops math in `runtime.ts` (precision).
  - _Requirements: 3.2, 3.3, 3.4, 3.5_

- [x] 7. Clean sandbox labels in translations and secondary components
  - `translations.ts` (default en, en, tl): rewrite `onboard_slide1/2/3_desc`,
    `common_demo_testnet`, `common_demo_simulated` to neutral copy.
  - `OnboardingSlides.tsx`: replace "Pilot flow" / "Pilot environment · Test
    funds" fallback copy.
  - `ProviderCombobox.tsx`: "Pilot provider directory" -> "Verified provider".
  - `LoanTab.tsx`: remove "pilot application / preview / pilot flow" framing.
  - `frontend/lib/api.ts`: neutralize "Pilot top-up completed with test funds in
    the SaloMed ledger." message.
  - _Requirements: 1.1, 1.2, 1.3_

- [x] 8. Neutralize backend user-facing labels
  - `runtime_api.py`: remove "pilot" wording from source/messages; keep network
    field for the frontend.
  - Verify `py_compile` passes and no DB schema change.
  - _Requirements: 1.1, 1.4_

- [x] 9. Verify and guard against regressions
  - Grep the repo for `Pilot`, `test funds`, `pilot ledger`, `SaloMed ledger`,
    `Off-chain`, `toFixed(7)`/`toFixed(4)` in display paths; confirm none remain
    in user-facing code.
  - Run `npm run build` (frontend) and backend `py_compile`; fix any breakage.
  - _Requirements: 1.1, 2.6, 3.6_
