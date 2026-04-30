# SaloMed: Your Health Alkansya (Health Piggy Bank)

[![SaloMed CI/CD Pipeline](https://github.com/wolfsenberg/SaloMed/actions/workflows/ci.yml/badge.svg)](https://github.com/wolfsenberg/SaloMed/actions/workflows/ci.yml)
[![Stellar Network](https://img.shields.io/badge/Stellar-Testnet-blue)](https://stellar.expert/explorer/testnet)

## Roadmap and Requirements Checklist

| Level | Status | Features Implemented |
| :--- | :---: | :--- |
| **Level 1** | Done | Freighter Wallet Setup, Testnet, Balance Fetching, XLM Transactions. |
| **Level 2** | Done | Soroban Contract Deployed, Frontend Integration, 3+ Error Types Handled, TX Visibility. |
| **Level 3** | Done | Mini-dApp fully functional, Minimum 3 tests passing, Demo video recorded. |
| **Level 4** | Done | Inter-contract calls, Custom token mechanics, Advanced event streaming, CI/CD pipeline. |
| **Level 5** | Done | MVP fully functional, User feedback collected, Improvement phase documented. |

---

> ### The Problem: Ang sakit na nga, mas masakit pa sa bulsa (It is already painful, but it is even more painful for the wallet).
>
> For many Filipinos, saving up for emergencies is a major goal. However, the reality of having an easily accessible emergency fund is that temptation is always just a few taps away. It's incredibly easy to justify a sudden online purchase, an impromptu dinner out, or a gadget upgrade.
>
> Before you know it, the savings start getting chipped away. The real problem hits when a sudden medical emergency arises. Because the funds have been spent, there is no money left for hospital bills or expensive prescriptions. The inevitable ending? People resort to borrowing. **Napipilitan tayong mangutang (We are forced to borrow money).** It leads to high-interest debt, adding massive emotional and financial stress to the family.
>
> This issue extends to remittances as well. When a family member sends money specifically for healthcare: whether it's an OFW abroad or an older sibling working in Manila: there is always the lingering fear of funds being misspent. **Pampa-checkup sana, pero nabili ng luho (It was intended for a medical checkup, but it was spent on luxuries).** The sender has no guarantee that the money was actually used for medicine.

---

### The Solution: Enter SaloMed: Your Health Alkansya (Health Piggy Bank)

<img width="6400" height="2400" alt="salomed_banner" src="https://github.com/user-attachments/assets/aef0d074-76c7-4bd5-82eb-9bedeb4f9ac4" />

**Desktop:** <img width="1920" height="1080" alt="image" src="https://github.com/user-attachments/assets/fbe9fcbb-b6bb-489b-bd24-fe48efeb71ba" />

**Mobile:** <img width="391" height="851" alt="image" src="https://github.com/user-attachments/assets/58b71aa2-e726-4df4-a780-c90721baf64b" />

SaloMed is a purpose-built digital health alkansya (piggy bank). It functions just like the e-wallets we use every single day, but with one massive difference: the money you put in here is strictly locked and can only be spent on healthcare.

Think of it as the ultimate discipline tool for your health savings. We give you a super familiar, frictionless e-wallet experience, but quietly empower it with an unbreakable layer of smart contracts running on the Stellar Network.

**Live App:** [https://salomedhealthalkansya.vercel.app/](https://salomedhealthalkansya.vercel.app/)

**Video Demo:** [Google Drive](https://drive.google.com/file/d/1FdqfCqWRw6hjVrcqbt7UpLAgSdgnlXAR/view?usp=sharing)

**Pitch Document:** [Google Docs](https://docs.google.com/document/d/134i9LdSE-X0jaV2Nr0X9SSptM7tY4yRtdCkYO2t2260/edit?usp=sharing)

---

### Table of Contents
*   [Key Features](#key-features)
*   [The Vision](#the-vision)
*   [Tech Stack](#tech-stack)
*   [Smart Contract](#smart-contract)
*   [How Stellar Powers SaloMed](#how-stellar-powers-salomed)
*   [Architecture and Structure](#architecture-and-structure)
*   [CI/CD Pipeline](#cicd-pipeline)
*   [Requirements Detail](#requirements-detail)
*   [User Feedback and Improvement Phase](#user-feedback-and-improvement-phase)
*   [Demo Flow](#demo-flow)
*   [Escrow Lifecycle](#escrow-lifecycle)
*   [Setup](#setup)

---

## Key Features

### 1. Purpose-Bound Savings (The "Lock" Feature)
When you fund your SaloMed Vault, that money is secured and untouchable for casual spending. You cannot withdraw it to buy concert tickets or go shopping. It can exclusively be transacted at whitelisted partner hospitals, clinics, and pharmacies.

### 2. Familiarity and "Zero-Crypto Anxiety"
*   **Recognizable Funding**: Top up via familiar e-wallet flows (GCash Bridge).
*   **Scan-to-Pay**: Point-of-care QR payments just like your daily finance apps.
*   **Local Currency Display**: Dynamic toggle between PHP and XLM for better accessibility.

### 3. The Ultimate "Health Pasaload" (Global Padala)
Remit funds directly to a loved one's SaloMed Vault. Because the remittance is Purpose-Bound, you are 100% certain it will only be spent at a hospital or pharmacy, providing guaranteed transparency for senders worldwide.

---

## The Vision: Why Philippines? Why Now?
SaloMed acts as a self-funded, community-backed insurance layer for the millions of Filipinos who are "one illness away from poverty." We turn digital currency into **purposeful capital**, helping families build generational wealth rather than generational debt.

---

## Tech Stack
*   **Blockchain**: Stellar Soroban (Smart Contracts)
*   **Smart Contract**: Rust + soroban-sdk
*   **Frontend**: Next.js 14 (App Router), Tailwind CSS, Framer Motion
*   **Backend**: FastAPI (Python 3.11)
*   **Wallet**: Freighter Wallet (Stellar Testnet)

---

## Smart Contract

**Contract ID (Testnet):** `CAO3K6OYB5A3VNVV3HKCSVG3ZZ442DZCDKAXG4CTSLBTN7FOYCCBRZ34`
<img width="1414" height="487" alt="image" src="https://github.com/user-attachments/assets/7b5a8c23-655e-416c-bcdd-4257eb51e921" />
<img width="1307" height="230" alt="image" src="https://github.com/user-attachments/assets/748ab0e7-009a-440a-a540-08217ce77323" />
<img width="1908" height="965" alt="image" src="https://github.com/user-attachments/assets/33a14e08-06a7-466d-9e0d-b2ffa26d5305" />
<img width="1920" height="1080" alt="image" src="https://github.com/user-attachments/assets/f984403f-bcf8-4e7c-bfe3-377243f69e60" />


| Function | Description |
|---|---|
| initialize | Setup admin and token addresses |
| deposit_remittance | Remittance top-up for a beneficiary vault |
| pay_hospital | Inter-contract call to native XLM for atomic settlement |
| get_vault | Fetch balance, SaloPoints, and credit tier |
| whitelist_hospital | Admin: Add authorized medical providers |

---

## How Stellar Powers SaloMed
*   **Automated Financial Discipline**: Soroban smart contracts act as an immutable guardian of health funds.
*   **Atomic Settlement**: Multi-party settlement ensuring funds only leave the vault when care is provided.
*   **Hyper-Scalability**: Transactions settle in seconds with near-zero micro-fees.

---

## Architecture and Structure
SaloMed follows a high-resiliency Hybrid Sync Architecture:
1. **Frontend**: Directly queries Horizon RPC for real-time accuracy.
2. **Backend**: GCash Bridge logic using SALOMED_SIGNER_SECRET.
3. **Auto-Sync Engine**: Dual-layer sync (Event-driven and 20s Polling).

---

## CI/CD Pipeline
SaloMed uses a robust CI/CD Pipeline via GitHub Actions to maintain code quality and ensure continuous delivery:
*   **Continuous Integration (CI)**: Automatically runs Smart Contract tests (cargo test), Frontend validation (Next.js build), and Dependency audits on every push.
*   **Continuous Deployment (CD)**: Upon passing all tests, the app is automatically deployed to Vercel (Frontend) and Render (Backend).

---

## Requirements Detail

### Level 3: Mini-dApp Evidence
SaloMed is a fully functional mini-dApp. The following primary tests have passed in our smart contract:
1.  `test_initialize`: Verified the correct admin and token authority setup.
2.  `test_deposit_remittance`: Ensures funds are locked in the correct beneficiary vault.
3.  `test_pay_hospital`: Examines the atomic flow from vault to hospital provider.

### Level 4: Advanced Features
*   **Inter-contract Calls**: Our contract directly interacts with the Stellar Token Contract for atomic fund transfers.
*   **Custom Token Mechanics**: The system is designed to accept custom Stellar Asset Contracts (SAC) for medical-specific tokens or liquidity pools in the future.
*   **Advanced Event Streaming**: The frontend uses a real-time sync engine that updates balance and history whenever blockchain events or ledger closes are detected.
*   **CI/CD Pipeline**: GitHub Actions are set up for automated testing and build validation on every push.

---

### Level 5: 
### Verified Testnet Users

The wallets listed below were used for testing on the Stellar Testnet by actual test participants. Each address includes a direct link to its transaction history on Stellar Expert for transparency and verification purposes.

For additional context, including feedback and responses from participants, you may refer to the **View User Responses Spreadsheet**:
https://docs.google.com/spreadsheets/d/1cGYpwIF1pgURlQtQvbi-ag1oKH0ZTKydAowQtGC0uus/edit?usp=sharing

| # | Wallet Address | Transaction History |
|---|----------------|---------------------|
| 1 | GAXXWLECCE644QVYLKRHCDWDH5V7KMYG3GZEDPEB7C7LIQFPQ43ZBFEK | https://stellar.expert/explorer/testnet/account/GAXXWLECCE644QVYLKRHCDWDH5V7KMYG3GZEDPEB7C7LIQFPQ43ZBFEK |
| 2 | GCOHD2WKIEY4IP7AIWBIMAID2RFJ4E7ZXSM446EJWN46IBHFYTWQIGCJ | https://stellar.expert/explorer/testnet/account/GCOHD2WKIEY4IP7AIWBIMAID2RFJ4E7ZXSM446EJWN46IBHFYTWQIGCJ |
| 3 | GCQB4OZ6JLHYH2NQ3FJPKVMJYEOHTY3QOPOECAQUSJRA4NXPM2UPZK45 | https://stellar.expert/explorer/testnet/account/GCQB4OZ6JLHYH2NQ3FJPKVMJYEOHTY3QOPOECAQUSJRA4NXPM2UPZK45 |
| 4 | GA64LSYL4ZXZW2DK2IF3PNCLALBVMJXVZV564ZWZZ2HGHOAHLV2PID5I | https://stellar.expert/explorer/testnet/account/GA64LSYL4ZXZW2DK2IF3PNCLALBVMJXVZV564ZWZZ2HGHOAHLV2PID5I |
| 5 | GAMRXQHGLNFRF56AZSVYMGOTVRR4ULHBLSMWDGZHA3LDAMMSAR7JVCMI | https://stellar.expert/explorer/testnet/account/GAMRXQHGLNFRF56AZSVYMGOTVRR4ULHBLSMWDGZHA3LDAMMSAR7JVCMI |
| 6 | GDCRVS4UDJUP6SSPJRBIMSDBWP36FQ2FUZCHJNHEEF4VUGYXJVJTHMUV | https://stellar.expert/explorer/testnet/account/GDCRVS4UDJUP6SSPJRBIMSDBWP36FQ2FUZCHJNHEEF4VUGYXJVJTHMUV |
| 7 | GB3QTR4K5ODWG3JZZEYCSUTUB6FQKX3HV4CN7RC56FQJ72URT6LLUG66 | https://stellar.expert/explorer/testnet/account/GB3QTR4K5ODWG3JZZEYCSUTUB6FQKX3HV4CN7RC56FQJ72URT6LLUG66 |
| 8 | GDATP732EK2T67IYNUVY5WFSO2QFZGR52OVKE5CNXMQB55RVEHMUJKTB | https://stellar.expert/explorer/testnet/account/GDATP732EK2T67IYNUVY5WFSO2QFZGR52OVKE5CNXMQB55RVEHMUJKTB |

---

### User Feedback and Improvement Phase

We collected feedback from 8 initial test users to satisfy the Level 5 requirement. Overall feedback was highly positive, with most users rating the concept **5/5**, highlighting strong usability and clear value in the system.

**Feedback Data Analysis**: https://docs.google.com/spreadsheets/d/1cGYpwIF1pgURlQtQvbi-ag1oKH0ZTKydAowQtGC0uus/edit?usp=sharing

Improvements Based on Real User Feedback

Based on the collected responses, the following improvements have been identified and prioritized for the next development phase:

1. **Core Feature Bug Fixes**  
   One user reported synchronization issues between the Savings module and SaloPoints. We are currently debugging the smart contract state retrieval logic to ensure consistent data updates across modules.

2. **Mobile View Optimization**  
   Users noted that the mobile experience and responsive layout need improvement. We will refine CSS responsiveness and improve UI transitions for smoother navigation across devices.

3. **Performance and Speed Optimization**  
   Some users requested faster loading times. We plan to implement server-side rendering (SSR), asset optimization, and compression techniques to improve overall performance.

---

### Latest Improvement Commit

Implemented Transaction Toast Notifications and Currency Toggle feature:
https://github.com/wolfsenberg/SaloMed/commit/b6636f6

---

## Demo Flow
1.  **Onboarding and Connection**: Connect your Freighter Wallet and explore the "Health Alkansya" concept.
2.  **The Top-Up**: Fund your vault via XLM/USDC or our GCash Bridge simulation.
3.  **Provider Verification**: Select a whitelisted hospital. SaloMed verifies the address before any transaction.
4.  **Atomic Payment**: Confirm payment. The smart contract ensures funds are only released to whitelisted providers.
5.  **Growth and History**: Earn SaloPoints with every payment and track your history on-chain.

---

## Escrow Lifecycle
SaloMed is a strictly-locked health escrow:
1.  **Deposit**: Funds enter the contract and are associated with the user's vault.
2.  **Locking**: Funds are "locked" within the contract and cannot be withdrawn to arbitrary addresses.
3.  **Release Trigger**: The `pay_hospital` function requires a signed transaction and a destination in the Provider Whitelist.
4.  **Atomic Settlement**: The transfer happens atomically in a single ledger entry.

---

## Setup
```bash
# Smart Contract Build and Test
soroban contract build && cargo test

# Frontend
cd frontend && npm run dev

# Backend
cd backend && uvicorn main:app --reload
```

---

*SaloMed: Pondong protektado, kalusugan mo'y salo (Protected funds, your health is supported).*
