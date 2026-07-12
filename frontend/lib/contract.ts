import {
  contractDeposit,
  contractPayment,
  contractVaultTransfer,
  demoPayment,
  demoRemittance,
  demoTopUp,
  getRuntimeStatus,
  getRuntimeVault,
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

export interface PaymentBreakdown {
  feeRate: number;
  salomedFee: number;
  merchantReceives: number;
  ptsEarned: number;
  effectiveCost: number;
}

/**
 * The deployed contract sends the complete amount to the provider and does not
 * implement a fee split or cash-equivalent cashback. Keep receipts truthful.
 */
export function calcPayment(amountAsset: number, _type: 'hospital' | 'pharmacy'): PaymentBreakdown {
  const ptsEarned = Math.floor(Math.max(0, amountAsset));
  return {
    feeRate: 0,
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

/** Deposits lock the complete amount for the beneficiary; no fee exists yet. */
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
 * Demo: credit the authoritative simulated ledger.
 * Stellar modes: user signs deposit_remittance; the contract transfers its
 * configured USDC token from the user into the locked vault.
 */
export async function depositToVault(userAddress: string, amountAsset: number): Promise<string> {
  const runtime = await getRuntimeStatus();
  // Both demo and Stellar modes fund the vault via the backend on-ramp credit
  // (admin-funded in Stellar mode). This avoids requiring the user to pre-hold
  // USDC or a trustline. Returns a real on-chain tx hash in Stellar mode.
  return demoTopUp(userAddress, amountAsset * Number(runtime.php_per_asset));
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
