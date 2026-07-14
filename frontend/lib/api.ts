import { API_URL } from './config';

export interface BillScanResult {
  total_bill: number;
  philhealth_deduction: number;
  hmo_deduction: number;
  out_of_pocket_balance: number;
  ocr_mode: string;
}

async function handleResponse<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const body = await res.json().catch(() => ({ detail: res.statusText }));
    const detail = (body as { detail?: string | { message?: string }; message?: string }).detail;
    const message = typeof detail === 'string'
      ? detail
      : detail?.message ?? (body as { message?: string }).message ?? res.statusText;
    throw new Error(message);
  }
  return res.json() as Promise<T>;
}

export async function scanBill(file: File): Promise<BillScanResult> {
  const form = new FormData();
  form.append('file', file);
  const res = await fetch(`${API_URL}/api/scan-bill`, { method: 'POST', body: form });
  return handleResponse<BillScanResult>(res);
}

// ─────────────────────────────────────────────────────────────────────────────
// PDAX InstaPay On-Ramp (live)
// ─────────────────────────────────────────────────────────────────────────────

export interface PdaxStatusResult {
  configured: boolean;
  mode: string;
  connected: boolean;
  status?: string;
  balances?: Record<string, number>;
  message?: string;
}

export interface PdaxQuoteResult {
  success: boolean;
  rate: number;
  asset: string;
  asset_amount: number;
  amount_php: number;
  source: 'pdax_live' | 'coingecko_live' | 'indicative';
}

export interface PdaxDepositResult {
  success: boolean;
  checkout_url: string;
  identifier: string;
  reference_number: string;
  request_id?: string;
  amount_php: number;
  status: string;
  asset_code?: string;
  asset_amount?: number;
  usdc_amount?: number;
  rate?: number;
  rate_source?: 'pdax_live' | 'coingecko_live' | 'indicative';
  review?: Record<string, unknown>;
}

export interface PdaxConfirmResult {
  credited: boolean;
  already?: boolean;
  tx_hash?: string;
  asset_code?: string;
  asset_amount?: number;
  usdc_amount?: number;
  pdax_status?: string;
  settlement_status?: 'pending' | 'credited' | 'failed';
  retry_count?: number;
  retryable?: boolean;
  next_retry_at?: number | null;
}

export interface PdaxDepositStatusResult {
  identifier: string;
  found: boolean;
  pdax_status: string;
  beneficiary_address?: string | null;
  amount_php?: string | number | null;
  credited: boolean;
  tx_hash?: string | null;
  settlement_status?: 'pending' | 'credited' | 'failed';
  retry_count?: number;
  last_error?: string;
  next_retry_at?: number | null;
  retryable?: boolean;
}

/** Live PDAX connectivity + institutional balances. */
export async function getPdaxStatus(): Promise<PdaxStatusResult> {
  const res = await fetch(`${API_URL}/api/pdax/status`);
  return handleResponse<PdaxStatusResult>(res);
}

/** Live PHP to asset conversion quote from PDAX. */
export async function pdaxQuote(amountPhp: number, asset = 'XLM'): Promise<PdaxQuoteResult> {
  const res = await fetch(`${API_URL}/api/pdax/quote?amount_php=${encodeURIComponent(amountPhp)}&asset=${asset}`);
  return handleResponse<PdaxQuoteResult>(res);
}

/** Create a real PDAX InstaPay deposit; returns a live checkout URL. */
export async function pdaxInitiateDeposit(
  beneficiaryAddress: string,
  amountPhp: number,
  senderFirstName = 'SaloMed',
  senderLastName = 'User',
): Promise<PdaxDepositResult> {
  const res = await fetch(`${API_URL}/api/pdax/deposit`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      beneficiary_address: beneficiaryAddress,
      amount_php: amountPhp,
      sender_first_name: senderFirstName,
      sender_last_name: senderLastName,
    }),
  });
  return handleResponse<PdaxDepositResult>(res);
}

/**
 * Poll for payment completion. When PDAX reports the deposit completed, the
 * backend credits the vault with the configured asset and returns the Stellar tx hash.
 */
export async function pdaxConfirm(
  identifier: string,
  beneficiaryAddress: string,
): Promise<PdaxConfirmResult> {
  const res = await fetch(`${API_URL}/api/pdax/confirm`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identifier, beneficiary_address: beneficiaryAddress }),
  });
  return handleResponse<PdaxConfirmResult>(res);
}

/** Read the local PDAX deposit tracking row plus the latest PDAX status. */
export async function pdaxDepositStatus(identifier: string): Promise<PdaxDepositStatusResult> {
  const res = await fetch(`${API_URL}/api/pdax/deposits/${encodeURIComponent(identifier)}`);
  return handleResponse<PdaxDepositStatusResult>(res);
}
