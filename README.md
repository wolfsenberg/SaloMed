# SaloMed: Your Health Alkansya

> **The Problem: Ang sakit na nga, mas masakit pa sa bulsa.**
>
> For many Filipinos, saving up for emergencies is a major goal. However, the reality of having an easily accessible emergency fund is that temptation is always just a few taps away. It's incredibly easy to justify a sudden online purchase, an impromptu dinner out, or a gadget upgrade.
>
> Before you know it, the savings start getting chipped away. The real problem hits when a sudden medical emergency arises. Because the funds have been spent, there is no money left for hospital bills or expensive prescriptions. The inevitable ending? People resort to borrowing. **Napipilitan tayong mangutang.** It leads to high-interest debt, adding massive emotional and financial stress to the family.
>
> This issue extends to remittances as well. When a family member sends money specifically for healthcare—whether it's an OFW abroad or an older sibling working in Manila—there is always the lingering fear of funds being misspent. **Pampa-checkup sana, pero nabili ng luho.** The sender has no guarantee that the money was actually used for medicine.

💡 **The Solution: Enter SaloMed: Your Health Alkansya**

SaloMed is a purpose-built digital health alkansya (piggy bank). It functions just like the e-wallets we use every single day, but with one massive difference: the money you put in here is strictly locked and can only be spent on healthcare.

Think of it as the ultimate discipline tool for your health savings. We give you a super familiar, frictionless e-wallet experience, but quietly empower it with an unbreakable layer of smart contracts running on the Stellar Network.

**Live App:** [https://salomedhealthalkansya.vercel.app/](https://salomedhealthalkansya.vercel.app/)
**Pitch Document:** [Google Docs](https://docs.google.com/document/d/134i9LdSE-X0jaV2Nr0X9SSptM7tY4yRtdCkYO2t2260/edit?usp=sharing)

---

## Key Features

### 1. Health Vault (The Alkansya)
The core of SaloMed is an escrow vault for a single user. Users save funds in a decentralized vault protected by a smart contract. These funds are reserved for health emergencies, ensuring financial readiness when medical needs arise.

### 2. Direct-to-Hospital Payments
Pay the clinical gap directly to whitelisted hospitals and pharmacies using Stellar. Payments are atomic and near-instant, generating permanent on-chain receipts for every transaction.

### 3. SaloPoints and Micro-Loans
Every successful saving or payment transaction earns the user SaloPoints.
*   **Credit Tiers**: Accumulating points moves users through Bronze, Silver, and Gold tiers.
*   **Emergency Loans**: Users can apply for micro-loans based on their current credit tier if their vault balance is insufficient to cover a medical bill.

### 4. Health Padala (Remittance)
Designed for OFWs and family members abroad. Send health-specific remittances directly into a loved one's SaloMed Vault. This ensures that the remittance is securely locked and reserved strictly for medical expenses.

---

## Tech Stack

| Layer | Technology |
|---|---|
| **Blockchain** | Stellar Soroban (Smart Contracts) |
| **Smart Contract** | Rust + `soroban-sdk` |
| **Frontend** | Next.js 14 (App Router), Tailwind CSS, Framer Motion |
| **Backend** | FastAPI (Python 3.11) |
| **Wallet** | Freighter Wallet |
| **Payments** | XLM and USDC (Stellar Assets) |
| **Deployment** | Vercel (Frontend), Render (Backend) |

---

## Project Structure

```
SaloMed/
├── backend/            # FastAPI server: OCR processing and GCash Bridge logic
├── contracts/          # Soroban Smart Contracts (Rust)
├── frontend/           # Next.js 14 Application (React, Tailwind)
└── README.md           # Documentation
```

---

## Setup and Local Development

### 1. Prerequisites
*   Node.js 18+ and npm
*   Python 3.11+ (with Tesseract OCR engine installed)
*   Stellar CLI and Rust (for contract development)

### 2. Backend Setup
```bash
cd backend
python -m venv venv
source venv/bin/activate  # or venv\Scripts\activate on Windows
pip install -r requirements.txt
uvicorn main:app --reload
```

### 3. Frontend Setup
```bash
cd frontend
npm install
npm run dev
```
Update your `.env.local` with `NEXT_PUBLIC_API_URL` pointing to the FastAPI server.

---

## App Flow

1.  **Connect Wallet**: Link a Freighter wallet to access the Health Vault.
2.  **Top Up**: Add funds via XLM/USDC or receive a remittance from a relative.
3.  **Pay or Borrow**: Pay a medical bill from the Vault using a QR code or provider search. If short, apply for an instant micro-loan based on credit tiers.
4.  **Earn Points**: Build credit history with every successful health-related transaction.

---

## Smart Contract Reference

**Contract ID (Testnet):** `CDND234UYOEJJVXWBALEZDS7PIUU6XPF5KJFS5TD4D5RNETVHUUZ2POS`

| Function | Description |
|---|---|
| `initialize` | Setup admin and token addresses |
| `deposit_remittance` | Remittance top-up for a beneficiary vault |
| `pay_hospital` | Atomic payment from vault to whitelisted hospital |
| `get_vault` | Fetch balance, SaloPoints, and credit tier |
| `whitelist_hospital` | Admin: Add authorized medical providers |

---

## How Stellar Powers SaloMed

1.  **Atomic Transactions**: The payment to the hospital and the deduction from the vault happen simultaneously. It is impossible for one to fail without the other.
2.  **Soroban Smart Contracts**: Business logic for SaloPoints and credit tiers is executed on-chain for transparency and trust.
3.  **Low Fees**: Stellar's extremely low fees ensure that patient savings are used for medical care, not banking surcharges.
4.  **Global Liquidity**: OFWs can send funds home instantly, leveraging Stellar's ecosystem to convert global assets into local health security.

---

## Proof of Work

*   **Verified Contracts**: All core logic validated with 100% rust test coverage.
*   **User Interface**: Professional, mobile-first design using modern animation and layout practices.

---

**SaloMed: Pondong protektado, kalusugan mo'y salo.**
