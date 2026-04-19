const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000';

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
    const res = await fetch(
      `${API_URL}/api/vault/balance?patient_address=${encodeURIComponent(patientAddress)}`,
    );
    if (!res.ok) return EMPTY_VAULT;
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
  } catch {
    return EMPTY_VAULT;
  }
}
