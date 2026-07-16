import {
  contractDeposit,
  contractPayment,
  contractVaultTransfer,
  demoPayment,
  demoRemittance,
  demoTopUp,
  getRuntimeStatus,
  getRuntimeVault,
  type TopUpSource,
} from './runtime';


export interface HealthVault {
  balance: bigint;
  salo_points: number;
  credit_tier: 'Bronze' | 'Silver' | 'Gold';
}

export const EMPTY_VAULT: HealthVault = {
  balance: 0n,
  salo_points: 0,
  credit_tier: 'Bronze',
};

/** Contract rule: one point for every full USDC paid. */
export const POINTS_RATE = { hospital: 1, pharmacy: 1 } as const;
export const PROVIDER_SERVICE_FEE_RATE = 0.0075;
export const PROVIDER_SERVICE_FEE_WAIVED = true;

export interface PaymentBreakdown {
  feeRate: number;
  salomedFee: number;
  merchantReceives: number;
  ptsEarned: number;
  effectiveCost: number;
}

/**
 * Business policy: patients are not charged a SaloMed platform fee. The
 * provider-side service fee is waived in the current pilot because the deployed
 * contract still sends the complete amount to the provider.
 */
export function calcPayment(amountAsset: number, _type: 'hospital' | 'pharmacy'): PaymentBreakdown {
  const ptsEarned = Math.floor(Math.max(0, amountAsset));
  return {
    feeRate: PROVIDER_SERVICE_FEE_RATE,
    salomedFee: 0,
    merchantReceives: amountAsset,
    ptsEarned,
    effectiveCost: amountAsset,
  };
}

export interface PadalaBreakdown {
  feeRate: number;
  salomedFee: number;
  recipientReceives: number;
  ptsEarned: number;
  effectiveCost: number;
}

/** Padala is a growth loop: the complete amount is locked for the beneficiary. */
export function calcPadala(amountAsset: number): PadalaBreakdown {
  return {
    feeRate: 0,
    salomedFee: 0,
    recipientReceives: amountAsset,
    ptsEarned: 0,
    effectiveCost: amountAsset,
  };
}

export async function getVault(patientAddress: string): Promise<HealthVault> {
  if (!patientAddress) return EMPTY_VAULT;
  const vault = await getRuntimeVault(patientAddress);
  return {
    balance: BigInt(vault.balance_stroops),
    salo_points: vault.salo_points,
    credit_tier: vault.credit_tier,
  };
}

/**
 * Fund the caller's own vault.
 * Demo mode: credit the durable simulated ledger.
 * Stellar modes: the USER signs deposit_remittance(user, user, amount) in
 * Freighter; the contract pulls the user's own XLM into their locked vault.
 * The vault balance therefore only increases after a confirmed on-chain tx,
 * and the contract always holds exactly what users deposited.
 */
export async function depositToVault(
  userAddress: string,
  amountAsset: number,
  source?: TopUpSource,
  amountPhpOverride?: number,
): Promise<string> {
  const runtime = await getRuntimeStatus();
  // Top-ups are funded by the SaloMed on-ramp float (admin) via the backend,
  // which signs a real on-chain deposit_remittance into the user's vault. This
  // is the reliable path: the user does not need to hold XLM or sign, and the
  // vault is credited with real, Explorer-traceable XLM. Returns a real tx hash
  // in Stellar mode; demo mode credits the durable ledger. The `source` records
  // which top-up method was used so history can show "Top-up via ...".
  return demoTopUp(userAddress, amountPhpOverride ?? amountAsset * Number(runtime.php_per_asset), source);
}

/**
 * Demo: providerId is checked against the demo whitelist and the SQLite vault
 * is atomically debited. Stellar modes: providerAddress is enforced by Soroban.
 */
export async function payHospital(
  patientAddress: string,
  providerIdOrAddress: string,
  amountAsset: number,
): Promise<string> {
  const runtime = await getRuntimeStatus();
  if (runtime.mode === 'demo') {
    return demoPayment(patientAddress, providerIdOrAddress, amountAsset);
  }
  return contractPayment(patientAddress, providerIdOrAddress, amountAsset);
}

/**
 * Demo: moves locked value between demo vaults.
 * Stellar modes: sender signs deposit_remittance directly into beneficiary vault.
 */
export async function sendPadala(
  senderAddress: string,
  beneficiaryAddress: string,
  amountAsset: number,
): Promise<string> {
  const runtime = await getRuntimeStatus();
  if (runtime.mode === 'demo') {
    return demoRemittance(senderAddress, beneficiaryAddress, amountAsset);
  }
  return contractVaultTransfer(senderAddress, beneficiaryAddress, amountAsset);
}
