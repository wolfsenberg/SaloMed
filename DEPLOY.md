# SaloMed Deployment Guide (Vercel + Render)

SaloMed deploys in **demo mode** with a persistent PostgreSQL database. The
demo flow is frictionless (no wallet needed per action), and balances plus
transaction history **persist** across Render free-tier spin-downs and
redeploys because they live in managed Postgres, not on the ephemeral
container filesystem.

The backend auto-selects its storage:
- `DATABASE_URL` present  -> PostgreSQL (deployed / production)
- `DATABASE_URL` absent   -> local SQLite (local development)

## Architecture

```
Browser
  │  /api/... (demo flow, no wallet needed)
  ▼
Frontend (Vercel)  ──►  Backend (Render, demo mode)  ──►  PostgreSQL (Render)
                                                          persists balances + history
```

## Step 1 — Deploy backend + database to Render

1. Push this repo to GitHub.
2. In Render: New + → Blueprint → select this repo (uses `render.yaml`).
   This provisions both the `salomed-backend` web service and the free
   `salomed-db` Postgres instance, and wires `DATABASE_URL` automatically.
3. Set the one dashboard-only var:
   - `FRONTEND_ORIGIN` = your Vercel URL (add after Step 2, e.g.
     `https://salomed.vercel.app`). Comma-separated origins are supported.
4. Deploy. Confirm `https://<your-backend>.onrender.com/api/runtime` returns
   `"mode": "demo"`.
5. Confirm persistence: hit `/api/v2/topups` (or use the app), then redeploy or
   wait for a spin-down, and confirm the balance is still there.

Note: Render's free Postgres instances expire after a set period on the free
plan. For a hackathon window this is fine; for anything longer, upgrade the DB.

## Step 2 — Deploy frontend to Vercel

Import the `frontend/` directory as a Vercel project (Next.js autodetected;
`frontend/vercel.json` sets the build commands).

Set these Environment Variables in Vercel (Production):

| Variable | Value |
|---|---|
| `NEXT_PUBLIC_API_URL` | `https://<your-backend>.onrender.com` |
| `NEXT_PUBLIC_CONTRACT_ID` | `CAO3K6OYB5A3VNVV3HKCSVG3ZZ442DZCDKAXG4CTSLBTN7FOYCCBRZ34` |
| `NEXT_PUBLIC_RPC_URL` | `https://soroban-testnet.stellar.org` |
| `NEXT_PUBLIC_NETWORK_PASSPHRASE` | `Test SDF Network ; September 2015` |

(`NEXT_PUBLIC_TOKEN_CONTRACT_ID` and `NEXT_PUBLIC_ADMIN_ADDRESS` are only
required for stellar_testnet mode; leave them unset for the demo deployment.)

Deploy, then copy the Vercel URL into Render's `FRONTEND_ORIGIN` and redeploy
the backend so CORS allows browser calls.

## Step 3 - Enable GitHub Actions CD

The CI workflow always validates frontend, backend, and contract code. To let
GitHub Actions trigger production deployments after CI passes, add these GitHub
repository secrets:

| Secret | Purpose |
|---|---|
| `RENDER_DEPLOY_HOOK_URL` | Render deploy hook for `salomed-backend` |
| `VERCEL_DEPLOY_HOOK_URL` | Vercel deploy hook for the frontend project |

If either secret is missing, the workflow logs a notice and skips that deploy
instead of failing CI.

For manual smart contract release, add:

| Secret | Purpose |
|---|---|
| `STELLAR_DEPLOY_SECRET_KEY` | Testnet signer used only by the manual contract release workflow |

The smart contract workflow is never automatic. Run **SaloMed Smart Contract
Release** manually, type `DEPLOY_TESTNET`, and provide the intended admin and
token addresses before initializing a new contract.

## Step 4 - Verify

1. Open the Vercel URL, do a GCash/InstaPay top-up, a payment, and a padala.
2. Reload the page — balance and history persist (read from Postgres).
3. Redeploy the backend, reload again — data still persists.

## Optional: promote to real on-chain (stellar_testnet) later

To switch the deployment to real on-chain transactions (source of truth is the
Soroban contract, no DB needed):

1. Backend env: `SALOMED_MODE=stellar_testnet`, set `SALOMED_EXPECTED_TOKEN_ID`
   and `ADMIN_ADDRESS` to the contract's `get_token_id()` / `get_admin()`, and
   after verifying them on-chain set `SALOMED_CONTRACT_CONFIG_VERIFIED=true`.
2. Frontend env: set `NEXT_PUBLIC_TOKEN_CONTRACT_ID` and
   `NEXT_PUBLIC_ADMIN_ADDRESS` to the SAME values. They must match exactly or
   the app blocks on-chain actions by design.
3. Users then need Freighter on Testnet, funded via https://friendbot.stellar.org

## Demo-day checklist (recommended safety net)

- Warm up the Render free service before judging (first request after idle has
  a cold-start delay of ~30-60s).
- Keep a 60-second screen recording of the full flow as a backup in case of
  network issues during the live demo.
