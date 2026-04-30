# SaloMed: Your Health Alkansya (Health Piggy Bank)

[![SaloMed CI/CD Pipeline](https://github.com/wolfsenberg/SaloMed/actions/workflows/ci.yml/badge.svg)](https://github.com/wolfsenberg/SaloMed/actions/workflows/ci.yml)
[![Stellar Network](https://img.shields.io/badge/Stellar-Testnet-blue)](https://stellar.expert/explorer/testnet)

## Hackathon Roadmap and Requirements Checklist

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
*   [Architecture and Structure](#architecture-and-structure)
*   [CI/CD Pipeline](#cicd-pipeline)
*   [Hackathon Requirements Detail](#hackathon-requirements-detail)
*   [User Feedback and Future Improvements](#user-feedback-and-future-improvements)
*   [Demo Flow](#demo-flow)
*   [Escrow Lifecycle](#escrow-lifecycle)
*   [Setup](#setup)

---

## Key Features

### 1. Purpose-Bound Savings (The "Lock" Feature)
When you fund your SaloMed Vault, that money is secured and untouchable for casual spending. You cannot withdraw it to buy concert tickets or go shopping. It can exclusively be transacted at whitelisted partner hospitals, clinics, and pharmacies. When an emergency actually happens, you have absolute peace of mind knowing the budget is 100% intact and ready to use.

### 2. Familiarity and "Zero-Crypto Anxiety"
We intentionally designed SaloMed to avoid alienating Filipinos with complicated tech workflows. It feels exactly like the daily finance apps they are already accustomed to.

*   **Recognizable Funding**: We leverage the familiarity of leading local e-wallets, allowing users to effortlessly top up their vault or send funds in just a few taps.
*   **Scan-to-Pay**: At the hospital checkout counter? Just open the SaloMed app, select "Scan QR," and pay the exact amount point-blank. Kung kaya mong mag-scan sa sari-sari store, kayang-kaya mong gamitin ang SaloMed (If you can scan at a local store, you can definitely use SaloMed).
*   **Local Currency Display**: While powered by the Stellar network, the platform maintains a highly accessible interface. Users can dynamically toggle their balance between Philippine Pesos (PHP) and XLM, with all complex blockchain operations abstracted seamlessly in the background.

### 3. The Ultimate "Health Pasaload" (Local and Global Padala)
SaloMed completely redesigns how we support our families. While it is highly effective for OFWs wanting to ensure their remittances are spent properly, its utility is not limited to them. It works just like the uniquely Filipino concept of Pasaload (Sharing mobile credits).

Need to instantly send medicine money to your sibling in the province? Just padala directly to their SaloMed Vault! Because the remittance is Purpose-Bound, you are 100% certain it will only be spent at a hospital or pharmacy. You get guaranteed transparency, whether you're sending from Dubai, Makati, or the next town over.

### 4. Powered by Stellar: Fast, Cheap, and Ultra-Safe
Because we built SaloMed on the Stellar blockchain, we get to leverage its absolute best features. Transactions settle in just seconds, and the network fees are practically non-existent. Most importantly, every single transaction is permanently intact and safe. Because it exists on a blockchain, bawat padala (every remittance) and every hospital payment is permanently and transparently recorded on an immutable ledger. No missing funds, no accounting blind spots: just unbreakable, uncompromisable security protecting your hard-earned health savings.

### 5. SaloPoints and Micro-Loans (Gap Funding)
To reward financial discipline, every time a user pays a healthcare provider using SaloMed, they earn SaloPoints as cashback. But what if the hospital bill exceeds the savings inside the vault? SaloMed features a highly accessible Micro-Loan system. Because your entire healthcare payment history is reliably recorded on-chain, you can instantly apply for short-term Gap Funding to quickly clear the remaining hospital balance. Over time, maintaining a healthy stash of SaloPoints unlocks significantly cheaper interest rates!

---

## The Vision: Why Philippines? Why Now?

SaloMed is born out of a critical need to bridge the gap between digital financial convenience and long-term medical security in the Philippines.

### The Problem of "Out-of-Pocket" Healthcare
In the Philippines, nearly half of healthcare spending is paid "out-of-pocket." Most families are one major illness away from falling back into poverty. SaloMed provides a safety net that traditional banking and e-wallets cannot: **Condition-based Saving.**

### Target Market and Strategic Impact
*   **The Transnational Filipino Family**: Designed for families separated by geography (OFWs, domestic migrants). It solves the "trust gap" in remittances, ensuring that medical funds stay in the vault until needed by a healthcare provider.
*   **The Unbanked and Under-HMO**: For millions who do not have access to private health insurance (HMOs), SaloMed acts as a self-funded, community-backed insurance layer.
*   **Healthcare Providers**: Hospitals and pharmacies benefit from instant, atomic settlement with zero credit risk.

---

## Tech Stack

| Layer | Technology |
|---|---|
| **Blockchain** | Stellar Soroban (Smart Contracts) |
| **Smart Contract** | Rust + soroban-sdk |
| **Frontend** | Next.js 14 (App Router), Tailwind CSS, Framer Motion |
| **Backend** | FastAPI (Python 3.11) |
| **Wallet** | Freighter Wallet |
| **Payments** | XLM and USDC (Stellar Assets) |
| **Deployment** | Vercel (Frontend), Render (Backend) |

---

## Smart Contract

**Contract ID (Testnet):** `CAO3K6OYB5A3VNVV3HKCSVG3ZZ442DZCDKAXG4CTSLBTN7FOYCCBRZ34`

| Function | Description |
|---|---|
| initialize | Setup admin and token addresses |
| deposit_remittance | Remittance top-up for a beneficiary vault |
| pay_hospital | Inter-contract call to native XLM for atomic settlement |
| get_vault | Fetch balance, SaloPoints, and credit tier |
| whitelist_hospital | Admin: Add authorized medical providers |

---

## How Stellar Powers SaloMed

SaloMed is more than an application: it is a decentralized financial protocol for health security, leveraged by the specific architectural strengths of the Stellar Network:

*   **Automated Financial Discipline**: Our Soroban smart contracts act as an immutable, non-custodial guardian. By hardcoding the "healthcare-only" rule on-chain, we eliminate human temptation and ensure that emergency funds are preserved for their intended purpose.
*   **Atomic Multi-Party Settlement**: Using Stellar's atomic operations, we ensure that a vault is only debited *if and only if* a whitelisted healthcare provider simultaneously receives the funds. This creates a zero-trust environment where patient funds are safe until the point of care.
*   **Hyper-Scalability via Micro-fees**: With transaction costs at a fraction of a cent, SaloMed remains economically viable for frequent micro-savings and micro-remittances that would otherwise be consumed by traditional banking fees.
*   **Asset Versatility and Stability**: By utilizing USDC for value preservation and XLM for network utility, we provide a stable e-wallet experience backed by the speed and transparency of a global public ledger.
*   **Seamless Global-to-Local Remittances**: Stellar eliminates the friction of cross-border health support. Funds sent from anywhere in the world arrive instantly as purpose-bound health credits, ready for immediate medical use in the Philippines.

---

## Architecture and Structure

SaloMed follows a high-resiliency **Hybrid Sync Architecture** to ensure the app remains functional even during backend processing delays:

```text
       [ User / Wallet ]
               ↓
    [ Next.js Web Frontend ] <————> [ Stellar Horizon / RPC ]
               ↓                            ↑
      [ FastAPI Backend ] ———————————————————/
```

*   **Frontend**: Built with Next.js 14. Directly queries **Stellar Horizon** for real-time balance and transaction history to ensure 100% data accuracy.
*   **Backend**: Acts as a bridge for "Mock Fiat" operations. Uses a **Direct Signer Logic** (topup-legacy) to fund wallets instantly without relying on heavy server-side CLI dependencies.
*   **Auto-Sync Engine**: The UI implements a dual-layer sync:
    *   **Event-Driven**: Instantly refreshes balance after any successful payment or padala.
    *   **Polling**: Directly queries the blockchain every 20 seconds to catch inbound deposits or external transfers.

---

## CI/CD Pipeline

SaloMed uses a robust **CI/CD Pipeline** via GitHub Actions to maintain code quality and ensure continuous delivery:

*   **Continuous Integration (CI)**: Awtomatikong pinapatakbo ang mga sumusunod sa bawat push:
    *   **Smart Contract Tests**: Ginagamit ang `cargo test` para i-verify ang integridad ng Soroban contracts.
    *   **Frontend Validation**: Sinisiguro na ang Next.js build ay walang errors bago ang deployment.
    *   **Dependency Audit**: Sinusuri ang mga security vulnerabilities sa backend at frontend packages.
*   **Continuous Deployment (CD)**: Kapag pumasa ang lahat ng tests, ang app ay awtomatikong dine-deploy sa **Vercel** (Frontend) at **Render** (Backend).

---

## Hackathon Requirements Detail

### Level 3: Mini-dApp Evidence
Ang SaloMed ay isang fully functional mini-dApp. Narito ang tatlong pangunahing tests na pumasa sa aming smart contract:
1.  `test_initialize`: Bineverify ang tamang setup ng admin at token authority (Verified the correct admin and token authority setup).
2.  `test_deposit_remittance`: Sinisiguro na ang pondo ay naka-lock sa tamang beneficiary vault (Ensures funds are locked in the correct beneficiary vault).
3.  `test_pay_hospital`: Sinusuri ang atomic flow mula vault patungong hospital provider (Examines the atomic flow from vault to hospital provider).

### Level 4: Advanced Features
*   **Inter-contract Calls**: Ang aming contract ay direktang nakikipag-ugnayan sa Stellar Token Contract para sa atomic fund transfers (Our contract directly interacts with the Stellar Token Contract for atomic fund transfers).
*   **Custom Token Mechanics**: Ang system ay dinisenyo para tumanggap ng custom Stellar Asset Contracts (SAC) para sa medical-specific tokens o liquidity pools sa hinaharap (The system is designed to accept custom Stellar Asset Contracts for medical-specific tokens or liquidity pools in the future).
*   **Advanced Event Streaming**: Gumagamit ang frontend ng real-time sync engine na nag-uupdate ng balance at history tuwing may nadiditect na blockchain events o ledger closes (The frontend uses a real-time sync engine that updates balance and history whenever blockchain events or ledger closes are detected).
*   **CI/CD Pipeline**: Naka-setup ang GitHub Actions para sa automated testing at build validation sa bawat push (GitHub Actions are set up for automated testing and build validation on every push).

---

## User Feedback and Future Improvements

Kami ay nangolekta ng feedback mula sa aming initial test users para sa Level 5 requirement.

**Feedback Data Analysis**: [View User Responses Spreadsheet](https://docs.google.com/spreadsheets/d/1cGYpwIF1pgURlQtQvbi-ag1oKH0ZTKydAowQtGC0uus/edit?usp=sharing)

### Future Improvements Based on Feedback
Batay sa feedback ng mga users, narito ang aming plano para sa susunod na phase ng SaloMed:

1.  **Enhanced UX for Seniors**: Maraming users ang nagsabing kailangan ng mas malaking fonts at voice commands para sa mga matatandang pasyente (Many users said larger fonts and voice commands are needed for elderly patients).
2.  **Expanded Whitelist**: Mag-dadagdag kami ng mas maraming local clinics sa probinsya para sa mas malawak na coverage (We will add more local clinics in the province for wider coverage).
3.  **Automated Micro-Loans**: I-aautomate ang gap funding application gamit ang on-chain credit scoring mula sa SaloPoints (Automate the gap funding application using on-chain credit scoring from SaloPoints).

**Latest Improvement Commit**: [Implemented Transaction Toasts and Currency Toggle](https://github.com/wolfsenberg/SaloMed/commit/b6636f6)

---

## Demo Flow

> **Watch the Demo:** [Google Drive](https://drive.google.com/file/d/1FdqfCqWRw6hjVrcqbt7UpLAgSdgnlXAR/view?usp=sharing)

Experience the SaloMed lifecycle in 5 easy steps:

1.  **Onboarding and Connection**: Connect your **Freighter Wallet**. If it's your first time, you'll see a professional onboarding walkthrough explaining the "Health Alkansya" concept.
2.  **The Top-Up**: Funding your vault is seamless. You can send XLM/USDC directly, or use our **GCash Bridge** simulation to "top up" your health savings.
3.  **Provider Verification**: Select a whitelisted hospital or pharmacy. SaloMed verifies the provider's Stellar address before allowing any transaction.
4.  **Atomic Payment**: Confirm the payment. The smart contract ensures funds are only released to whitelisted healthcare providers. If your balance is low, the UI will suggest a **Micro-Loan** or a **Top-Up**. 
5.  **Growth and History**: Every payment earns you **SaloPoints**, moving you from Bronze to Gold tiers. All transactions are synced between **LocalStorage** (for instant UI feedback) and **Stellar Horizon** (for permanent persistence).

---

## Escrow Lifecycle

SaloMed is more than an e-wallet: it's a **strictly-locked health escrow**.

1.  **Inbound (Deposit)**: Funds enter the contract via `deposit_remittance`. The contract creates or updates a `Vault` entry associated with the user's public key.
2.  **Locking**: Unlike a standard wallet, these funds cannot be withdrawn to any arbitrary address. They are "locked" within the SaloMed contract storage.
3.  **Release Trigger (Payment)**: The `pay_hospital` function is the only gateway. It requires:
    *   A signed transaction from the Vault owner.
    *   A destination address that exists in the SaloMed **Provider Whitelist**.
4.  **Atomic Settlement**: The transfer happens atomically. The user's vault balance decreases, and the hospital's account increases in a single ledger entry.

---

## Setup

### Prerequisites
*   Node.js 18+ and npm
*   Python 3.11+
*   Stellar CLI and Rust (for contract development)

### Smart Contract
```bash
# Build the contract
soroban contract build

# Execute unit and integration tests
cargo test

# Deploy to Stellar Testnet
soroban contract deploy \
  --wasm target/wasm32-unknown-unknown/release/salomed.wasm \
  --source <your-identity> \
  --network testnet
```

### Backend Setup
```bash
cd backend
python -m venv venv
source venv/bin/activate  # or venv\Scripts\activate on Windows
pip install -r requirements.txt
uvicorn main:app --reload
```

### Frontend Setup
```bash
cd frontend
npm install
npm run dev
```

### Mandatory Environment Variables

For a successful production deployment (Render/Vercel), ensure the following are set:

| Variable | Scope | Description |
|---|---|---|
| `SALOMED_SIGNER_SECRET` | Backend | **Critical**: The Stellar Secret Key (S...) used to sign top-up transactions. |
| `FRONTEND_ORIGIN` | Backend | Allowed CORS origins (e.g., `https://your-app.vercel.app`). |
| `ADMIN_ADDRESS` | Backend | The public key (G...) matching the signer secret. |
| `NEXT_PUBLIC_API_URL` | Frontend | Your deployed FastAPI URL (ensure it starts with `https://`). |
| `DEMO_FALLBACK` | Backend | Set to `true` to enable mock responses if Stellar CLI is unavailable. |

---

### Sample CLI Invocations

Transactions on SaloMed require interaction with the smart contract via the Stellar CLI. The contract ID for the current Testnet deployment is `CDND234UYOEJJVXWBALEZDS7PIUU6XPF5KJFS5TD4D5RNETVHUUZ2POS`.

```bash
# Fetch vault data: balance, SaloPoints, and credit tier
soroban contract invoke \
  --id CDND234UYOEJJVXWBALEZDS7PIUU6XPF5KJFS5TD4D5RNETVHUUZ2POS \
  --network testnet \
  -- get_vault \
  --patient <PATIENT_ADDRESS>

# Deposit health remittance: OFW locks USDC (in stroops) into a loved one's vault
soroban contract invoke \
  --id CDND234UYOEJJVXWBALEZDS7PIUU6XPF5KJFS5TD4D5RNETVHUUZ2POS \
  --source ofw_identity \
  --network testnet \
  -- deposit_remittance \
  --ofw <OFW_ADDRESS> \
  --beneficiary <PATIENT_ADDRESS> \
  --amount 1000000000

# Pay medical bill: Atomic settlement from vault to a whitelisted hospital
soroban contract invoke \
  --id CDND234UYOEJJVXWBALEZDS7PIUU6XPF5KJFS5TD4D5RNETVHUUZ2POS \
  --source patient_identity \
  --network testnet \
  -- pay_hospital \
  --patient <PATIENT_ADDRESS> \
  --hospital <HOSPITAL_ADDRESS> \
  --amount 500000000

# Whitelist hospital (Admin only)
soroban contract invoke \
  --id CDND234UYOEJJVXWBALEZDS7PIUU6XPF5KJFS5TD4D5RNETVHUUZ2POS \
  --source admin_identity \
  --network testnet \
  -- whitelist_hospital \
  --admin <ADMIN_ADDRESS> \
  --hospital <HOSPITAL_ADDRESS>
```

---

*SaloMed: Pondong protektado, kalusugan mo'y salo (Protected funds, your health is supported).*
