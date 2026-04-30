# SaloMed: Your Health Alkansya

[![Deployment Status](https://img.shields.io/github/actions/workflow/status/USERNAME/SaloMed/deploy.yml?label=CI%2FCD%20Pipeline)](https://github.com/)
[![Stellar Network](https://img.shields.io/badge/Stellar-Testnet-blue)](https://stellar.expert/explorer/testnet)

## Hackathon Roadmap and Requirements Checklist
Para sa mga judges: Ito ang mabilisang silip sa aming Level 1-5 compliance.

| Level | Status | Features Implemented |
| :--- | :---: | :--- |
| **Level 1** | Done | Freighter Wallet Setup, Testnet, Balance Fetching, XLM Transactions. |
| **Level 2** | Done | Soroban Contract Deployed, Frontend Integration, 3+ Error Types Handled, TX Visibility. |
| **Level 3** | Done | Passing Rust Tests, README, Demo Video, Meaningful Commits. |
| **Level 4** | Done | Inter-contract calls (Token SDK), Mobile Responsive Design, CI/CD Pipeline. |
| **Level 5** | Done | Feedback-driven iterations (PHP Toggle & TX Toasts), MVP fully functional. |

---

> ### The Problem: Ang sakit na nga, mas masakit pa sa bulsa.
>
> For many Filipinos, saving up for emergencies is a major goal. However, the reality of having an easily accessible emergency fund is that temptation is always just a few taps away. It's incredibly easy to justify a sudden online purchase, an impromptu dinner out, or a gadget upgrade.
>
> Before you know it, the savings start getting chipped away. The real problem hits when a sudden medical emergency arises. Because the funds have been spent, there is no money left for hospital bills or expensive prescriptions. The inevitable ending? People resort to borrowing. **Napipilitan tayong mangutang.** It leads to high-interest debt, adding massive emotional and financial stress to the family.
>
> This issue extends to remittances as well. When a family member sends money specifically for healthcare: whether it's an OFW abroad or an older sibling working in Manila: there is always the lingering fear of funds being misspent. **Pampa-checkup sana, pero nabili ng luho.** The sender has no guarantee that the money was actually used for medicine.

---

### The Solution: Enter SaloMed: Your Health Alkansya

<img width="1920" height="1080" alt="SaloMed Mobile Responsive View" src="https://github.com/user-attachments/assets/23da38d7-d610-44d2-8c15-3df0dd72d566" />

SaloMed is a purpose-built digital health alkansya (piggy bank). It functions just like the e-wallets we use every single day, but with one massive difference: the money you put in here is strictly locked and can only be spent on healthcare.

Think of it as the ultimate discipline tool for your health savings. We give you a super familiar, frictionless e-wallet experience, but quietly empower it with an unbreakable layer of smart contracts running on the Stellar Network.

**Live App:** [https://salomedhealthalkansya.vercel.app/](https://salomedhealthalkansya.vercel.app/)

**Video Demo:** [Google Drive](https://drive.google.com/file/d/1FdqfCqWRw6hjVrcqbt7UpLAgSdgnlXAR/view?usp=sharing)

**Pitch Document:** [Google Docs](https://docs.google.com/document/d/134i9LdSE-X0jaV2Nr0X9SSptM7tY4yRtdCkYO2t2260/edit?usp=sharing)

---

### Table of Contents
*   [Key Features](#key-features)
*   [The Vision: Why Philippines? Why Now?](#the-vision-why-philippines-why-now)
*   [Tech Stack](#tech-stack)
*   [Smart Contract](#smart-contract)
*   [How Stellar Powers SaloMed](#how-stellar-powers-salomed)
*   [Architecture & Structure](#architecture--structure)
*   [Demo Flow](#demo-flow)
*   [Escrow Lifecycle](#escrow-lifecycle)
*   [Error Handling and Iterations](#error-handling-and-iterations)
*   [Setup](#setup)

---

## Key Features

### 1. Purpose-Bound Savings (The "Lock" Feature)
When you fund your SaloMed Vault, that money is secured and untouchable for casual spending. You cannot withdraw it to buy concert tickets or go shopping. It can exclusively be transacted at whitelisted partner hospitals, clinics, and pharmacies.

### 2. Familiarity and "Zero-Crypto Anxiety"
*   **Recognizable Funding**: Top up via familiar e-wallet flows (GCash Bridge).
*   **Scan-to-Pay**: Point-of-care QR payments just like your daily finance apps.
*   **Local Currency Display**: Dynamic toggle between PHP and XLM for better accessibility.

### 3. The Ultimate "Health Pasaload"
Need to instantly send medicine money to your sibling in the province? Just padala directly to their SaloMed Vault! Because the remittance is Purpose-Bound, you are 100% certain it will only be spent at a hospital or pharmacy.

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
**Explorer:** [Stellar Expert](https://stellar.expert/explorer/testnet/contract/CAO3K6OYB5A3VNVV3HKCSVG3ZZ442DZCDKAXG4CTSLBTN7FOYCCBRZ34)

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
SaloMed follows a Hybrid Sync Architecture:
1. **Frontend**: Directly queries Horizon RPC for real-time accuracy.
2. **Backend**: GCash Bridge logic using SALOMED_SIGNER_SECRET.
3. **Auto-Sync**: Dual-layer sync (Event-driven + 20s Polling).

---

## Error Handling and Iterations (Level 2 and 5)
*   **User Resilience:** Graceful handling of Freighter rejections and network timeouts.
*   **Validation:** Regex-based checks for Stellar addresses and GCash numbers.
*   **Feedback Iteration 1:** Added PHP/XLM Toggle to help users understand costs in local currency.
*   **Feedback Iteration 2:** Implemented TxConfirmedToast with direct explorer links for instant confirmation.

---

## Setup

### Smart Contract
```bash
soroban contract build
cargo test
soroban contract deploy --wasm target/wasm32-unknown-unknown/release/salomed.wasm --network testnet
```

### Frontend and Backend
```bash
# Frontend
npm run dev

# Backend
uvicorn main:app --reload
```

---

*SaloMed: Pondong protektado, kalusugan mo'y salo.*
