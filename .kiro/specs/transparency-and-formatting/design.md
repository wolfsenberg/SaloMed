# Design: Transparency Labels and Currency Formatting

## Overview

Three coordinated changes across the frontend (primary) and backend (labels
only):

1. **Money formatting** — one shared helper module enforces 2-decimal display for
   PHP, USDC, and XLM. All scattered `toFixed(7)` / `toFixed(4)` display calls
   are replaced with helper calls. Internal precision (stroops, contract args,
   idempotency keys) is untouched.
2. **Stellar tracking** — one shared explorer helper builds correct
   testnet/mainnet Stellar Explorer URLs. Transaction history and success
   screens render the real `txHash` as a clickable link plus a network badge.
3. **Label cleanup** — remove all "pilot / test funds / SaloMed ledger / off-chain"
   framing from the 3 locales and all components, replaced with neutral,
   production-quality copy that still tells the truth about which network a
   transaction lives on.

## Architecture

```
frontend/lib/
  format.ts        (NEW)  fmtAsset / fmtPhp / fmtXlm  — 2-decimal display
  stellar-links.ts (NEW)  explorerTxUrl / explorerAccountUrl / explorerContractUrl
                          + networkLabel  (testnet | mainnet)
  config.ts        (edit) export STELLAR_NETWORK_KIND ('testnet' | 'public')

frontend/components/
  TransactionsTab.tsx  (edit) explorer link + network badge per row; drop
                              "off-chain pilot ledger / test funds" labels;
                              amounts via fmtAsset
  RemittanceForm.tsx   (edit) success screen: explorer link + network badge;
                              drop pilot copy; amounts via fmtAsset
  VaultCard.tsx        (edit) drop "test funds" copy; explorer links via helper;
                              amounts via fmt helpers; network badge
  OnboardingSlides.tsx (edit) neutral copy (no "pilot environment")
  ProviderCombobox.tsx (edit) "Verified provider" not "Pilot provider directory"
  LoanTab.tsx          (edit) drop "pilot"/"preview" sandbox framing
  QRPaymentConfirmModal.tsx, PaymentTab.tsx, FreighterTopUpModal.tsx,
  LoanModal.tsx        (edit) amounts via fmt helpers (2 decimals)

frontend/lib/i18n/translations.ts (edit) en/en/tl: neutral copy

backend/
  runtime_api.py (edit) response labels/messages: drop "pilot"; add network kind
  salomed_runtime.py (no schema change)
```

## Components and Interfaces

### 1. `frontend/lib/format.ts` (new)

Single source of truth for money display. Display only; never used for on-chain
math.

```ts
// PHP: always 2 decimals with thousands separators -> "1,250.00"
export function fmtPhp(value: number | string): string;

// USDC/asset: max 2 decimals, trailing-zero trimmed to a clean 2dp -> "22.32"
export function fmtAsset(value: number | string): string;

// XLM: same 2-decimal rule as asset
export function fmtXlm(value: number | string): string;

// convenience: "22.32 USDC"
export function fmtAssetWithCode(value: number | string, code?: string): string;
```

Rules:
- Parse input to number, guard NaN/Infinity to `0`.
- `fmtPhp` uses `toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })`.
- `fmtAsset` / `fmtXlm` use `Number(value).toFixed(2)` (both min and max 2 dp so
  "0" renders "0.00" and fees render "0.00 USDC").

Rationale: Requirement 3.6 mandates a shared helper to prevent regressions. The
existing display used inconsistent 7/4 decimals; a helper removes drift.

### 2. `frontend/lib/stellar-links.ts` (new)

```ts
export type StellarNetworkKind = 'testnet' | 'public';

// derived once from NETWORK_PASSPHRASE
export const NETWORK_KIND: StellarNetworkKind;

export function explorerTxUrl(txHash: string, kind?: StellarNetworkKind): string;
export function explorerAccountUrl(address: string, kind?: StellarNetworkKind): string;
export function explorerContractUrl(contractId: string, kind?: StellarNetworkKind): string;

// UI badge text: "Testnet" | "Mainnet"
export function networkBadgeLabel(kind?: StellarNetworkKind): string;
```

- Base: `https://stellar.expert/explorer/{testnet|public}/...`
- `NETWORK_KIND` = `NETWORK_PASSPHRASE === StellarSdk.Networks.PUBLIC ? 'public' : 'testnet'`.
- A `txHash` that is not a 64-char hex string (e.g. a legacy `DEMO-...` id) is
  treated as non-linkable; caller falls back to plain text. This guards
  Requirement 2.5 (never present a fake id as a hash) during any transition.

### 3. Network badge (inline, not a new component)

Small pill rendered where transactions/vault appear:
- Testnet: blue pill `bg-blue-50 text-blue-700` reading `Testnet`.
- Mainnet: blue pill (brand) reading `Mainnet`.
Blue/white brand only; no "test funds" wording. This satisfies Requirement 2.4
and 2.7 (clear distinction, both legitimate).

### 4. TransactionsTab changes

- Remove `sourceLabel` strings "Off-chain pilot ledger · Test funds · Not
  submitted to Stellar" and the per-row "Off-chain pilot ledger · Test funds"
  badge.
- Add, per row: a `Verify on Stellar` link -> `explorerTxUrl(tx.id)` when the id
  is a real hash, plus the network badge.
- Header source label becomes neutral: "On-chain vault activity" (non-demo) with
  the network badge.
- Amounts rendered via `fmtAsset` (2 dp) and `fmtPhp`.

### 5. RemittanceForm success screen

- Drop `simulated` conditional pilot copy.
- Show `<amount> USDC moved into the beneficiary's locked health vault.` using
  `fmtAsset`.
- Label becomes `Transaction hash`, value rendered as a clickable
  `explorerTxUrl(txHash)` link with network badge.
- Vault balance / fee / receives lines via `fmtAsset` (2 dp; fee "0.00 USDC").

### 6. VaultCard changes

- Replace the connect-screen line that reads "Pilot environment · Stellar Testnet
  · Test funds only" with neutral copy plus the network badge (e.g. "Secured on
  Stellar {Testnet|Mainnet}").
- Replace the purpose-lock notice's `runtime?.simulated` branch: no "test funds
  / SaloMed ledger" wording. Keep the Soroban-contract enforcement sentence.
- Replace the tips line "pilot reference" with "indicative rate".
- Explorer links use the helper (network-correct instead of hardcoded testnet).
- Keep the "Add GCash test funds" button label change -> "Add funds via GCash".
- `fmtXlm` / `fmtPhp` for hero amounts (already 2dp; route through helper).

### 7. translations.ts

For each of the three locale blocks (default en, en, tl), rewrite:
- `onboard_slide1_desc`, `onboard_slide2_desc`, `onboard_slide3_desc` — remove
  "pilot environment / test funds / pilot ledger".
- `common_demo_testnet` — becomes a neutral "Secured on Stellar" style string.
- `common_demo_simulated` — neutral or removed from display usage.

### 8. Backend runtime_api.py

- `history_source` / message strings that leak "pilot" wording get neutralized.
- Add a `network` echo is already present; ensure the frontend badge uses the
  frontend-derived network kind (authoritative for links).
- No DB schema changes; `salomed_runtime.py` stays as-is (demo ledger remains for
  local/dev but is not the presented experience).

## Runtime mode note (honest tracking)

Requirement 2 mandates real on-chain transactions in the presented experience.
The `stellar_testnet` mode already implements this end-to-end (Freighter-signed
Soroban calls, real `txHash`, RPC-read history). The presented/deployed
configuration therefore runs `SALOMED_MODE=stellar_testnet` (or mainnet when
configured). This is an environment/config choice, documented here; the code
paths already exist in `runtime.ts` and `runtime_api.py`. The demo SQLite ledger
stays in the codebase for offline development but is not shown as the product
experience, and its `DEMO-...` ids are never rendered as Stellar hashes (guarded
by the hex check in `stellar-links.ts`).

## Data Models

No persistent schema changes. Display-only transformations. On-chain precision
(stroops, i128 contract args) unchanged — `amountVal()` in `runtime.ts` still
uses `toFixed(7)` for the stroops conversion (that is math, not display, so it
stays).

## Error Handling

- `fmtPhp/fmtAsset/fmtXlm` never throw; non-finite input renders "0.00".
- `explorerTxUrl` returns empty string for a non-hash id; callers render plain
  text (no dead link).

## Testing Strategy

- **Unit (format.ts):** table tests — `1250 -> "1,250.00"`, `22.315 -> "22.32"`
  (asset), `0 -> "0.00"`, `NaN -> "0.00"`, string inputs, large values.
- **Unit (stellar-links.ts):** real 64-hex hash -> correct testnet/public URL;
  `DEMO-...` -> empty string; account/contract URLs; badge label per network.
- **Grep guard:** repository search confirms zero remaining "Pilot", "test
  funds", "pilot ledger", "SaloMed ledger" user-facing strings after edits.
- **Build:** `npm run build` (frontend) and `py_compile` (backend) pass.
- **Manual:** transaction row shows clickable Stellar Explorer link + network
  badge; all amounts show 2 decimals.

## Correctness Properties

1. **P1 (2-decimal display):** For any finite numeric input, `fmtPhp`,
   `fmtAsset`, `fmtXlm` output a string whose fractional part is exactly 2
   digits.
2. **P2 (precision preserved internally):** Formatting helpers are never used to
   derive stroops or contract-call arguments; on-chain values remain 7-decimal.
3. **P3 (no fake hash links):** `explorerTxUrl(x)` returns a URL only when `x`
   matches `^[0-9a-fA-F]{64}$`; otherwise empty string.
4. **P4 (network-correct links):** every generated explorer URL segment matches
   `NETWORK_KIND` (`testnet` vs `public`).
5. **P5 (no sandbox strings):** rendered user-facing copy contains none of the
   removed labels.
