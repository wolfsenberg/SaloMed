# SaloMed Audit Remediation Closure

**Remediation date:** 2026-07-10  
**Baseline audited:** `249e4d1` plus the pre-existing dirty worktree  
**Release posture:** demo-ready; real Stellar/PDAX modes intentionally gated

## Bottom line

All audit findings that could create false, simulated, backend-signed, or native-XLM value through the active application flow have been fixed or retired. The demo is now internally coherent and persistent. Real-mode code can no longer start merely because credentials exist.

PDAX production settlement is **not implemented**. It is safely blocked, not falsely marked complete. Enabling it still requires the issued private PDAX contract, a conversion/withdrawal or approved prefunded-reserve design, UAT evidence, compliance approval, deployed contract verification, and secret rotation.

## Critical findings

| Finding | Closure | Evidence |
|---|---|---|
| C1 Purpose-bound invariant bypassed | Fixed | Active payment/remittance calls the demo ledger or user-signed Soroban functions. Native payment-XDR routes return HTTP 410. |
| C2 Wallet XLM shown as vault | Fixed | Vault state comes only from the demo ledger or `get_vault`; Horizon native XLM is not used as vault value. |
| C3 Demo top-up inconsistent | Fixed | Top-up, balance, payment, remittance, and history share one SQLite ledger. |
| C4 Provider verification absent | Fixed | Demo payments enforce seeded provider IDs transactionally; Stellar payments use the contract whitelist. Invalid destinations are no longer redirected. |
| C5 PDAX not end-to-end | Safely blocked | PDAX modes require private-spec/config approvals, and deposit/quote/webhook transaction endpoints still return 501. Actual conversion/withdrawal remains external work. |
| C6 Webhook forge/replay | Fixed by removal from the active boundary | No webhook is accepted while settlement is absent; the endpoint returns 501 before reading or acting on a payload. A verifier/state machine must be implemented from the issued spec later. |
| C7 Provider failure becomes demo success | Fixed | Modes are mutually exclusive. A PDAX failure returns an error and cannot enter demo or create value. |
| C8 XLM/USDC/rate conflation | Fixed | USDC is canonical; XLM is network fee only; PHP rate is labelled fixed demo/configured indicative and is never treated as executed settlement. |
| C9 Unauthenticated custodial/admin routes | Fixed | Legacy signer, faucet, admin, native-balance-as-vault, and XDR preparation routes return HTTP 410. Real mutations require wallet/contract authorization. |
| C10 CI type checking bypassed | Fixed | Type errors were repaired; production build no longer ignores TypeScript/ESLint failures; invalid Next config and Google-font build dependency were removed. |

## High-severity findings

| Finding | Closure |
|---|---|
| H1 Fake fees/cashback | Fixed: active calculations and receipts use zero fee, full provider settlement, and no cash-equivalent cashback. |
| H2 Conflicting SaloPoints | Fixed: one point per full USDC; contract/demo are authoritative. |
| H3 Unfunded Savings | Fixed: points-as-money/savings payment source was removed. |
| H4 Local-only history/no events | Fixed for supported modes: demo history is ledger-backed; the new contract emits typed events; real-mode history reads recent confirmed RPC events and distinguishes self-top-ups from vault transfers. |
| H5 Volatile state/no idempotency | Fixed for active demo flow: SQLite/WAL persistence, transactional operations, retry-stable client keys, and server idempotency. PDAX acceptance is disabled rather than represented by an incomplete state machine. |
| H6 Environment/contract drift | Fixed: canonical IDs in examples/CI, startup validation, explicit network mode, contract config gate, and frontend/backend contract/network comparison. |
| H7 Placeholders seen as enabled | Fixed: placeholder/redacted credentials are rejected and PDAX mode is explicit. |

## Contract findings

Fixed in the new source:

- typed initialization, provider, deposit, payment, and points events;
- instance TTL extension;
- `get_token_id` and `get_admin` deployment-verification getters;
- authenticated `transfer_vault` for locked vault-to-vault Padala;
- consistent one-point-per-USDC rule;
- whitelist, balance, authorization, and atomic token transfer coverage remains intact.

Items deliberately left as future contract design—not claimed as production-ready:

- stable typed error enum instead of panic strings;
- upgrade/migration, emergency pause, and governance policy;
- business-level invoice/payment-reference deduplication;
- full historical indexer beyond the RPC retention window.

The new contract source must be built, deployed, initialized with the intended USDC SAC/admin, and verified before `SALOMED_CONTRACT_CONFIG_VERIFIED=true` is allowed.

## PDAX gates that code cannot complete alone

1. Rotate any credentials/secrets that were ever exposed and update the deployment secret store.
2. Obtain the versioned private PDAX UAT/production API, webhook, idempotency, signing/mTLS, IP, and retry specifications.
3. Obtain written product/compliance approval for the customer/KYC, safeguarding, GCash/InstaPay wording, limits, refunds, and Travel Rule model.
4. Implement and reconcile one approved settlement design:
   - PHP deposit -> firm quote/order -> confirmed USDCXLM -> Stellar withdrawal -> confirmed contract deposit; or
   - a legally approved, fully reconciled prefunded reserve.
5. Add provider sandbox fixtures and failure-path tests from the issued specification.

Until all five are evidenced, `pdax_uat`/`pdax_prod` should remain disabled. This is an intentional security control, not an incomplete demo fallback.

## Verification results

| Check | Result |
|---|---|
| Backend tests | 13 passed |
| Soroban release tests | 14 passed |
| Frontend TypeScript | passed |
| Next.js production build | passed with lint/type validation enabled |
| Soroban WASM target build | not re-run locally: sandbox denied Cargo user-cache write; CI retains the required WASM build gate |
| Demo legacy-route safety | tested: retired route returns 410 |
| Demo top-up/payment/remittance/history | tested, persistent, atomic, and idempotent |
| PDAX blank secret/mode/placeholders/replay store | tested fail-closed |

## Release statement

Safe claim: **"SaloMed is a functional, clearly simulated health-vault demo with a tested Soroban implementation path."**

Unsafe claim until external gates are complete: **"Real GCash/PDAX money is converted to USDC and settled into the live SaloMed vault."**

Known non-critical engineering limitations: real-mode history is limited to recent RPC-retained events (120,000 ledgers / 100 results) until a persistent indexer is added; frontend display math still uses JavaScript numbers before exact 7-decimal contract encoding; runtime-mode policy could be further consolidated; contract error/governance/migration design remains future production work.
