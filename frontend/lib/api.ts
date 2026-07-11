import { API_URL } from './config';
import { demoTopUp, getRuntimeStatus } from './runtime';

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
// PDAX Integration
// ─────────────────────────────────────────────────────────────────────────────

export interface PdaxStatusResult {
  configured: boolean;
  status: string;
  live_rate: number | null;
  token_valid?: boolean;
}

export interface PdaxRateResult {
  base: string;
  quote: string;
  rate: number;
  source: 'fixed_demo' | 'configured_indicative';
  pdax_enabled: boolean;
}

export interface PdaxDepositResult {
  success: boolean;
  mode: 'demo' | 'pdax_uat' | 'pdax_prod';
  // Present only in explicitly enabled PDAX UAT/production modes.
  checkout_url?: string;
  // Demo transaction ID; it is never a Stellar hash.
  tx_result?: string;
  reference_id: string;
  pdax_reference?: string;
  amount_php: number;
  amount_usdc?: number;
  estimated_amount_usdc?: number;
  beneficiary: string;
  message?: string;
  status: string;
}

export interface PdaxQuoteResult {
  success: boolean;
  quote_id?: string;
  base_amount?: number;
  quote_amount?: number;
  rate?: number;
  expires_at?: number;
  error?: string;
  fallback_rate?: number;
}

/**
 * Check whether the explicitly selected PDAX runtime is available.
 */
export async function getPdaxStatus(): Promise<PdaxStatusResult> {
  const res = await fetch(`${API_URL}/api/pdax/status`);
  return handleResponse<PdaxStatusResult>(res);
}

/**
 * Get the configured indicative USDC/PHP display rate.
 */
export async function getPdaxRate(): Promise<PdaxRateResult> {
  const res = await fetch(`${API_URL}/api/pdax/rate`);
  return handleResponse<PdaxRateResult>(res);
}

/**
 * Demo mode uses the explicit v2 simulation. PDAX transaction endpoints are
 * blocked until verified USDC settlement exists; modes never fall back.
 */
export async function pdaxInitiateDeposit(
  beneficiaryAddress: string,
  amountPhp: number,
  gcashReference?: string,
): Promise<PdaxDepositResult> {
  const runtime = await getRuntimeStatus();
  if (runtime.mode === 'demo') {
    const transactionId = await demoTopUp(beneficiaryAddress, amountPhp);
    return {
      success: true,
      mode: 'demo',
      tx_result: transactionId,
      reference_id: gcashReference || transactionId,
      amount_php: amountPhp,
      amount_usdc: amountPhp / Number(runtime.php_per_asset),
      beneficiary: beneficiaryAddress,
      message: 'SIMULATED top-up completed in the demo vault. No real money moved.',
      status: 'completed',
    };
  }
  if (runtime.mode === 'stellar_testnet') {
    throw new Error('GCash/InstaPay is disabled in Stellar Testnet mode. Use a Freighter USDC deposit.');
  }

  const res = await fetch(`${API_URL}/api/pdax/deposit`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      beneficiary_address: beneficiaryAddress,
      amount_php: amountPhp,
      gcash_reference: gcashReference || `SALOMED-${Date.now()}`,
    }),
  });
  return handleResponse<PdaxDepositResult>(res);
}

/**
 * Firm quotes stay blocked until the private PDAX contract is implemented.
 */
export async function getPdaxQuote(amountUsdc: number): Promise<PdaxQuoteResult> {
  const res = await fetch(`${API_URL}/api/pdax/quote?amount_usdc=${amountUsdc}`);
  return handleResponse<PdaxQuoteResult>(res);
}
