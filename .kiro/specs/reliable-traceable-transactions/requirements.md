# Requirements Document

## Introduction

The SaloMed application has regressed to a state where users can no longer complete any top-up, whether through GCash, InstaPay, or a Freighter wallet XLM deposit. This feature restores and hardens every money movement in the app so that all transactions reliably complete end to end and are fully traceable on the Stellar network.

The scope covers three top-up methods (GCash simulated on-ramp, InstaPay/PDAX simulated on-ramp, and Freighter wallet XLM deposit), hospital payments (pay_hospital), and remittance/padala (transfer_vault). Fiat on-ramps may be simulated because no real money is used, but every vault-affecting transaction must still settle on-chain in Stellar with a real, verifiable transaction hash. The transaction history must record the method behind each top-up, remain append-only, follow the Stellar address across devices, and survive page reloads along with the vault balance. User-facing currencies are Philippine Peso (PHP) and XLM, converted at the live PDAX rate, while the on-chain settlement asset is always native XLM. Every transaction row must offer a "Verify on Stellar" link that resolves to the correct network explorer, distinguishing testnet from mainnet.

This work is a logic and reliability effort only; the existing UI is not to be redesigned. User-facing labels must never expose the words "simulated", "fake", "mock", or "demo".

## Glossary

- **Vault**: The on-chain balance record for a user held by the SaloMed Soroban contract, denominated and settled in native XLM.
- **SaloMed_System**: The overall application comprising the Next.js frontend, the FastAPI backend, and the Soroban smart contract.
- **Topup_Service**: The backend component that receives top-up requests and credits the vault (via the admin bridge for fiat on-ramps).
- **Admin_Bridge**: The backend component (stellar_bridge) where the admin account signs deposit_remittance to credit a user vault on-chain.
- **Freighter_Wallet**: The user's browser wallet used to sign Stellar transactions.
- **GCash_Method**: The GCash simulated fiat on-ramp top-up method.
- **InstaPay_Method**: The InstaPay/PDAX simulated fiat on-ramp top-up method.
- **Freighter_Method**: The Freighter wallet XLM deposit top-up method.
- **Payment_Service**: The flow that performs a hospital payment (pay_hospital / contractPayment).
- **Remittance_Service**: The flow that performs a padala/remittance transfer (transfer_vault / contractVaultTransfer).
- **History_Store**: The address-keyed, append-only backend index of transactions (backend/history_store.py).
- **Transaction_Method_Label**: The user-facing label describing a top-up source: "Top-up via GCash", "Top-up via InstaPay", or "Top-up via Freighter Wallet".
- **Stellar_Network**: The active Stellar network, either testnet or mainnet.
- **Transaction_Hash**: The real Stellar ledger transaction identifier for a settled on-chain operation.
- **Verify_On_Stellar_Link**: A link to stellar.expert (or an equivalent explorer) that resolves a Transaction_Hash on the correct Stellar_Network.
- **PDAX_Rate**: The live PHP-to-XLM conversion rate sourced from PDAX.
- **PHP**: Philippine Peso, a user-facing display currency.
- **XLM**: Stellar Lumens, the on-chain settlement asset and a user-facing display currency.

## Requirements

### Requirement 1: GCash Top-up Reliability

**User Story:** As a SaloMed user, I want to top up my vault through GCash, so that I can add funds using a familiar Philippine payment method.

#### Acceptance Criteria

1. WHEN a user submits a GCash top-up with a valid PHP amount, THE Topup_Service SHALL credit the user vault on-chain through the Admin_Bridge and return a success result that includes the real Transaction_Hash.
2. WHEN a GCash top-up completes successfully, THE SaloMed_System SHALL increase the displayed vault balance by the credited amount.
3. IF the Admin_Bridge fails to settle a GCash top-up on-chain, THEN THE Topup_Service SHALL return a descriptive error and SHALL leave the vault balance unchanged.
4. WHEN the same GCash top-up request is submitted more than once with an identical idempotency key, THE Topup_Service SHALL credit the vault only one time.

### Requirement 2: InstaPay Top-up Reliability

**User Story:** As a SaloMed user, I want to top up my vault through InstaPay, so that I can add funds using the PDAX on-ramp.

#### Acceptance Criteria

1. WHEN a user submits an InstaPay top-up with a valid PHP amount, THE Topup_Service SHALL credit the user vault on-chain through the Admin_Bridge and return a success result that includes the real Transaction_Hash.
2. WHEN an InstaPay top-up completes successfully, THE SaloMed_System SHALL increase the displayed vault balance by the credited amount.
3. IF the Admin_Bridge fails to settle an InstaPay top-up on-chain, THEN THE Topup_Service SHALL return a descriptive error and SHALL leave the vault balance unchanged.
4. WHEN the same InstaPay top-up request is submitted more than once with an identical idempotency key, THE Topup_Service SHALL credit the vault only one time.

### Requirement 3: Freighter Wallet XLM Top-up Reliability

**User Story:** As a SaloMed user, I want to top up my vault by depositing XLM from my Freighter wallet, so that I can fund my vault directly from my own Stellar holdings.

#### Acceptance Criteria

1. WHEN a user submits a Freighter wallet XLM top-up with a valid amount, THE SaloMed_System SHALL complete the deposit end to end and credit the user vault on-chain.
2. WHEN a Freighter wallet top-up settles on-chain, THE SaloMed_System SHALL record the real Transaction_Hash returned by the Stellar_Network.
3. WHEN a Freighter wallet top-up completes successfully, THE SaloMed_System SHALL increase the displayed vault balance by the deposited amount.
4. IF the Freighter wallet top-up transaction fails to settle on-chain, THEN THE SaloMed_System SHALL return a descriptive error and SHALL leave the vault balance unchanged.

### Requirement 4: Top-up Method Labeling in History

**User Story:** As a SaloMed user, I want each top-up in my history to show which method I used, so that I can tell my GCash, InstaPay, and Freighter deposits apart.

#### Acceptance Criteria

1. WHEN a top-up is recorded, THE History_Store SHALL persist the top-up method as a field on the transaction record.
2. WHERE a recorded top-up used GCash_Method, THE SaloMed_System SHALL display the Transaction_Method_Label "Top-up via GCash".
3. WHERE a recorded top-up used InstaPay_Method, THE SaloMed_System SHALL display the Transaction_Method_Label "Top-up via InstaPay".
4. WHERE a recorded top-up used Freighter_Method, THE SaloMed_System SHALL display the Transaction_Method_Label "Top-up via Freighter Wallet".
5. THE SaloMed_System SHALL NOT display the words "simulated", "fake", "mock", or "demo" in any Transaction_Method_Label.

### Requirement 5: Hospital Payment Reliability and Traceability

**User Story:** As a SaloMed user, I want to pay a hospital from my vault, so that I can settle medical bills reliably and verifiably.

#### Acceptance Criteria

1. WHEN a user confirms a hospital payment with sufficient vault balance, THE Payment_Service SHALL execute pay_hospital on-chain and settle the payment in native XLM.
2. WHEN a hospital payment settles on-chain, THE SaloMed_System SHALL record the transaction in the History_Store with the real Transaction_Hash.
3. WHEN a hospital payment completes successfully, THE SaloMed_System SHALL decrease the displayed vault balance by the paid amount.
4. IF a hospital payment fails to settle on-chain, THEN THE Payment_Service SHALL return a descriptive error and SHALL leave the vault balance unchanged.

### Requirement 6: Remittance/Padala Reliability and Traceability

**User Story:** As a SaloMed user, I want to send a padala from my vault to another user, so that I can transfer funds reliably and verifiably.

#### Acceptance Criteria

1. WHEN a user confirms a padala with sufficient vault balance, THE Remittance_Service SHALL execute transfer_vault on-chain and settle the transfer in native XLM.
2. WHEN a padala settles on-chain, THE SaloMed_System SHALL record the transaction in the History_Store with the real Transaction_Hash.
3. WHEN a padala completes successfully, THE SaloMed_System SHALL decrease the sender displayed vault balance by the transferred amount.
4. IF a padala fails to settle on-chain, THEN THE Remittance_Service SHALL return a descriptive error and SHALL leave the sender vault balance unchanged.

### Requirement 7: Real On-Chain Settlement for Vault-Affecting Transactions

**User Story:** As a SaloMed user, I want every transaction that changes my vault to be a real on-chain Stellar transaction, so that I can trust that my balance reflects verifiable ledger activity.

#### Acceptance Criteria

1. WHEN any vault-affecting transaction is recorded, THE SaloMed_System SHALL associate a real Transaction_Hash obtained from the Stellar_Network.
2. IF a vault-affecting transaction has no real Transaction_Hash from the Stellar_Network, THEN THE SaloMed_System SHALL reject the transaction and SHALL NOT change the vault balance.
3. WHEN a fiat on-ramp top-up is processed, THE Admin_Bridge SHALL produce a real on-chain vault credit settled in native XLM.
4. THE SaloMed_System SHALL settle every vault-affecting transaction in native XLM regardless of the PHP, USDC, or XLM value shown to the user.

### Requirement 8: Verify on Stellar Links with Network Distinction

**User Story:** As a SaloMed user, I want a verify link on every transaction, so that I can independently confirm it on the Stellar explorer and know which network it settled on.

#### Acceptance Criteria

1. WHERE a transaction row has a real Transaction_Hash, THE SaloMed_System SHALL expose a Verify_On_Stellar_Link for that row.
2. WHEN a transaction settled on testnet, THE Verify_On_Stellar_Link SHALL resolve the Transaction_Hash on the testnet explorer.
3. WHEN a transaction settled on mainnet, THE Verify_On_Stellar_Link SHALL resolve the Transaction_Hash on the mainnet explorer.
4. THE SaloMed_System SHALL display for each transaction row an indicator of whether the transaction settled on testnet or mainnet.

### Requirement 9: Append-Only, Address-Keyed, Persistent History

**User Story:** As a SaloMed user, I want my transaction history to persist and follow my Stellar address, so that I never lose records across devices or page reloads.

#### Acceptance Criteria

1. WHEN a transaction is recorded, THE History_Store SHALL append a new entry and SHALL NOT overwrite or delete any existing entry.
2. WHEN a user opens the app on any device with the same Stellar address, THE SaloMed_System SHALL return the complete transaction history keyed to that address.
3. WHEN the page is reloaded, THE SaloMed_System SHALL restore the full transaction history for the active Stellar address.
4. WHEN the page is reloaded, THE SaloMed_System SHALL restore the current vault balance for the active Stellar address.

### Requirement 10: Live PHP and XLM Conversion

**User Story:** As a SaloMed user, I want PHP and XLM amounts converted at the live market rate, so that displayed values reflect real exchange rates rather than a flat assumption.

#### Acceptance Criteria

1. WHEN converting between PHP and XLM, THE SaloMed_System SHALL use the live PDAX_Rate.
2. THE SaloMed_System SHALL NOT convert PHP and XLM using a fixed one-to-one rate.
3. IF the live PDAX_Rate cannot be retrieved, THEN THE SaloMed_System SHALL return a descriptive error and SHALL NOT complete a conversion using a fallback fixed rate.

### Requirement 11: Insufficient Balance Guard

**User Story:** As a SaloMed user, I want the app to block a payment I cannot afford before my wallet opens, so that my vault never goes negative and I am not asked to sign a doomed transaction.

#### Acceptance Criteria

1. IF a requested payment or padala amount exceeds the available vault balance, THEN THE SaloMed_System SHALL block the transaction before Freighter_Wallet opens for signing.
2. WHEN a payment or padala is blocked for insufficient balance, THE SaloMed_System SHALL display a descriptive message stating the balance is insufficient.
3. THE SaloMed_System SHALL keep the vault balance greater than or equal to zero after every transaction.

### Requirement 12: Regression Guardrail Across Flows

**User Story:** As a SaloMed maintainer, I want changes to one flow to leave the others intact, so that fixing one top-up method does not silently break another transaction path.

#### Acceptance Criteria

1. WHEN one top-up method is changed, THE SaloMed_System SHALL keep GCash_Method, InstaPay_Method, and Freighter_Method available and functional.
2. WHEN any top-up flow is changed, THE SaloMed_System SHALL keep Payment_Service and Remittance_Service functional.
3. THE SaloMed_System SHALL provide automated tests that cover all three top-up methods, hospital payment, and padala so that a regression in any one flow is detected.
