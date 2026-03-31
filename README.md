# LusogChain

> **Every receipt, permanently verified.**
> 
> **Live Demo:** [https://wolfsenberg.github.io/LUSOGCHAIN/frontend/](https://wolfsenberg.github.io/LUSOGCHAIN/frontend/)

## What is LusogChain?
**LusogChain** is a decentralized hospital billing system built on the Stellar network. It transforms traditional hospital bills into immutable on-chain records. By bringing medical receipts onto the blockchain, LusogChain ensures that every payment is **auditable, permanent, and tamper-proof**.

## Purpose
In traditional healthcare settings (especially locally with PhilHealth or HMOs), dealing with misplaced physical receipts, reconciliation errors, and billing disputes can be a frustrating and slow process. 

LusogChain aims to eliminate these friction points by:
- Providing a **transparent ledger** for hospital billings.
- Giving patients **instant proof of payment**.
- Helping hospitals maintain an automated and verifiable history of all services rendered, eliminating the reliance on centralized systems that are prone to data loss or tampering.

## Key Features
- **Instant Finality:** Payments and billing records are processed and settled on the network in less than a few seconds.
- **100% Auditable:** All billing histories are verifiable and transparent.
- **Self-Custodial Payments:** Users pay directly using their own crypto wallets—no hidden fees, no middlemen.
- **Service Categorization:** Supports robust categorization for `Consultation`, `Laboratory`, `Pharmacy`, `Imaging`, and `Emergency` cases.

---

## Tech Stack & Key Components

LusogChain is divided into a modern, lightweight web interface and a secure on-chain backend.

### Frontend
- **Vanilla HTML / CSS / JS:** A responsive, cleanly styled frontend with zero heavy framework bloat. It features modern UI/UX principles like glassmorphism and micro-animations.
- **Stellar SDK:** Handles communication between the frontend and the Stellar network (Horizon & Soroban RPC testnet nodes) for fetching balances and reading chain state.
- **Freighter Wallet API (`@stellar/freighter-api`):** The bridge that connects the user's browser extension to the webapp, allowing for secure authentication and transaction signing without exposing private keys.

### Backend (Smart Contracts)
- **Rust:** The language used to write the highly-performant, memory-safe smart contract.
- **Soroban Environment:** The smart contract framework native to Stellar used to define the core data structures (`BillingRecord`, `ServiceType`) and logic (`create_billing`, `pay_bill`, `get_stats`).

---

## How Stellar Powers LusogChain

LusogChain heavily utilizes the Stellar ecosystem to deliver a seamless Web3 experience:

1. **Soroban:** The backbone of the application's logic. Our custom `LusogContract` is deployed via Soroban. It securely tracks global states such as total bills generated, total XLM paid, and links patient/hospital addresses to specific records.
2. **Freighter Wallet:** The primary wallet used for the application. Patients and admins use Freighter to connect to the app, approve billing creation, and sign payment transactions safely.
3. **Stellar Testnet:** We use the Soroban RPC Testnet and Horizon Testnet to simulate real-world usage and validate transactions before they hit the mainnet.
4. **XLM (Lumens):** Native XLM is used as the medium of exchange to handle the payment logic for bills in the current iteration.

---

## Project Structure
```text
LUSOGCHAIN/
├── contracts/
│   └── lusog_chain/
│       ├── src/
│       │   ├── lib.rs     # Core Soroban smart contract logic
│       │   └── tests.rs   # Contract unit tests
│       └── Cargo.toml     # Rust dependencies
└── frontend/
    └── index.html         # Main web application interface
```