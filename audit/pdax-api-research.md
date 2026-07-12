# PDAX Institutional API research and SaloMed integration audit

**Audit date:** 2026-07-10  
**Code reviewed:** `backend/pdax_service.py`, `backend/main.py`, `backend/.env.example`  
**External-source rule:** Only PDAX-owned public pages were used. No endpoint was probed and no undocumented API was called.

## Executive verdict

The current PDAX integration is **not verified as a real end-to-end PHP-to-Stellar on-ramp and is not safe to enable with real money**.

PDAX's public material confirms the relevant high-level capabilities: users can cash PHP into a PDAX account through InstaPay, separately convert PHP into a chosen digital asset, and separately withdraw that digital asset to a recipient wallet. PDAX publicly lists both `XLMPHP` and `USDCXLMPHP` trading pairs and both XLM and USDC-on-Stellar (`USDCXLM`) as supported Stellar-network assets. However, PDAX does not publicly expose the Institutional API request/response contract needed to validate the base URL, authentication scheme, endpoint paths, webhook schema/signature, idempotency rules, or UAT behavior. PDAX's own terms say API use is subject to a separate written agreement and prior written consent. [PDAX Terms and Conditions](https://pdax.ph/rule/terms-and-conditions/)

SaloMed currently implements only a presumed fiat-deposit request. On a presumed "completed deposit" webhook it immediately mints the user-facing outcome by invoking SaloMed's `deposit_remittance` with the admin as funder. There is no PDAX order execution, no fill confirmation, no PDAX crypto withdrawal, no Stellar destination-address request, and no PDAX-to-SaloMed settlement reconciliation. Therefore, even if the assumed fiat endpoint happens to be correct, a completed PHP cash-in would fund a PDAX account—not prove that XLM/USDCXLM reached the SaloMed vault. PDAX's public user flow explicitly treats cash-in, conversion, and crypto withdrawal as separate steps. [How to cash in through InstaPay](https://support.pdax.ph/support/solutions/articles/1060000097213-how-do-i-cash-in-through-instapay-), [How to buy digital assets](https://support.pdax.ph/support/solutions/articles/1060000097448-how-do-i-buy-digital-assets-), [How to withdraw digital assets](https://support.pdax.ph/support/solutions/articles/1060000097183-how-do-i-withdraw-my-digital-assets-on-pdax-)

The no-credentials demo remains usable as a UI demonstration, but its value movements are simulated or funded independently by the testnet admin. It must not be described as a real PDAX or GCash bridge.

## What PDAX publicly verifies

1. **Institutional/partner API access is contractual, not a public plug-and-play API.** PDAX states that access may be granted to partners under a separate written agreement, solely for mutually agreed purposes, and that developing with the API requires prior written consent. The exact integration contract must therefore come from SaloMed's PDAX onboarding/NDA package. [PDAX Terms and Conditions, API Access](https://pdax.ph/rule/terms-and-conditions/)

2. **An InstaPay cash-in credits a PDAX account.** The public instructions require a verified PDAX mobile number, PDAX account number, and PDAX account name; the sender chooses PDAX as the receiving bank. The public instructions do not say that an InstaPay cash-in automatically purchases crypto or sends it to an external Stellar address. [PDAX InstaPay cash-in instructions](https://support.pdax.ph/support/solutions/articles/1060000097213-how-do-i-cash-in-through-instapay-)

3. **Fiat cash-in and digital-asset purchase are separate operations.** PDAX's purchase flow requires choosing an asset, obtaining/reviewing the order details, and confirming the conversion. The retail help page says price quotes change every 15 seconds; an institutional quote lifetime may differ and must be checked against the private spec. [PDAX digital-asset purchase instructions](https://support.pdax.ph/support/solutions/articles/1060000097448-how-do-i-buy-digital-assets-)

4. **Crypto withdrawal is another separate operation.** PDAX's public flow requires the asset, amount, recipient wallet address, network/fee review, and email OTP confirmation. Institutional automation may replace OTP, but that cannot be assumed without the private agreement. [PDAX digital-asset withdrawal instructions](https://support.pdax.ph/support/solutions/articles/1060000097183-how-do-i-withdraw-my-digital-assets-on-pdax-)

5. **XLM/PHP and USDC-on-Stellar/PHP are distinct products.** PDAX publicly lists `XLMPHP` and `USDCXLMPHP` as separate trading pairs. It also identifies XLM as Stellar and `USDCXLM` as USD Coin on Stellar. This supports the asset names at a product level but does not validate the Institutional API symbols or fields. [PDAX supported trading pairs](https://support.pdax.ph/support/solutions/articles/1060000097425-what-trading-pairs-are-supported-on-pdax-), [PDAX supported crypto networks](https://support.pdax.ph/support/solutions/articles/1060000097292-what-networks-can-i-use-to-transfer-cryptocurrencies-to-and-from-my-pdax-wallet-)

6. **GCash and InstaPay are not the same PDAX channel.** PDAX's published cash-in table lists GCash and InstaPay separately, with different fees, while its InstaPay participant list includes G-Xchange. A GCash user can plausibly originate an InstaPay bank transfer to PDAX, but that is not evidence of a PDAX "GCash API bridge." [PDAX available cash-in channels](https://support.pdax.ph/support/solutions/articles/1060000097126-available-cash-in-payment-channels), [PDAX InstaPay participants](https://support.pdax.ph/support/solutions/articles/1060000097405-list-of-banks-and-e-wallets-with-pdax-option-in-instapay)

7. **Public retail limits and KYC constraints exist.** PDAX's published table lists a PHP 50,000 maximum per InstaPay cash-in, and its InstaPay instructions require a verified PDAX mobile number/account. Partner/omnibus limits and KYC allocation may differ, so the signed institutional agreement controls. [PDAX available cash-in channels](https://support.pdax.ph/support/solutions/articles/1060000097126-available-cash-in-payment-channels), [PDAX InstaPay cash-in instructions](https://support.pdax.ph/support/solutions/articles/1060000097213-how-do-i-cash-in-through-instapay-), [PDAX Partner Site Addendum](https://pdax.ph/rule/partner-site-addendum/)

## Institutional API assumption matrix

"Unverified" below means the repository asserts a private API contract that cannot be corroborated from PDAX's official public documentation. It does **not** prove that the assertion is wrong; it means it must not be shipped until matched line-for-line against SaloMed's current PDAX-issued specification and tested in the authorized environment.

| Area | Repository assumption | Public verification | Audit result |
|---|---|---|---|
| UAT base URL | `https://uat.services.sandbox.pdax.ph/api/pdax-api` | PDAX publicly describes partner APIs as separately contracted but publishes no UAT hostname in the reviewed material. [Terms](https://pdax.ph/rule/terms-and-conditions/) | **Unverified/private-doc required.** Do not infer production URL by editing `uat`/`sandbox`. |
| Login | `POST /pdax-institution/v1/login` with JSON `username`, `password` | No public Institutional API auth schema. | **Unverified/private-doc required.** |
| Login response | `access_token`, `id_token`, `refresh_token`, `expires_in`; default 600 seconds | No public token schema or lifetime. | **Unverified/private-doc required.** The "~600 seconds" comment is unsupported publicly. |
| Auth headers | Custom `access_token` and `id_token` headers | No public header contract. | **Unverified/private-doc required.** Could be custom headers, bearer auth, API keys, mTLS, request signing, or a combination. |
| Refresh | `PUT /pdax-institution/v1/refresh-token` with `refresh_token` header | No public refresh contract. | **Unverified/private-doc required.** |
| Indicative price | `GET .../trade/price?base_currency=XLM&quote_currency=PHP`; parse any of `ask`, `price`, `ask_price`, `rate` | Public product page verifies that `XLMPHP` exists, not this endpoint or response fields. [Pairs](https://support.pdax.ph/support/solutions/articles/1060000097425-what-trading-pairs-are-supported-on-pdax-) | **Capability plausible; endpoint/schema unverified.** Guessing multiple response shapes can silently accept the wrong semantic field. |
| Firm quote | `POST .../trade/quote` with `base_currency`, `quote_currency`, `side`, `base_amount`; assume `quote_id`, `rate`, `expires_at` | Public retail flow confirms a quote/confirmation step and says retail quotes change every 15 seconds, not the institutional endpoint or fields. [Purchase flow](https://support.pdax.ph/support/solutions/articles/1060000097448-how-do-i-buy-digital-assets-) | **Capability plausible; endpoint/schema and 30-second default unverified.** |
| Trade/order | A returned `quote_id` "can be used" to execute a trade | No order-execution code exists in either reviewed Python file. Public flow requires confirmation before conversion. [Purchase flow](https://support.pdax.ph/support/solutions/articles/1060000097448-how-do-i-buy-digital-assets-) | **Missing.** There is no API call to accept a quote/place an order and no fill-status reconciliation. |
| Fiat deposit | `POST .../fiat/deposit` with `amount`, `currency=PHP`, `channel=INSTAPAY`, `reference_id`, arbitrary `metadata`; expect checkout/payment/redirect URL | Public pages verify InstaPay cash-in to a PDAX account and a retail payment flow, not this API path, metadata echo, or URL fields. [InstaPay instructions](https://support.pdax.ph/support/solutions/articles/1060000097213-how-do-i-cash-in-through-instapay-), [web cash-in flow](https://support.pdax.ph/support/solutions/articles/1060000097486-cash-in-online-instapay) | **Capability plausible; endpoint/payload/response unverified.** Metadata echo is a critical unsupported dependency. |
| Fiat withdrawal | `POST .../fiat/withdraw` with `bank_code`, account fields, `channel=INSTAPAY`; only `BASECPH` and `BACTBPH` claimed for UAT | Public participant material includes Security Bank and CTBC, but does not validate these codes, the endpoint, or a two-bank UAT restriction. [Participants](https://support.pdax.ph/support/solutions/articles/1060000097405-list-of-banks-and-e-wallets-with-pdax-option-in-instapay) | **Unverified/private-doc required.** The function is imported by `main.py` but no SaloMed HTTP endpoint calls it. |
| Balances | `GET .../balances`; accept list or map with several guessed field names | No public Institutional API schema. | **Unverified/private-doc required.** Function is imported but not exposed or used in the reviewed routes. |
| Crypto deposit address | None | PDAX's public product supplies a network-specific crypto deposit address (and for some assets a memo/tag), but no institutional endpoint is documented publicly. [PDAX crypto deposit instructions](https://support.pdax.ph/support/solutions/articles/1060000097399-how-to-deposit-cryptocurrency-into-your-pdax-wallet-) | **Missing from SaloMed.** Not necessarily required for fiat on-ramp, but any treasury funding design must define it. |
| Crypto withdrawal to SaloMed | None | Public product flow requires asset, amount, recipient address, network and confirmation. [Withdrawal flow](https://support.pdax.ph/support/solutions/articles/1060000097183-how-do-i-withdraw-my-digital-assets-on-pdax-) | **Missing and blocking end-to-end settlement.** |
| Webhook event names/schema | Flat payload with `event`/`type`, `status`, `amount`, `currency`/`asset`, `reference_id`/`id`, and top-level `metadata`; events `deposit`, `withdrawal`, `trade`, `transaction_update`; completed status exactly `completed` | No public PDAX webhook schema found. | **Entire schema unverified/private-doc required.** |
| Webhook signature | HMAC-SHA256 over exact raw body; secret from dashboard; hex in `X-PDAX-Signature` or `X-Signature`, optional `sha256=` prefix | No public PDAX signature specification found. | **Entire verification contract unverified/private-doc required.** Do not invent header aliases or canonicalization. |
| Idempotency | Application `reference_id` only; no idempotency header; no persistent record | No public Institutional API idempotency rule found. | **Private-doc required, and SaloMed still needs its own durable idempotency.** Provider behavior cannot replace application ledger controls. |
| Sandbox/UAT settlement | Assumed to produce a checkout and webhook that can credit a Stellar testnet contract | No public PDAX UAT funding, test identities, simulated bank behavior, webhook retry policy, or Stellar-testnet support was found. Public support pages name the Stellar network, while SaloMed is configured for `testnet`. [Networks](https://support.pdax.ph/support/solutions/articles/1060000097292-what-networks-can-i-use-to-transfer-cryptocurrencies-to-and-from-my-pdax-wallet-) | **Unverified/private-doc required.** Do not assume that PDAX UAT settles to SaloMed's testnet; confirm exactly what UAT simulates. |
| Request signing/mTLS/IP allowlist | None | No public Institutional security contract. PDAX requires partners to secure API credentials and use the API only as agreed. [Terms](https://pdax.ph/rule/terms-and-conditions/) | **Unverified/private-doc required.** Confirm mTLS, signatures, IP allowlists, key rotation, and secret storage before deployment. |

## Actual SaloMed flow versus a financially complete flow

### What the code does now

1. `/api/pdax/deposit` submits the assumed fiat-deposit request (`pdax_service.py` lines 299–362; `main.py` lines 1498–1548).
2. It reports `mode: pdax_real` as soon as that request returns HTTP success, even if no usable checkout URL was parsed.
3. A webhook is treated as authoritative solely from its flat payload and presumed signature (`pdax_service.py` lines 524–556 and 592–642; `main.py` lines 1601–1700).
4. On a `deposit/completed` event, SaloMed divides the PHP amount by the static `PHP_PER_USDC`, invokes the testnet contract with the admin as `ofw`, and also credits its in-memory demo ledger.
5. No PDAX quote acceptance/order, trade fill, PDAX crypto withdrawal, Stellar transaction hash, or PDAX balance reconciliation occurs.

### Minimum complete real-money flow

The private PDAX agreement may permit an omnibus/prefunded variation, but one of the following must be explicit and reconciled:

- **Direct settlement:** verified PHP cash-in -> executable quote -> order/convert -> confirmed USDCXLM (or XLM) balance -> crypto withdrawal to an approved Stellar **public-network** address -> confirmed Stellar transaction -> contract/vault credit; or
- **Prefunded treasury:** verified PHP cash-in -> SaloMed credits from a separately prefunded reserve -> later PDAX conversion/withdrawal replenishes the reserve -> automated double-entry reconciliation proves customer liabilities never exceed settled reserve.

The current implementation is neither. It creates a vault credit from the admin's testnet balance (or merely the demo ledger) without demonstrating that PDAX delivered the matching asset.

## Code findings

### Critical — no PDAX-to-Stellar settlement

The endpoint is documented as "Real PHP -> XLM on-ramp," but it never buys XLM or USDCXLM and never requests withdrawal to the SaloMed address. Public PDAX instructions establish those as separate operations. [Cash-in](https://support.pdax.ph/support/solutions/articles/1060000097213-how-do-i-cash-in-through-instapay-), [conversion](https://support.pdax.ph/support/solutions/articles/1060000097448-how-do-i-buy-digital-assets-), [withdrawal](https://support.pdax.ph/support/solutions/articles/1060000097183-how-do-i-withdraw-my-digital-assets-on-pdax-)

**Impact:** PDAX PHP can be stranded in the institutional account while the app independently credits testnet/demo value. There is no proof of reserves or one-to-one settlement.

### Critical — webhook is replayable and can credit repeatedly

There is no database record of initiated deposits, no uniqueness constraint on provider event ID/reference, and no processed-event ledger. Every repeated valid `deposit/completed` payload invokes `deposit_remittance` again and `_demo_deposit` again (`main.py` lines 1648–1699).

The handler also trusts the webhook-supplied beneficiary and amount instead of loading the expected amount/beneficiary from a server-side pending-deposit record. It does not validate currency, account/merchant identity, original request reference, or whether the amount matches the initiated deposit.

**Impact:** provider retries, replay, or a compromised webhook secret can create duplicate or misdirected credits.

### Critical — webhook authentication fails open

`verify_webhook_signature` returns `True` when `PDAX_WEBHOOK_SECRET` is blank (`pdax_service.py` lines 608–619). `.env.example` leaves it blank. Thus the default deployment accepts unsigned public webhook requests.

Even when configured, HMAC-SHA256, header names, and encoding are guesses until checked against the private spec. A cryptographically correct implementation of the wrong scheme rejects real PDAX events; a permissive one accepts forgeries.

### Critical — silent demo fallback can create value after a real PDAX failure

Any failed assumed PDAX deposit—authentication failure, schema error, provider 5xx, or timeout—sets `fallback: True`, after which `/api/pdax/deposit` executes the demo/on-chain admin credit and returns `success: true`, `status: completed` (`pdax_service.py` lines 358–362; `main.py` lines 1550–1596).

The most dangerous case is an ambiguous timeout: PDAX may have accepted the cash-in request, while SaloMed creates a fallback credit; a later real webhook can create a second credit. A configured real-money mode must never silently cross into demo mode.

### High — XLM and USDC rates are conflated

`get_xlm_php_rate` requests `XLM/PHP`, while `/api/gcash-rate` returns that value as both `php_per_xlm` and `php_per_usdc` (`pdax_service.py` lines 249–294; `main.py` lines 1287–1303). `main.py` also aliases both configured rates to the same `PHP_PER_USDC` variable (lines 92–95). PDAX lists `XLMPHP` and `USDCXLMPHP` as distinct pairs, so they cannot share one rate by definition. [PDAX supported pairs](https://support.pdax.ph/support/solutions/articles/1060000097425-what-trading-pairs-are-supported-on-pdax-)

`/api/pdax/rate` accepts `base` and `quote` query parameters but ignores them and always calls the XLM rate function (`main.py` lines 1477–1493). Deposit credit calculations use the static environment rate rather than the fetched/firm execution rate (`main.py` lines 1533 and 1673), so UI estimates, ledger credits, and actual execution can diverge.

### High — "live" source label can be false

Both rate routes label the source `pdax_live` whenever credentials are merely configured. If authentication, parsing, or the price request fails, `get_xlm_php_rate` returns a stale/static fallback but the route still labels it live (`main.py` lines 1287–1303 and 1477–1493).

### High — amount, channel, KYC, and network constraints are not enforced

The backend accepts any `amount_php > 0`; it does not enforce the public PHP 50,000 InstaPay per-transaction maximum or an institution-specific limit. It accepts only a Stellar beneficiary string description, without validating the address or recording the end customer/KYC owner. PDAX's public InstaPay path is tied to a verified PDAX account, while its Partner Addendum describes partner-provided customer/KYC data. The institutional/omnibus agreement must define whose PDAX account is funded, who the customer of record is, and how SaloMed maps that party to a vault. [InstaPay instructions](https://support.pdax.ph/support/solutions/articles/1060000097213-how-do-i-cash-in-through-instapay-), [cash-in limits](https://support.pdax.ph/support/solutions/articles/1060000097126-available-cash-in-payment-channels), [Partner Addendum](https://pdax.ph/rule/partner-site-addendum/)

### High — asset/network and contract token are not proved equivalent

The code alternates between "XLM" and "USDC," while its conversion helper and contract-facing amount describe USDC stroops. PDAX distinguishes XLM from USDCXLM. The private contract and deployment records must prove all of the following: exact asset symbol, Stellar network, USDC issuer/contract address, destination, decimals, and that the token configured in the Soroban contract is the same settled asset. [PDAX supported pairs](https://support.pdax.ph/support/solutions/articles/1060000097425-what-trading-pairs-are-supported-on-pdax-), [PDAX supported networks](https://support.pdax.ph/support/solutions/articles/1060000097292-what-networks-can-i-use-to-transfer-cryptocurrencies-to-and-from-my-pdax-wallet-)

### High — on-chain failure is reported as credited

The webhook catches a contract `HTTPException`, substitutes a demo transaction ID, updates demo state, and returns `action: vault_credited` (`main.py` lines 1676–1700). This acknowledges the webhook while losing the real settlement job. There is no durable retry/outbox or manual-reconciliation queue.

### Medium — response parsing is speculative and can produce a false success

Deposit success accepts any successful HTTP response, tries four possible URL fields, and returns success even if the resulting URL is empty (`pdax_service.py` lines 342–356). Rate, balance, and quote methods similarly guess several response shapes. Schema variation should be handled through versioned typed models from the issued spec, not permissive guessing.

### Medium — auth implementation has operational gaps

Tokens are process-local and the store is only described as "thread-safe-ish"; there is no lock around login/refresh, no shared store for multiple workers, and no refresh coordination. A 401 clears the refresh token before calling refresh, which forces a full login rather than exercising the refresh endpoint (`pdax_service.py` lines 211–218). `.env.example` lists `PDAX_ACCESS_TOKEN`, `PDAX_ID_TOKEN`, and `PDAX_REFRESH_TOKEN` as "populated automatically," but the code never reads or writes those environment variables.

### Medium — no idempotent request/reconciliation state machine

A `reference_id` is generated, but SaloMed does not persist it or send a documented idempotency key/header. There are no states such as `created`, `payment_pending`, `fiat_settled`, `quote_received`, `order_filled`, `withdrawal_submitted`, `stellar_confirmed`, `vault_credited`, `failed`, or `manual_review`. The UI-facing `pending_payment` response is therefore not backed by an auditable server-side record.

## Is the GCash/InstaPay-to-Stellar logic real or simulated?

| Segment | Current reality |
|---|---|
| GCash UI | A branded frontend entry point. It calls the generic SaloMed PDAX deposit route; it is not a GCash API integration. |
| GCash -> PDAX | **Potentially real only as a user-originated InstaPay transfer** if the issued PDAX deposit API actually returns valid payment instructions. PDAX lists GCash and InstaPay separately, so the app must not claim a direct GCash bridge. [Channels](https://support.pdax.ph/support/solutions/articles/1060000097126-available-cash-in-payment-channels) |
| PDAX PHP cash-in | **Unverified implementation.** The product capability is real, but SaloMed's endpoint/path/payload are private-doc assumptions. |
| PHP -> XLM/USDCXLM | **Not implemented.** Quote retrieval alone is not conversion; there is no order/accept call. |
| PDAX -> Stellar | **Not implemented.** There is no crypto-withdrawal call or Stellar transaction confirmation. |
| Stellar vault credit | **Attempted on testnet using the SaloMed admin's separately held contract token**, or simulated with in-memory state if the CLI fails. It is not causally settled from PDAX assets. |
| Demo fallback | **Explicitly simulated**, but automatically entered on real provider errors, which makes it unsafe outside a demo-only deployment. |

## Required production gates

1. **Obtain and freeze the authoritative PDAX integration package.** It must include environment URLs, auth and refresh, all endpoint schemas, supported asset symbols/networks, quote/order lifecycle, fiat deposit lifecycle, crypto withdrawal/address flows, webhook schema/signature/retries, error codes, rate limits, idempotency, test data, IP/mTLS/signing requirements, and production cutover. Record the document version/date and PDAX technical owner.
2. **Confirm the commercial/compliance model.** Obtain written approval for SaloMed's use case, end-user KYC allocation, omnibus versus per-user accounts, allowed GCash/InstaPay wording, limits, fees, refunds/chargebacks, safeguarding, Travel Rule handling, and use of partner branding. PDAX's public terms make API scope agreement-specific, and its public Travel Rule guidance requires additional party information for crypto transfers worth at least PHP 50,000. [PDAX Terms](https://pdax.ph/rule/terms-and-conditions/), [PDAX Travel Rule guidance](https://support.pdax.ph/support/solutions/articles/1060000097159-what-is-travel-rule-)
3. **Separate runtime modes:** `DEMO`, `PDAX_UAT`, `PDAX_PROD`. In UAT/production, provider failure returns a pending/error state and never creates demo value. Demo responses and UI must remain visibly labelled simulated.
4. **Implement a durable double-entry ledger and state machine.** Persist the expected user, amount, currency, provider reference, provider event ID, quote/order/withdrawal IDs, fees, executed amount/rate, Stellar hash, contract transaction, timestamps, and reconciliation status.
5. **Make every boundary idempotent.** Use PDAX's documented idempotency mechanism and a unique local request key. Enforce unique provider event IDs and references transactionally. Replayed webhooks must return 2xx without repeating side effects.
6. **Fail closed on webhooks.** Require the exact documented signature algorithm and headers in UAT/production; verify timestamp/replay window if supplied; validate payload schema; load expected details from the database; compare amount/currency/account; enqueue work; acknowledge only after durable acceptance.
7. **Implement and reconcile actual settlement.** Either execute quote/order/withdrawal through PDAX or document the approved prefunded-reserve mechanism. Credit the user only according to the chosen finality rule, and reconcile PDAX balances, Stellar settlement, and contract liabilities.
8. **Use separate typed rate services.** `XLMPHP` and `USDCXLMPHP` need distinct symbols, caches, freshness timestamps, and source labels. Credits must use the executed rate/net amount after fees, not a UI indicative rate.
9. **Prove asset/network identity.** Production settlement must use Stellar public network and the exact USDC issuer/contract configured by the SaloMed contract. Keep testnet and production addresses/assets impossible to mix through environment validation.
10. **Add failure-path tests before UAT sign-off.** Cover duplicate/out-of-order webhooks, wrong signature, missing secret, amount/currency mismatch, timeout after provider acceptance, expired quote, partial/rejected order, withdrawal delay/failure, wrong network, contract failure, process restart, and reconciliation mismatch.

## Demo-mode conclusion

The app can continue to function as a **simulation** without PDAX credentials because it deliberately falls back to an admin-funded testnet invocation or an in-memory demo ledger. That is useful for judging navigation and user comprehension. It is not evidence that money moved from GCash/InstaPay through PDAX to Stellar.

For a trustworthy demo, make the mode explicit at startup and in every transaction response, never label fallback data as live, prevent unsigned webhooks even in any internet-accessible environment, and reset/demo-seed state deliberately. For real money, all production gates above are blockers.

## Items that cannot be verified without PDAX private/NDA documentation

- UAT and production base URLs and connectivity constraints
- Credential type and onboarding procedure
- Login, token, refresh, header, expiry, and revocation schema
- mTLS, request signing, IP allowlisting, secret rotation, and rate limits
- Exact price, firm-quote, order/accept, order-status, and balance endpoints/fields
- Exact fiat deposit/withdrawal endpoints, bank/channel codes, fees, limits, and response fields
- Whether a checkout URL is returned and whether arbitrary metadata is echoed in webhooks
- Crypto deposit-address and crypto-withdrawal endpoints, asset codes, memo handling, and test-network behavior
- Webhook event names, nesting, statuses, retry schedule, event IDs, ordering, signature headers/algorithm, and replay controls
- Idempotency headers/keys and provider-side duplicate semantics
- UAT test identities, simulated InstaPay behavior, supported UAT banks, and whether UAT emits callbacks
- Approved partner/omnibus KYC, Travel Rule, reconciliation, safeguarding, and production settlement model

Until SaloMed's PDAX-issued documents answer these points and UAT evidence is captured, the safest audit label for `pdax_service.py` is **prototype adapter with speculative schemas**, not a verified Institutional API integration.
