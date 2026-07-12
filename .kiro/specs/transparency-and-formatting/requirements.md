# Requirements: Transparency Labels and Currency Formatting

## Introduction

This feature cleans up how SaloMed presents itself to demo viewers and hackathon
judges. It has three goals that reinforce the product's core promise of
**transparency**:

1. Remove the loud "pilot environment / test funds / SaloMed ledger" labeling
   that currently frames the app as a throwaway sandbox.
2. Ensure every transaction remains **verifiable on the Stellar network** (a
   real, clickable on-chain reference), because transparency is a headline
   selling point of the product.
3. Standardize all monetary values (PHP, USDC, XLM) to a maximum of **2 decimal
   places** across the entire UI.

### Key design decision (resolved)

The app currently defaults to `demo` mode, which writes transactions to an
off-chain SQLite ledger with identifiers like `DEMO-A1B2C3...`. These
identifiers **do not resolve on Stellar Explorer**, so they are not truly
trackable on-chain. Removing "test funds" labels while keeping non-resolvable
IDs would imply on-chain settlement that is not happening, which contradicts the
transparency promise.

The confirmed direction is that the presented experience uses **real on-chain
Stellar transactions only** (testnet by default, mainnet when configured), so
every reference resolves on Stellar Explorer and inside SaloMed's own history.

The app already contains a fully working `stellar_testnet` mode where:
- Transactions are real Soroban contract calls signed via Freighter.
- Transaction IDs are real `txHash` values.
- `VaultCard.tsx` already renders "Explorer" and "View smart contract on Stellar
  Expert" links.

**Resolution (confirmed):** Every transaction shown in SaloMed SHALL be a real
on-chain Stellar transaction. There are no off-chain / fake `DEMO-...` records in
the presented experience. Whether the transaction was made on **testnet** or
**mainnet**, it SHALL be:
- Trackable inside SaloMed's own transaction history, and
- Trackable on the public Stellar network (Stellar Explorer), via a clickable
  reference, and
- Visibly labeled with a clear network distinction badge (Testnet vs Mainnet).

## Requirements

### Requirement 1: Remove sandbox / pilot / test-funds labeling

**User Story:** As a judge viewing SaloMed, I want the app to present as a real,
production-quality product, so that I judge it on its actual capabilities rather
than perceiving it as a throwaway sandbox.

#### Acceptance Criteria

1. WHEN any screen renders THEN the UI SHALL NOT display the strings "PILOT
   ENVIRONMENT", "TEST FUNDS", "SALOMED LEDGER", "Pilot ledger", "Pilot
   reference", "Off-chain pilot ledger", or equivalent sandbox framing.
2. WHEN onboarding slides render THEN their copy SHALL describe the product's
   real value without "pilot environment" / "test funds" framing.
3. WHEN the translations file is updated THEN all three locales (en default, en,
   tl) SHALL be updated consistently so no locale retains removed labels.
4. WHEN sandbox labels are removed THEN the change SHALL NOT introduce any claim
   that is factually false about how the transaction was settled (see
   Requirement 2).

### Requirement 2: Every transaction is real and verifiable on Stellar

**User Story:** As a user or judge, I want to click any transaction and see it on
the public Stellar ledger, so that I can independently verify SaloMed actually
recorded the payment on-chain and trust its transparency claim.

#### Acceptance Criteria

1. WHEN any transaction is created in the presented experience THEN it SHALL be a
   real on-chain Stellar transaction with a genuine transaction hash.
2. WHEN a transaction is displayed in SaloMed's history THEN it SHALL expose a
   clickable reference that resolves on Stellar Explorer for the correct network
   (`https://stellar.expert/explorer/testnet/tx/<txHash>` for testnet,
   `https://stellar.expert/explorer/public/tx/<txHash>` for mainnet).
3. WHEN a transaction hash is rendered THEN it SHALL be a clickable link, not
   plain unclickable text, and it SHALL open the Stellar Explorer entry.
4. WHEN a transaction is displayed THEN the UI SHALL show a clear network
   distinction badge indicating whether it was made on Testnet or Mainnet.
5. THE UI SHALL NOT present any internal `DEMO-...` style identifier as if it
   were an on-chain hash; such off-chain-only references SHALL NOT appear in the
   presented experience.
6. WHEN a transaction is trackable THEN it SHALL be trackable in BOTH places
   consistently: SaloMed's own history view AND the public Stellar network, and
   the two SHALL reference the same underlying transaction hash.
7. THE distinction between Testnet and Mainnet SHALL be visually clear but SHALL
   NOT frame Testnet transactions as "fake" or "test funds"; both are presented
   as legitimate on-chain activity, differing only by network.

### Requirement 3: Two-decimal currency formatting everywhere

**User Story:** As a non-technical Filipino user, I want to see clean amounts like
"₱1,250.00" and "22.32 USDC" instead of long 7-decimal crypto numbers, so that
the app feels like a familiar everyday finance app.

#### Acceptance Criteria

1. WHEN any PHP amount is displayed THEN it SHALL show exactly 2 decimal places.
2. WHEN any USDC amount is displayed THEN it SHALL show at most 2 decimal places.
3. WHEN any XLM amount is displayed THEN it SHALL show at most 2 decimal places.
4. WHEN amounts are used for on-chain precision (stroops conversion, contract
   call arguments, idempotency keys) THEN full 7-decimal precision SHALL be
   preserved internally; only the *displayed* value is limited to 2 decimals.
5. WHEN a "Platform fee" or zero value is displayed THEN it SHALL follow the same
   2-decimal rule (e.g. "0.00 USDC", not "0.0000000 USDC").
6. THE 2-decimal display rule SHALL be applied consistently via a shared helper
   rather than scattered ad-hoc `toFixed` calls, to prevent regressions.

## Out of Scope

- Actively enabling live real-money / mainnet settlement for this hackathon
  demo. Testnet is the default. Mainnet support is limited to correct labeling
  and correct explorer links IF a mainnet transaction ever occurs; we are not
  turning on production money movement here.
- Changing the vault lock rules, SaloPoints math, or loan logic.
- Removing or wiring in the OCR bill-scanning feature (parked separately).
- Backend ledger schema changes (internal precision stays 7 decimals / stroops).

## Constraints and Brand Rules

- Blue and white dominant UI. Green only for success, amber only for warnings.
- No em dashes in user-facing copy.
- Internal precision (stroops, contract args) must never be truncated to 2
  decimals; only presentation changes.
- Backend still validates and stores amounts at 7-decimal asset precision.
