# SaloMed Complete Logic and Functionality Audit

**Audit date:** 2026-07-10  
**Audited worktree:** local `v4.0.0` checkout at `249e4d1`, including the current uncommitted frontend/backend/PDAX changes  
**Scope:** product claims, frontend flows, FastAPI backend, Soroban contract, simulated mode, PDAX assumptions, security boundaries, CI/builds, and public deployment availability

## Executive verdict

SaloMed has a valid **prototype smart-contract core**, but the current application is **not an end-to-end purpose-bound health vault**.

The deployed Soroban contract exists on Stellar Testnet, exposes the expected interface, and its local suite passes 11 tests. The contract correctly requires authorization for deposits/payments, checks the provider whitelist, checks vault balance, and transfers its configured token atomically.

The active frontend does not use that contract flow for normal payment or padala. It prepares ordinary native-XLM payments from the user's spendable wallet, while the displayed "vault" balance is also the wallet's native XLM balance from Horizon. As a result:

- the displayed funds are not locked;
- a user can send them anywhere outside SaloMed;
- the contract whitelist does not protect the active UI payment flow;
- remittance is not purpose-bound;
- SaloPoints, fees, savings, loan state, and transaction history are partly or wholly local simulations;
- the PDAX addition is a prototype adapter, not a complete PHP-to-Stellar settlement flow;
- the nominal demo fallback reports success but can leave the visible balance unchanged.

**Release decision:** suitable only for a clearly labelled concept/demo after repairing the simulated state flow. It is **not suitable for real money, production PDAX credentials, or claims that funds are cryptographically locked**.

## System-of-record problem

The application currently has four competing ledgers:

| Ledger | Where | What it represents | Current use |
|---|---|---|---|
| Native XLM wallet | Horizon / user's Freighter account | Freely spendable XLM | Used as the displayed vault balance and by active Pay/Padala flows |
| Soroban vault | `SaloMedContract` instance storage | Purpose-bound balance of the configured token | Tested and deployed, but bypassed by the main frontend flow |
| Backend demo state | `_demo_vaults` in FastAPI memory | Simulated balance/points | Updated by fallback routes; lost on restart and usually overridden by Horizon in the UI |
| Browser local storage | transaction history and SaloPoints | UI-only history/rewards | User/device-local, mutable, and not authoritative |

Until one ledger is declared authoritative per runtime mode, balance, payment, rewards, and history cannot remain internally consistent.

## Intended flow versus actual flow

### Top-up

**Promised:** PHP/GCash/InstaPay -> converted asset -> locked Soroban vault.

**Current active flow:**

1. `GCashModal` or `InstaPayTopUpModal` calls `/api/pdax/deposit`.
2. If the speculative PDAX request fails or credentials are absent, the backend invokes `deposit_remittance` using the admin or creates a demo transaction.
3. The backend updates `_demo_vaults` and returns `success: true`.
4. The frontend refreshes from Horizon and overwrites the displayed balance with the user's native, spendable XLM.

**Result:** in normal demo fallback, the UI can show "Top-up successful" while the visible vault balance does not increase. The older `/api/topup-legacy` native-XLM funding route would change the Horizon balance, but it is only a last-resort path when the PDAX endpoint itself throws; a successful `demo_fallback` response prevents that route from running.

### Hospital/pharmacy payment

**Promised:** contract checks whitelist -> deducts locked vault -> atomically transfers configured token to provider.

**Current active flow:** `frontend/lib/contract.ts::payHospital` requests `/api/prepare-payment`, receives an unsigned native-XLM payment XDR, asks Freighter to sign, and submits it to Horizon. The backend does not call `is_whitelisted` or `pay_hospital` in this route.

The stricter `/api/payment/pay-hospital` contract route exists, but no active frontend code calls it.

**Result:** payment is a normal wallet transfer, not a vault release. Any valid Stellar destination can receive funds. Invalid/demo provider addresses are silently redirected to the backend signer/admin address.

### Padala/remittance

**Promised:** sender funds a beneficiary's locked vault and cannot be misspent.

**Current active flow:** `/api/prepare-padala` builds a normal native-XLM payment from the sender directly to the beneficiary. For the GCash-recipient option, an invalid hard-coded demo address is redirected to the admin wallet.

**Result:** Stellar recipients receive freely spendable XLM, not purpose-bound contract credit. The displayed padala fee is not taken from the transaction, and the recorded recipient amount can differ from the amount actually sent.

### SaloPoints and "Savings"

The contract awards one point per full USDC-equivalent paid. The UI instead uses provider-specific point rates, stores earned points in local storage, and takes the higher of local and backend values. The UI converts points to "Savings" at 50 points per XLM and offers that as a payment source, but payment still spends native XLM and points are never deducted.

**Result:** rewards can be edited locally, reused indefinitely, and do not represent a funded or contract-enforced asset.

### Loans

The loan tab calculates amortization, waits 1.4 seconds, and saves a pending loan to local storage. There is no underwriting service, server record, disbursement, repayment ledger, or vault credit. The UI itself describes instant demo credit, but `handleApply` does not credit any balance.

### Bill scanning and QR

Bill scanning exists but is not mounted by the active layout. If re-enabled, its PHP `out_of_pocket_balance` is passed directly as `amountXlm`, causing a denomination error. SaloMed QR payloads also supply their own `patient`, `hospital`, and amount; the parser does not bind `patient` to the currently connected wallet.

## Prioritized findings

### Critical blockers

#### C1. The purpose-bound invariant is bypassed

- `frontend/lib/contract.ts:290-328` builds/signs/submits a native-XLM payment.
- `backend/main.py:989-1051` prepares that native payment without a contract invocation or whitelist lookup.
- `frontend/lib/contract.ts:336-379` and `backend/main.py:1060-1121` do the same for padala.

The product's defining security promise is therefore not enforced by the path users actually take.

#### C2. "Vault balance" is the freely spendable wallet balance

- `frontend/lib/contract.ts:93-148` fetches contract/backend data but overwrites balance with Horizon native XLM.
- `frontend/app/(app)/layout.tsx:100-125` repeats the Horizon override as a fast path.
- `backend/main.py:1307-1335` explicitly calls Horizon native XLM "the source of truth for the vault balance display."

This makes the UI label materially misleading: the displayed balance can be spent outside SaloMed at any time.

#### C3. Simulated top-up is not flow-consistent

`/api/pdax/deposit` returns successful `demo_fallback` and updates contract/demo state, but the UI subsequently reads native XLM. A direct audit invocation returned:

```text
success=True, mode=demo_fallback, status=completed, tx_is_demo=True
```

The state that was credited is not the state the user sees or spends.

#### C4. Provider verification is absent from the active payment path

The frontend provider catalog contains non-valid Stellar demo strings. `prepare_payment` catches invalid destinations and replaces them with the signer/admin public key rather than rejecting them. Any syntactically valid Stellar address bypasses even that interception.

This can make a UI payment appear to go to a named hospital while the actual recipient is the admin or an arbitrary address.

#### C5. PDAX is not an end-to-end on-ramp

The adapter assumes private Institutional API URLs/schemas that cannot be verified from public PDAX documentation. More importantly, it stops after an assumed fiat deposit and webhook. It does not execute a quote/order, confirm a fill, withdraw XLM/USDCXLM to Stellar, or reconcile settlement before crediting the vault.

See [PDAX API research and integration audit](./pdax-api-research.md) for the source-cited analysis and the private-document questions that must be resolved with PDAX.

#### C6. Webhook credits are forgeable/replayable in default configuration

- Signature verification returns `True` when `PDAX_WEBHOOK_SECRET` is blank.
- No persistent initiated-deposit record exists.
- The webhook trusts beneficiary and amount from the incoming payload.
- No provider event/reference uniqueness constraint prevents replay.
- Contract failure is converted to a demo transaction, then acknowledged as `vault_credited`.

A repeated or forged `deposit/completed` event can credit repeatedly.

#### C7. Real-provider failures silently become successful demo credits

When PDAX is configured but login, schema, timeout, or provider calls fail, `/api/pdax/deposit` crosses into demo/on-chain admin credit and returns HTTP success. An ambiguous PDAX timeout can therefore create one fallback credit and later receive a real completion webhook for a second credit.

Demo, UAT, and production must be mutually exclusive runtime modes.

#### C8. Asset and rate units are conflated

- `PHP_PER_USDC` and `PHP_PER_XLM` are aliases of the same environment value.
- An XLM/PHP quote is returned as both `php_per_xlm` and `php_per_usdc`.
- The contract documents its token balance as USDC-like 7-decimal units, while the active UI treats it as native XLM.
- `/api/pdax/rate?base=&quote=` ignores its parameters.
- Deposit credit uses the static environment rate instead of a confirmed execution rate/net settled amount.

PDAX lists `XLMPHP` and `USDCXLMPHP` as separate products; they cannot share one price.

#### C9. Custodial/admin routes have no application authorization

Public routes can request backend-signed testnet transfers or admin contract actions:

- `/api/topup-legacy` sends native XLM based only on caller-supplied `amount_php`; no fiat payment is verified.
- `/api/demo/grant` sends 10,000 XLM.
- `/api/demo/fund-fees` sends 5 XLM.
- whitelist, removal, and point-award routes rely on the server's admin signer but have no caller authentication/authorization.

This can drain the testnet treasury and, if network/config safeguards are later changed, becomes a real custodial vulnerability.

#### C10. The current worktree does not pass CI type checking

`npx tsc --noEmit` fails:

```text
components/BillScanner.tsx(193,26): Cannot find name 'onSwitchTab'.
components/PayModal.tsx(113,14): Cannot find name 'ArrowLeftRight'.
```

`next build` succeeds only because `next.config.js` skips type and lint validation. The current GitHub workflow runs `tsc` separately, so the uncommitted worktree would fail the frontend job.

### High-severity correctness gaps

#### H1. Displayed fees and cashback are not executed

UI comments describe hospital/pharmacy/padala fees, but the configured constants do not match those comments, and the actual native-XLM transaction sends the full input amount. No platform-fee operation exists. Recipient history records the fee-reduced amount even though the on-chain recipient gets the full amount.

#### H2. SaloPoints have conflicting formulas and no reliable source of truth

Contract: one point per full USDC. UI: two points/XLM for hospitals, one for pharmacies/padala. Local storage wins when it is higher, so browser state can override the contract-derived tier.

#### H3. "Savings" is unfunded and non-consuming

Points are displayed as redeemable XLM, but no redemption reserve or token contract exists and points are not burned/deducted. Selecting Savings only changes a UI balance check; it does not change the transaction funding source.

#### H4. Transaction history is not an authoritative activity ledger

Local transactions are device-specific. Horizon sync observes native payments only and labels most as padala; it cannot reconstruct Soroban vault deposits/payments. The contract emits no events, despite README claims of advanced event streaming.

#### H5. No persistent backend state or idempotent job processing

Demo balances, padala deductions, tokens, and pending provider state live in process memory. Restarts and multiple workers diverge. There is no database, durable state machine, outbox, reconciliation job, or idempotency ledger.

#### H6. Contract and environment identity can drift

The README, frontend default, backend default, and CI use `CAO3...RZ34`, while `backend/.env.example` uses `CA4C...7CLB`. Environment validation does not ensure frontend/backend contract IDs, network, token asset, and signer/admin identity agree before startup.

#### H7. Current local configuration is mistaken for PDAX-enabled

The local `.env` uses redacted/placeholder values, but `_PDAX_CONFIGURED` only rejects the exact string `your_username_here`. Runtime evidence showed:

```text
pdax_configured=True
gcash_rate source='pdax_live', rate=56.0
pdax_status='Authentication failed'
```

Thus a fallback/static price is falsely advertised as live.

### Medium-severity engineering gaps

- Stellar-address validation often checks only `G` plus 56 characters instead of StrKey checksum validation.
- Invalid payment destinations are redirected rather than rejected.
- A new-account top-up below 2 XLM credits at least 2 XLM, so fiat amount and funded amount differ.
- `DEMO_FALLBACK` defaults to true and has no visible global mode banner.
- A GCash top-up creates a local pending history item and then a second success/pending item instead of updating one transaction.
- A real PDAX pending transaction has no frontend status reconciliation and may stay pending forever.
- Backend models use binary floating point for money; financial amounts need decimal/integer minor units.
- PDAX token storage has no multi-worker coordination; a 401 clears the refresh token before refresh, forcing login.
- `.env.example` says token variables are populated automatically, but the service neither reads nor writes them.
- Contract storage does not explicitly extend instance/code TTL, creating an archival/availability risk that needs a network-policy decision.
- Stale test snapshot files exist for behaviors no longer present in `tests.rs`, which can overstate tested coverage.
- There are no backend unit/integration tests and no frontend component/E2E tests.
- The dependency audit is allowed to fail (`|| true`), so it is informational, not a release gate.
- `next.config.js` contains an unrecognized `webpackMemoryOptimizations` option.
- `next/font` fetches Google Fonts during build, making the build dependent on external network availability.
- Bill scanner and stricter contract-payment UI paths are orphaned/dead code.
- Loan records and rewards are trivially editable local-storage state.

## Contract audit

### What is correct

- One-time initialization is protected.
- Admin whitelist changes require stored-admin authorization.
- Deposits and payments reject non-positive values.
- Deposits require funder authorization and transfer the configured token into the contract.
- Payments require patient authorization, enforce whitelist and sufficient vault balance, update state, then transfer token.
- Token transfer and vault state changes are atomic within contract execution.
- Saturating points arithmetic avoids overflow.
- Local tests cover deposits, accumulation, transfer, points, tiers, insufficient funds, whitelist rejection, removal, admin rejection, and double initialization.

### What still needs design work

- No event emission for deposits, payments, whitelist changes, or rewards.
- No payment/reference ID or replay/duplicate-billing key.
- No provider metadata/type; UI-specific hospital/pharmacy reward rules cannot be enforced.
- No fee split/platform treasury mechanics despite UI claims.
- No points redemption/burn mechanism despite "Savings" UI.
- No explicit storage TTL maintenance strategy.
- No upgrade/migration/emergency-pause/governance path.
- Panic strings are used instead of a stable typed error enum.
- The deployed contract's configured token/admin values were not exposed by public getters, so asset/admin equivalence could not be independently verified.

## PDAX verdict

The correct label for `pdax_service.py` is **prototype adapter with speculative private schemas**.

Public PDAX material supports the high-level availability of InstaPay cash-in, asset conversion, and crypto withdrawal, but those are separate operations. SaloMed implements only an assumed cash-in initiation and assumed webhook. It credits separately held admin testnet/demo value instead of proving PDAX-to-Stellar settlement.

Before any UAT/production claim, obtain the authoritative PDAX package and confirm:

- UAT/production URLs, authentication, refresh, request signing/mTLS/IP rules;
- exact quote, order, fill, balance, withdrawal, and status schemas;
- exact webhook payload/signature/retry/idempotency rules;
- supported `XLM` versus `USDCXLM` asset/network identifiers;
- whether UAT supports Stellar Testnet or only simulated callbacks;
- omnibus/customer KYC model, limits, fees, refunds/chargebacks, Travel Rule, and partner wording;
- GCash branding rights and whether the flow is merely GCash-originated InstaPay rather than a GCash API integration.

## Simulation-mode verdict

The app can provide a useful demo, but it is not currently flow-consistent.

A reliable simulation should use exactly one deterministic demo ledger and make every feature operate on it:

1. Top-up creates a pending transaction, then credits demo vault once.
2. Payment verifies a demo provider whitelist and deducts demo vault once.
3. Padala deducts sender demo vault and credits beneficiary demo vault once.
4. Points are awarded using the same formula as the intended contract.
5. Savings redemption deducts points and a funded simulated reserve, or is removed.
6. History is generated from that ledger, not separate local entries.
7. Restart/seed behavior is explicit.
8. Every screen and receipt visibly says `SIMULATED — NO REAL MONEY`.

Do not fall from PDAX UAT/production into demo mode on an error. Mode must be fixed at startup.

## Build, test, deployment, and evidence summary

| Check | Result | Interpretation |
|---|---|---|
| Soroban `cargo test --release` | **Pass: 11/11** | Contract unit behavior is coherent |
| Deployed contract interface | **Pass** | `CAO3...RZ34` exists on Stellar Testnet and matches source interface |
| TypeScript `npx tsc --noEmit` | **Fail: 2 errors** | Current worktree is not CI-clean |
| Next production build | **Pass with safeguards bypassed** | Compiles because type/lint errors are ignored; invalid config warning remains |
| Backend `py_compile` / app import | **Pass** | 29 routes register in the existing environment; that venv is missing declared Stellar/httpx packages |
| Demo PDAX deposit probe | **Returns simulated success** | Demonstrates silent provider-error -> demo-success behavior |
| Live Vercel URL | **HTTP 200** | Deployment is reachable |
| Live HTML labels | No PDAX/InstaPay label; simulation text present | Current local PDAX work is not the public deployment |
| Public GitHub Actions | Latest public main run passed on `431a0e2` at 2026-04-30 | Does not validate the current local uncommitted changes at `249e4d1` |

The workflow named "CI/CD" contains test/build/audit jobs but no explicit Vercel or Render deployment job. External platform Git integration may deploy separately, but that is not evidenced or gated by this workflow.

## Recommended remediation sequence

### Phase 0 — truthful, stable demo

1. Add an explicit `DEMO` runtime mode and banner.
2. Choose one simulated ledger and remove Horizon overrides in demo mode.
3. Repair top-up -> balance -> pay -> history as one deterministic state flow.
4. Disable/openly label loan, savings redemption, fee, and PDAX features that are not implemented.
5. Fix TypeScript errors and make type/lint failures block builds.

### Phase 1 — restore the product invariant on Testnet

1. Pick the real vault asset: native XLM or Stellar USDC; use one term and one conversion model everywhere.
2. Make the Soroban vault the only Testnet balance source.
3. Build/sign actual Soroban invocations with Freighter for `deposit_remittance` and `pay_hospital`.
4. Replace demo provider strings with valid, contract-whitelisted Testnet accounts.
5. Remove destination redirection and reject invalid/unapproved providers.
6. Emit and index contract events for history.
7. Align fees, points, tiers, and savings rules between UI and contract—or remove them until implemented.

### Phase 2 — secure backend and operations

1. Add authenticated/authorized admin APIs; isolate demo faucet endpoints and rate-limit them.
2. Add a persistent database, double-entry ledger, transaction state machine, idempotency keys, and reconciliation.
3. Add backend tests, frontend integration/E2E tests, and failure-path tests.
4. Validate all environment identities at startup and refuse mixed testnet/mainnet or XLM/USDC configuration.
5. Add structured logs/metrics without secrets and an operational retry/manual-review queue.

### Phase 3 — PDAX UAT

1. Freeze the authoritative PDAX spec/version and obtain written approval for the product model.
2. Implement typed clients from that spec, not guessed response shapes.
3. Implement either direct quote/order/withdrawal settlement or a documented prefunded-treasury model.
4. Fail closed on webhook auth and make every side effect idempotent.
5. Reconcile PDAX cash, trades, crypto withdrawal, Stellar settlement, contract assets, and customer liabilities.
6. Run UAT evidence for timeout, duplicate/out-of-order webhook, partial/rejected trade, withdrawal failure, wrong network, and contract failure.

### Phase 4 — production readiness

Perform legal/compliance/security review for custody, KYC/AML, consumer disclosures, medical-data handling, lending, partner branding, refund/chargeback handling, key management, incident response, and public-network asset contracts. Testnet success is not production financial readiness.

## Minimum acceptance criteria

SaloMed may call itself a functional purpose-bound vault only when all are true:

- the displayed balance equals the contract vault balance;
- depositing transfers the exact configured asset into that contract vault;
- paying invokes the contract and fails for non-whitelisted providers;
- a user cannot use SaloMed's locked balance for an arbitrary wallet payment;
- padala credits the beneficiary vault, not a freely spendable wallet;
- fees/rewards shown in receipts equal executed ledger/chain effects;
- history reconstructs from durable ledger/on-chain events;
- demo, UAT, and production never silently mix;
- current CI, integration tests, and reconciliation checks pass;
- PDAX settlement is documented, idempotent, reconciled, and proven in authorized UAT.

## Final assessment

The strongest part of SaloMed is the contract concept and its unit-tested transfer/whitelist logic. The main engineering task is not adding more UI or more fallback routes; it is reconnecting every user journey to that single invariant and removing the parallel ledgers that currently make successful-looking screens diverge from actual state.

