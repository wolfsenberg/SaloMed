# SaloMed: Your Health Alkansya

[![SaloMed CI/CD Pipeline](https://github.com/wolfsenberg/SaloMed/actions/workflows/ci.yml/badge.svg)](https://github.com/wolfsenberg/SaloMed/actions/workflows/ci.yml)
[![Stellar Network](https://img.shields.io/badge/Stellar-Testnet-blue)](https://stellar.expert/explorer/testnet)
[![Track](https://img.shields.io/badge/APAC%20Track-Local%20Finance%20%26%20Real%20World%20Access-blue)](#requirements-detail)

SaloMed is a purpose-bound health savings and payment platform for Filipino families. It keeps medical funds protected for real healthcare use while giving users a familiar e-wallet experience powered by Stellar under the hood.

**Live App:** [https://salomedhealthalkansya.vercel.app/](https://salomedhealthalkansya.vercel.app/)

**Video Demo:** [Google Drive](https://drive.google.com/file/d/1FdqfCqWRw6hjVrcqbt7UpLAgSdgnlXAR/view?usp=sharing)

**Pitch Document:** [Google Docs](https://docs.google.com/document/d/134i9LdSE-X0jaV2Nr0X9SSptM7tY4yRtdCkYO2t2260/edit?usp=sharing)

<img width="6400" height="2400" alt="SaloMed banner" src="https://github.com/user-attachments/assets/aef0d074-76c7-4bd5-82eb-9bedeb4f9ac4" />

## Problem

**Ang sakit na nga, mas masakit pa sa bulsa.** For many Filipinos, saving for medical emergencies is a serious goal, but keeping that money untouched is hard. A regular savings balance can be spent on shopping, bills, travel, or everyday wants long before a hospital visit or prescription need arrives.

When the emergency finally happens, the fund that was supposed to protect the family is often gone. The result is familiar: people are forced to borrow, delay treatment, or ask relatives for urgent help.

The same issue appears in remittances. An OFW or family member may send money specifically for medicine, checkups, or hospital bills, but the sender has no reliable way to know that the money was actually used for healthcare. **Pampa-checkup sana, pero nagastos sa iba.**

## Solution

SaloMed is a digital **health alkansya**: a familiar e-wallet-like vault where funds are purpose-bound for healthcare. Users can top up, receive padala, pay approved healthcare providers, and view every transaction in one simple app.

The difference is what happens underneath. Stellar and Soroban enforce the health-only rule so funds can only move to whitelisted hospitals, clinics, and pharmacies. The crypto layer stays mostly invisible to the user: balances are shown in Philippine pesos by default, actions feel like common local finance flows, and Stellar provides fast, low-cost settlement behind the scenes.

**Primary APAC track:** Local Finance & Real World Access  
**Supporting angle:** Payment & Consumer Applications  
**Technical backbone:** Stellar Soroban smart contracts and composable on-chain settlement

**Desktop:** <img width="1920" height="1080" alt="SaloMed desktop app" src="https://github.com/user-attachments/assets/fbe9fcbb-b6bb-489b-bd24-fe48efeb71ba" />

**Mobile:** <img width="391" height="851" alt="SaloMed mobile app" src="https://github.com/user-attachments/assets/58b71aa2-e726-4df4-a780-c90721baf64b" />

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

### 1. Purpose-Bound Health Vault

Funds inside the SaloMed Vault are not casual spending money. They are reserved for approved healthcare providers only. This turns a normal digital balance into a disciplined medical fund that is ready when an emergency happens.

### 2. Familiar, Zero-Crypto-Anxiety UX

SaloMed looks and feels close to finance apps Filipinos already understand:

* PHP-first balance display with optional XLM view.
* GCash-style top up flow for familiar local funding.
* InstaPay via PDAX flow for fiat-to-XLM onboarding.
* Freighter wallet support for Stellar-native users.
* QR and address-based payments for provider checkout.
* English, Tagalog, and default Taglish language support.

The user does not need to understand blockchain mechanics to understand the product.

### 3. Health Padala

SaloMed extends the Filipino idea of padala into healthcare. A sender can transfer support to a family member's SaloMed Vault knowing the funds remain reserved for hospitals, clinics, and pharmacies.

This works for OFWs, relatives in Manila, or anyone helping a loved one with medical expenses.

### 4. Whitelisted Provider Payments

Healthcare payments are limited to approved providers. The app includes a separate provider portal where whitelisted hospitals and pharmacies can view incoming SaloMed payments, bill checks, and settlement status.

### 5. SaloPoints and Salo Support

Users earn SaloPoints from healthcare payments. SaloPoints are not cash, not cashback, and not withdrawable value. They are a trust and activity signal used to determine Salo tiers.

When a user's vault falls short, the Salo flow lets them request health bill support. Salo requests are reviewed in the SaloMed admin console, with approval, terms acceptance, and release status tracked separately.

### 6. Admin and Partner Operations

SaloMed includes non-user-facing operational portals:

* **Partner Portal:** lets whitelisted providers inspect payments and settlement details.
* **Admin Console:** lets SaloMed reviewers manage Salo support requests across users.

These portals close a key MVP gap: the project is not only a patient app, it already models the operational side needed for a real healthcare finance network.

## The Vision

SaloMed is built for families who are one medical emergency away from debt. The goal is not to make people "use crypto." The goal is to make protected healthcare savings, transparent family support, and provider payments feel normal.

In the Philippines, people already understand alkansya, GCash, InstaPay, and padala. SaloMed uses that cultural and financial familiarity, then adds a stronger guarantee: health funds stay for health.

Long term, SaloMed can become a local finance access layer for:

* personal health savings,
* OFW and domestic healthcare remittances,
* clinic and pharmacy payment networks,
* employer or community health support,
* transparent medical aid distribution,
* regulated short-term gap funding for approved health expenses.

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

SaloMed uses Stellar beyond a simple transfer button. The Soroban contract models a purpose-bound healthcare vault with admin setup, provider whitelist enforcement, remittance deposits, vault-to-vault transfer, healthcare payment settlement, points, and read methods for verification.

The backend integrates Stellar-aware runtime checks, Freighter transaction flows, live PHP/XLM rate handling, and explicit safe modes. The project also includes CI for frontend, backend, and contract builds.

### Real-World Fit and Use Case

The product is built around a clear local finance problem: Filipino families need medical funds that are easy to fund but hard to misuse. SaloMed combines health savings, healthcare-only spending, and family padala into one practical flow.

The primary APAC track is **Local Finance & Real World Access** because SaloMed focuses on real-world health expenses, local e-wallet behavior, Philippine peso UX, and family remittance use cases.

### Innovation and Differentiation

SaloMed is not only a wallet and not only a payment page. The differentiator is the purpose-bound vault: funds are locked for healthcare and released only to approved providers. The product adds family remittance confidence, provider verification, SaloPoints, and Salo support workflows on top of a familiar consumer experience.

### UX and Accessibility

The app is intentionally designed to reduce crypto anxiety:

* PHP is the default display currency.
* XLM is available as an alternate view for transparency.
* Top up and payment flows mirror familiar local finance patterns.
* Onboarding explains the concept visually.
* English, Tagalog, and Taglish language modes are supported.
* Consumer, provider, and admin surfaces are separated so each user sees only the workflows relevant to them.

### Viability and Go-to-Market

The MVP already demonstrates the three-sided workflow needed for adoption:

* patients and families fund and spend through the vault,
* providers receive and inspect SaloMed payments,
* SaloMed admins review support requests and operational queues.

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
