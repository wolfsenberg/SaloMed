import * as StellarSdk from '@stellar/stellar-sdk';
import { signTransaction } from './freighter';

import { API_URL, CONTRACT_ID, RPC_URL, NETWORK_PASSPHRASE, PHP_PER_XLM } from './config';

const rpc = new StellarSdk.rpc.Server(RPC_URL);
const horizon = new StellarSdk.Horizon.Server("https://horizon-testnet.stellar.org");

export interface HealthVault {
  balance: bigint;       // stroops (divide by 10_000_000 for XLM display)
  salo_points: number;
  credit_tier: 'Bronze' | 'Silver' | 'Gold';
}

export const EMPTY_VAULT: HealthVault = {
  balance: 0n,
  salo_points: 0,
  credit_tier: 'Bronze',
};

interface BackendVaultResponse {
  balance_stroops: number;
  salo_points: number;
  credit_tier: string;
}

/**
 * Fetch vault state via the backend (which calls `get_vault` through the Stellar CLI).
 * This avoids browser CORS/SDK issues with direct Soroban RPC calls.
 */
// 50 SaloPoints = 1 XLM  (savings vault conversion rate)
export const POINTS_PER_XLM = 50;

export function savingsXlm(vault: HealthVault): number {
  return vault.salo_points / POINTS_PER_XLM;
}

// Points earned per XLM paid, by provider type
export const POINTS_RATE = { hospital: 2, pharmacy: 1 } as const;

// ── Fee / cashback structure ──────────────────────────────────────────────────
// Merchant is charged a platform fee; user earns cashback via SaloPoints.
// SaloMed keeps 0.5% margin on every transaction type.
//
//  Type       Merchant fee   User cashback   SaloMed keeps
//  Hospital       2.5%           2%              0.5%
//  Pharmacy       1.5%           1%              0.5%
//  Padala         1.5%           1%              0.5%

export const MERCHANT_FEE   = { hospital: 0.045, pharmacy: 0.025 } as const;
export const PADALA_FEE     = 0.025;
export const SALOMED_MARGIN = 0.005;

export interface PaymentBreakdown {
  feeRate:           number;
  salomedFee:        number;
  merchantReceives:  number;
  ptsEarned:         number;
  cashbackXlm:       number;
  effectiveCost:     number;
}

export function calcPayment(amountXlm: number, type: 'hospital' | 'pharmacy'): PaymentBreakdown {
  const feeRate          = MERCHANT_FEE[type];
  const salomedFee       = amountXlm * feeRate;
  const merchantReceives = amountXlm - salomedFee;
  const ptsEarned        = Math.floor(amountXlm * POINTS_RATE[type]);
  const cashbackXlm      = ptsEarned / POINTS_PER_XLM;
  const effectiveCost    = amountXlm - cashbackXlm;
  return { feeRate, salomedFee, merchantReceives, ptsEarned, cashbackXlm, effectiveCost };
}

export interface PadalaBreakdown {
  feeRate:            number;
  salomedFee:         number;
  recipientReceives:  number;
  ptsEarned:          number;
  cashbackXlm:        number;
  effectiveCost:      number;
}

export function calcPadala(amountXlm: number): PadalaBreakdown {
  const feeRate           = PADALA_FEE;
  const salomedFee        = amountXlm * feeRate;
  const recipientReceives = amountXlm - salomedFee;
  const ptsEarned         = Math.floor(amountXlm);   // 1 pt/XLM
  const cashbackXlm       = ptsEarned / POINTS_PER_XLM;
  const effectiveCost     = amountXlm - cashbackXlm;
  return { feeRate, salomedFee, recipientReceives, ptsEarned, cashbackXlm, effectiveCost };
}

export async function getVault(patientAddress: string): Promise<HealthVault> {
  if (!patientAddress) return EMPTY_VAULT;
  try {
    // Primary: get real XLM balance from Horizon via backend /api/balance
    const res = await fetch(
      `${API_URL}/api/balance?address=${encodeURIComponent(patientAddress)}`,
    );
    if (res.ok) {
      const data = await res.json();
      const tierRaw = data.credit_tier ?? 'Bronze';
      const credit_tier = (['Bronze', 'Silver', 'Gold'].includes(tierRaw)
        ? tierRaw
        : 'Bronze') as HealthVault['credit_tier'];
      return {
        balance:     BigInt(data.balance_stroops ?? 0),
        salo_points: Number(data.salo_points ?? 0),
        credit_tier,
      };
    }
  } catch {
    // fall through to Soroban fallback
  }

  // Fallback 2: try the old Soroban get_vault endpoint
  try {
    const res = await fetch(
      `${API_URL}/api/vault/balance?patient_address=${encodeURIComponent(patientAddress)}`,
    );
    if (res.ok) {
      const data: BackendVaultResponse = await res.json();
      const tierRaw = data.credit_tier ?? 'Bronze';
      const credit_tier = (['Bronze', 'Silver', 'Gold'].includes(tierRaw)
        ? tierRaw
        : 'Bronze') as HealthVault['credit_tier'];
      return {
        balance:     BigInt(data.balance_stroops ?? 0),
        salo_points: Number(data.salo_points ?? 0),
        credit_tier,
      };
    }
  } catch {
    // fall through to direct Horizon fallback
  }

  // Fallback 3: Query Stellar Horizon directly (bypasses backend entirely)
  // This ensures the wallet balance is always visible even if the backend
  // is running an older version without /api/balance or /api/vault/balance.
  try {
    const horizonRes = await fetch(
      `https://horizon-testnet.stellar.org/accounts/${encodeURIComponent(patientAddress)}`,
    );
    if (horizonRes.ok) {
      const data = await horizonRes.json();
      const balances: Array<{ asset_type: string; balance: string }> = data.balances ?? [];
      const nativeBal = balances.find(b => b.asset_type === 'native');
      const xlm = parseFloat(nativeBal?.balance ?? '0');
      const stroops = BigInt(Math.floor(xlm * 10_000_000));
      console.info('[getVault] Backend unavailable — loaded balance directly from Horizon.');
      return {
        balance:     stroops,
        salo_points: 0,
        credit_tier: 'Bronze',
      };
    }
  } catch {
    // Account not funded or Horizon unreachable
  }

  return EMPTY_VAULT;
}


/**
 * Submit a signed XDR to Horizon (native XLM payments, NOT Soroban txs).
 * Soroban RPC only accepts Soroban smart contract invocations — native payments
 * must go through Horizon.
 */
export async function submitSignedXdrToHorizon(signedXdr: string): Promise<string> {
  const response = await fetch('https://horizon-testnet.stellar.org/transactions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `tx=${encodeURIComponent(signedXdr)}`,
  });
  const data = await response.json();
  if (!response.ok) {
    // Extract the most useful error message from Horizon's response
    const extras = data?.extras;
    const resultCodes = extras?.result_codes;
    const opCodes = resultCodes?.operations?.join(', ');
    const txCode  = resultCodes?.transaction;
    const detail  = opCodes
      ? `Transaction failed — op: ${opCodes}, tx: ${txCode}`
      : (data?.title ?? data?.detail ?? `Horizon error ${response.status}`);
    throw new Error(detail);
  }
  return data.hash as string;
}

/**
 * Sign an XDR with Freighter then submit to Horizon.
 * Used for: payments (user → merchant) and padala (ofw → beneficiary).
 */
export async function signAndSubmitXdr(userAddress: string, xdr: string): Promise<string> {
  console.log('[SaloMed] Prompting Freighter to sign transaction…');

  // 1. Sign via Freighter
  const signedXdr = await signTransaction(xdr);
  if (!signedXdr) {
    throw new Error('Transaction signing was rejected or Freighter is not connected.');
  }
  console.log('[SaloMed] Signed. Submitting to Horizon…');

  // 2. Submit to Horizon (native XLM payment — NOT Soroban RPC)
  const txHash = await submitSignedXdrToHorizon(signedXdr);
  console.log('[SaloMed] SUCCESS! tx hash:', txHash);
  return txHash;
}

/**
 * GCash Top-Up: Backend signs and submits a REAL XLM payment to the user's wallet.
 * Uses /api/topup-legacy which directly signs with SALOMED_SIGNER_SECRET — no CLI needed.
 * Falls back to /api/gcash/cash-in (contract-based) if legacy fails.
 */
export async function depositToVault(userAddress: string, amountXlm: number): Promise<string> {
  const amountPhp = amountXlm * PHP_PER_XLM;

  // 1. PRIMARY: /api/topup-legacy — direct XLM transfer, no Stellar CLI dependency.
  //    Uses query params as defined in the backend OpenAPI spec.
  try {
    const url = `${API_URL}/api/topup-legacy?patient_address=${encodeURIComponent(userAddress)}&amount_php=${amountPhp}`;
    const res = await fetch(url, { method: 'POST' });

    if (res.ok) {
      const data = await res.json();
      // Returns { tx_hash: "...", ... } or similar
      return data.tx_hash || data.transaction_hash || data.hash || data.id || 'ok';
    }

    // If it fails for a non-404 reason (e.g. backend error), log and fall through
    if (res.status !== 404) {
      let errMsg = 'Top-up (legacy) failed';
      try { const d = await res.json(); errMsg = d.detail || d.message || errMsg; } catch {}
      console.warn('[depositToVault] topup-legacy non-200:', errMsg);
      // Don't throw — fall through to next route
    }
  } catch (e: any) {
    console.warn('[depositToVault] topup-legacy network error:', e.message);
    // Fall through to next route
  }

  // 2. FALLBACK: /api/gcash/cash-in — contract-based, may need Stellar CLI on server.
  try {
    const res = await fetch(`${API_URL}/api/gcash/cash-in`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        beneficiary_address: userAddress,
        amount_php: amountPhp,
        gcash_reference: `GC-${Date.now()}`
      }),
    });

    if (res.ok) {
      const data = await res.json();
      return typeof data.tx_result === 'string'
        ? data.tx_result
        : (data.tx_result?.hash || data.tx_result?.id || 'gcash-ok');
    }

    let errMsg = 'All top-up routes failed';
    try { const d = await res.json(); errMsg = d.detail || d.message || errMsg; } catch {}
    throw new Error(errMsg);
  } catch (e: any) {
    throw new Error(e.message || 'Top-up failed: could not reach backend');
  }
}



/**
 * Payment: user → merchant/hospital.
 * Backend prepares unsigned XDR → Freighter signs → frontend submits to Horizon.
 */
export async function payHospital(
  patientAddress: string,
  hospitalAddress: string,
  amountXlm: number,
): Promise<string> {
  // 1. Get unsigned XDR from backend
  let res = await fetch(
    `${API_URL}/api/prepare-payment?user_address=${encodeURIComponent(patientAddress)}&recipient_address=${encodeURIComponent(hospitalAddress)}&amount_xlm=${amountXlm}`,
    { method: 'POST' },
  );
  
  // Fallback to /api/qrph/pay if prepare-payment isn't there
  if (res.status === 404) {
    console.info('[payHospital] prepare-payment 404, falling back to /api/qrph/pay...');
    const triggerRes = await fetch(`${API_URL}/api/qrph/pay`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        patient_address: patientAddress,
        hospital_id: hospitalAddress,
        amount_usdc: amountXlm,
      }),
    });
    if (!triggerRes.ok) throw new Error('Hospital payment failed (legacy)');
    const data = await triggerRes.json();
    return typeof data.tx_result === 'string' ? data.tx_result : (data.tx_result?.hash || 'ok');
  }

  const data = await res.json();
  if (!res.ok) throw new Error(data.detail ?? 'Preparation failed');

  // 2. Sign with Freighter + submit to Horizon
  return await signAndSubmitXdr(patientAddress, data.xdr);
}

/**
 * Padala (remittance): OFW → family member on Stellar.
 * Backend prepares unsigned XDR → Freighter signs → frontend submits to Horizon.
 */
export async function sendPadala(
  ofwAddress: string,
  beneficiaryAddress: string,
  amountXlm: number,
): Promise<string> {
  // 1. Get unsigned XDR from backend
  let res = await fetch(
    `${API_URL}/api/prepare-padala?ofw_address=${encodeURIComponent(ofwAddress)}&beneficiary_address=${encodeURIComponent(beneficiaryAddress)}&amount_xlm=${amountXlm}`,
    { method: 'POST' },
  );

  // Fallback to /api/gcash/cash-in if prepare-padala is missing
  if (res.status === 404) {
    console.info('[sendPadala] prepare-padala 404, falling back to /api/gcash/cash-in...');
    const triggerRes = await fetch(`${API_URL}/api/gcash/cash-in`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        beneficiary_address: beneficiaryAddress,
        sender_address: ofwAddress,
        amount_php: amountXlm * PHP_PER_XLM,
        gcash_reference: `GC-REMIT-${Date.now()}`
      }),
    });
    if (!triggerRes.ok) throw new Error('Padala failed (legacy)');
    const data = await triggerRes.json();
    return typeof data.tx_result === 'string' ? data.tx_result : (data.tx_result?.hash || 'ok');
  }

  const data = await res.json();
  if (!res.ok) throw new Error(data.detail ?? 'Padala preparation failed');

  // 2. Sign with Freighter + submit to Horizon
  return await signAndSubmitXdr(ofwAddress, data.xdr);
}


// PHP per XLM rate (used for depositToVault conversion)
// Moved to config.ts
