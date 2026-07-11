Immediate secret rotation and remediation steps
=============================================

This repository previously contained sensitive values in `backend/.env`.
Those values have been removed from the committed file and replaced with
placeholders. The secrets MUST be rotated immediately in external systems.

Action checklist
----------------
- Rotate `SALOMED_SIGNER_SECRET` (Stellar keypair) and replace it in your
  deployment platform's secret store. Revoke any leaked keys where possible.
- Rotate `PDAX_USERNAME`/`PDAX_PASSWORD` in the PDAX dashboard and any
  associated API credentials. If PDAX issued API keys or client secrets,
  rotate/invalidate them.
- Set a new `PDAX_WEBHOOK_SECRET` in PDAX dashboard and update the deployed
  `PDAX_WEBHOOK_SECRET` env var.
- Remove `backend/.env` from any shared storage and ensure it's present only
  on developer machines (never in version control). Confirm `.gitignore` is
  in place (already configured to ignore `.env` files).
- Update CI/CD environment variables (Vercel/Render/GitHub Actions/other)
  to use the new secrets rather than storing `.env` in the repo.
- Run a repository secrets scan (e.g. `git-secrets`, `trufflehog`) and if
  further leaks are found, remove them and rotate the affected secrets.

Notes
-----
- Rotating secrets is the only reliable remediation for leaked credentials.
- If the leaked key was used in production, monitor for suspicious activity
  (unauthorised webhook calls, unexpected transfers) and contact PDAX support.

If you want, I can: (1) create a small script to help find commits containing
secrets, or (2) open a PR that removes the env file from the repo history
(requires `git filter-branch`/`bfg` and careful coordination).
