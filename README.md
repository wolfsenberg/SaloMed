# SaloMed: Your Health Alkansya

[![SaloMed CI/CD Pipeline](https://github.com/wolfsenberg/SaloMed/actions/workflows/ci.yml/badge.svg)](https://github.com/wolfsenberg/SaloMed/actions/workflows/ci.yml)
[![Stellar Network](https://img.shields.io/badge/Stellar-Testnet-blue)](https://stellar.expert/explorer/testnet)
[![APAC Stellar Hackathon](https://img.shields.io/badge/APAC%20Stellar%20Hackathon-Local%20Finance%20%26%20Real%20World%20Access-blue)](#requirements-detail)

## Problem

**Ang sakit na nga, mas masakit pa sa bulsa.** For many families, a medical emergency is not only a health crisis. It is a financial shock that can wipe out savings overnight.

In the Philippines, the pressure is especially clear. Only 3 in 10 adults have enough savings to survive a financial shock (BSP, 2025). In Q4 2024, just 25.6% of families reported having any money left to save at all (BSP). Daily expenses consume almost everything.

Even when families manage to set money aside for health, the savings often do not last. Emergency funds sit in the same wallet used for groceries, bills, favors, school needs, and impulse spending. Each withdrawal feels justified in the moment. Together, they drain the health fund before the emergency arrives.

Then someone needs care now. The money is gone. Out-of-pocket payments still account for 44.4% of total health expenditure in the Philippines (DOH National Health Accounts, 2023), and many families fall back on borrowing when hospital costs exceed what they saved. One illness becomes two crises: medical and financial.

Remittances carry the same pain. In 2024, 2.19 million OFWs sent a record $38.34 billion home (PSA/BSP). A parent abroad may send money for medicine. A sibling in Manila may send money for a checkup. But once the money arrives, there is no reliable proof that it was actually used for healthcare. **Pampa-checkup sana, pero nagastos sa iba.**

No mainstream wallet treats health money differently from everyday money. SaloMed starts in the Philippines, but the problem is universal: any family in a high-remittance, high-out-of-pocket healthcare market needs money that is easy to fund, easy to send, easy to use at real providers, and hard to misuse.

## Solution

SaloMed is a digital **health alkansya** built for the **APAC Stellar Hackathon** under **Local Finance & Real World Access**.

It has one core promise: **health savings stay for health**.

The app feels like a familiar payment wallet. Users top up in local currency, see their balance in pesos, receive health padala from family, and pay at approved hospitals, clinics, or pharmacies. No crypto jargon. No complex setup. The experience is intentionally ordinary because the problem is already stressful enough.

That is the zero-crypto-anxiety angle: ordinary people can benefit from blockchain without feeling like they are "using crypto." For a patient, it feels like topping up and paying. For a sender, it feels like padala. Underneath, Stellar and Soroban make the money purpose-bound. Funds inside the SaloMed Vault can only move to whitelisted healthcare providers or another SaloMed health vault. Every transfer leaves a verifiable record, giving families and senders confidence that health money is still health money.

For the Philippines wedge, SaloMed uses a PDAX-oriented InstaPay flow with live PHP-to-XLM conversion to show how local bank funding can move into a Stellar-powered health vault. For the broader APAC opportunity, the same model can be adapted to other markets where families rely on remittances and pay heavily out of pocket for care.

**Primary track:** Local Finance & Real World Access  
**Supporting angle:** Payment & Consumer Applications  
**UX principle:** Zero crypto anxiety  
**Technical backbone:** Stellar Soroban smart contracts and composable on-chain settlement

<img width="6400" height="2400" alt="SaloMed banner" src="https://github.com/user-attachments/assets/aef0d074-76c7-4bd5-82eb-9bedeb4f9ac4" />

**Desktop:** <img width="1920" height="1080" alt="SaloMed desktop app" src="https://github.com/user-attachments/assets/fbe9fcbb-b6bb-489b-bd24-fe48efeb71ba" />

**Mobile:** <img width="391" height="851" alt="SaloMed mobile app" src="https://github.com/user-attachments/assets/58b71aa2-e726-4df4-a780-c90721baf64b" />

**Live App:** [https://salomedhealthalkansya.vercel.app/](https://salomedhealthalkansya.vercel.app/)

**Video Demo:** [Google Drive](https://drive.google.com/file/d/1FdqfCqWRw6hjVrcqbt7UpLAgSdgnlXAR/view?usp=sharing)

**Pitch Document:** [Google Docs](https://docs.google.com/document/d/134i9LdSE-X0jaV2Nr0X9SSptM7tY4yRtdCkYO2t2260/edit?usp=sharing)

## Table of Contents

* [Key Features](#key-features)
* [The Vision](#the-vision)
* [Tech Stack](#tech-stack)
* [Smart Contract](#smart-contract)
* [How Stellar Powers SaloMed](#how-stellar-powers-salomed)
* [Architecture and Structure](#architecture-and-structure)
* [CI/CD Pipeline](#cicd-pipeline)
* [Requirements Detail](#requirements-detail)
* [User Feedback and Improvement Phase](#user-feedback-and-improvement-phase)
* [Demo Flow](#demo-flow)
* [Escrow Lifecycle](#escrow-lifecycle)
* [Setup](#setup)

## Key Features

SaloMed is intentionally focused. It is not trying to be a super app. It solves one job: keep healthcare money protected, visible, and usable when care is needed.

### 1. Protected Health Vault

The SaloMed Vault separates health funds from everyday spending. Funds are reserved for approved healthcare use and cannot be casually withdrawn for non-health expenses.

### 2. Local Funding and Familiar Payments

Users interact with the app through patterns they already understand:

* PHP-first balance display, with XLM available as a transparent alternate view.
* GCash-style top up for familiar local behavior.
* InstaPay via PDAX flow for PHP-to-XLM onboarding.
* Freighter support for Stellar-native users.
* QR and address-based payment flows for provider checkout.

The product hides blockchain complexity without hiding the audit trail.

This is how SaloMed introduces blockchain to everyday users: not through seed phrases, market charts, or token speculation, but through a concrete benefit they already understand: protected health money.

### 3. Health Padala With Proof

SaloMed turns padala into purpose-bound healthcare support. A sender can transfer money to a loved one's health vault knowing it remains dedicated to hospitals, clinics, and pharmacies.

This is valuable for OFWs, relatives in Manila, or anyone supporting family care from a distance. The sender no longer has to rely only on trust and screenshots; the transaction is tied to a healthcare-dedicated vault.

### 4. Provider-Verified Healthcare Payments

Payments can only go to whitelisted providers. This is the enforcement layer that makes SaloMed different from a normal wallet: the funds are liquid for healthcare, but blocked for everything else.

### 5. SaloPoints and Salo Support

SaloPoints are a lightweight reputation signal earned from healthcare payments. They are not cash, not cashback, and not withdrawable value.

When a user's vault falls short, the Salo flow lets them request health bill support. In the MVP, this is review-based and tracked through the SaloMed admin console. In production, any real credit product would require regulated underwriting, compliance, and licensed partners.

### 6. Provider and Admin Rails

To prove the workflow beyond the patient screen, SaloMed includes separate operational surfaces:

* **Partner Portal:** whitelisted hospitals and pharmacies can inspect incoming SaloMed activity.
* **Admin Console:** SaloMed reviewers can manage Salo support requests across users.

These are not extra gimmicks. They show that the product can support the real actors in a healthcare finance network: patients, family senders, providers, and SaloMed operators.

## The Vision

SaloMed starts in the Philippines because the pain is obvious: high out-of-pocket healthcare costs, strong family remittance behavior, and a familiar e-wallet culture. But the deeper problem is not uniquely Filipino.

Across APAC and other emerging markets, families face the same pattern: limited savings, medical bills paid directly from household cash, relatives sending support from far away, and no guarantee that health money stays reserved for health.

The first users are:

* **Family savers** who want a health fund that cannot be casually drained.
* **OFWs and family supporters** who send money home for medical needs and want proof it stays dedicated to healthcare.
* **Hospitals, clinics, and pharmacies** that benefit when patients arrive with pre-funded, settlement-ready health wallets.

SaloMed's long-term vision is to become a local finance access layer for purpose-bound healthcare money:

* personal and family health savings,
* domestic and cross-border healthcare remittances,
* hospital, clinic, and pharmacy payment networks,
* employer and community health support,
* transparent medical aid distribution,
* regulated short-term gap funding for approved health expenses.

The first market is the Philippines. The problem is universal.

## Tech Stack

* **Blockchain:** Stellar
* **Smart Contract:** Soroban, Rust, `soroban-sdk`
* **Frontend:** Next.js 14 App Router, TypeScript, Tailwind CSS, Framer Motion
* **Backend:** FastAPI, Python 3.11
* **Database:** SQLite locally, PostgreSQL on Render
* **Wallet:** Freighter
* **Fiat / On-Ramp Layer:** PDAX-oriented InstaPay flow with live PHP/XLM rate support
* **Deployment:** Vercel frontend, Render backend, GitHub Actions CI/CD

## Smart Contract

**Contract ID (Testnet):** `CA6X5ZJ24LBJBCRHSAJK5EXB7CMEED2X2JTDLTPBOZC3SM4ABZYNIRCG`

**Vault Asset:** Native XLM via Stellar Asset Contract `CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC`

<img width="1414" height="487" alt="SaloMed contract proof" src="https://github.com/user-attachments/assets/7b5a8c23-655e-416c-bcdd-4257eb51e921" />
<img width="1307" height="230" alt="SaloMed contract result" src="https://github.com/user-attachments/assets/748ab0e7-009a-440a-a540-08217ce77323" />
<img width="1908" height="965" alt="SaloMed Stellar explorer" src="https://github.com/user-attachments/assets/33a14e08-06a7-466d-9e0d-b2ffa26d5305" />
<img width="1920" height="1080" alt="SaloMed testnet transaction" src="https://github.com/user-attachments/assets/f984403f-bcf8-4e7c-bfe3-377243f69e60" />

| Function | Description |
|---|---|
| `initialize` | Stores the admin and token contract addresses |
| `whitelist_hospital` | Adds an approved healthcare provider |
| `remove_hospital` | Removes a provider from the whitelist |
| `deposit_remittance` | Locks transferred funds into a beneficiary vault |
| `transfer_vault` | Moves locked funds between SaloMed vaults |
| `pay_hospital` | Releases locked funds only to a whitelisted provider |
| `award_points` | Grants bonus SaloPoints through the admin path |
| `get_vault` | Reads a user's vault balance, SaloPoints, and tier |
| `is_whitelisted` | Checks if a provider can receive SaloMed payments |
| `get_token_id` | Exposes the configured token contract for verification |
| `get_admin` | Exposes the configured admin address for verification |

## How Stellar Powers SaloMed

* **Fast and low-cost settlement:** Stellar makes small healthcare payments economically practical.
* **Purpose-bound enforcement:** Soroban contract logic prevents funds from leaving the vault unless the recipient is whitelisted.
* **Atomic healthcare payments:** Provider settlement happens as one contract-mediated action, reducing ambiguity between payment approval and fund movement.
* **Transparent activity trail:** Transactions can be verified through Stellar network records and contract events.
* **Zero-crypto-anxiety access:** users get blockchain guarantees through familiar wallet, padala, and QR payment flows instead of crypto-native workflows.
* **Composable finance layer:** The vault, provider whitelist, remittance, and SaloPoints logic can be extended into broader health finance workflows.

## Architecture and Structure

SaloMed is structured as a multi-surface product:

1. **Patient App:** vault, top up, payment, Salo, padala, transactions, onboarding, language support.
2. **Provider Portal:** separate route for whitelisted hospitals and pharmacies to inspect incoming SaloMed activity.
3. **Admin Console:** separate route for SaloMed reviewers to approve, reject, and release Salo support requests.
4. **Backend API:** FastAPI service for runtime status, rates, top ups, payments, padala, Salo requests, provider activity, history, and admin flows.
5. **Smart Contract:** Soroban contract for purpose-bound vault rules, provider whitelist enforcement, remittance deposits, healthcare payments, and points.

Runtime modes are explicit. The app can run in safe demo mode for hackathon judging and local testing, while Stellar testnet paths remain available for on-chain proof and wallet-based flows. Demo mode does not move real customer money.

Render deployment uses PostgreSQL for persistence, so cross-user history, provider activity, and Salo request queues survive restarts and redeploys.

## CI/CD Pipeline

SaloMed uses GitHub Actions for CI/CD:

* **Frontend CI:** installs dependencies, runs tests, type-checks, and builds the Next.js app.
* **Backend CI:** installs Python dependencies, syntax-checks the API, verifies FastAPI boot, runs backend tests, and performs dependency audit.
* **Contract CI:** runs Rust contract tests, builds the Soroban WASM artifact, checks size, and uploads the build artifact.
* **Application CD:** after successful CI on `main` or `master`, GitHub Actions can trigger Render and Vercel deploy hooks through repository secrets.
* **Smart Contract Release:** contract deployment is manual and gated through a separate workflow. An operator must explicitly type `DEPLOY_TESTNET` before any on-chain deployment occurs.

Required deployment secrets:

| Secret | Purpose |
|---|---|
| `RENDER_DEPLOY_HOOK_URL` | Triggers backend deployment on Render |
| `VERCEL_DEPLOY_HOOK_URL` | Triggers frontend deployment on Vercel |
| `STELLAR_DEPLOY_SECRET_KEY` | Testnet signer for manual contract releases |

## Requirements Detail

### Technical Implementation and Stellar Usage

SaloMed uses Stellar beyond a simple transfer button. The Soroban contract models the central rule of the product: health vault funds can be deposited, transferred as health padala, and released only through approved healthcare paths.

The backend supports Stellar-aware runtime checks, Freighter transaction flows, live PHP/XLM rate handling, explicit safe modes, persistent history, provider indexing, and Salo request review. The project also includes CI for frontend, backend, and contract builds.

### Real-World Fit and Use Case

The product is built around a clear local finance problem: families need medical funds that are easy to fund, easy to send, and hard to misuse. SaloMed combines health savings, healthcare-only spending, and family padala into one practical flow.

The primary APAC track is **Local Finance & Real World Access** because SaloMed focuses on real-world health expenses, local funding behavior, Philippine peso UX, and remittance-backed family care. The Philippines is the first market, but the same pattern exists across high-remittance, high-out-of-pocket healthcare markets.

### Innovation and Differentiation

SaloMed is not another wallet. The differentiator is purpose-bound money: funds are liquid for healthcare but blocked for everything else. That single rule creates a stronger savings product, a more trustworthy remittance product, and a clearer provider payment flow.

### UX and Accessibility

The app is intentionally designed for zero crypto anxiety. SaloMed should feel understandable to a normal patient, parent, OFW, or pharmacy customer even if they have never used a blockchain wallet before:

* PHP is the default display currency.
* XLM is available as an alternate view for transparency.
* Top up, padala, and payment flows mirror familiar local finance patterns.
* Onboarding explains the concept visually.
* English, Tagalog, and Taglish language modes are supported.
* Consumer, provider, and admin surfaces are separated so each user sees only the workflows relevant to them.

The eye-opener is subtle: users experience blockchain as protection, proof, and speed, not as speculation or technical friction.

### Viability and Go-to-Market

The MVP demonstrates the minimum real-world network needed for adoption:

* patients and families fund and spend through the vault,
* family supporters send health padala,
* providers receive and inspect SaloMed payments,
* SaloMed admins review support requests and operational queues,
* PDAX-oriented InstaPay flow shows how local bank funding can connect to the vault.

Production rollout would require provider onboarding, compliance review, KYC/AML, reconciliation, fraud checks, PDAX production approval, and regulated lending treatment for any real Salo credit product. Those are roadmap items, not hidden assumptions.

### Team and Ability to Continue

The project shows continuation readiness through a working app, smart contract, backend API, provider portal, admin console, persistent deployment path, CI/CD, test coverage, and documented production gaps. The MVP is intentionally scoped so the demo is stable while still pointing clearly toward a real deployable product.

## User Feedback and Improvement Phase

SaloMed collected early feedback from initial test users. The concept received strong responses because users immediately understood the value of protected health savings and healthcare-only padala.

**Feedback Data Analysis:** https://docs.google.com/spreadsheets/d/1cGYpwIF1pgURlQtQvbi-ag1oKH0ZTKydAowQtGC0uus/edit?usp=sharing

Key improvements already made from review and testing:

1. **Cleaner money model:** PHP is the default display, XLM is the alternate view, and live PHP/XLM conversion is used across money-related flows.
2. **Clearer SaloPoints policy:** SaloPoints are tier and trust signals, not spendable money.
3. **Provider and admin visibility:** transaction details, provider portal, and admin Salo review flows were added to reduce operational gaps.
4. **More polished UX:** onboarding, top up modals, history cards, transaction details, and language behavior were refined for demo clarity.
5. **Deployment readiness:** Render, Vercel, PostgreSQL, and GitHub Actions workflows were aligned for a stable hackathon deployment.

## Demo Flow

1. **Onboarding:** user learns that SaloMed is a purpose-bound health alkansya.
2. **Vault:** user sees their health balance in PHP, with XLM available as an alternate view.
3. **Top Up:** user adds funds through GCash-style, InstaPay via PDAX, or Freighter flow.
4. **Payment:** user pays a whitelisted hospital, clinic, or pharmacy.
5. **Padala:** sender transfers health support to a loved one's SaloMed Vault.
6. **Transactions:** user opens transaction details to see source, recipient, amount, XLM equivalent, and verification context.
7. **Salo:** user requests health bill support if their vault is short.
8. **Provider Portal:** whitelisted provider views incoming SaloMed activity.
9. **Admin Console:** SaloMed reviewer approves, rejects, and releases Salo support requests.

## Escrow Lifecycle

SaloMed models a strictly locked healthcare escrow:

1. **Deposit:** funds are credited to the user's SaloMed Vault.
2. **Lock:** the balance is reserved for healthcare use and cannot be withdrawn for casual spending.
3. **Verification:** the recipient must be a whitelisted healthcare provider.
4. **Release:** funds move only when the payment target passes the provider check.
5. **Record:** transaction history and network verification details are stored for transparency.
6. **Reward Signal:** eligible healthcare payments earn SaloPoints that influence the user's Salo tier.

## Setup

### Smart Contract

```bash
cd contracts/salomed
cargo test --release
cargo build --target wasm32v1-none --release
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

### Backend

```bash
cd backend
python -m venv venv
venv\Scripts\activate
pip install -r requirements.txt
uvicorn main:app --reload
```

### Full Stack With Docker

```bash
docker compose up --build
```

---

*SaloMed: Pondong protektado, kalusugan mo'y salo.*
